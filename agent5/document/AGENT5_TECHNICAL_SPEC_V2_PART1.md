# Agent 5 · 趋势与选题智能体 技术规格文档 V2.0

## 一、系统概述

### 1.1 在 RISEN OS 中的定位

```
Agent4 → Narrative（大策略约束）
     ↓
Agent5 → TopicPool + TrendBrief + EditorialCalendar
     ↓
Agent6 → 实际内容产出
```

### 1.2 输入与输出

| 输入 | 来源 | 必需 |
|------|------|------|
| Narrative 约束 | Agent4 | 是 |
| 信号数据（三技能并发采集） | aihot + follow-builders + tech-news | 是 |
| Feedback 数据 | Agent4 或 Mock | 否 |
| 分发规则 | distribution_rules.yml | 否（有默认值） |

| 输出 | 位置 | 给谁 |
|------|------|------|
| TopicPool | JSON（内嵌） | Agent6 |
| TrendBrief（含SearchIntent） | JSON（内嵌） | Agent6 |
| DistributionMap | JSON（内嵌） | Agent6 |
| EditorialCalendar | JSON（内嵌） | Agent6 |
| 完整Pipeline输出 | mock-data/agent5-complete-output.json | 调试/用户 |

### 1.3 运行命令

```bash
cd /workspace/risen-agent5
node agent5-core.js        # 完整pipeline
python3 agent5-report.py   # Terminal彩色报告
```

---

## 二、Pipeline Step 1-9

```
Step1  collectSignalsFromAllSkills()  → RawSignal[]（三技能并发）
Step2  generateTopicCluster()     → TopicPool（聚类+方向+FeedbackBoost）
Step3  scoreTopics()              → TopicScore[]（10维评分+SearchIntentMap）
Step4  routeDistribution()        → DistributionMap（12平台全路由）
Step5  buildContentCalendar()    → EditorialCalendar（7天×12平台）
Step6  collectResources()         → Resources（YouTube/arXiv/网页）
Step7  buildTopicBrief()         → TrendBrief（含SearchIntent）
Step8  保存JSON输出
Step9  保存Markdown报告
```

---

## 三、信号采集层（skills/collect-signals.js）

### 3.1 三个技能

| 技能 | 来源 | 数量 | Token |
|------|------|------|------|
| aihot | aihot.virxact.com REST API | 50条 | 否 |
| follow-builders | Anthropic/OpenAI/DeepMind/Google AI/Meta AI/Microsoft AI/Stability AI RSS | 各10条 | 否 |
| tech-news | HN/VentureBeat/MIT/TechCrunch/The Verge/Wired RSS | 各10条 | 否 |

### 3.2 RawSignal 格式

```javascript
interface RawSignal {
  id: string            // 'SIG-{SOURCE}-{hash}'
  type: string        // 'aihot' | 'follow-builders' | 'tech-news'
  title: string
  summary: string
  url: string | null
  published_at: string | null  // ISO 时间戳
  collected_at: string
  tags: string[]
  weight: number      // 0.8-1.5（归一化）
  content_type: string // '行业洞察'|'产品发布'|'论文研究'|'利他（教程）'|'企业案例'
  metadata: object      // 原始数据
}
```

### 3.3 采集函数签名

```javascript
async function collectSignalsFromAllSkills(): Promise<RawSignal[]>
async function collectAihot(limit?: number): Promise<RawSignal[]>
async function collectFollowBuilders(): Promise<RawSignal[]>
async function collectTechNews(): Promise<RawSignal[]>
function fetch(url: string, timeoutMs?: number): Promise<{ok, status?, body?, error?}>
function parseRSS(xml: string): Array<{title, link, desc, pub}>
function shortHash(s: string): string
function nowISO(): string
```

### 3.4 去重

按 `title.slice(0, 40).toLowerCase()` 去重，保留第一条。

---

## 四、Skill 5 TopicCluster（skills/topic-cluster.js）

### 4.1 入口函数

```javascript
function generateTopicCluster(opts: {
  signals: RawSignal[]
  narrativeConstraint: Narrative
  directionCount: number     // 默认5
  feedbackSignals: FeedbackSignal[]  // Agent4回传
}): TopicPool
```

### 4.2 FeedbackSignal 格式

```javascript
interface FeedbackSignal {
  topic_keyword: string   // 关键词如 'Claude Code'
  engagement_score: number // 0-5，5=极高反馈
  content_type: string    // '行业洞察'|'企业案例'|...
}
```

### 4.3 Boost 逻辑

```javascript
function buildTopicBoostMap(feedbackSignals): Map<string, number>
// boost = Math.min(0.8, engagement_score * 0.15)
// 取同类关键词最大boost，不叠加
```

### 4.4 Topic 格式

```javascript
interface Topic {
  topic_id: string
  title: string
  source_signals: string[]
  source_type: string
  content_type: string
  core_viewpoint: string
  narrative_fit: boolean    // 含禁用词检测
  feedback_boost: number   // 0表示无boost
  directions: Direction[]
  total_score: number    // 含Boost
  created_at: string
}

interface Direction {
  direction_id: string
  angle_type: string       // '老板视角'|'对比分析'|...
  core_claim: string
  content_forms: string[]  // ['图文','深度文章'] ← 关键！决定分发
  target_audiences: string[]
  required_evidence: string[]
  hooks: string[]
  risks: string[]
  priority: 'high'|'medium'|'low'
}
```

---

## 五、Skill 6 PlatformScorer（skills/platform-scorer.js）

### 5.1 10维 PlatformScore

```javascript
interface PlatformScore {
  total_score: number
  breakdown: {
    strategy_fit: number         // Narrative匹配度
    jtbds_strength: number      // 客户需求强度
    search_opportunity: number   // 含Intent Map
    social_heat: number
    differentiation: number
    evidence_quality: number
    platform_fit: number         // content_forms×platform.type
    biz_value: number
    risk: number
    production_cost: number
  }
  recommendation: string
}
```

### 5.2 Search Intent Map（PRD要求）

四类意图检测关键词：

| 意图 | 关键词 | 知乎 | 公众号 | 头条 |
|------|---------|------|--------|------|
| 信息型 | 是什么/为什么/教程 | 4.5 | 3.7 | 3.8 |
| 商业型 | 多少钱/vs/推荐 | 3.7 | 4.5 | 3.8 |
| 交易型 | 注册/试用/下载 | 2.5 | 4.3 | 2.5 |
| 导航型 | Jova/Coze/官网 | 2.5 | 3.0 | 2.5 |

### 5.3 calcSocialHeat（内容类型×平台）

```javascript
// 高热度信号：标题含'热''火''爆发' 或 content_type 含'热点''资讯'
// 知乎/雪球：热点+行业洞察→4.5，教程/案例→4.0
// 新闻类平台：热点→4.5，资讯→4.0
// 短视频：新兴/热点→4.5
// 公众号：行业洞察/案例→4.0
```

### 5.4 calcDifferentiation

```javascript
// 差异化关键词：'对比''评测''揭秘''vs''反常识'
// 知乎：差异化→4.5，通用→2.5
// 短视频：差异化→4.5，通用→2.5
// 公众号：差异化+案例/洞察→4.5
```

### 5.5 calcPlatformFit（content_forms×platform.type）

```javascript
// 图文/长文/深度文章 → 知乎4.5，公众号4.5，百家号4.0，头条3.5
// 短视频/视频 → 艾氪短视频5.0，视频号4.5
// 社交短帖 → 知乎4.5，雪球4.5
```

### 5.6 calcRisk

```javascript
// 高风险：标题含负面词、平台已有大量类似选题
// 低风险：证据充分、有差异化角度、商业价值明确
// 返回 1-3 分（越低越安全）
```

### 5.7 12平台定义

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
  awareness:  { id: 'aike短视频', name: '艾氪智能OS（短视频）', forms: ['短视频'] },
  trust:    { id: 'wechat_gzh', name: '微信公众号', forms: ['图文','深度文章'] },
  conversion:{ id: 'jova_video', name: 'JovaAI视频号', forms: ['短视频','视频'] }
};
```

### 6.2 优先级（方向内相对排名）

```javascript
const calcPriority = (rank) =>
  rank <= 1 ? 'P0' :
  rank <= 3 ? 'P1' : 'P2';
```

### 6.3 两阶段分发

**阶段①三账号**：按 rank 路由，checkDistributionRules 过滤。

**阶段②图文/新闻平台**：不设日更上限，content_forms×platform.type 匹配过滤。

### 6.4 Repurposing链（仅三账号）

```javascript
function buildRepurposingChain(direction, sourceRole): RepurposingStep[]
// trust反馈高 → 改编为 awareness
// awareness反馈高 → 改编为 conversion 或 trust
```

### 6.5 DistributionMap格式

```javascript
interface DistributionMap {
  routes: [{
    topic_id, direction_id, target_platform, target_account,
    account_role: 'awareness'|'trust'|'conversion'|null,
    content_form, score, priority: 'P0'|'P1'|'P2',
    repurposing_chain: RepurposingStep[]|null,
    recommendation
  }]
}
```

---

## 七、Skill 7 ContentCalendar（skills/content-calendar.js）

### 7.1 入口

```javascript
function buildContentCalendar(distributionMap, horizonDays = 7, rules?)
```

### 7.2 时段分配

| 时段 | 时间 | 优先级 |
|------|------|---------|
| 上午 | 09:00-11:00 | P0 优先 |
| 下午 | 14:00-16:00 | P0/P1 |
| 傍晚 | 16:00-18:00 | P1/P2 |

### 7.3 EditorialCalendar格式

```javascript
interface EditorialCalendar {
  calendar: {
    [date]: {
      weekday: string
      slots: [{ time, topic_id, direction_id, platform_id, platform_name, priority }]
    }
  }
  summary: { total_slots, priority_breakdown, platform_breakdown }
}
```

---

## 八、Skill 9 TrendBrief（skills/topic-brief-builder.js）

### 8.1 入口

```javascript
function buildTopicBrief({
  topic, direction, resources,
  narrativeConstraint, distributionRoute,
  topicScores  // 含 search_intent
}): TrendBrief
```

### 8.2 TrendBrief格式（PRD规范命名）

```javascript
interface TrendBrief {
  brief_id: string
  brief_type: 'Trend Brief'  // PRD规范
  meta: {
    topic_id, direction_id, topic_title, direction_title,
    content_form, target_platform, target_account,
    narrative_constraint_source, created_at,
    search_intent: { intent_type, intent_strength, score }
  }
  core_claims: [{ statement, evidence_level, source }]
  evidence_sufficiency: { score, level, gaps, message }
  content_outline, recommended_hooks, risks_and_mitigations
  markdown: string
}
```

---

## 九、Feedback路由（Agent4 ↔ Agent5）

Agent4 调大框架策略；Agent5 调选题权重。两者目标不同。

```javascript
// Agent5入口参数
runAgent5({ feedbackSignals: FeedbackSignal[] })
```

内置Mock反馈信号：
```javascript
[
  { topic_keyword: 'Claude Code', engagement_score: 4.5, content_type: '行业洞察' },
  { topic_keyword: 'Agent落地', engagement_score: 4.0, content_type: '企业案例' }
]
```

---

## 十、PRD Section 13合规

| 需求 | 状态 |
|------|------|
| Trend Brief 命名 | ✅ brief_type:'Trend Brief' |
| Search Intent Map | ✅ calcSearchOpportunity |
| Content Direction | ✅ generateDirections |
| Topic Pool | ✅ generateTopicCluster |
| Topic Score（10维）| ✅ scoreTopics |
| Platform Recommendation | ✅ best_platform |
| Editorial Calendar | ✅ buildContentCalendar |
| 三账号分发 | ✅ THREE_ACCOUNTS |
| Feedback驱动 | ✅ feedbackSignals参数 |
| 12平台 | ✅ PLATFORMS |

---

## 十一、文件索引

| 文件 | 作用 |
|------|------|
| agent5-core.js | Pipeline主入口 |
| skills/topic-cluster.js | Skill5 聚类 |
| skills/platform-scorer.js | Skill6 评分 |
| skills/distribution-router.js | Skill10 分发 |
| skills/content-calendar.js | Skill7 日历 |
| skills/resource-collector.js | Skill8 素材 |
| skills/topic-brief-builder.js | Skill9 TrendBrief |
| skills/collect-signals.js | 三技能信号采集 |
| mock-data/agent5-complete-output.json | 完整输出 |
| agent5-report.py | Terminal彩色报告 |
| document/AGENT5_TECHNICAL_SPEC_V2_PART2.md | 技术规格续 |
