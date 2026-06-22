# Agent 5 · 趋势与选题智能体
## 技术规格文档 V2.0（完整版）

> 本文档是 Agent 5 的唯一权威技术规格。无需查阅其他文档，按本文档可直接实施完整系统。

---

## 一、系统概述

### 1.1 在 RISEN OS 中的定位

```
Agent4（内容策略） → Narrative（大策略约束）
     ↓
Agent5（趋势与选题） → TopicPool + TrendBrief + EditorialCalendar
     ↓
Agent6（内容创作） → 实际内容产出
```

### 1.2 输入与输出

| 输入 | 来源 | 必需 |
|------|------|------|
| Narrative 约束 | Agent4 | 是 |
| 信号数据（三技能并发采集） | aihot + follow-builders + tech-news-digest | 是 |
| Feedback 数据 | Agent4 或内置 Mock | 否 |
| 分发规则 | distribution_rules.yml | 否（有默认值） |

| 输出 | 位置 | 给谁 |
|------|------|------|
| TopicPool | JSON（内嵌完整输出） | Agent6 |
| TrendBrief（含 Search Intent） | JSON（内嵌完整输出） | Agent6 |
| DistributionMap | JSON（内嵌完整输出） | Agent6 |
| EditorialCalendar | JSON（内嵌完整输出） | Agent6 |
| 完整 Pipeline 输出 | mock-data/agent5-complete-output.json | 调试/查看 |
| 彩色 Terminal 报告 | agent5-report.py | 用户查看 |

### 1.3 运行

```bash
cd /workspace/risen-agent5
node agent5-core.js       # 完整 pipeline（信号采集→输出）
python3 agent5-report.py # 彩色 Terminal 报告（需 UTF-8 终端）
```

---

## 二、Pipeline Step 1-9

```
Step1: collectSignalsFromAllSkills()         → RawSignal[]（三个技能并发采集）
Step2: generateTopicCluster()                → TopicPool（聚类+方向+Feedback Boost）
Step3: scoreTopics()                       → TopicScore[]（10维评分+SearchIntentMap）
Step4: routeDistribution()                 → DistributionMap（12平台全路由，P0/P1/P2）
Step5: buildContentCalendar()               → EditorialCalendar（7天×12平台）
Step6: collectResources()                  → Resources（YouTube/arXiv/网页）
Step7: buildTopicBrief()                   → TrendBrief（含 SearchIntent）
Step8: 保存 mock-data/agent5-complete-output.json
Step9: 保存 output/trend-brief-*.md
```

---

## 三、信号采集层（skills/collect-signals.js）

### 3.1 三个技能

| 技能 | 来源 | 数量 | 需要 Token |
|------|------|------|----------|
| aihot | aihot.virxact.com REST API | 50条 | 否 |
| follow-builders | Anthropic/OpenAI/DeepMind/Google AI/Meta AI/Microsoft AI/Stability AI RSS | 各10条 | 否 |
| tech-news-digest | HN/VentureBeat AI/MIT Tech Review/The Verge/TechCrunch AI/Wired/AI News RSS | 各10条 | 否 |

### 3.2 RawSignal 格式

```javascript
interface RawSignal {
  id: string              // 'SIG-{SOURCE}-{hash}'
  type: string            // 'aihot' | 'follow-builders' | 'tech-news'
  title: string
  summary: string
  url: string | null
  published_at: string | null  // ISO 时间戳
  collected_at: string       // 采集时刻
  tags: string[]
  weight: number           // 0.8-1.5（来自原始 score 归一化）
  content_type: string       // '行业洞察' | '产品发布' | '论文研究' | '利他（教程）' | '企业案例'
  metadata: object           // 原始数据（aihot_id, source, category 等）
}
```

### 3.3 采集函数签名

```javascript
async function collectSignalsFromAllSkills(): Promise<RawSignal[]>

async function collectAihot(limit = 50): Promise<RawSignal[]>
async function collectFollowBuilders(): Promise<RawSignal[]>
async function collectTechNews(): Promise<RawSignal[]>

function fetch(url: string, timeoutMs?: number): Promise<{ok, status?, body?, error?}>
function parseRSS(xml: string): Array<{title, link, desc, pub}>
function shortHash(s: string): string
function nowISO(): string
```

### 3.4 去重逻辑

按 `title.slice(0, 40).toLowerCase()` 去重，保留第一条。

---

## 四、Skill 5 TopicCluster（skills/topic-cluster.js）

### 4.1 入口函数

```javascript
function generateTopicCluster(opts: {
  signals: RawSignal[],
  narrativeConstraint: Narrative,
  directionCount: number,        // 默认 5
  feedbackSignals: FeedbackSignal[]  // Agent4 回传的高反馈数据
}): TopicPool
```

### 4.2 FeedbackSignal 格式

```javascript
interface FeedbackSignal {
  topic_keyword: string   // 关键词，如 'Claude Code'
  engagement_score: number // 0-5，0=无反馈，5=极高反馈
  content_type: string     // '行业洞察' | '企业案例' | ...
}
```

### 4.3 Boost 逻辑

```javascript
function buildTopicBoostMap(feedbackSignals): Map<topic_keyword, boost>
// boost = Math.min(0.8, engagement_score * 0.15)
// 取同类关键词的最大 boost，不叠加
// 应用到 cluster.title（信号聚类标题），而非个别信号
```

### 4.4 TopicPool 格式

```javascript
interface TopicPool {
  topics: Topic[]
  summary: {
    total_signals: number
    total_topics: number
    total_directions: number
    narrative_coverage: number  // [0,1]
    avg_score: number
  }
}

interface Topic {
  topic_id: string        // 'TOPIC-001'
  title: string
  source_signals: string[]  // 信号 ID 列表
  source_type: string       // 主流信号类型
  content_type: string       // '行业洞察' | '产品发布' | ...
  core_viewpoint: string     // 一句话核心观点
  narrative_fit: boolean     // 是否符合 Narrative 约束（含禁用词检测）
  feedback_boost: number     // Boost 分（0 表示无）
  directions: Direction[]     // 默认 5 个方向
  total_score: number        // 含 Boost 的最终分
  created_at: string
}

interface Direction {
  direction_id: string         // 'D1' | 'D2' ...
  angle_type: string            // '老板视角' | '对比分析' | '教程向' ...
  core_claim: string           // 核心论点一句话
  content_forms: string[]       // ['图文', '深度文章'] ← 关键！决定分发平台
  target_audiences: string[]
  required_evidence: string[]
  hooks: string[]
  risks: string[]
  priority: 'high' | 'medium' | 'low'
}
```

---

## 五、Skill 6 PlatformScorer（skills/platform-scorer.js）

### 5.1 入口函数

```javascript
function scoreTopics(topicPool: TopicPool, narrativeConstraint: Narrative): TopicScoreResult
```

### 5.2 TopicScoreResult 格式

```javascript
interface TopicScoreResult {
  results: [{
    topic_id: string
    title: string
    search_intent: {             // 供 Trend Brief 使用
      [platform_id: string]: {
        intent_type: string       // '导航型' | '信息型' | '商业型' | '交易型'
        intent_strength: number   // 3.0-5.0
        score: number             // 最终评分
      }
    }
    direction_scores: [{
      direction_id: string
      content_forms: string[]
      angle_type: string
      platform_scores: { [platform_id: string]: PlatformScore }
    }]
    best_platform: string        // 最高分平台 ID
    platform_ranking: [{ platform_id, score, recommendation }]
  }]
}
```

### 5.3 PlatformScore（10维）

```javascript
interface PlatformScore {
  total_score: number   // 加权总分（1-5）
  breakdown: {
    strategy_fit: number          // Narrative 策略匹配度
    jtbds_strength: number        // 客户需求强度（JTBDS 模型）
    search_opportunity: number    // 搜索机会（Intent Map）
    social_heat: number          // 社交热度
    differentiation: number       // 差异化
    evidence_quality: number     // 证据充足度
    platform_fit: number         // 平台适配度（content_forms × platform.type）
    biz_value: number           // 商业价值
    risk: number               // 风险
    production_cost: number      // 生产成本
  }
  recommendation: string
}
```

### 5.4 Search Intent Map（PRD Section 13 明确要求）

四类意图：

| 意图类型 | 检测关键词 | 知乎 | 公众号 | 头条 |
|---------|-----------|------|--------|------|
| 信息型 | 是什么、为什么、教程、对比、分析 | 4.5 | 3.7 | 3.8 |
| 商业型 | 多少钱、对比、vs、推荐 | 3.7 | 4.5 | 3.8 |
| 交易型 | 注册、试用、下载 | 2.5 | 4.3 | 2.5 |
| 导航型 | Jova、Coze、官网 | 2.5 | 3.0 | 2.5 |

### 5.5 calcSocialHeat（内容类型 × 平台）

```javascript
// 高热度话题信号：标题含'热''火''爆发' 或 content_type 含'热点'
// 知乎/雪球：热点+行业洞察 → 4.5，教程/案例 → 4.0
// 新闻类平台：热点 → 4.5，资讯/快讯 → 4.0
// 短视频平台：新兴/热点 → 4.5
// 公众号：行业洞察/案例 → 4.0，教程 → 3.5
```

### 5.6 calcDifferentiation

```javascript
// 差异化关键词：'对比' '评测' '揭秘' 'vs' '反常识'
// 知乎：差异化 → 4.5，通用 → 2.5
// 短视频平台：差异化 → 4.5，通用 → 2.5
// 公众号：差异化+案例/洞察 → 4.5
```

### 5.7 calcPlatformFit（content_forms × platform.type）

```javascript
// 图文/长文/深度文章 → 知乎4.5，公众号4.5，百家号4.0，头条3.5
// 短视频/视频 → 艾氪短视频5.0，视频号4.5
// 社交短帖 → 知乎4.5，雪球4.5
```

### 5.8 calcRisk

```javascript
// 高风险：标题含负面词、平台已有大量类似选题
// 低风险：证据充分、有差异化角度、商业价值明确
// 返回 1-3 分（越低风险越高）
```

### 5.9 12平台定义

```javascript
const PLATFORMS = [
  { id: 'aike短视频',  name: '艾氪智能OS（短视频）', type: '短视频' },
  { id: 'wechat_gzh',  name: '微信公众号',            type: '图文' },
  { id: 'jova_video',  name: 'JovaAI视频号',          type: '短视频' },
  { id: 'zhihu',       name: '知乎',                   type: '图文' },
  { id: 'toutiao',     name: '今日头条',               type: '图文' },
  { id: 'baijiahao',   name: '百家号',                 type: '图文' },
  { id: 'xueqiu',     name: '雪球',                   type: '图文' },
  { id: 'netease',     name: '网易新闻',               type: '新闻' },
  { id: 'sohu',       name: '搜狐号',                 type: '新闻' },
  { id: 'tencent',    name: '腾讯新闻',               type: '新闻' },
  { id: 'sina',       name: '新浪新闻',               type: '新闻' },
  { id: 'ifeng',      name: '凤凰新闻',               type: '新闻' }
];
```

---

## 六、Skill 10 DistributionRouter（skills/distribution-router.js）

### 6.1 三账号定义

```javascript
const THREE_ACCOUNTS = {
  awareness:   { id: 'aike短视频',  name: '艾氪智能OS（短视频）',   forms: ['短视频'] },
  trust:       { id: 'wechat_gzh',  name: '微信公众号',            forms: ['图文', '深度文章'] },
  conversion:   { id: 'jova_video',  name: 'JovaAI视频号',          forms: ['短视频', '视频'] }
};
```

### 6.2 优先级计算（方向内相对排名）

```javascript
// 每方向按 platform_scores.total_score 降序排列
// 第 1 名 → P0
// 第 2-3 名 → P1
// 其余 → P2
const calcPriority = (rank) =>
  rank <= 1 ? 'P0' :
  rank <= 3 ? 'P1' : 'P2';
```

### 6.3 两阶段分发

**阶段① 三账号路由**（按 rank）

```javascript
for (const [role, account] of Object.entries(THREE_ACCOUNTS)) {
  const fit = ranked.find(r => r.platform_id === account.id);
  if (!fit) continue;
  const allowed = checkDistributionRules(ranked, role, rules, routes);
  if (!allowed) continue;
  routes.push({
    topic_id, direction_id,
    target_platform: account.id,
    target_account: account.name,
    account_role: role,
    content_form: pickContentForm(ds, account),
    score: fit.score,
    priority: calcPriority(rank),
    repurposing_chain: buildRepurposingChain(ds, role)
  });
}
```

**阶段② 图文/新闻平台路由**（不设日更上限）

```javascript
for (const platform of PLATFORMS) {
  if (['aike短视频', 'wechat_gzh', 'jova_video'].includes(pid)) continue; // 跳过三账号
  const fit = ranked.find(r => r.platform_id === pid);
  if (!fit) continue;
  // content_forms × platform.type 匹配过滤
  const is图文 = platform.type === '图文';
  const is视频 = platform.type === '短视频' || platform.type === '视频';
  if (is图文 && !directionForms.some(f => ['图文', '长文', '深度文章'].includes(f))) continue;
  if (is视频 && !directionForms.some(f => ['短视频', '视频'].includes(f))) continue;
  routes.push({ ... priority: calcPriority(rank) });
}
```

### 6.4 Repurposing 链（仅三账号路由）

```javascript
function buildRepurposingChain(direction, sourceRole) {
  // trust 高反馈 → 改编为 awareness（公众号深化后发短视频）
  // awareness 高反馈 → 改编为 conversion（短视频导流）
  // awareness 高反馈 → 改编为 trust（短视频验证后公众号深化）
}
```

### 6.5 DistributionMap 格式

```javascript
interface DistributionMap {
  routes: [{
    topic_id: string
    direction_id: string
    target_platform: string    // 平台 ID
    target_account: string      // 平台名称
    account_role: string | null  // 'awareness' | 'trust' | 'conversion' | null
    content_form: string        // '图文' | '短视频' | '深度文章' | ...
    score: number
    priority: 'P0' | 'P1' | 'P2'
    repurposing_chain: RepurposingStep[] | null
    recommendation: string
  }]
  summary: {
    total_routes: number
    by_priority: { P0: number, P1: number, P2: number }
    by_platform: { [platform_id]: number }
  }
}
```

---

## 七、Skill 7 ContentCalendar（skills/content-calendar.js）

### 7.1 入口函数

```javascript
function buildContentCalendar(
  distributionMap: DistributionMap,
  horizonDays: number = 7,
  rules: DistributionRules = getDefaultRules()
): EditorialCalendar
```

### 7.2 日历容量规则

```javascript
// 每平台每天最多 1 条（来自任意来源）
// P0 先排（占领黄金时段 09:00 / 14:00 / 15:00）
// P1 次之（10:00 / 11:00）
// P2 最后（16:00 / 18:00 等次要时段）
```

### 7.3 EditorialCalendar 格式

```javascript
interface EditorialCalendar {
  calendar: {
    [date: string]: {          // '2026-06-17'
      weekday: string            // '周二'
      slots: [{
        time: string           // '09:00'
        topic_id: string
        topic_title: string
        direction_id: string
        platform_id: string
        platform_name: string
        priority: 'P0' | 'P1' | 'P2'
      }]
    }
  }
  summary: {
    total_slots: number
    priority_breakdown: { P0: number, P1: number, P2: number }
    platform_breakdown: { [platform_id]: number }
  }
}
```

---

## 八、Skill 8 ResourceCollector（skills/resource-collector.js）

### 8.1 入口函数

```javascript
async function collectResources(topic, direction): Promise<{
  sources: Source[]
  evidence: EvidenceMap
  knowledge_base: string
}>
```

### 8.2 采集来源

| 来源 | 工具 | 格式 |
|------|------|------|
| YouTube | youtubei.js | 视频元数据 |
| arXiv | arXiv API | 论文摘要 |
| 网页 | fetch + @mozilla/readability | 正文提取 |

---

## 九、Skill 9 TopicBriefBuilder（skills/topic-brief-builder.js）

### 9.1 入口函数

```javascript
function buildTopicBrief(opts: {
  topic: Topic,
  direction: Direction,
  resources: Resources,
  narrativeConstraint: Narrative,
  distributionRoute: Route,
  topicScores: TopicScoreResult  // 含 search_intent
}): TrendBrief
```

### 9.2 TrendBrief 格式（PRD 要求命名）

```javascript
interface TrendBrief {
  brief_id: string            // 'TB-TOPIC-001-D1'
  brief_type: 'Trend Brief'     // PRD 规范命名
  meta: {
    topic_id: string
    direction_id: string
    topic_title: string
    direction_title: string
    content_form: string
    target_platform: string       // 平台 ID
    target_account: string       // 账号名称
    narrative_constraint_source: string
    created_at: string
    search_intent: {            // 来自 Skill 6 calcSearchOpportunity
      intent_type: string       // '信息型' | '商业型' | ...
      intent_strength: number   // 3.0-5.0
      score: number             // 最终评分
    }
  }
  core_claims: [{
    statement: string
    evidence_level: 'strong' | 'moderate' | 'weak'
    source: string
  }]
  evidence_sufficiency: {
    score: number              // 1-5
    level: 'sufficient' | 'adequate' | 'insufficient'
    gaps: string[]
    message: string
  }
  content_outline: string       // 三段式结构
  recommended_hooks: string[]
  risks_and_mitigations: string[]
  markdown: string             // 可导出 Markdown
}
```

---

## 十、Feedback 路由（Agent4 ↔ Agent5）

### 10.1 接口

```javascript
// Agent5 入口参数
runAgent5({ feedbackSignals: FeedbackSignal[] })

// 内置 Mock（演示用）
function getMockFeedbackSignals() {
  return [
    { topic_keyword: 'Claude Code', engagement_score: 4.5, content_type: '行业洞察' },
    { topic_keyword: 'Agent落地', engagement_score: 4.0, content_type: '企业案例' },
    { topic_keyword: 'OpenAI', engagement_score: 3.5, content_type: '行业洞察' }
  ];
}
```

### 10.2 Agent4 vs Agent5 反馈目标区分

| 维度 | Agent4 收到反馈 | Agent5 收到反馈 |
|------|----------------|-----------------|
| 目标 | 调整大框架策略 | 调整选题优先级 |
| 频率 | 大幅波动才调整 | 每次都参考 |
| 动作 | 修改 Narrative | 修改 Boost 分 |

---

## 十一、配置项（用户随时可改）

### 11.1 distribution_rules.yml（Skill 10）

```yaml
strategy: balanced
max_per_platform_per_day: 3
platform_weights:
  aike短视频: { weight: 1.2, max_daily: 1 }
  wechat_gzh: { weight: 1.2, max_daily: 1 }
  jova_video: { weight: 1.1, max_daily: 1 }
  zhihu: { weight: 1.0, max_daily: 3 }
  toutiao: { weight: 1.0, max_daily: 3 }
```

### 11.2 Narrative（Agent4 输出，Agent5 读入）

```javascript
const DEFAULT_NARRATIVE = {
  main_axis: 'Jova AI：让企业 AI 落地不再困难',
  account_roles: {
    'A': '艾氪智能OS（短视频）': 'awareness',
    'B': '公众号': 'trust',
    'C': 'JovaAI视频号': 'conversion'
  },
  content_ratio: { competitor: 0.22, methodology: 0.27, case_study: 0.27, trend: 0.17 },
  forbidden_directions: ['硬广', '绝对化表述', '无证据声明', '竞品贬低'],
  target_role: '企业老板'
};
```

---

## 十二、PRD Section 13 合规检查

| 需求 | 状态 | 实现位置 |
|------|------|---------|
| Trend Brief | ✅ | Skill 9 brief_type:'Trend Brief' |
| Search Intent Map | ✅ | Skill 6 calcSearchOpportunity |
| Content Direction | ✅ | Skill 5 generateDirections |
| Topic Pool | ✅ | Skill 5 generateTopicCluster |
| Topic Score（10维）| ✅ | Skill 6 scoreTopics |
| Platform Recommendation | ✅ | Skill 6 best_platform |
| Editorial Calendar | ✅ | Skill 7 buildContentCalendar |
| 趋势监测Skill | ✅ | collect-signals.js |
| 搜索意图Skill | ✅ | Skill 6 calcSearchOpportunity |
| 主题聚类Skill | ✅ | Skill 5 generateTopicCluster |
| 平台适配评分Skill | ✅ | Skill 6 calcPlatformFit |
| 内容日历Skill | ✅ | Skill 7 buildContentCalendar |
| 三账号分发 | ✅ | Skill 10 THREE_ACCOUNTS |
| 反馈驱动优化 | ✅ | feedbackSignals 参数 |

---

## 十三、文件索引

| 文件 | 作用 |
|------|------|
| agent5-core.js | Pipeline 主入口 |
| skills/topic-cluster.js | Skill 5：选题聚类 |
| skills/platform-scorer.js | Skill 6：10维评分+SearchIntentMap |
| skills/distribution-router.js | Skill 10：分发路由+Repurposing |
| skills/content-calendar.js | Skill 7：发布日历 |
| skills/resource-collector.js | Skill 8：素材采集 |
| skills/topic-brief-builder.js | Skill 9：TrendBrief |
| skills/collect-signals.js | 信号并发采集（aihot/follow-builders/tech-news） |
| agent5-report.py | 彩色 Terminal Dashboard |
| mock-data/agent5-complete-output.json | 完整 Pipeline 输出 |
| output/trend-brief-*.md | TrendBrief 可读版本 |
| document/AGENT5_TECHNICAL_SPEC_V2.md | 本文档 |

---

## 十四、运行命令

```bash
# 完整 pipeline（信号采集 → 所有输出）
cd /workspace/risen-agent5 && node agent5-core.js

# 彩色 Terminal 报告（需支持 UTF-8 的终端）
cd /workspace/risen-agent5 && python3 agent5-report.py

# 仅采集信号
cd /workspace/risen-agent5 && node skills/collect-signals.js

# 查看完整 JSON
cat /workspace/risen-agent5/mock-data/agent5-complete-output.json | python3 -m json.tool | less
```
