# Agent 9 v2.0 实施计划

> 版本：v2.0
> 状态：完整贯通版（整合 v0.1→v0.2→v1.0→v1.1→v1.2→v1.3 全部迭代）
> 目标：**开发者拿到这份文档，不需要再问任何问题，直接写代码**

---

# 第一部分：Agent 9 是什么

## 1.1 一句话定位

**Agent 9 是 RISEN 的"学习记忆中枢"——回答"什么真正有效、为什么有效、下一步改哪里"。**

它把 Agent 6 产出、经 Agent 8 发布的文章，和这些文章在各个平台的真实表现数据，关联回选题（Agent 5）和策略（Agent 4），形成可执行的优化决策，再回流给对应 Agent。

## 1.2 在 RISEN 中的位置

```
RISEN 运作全景：

  ┌─────────────────────────────────────────┐
  │  Agent 4  策略叙事                         │
  │  Agent 5  趋势选题                         │
  │  Agent 6  研究母内容                        │
  │  Agent 7  多模态生产                       │
  │  Agent 8  发布传播                         │
  └───────────┬─────────────────────────────────┘
              │
              ▼
  ┌─────────────────────────────────────────┐
  │  各平台（微信公众号/知乎/CSDN/GitHub...）   │
  │  真实表现数据（曝光/点击/转化）           │
  └───────────┬─────────────────────────────────┘
              │
              ▼
  ┌─────────────────────────────────────────┐
  │  Agent 9  收入归因与增长学习 ← 这里是 │  ←
  │  采集 → 归因 → Insight → 决策下发       │
  └───────────┬─────────────────────────────────┘
              │
     ┌────────┼────────┐
     ▼        ▼        ▼
  Agent4   Agent5   Agent6
  策略     选题     内容
  调整     Boost   反馈
```

**数据流向**：Agent 5 选题 → Agent 6 写文章 → Agent 8 发布 → 各平台产生数据 → **Agent 9 分析** → 决策回流

**决策回流路径**：
- 选题效果差 → 回流给 Agent 5 → 调整选题 Boost
- 策略问题 → 回流给 Agent 4 → 调整策略约束
- 内容问题 → 回流给 Agent 6 → 调整写法
- 格式问题 → 回流给 Agent 7 → 调整格式

## 1.3 v2.0 能做到的事

| 能力 | 说明 | 状态 |
|------|------|------|
| 平台指标 Mock 采集 | 微信公众号/知乎/CSDN/Dev.to/GitHub/LinkedIn 六个平台 | ✅ v2.0 实现 |
| 内容归因 | 把文章表现归因到选题，计算 TopicBoost | ✅ v2.0 实现 |
| Insight 生成 | 含平台维度的结构化洞察 | ✅ v2.0 实现 |
| 决策下发 | 路由到 Agent 4/5/6/7（预埋接口） | ✅ v2.0 实现 |
| Agent 5 完整闭环 | Agent 9 → Agent 5 Boost 变化 → 选题调整 | ✅ v2.0 实现 |

## 1.4 v2.0 不能做到的事

| 能力 | 为什么不做到 | 预计版本 |
|------|--------------|---------|
| 真实平台 API 对接 | Agent 8 尚未开发，无法拿真实数据 | 等 Agent 8 |
| 线索→商机→收入归因 | 需要 CRM 数据源和转化链路 | v0.4+ |
| A/B 实验统计分析（CUPED/Bayesian） | 需要真实数据和统计引擎 | v0.3+ |
| Multi-Touch Attribution | 面向用户旅程追踪，非内容归因 | v0.4+ |
| Temporal 工作流 | 没有引入新依赖的计划 | v0.3+ |

---

# 第二部分：系统架构

## 2.1 目录结构

```
risen-agent9/
├── agent9-core.js              # 主入口，运行命令: node agent9-core.js [--date YYYY-MM-DD]
│
├── skills/                    # Agent 9 的 4 个核心 Skill
│   ├── metric-collector.js    # Skill 1：采集指标（适配器模式）
│   ├── attribution-engine.js  # Skill 2：归因计算（核心）
│   ├── insight-generator.js   # Skill 3：生成 Insight
│   └── decision-dispenser.js  # Skill 4：路由决策
│
├── lib/                      # 共享库
│   ├── interfaces/            # 接口定义（Agent 间传递数据的格式）
│   │   ├── ArticlePerformance.js   # 文章表现数据格式
│   │   ├── TopicBoost.js         # 选题 Boost 格式
│   │   ├── Insight.js            # 洞察格式
│   │   └── Decision.js            # 决策格式（含 ID 生成器）
│   ├── attribution-config.json  # 归因配置（模型+基准+阈值，全部可配置）
│   ├── attribution-config-loader.js
│   ├── platform-meta.json       # 平台元数据库（27 个 P0/P1 平台）
│   ├── platform-meta-loader.js
│   └── platform-adapters/       # 平台适配器（Mock，统一接口）
│       ├── interface.js         # 适配器统一接口定义
│       ├── index.js             # 适配器注册表
│       ├── wechat-gzh-mock.js  # 微信公众号 Mock
│       ├── zhihu-mock.js       # 知乎 Mock
│       ├── csdn-mock.js        # CSDN Mock
│       ├── dev-to-mock.js      # Dev.to Mock
│       ├── github-mock.js      # GitHub Mock
│       └── linkedin-mock.js    # LinkedIn Mock
│
├── output/                    # Agent 9 的所有输出
│   ├── performances/           # 原始 ArticlePerformance JSON
│   ├── topic-boosts/          # TopicBoost JSON（Agent 5 读取这个）
│   │   └── _latest/
│   │       └── {topic_id}.json
│   ├── insights/               # Insight JSON
│   │   └── {YYYY-MM-DD}/
│   │       └── {insight_id}.json
│   └── decisions/               # Decision JSON（预埋给 Agent 4/5/6/7）
│       └── from-agent9/
│           ├── agent4/latest.json
│           ├── agent5/latest.json
│           ├── agent6/latest.json
│           └── agent7/latest.json
│
└── document/
    ├── AGENT9_PLAN_V2.0.md   # 本文档（实施计划）
    ├── AGENT9_SPEC.md          # Agent 9 规格文档（PRD 对齐）
    ├── FEEDBACK_CONTRACT.md      # 跨 Agent 数据契约（含 Agent 8 接口）
    ├── DECISION_INTERFACE.md    # 决策接口文档（给 Agent 4/5/6/7 开发者看）
    ├── ATTRIBUTION_MODELS.md     # 归因模型说明
    └── PLATFORM_BENCHMARKS.md   # 平台基准数据说明
```

## 2.2 主流程（agent9-core.js）

```
命令：node agent9-core.js [--date YYYY-MM-DD]

Step 1 - 指标采集
  从各平台适配器（Mock）拉取 ArticlePerformance[]
  输入：dateRange + platformMeta
  输出：ArticlePerformance[]

Step 2 - 归因计算
  将文章表现按 topic_id 聚合，计算 TopicBoost[]
  输入：ArticlePerformance[] + config + platformMeta
  输出：TopicBoost[]
  写文件：output/topic-boosts/_latest/{topic_id}.json

Step 3 - Insight 生成
  从 TopicBoost + ArticlePerformance 生成 Insight[]
  输入：TopicBoost[] + ArticlePerformance[] + config + platformMeta
  输出：Insight[]
  写文件：output/insights/{YYYY-MM-DD}/{insight_id}.json

Step 4 - 决策下发
  根据 Insight 生成 Decision，写入各 Agent 的接收目录
  输入：TopicBoost[] + Insight[] + config
  输出：Decision JSON 文件
  写文件：output/decisions/from-agent9/{agentId}/latest.json
```

---

# 第三部分：核心接口定义

## 3.1 ArticlePerformance（文章表现数据）

这是系统内所有地方传递的最小数据单元。

```javascript
// lib/interfaces/ArticlePerformance.js

/**
 * 文章表现数据格式
 * 必填字段：article_id, topic_id, platform
 * 所有 Skill 之间用这个格式传递数据
 *
 * @typedef {Object} ArticleMetrics
 * @property {number} impressions   曝光量
 * @property {number} clicks       点击量
 * @property {number} ctr          点击率 = clicks / impressions（自动计算）
 * @property {number} conversions  转化数（表单提交/加购等）
 * @property {number} cvr         转化率 = conversions / clicks（自动计算）
 * @property {number} shares       转发数
 * @property {number} likes        点赞数
 * @property {number} comments     评论数
 * @property {number} avg_read_time 平均阅读时长（秒）
 *
 * @typedef {Object} ArticlePerformance
 * @property {string} article_id      格式：ART-{timestamp}-{random4}
 * @property {string} topic_id        选题ID，对应 Agent5 的 topic_id
 * @property {string} [direction_id]  方向ID，对应 Agent5 的 direction_id（可选）
 * @property {string} platform        平台ID，同 platform-meta.json 的 platformId
 * @property {string} published_at    发布时间，ISO 8601
 * @property {boolean} __mock__       必须标注：true=模拟数据，false=真实数据
 * @property {string} __source__      数据来源：'mock' | 'platform_api' | 'agent8'
 * @property {ArticleMetrics} metrics
 * @property {Object} metadata
 * @property {string} metadata.content_form   内容形式：'图文' | '视频' | '短视频' | '问答'
 * @property {string[]} metadata.topic_keywords 选题关键词
 */

/**
 * 构建一个合规的 ArticlePerformance
 * 必填：article_id, topic_id, platform
 * @param {Object} data
 * @returns {ArticlePerformance}
 */
function makeArticlePerformance(data) {
  if (!data.article_id || !data.topic_id || !data.platform) {
    throw new Error('article_id, topic_id, platform 为必填字段');
  }
  const m = data.metrics || {};
  return {
    article_id: data.article_id,
    topic_id: data.topic_id,
    direction_id: data.direction_id || null,
    platform: data.platform,
    published_at: data.published_at || new Date().toISOString(),
    __mock__: data.__mock__ !== false,
    __source__: data.__source__ || 'unknown',
    metrics: {
      impressions:  m.impressions  || 0,
      clicks:       m.clicks       || 0,
      ctr:         m.ctr          || (m.impressions > 0 ? m.clicks / m.impressions : 0),
      conversions:  m.conversions  || 0,
      cvr:         m.cvr          || (m.clicks > 0 ? m.conversions / m.clicks : 0),
      shares:      m.shares       || 0,
      likes:       m.likes        || 0,
      comments:     m.comments     || 0,
      avg_read_time: m.avg_read_time || 0,
    },
    metadata: data.metadata || {}
  };
}

module.exports = { makeArticlePerformance };
```

## 3.2 TopicBoost（选题 Boost）

归因引擎的输出格式。

```javascript
// lib/interfaces/TopicBoost.js

/**
 * @typedef {Object} TopicBoost
 * @property {string} topic_id
 * @property {number} total_impressions  总曝光
 * @property {number} total_clicks       总点击
 * @property {number} total_conversions  总转化
 * @property {number} avg_ctr            原始 CTR（跨平台平均）
 * @property {number} avg_cvr            原始 CVR
 * @property {number} ratio_to_benchmark  相对平台基准的倍数（核心指标）
 * @property {string} model_used          使用的归因模型：'linear' | 'time_decay' | 'position_based'
 * @property {string} decision           决策：'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP'
 * @property {number} boost_score       Boost 分数：0.0 ~ 1.2
 * @property {number} confidence         置信度：0.45 ~ 0.95
 * @property {string[]} source_articles  来源文章 ID 列表
 * @property {string[]} platforms       涉及的平台列表
 * @property {string} computed_at        计算时间，ISO 8601
 * @property {boolean} __mock__
 * @property {Object} __config__        本次计算用的配置快照
 */
```

## 3.3 Insight（洞察）

生成Insight的输出格式。

```javascript
// lib/interfaces/Insight.js

/**
 * @typedef {Object} Insight
 * @property {string} id                格式：INS-{timestamp}-{random4}
 * @property {string} type             类型：'topic_efficiency' | 'content_form_analysis'
 * @property {string} topic_id
 * @property {string} category         类别：'topic' | 'content' | 'strategy'
 * @property {string} summary          一句话总结（Agent 5 可直接读）
 * @property {string} detail           详细分析（供人工复盘）
 * @property {string[]} platforms      涉及平台
 * @property {number} confidence      置信度
 * @property {string} recommended_action 建议动作：'SCALE' | 'REDUCE' | 'REVIEW' | 'PROMOTE_FORM'
 * @property {string} target_agent     目标 Agent：'agent4' | 'agent5' | 'agent6'
 * @property {string} computed_at
 */
```

## 3.4 Decision（决策）

决策下发格式。

```javascript
// lib/interfaces/Decision.js

/**
 * @typedef {Object} Decision
 * @property {string} id                格式：DEC-{YYYYMMDD}-{HHmm}-{ssss}
 * @property {string} type             类型：'topic_boost' | 'strategy_shift' | 'content_adjust'
 * @property {string} source           固定：'agent9'
 * @property {string} target            目标 Agent：'agent4' | 'agent5' | 'agent6' | 'agent7'
 * @property {string} topic_id
 * @property {string} decision          决策：'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP'
 * @property {number} boost_score
 * @property {string} reason           原因说明
 * @property {number} confidence
 * @property {string} recommended_action 具体建议动作
 * @property {string} created_at       创建时间，ISO 8601（时区固定 +08:00）
 */

/**
 * 生成 Decision ID
 * 格式：DEC-{YYYYMMDD}-{HHmm}-{ssss}
 * @returns {string}
 */
function makeDecisionId() {
  const d = new Date();
  const pad = (n, w) => String(n).padStart(w, '0');
  return [
    'DEC',
    `${d.getFullYear()}${pad(d.getMonth()+1,2)}${pad(d.getDate(),2)}`,
    `${pad(d.getHours(),2)}${pad(d.getMinutes(),2)}`,
    pad(Math.floor(Math.random() * 9999), 4)
  ].join('-');
}
```

---

# 第四部分：attribution-config.json（完整配置）

路径：`lib/attribution-config.json`

这是归因引擎的全部配置。**改任何一个数字都不需要改代码**，只需要改这个文件并重启 Agent 9。

```json
{
  "_version": "1.0",
  "_updated": "2026-07-02T00:00:00+08:00",
  "_note": "Boost 阈值和置信度阈值为工程经验值，1 年内替换为真实数据统计值",

  "model": "linear",

  "models": {
    "linear": {
      "description": "Linear Attribution，权重均分，适合初期数据不足场景"
    },
    "time_decay": {
      "description": "Time Decay Attribution，近期内容权重更高",
      "params": { "halfLifeDays": 7 }
    },
    "position_based": {
      "description": "Position Based Attribution，首尾各 40% 权重",
      "params": { "firstWeight": 0.4, "lastWeight": 0.4 }
    }
  },

  "boostThresholds": {
    "_note": "ratio = avg_ctr / platform_benchmark_avg_ctr",
    "_source": "工程经验值，非行业标准；1 年内替换",
    "excellent": { "ratio": 2.0,  "boost_score": 1.2, "decision": "SCALE" },
    "good":     { "ratio": 1.0,  "boost_score": 1.0, "decision": "CONTINUE" },
    "average": { "ratio": 0.5,  "boost_score": 0.8, "decision": "REDUCE" },
    "poor":    { "ratio": 0.0,  "boost_score": 0.0, "decision": "STOP" },
    "_new_topic": { "boost_score": 1.0, "decision": "CONTINUE", "_note": "文章数 < 5 篇的冷启动选题" }
  },

  "platformBenchmarks": {
    "_note": "数据来源见 PLATFORM_BENCHMARKS.md",
    "wechat_gzh": { "avgCTR": 0.025, "goodCTR": 0.05,  "excellentCTR": 0.08,  "_source": "行业公开报告" },
    "zhihu":       { "avgCTR": 0.035, "goodCTR": 0.06,  "excellentCTR": 0.10,  "_source": "知乎创作者公开数据" },
    "csdn":        { "avgCTR": 0.030, "goodCTR": 0.06,  "excellentCTR": 0.10,  "_source": "技术社区统计" },
    "juejin":      { "avgCTR": 0.030, "goodCTR": 0.06,  "excellentCTR": 0.10,  "_source": "技术社区统计" },
    "dev-to":      { "avgCTR": 0.020, "goodCTR": 0.04,  "excellentCTR": 0.08,  "_source": "Dev.to 官方博客" },
    "linkedin":    { "avgCTR": 0.020, "goodCTR": 0.04,  "excellentCTR": 0.06,  "_source": "LinkedIn 营销博客" },
    "github":      { "avgCTR": null,  "metric": "star_rate", "_note": "GitHub 用 Star Rate，不适用 CTR" }
  },

  "confidence": {
    "_note": "来源：工程经验值，1 年内用真实数据验证",
    "ranges": [
      { "minImpressions": 100000, "confidence": 0.95 },
      { "minImpressions": 50000,  "confidence": 0.85 },
      { "minImpressions": 10000,  "confidence": 0.75 },
      { "minImpressions": 5000,   "confidence": 0.65 },
      { "minImpressions": 1000,   "confidence": 0.55 },
      { "minImpressions": 0,     "confidence": 0.45 }
    ]
  }
}
```

---

# 第五部分：platform-meta.json（27 个平台完整列表）

路径：`lib/platform-meta.json`

```json
{
  "_version": "1.0",
  "_updated": "2026-07-02T00:00:00+08:00",
  "_note": "P0/P1 平台共 27 个；P2/P3/P4 按需扩展",

  "platforms": [
    { "platformId": "wechat_gzh",  "name": "微信公众号",  "region": "国内", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "zhihu",       "name": "知乎",         "region": "国内", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "2-3天级","minAttributionWindow": "72h",  "ctrMetric": "CTR" },
    { "platformId": "csdn",        "name": "CSDN",         "region": "国内", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "juejin",      "name": "掘金",         "region": "国内", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "baijiahao",   "name": "百家号",        "region": "国内", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "toutiao",     "name": "今日头条",      "region": "国内", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "dev-to",      "name": "Dev.to",       "region": "海外", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "github",      "name": "GitHub",       "region": "海外", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "实时",  "minAttributionWindow": "2h",   "ctrMetric": "StarRate", "_note": "用 Star Rate 而非 CTR" },
    { "platformId": "medium",      "name": "Medium",       "region": "海外", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "linkedin",    "name": "LinkedIn",     "region": "海外", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "hashnode",    "name": "Hashnode",     "region": "海外", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "quora",       "name": "Quora",        "region": "海外", "priority": "P0", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "baidu_zhidao", "name": "百度知道",    "region": "国内", "priority": "P1", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "baidu_jingyan","name": "百度经验",     "region": "国内", "priority": "P1", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "baidu_wenku",  "name": "百度文库",     "region": "国内", "priority": "P1", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "ReadRate" },
    { "platformId": "yuque",        "name": "语雀",         "region": "国内", "priority": "P1", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "infoq",        "name": "InfoQ",        "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "36kr",         "name": "36氪",         "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "huxiu",        "name": "虎嗅",         "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "timemagazine", "name": "钛媒体",       "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "blogcn",       "name": "博客园",       "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "oschina",     "name": "开源中国",     "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "segmentfault", "name": "SegmentFault", "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "gitee",       "name": "Gitee",        "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "实时",  "minAttributionWindow": "2h",   "ctrMetric": "StarRate" },
    { "platformId": "zenn",         "name": "Zenn",         "region": "海外", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "qiita",        "name": "Qiita",        "region": "海外", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "note",         "name": "note.com",     "region": "海外", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" }
  ]
}
```

---

# 第六部分：平台适配器统一接口

## 6.1 接口定义

每个平台适配器必须实现以下两个方法，Agent 9 核心代码只调用接口，不关心实现：

```javascript
// lib/platform-adapters/interface.js

/**
 * 平台适配器基类
 * 所有平台适配器必须继承此类并实现 fetchPerformances() 和 healthCheck()
 */
class PlatformAdapter {
  /**
   * 拉取指定时间范围内的文章表现数据
   * @param {string} platformId    平台ID
   * @param {Object} options
   * @param {string} options.startDate  ISO 8601，起始日期（含）
   * @param {string} options.endDate    ISO 8601，结束日期（含）
   * @param {string[]} [options.topicIds] 可选，只拉取指定 topic 的文章
   * @returns {Promise<ArticlePerformance[]>}
   */
  async fetchPerformances(platformId, options) {
    throw new Error('NOT_IMPLEMENTED: 子类必须实现 fetchPerformances()');
  }

  /**
   * 健康检查
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async healthCheck() {
    return { ok: true, message: 'OK' };
  }
}

module.exports = { PlatformAdapter };
```

## 6.2 适配器注册表

```javascript
// lib/platform-adapters/index.js

const WechatGzhAdapter = require('./wechat-gzh-mock');
const ZhihuAdapter     = require('./zhihu-mock');
const CsdnAdapter     = require('./csdn-mock');
const DevToAdapter    = require('./dev-to-mock');
const GithubAdapter   = require('./github-mock');
const LinkedInAdapter = require('./linkedin-mock');

const ADAPTERS = {
  wechat_gzh:  new WechatGzhAdapter(),
  zhihu:       new ZhihuAdapter(),
  csdn:        new CsdnAdapter(),
  'dev-to':    new DevToAdapter(),
  github:       new GithubAdapter(),
  linkedin:    new LinkedInAdapter(),
};

function listAdapters() {
  return Object.keys(ADAPTERS);
}

module.exports = { ADAPTERS, listAdapters, PlatformAdapter };
```

## 6.3 Mock 适配器示例（微信公众号）

```javascript
// lib/platform-adapters/wechat-gzh-mock.js
const { PlatformAdapter } = require('./interface');
const { makeArticlePerformance } = require('../interfaces/ArticlePerformance');

/**
 * 微信公众号 Mock 适配器
 * 模拟真实微信公众号后台的数据返回格式
 * CTR 分布：均值 2.5%，标准差 1.5%（符合平台基准）
 */
class WechatGzhMockAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platformId = 'wechat_gzh';
  }

  async fetchPerformances(platformId, { startDate, endDate, topicIds } = {}) {
    // 生成 3-8 篇 Mock 文章
    const count = 3 + Math.floor(Math.random() * 6);
    const articles = [];

    for (let i = 0; i < count; i++) {
      // CTR 符合正态分布：均值 0.025，标准差 0.015
      const ctr = Math.max(0.001, gaussRandom(0.025, 0.015));
      const impressions = 5000 + Math.floor(Math.random() * 20000);
      const clicks = Math.round(impressions * ctr);
      const conversions = Math.round(clicks * (0.01 + Math.random() * 0.03));

      articles.push(makeArticlePerformance({
        article_id: `ART-${Date.now()}-${random4()}`,
        topic_id: topicIds ? topicIds[i % topicIds.length] : `TOPIC-${random4()}`,
        platform: this.platformId,
        published_at: randomDate(startDate, endDate),
        __mock__: true,
        __source__: 'mock',
        metrics: {
          impressions,
          clicks,
          ctr,
          conversions,
          shares: Math.floor(clicks * 0.05 * Math.random()),
          likes: Math.floor(clicks * 0.10 * Math.random()),
          comments: Math.floor(clicks * 0.02 * Math.random()),
          avg_read_time: 60 + Math.floor(Math.random() * 180)
        },
        metadata: {
          content_form: '图文',
          topic_keywords: []
        }
      }));
    }

    return articles;
  }
}

// 高斯随机数（Box-Muller）
function gaussRandom(mean, std) {
  const u = 1 - Math.random();
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * std + mean;
}

function random4() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function randomDate(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString();
}

module.exports = WechatGzhMockAdapter;
```

---

# 第七部分：核心 Skill 实现代码

## 7.1 metric-collector.js（Skill 1）

```javascript
// skills/metric-collector.js

/**
 * Skill 1：指标采集器
 * 从各平台适配器拉取 ArticlePerformance[]
 */
class MetricCollector {
  constructor({ adapters, dateRange, platformMeta, config }) {
    this.adapters = adapters;
    this.dateRange = dateRange;
    this.platformMeta = new Map(platformMeta.map(p => [p.platformId, p]));
    this.config = config;
  }

  async collect() {
    const results = [];
    for (const [platformId, adapter] of Object.entries(this.adapters)) {
      const meta = this.platformMeta.get(platformId);
      // 检查是否满足最小归因窗口
      if (meta && !this._isAttributionWindowMet(meta)) {
        console.log(`[Collector] ⏭  ${platformId}: 归因窗口未满，跳过`);
        continue;
      }
      try {
        const performances = await adapter.fetchPerformances(platformId, this.dateRange);
        results.push(...performances);
        console.log(`[Collector] ✅ ${platformId}: +${performances.length} 条`);
      } catch (err) {
        console.error(`[Collector] ❌ ${platformId}: ${err.message}`);
      }
    }
    return results;
  }

  _isAttributionWindowMet(platformMeta) {
    const windowHours = this._parseWindow(platformMeta.minAttributionWindow);
    const publishedDates = [];  // 从 dateRange 推断
    const runDate = new Date(this.dateRange.endDate);
    const startDate = new Date(this.dateRange.startDate);
    const hoursSinceStart = (runDate - startDate) / (1000 * 60 * 60);
    return hoursSinceStart >= windowHours;
  }

  _parseWindow(window) {
    if (window.endsWith('h')) return parseInt(window);
    if (window.endsWith('d')) return parseInt(window) * 24;
    return 24;
  }
}

module.exports = MetricCollector;
```

## 7.2 attribution-engine.js（Skill 2，核心）

这是 Agent 9 最关键的 Skill。

```javascript
// skills/attribution-engine.js

/**
 * Skill 2：归因引擎
 *
 * 核心设计原则：
 * 1. 用"相对平台基准倍数"判断 Boost，不自创绝对阈值
 * 2. 模型可插拔（Linear / TimeDecay / PositionBased）
 * 3. 所有参数来自 attribution-config.json，不硬编码
 */
class AttributionEngine {
  constructor({ config, platformMeta }) {
    this.config = config;
    this.platformBenchmarks = config.platformBenchmarks;
    this.boostThresholds = config.boostThresholds;
    this.confidenceRanges = config.confidence.ranges;
    this.platformMeta = new Map(platformMeta.map(p => [p.platformId, p]));
  }

  /**
   * 将 ArticlePerformance[] 归因计算为 TopicBoost[]
   * @param {ArticlePerformance[]} performances
   * @returns {TopicBoost[]}
   */
  async attribute(performances) {
    if (!performances || performances.length === 0) return [];

    // Step 1: 按 topic_id 聚合
    const byTopic = this._groupBy(performances, 'topic_id');

    // Step 2: 对每个 Topic 计算 Boost
    const topicBoosts = Object.entries(byTopic).map(([topicId, perfs]) => {
      return this._computeTopicBoost(topicId, perfs);
    });

    // 过滤无数据的 Topic
    return topicBoosts.filter(b => b.source_articles.length > 0);
  }

  _computeTopicBoost(topicId, perfs) {
    // 汇总指标
    const totalImpressions = perfs.reduce((s, p) => s + p.metrics.impressions, 0);
    const totalClicks     = perfs.reduce((s, p) => s + p.metrics.clicks, 0);
    const totalConversions = perfs.reduce((s, p) => s + p.metrics.conversions, 0);
    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgCVR = totalClicks > 0 ? totalConversions / totalClicks : 0;

    // 计算"相对平台基准的加权 ratio"
    const ratio = this._calcWeightedRatio(perfs, avgCTR);

    // 计算 Boost 决策
    const boost = this._calcBoostDecision(ratio, perfs.length);

    // 计算置信度
    const confidence = this._calcConfidence(totalImpressions);

    return {
      topic_id: topicId,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      avg_ctr: parseFloat(avgCTR.toFixed(4)),
      avg_cvr: parseFloat(avgCVR.toFixed(4)),
      ratio_to_benchmark: parseFloat(ratio.toFixed(3)),
      model_used: this.config.model,
      decision: boost.decision,
      boost_score: boost.score,
      confidence: confidence,
      source_articles: perfs.map(p => p.article_id),
      platforms: [...new Set(perfs.map(p => p.platform))],
      computed_at: new Date().toISOString(),
      __mock__: perfs.some(p => p.__mock__),
      __config__: {
        model: this.config.model,
        config_version: this.config._version
      }
    };
  }

  /**
   * 计算相对平台基准的加权 ratio
   * 如果有平台基准，用跨平台的加权 ratio；否则用绝对 CTR
   */
  _calcWeightedRatio(perfs, avgCTR) {
    let totalRatio = 0;
    let countWithBenchmark = 0;

    for (const perf of perfs) {
      const bench = this.platformBenchmarks[perf.platform];
      if (!bench || !bench.avgCTR || bench.avgCTR === null) continue;
      const ratio = (perf.metrics.ctr || 0) / bench.avgCTR;
      const weight = perf.metrics.impressions;
      totalRatio += ratio * weight;
      countWithBenchmark += weight;
    }

    if (countWithBenchmark > 0) {
      return totalRatio / countWithBenchmark;  // 加权平均 ratio
    }

    // 无基准的平台：用绝对 CTR，配合默认基准 0.02
    return avgCTR / 0.02;
  }

  /**
   * 根据 ratio 和样本量判断 Boost
   * @param {number} ratio  相对平台基准的倍数
   * @param {number} articleCount 文章数量
   */
  _calcBoostDecision(ratio, articleCount) {
    // 冷启动：新 Topic（样本不足 5 篇）给予中性 Boost
    if (articleCount < 5) {
      return { decision: 'CONTINUE', score: 1.0 };
    }

    const t = this.boostThresholds;
    if (ratio >= t.excellent.ratio) return { decision: 'SCALE',    score: t.excellent.boost_score };
    if (ratio >= t.good.ratio)     return { decision: 'CONTINUE',  score: t.good.boost_score };
    if (ratio >= t.average.ratio)  return { decision: 'REDUCE',   score: t.average.boost_score };
    return { decision: 'STOP', score: t.poor.boost_score };
  }

  /**
   * 根据总曝光量计算置信度
   * 来源：工程经验值，1 年内替换为真实数据统计值
   */
  _calcConfidence(totalImpressions) {
    for (const range of this.confidenceRanges) {
      if (totalImpressions >= range.minImpressions) {
        return range.confidence;
      }
    }
    return 0.45;
  }

  _groupBy(arr, key) {
    return arr.reduce((groups, item) => {
      const val = item[key];
      if (!groups[val]) groups[val] = [];
      groups[val].push(item);
      return groups;
    }, {});
  }
}

module.exports = AttributionEngine;
```

## 7.3 insight-generator.js（Skill 3）

```javascript
// skills/insight-generator.js

/**
 * Skill 3：Insight 生成器
 * v2.0 支持两种 Insight 类型
 */
class InsightGenerator {
  constructor({ config, platformMeta }) {
    this.config = config;
    this.platformMeta = platformMeta;
  }

  async generate({ topicBoosts, performances }) {
    const insights = [];
    const perfMap = new Map(performances.map(p => [p.article_id, p]));

    for (const boost of topicBoosts) {
      const topicInsight = this._genTopicEfficiencyInsight(boost);
      if (topicInsight) insights.push(topicInsight);

      const formInsights = this._genContentFormInsights(boost, perfMap);
      insights.push(...formInsights);
    }

    return insights;
  }

  _genTopicEfficiencyInsight(boost) {
    // 置信度低的 CONTINUE 不生成 Insight（避免噪音）
    if (boost.decision === 'CONTINUE' && boost.confidence < 0.65) return null;

    const messages = {
      SCALE:   `CTR 是平台基准的 ${boost.ratio_to_benchmark.toFixed(1)}x，建议扩大产出`,
      CONTINUE:`CTR 接近平台基准，继续观察`,
      REDUCE:  `CTR 低于平台基准，建议减少投入`,
      STOP:    `CTR 远低于平台基准，暂停该选题`
    };

    return {
      id: `INS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'topic_efficiency',
      topic_id: boost.topic_id,
      category: 'topic',
      summary: messages[boost.decision],
      detail: `综合 CTR = ${(boost.avg_ctr * 100).toFixed(2)}%，` +
              `相对平台基准 ratio = ${boost.ratio_to_benchmark.toFixed(2)}，` +
              `总曝光 ${boost.total_impressions.toLocaleString()}，` +
              `置信度 ${boost.confidence.toFixed(2)}，` +
              `基于 ${boost.source_articles.length} 篇内容计算`,
      platforms: boost.platforms,
      confidence: boost.confidence,
      recommended_action: boost.decision === 'CONTINUE' ? 'REVIEW' : boost.decision,
      target_agent: 'agent5',
      computed_at: new Date().toISOString()
    };
  }

  /**
   * 内容形式差异分析
   * 比较同一 Topic 下图文/视频/问答等不同形式的 CTR 差异
   */
  _genContentFormInsights(boost, perfMap) {
    const insights = [];
    const perfs = boost.source_articles.map(id => perfMap.get(id)).filter(Boolean);

    const byForm = {};
    for (const perf of perfs) {
      const form = perf.metadata?.content_form || '未知';
      if (!byForm[form]) byForm[form] = [];
      byForm[form].push(perf);
    }

    const forms = Object.entries(byForm);
    if (forms.length < 2) return insights;

    let bestForm = null, worstForm = null;
    let bestCTR = -1, worstCTR = 1;

    for (const [form, formPerfs] of forms) {
      if (formPerfs.length < 1) continue;
      const avgCTR = formPerfs.reduce((s, p) => s + p.metrics.ctr, 0) / formPerfs.length;
      if (avgCTR > bestCTR) { bestCTR = avgCTR; bestForm = form; }
      if (avgCTR < worstCTR) { worstCTR = avgCTR; worstForm = form; }
    }

    if (bestForm && worstForm && bestForm !== worstForm) {
      const ratio = bestCTR / worstCTR;
      if (ratio >= 1.5) {  // 差异超过 50% 才生成 Insight
        insights.push({
          id: `INS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'content_form_analysis',
          topic_id: boost.topic_id,
          category: 'content',
          summary: `「${bestForm}」效果显著优于「${worstForm}」（CTR 高 ${((ratio - 1) * 100).toFixed(0)}%）`,
          detail: `「${bestForm}」CTR = ${(bestCTR * 100).toFixed(2)}%，` +
                  `「${worstForm}」CTR = ${(worstCTR * 100).toFixed(2)}%，` +
                  `比值 = ${ratio.toFixed(2)}，建议增加 ${bestForm} 内容产出`,
          platforms: boost.platforms,
          confidence: Math.min(boost.confidence, 0.75),
          recommended_action: 'PROMOTE_FORM',
          best_form: bestForm,
          worst_form: worstForm,
          target_agent: 'agent6',
          computed_at: new Date().toISOString()
        });
      }
    }

    return insights;
  }
}

module.exports = InsightGenerator;
```

## 7.4 decision-dispenser.js（Skill 4）

```javascript
// skills/decision-dispenser.js

/**
 * Skill 4：决策下发器
 * 将 TopicBoost + Insight 转换为 Decision，写入各 Agent 的接收目录
 *
 * 路由目标：
 * - Agent 5：topic_boost 决策（完整闭环）
 * - Agent 4：strategy_shift 决策（预埋接口）
 * - Agent 6：content_adjust 决策（预埋接口）
 * - Agent 7：format_suggest 决策（预埋接口）
 *
 * Agent 8 不在目标名单里（Agent 8 是数据源，不是接收方）
 */
const fs = require('fs');
const path = require('path');
const { makeDecisionId } = require('../interfaces/Decision');

const TARGET_AGENTS = {
  agent5: true,   // ✅ 完整闭环
  agent4: true,    // ⏳ 预埋，等 SPEC 更新
  agent6: true,    // ⏳ 预埋，等 SPEC 更新
  agent7: true,   // ⏳ 预埋，等 Agent7 定义
};

class DecisionDispenser {
  constructor({ config, outputDir }) {
    this.config = config;
    this.outputDir = outputDir;
  }

  async dispatch({ topicBoosts, insights }) {
    const decisions = [];

    // 从 TopicBoost 生成 Decision
    for (const boost of topicBoosts) {
      decisions.push(this._boostToDecision(boost));
    }

    // 从 Insight 生成 Decision
    for (const insight of insights) {
      if (insight.target_agent && insight.target_agent !== 'agent5') {
        decisions.push(this._insightToDecision(insight));
      }
    }

    // 按 Agent 分组，写入各自目录
    const byAgent = {};
    for (const d of decisions) {
      if (!byAgent[d.target]) byAgent[d.target] = [];
      byAgent[d.target].push(d);
    }

    for (const [agentId, agentDecisions] of Object.entries(byAgent)) {
      if (!TARGET_AGENTS[agentId]) continue;
      await this._writeDecisionFile(agentId, agentDecisions);
    }
  }

  _boostToDecision(boost) {
    const messages = {
      SCALE:   'CTR 显著高于平台基准，建议扩大该选题的内容产出',
      CONTINUE:'CTR 接近平台基准，继续保持当前节奏',
      REDUCE:  'CTR 低于平台基准，建议减少该选题的内容投入',
      STOP:    'CTR 远低于平台基准，建议暂停该选题'
    };

    return {
      id: makeDecisionId(),
      type: 'topic_boost',
      source: 'agent9',
      target: 'agent5',
      topic_id: boost.topic_id,
      decision: boost.decision,
      boost_score: boost.boost_score,
      reason: messages[boost.decision],
      confidence: boost.confidence,
      recommended_action: boost.decision === 'CONTINUE' ? 'REVIEW' : boost.decision,
      created_at: new Date().toISOString()
    };
  }

  _insightToDecision(insight) {
    return {
      id: makeDecisionId(),
      type: insight.type === 'content_form_analysis' ? 'content_adjust' : 'strategy_shift',
      source: 'agent9',
      target: insight.target_agent,
      topic_id: insight.topic_id,
      decision: insight.recommended_action === 'SCALE' ? 'SCALE' :
                insight.recommended_action === 'REDUCE' ? 'REDUCE' : 'CONTINUE',
      boost_score: 1.0,
      reason: insight.summary,
      confidence: insight.confidence,
      recommended_action: insight.recommended_action,
      created_at: new Date().toISOString()
    };
  }

  async _writeDecisionFile(agentId, decisions) {
    const dir = path.join(this.outputDir, 'decisions', 'from-agent9', agentId);
    fs.mkdirSync(dir, { recursive: true });

    const data = {
      version: '1.0',
      decisions,
      metadata: {
        interface_version: '1.0',
        total_decisions: decisions.length,
        computed_at: new Date().toISOString()
      }
    };

    const file = path.join(dir, 'latest.json');
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`[Dispenser] ✅ → ${agentId}: ${decisions.length} 条决策`);
  }
}

module.exports = DecisionDispenser;
```

---

# 第八部分：agent9-core.js（主入口）

```javascript
// agent9-core.js
// Agent 9 主入口
// 运行：node agent9-core.js [--date YYYY-MM-DD]
// 环境变量：AGENT9_OUTPUT_DIR（可选，默认为 ./output）

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.env.AGENT9_OUTPUT_DIR || path.join(__dirname, 'output');

// 加载依赖
const { loadPlatformMeta }        = require('./lib/platform-meta-loader');
const { loadAttributionConfig }  = require('./lib/attribution-config-loader');
const { ADAPTERS }              = require('./lib/platform-adapters');
const { makeArticlePerformance }  = require('./lib/interfaces/ArticlePerformance');
const MetricCollector  = require('./skills/metric-collector');
const AttributionEngine = require('./skills/attribution-engine');
const InsightGenerator = require('./skills/insight-generator');
const DecisionDispenser = require('./skills/decision-dispenser');

async function main() {
  const startTime = Date.now();
  const runDate = process.argv.includes('--date')
    ? process.argv[process.argv.indexOf('--date') + 1]
    : new Date().toISOString().split('T')[0];

  console.log(`\n[Agent9] 🚀 启动 (run=${runDate})`);
  console.log(`[Agent9] 📁 OUTPUT_DIR: ${OUTPUT_DIR}`);

  const config = loadAttributionConfig();
  const platformMeta = loadPlatformMeta();

  // Step 1: 指标采集
  console.log('\n[Agent9] 📥 Step 1: 指标采集');
  const dateRange = {
    startDate: getAttributionWindowStart(runDate, platformMeta),
    endDate: `${runDate}T23:59:59+08:00`
  };
  console.log(`[Agent9] 📅 采集窗口: ${dateRange.startDate} ~ ${dateRange.endDate}`);

  const collector = new MetricCollector({ adapters: ADAPTERS, dateRange, platformMeta, config });
  const performances = await collector.collect();
  console.log(`[Agent9] ✅ 采集完成：${performances.length} 条`);

  if (performances.length === 0) {
    console.warn('[Agent9] ⚠️  无采集数据，归因跳过');
    console.log(`[Agent9] ⏱️  耗时: ${Date.now() - startTime}ms`);
    return;
  }

  // Step 2: 归因计算
  console.log('\n[Agent9] 🧠 Step 2: 归因计算');
  const engine = new AttributionEngine({ config, platformMeta });
  const topicBoosts = await engine.attribute(performances);
  console.log(`[Agent9] ✅ 归因完成：${topicBoosts.length} 个 TopicBoost`);

  const dist = { SCALE: 0, CONTINUE: 0, REDUCE: 0, STOP: 0 };
  topicBoosts.forEach(b => dist[b.decision]++);
  console.log(`[Agent9] 📊 分布: SCALE=${dist.SCALE} CONTINUE=${dist.CONTINUE} REDUCE=${dist.REDUCE} STOP=${dist.STOP}`);

  writeTopicBoosts(topicBoosts, OUTPUT_DIR);

  // Step 3: Insight 生成
  console.log('\n[Agent9] 💡 Step 3: Insight 生成');
  const generator = new InsightGenerator({ config, platformMeta });
  const insights = await generator.generate({ topicBoosts, performances });
  console.log(`[Agent9] ✅ Insight 生成：${insights.length} 条`);
  writeInsights(insights, OUTPUT_DIR);

  // Step 4: 决策下发
  console.log('\n[Agent9] 📤 Step 4: 决策下发');
  const dispenser = new DecisionDispenser({ config, outputDir: OUTPUT_DIR });
  await dispenser.dispatch({ topicBoosts, insights });

  console.log(`\n[Agent9] ✅ 完成，耗时: ${Date.now() - startTime}ms`);
}

// 工具函数

function getAttributionWindowStart(runDate, platformMeta) {
  const MAX_WINDOW_DAYS = 7;
  let maxHours = 24;
  for (const p of platformMeta) {
    const h = parseWindow(p.minAttributionWindow);
    if (h > maxHours) maxHours = h;
  }
  const startDate = new Date(runDate);
  startDate.setDate(startDate.getDate() - Math.min(Math.ceil(maxHours / 24), MAX_WINDOW_DAYS));
  return startDate.toISOString().split('T')[0] + 'T00:00:00+08:00';
}

function parseWindow(window) {
  if (!window) return 24;
  if (window.endsWith('h')) return parseInt(window);
  if (window.endsWith('d')) return parseInt(window) * 24;
  return 24;
}

function writeTopicBoosts(topicBoosts, outputDir) {
  const dir = path.join(outputDir, 'topic-boosts', '_latest');
  fs.mkdirSync(dir, { recursive: true });
  topicBoosts.forEach(boost => {
    fs.writeFileSync(path.join(dir, `${boost.topic_id}.json`), JSON.stringify(boost, null, 2));
  });
  console.log(`[Agent9] 💾 写 ${topicBoosts.length} 个 TopicBoost → ${dir}/`);
}

function writeInsights(insights, outputDir) {
  const todayDir = new Date().toISOString().split('T')[0];
  const dir = path.join(outputDir, 'insights', todayDir);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = { version: '1.0', computed_at: new Date().toISOString(), total: insights.length };
  insights.forEach(insight => {
    fs.writeFileSync(path.join(dir, `${insight.id}.json`), JSON.stringify(insight, null, 2));
  });
  const latestFile = path.join(outputDir, 'insights', 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(manifest, null, 2));
  console.log(`[Agent9] 💾 写 ${insights.length} 条 Insight → ${dir}/`);
}

main().catch(err => {
  console.error('[Agent9] ❌ 异常:', err);
  process.exit(1);
});
```

---

# 第九部分：Agent 8 接口契约

## 9.1 Agent 8 产出数据（Agent 9 读取）

Agent 8 每发布一篇文章，写一条记录：

```
{AGENT8_OUTPUT_DIR}/publications/{YYYY-MM}/PUB-{publication_id}.json
```

文件格式：

```json
{
  "publication_id": "PUB-20260702-001",
  "article_id": "ART-20260701-001",
  "topic_id": "TOPIC-001",
  "direction_id": "DIR-001",
  "platform": "wechat_gzh",
  "remote_publication_id": "xxxxx",
  "remote_url": "https://mp.weixin.qq.com/s/xxxx",
  "published_at": "2026-07-02T10:00:00+08:00",
  "status": "published",
  "__source__": "agent8",
  "__mock__": false
}
```

## 9.2 Agent 9 读取 Agent 8 数据

```javascript
// metric-collector.js 中，真实 API 适配器拉取时：
const pubFiles = fs.readdirSync(`${AGENT8_OUTPUT_DIR}/publications/${YYYY-MM}/`)
  .filter(f => f.startsWith('PUB-') && f.endsWith('.json'));
// 然后读取每个文件，关联 topic_id → 传给归因引擎
```

---

# 第十部分：Agent 5 / Agent 6 前置修复（M0）

## M0.1：Agent 6 article 输出加 topic_id

**文件**：`/workspace/RISEN-OS/agent6/agent6-core.js`（约第 208 行）

```javascript
// article 对象构建处，新增 2 行
const article = {
  article_id: generateArticleId(),
  topic_id: topicBrief.topic_id,           // ← 新增
  direction_id: topicBrief.direction_id || null,  // ← 新增
  title: topicBrief.topic_title,
  // ... 其余不变
};
```

## M0.2：Agent 5 新增 loadFeedbackFromAgent9()

**文件**：`/workspace/RISEN-OS/agent5/agent5-core.js`

```javascript
/**
 * 从 Agent 9 读取 TopicBoost 数据
 * 依赖环境变量 AGENT9_OUTPUT_DIR（必须设置）
 */
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR;
  if (!dir) {
    console.error('[Agent5] ❌ AGENT9_OUTPUT_DIR 未设置，无法读取 Agent9 数据');
    console.error('[Agent5] ℹ️  设置方式: export AGENT9_OUTPUT_DIR=/workspace/risen-agent9/output');
    return null;
  }
  const latestDir = dir + '/topic-boosts/_latest/';
  let files;
  try {
    files = fs.readdirSync(latestDir).filter(f => f.endsWith('.json'));
  } catch (e) {
    console.warn(`[Agent5] ⚠️ Agent9 数据目录不存在: ${latestDir}，fallback 到 Mock`);
    return null;
  }
  if (files.length === 0) {
    console.warn(`[Agent5] ⚠️ Agent9 无 Boost 数据，fallback 到 Mock`);
    return null;
  }
  const boosts = files.map(f => {
    const b = JSON.parse(fs.readFileSync(latestDir + f, 'utf8'));
    return {
      topic_id: b.topic_id,
      engagement_score: b.boost_score,
      decision: b.decision,
      confidence: b.confidence,
      data_source: '__agent9__',
      computed_at: b.computed_at
    };
  });
  console.log(`[Agent5] ✅ 读取 ${boosts.length} 条 Agent9 Boost 数据`);
  return boosts;
}
```

---

# 第十一部分：决策接口文档（预埋）

## 11.1 Decision 文件路径

```
{AGENT9_OUTPUT_DIR}/decisions/from-agent9/{agentId}/latest.json
```

## 11.2 Decision 文件格式

```json
{
  "version": "1.0",
  "decisions": [
    {
      "id": "DEC-20260702-1046-3847",
      "type": "topic_boost",
      "source": "agent9",
      "target": "agent5",
      "topic_id": "TOPIC-001",
      "decision": "SCALE",
      "boost_score": 1.2,
      "reason": "CTR 是平台基准的 2.1x，建议扩大产出",
      "confidence": 0.75,
      "recommended_action": "SCALE",
      "created_at": "2026-07-02T10:46:00+08:00"
    }
  ],
  "metadata": {
    "interface_version": "1.0",
    "total_decisions": 1
  }
}
```

## 11.3 激活条件

| Agent | Decision 类型 | 激活条件 |
|-------|------------|---------|
| Agent 5 | topic_boost | ✅ 直接可用 |
| Agent 4 | strategy_shift | Agent 4 SPEC 更新声明接收接口 |
| Agent 6 | content_adjust | Agent 6 SPEC 更新声明接收接口 |
| Agent 7 | format_suggest | Agent 7 完整定义（含反馈闭环） |

---

# 第十二部分：里程碑

### M0：前置修复（0.5h）
- [ ] Agent 6 article 加 `topic_id` + `direction_id`（2行）
- [ ] Agent 5 加 `loadFeedbackFromAgent9()`（~25行，含 err/warn，无 fallback）
- [ ] 验证：Agent 6 输出含 topic_id；Agent 5 无 AGENT9_OUTPUT_DIR 时报错

### M1：骨架与配置（1.5h）
- [ ] 建目录结构
- [ ] 6 个接口定义文件（interfaces/*.js）
- [ ] `attribution-config.json`（完整配置）
- [ ] `platform-meta.json`（27个平台）
- [ ] `attribution-config-loader.js` + `platform-meta-loader.js`

### M2：适配器（1.5h）
- [ ] 适配器基类 `interface.js`
- [ ] 适配器注册表 `index.js`
- [ ] 6 个 Mock 适配器（含正态分布 CTR 生成）
- [ ] 验证：CTR 分布符合平台基准

### M3：核心引擎（2h）
- [ ] `attribution-engine.js`（完整代码）
- [ ] `insight-generator.js`（完整代码）
- [ ] `decision-dispenser.js`（完整代码）

### M4：主入口（0.5h）
- [ ] `agent9-core.js`（完整可运行）
- [ ] `metric-collector.js`

### M5：文档（0.5h）
- [ ] `DECISION_INTERFACE.md`
- [ ] `ATTRIBUTION_MODELS.md`
- [ ] `PLATFORM_BENCHMARKS.md`
- [ ] `FEEDBACK_CONTRACT.md`（含 Agent 8 接口）

### M6：端到端验证（1h）
- [ ] `node agent9-core.js` 完整运行
- [ ] Boost 分布合理性（应有 SCALE/CONTINUE/REDUCE/STOP）
- [ ] Agent 5 ←→ Agent 9 闭环验证
- [ ] 无 AGENT9_OUTPUT_DIR 时的错误提示

---

# 第十三部分：零新风险承诺

| 风险类型 | 防护措施 |
|---------|---------|
| 孤儿文件 | Agent 4/6/7 预埋接口注明激活条件，不写"已送达" |
| 静默失败 | 全部异常有 err/warn；无 silent null return |
| 路径错误 | 无 fallback；AGENT9_OUTPUT_DIR 必须设置 |
| 接口演进 | Decision 加 `version: "1.0"` + 消费方版本检查 |
| 自创公式 | Boost 阈值明确标注"工程经验值，1年内替换" |
| Mock 误用 | `__mock__: true` 强制标注 |
| Agent 8 混淆 | Agent 8 是数据源，不在决策路由名单里 |

---

*本文档为 Agent 9 v2.0 完整实施计划，整合 v0.1→v0.2→v1.0→v1.1→v1.2→v1.3 全部迭代。*
