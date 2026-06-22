# Agent 5 · 趋势与选题智能体
## 技术规格文档 V2.0（完整版）

> 本文档是 Agent 5 的唯一权威技术规格。
> 无需查阅其他文档，按本文档可直接实施完整系统。

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
| 原始信号 | output/signals.json | Step1 RawSignal[]，P-2修复（原内联丢失）|
| TopicPool | output/topic-pool.json | Step2 聚类结果 |
| TopicScore[] | output/topic-scores.json | Step3 评分结果 |
| DistributionMap | output/distribution-map.json | Step4 路由结果 |
| EditorialCalendar | output/editorial-calendar.json | Step5 日历 |
| Resources | output/resources.json | Step6 资源 |
| TrendBrief[] | output/trend-briefs/BRIEF-{id}.json | Step7 每方向一个文件 |
| 汇总索引 | mock-data/agent5-complete-output.json | 兼容索引（含stats）|
| 彩色报告 | agent5-report.py | Terminal 彩色报告 |

### 1.3 运行命令

```bash
cd /workspace/risen-agent5
node agent5-core.js        # 完整 pipeline
python3 agent5-report.py   # Terminal 彩色报告
```

---

## 二、Pipeline Step 1-9

```
Step1  collectSignalsFromAllSkills()   → RawSignal[]
Step2  generateTopicCluster()         → TopicPool（聚类+方向+FeedbackBoost）
Step3  scoreTopics()                  → TopicScore[]（10维+SearchIntent）
Step4  routeDistribution()                → DistributionMap（12平台全路由）
Step5  buildContentCalendar()            → EditorialCalendar（7天×12平台）
Step6  collectResources()               → Resources（YouTube/arXiv/网页）
Step7  buildTopicBrief()                → TrendBrief（含 SearchIntent）
Step8  保存 output/*.json（分模块）+ output/trend-briefs/*.json
Step9  保存 output/index.json（汇总索引）+ mock-data/agent5-complete-output.json（兼容层）
```

---

## 三、信号采集层（skills/collect-signals.js）

### 3.1 三个采集技能

| 技能 | 来源 | 数量 | Token |
|------|------|------|------|
| aihot | aihot.virxact.com REST API | 50条 | 否 |
| follow-builders | Anthropic/OpenAI/DeepMind/Google AI/Meta AI/Microsoft AI/Stability AI RSS | 各10条 | 否 |
| tech-news-digest | HN/VentureBeat/MIT/TechCrunch/The Verge/Wired RSS | 各10条 | 否 |

### 3.2 RawSignal 格式

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
  content_type: string   // '行业洞察'|'产品发布'|'论文研究'|'利他（教程）'|'企业案例'
  metadata: object       // 原始数据
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

```javascript
interface PlatformScore {
  total_score: number
  breakdown: {
    strategy_fit: number           // Narrative策略匹配度
    jtbds_strength: number        // 客户需求强度
    search_opportunity: number    // 含Intent Map
    social_heat: number          // 社交热度
    differentiation: number      // 差异化
    evidence_quality: number     // 证据充足度
    platform_fit: number         // content_forms × platform.type
    biz_value: number           // 商业价值
    risk: number               // 风险
    production_cost: number     // 生产成本
  }
  recommendation: string
}
```

### 5.3 Search Intent Map（四类意图）

| 意图 | 检测关键词 | 知乎 | 公众号 | 头条 |
|------|-----------|------|--------|------|
| 信息型 | 是什么/为什么/教程 | 4.5 | 3.7 | 3.8 |
| 商业型 | 多少钱/vs/推荐 | 3.7 | 4.5 | 3.8 |
| 交易型 | 注册/试用/下载 | 2.5 | 4.3 | 2.5 |
| 导航型 | Jova/Coze/官网 | 2.5 | 3.0 | 2.5 |

### 5.4 calcSocialHeat（内容类型×平台）

- 高热度：标题含'热''火''爆发'或content_type含'热点''资讯'
- 知乎/雪球：热点+行业洞察 → 4.5，教程/案例 → 4.0
- 新闻类平台：热点 → 4.5，资讯/快讯 → 4.0
- 短视频平台：新兴/热点 → 4.5
- 公众号：行业洞察/案例 → 4.0

### 5.5 calcDifferentiation

- 差异化关键词：'对比''评测''揭秘''vs''反常识'
- 知乎/短视频：差异化 → 4.5，通用 → 2.5
- 公众号：差异化+案例/洞察 → 4.5

### 5.6 calcPlatformFit（content_forms × platform.type）

- 图文/长文/深度文章 → 知乎4.5，公众号4.5，百家号4.0，头条3.5
- 短视频/视频 → 艾氪短视频5.0，视频号4.5
- 社交短帖 → 知乎4.5，雪球4.5

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
  awareness:  { id: 'aike短视频',  name: '艾氪智能OS（短视频）', forms: ['短视频'] },
  trust:      { id: 'wechat_gzh',  name: '微信公众号',             forms: ['图文', '深度文章'] },
  conversion:  { id: 'jova_video',  name: 'JovaAI视频号',           forms: ['短视频', '视频'] }
};
```

### 6.2 优先级（方向内相对排名）

- 方向内排名第1 → P0
- 方向内排名第2-3 → P1
- 其余 → P2

### 6.3 两阶段分发

**阶段①三账号**：按 rank 路由，checkDistributionRules 过滤

**阶段②图文/新闻平台**：按 content_forms × platform.type 匹配，不过滤不设上限

### 6.4 Repurposing 链（仅三账号）

- trust 高反馈 → 改编为 awareness
- awareness 高反馈 → 改编为 conversion 或 trust
- awareness 高反馈 → 改编为 trust

---

## 七、Skill 7 ContentCalendar（skills/content-calendar.js）

### 7.1 入口

```javascript
function buildContentCalendar(distributionMap, horizonDays = 7, rules?)
```

### 7.2 时段分配

- 09:00-11:00：P0 优先
- 14:00-16:00：P0/P1
- 16:00-18:00：P1/P2

---

## 八、Skill 9 TrendBrief（skills/topic-brief-builder.js）

### 8.1 格式

```javascript
interface TrendBrief {
  brief_id: string
  brief_type: 'Trend Brief'  // PRD 规范命名
  meta: {
    topic_id, direction_id, topic_title, direction_title
    content_form, target_platform, target_account
    narrative_constraint_source, created_at
    search_intent: { intent_type, intent_strength, score }  // 来自 Skill 6
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

## 九、Feedback 路由

Agent4 调大框架策略（Narrative），Agent5 调选题优先级（Boost）。目标不同。

接口：`runAgent5({ feedbackSignals: FeedbackSignal[] })`，内置 Mock 数据。

---

## 十、PRD Section 13 合规

Trend Brief ✅ SearchIntentMap ✅ ContentDirection ✅ TopicPool ✅ TopicScore ✅ PlatformRecommendation ✅ EditorialCalendar ✅ 趋势监测 ✅ 搜索意图Skill ✅ 主题聚类 ✅ 平台适配评分 ✅ 内容日历Skill ✅ 三账号分发 ✅ Feedback驱动 ✅

---

## 十一、文件索引

| 文件 | 作用 |
|------|------|
| agent5-core.js | Pipeline 主入口（含分模块输出逻辑 V5）|
| agent5-report.py | Terminal 彩色报告 |
| skills/topic-cluster.js | Skill 5 聚类 |
| skills/platform-scorer.js | Skill 6 评分 |
| skills/distribution-router.js | Skill 10 分发 |
| skills/content-calendar.js | Skill 7 日历 |
| skills/resource-collector.js | Skill 8 素材 |
| skills/topic-brief-builder.js | Skill 9 TrendBrief |
| skills/collect-signals.js | 三技能并发采集 |
| output/ | 分模块输出目录（V5新增）|
| output/index.json | 汇总索引 |
| output/signals.json | 原始信号（V5新增，P-2修复）|
| output/topic-pool.json | TopicPool |
| output/topic-scores.json | TopicScore[] |
| output/distribution-map.json | DistributionMap |
| output/editorial-calendar.json | EditorialCalendar |
| output/resources.json | Resources |
| output/trend-briefs/ | TrendBrief 文件目录 |
| mock-data/agent5-complete-output.json | 兼容索引（V5改为指针）|
| source/ | 选题Agent源码（资源文档）|
| document/AGENT5_SPEC_V2.md | 本文档 |

## 十二、输出结构（V5分模块）

### 12.1 output/ 目录

```
output/
├── index.json              # 汇总索引（必须先读这个）
├── signals.json            # 原始信号（127条，aihot+follow-builders+tech-news）
├── topic-pool.json         # TopicPool（117母题×5方向）
├── topic-scores.json       # TopicScore[]
├── distribution-map.json    # DistributionMap（7020条路由）
├── editorial-calendar.json # EditorialCalendar（7天×12平台）
├── resources.json          # Resources
└── trend-briefs/
    └── BRIEF-{id}.json   # TrendBrief（每方向一个文件）
```

### 12.2 output/index.json 格式

```json
{
  "generated_at": "2026-06-18T03:48:55.400Z",
  "pipeline_version": "v2",
  "module_version": "split-output-v1",
  "modules": {
    "signals":              "output/signals.json",
    "topic_pool":           "output/topic-pool.json",
    "topic_scores":         "output/topic-scores.json",
    "distribution_map":     "output/distribution-map.json",
    "editorial_calendar":   "output/editorial-calendar.json",
    "resources":            "output/resources.json",
    "trend_briefs_dir":     "output/trend-briefs/"
  },
  "stats": {
    "topics_count": 117,
    "directions_count": 585,
    "distribution_routes": 7020,
    "calendar_publishes": 84,
    "platforms_covered": 12
  }
}
```

### 12.3 读取顺序

```javascript
// 读取全部数据
const index = JSON.parse(fs.readFileSync('mock-data/agent5-complete-output.json'));
const signals = JSON.parse(fs.readFileSync(index.modules.signals));
const topicPool = JSON.parse(fs.readFileSync(index.modules.topic_pool));
```
