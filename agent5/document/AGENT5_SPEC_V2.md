# Agent 5 · 趋势与选题智能体
## 技术规格文档 V2.1

> 本文档是 Agent 5 的唯一权威技术规格。
> 无需查阅其他文档，按本文档可直接实施完整系统。
>
> **更新说明 (V2.1):**
> - 补充 `lib/signal-health.js` 信号源健康检查机制
> - 补充 `collect-signals.py` Python 采集脚本
> - 明确 `collectAihotSignals` 导出接口（resource-collector.js）
> - 补充 Repurposing Chain 完整规则
> - 补充 `buildRepurposingChain` 函数说明
> - 补充 Step 8/9 分模块输出路径
> - 更新文件索引

---

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
| 信号数据（三技能并发采集） | aihot + follow-builders + tech-news-digest | 是 |
| Feedback 数据 | Agent4 或内置 Mock | 否 |
| 分发规则 | distribution_rules.yml | 否（有默认值） |

| 输出 | 位置 | 说明 |
|------|------|------|
| 原始信号 | output/signals.json | Step1 RawSignal[] |
| TopicPool | output/topic-pool.json | Step2 聚类结果 |
| TopicScore[] | output/topic-scores.json | Step3 评分结果 |
| DistributionMap | output/distribution-map.json | Step4 路由结果 |
| EditorialCalendar | output/editorial-calendar.json | Step5 日历 |
| Resources | output/resources.json | Step6 资源 |
| TrendBrief[] | output/trend-briefs/BRIEF-{id}.json | Step7 每方向一个文件 |
| 汇总索引 | mock-data/agent5-complete-output.json | 兼容索引（含stats）|

### 1.3 运行命令

```bash
cd /workspace/RISEN-OS/agent5
node agent5-core.js        # 完整 pipeline
python3 agent5-report.py   # Terminal 彩色报告
```

---

## 二、Pipeline Step 1-9

```
Step1  collectSignalsFromAllSkills()   → RawSignal[]
Step2  generateTopicCluster()         → TopicPool（聚类+方向+FeedbackBoost）
Step3  scoreTopics()                  → TopicScore[]（10维+SearchIntent）
Step4  routeDistribution()            → DistributionMap（12平台全路由）
Step5  buildContentCalendar()         → EditorialCalendar（7天×12平台）
Step6  collectResources()             → Resources（YouTube/arXiv/网页）
Step7  buildTopicBrief()              → TrendBrief（含 SearchIntent）
Step8  保存 output/*.json（分模块）
Step9  保存 output/index.json + mock-data/agent5-complete-output.json（兼容层）
```

---

## 三、信号采集层

### 3.1 采集入口

```javascript
// JS 采集器（Node.js，并发 + 健康检查）
node skills/collect-signals.js

// Python 采集器（独立脚本，Python 3）
python3 skills/collect-signals.py
```

### 3.2 三个采集技能

| 技能 | 来源 | Token |
|------|------|-------|
| aihot | aihot.virxact.com REST API（JSON） | 否 |
| follow-builders | Anthropic/OpenAI/DeepMind/Google AI/Meta AI/Microsoft AI/Stability AI RSS | 否 |
| tech-news-digest | HN/VentureBeat/MIT/TechCrunch/The Verge/Wired RSS | 否 |

### 3.3 信号源健康检查（lib/signal-health.js）

**Fallback 链：aihot → follow-builders → tech-news → throw**

| 状态 | 条件 | 使用的信号源 |
|------|------|------------|
| healthy | 连续失败 < 2 | aihot |
| degraded | 连续失败 ≥ 2 | follow-builders |
| down | 所有源失败 | throw |

```javascript
// 用法
const { getSource, recordAihotFailure, recordAihotSuccess } = require('./lib/signal-health');

// 采集前判断
const source = getSource(); // 'aihot' | 'follow-builders' | 'tech-news' | 'down'

// 采集后记录
recordAihotFailure('HTTP_500');  // 失败时调用
recordAihotSuccess();            // 成功时调用
```

**连续失败计数规则：**
- 连续失败 ≥ 2 次 → 降级到 follow-builders
- follow-builders 也失败 → 降级到 tech-news
- tech-news 失败 → 系统 down

**成功重置：** aihot 成功后重置连续失败计数，恢复 healthy

### 3.4 RawSignal 格式

```javascript
interface RawSignal {
  id: string           // 'SIG-{SOURCE}-{hash}'
  type: string         // 'aihot' | 'follow-builders' | 'tech-news'
  title: string
  summary: string
  url: string | null
  published_at: string | null  // ISO 时间戳
  collected_at: string
  tags: string[]
  weight: number       // 0.8-1.5（归一化）
  content_type: string // '行业洞察'|'产品发布'|'论文研究'|'利他（教程）'|'企业案例'
  metadata: object     // 原始数据
}
```

### 3.5 采集函数签名

```javascript
// JS
async function collectAihot(limit?: number): Promise<RawSignal[]>
async function collectFollowBuilders(): Promise<RawSignal[]>
async function collectTechNews(): Promise<RawSignal[]>
async function collectSignalsFromAllSkills(): Promise<RawSignal[]>

// Python（独立脚本）
python3 skills/collect-signals.py  # 输出 JSON 到 stdout
```

去重：`title.slice(0, 40).toLowerCase()` 查重

---

## 四、Skill 5 TopicCluster（skills/topic-cluster.js）

### 4.1 入口

```javascript
function generateTopicCluster({
  signals: RawSignal[]
  narrativeConstraint: Narrative
  directionCount: number       // 默认5
  feedbackSignals: FeedbackSignal[]  // Agent4回传
}): TopicPool
```

### 4.2 FeedbackSignal 格式

```javascript
interface FeedbackSignal {
  topic_keyword: string     // 关键词，如 'Claude Code'
  engagement_score: number   // 0-5，5=极高反馈
  content_type: string
}
```

### 4.3 Boost 逻辑

```javascript
// boost = Math.min(0.8, engagement_score * 0.15)
// 取同类关键词最大boost，不叠加
// 应用到 cluster.title（聚类标题），非个别信号
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
  narrative_fit: boolean  // 含禁用词检测
  feedback_boost: number    // 0表示无Boost
  directions: Direction[]
  total_score: number       // 含Boost
}

interface Direction {
  direction_id: string
  angle_type: string        // '老板视角'|'对比分析'|...
  core_claim: string
  content_forms: string[]     // ['图文', '深度文章'] ← 关键！决定分发平台
  target_audiences: string[]
  required_evidence: string[]
  hooks: string[]
  risks: string[]
  priority: 'high'|'medium'|'low'
}
```

---

## 五、Skill 6 PlatformScorer（skills/platform-scorer.js）

### 5.1 入口

```javascript
function scoreTopics(topicPool: TopicPool, narrativeConstraint: Narrative): TopicScoreResult
```

### 5.2 10维 PlatformScore

| 维度 | ID | 权重 |
|------|-----|------|
| 策略匹配度 | strategy_fit | 0.20 |
| 客户需求强度 | jtbd_strength | 0.15 |
| 搜索机会 | search_opportunity | 0.10 |
| 社交热度 | social_heat | 0.10 |
| 差异化 | differentiation | 0.10 |
| 证据充足度 | evidence_quality | 0.10 |
| 平台适配度 | platform_fit | 0.10 |
| 商业价值 | biz_value | 0.05 |
| 风险 | risk | 0.05 |
| 生产成本 | prod_cost | 0.05 |

### 5.3 Search Intent Map（四类意图）

| 意图 | 检测关键词 | 知乎 | 公众号 | 头条 |
|------|-----------|------|--------|------|
| 信息型 | 是什么/为什么/教程 | 4.5 | 3.7 | 3.8 |
| 商业型 | 多少钱/vs/推荐 | 3.7 | 4.5 | 3.8 |
| 交易型 | 注册/试用/下载 | 2.5 | 4.3 | 2.5 |
| 导航型 | Jova/Coze/官网 | 2.5 | 3.0 | 2.5 |

### 5.4 12平台定义

```javascript
const PLATFORMS = [
  { id: 'aike短视频',  name: '艾氪智能OS（短视频）', type: '短视频', daily_limit: 1 },
  { id: 'wechat_gzh',  name: '微信公众号',            type: '图文',   daily_limit: 1 },
  { id: 'jova_video',  name: 'JovaAI视频号',          type: '视频',   daily_limit: 1 },
  { id: 'zhihu',       name: '知乎',                   type: '图文',   daily_limit: 2 },
  { id: 'toutiao',     name: '今日头条',               type: '图文',   daily_limit: 1 },
  { id: 'baijiahao',   name: '百家号',                 type: '图文',   daily_limit: 1 },
  { id: 'xueqiu',     name: '雪球',                   type: '分析',   daily_limit: 1 },
  { id: 'netease',     name: '网易新闻',               type: '新闻',   daily_limit: 1 },
  { id: 'sohu',       name: '搜狐号',                 type: '新闻',   daily_limit: 1 },
  { id: 'tencent',    name: '腾讯新闻',               type: '新闻',   daily_limit: 1 },
  { id: 'sina',       name: '新浪新闻',               type: '新闻',   daily_limit: 1 },
  { id: 'ifeng',      name: '凤凰新闻',               type: '新闻',   daily_limit: 1 }
];
```

---

## 六、Skill 10 DistributionRouter（skills/distribution-router.js）

### 6.1 三账号定义

```javascript
const THREE_ACCOUNTS = {
  awareness: {
    id: 'aike短视频', name: '艾氪智能OS',
    role: 'awareness', forms: ['短视频'],
    constraint: { max_daily: 1, product_exposure_ratio: '<10%', focus: '行业解释权，轻产品露出' }
  },
  trust: {
    id: 'wechat_gzh', name: '公众号',
    role: 'trust', forms: ['图文', '长文'],
    constraint: { max_daily: 1, max_weekly: 3, focus: '深度完整叙事，可复用资产' }
  },
  conversion: {
    id: 'jova_video', name: 'JovaAI视频号',
    role: 'conversion', forms: ['视频'],
    constraint: { max_daily: 1, max_weekly: 3, focus: '产品化叙事，真实场景+量化结果+明确CTA' }
  }
};
```

### 6.2 Repurposing Chain 规则

```javascript
const REPURPOSING_RULES = {
  trigger_threshold: {
    engagement_rate: 0.05,  // 5%互动率触发深化
    views: 5000,
    positive_signals: 3
  },
  repurposing_chain: [
    { from: '图文平台高反馈', to: '公众号深化',     action: 'deepen_to_gzh' },
    { from: '公众号深化',     to: '多角度图文平台', action: 'multi_angle_repost' },
    { from: '公众号深化',     to: '短视频',         action: 'extract_short_video_angle' }
  ]
};
```

**Repurposing 链（仅三账号）：**
- trust 高反馈 → 改编为 awareness
- awareness 高反馈 → 改编为 conversion 或 trust

### 6.3 优先级（方向内相对排名）

- 方向内排名第1 → **P0**
- 方向内排名第2-3 → **P1**
- 其余 → **P2**

### 6.4 两阶段分发

**阶段①三账号**：按 rank 路由，`checkDistributionRules` 过滤

**阶段②图文/新闻平台**：按 `content_forms × platform.type` 匹配，不过滤不设上限

### 6.5 导出接口

```javascript
module.exports = {
  routeDistribution,       // 主函数
  updateDistributionRules, // 动态更新分发规则
  getDefaultRules,         // 获取默认规则
  THREE_ACCOUNTS,
  REPURPOSING_RULES
};
```

---

## 七、Skill 7 ContentCalendar（skills/content-calendar.js）

### 7.1 入口

```javascript
function buildContentCalendar(distributionMap, horizonDays = 7, rules?)
function renderCalendarMarkdown(calendar)  // 渲染 Markdown 格式
```

### 7.2 时段分配

- 09:00-11:00：P0 优先
- 14:00-16:00：P0/P1
- 16:00-18:00：P1/P2

### 7.3 导出接口

```javascript
module.exports = {
  buildContentCalendar,
  renderCalendarMarkdown,
  generateDays,
  DEFAULT_DAILY_SLOTS
};
```

---

## 八、Skill 8 ResourceCollector（skills/resource-collector.js）

### 8.1 导出接口

```javascript
module.exports = {
  collectResources,      // 采集资源主函数
  collectAihotSignals    // 独立采集 aihot 信号（可被 agent5-core.js 单独调用）
};
```

### 8.2 采集来源

- YouTube 搜索
- arXiv 论文
- 网页内容

---

## 九、Skill 9 TrendBrief（skills/topic-brief-builder.js）

### 9.1 content_type 映射

`buildTopicBrief` 内部将 `content_form` 映射为 `content_type` enum（Phase 2.3 新增，兼容 Agent 6 skill-selector 路由）：

| content_type | 映射条件 |
|-------------|---------|
| tutorial | 含 短视频/视频/抖音/youtube/视频号 |
| marketing | 含 小红书/微博/朋友圈/推特/twitter |
| case_study | 含 案例/case/客户 |
| news | 含 新闻/pr/公告/快讯 |
| analysis | 默认（图文/深度文章） |

### 9.2 格式

```javascript
interface TrendBrief {
  brief_id: string
  brief_type: 'Trend Brief'
  meta: {
    topic_id, direction_id, topic_title, direction_title
    content_form, target_platform, target_account
    narrative_constraint_source, created_at
    search_intent: { intent_type, intent_strength, score }
  }
  core_claims: [{ statement, evidence_level, source }]
  evidence_sufficiency: { score, level, gaps, message }
  content_outline: string
  recommended_hooks: string[]
  risks_and_mitigations: string[]
  markdown: string
}
```

---

## 十、Feedback 路由

Agent4 调大框架策略（Narrative），Agent5 调选题优先级（Boost）。目标不同。

接口：`runAgent5({ feedbackSignals: FeedbackSignal[] })`，内置 Mock 数据。

---

## 十一、PRD Section 13 合规

| 项目 | 状态 |
|------|------|
| Trend Brief | ✅ |
| SearchIntentMap | ✅ |
| ContentDirection | ✅ |
| TopicPool | ✅ |
| TopicScore | ✅ |
| PlatformRecommendation | ✅ |
| EditorialCalendar | ✅ |
| 趋势监测 | ✅ |
| 搜索意图Skill | ✅ |
| 主题聚类 | ✅ |
| 平台适配评分 | ✅ |
| 内容日历Skill | ✅ |
| 三账号分发 | ✅ |
| Feedback驱动 | ✅ |

---

## 十二、文件索引

### 12.1 入口文件

| 文件 | 用途 |
|------|------|
| agent5-core.js | Pipeline 主入口（含分模块输出逻辑 V5） |
| agent5-report.py | Terminal 彩色报告（Python） |
| agent5-report.js | 备选彩色报告（Node.js） |

### 12.2 Skills

| Skill | 文件 | 功能 | 导出 |
|-------|------|------|------|
| 5 | skills/topic-cluster.js | 聚类 | `generateTopicCluster` |
| 6 | skills/platform-scorer.js | 评分 | `scoreTopics`, `PLATFORMS`, `DIMENSIONS` |
| 10 | skills/distribution-router.js | 分发 | `routeDistribution`, `updateDistributionRules`, `getDefaultRules`, `THREE_ACCOUNTS`, `REPURPOSING_RULES` |
| 7 | skills/content-calendar.js | 日历 | `buildContentCalendar`, `renderCalendarMarkdown` |
| 8 | skills/resource-collector.js | 资源 | `collectResources`, `collectAihotSignals` |
| 9 | skills/topic-brief-builder.js | TrendBrief | `buildTopicBrief` |
| — | skills/collect-signals.js | 信号采集（JS） | — |
| — | skills/collect-signals.py | 信号采集（Python） | — |

### 12.3 核心库

| 文件 | 用途 |
|------|------|
| lib/signal-health.js | 信号源健康检查（进程内单例，Fallback 链） |

### 12.4 Mock Data & Output

| 文件 | 用途 |
|------|------|
| mock-data/agent5-complete-output.json | 兼容索引（指针，V5改为引用 output/ 目录） |
| output/ | 分模块输出目录 |
| output/index.json | 汇总索引 |
| output/signals.json | 原始信号 |
| output/topic-pool.json | TopicPool |
| output/topic-scores.json | TopicScore[] |
| output/distribution-map.json | DistributionMap |
| output/editorial-calendar.json | EditorialCalendar |
| output/resources.json | Resources |
| output/trend-briefs/ | TrendBrief 文件目录 |
| source/ | 选题Agent源码（资源文档） |

### 12.5 目录结构

```
agent5/
├── agent5-core.js              # Pipeline 主入口
├── agent5-report.py            # Terminal 彩色报告（推荐）
├── agent5-report.js           # 备选彩色报告
├── lib/
│   └── signal-health.js       # 信号源健康检查
├── skills/
│   ├── topic-cluster.js       # Skill 5
│   ├── platform-scorer.js     # Skill 6
│   ├── distribution-router.js # Skill 10
│   ├── content-calendar.js    # Skill 7
│   ├── resource-collector.js  # Skill 8
│   ├── topic-brief-builder.js # Skill 9
│   ├── collect-signals.js     # 信号采集（JS）
│   └── collect-signals.py     # 信号采集（Python）
├── mock-data/
│   └── agent5-complete-output.json  # 兼容索引
├── output/                    # 分模块输出
│   ├── index.json
│   ├── signals.json
│   ├── topic-pool.json
│   ├── topic-scores.json
│   ├── distribution-map.json
│   ├── editorial-calendar.json
│   ├── resources.json
│   └── trend-briefs/
├── source/                    # 源码资源
├── document/
│   ├── AGENT5_SPEC_V2.md     # 本文档
│   └── AGENT5_TECHNICAL_SPEC_*.md
└── package.json
```

---

## 十三、版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| V2.0 | 2026-06-18 | 初始版本 |
| V2.1 | 2026-06-23 | 补充 signal-health.js 健康检查机制，补充 collect-signals.py，补充 collectAihotSignals 接口，补充 Repurposing Chain 规则，更新文件索引 |

---

*本文档与 /workspace/RISEN-OS/document/AGENT45-OPTIMIZATION-V5.md 配套使用。*
