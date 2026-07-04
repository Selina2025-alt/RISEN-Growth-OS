# Agent 9 v5.0 完整实施计划

> 版本：v5.0
> 状态：完整贯通最终版（整合 v0.1→v0.2→v1.0→v1.1→v1.2→v1.3→v2.0→v2.1→v2.2→v3.0→v4.0 全部技术细节）
> 目标：**看到这份文档，就知道所有技术细节，不需要翻任何旧版本**

---

# 第一部分：Agent 9 是什么

## 1.1 一句话定位

**Agent 9 是 RISEN 的"学习记忆中枢"——回答"什么真正有效、为什么有效、下一步改哪里"。**

Agent 9 是平台无关的分析推理引擎，输入表现数据 + 平台元数据，输出归因结果和优化决策，路由给对应 Agent。

## 1.2 在 RISEN 中的位置

```
Agent 5 选题 → Agent 6 写文章 → Agent 8 发布 → 各平台产生数据
                                                       ↓
                                             Agent 9 分析
                                                       ↓
                    ┌──────────────┬──────────────┬──────────────┐
                    ↓              ↓              ↓              ↓
                 Agent4        Agent5        Agent6        Agent7
                 策略          选题          内容          格式
               (预埋)        (闭环)       (预埋)       (预埋)
```

## 1.3 跨 Agent Content ID 链路（设计约束，必须遵守）

```
Agent 6 产出文章 → article 必须携带 topic_id（设计约束）
Agent 8 发布记录 → 必须携带 article_id + topic_id（设计约束）
Agent 9 采集指标 → 必须关联到 topic_id（归因前提）
```

## 1.4 决策回流路径

| 决策类型 | 目标 Agent | 触发条件 | 状态 |
|---------|-----------|---------|------|
| topic_boost | Agent 5 | Z-Score 归因结果 | ✅ 完整闭环 |
| strategy_shift | Agent 4 | 策略级洞察 | ⏳ 预埋 |
| content_adjust | Agent 6 | content_form 分析 | ⏳ 预埋 |
| format_suggest | Agent 7 | 格式洞察 | ⏳ 预埋 |

Agent 8 **不在路由名单里**（Agent 8 是数据源，不是接收方）。

---

# 第二部分：目录结构

```
risen-agent9/
├── agent9-core.js              # 主入口
│                              # 运行: node agent9-core.js [--date YYYY-MM-DD]
│                              # 环境变量: AGENT9_OUTPUT_DIR（必须设置）
│                              # 环境变量: NODE_ENV=production（生产模式）
├── skills/
│   ├── metric-collector.js     # Skill 1：采集指标
│   ├── attribution-engine.js    # Skill 2：归因计算
│   ├── insight-generator.js     # Skill 3：生成 Insight
│   └── decision-dispenser.js   # Skill 4：路由决策
├── lib/
│   ├── interfaces/             # 接口定义（Agent 间传递数据的格式）
│   │   ├── ArticlePerformance.js
│   │   ├── TopicBoost.js
│   │   ├── Insight.js
│   │   └── Decision.js
│   ├── attribution-config.json  # 归因配置（所有参数可配置）
│   ├── attribution-config-loader.js
│   ├── platform-meta.json      # 平台元数据（27 个 P0/P1 平台）
│   ├── platform-meta-loader.js
│   └── platform-adapters/      # 平台适配器（Mock，统一接口）
│       ├── interface.js        # 适配器基类
│       ├── index.js            # 适配器注册表
│       ├── wechat-gzh-mock.js
│       ├── zhihu-mock.js
│       ├── csdn-mock.js
│       ├── dev-to-mock.js
│       ├── github-mock.js      # 使用 Star Rate，非 CTR
│       └── linkedin-mock.js
├── output/                    # 由 AGENT9_OUTPUT_DIR 指定
│   ├── performances/          # ArticlePerformance 持久化
│   │   └── {YYYY-MM}/
│   │       └── {YYYY-MM-DD}/
│   │           └── {article_id}.json
│   ├── topic-boosts/
│   │   └── _latest/
│   │       └── {topic_id}.json   # Agent 5 读取这个
│   ├── insights/
│   │   └── {YYYY-MM-DD}/
│   │       └── {insight_id}.json
│   └── decisions/
│       └── from-agent9/
│           └── {agentId}/
│               ├── latest.json     # 最近5条（含 history 字段）
│               └── history/       # 历史存档
│                   └── {topic_id}.json
└── document/
    ├── AGENT9_PLAN_V5.0.md     # 本文档
    ├── AGENT9_SPEC.md
    ├── FEEDBACK_CONTRACT.md
    ├── DECISION_INTERFACE.md
    ├── ATTRIBUTION_MODELS.md
    └── PLATFORM_BENCHMARKS.md
```

---

# 第三部分：共享存储架构（关键设计约束）

## 3.1 SHARED_OUTPUT_DIR 方案

Agent 5 和 Agent 9 必须配置**相同的共享路径**：

```bash
# 两个 Agent 都要设置同样的环境变量
export SHARED_OUTPUT_DIR=/workspace/RISEN-OS/shared/agent9-output
export AGENT9_OUTPUT_DIR=${SHARED_OUTPUT_DIR}
```

**不接受的模式**：
- Agent 5 在 `/workspace/RISEN-OS/agent5/`
- Agent 9 在 `/workspace/risen-agent9/output/` → **两个目录互相读不到**

**验证方式**：

```javascript
// Agent 9 启动时检查
const dir = process.env.AGENT9_OUTPUT_DIR;
if (!dir) throw new Error('[Agent9] ❌ AGENT9_OUTPUT_DIR 未设置');
try { fs.accessSync(dir, fs.constants.W_OK); }
catch { throw new Error(`[Agent9] ❌ AGENT9_OUTPUT_DIR 不可写: ${dir}`); }
```

## 3.2 文件原子性

所有 JSON 写入使用 `fs.writeFileSync`（单实例安全），多实例场景未来扩展为 `fs.renameSync`。

---

# 第四部分：核心接口定义

## 4.1 ArticlePerformance（输入/输出最小数据单元）

```javascript
// lib/interfaces/ArticlePerformance.js

/**
 * 文章表现数据格式
 * 必填：article_id, topic_id, platform
 * 所有 Skill 之间用这个格式传递数据
 *
 * @typedef {Object} ArticleMetrics
 * @property {number} impressions   曝光量
 * @property {number} clicks       点击量
 * @property {number} ctr         clicks / impressions（自动计算）
 * @property {number} conversions  转化数
 * @property {number} cvr          conversions / clicks（自动计算）
 * @property {number} shares      转发数
 * @property {number} likes       点赞数
 * @property {number} comments    评论数
 * @property {number} avg_read_time 平均阅读时长（秒）
 *
 * @typedef {Object} ArticlePerformance
 * @property {string} article_id       ART-{timestamp}-{random4}
 * @property {string} topic_id        选题 ID（Agent 5 定义，Agent 6 必须写入）
 * @property {string} [direction_id]  方向 ID（可选）
 * @property {string} platform         平台 ID，同 platform-meta.json
 * @property {string} published_at    ISO 8601
 * @property {boolean} __mock__        必须标注：true=模拟/false=真实
 * @property {string} __source__       'mock' | 'platform_api' | 'agent8'
 * @property {ArticleMetrics} metrics
 * @property {Object} metadata
 * @property {string} metadata.content_form    '图文' | '视频' | '短视频' | '问答'
 * @property {string[]} metadata.topic_keywords
 */

/**
 * 构建合规的 ArticlePerformance
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
      impressions:   m.impressions  || 0,
      clicks:        m.clicks       || 0,
      ctr:         m.ctr          || (m.impressions > 0 ? m.clicks / m.impressions : 0),
      conversions:   m.conversions  || 0,
      cvr:          m.cvr          || (m.clicks > 0 ? m.conversions / m.clicks : 0),
      shares:        m.shares       || 0,
      likes:         m.likes        || 0,
      comments:       m.comments     || 0,
      avg_read_time:  m.avg_read_time || 0,
    },
    metadata: data.metadata || {}
  };
}

module.exports = { makeArticlePerformance };
```

## 4.2 TopicBoost（归因输出）

```javascript
// lib/interfaces/TopicBoost.js

/**
 * @typedef {Object} TopicBoost
 * @property {string} topic_id
 * @property {number} total_impressions
 * @property {number} total_clicks
 * @property {number} total_conversions
 * @property {number} avg_ctr
 * @property {number} avg_cvr
 * @property {number|null} z_score            Z-Score（多平台时为 null）
 * @property {number|null} platform_avg_ctr  平台平均 CTR（多平台时为 null，Consumer 必须检查）
 * @property {number|null} platform_std_ctr   平台 CTR 标准差（多平台时为 null）
 * @property {number|null} ratio_to_benchmark 仅用于无 stdCTR 的平台（GitHub Star Rate）
 * @property {string} model_used              'linear' | 'time_decay' | 'position_based'
 * @property {string} decision               'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP'
 * @property {number} boost_score           0.0 ~ 1.2
 * @property {number} confidence             0.45 ~ 0.95
 * @property {string[]} source_articles
 * @property {string[]} platforms
 * @property {string} computed_at
 * @property {boolean} __mock__
 * @property {boolean} __retrospective__    是否为回溯修正结果
 * @property {Object} __config__
 */
```

## 4.3 Insight（洞察输出）

```javascript
// lib/interfaces/Insight.js

/**
 * @typedef {Object} Insight
 * @property {string} id                 INS-{timestamp}-{random4}
 * @property {string} type               'topic_efficiency' | 'content_form_analysis'
 * @property {string} topic_id
 * @property {string} category           'topic' | 'content' | 'strategy'
 * @property {string} summary            一句话总结（Agent 5 可直接读）
 * @property {string} detail             详细分析（供人工复盘）
 * @property {string[]} platforms
 * @property {number} confidence         0.45 ~ 0.95
 * @property {string} recommended_action  'SCALE' | 'REDUCE' | 'REVIEW' | 'PROMOTE_FORM'
 * @property {string} target_agent       'agent4' | 'agent5' | 'agent6' | 'agent7'
 * @property {string} computed_at
 * @property {string} [best_form]       content_form_analysis 时有
 * @property {string} [worst_form]      content_form_analysis 时有
 */
```

## 4.4 Decision（决策输出）

```javascript
// lib/interfaces/Decision.js

/**
 * @typedef {Object} Decision
 * @property {string} id                 DEC-{YYYYMMDD}-{HHmm}-{ssss}
 * @property {string} type              'topic_boost' | 'content_adjust' | 'strategy_shift'
 * @property {string} source            固定：'agent9'
 * @property {string} target            'agent4' | 'agent5' | 'agent6' | 'agent7'
 * @property {string} topic_id
 * @property {string} decision           'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP'
 * @property {number} boost_score
 * @property {string} reason            原因说明
 * @property {number} confidence
 * @property {string} recommended_action
 * @property {string} created_at        ISO 8601（+08:00）
 * @property {string} deduplication_key  topic_id:decision（TopicBoost）
 *                                           topic_id:agent:action（Insight）
 * @property {boolean} __retrospective__
 * @property {string[]} history          该 topic 的历史决策链（最近5条）
 */

/**
 * 生成 Decision ID
 * 格式：DEC-{YYYYMMDD}-{HHmm}-{ssss}
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

# 第五部分：attribution-config.json（完整配置）

路径：`lib/attribution-config.json`

```json
{
  "_version": "1.2",
  "_updated": "2026-07-03T00:00:00+08:00",
  "_note": "Boost 阈值基于 Z-Score，详见 ATTRIBUTION_MODELS.md",

  "model": "linear",

  "models": {
    "linear": { "description": "权重均分，适合初期数据不足场景" },
    "time_decay": {
      "description": "近期内容权重更高，半衰期 7 天",
      "params": { "halfLifeDays": 7 }
    },
    "position_based": {
      "description": "首尾各 40% 权重",
      "_disclaimer": "40/20/40 是经验规则，非理论最优（见 ATTRIBUTION_MODELS.md 3.5）",
      "params": { "firstWeight": 0.4, "lastWeight": 0.4 }
    }
  },

  "boostThresholds": {
    "_methodology": "Z-Score = (avg_ctr - platform_avg_ctr) / platform_std_ctr",
    "_source": "工程经验值，1 年内替换为真实数据统计值",
    "zScoreThresholds": {
      "_note": "Z > 1.0 → 超过平台平均 1 个标准差，p≈0.16",
      "SCALE":    { "zScoreMin": 1.0,  "boost_score": 1.2 },
      "CONTINUE": { "zScoreMin": -0.5, "boost_score": 1.0 },
      "REDUCE":   { "zScoreMin": -1.5, "boost_score": 0.8 },
      "STOP":     { "zScoreMin": -999, "boost_score": 0.0 }
    },
    "_ratioFallback": {
      "_note": "仅用于无 stdCTR 的平台（GitHub Star Rate）",
      "SCALE":    { "ratio": 2.0, "boost_score": 1.2 },
      "CONTINUE": { "ratio": 1.0, "boost_score": 1.0 },
      "REDUCE":   { "ratio": 0.5, "boost_score": 0.8 }
    },
    "_new_topic": {
      "boost_score": 1.0,
      "decision": "CONTINUE",
      "_note": "样本数 < 5 篇时强制中性 Boost"
    },
    "_minSamplesForDecision": 5
  },

  "contentFormThresholds": {
    "_note": "v4.0 新增：对齐 Z-Score 标准",
    "_methodology": "ratio = best_ctr / worst_ctr，阈值 1.2 对应 Z≈0.32",
    "_reference": "见 ATTRIBUTION_MODELS.md 第 12.1 节",
    "minRatio": 1.2
  },

  "platformBenchmarks": {
    "_note": "avgCTR=平台平均 CTR，stdCTR=平台 CTR 标准差；来源见 PLATFORM_BENCHMARKS.md",
    "wechat_gzh": { "avgCTR": 0.025, "stdCTR": 0.015 },
    "zhihu":       { "avgCTR": 0.035, "stdCTR": 0.020 },
    "csdn":        { "avgCTR": 0.030, "stdCTR": 0.018 },
    "juejin":      { "avgCTR": 0.030, "stdCTR": 0.018 },
    "dev-to":      { "avgCTR": 0.020, "stdCTR": 0.012 },
    "linkedin":    { "avgCTR": 0.020, "stdCTR": 0.010 },
    "github":      { "avgCTR": null,  "stdCTR": null, "_note": "GitHub 用 Star Rate" }
  },

  "confidence": {
    "ranges": [
      { "minImpressions": 100000, "confidence": 0.95 },
      { "minImpressions": 50000,  "confidence": 0.85 },
      { "minImpressions": 10000,  "confidence": 0.75 },
      { "minImpressions": 5000,   "confidence": 0.65 },
      { "minImpressions": 1000,   "confidence": 0.55 },
      { "minImpressions": 0,     "confidence": 0.45 }
    ]
  },

  "runMode": {
    "_note": "区分开发模式和生产模式，避免 Mock 数据进入生产决策",
    "dev": { "NODE_ENV": "development", "allowMock": true,  "warnOnMock": true },
    "prod": { "NODE_ENV": "production",  "allowMock": false, "warnOnMock": false }
  }
}
```

---

# 第六部分：platform-meta.json（27 个平台完整列表）

路径：`lib/platform-meta.json`

```json
{
  "_version": "1.0",
  "_updated": "2026-07-02T00:00:00+08:00",
  "_note": "P0/P1 平台共 27 个；P2/P3/P4 按需扩展",
  "_meta_fields": {
    "platformId": "唯一标识，用于代码引用",
    "name": "显示名称",
    "region": "国内|海外",
    "priority": "P0=最高优先级，P1=高优先级",
    "geoWeight": "1-5，GEO 权重",
    "dataRefreshRate": "数据刷新频率",
    "minAttributionWindow": "最小归因等待时间",
    "ctrMetric": "CTR|StarRate|ReadRate，CTR 不适用时的替代指标"
  },
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
    { "platformId": "baidu_zhidao","name": "百度知道",    "region": "国内", "priority": "P1", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "baidu_jingyan","name": "百度经验",    "region": "国内", "priority": "P1", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "baidu_wenku", "name": "百度文库",     "region": "国内", "priority": "P1", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "ReadRate" },
    { "platformId": "yuque",       "name": "语雀",         "region": "国内", "priority": "P1", "geoWeight": 5, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "infoq",       "name": "InfoQ",        "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "36kr",        "name": "36氪",         "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "huxiu",       "name": "虎嗅",         "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "timemagazine","name": "钛媒体",       "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "blogcn",       "name": "博客园",       "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "oschina",     "name": "开源中国",     "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "segmentfault","name": "SegmentFault", "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "gitee",       "name": "Gitee",        "region": "国内", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "实时",  "minAttributionWindow": "2h",   "ctrMetric": "StarRate" },
    { "platformId": "zenn",        "name": "Zenn",         "region": "海外", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "qiita",       "name": "Qiita",        "region": "海外", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" },
    { "platformId": "note",        "name": "note.com",     "region": "海外", "priority": "P1", "geoWeight": 4, "dataRefreshRate": "天级",  "minAttributionWindow": "24h",  "ctrMetric": "CTR" }
  ]
}
```

---

# 第七部分：平台适配器统一接口

## 7.1 接口定义

```javascript
// lib/platform-adapters/interface.js

class PlatformAdapter {
  /**
   * 拉取指定时间范围内的文章表现数据
   * @param {string} platformId
   * @param {Object} options
   * @param {string} options.startDate  ISO 8601
   * @param {string} options.endDate    ISO 8601
   * @param {string[]} [options.topicIds]
   * @returns {Promise<ArticlePerformance[]>}
   */
  async fetchPerformances(platformId, options) {
    throw new Error('NOT_IMPLEMENTED');
  }

  async healthCheck() {
    return { ok: true, message: 'OK' };
  }
}

module.exports = { PlatformAdapter };
```

## 7.2 适配器注册表

```javascript
// lib/platform-adapters/index.js

const ADAPTERS = {
  wechat_gzh:  new (require('./wechat-gzh-mock'))(),
  zhihu:       new (require('./zhihu-mock'))(),
  csdn:        new (require('./csdn-mock'))(),
  'dev-to':    new (require('./dev-to-mock'))(),
  github:       new (require('./github-mock'))(),
  linkedin:    new (require('./linkedin-mock'))(),
};

module.exports = { ADAPTERS, listAdapters: () => Object.keys(ADAPTERS) };
```

## 7.3 Mock 适配器参数

各平台 Mock 适配器的 CTR 分布参数（高斯随机）：

| 平台 | 均值 CTR | 标准差 | 生成文章数 |
|------|---------|--------|-----------|
| 微信公众号 | 2.5% | 1.5% | 3-8 篇/次 |
| 知乎 | 3.5% | 2.0% | 3-8 篇/次 |
| CSDN | 3.0% | 1.8% | 3-8 篇/次 |
| Dev.to | 2.0% | 1.2% | 3-8 篇/次 |
| LinkedIn | 2.0% | 1.0% | 3-8 篇/次 |
| GitHub | Star Rate 0.5% | 0.3% | 2-5 篇/次 |

## 7.4 GitHub 适配器（Star Rate 专用）

```javascript
// lib/platform-adapters/github-mock.js

/**
 * GitHub 不适用 CTR，使用 Star Rate
 * impressions = README 浏览量，conversions = Stars
 * CTR 字段用 star_rate 填充（不是真正的 CTR）
 */
class GithubMockAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platformId = 'github';
    this.benchStarRate = 0.005;  // 行业平均 ≈ 0.5%
    this.stdStarRate = 0.003;
  }

  async fetchPerformances(platformId, { startDate, endDate, topicIds } = {}) {
    const count = 2 + Math.floor(Math.random() * 4);
    return Array.from({ length: count }, (_, i) => {
      const starRate = Math.max(0.0001, gaussRandom(this.benchStarRate, this.stdStarRate));
      const impressions = 1000 + Math.floor(Math.random() * 5000);
      const stars = Math.round(impressions * starRate);

      return makeArticlePerformance({
        article_id: `ART-${Date.now()}-${random4()}`,
        topic_id: topicIds ? topicIds[i % topicIds.length] : `TOPIC-${random4()}`,
        platform: 'github',
        published_at: randomDate(startDate, endDate),
        __mock__: true,
        __source__: 'mock',
        metrics: {
          impressions,
          clicks: impressions,        // 进入页面 = 点击
          ctr: starRate,             // 用 star rate 替代 CTR
          conversions: stars,          // Star 视为转化
          cvr: 1.0,
          shares: Math.floor(stars * 0.3),
          likes: stars,
          comments: Math.floor(stars * 0.1),
          avg_read_time: 30 + Math.floor(Math.random() * 120)
        },
        metadata: { content_form: '图文', topic_keywords: [] }
      });
    });
  }
}

// Box-Muller 高斯随机
function gaussRandom(mean, std) {
  const u = 1 - Math.random(), v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * std + mean;
}
function random4() { return Math.floor(1000 + Math.random() * 9000).toString(); }
function randomDate(start, end) {
  const s = new Date(start).getTime(), e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString();
}
```

---

# 第八部分：核心 Skill 实现代码

## 8.1 metric-collector.js（Skill 1）

```javascript
// skills/metric-collector.js

/**
 * Skill 1：指标采集器
 *
 * 职责：
 * 1. 从各平台适配器拉取 ArticlePerformance[]
 * 2. dev 模式允许 Mock，prod 模式过滤 Mock
 * 3. 归因窗口检查：等待平台最小归因时间后才纳入计算
 * 4. 采集后写入 performances/ 持久化（为回溯提供数据基础）
 */
class MetricCollector {
  constructor({ adapters, dateRange, platformMeta, config, outputDir }) {
    this.adapters = adapters;
    this.dateRange = dateRange;
    this.platformMeta = new Map(platformMeta.map(p => [p.platformId, p]));
    this.config = config;
    this.outputDir = outputDir || process.env.AGENT9_OUTPUT_DIR
      || path.join(__dirname, '..', 'output');
    this.runMode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
  }

  async collect() {
    const results = [];
    for (const [platformId, adapter] of Object.entries(this.adapters)) {
      const meta = this.platformMeta.get(platformId);

      if (meta && !this._isAttributionWindowMet(meta)) {
        console.log(`[Collector] ⏭  ${platformId}: 归因窗口未满，跳过`);
        continue;
      }

      try {
        let performances = await adapter.fetchPerformances(platformId, this.dateRange);

        if (this.runMode === 'prod') {
          const before = performances.length;
          performances = performances.filter(p => !p.__mock__);
          if (performances.length < before) {
            console.error(`[Collector] ❌ [prod] ${platformId}: 过滤 ${before - performances.length} 条 Mock`);
          }
        } else if (performances.some(p => p.__mock__)) {
          console.warn(`[Collector] ⚠️  [dev] ${platformId}: 使用 Mock 数据`);
        }

        results.push(...performances);
        console.log(`[Collector] ✅ ${platformId}: +${performances.length} 条`);

        // v4.0：写入 performances 持久化
        if (performances.length > 0) this._writePerformances(performances);
      } catch (err) {
        console.error(`[Collector] ❌ ${platformId}: ${err.message}`);
      }
    }
    return results;
  }

  /**
   * performances 持久化
   * 路径：output/performances/{YYYY-MM}/{YYYY-MM-DD}/{article_id}.json
   * v4.0 新增：为回溯修正提供历史数据基础
   */
  _writePerformances(performances) {
    const dateDir = new Date().toISOString().split('T')[0];     // YYYY-MM-DD
    const monthDir = dateDir.slice(0, 7);                   // YYYY-MM
    const dir = path.join(this.outputDir, 'performances', monthDir, dateDir);
    fs.mkdirSync(dir, { recursive: true });
    for (const perf of performances) {
      const file = path.join(dir, `${perf.article_id}.json`);
      fs.writeFileSync(file, JSON.stringify(perf, null, 2));
    }
    console.log(`[Collector] 💾 写入 ${performances.length} 条 performances → ${dir}/`);
  }

  _isAttributionWindowMet(meta) {
    const hours = this._parseWindow(meta.minAttributionWindow);
    const elapsed = (new Date(this.dateRange.endDate) - new Date(this.dateRange.startDate)) / 36e5;
    return elapsed >= hours;
  }

  _parseWindow(window) {
    if (!window) return 24;
    if (window.endsWith('h')) return parseInt(window);
    if (window.endsWith('d')) return parseInt(window) * 24;
    return 24;
  }
}
```

## 8.2 attribution-engine.js（Skill 2，核心）

```javascript
// skills/attribution-engine.js

/**
 * Skill 2：归因引擎
 *
 * 核心设计：
 * 1. Z-Score 标准化：跨平台可比较的归因计算
 * 2. 最小样本保护：< 5 篇仅 CONTINUE
 * 3. 回溯修正：达到样本量后从 performances/ 读取历史数据重新计算
 * 4. GitHub 平台特定处理（Star Rate，非 CTR）
 */
class AttributionEngine {
  constructor({ config, platformMeta, outputDir }) {
    this.config = config;
    this.platformMeta = new Map(platformMeta.map(p => [p.platformId, p]));
    this.benchmarks = config.platformBenchmarks;
    this.thresholds = config.boostThresholds;
    this.confidenceRanges = config.confidence.ranges;
    this.outputDir = outputDir || process.env.AGENT9_OUTPUT_DIR
      || path.join(__dirname, '..', 'output');
  }

  async attribute(performances) {
    if (!performances || performances.length === 0) return [];
    const byTopic = this._groupBy(performances, 'topic_id');
    return Object.entries(byTopic)
      .map(([topicId, perfs]) => this._computeTopicBoost(topicId, perfs))
      .filter(b => b.source_articles.length > 0);
  }

  _computeTopicBoost(topicId, perfs) {
    const totalImpressions = perfs.reduce((s, p) => s + p.metrics.impressions, 0);
    const totalClicks     = perfs.reduce((s, p) => s + p.metrics.clicks, 0);
    const totalConversions = perfs.reduce((s, p) => s + p.metrics.conversions, 0);
    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgCVR = totalClicks > 0 ? totalConversions / totalClicks : 0;

    const zScoreResult = this._calcZScore(perfs, avgCTR);
    const boost = this._calcBoostDecision(zScoreResult, perfs.length, topicId, perfs);
    const confidence = this._calcConfidence(totalImpressions);

    return {
      topic_id: topicId,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      avg_ctr: parseFloat(avgCTR.toFixed(4)),
      avg_cvr: parseFloat(avgCVR.toFixed(4)),
      z_score: zScoreResult.zScore,
      platform_avg_ctr: zScoreResult.usedAvgCTR,
      platform_std_ctr: zScoreResult.usedStdCTR,
      ratio_to_benchmark: zScoreResult.ratio,
      model_used: this.config.model,
      decision: boost.decision,
      boost_score: boost.score,
      confidence,
      source_articles: perfs.map(p => p.article_id),
      platforms: [...new Set(perfs.map(p => p.platform))],
      computed_at: new Date().toISOString(),
      __mock__: perfs.some(p => p.__mock__),
      __retrospective__: boost.retrospective || false,
      __config__: { model: this.config.model, config_version: this.config._version }
    };
  }

  /**
   * Z-Score 标准化
   *
   * 单平台：Z = (CTR - avgCTR) / stdCTR
   * 多平台：Z = Σ(Z_i × impressions_i) / Σ(impressions_i)，以曝光量为权重
   *
   * 多平台时 usedAvgCTR=null（无法用单一基准代表多平台），
   * Consumer 必须检查 null。
   */
  _calcZScore(perfs, avgCTR) {
    const withStd = perfs.filter(p => {
      const bench = this.benchmarks[p.platform];
      return bench?.avgCTR !== null && bench?.stdCTR !== null && bench?.stdCTR > 0;
    });

    if (withStd.length > 0) {
      let totalZ = 0, totalWeight = 0;
      for (const perf of withStd) {
        const bench = this.benchmarks[perf.platform];
        const z = (perf.metrics.ctr - bench.avgCTR) / bench.stdCTR;
        totalZ += z * perf.metrics.impressions;
        totalWeight += perf.metrics.impressions;
      }
      if (totalWeight > 0) {
        const weightedZ = totalZ / totalWeight;
        const uniquePlatforms = [...new Set(withStd.map(p => p.platform))];
        const isSingle = uniquePlatforms.length === 1;
        const singleBench = isSingle ? this.benchmarks[uniquePlatforms[0]] : null;
        return {
          zScore: parseFloat(weightedZ.toFixed(3)),
          usedAvgCTR: isSingle ? singleBench.avgCTR : null,
          usedStdCTR: isSingle ? singleBench.stdCTR : null,
          ratio: null
        };
      }
    }

    return this._calcRatioFallback(perfs, avgCTR);
  }

  _calcRatioFallback(perfs, avgCTR) {
    let totalRatio = 0, count = 0;
    for (const perf of perfs) {
      const bench = this.benchmarks[perf.platform];
      if (!bench || bench.avgCTR === null) continue;
      totalRatio += (perf.metrics.ctr || 0) / bench.avgCTR;
      count++;
    }
    const defaultBench = 0.02;
    return {
      zScore: null, usedAvgCTR: null, usedStdCTR: null,
      ratio: parseFloat(count > 0
        ? (totalRatio / count).toFixed(3)
        : (avgCTR / defaultBench).toFixed(3))
    };
  }

  _calcBoostDecision(zScoreResult, articleCount, topicId, perfs) {
    const minSamples = this.thresholds._new_topic._minSamplesForDecision || 5;
    if (articleCount < minSamples) return { decision: 'CONTINUE', score: 1.0 };

    // 尝试回溯修正
    const retrospective = this._tryRetrospective(topicId, articleCount, perfs);
    if (retrospective) return retrospective;

    if (zScoreResult.zScore !== null) return this._calcBoostFromZScore(zScoreResult.zScore);
    return this._calcBoostFromRatio(zScoreResult.ratio);
  }

  _calcBoostFromZScore(z) {
    const t = this.thresholds.zScoreThresholds;
    if (z >= t.SCALE.zScoreMin)    return { decision: 'SCALE',   score: t.SCALE.boost_score };
    if (z >= t.CONTINUE.zScoreMin) return { decision: 'CONTINUE', score: t.CONTINUE.boost_score };
    if (z >= t.REDUCE.zScoreMin)  return { decision: 'REDUCE',   score: t.REDUCE.boost_score };
    return { decision: 'STOP', score: 0.0 };
  }

  _calcBoostFromRatio(ratio) {
    const t = this.thresholds._ratioFallback;
    if (ratio >= t.SCALE.ratio)    return { decision: 'SCALE',   score: t.SCALE.boost_score };
    if (ratio >= t.CONTINUE.ratio) return { decision: 'CONTINUE', score: t.CONTINUE.boost_score };
    if (ratio >= t.REDUCE.ratio)   return { decision: 'REDUCE',   score: t.REDUCE.boost_score };
    return { decision: 'STOP', score: 0.0 };
  }

  /**
   * 回溯修正
   *
   * 触发条件：当前批次 articleCount >= 5
   * 机制：
   * 1. 读取历史 TopicBoost（_latest/{topicId}.json）
   * 2. 从 performances/ 目录加载该 topic 所有历史 ArticlePerformance
   * 3. 合并历史 + 当前批次，重新计算 Boost
   * 4. 若结果改变，标记 __retrospective__: true
   */
  _tryRetrospective(topicId, currentCount, currentPerfs) {
    const histBoostPath = path.join(this.outputDir, 'topic-boosts', '_latest', `${topicId}.json`);
    if (!fs.existsSync(histBoostPath)) return null;

    let histBoost;
    try { histBoost = JSON.parse(fs.readFileSync(histBoostPath, 'utf8')); }
    catch { return null; }

    if (histBoost.__retrospective__) return null;

    const totalCount = (histBoost.source_articles?.length || 0) + currentCount;
    if (totalCount < 5) return null;

    // 从 performances/ 加载历史数据
    const allPerfs = this._loadHistoricalPerformances(topicId);
    if (allPerfs.length < 5) return null;

    // 去重
    const currentIds = new Set(currentPerfs.map(p => p.article_id));
    const histOnly = allPerfs.filter(p => !currentIds.has(p.article_id));
    if (histOnly.length === 0) return null;

    // 合并全部数据重新计算
    const combined = [...histOnly, ...currentPerfs];
    const totalImpressions = combined.reduce((s, p) => s + p.metrics.impressions, 0);
    const totalClicks = combined.reduce((s, p) => s + p.metrics.clicks, 0);
    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const zScoreResult = this._calcZScore(combined, avgCTR);

    let decision, score;
    if (zScoreResult.zScore !== null) {
      const r = this._calcBoostFromZScore(zScoreResult.zScore);
      decision = r.decision; score = r.score;
    } else {
      const r = this._calcBoostFromRatio(zScoreResult.ratio);
      decision = r.decision; score = r.score;
    }

    if (decision === histBoost.decision && score === histBoost.boost_score) return null;

    console.log(`[Engine] 🔄 回溯修正：${topicId} ${histBoost.decision}→${decision}`);
    return { decision, score, retrospective: true };
  }

  /**
   * 从 performances/ 目录加载某 topic 的全部历史数据
   * 遍历所有 YYYY-MM/YYYY-MM-DD/ 子目录
   */
  _loadHistoricalPerformances(topicId) {
    const root = path.join(this.outputDir, 'performances');
    if (!fs.existsSync(root)) return [];
    const results = [];
    try {
      const monthDirs = fs.readdirSync(root);
      for (const month of monthDirs) {
        const monthPath = path.join(root, month);
        if (!fs.statSync(monthPath).isDirectory()) continue;
        const dayDirs = fs.readdirSync(monthPath);
        for (const day of dayDirs) {
          const dayPath = path.join(monthPath, day);
          if (!fs.statSync(dayPath).isDirectory()) continue;
          const files = fs.readdirSync(dayPath).filter(f => f.endsWith('.json'));
          for (const file of files) {
            try {
              const perf = JSON.parse(fs.readFileSync(path.join(dayPath, file), 'utf8'));
              if (perf.topic_id === topicId) results.push(perf);
            } catch { /* 忽略损坏文件 */ }
          }
        }
      }
    } catch { /* performances 目录不存在 */ }
    return results;
  }

  _calcConfidence(totalImpressions) {
    for (const range of this.confidenceRanges) {
      if (totalImpressions >= range.minImpressions) return range.confidence;
    }
    return 0.45;
  }

  _groupBy(arr, key) {
    return arr.reduce((g, item) => {
      const val = item[key];
      (g[val] = g[val] || []).push(item);
      return g;
    }, {});
  }
}
```

## 8.3 insight-generator.js（Skill 3）

```javascript
// skills/insight-generator.js

/**
 * Skill 3：Insight 生成器
 *
 * 支持两种 Insight 类型：
 * 1. topic_efficiency：选题效果洞察（target: agent5）
 *    - SCALE/CONTINUE/REDUCE/STOP 均可生成
 *    - CONTINUE 时 confidence < 0.65 则不生成（避免噪音）
 * 2. content_form_analysis：内容形式差异洞察（target: agent6）
 *    - 同一 Topic 下图文/视频/问答等不同形式的 CTR 差异
 *    - ratio >= 1.2 时生成（对齐 Z-Score 标准）
 */
class InsightGenerator {
  constructor({ config, platformMeta }) {
    this.config = config;
    this.platformMeta = platformMeta;
    this.contentFormThreshold = config.contentFormThresholds?.minRatio || 1.2;
  }

  async generate({ topicBoosts, performances }) {
    const insights = [];
    const perfMap = new Map(performances.map(p => [p.article_id, p]));
    for (const boost of topicBoosts) {
      const t = this._genTopicEfficiencyInsight(boost);
      if (t) insights.push(t);
      const f = this._genContentFormInsights(boost, perfMap);
      insights.push(...f);
    }
    return insights;
  }

  _genTopicEfficiencyInsight(boost) {
    if (boost.decision === 'CONTINUE' && boost.confidence < 0.65) return null;
    const messages = {
      SCALE:   `CTR 是平台基准的 ${(boost.z_score || boost.ratio_to_benchmark || 0).toFixed(1)}x，建议扩大产出`,
      CONTINUE:'CTR 接近平台基准，继续观察',
      REDUCE:  `CTR 低于平台基准，建议减少投入`,
      STOP:    `CTR 远低于平台基准，暂停该选题`
    };
    return {
      id: `INS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'topic_efficiency',
      topic_id: boost.topic_id,
      category: 'topic',
      summary: messages[boost.decision],
      detail: `CTR=${(boost.avg_ctr*100).toFixed(2)}%，Z=${(boost.z_score||0).toFixed(2)}，` +
              `总曝光=${boost.total_impressions.toLocaleString()}，` +
              `置信度=${boost.confidence.toFixed(2)}，` +
              `${boost.source_articles.length}篇内容` +
              (boost.__retrospective__ ? '（回溯修正）' : ''),
      platforms: boost.platforms,
      confidence: boost.confidence,
      recommended_action: boost.decision === 'CONTINUE' ? 'REVIEW' : boost.decision,
      target_agent: 'agent5',
      computed_at: new Date().toISOString()
    };
  }

  _genContentFormInsights(boost, perfMap) {
    const insights = [];
    const perfs = boost.source_articles.map(id => perfMap.get(id)).filter(Boolean);
    const byForm = {};
    for (const perf of perfs) {
      const form = perf.metadata?.content_form || '未知';
      (byForm[form] = byForm[form] || []).push(perf);
    }
    const forms = Object.entries(byForm);
    if (forms.length < 2) return insights;

    let best = null, worst = null, bestCTR = -1, worstCTR = 1;
    for (const [form, formPerfs] of forms) {
      if (formPerfs.length < 1) continue;
      const avgCTR = formPerfs.reduce((s, p) => s + p.metrics.ctr, 0) / formPerfs.length;
      if (avgCTR > bestCTR) { bestCTR = avgCTR; best = form; }
      if (avgCTR < worstCTR) { worstCTR = avgCTR; worst = form; }
    }

    if (best && worst && best !== worst) {
      const ratio = bestCTR / worstCTR;
      if (ratio >= this.contentFormThreshold) {
        insights.push({
          id: `INS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'content_form_analysis',
          topic_id: boost.topic_id,
          category: 'content',
          summary: `「${best}」CTR 高 ${((ratio-1)*100).toFixed(0)}% 于「${worst}」`,
          detail: `「${best}」=${(bestCTR*100).toFixed(2)}%，「${worst}」=${(worstCTR*100).toFixed(2)}%，` +
                  `比值=${ratio.toFixed(2)}，阈值=${this.contentFormThreshold}（对齐Z-Score）`,
          platforms: boost.platforms,
          confidence: Math.min(boost.confidence, 0.75),
          recommended_action: 'PROMOTE_FORM',
          best_form: best,
          worst_form: worst,
          target_agent: 'agent6',
          computed_at: new Date().toISOString()
        });
      }
    }
    return insights;
  }
}
```

## 8.4 decision-dispenser.js（Skill 4）

```javascript
// skills/decision-dispenser.js

/**
 * Skill 4：决策下发器
 *
 * 核心设计：
 * 1. dev/prod 模式：prod 模式拒绝 __mock__: true 的数据
 * 2. 去重：deduplication_key = topic_id:decision（TopicBoost）
 *                              topic_id:agent:action（Insight）
 * 3. 同 Topic 可同时存在 SCALE 和 REDUCE（不去重双向信号）
 * 4. 历史链：latest.json 保留最近5条，history/{topic_id}.json 追加存档（最多20条）
 */
class DecisionDispenser {
  constructor({ config, outputDir }) {
    this.config = config;
    this.outputDir = outputDir || process.env.AGENT9_OUTPUT_DIR
      || path.join(__dirname, '..', 'output');
    this.runMode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
  }

  async dispatch({ topicBoosts, insights }) {
    const filtered = this._filterByMode(topicBoosts);
    const decisions = [];
    for (const boost of filtered) decisions.push(this._boostToDecision(boost));
    for (const insight of insights) {
      if (insight.target_agent && insight.target_agent !== 'agent5') {
        decisions.push(this._insightToDecision(insight));
      }
    }
    const unique = this._deduplicate(decisions);
    const byAgent = {};
    for (const d of unique) {
      if (!TARGET_AGENTS[d.target]) continue;
      (byAgent[d.target] = byAgent[d.target] || []).push(d);
    }
    for (const [agentId, agentDecisions] of Object.entries(byAgent)) {
      await this._writeDecisionFile(agentId, agentDecisions);
    }
  }

  _filterByMode(items) {
    if (this.runMode !== 'prod') return items;
    return items.filter(item => {
      if (item.__mock__) {
        console.error(`[Dispenser] ❌ [prod] 拒绝 Mock: ${item.topic_id}`);
        return false;
      }
      return true;
    });
  }

  /**
   * 去重逻辑
   * 格式：
   * - TopicBoost：deduplication_key = "topic_id:decision"
   * - Insight：  deduplication_key = "topic_id:agent:action"
   *
   * 设计：
   * - 同一 topic_id 可同时有 SCALE 和 REDUCE（不去重）
   * - 同一 key 保留时间最新
   */
  _deduplicate(decisions) {
    const seen = new Map();
    for (const d of decisions) {
      const existing = seen.get(d.deduplication_key);
      if (!existing) { seen.set(d.deduplication_key, d); continue; }
      if (new Date(d.created_at) > new Date(existing.created_at)) seen.set(d.deduplication_key, d);
    }
    return Array.from(seen.values());
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
      created_at: new Date().toISOString(),
      deduplication_key: `${boost.topic_id}:${boost.decision}`,
      __retrospective__: boost.__retrospective__ || false,
      history: []
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
      created_at: new Date().toISOString(),
      deduplication_key: `${insight.topic_id}:${insight.target_agent}:${insight.recommended_action}`,
      __retrospective__: false,
      history: []
    };
  }

  /**
   * 写 Decision 文件
   *
   * 1. latest.json：写入当前决策，追加模式（保留最近5条）
   * 2. history/{topic_id}.json：追加存档（最多20条）
   * 3. 每条 decision 的 history 字段填充该 topic 的最近5条历史
   */
  async _writeDecisionFile(agentId, decisions) {
    const dir = path.join(this.outputDir, 'decisions', 'from-agent9', agentId);
    fs.mkdirSync(dir, { recursive: true });

    // 读取历史 latest
    const latestPath = path.join(dir, 'latest.json');
    let existing = [];
    if (fs.existsSync(latestPath)) {
      try { existing = JSON.parse(fs.readFileSync(latestPath, 'utf8')).decisions || []; }
      catch { existing = []; }
    }

    // 合并：同 key 保留最新，旧的进入 history
    const merged = new Map();
    for (const d of existing) merged.set(d.deduplication_key, d);
    for (const d of decisions) {
      if (merged.has(d.deduplication_key)) {
        this._appendHistory(agentId, merged.get(d.deduplication_key));
      }
      merged.set(d.deduplication_key, d);
    }

    // latest.json 保留最近 5 条
    const latestDecisions = Array.from(merged.values()).slice(-5);
    for (const d of latestDecisions) {
      d.history = this._loadHistory(agentId, d.topic_id);
    }

    const data = {
      version: '1.2',
      decisions: latestDecisions,
      metadata: {
        interface_version: '1.2',
        total_decisions: latestDecisions.length,
        computed_at: new Date().toISOString(),
        run_mode: this.runMode
      }
    };
    fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
    console.log(`[Dispenser] ✅ → ${agentId}: ${latestDecisions.length} 条（含历史链）`);
  }

  _appendHistory(agentId, decision) {
    const histDir = path.join(this.outputDir, 'decisions', 'from-agent9', agentId, 'history');
    fs.mkdirSync(histDir, { recursive: true });
    const histPath = path.join(histDir, `${decision.topic_id}.json`);
    let history = [];
    if (fs.existsSync(histPath)) {
      try { history = JSON.parse(fs.readFileSync(histPath, 'utf8')); }
      catch { history = []; }
    }
    history.push({ ...decision, archived_at: new Date().toISOString() });
    if (history.length > 20) history = history.slice(-20);
    fs.writeFileSync(histPath, JSON.stringify(history, null, 2));
  }

  _loadHistory(agentId, topicId) {
    const histPath = path.join(this.outputDir, 'decisions', 'from-agent9', agentId, 'history', `${topicId}.json`);
    if (!fs.existsSync(histPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(histPath, 'utf8')).slice(-5);
    } catch { return []; }
  }
}

const TARGET_AGENTS = { agent4: true, agent5: true, agent6: true, agent7: true };
```

---

# 第九部分：agent9-core.js（主入口）

```javascript
// agent9-core.js v5.0

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.env.AGENT9_OUTPUT_DIR
  || path.join(__dirname, 'output');   // ✅ v3.0 H1 修复：补上右括号
const RUN_MODE = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

const { loadPlatformMeta } = require('./lib/platform-meta-loader');
const { loadAttributionConfig } = require('./lib/attribution-config-loader');
const { ADAPTERS } = require('./lib/platform-adapters');
const MetricCollector = require('./skills/metric-collector');
const AttributionEngine = require('./skills/attribution-engine');
const InsightGenerator = require('./skills/insight-generator');
const DecisionDispenser = require('./skills/decision-dispenser');

async function main() {
  const startTime = Date.now();
  const runDate = process.argv.includes('--date')
    ? process.argv[process.argv.indexOf('--date') + 1]
    : new Date().toISOString().split('T')[0];

  console.log(`\n[Agent9] 🚀 启动 (run=${runDate}, mode=${RUN_MODE})`);
  if (RUN_MODE === 'prod') console.log('[Agent9] ⚠️  生产模式：拒绝 Mock 数据');
  console.log(`[Agent9] 📁 OUTPUT_DIR: ${OUTPUT_DIR}`);

  // 路径检查
  if (!fs.existsSync(OUTPUT_DIR)) {
    if (RUN_MODE === 'prod') throw new Error(`[Agent9] ❌ 生产模式：OUTPUT_DIR 不存在: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`[Agent9] ℹ️  已创建 OUTPUT_DIR`);
  }
  try { fs.accessSync(OUTPUT_DIR, fs.constants.W_OK); }
  catch { throw new Error(`[Agent9] ❌ OUTPUT_DIR 不可写: ${OUTPUT_DIR}`); }

  const config = loadAttributionConfig();
  const platformMeta = loadPlatformMeta();

  // Step 1: 采集
  console.log('\n[Agent9] 📥 Step 1: 指标采集');
  const dateRange = {
    startDate: getAttributionWindowStart(runDate, platformMeta),
    endDate: `${runDate}T23:59:59+08:00`
  };
  const collector = new MetricCollector({ adapters: ADAPTERS, dateRange, platformMeta, config, outputDir: OUTPUT_DIR });
  const performances = await collector.collect();
  console.log(`[Agent9] ✅ 采集完成：${performances.length} 条`);

  if (performances.length === 0) {
    console.warn('[Agent9] ⚠️  无数据，归因跳过');
    return;
  }

  // Step 2: 归因
  console.log('\n[Agent9] 🧠 Step 2: 归因计算');
  const engine = new AttributionEngine({ config, platformMeta, outputDir: OUTPUT_DIR });
  const topicBoosts = await engine.attribute(performances);
  const dist = { SCALE: 0, CONTINUE: 0, REDUCE: 0, STOP: 0 };
  topicBoosts.forEach(b => dist[b.decision]++);
  console.log(`[Agent9] 📊 分布: SCALE=${dist.SCALE} CONTINUE=${dist.CONTINUE} REDUCE=${dist.REDUCE} STOP=${dist.STOP}`);
  writeTopicBoosts(topicBoosts);

  // Step 3: Insight
  console.log('\n[Agent9] 💡 Step 3: Insight 生成');
  const generator = new InsightGenerator({ config, platformMeta });
  const insights = await generator.generate({ topicBoosts, performances });
  writeInsights(insights);

  // Step 4: 决策下发
  console.log('\n[Agent9] 📤 Step 4: 决策下发');
  const dispenser = new DecisionDispenser({ config, outputDir: OUTPUT_DIR });
  await dispenser.dispatch({ topicBoosts, insights });

  console.log(`\n[Agent9] ✅ 完成，耗时: ${Date.now() - startTime}ms`);
}

function getAttributionWindowStart(runDate, platformMeta) {
  let maxHours = 24;
  for (const p of platformMeta) {
    const h = parseWindow(p.minAttributionWindow);
    if (h > maxHours) maxHours = h;
  }
  const start = new Date(runDate);
  start.setDate(start.getDate() - Math.min(Math.ceil(maxHours / 24), 7));
  return start.toISOString().split('T')[0] + 'T00:00:00+08:00';
}

function parseWindow(w) {
  if (!w) return 24;
  if (w.endsWith('h')) return parseInt(w);
  if (w.endsWith('d')) return parseInt(w) * 24;
  return 24;
}

function writeTopicBoosts(topicBoosts) {
  const dir = path.join(OUTPUT_DIR, 'topic-boosts', '_latest');
  fs.mkdirSync(dir, { recursive: true });
  topicBoosts.forEach(b => {
    fs.writeFileSync(path.join(dir, `${b.topic_id}.json`), JSON.stringify(b, null, 2));
  });
}

function writeInsights(insights) {
  const today = new Date().toISOString().split('T')[0];
  const dir = path.join(OUTPUT_DIR, 'insights', today);
  fs.mkdirSync(dir, { recursive: true });
  insights.forEach(i => {
    fs.writeFileSync(path.join(dir, `${i.id}.json`), JSON.stringify(i, null, 2));
  });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'insights', 'latest.json'),
    JSON.stringify({ total: insights.length, computed_at: new Date().toISOString() }, null, 2)
  );
}

main().catch(err => { console.error('[Agent9] ❌', err.message); process.exit(1); });
```

---

# 第十部分：Agent 8 接口契约

## 10.1 Agent 8 产出数据（Agent 9 读取）

```
{AZENT8_OUTPUT_DIR}/publications/{YYYY-MM}/PUB-{publication_id}.json
```

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

## 10.2 Agent 9 读取方式

Agent 9 的 metric-collector 在真实 API 模式下读取路径：

```javascript
const pubFiles = fs.readdirSync(`${AGENT8_OUTPUT_DIR}/publications/${YYYY-MM}/`)
  .filter(f => f.startsWith('PUB-') && f.endsWith('.json'));
```

---

# 第十一部分：Agent 5 / Agent 6 前置修复

## M0.1：Agent 6 article 输出加 topic_id

文件：`/workspace/RISEN-OS/agent6/agent6-core.js`

```javascript
// article 对象构建处，新增 2 行
const article = {
  article_id: generateArticleId(),
  topic_id: topicBrief.topic_id,                    // ← 新增
  direction_id: topicBrief.direction_id || null,  // ← 新增
  title: topicBrief.topic_title,
  // ...
};
```

## M0.2：Agent 5 loadFeedbackFromAgent9()

文件：`/workspace/RISEN-OS/agent5/agent5-core.js`

```javascript
/**
 * 从 Agent 9 读取 TopicBoost 数据
 * 依赖：AGENT9_OUTPUT_DIR 环境变量（必须与 Agent 9 配置相同路径）
 */
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR;
  if (!dir) {
    console.error('[Agent5] ❌ AGENT9_OUTPUT_DIR 未设置');
    console.error('[Agent5] ℹ️  设置方式: export AGENT9_OUTPUT_DIR=/path/to/shared/agent9-output');
    return null;
  }
  const latestDir = dir + '/topic-boosts/_latest/';
  let files;
  try { files = fs.readdirSync(latestDir).filter(f => f.endsWith('.json')); }
  catch (e) {
    console.warn(`[Agent5] ⚠️  Agent9 数据目录不存在: ${latestDir}`);
    return null;
  }
  if (files.length === 0) return null;

  return files.map(f => {
    const b = JSON.parse(fs.readFileSync(latestDir + f, 'utf8'));
    return {
      topic_id: b.topic_id,
      engagement_score: b.boost_score,
      decision: b.decision,
      confidence: b.confidence,
      data_source: '__agent9__',
      computed_at: b.computed_at,
      __retrospective__: b.__retrospective__ || false
    };
  });
}
```

---

# 第十二部分：决策接口文档

## 12.1 文件路径

```
${AGENT9_OUTPUT_DIR}/decisions/from-agent9/{agentId}/
├── latest.json          # 最近5条（含 history 字段）
└── history/
    └── {topic_id}.json  # 该 topic 的历史存档（最多20条）
```

## 12.2 latest.json 格式（v1.2）

```json
{
  "version": "1.2",
  "decisions": [
    {
      "id": "DEC-20260703-1145-3847",
      "type": "topic_boost",
      "source": "agent9",
      "target": "agent5",
      "topic_id": "TOPIC-001",
      "decision": "SCALE",
      "boost_score": 1.2,
      "reason": "CTR 显著高于平台基准，建议扩大该选题的内容产出",
      "confidence": 0.75,
      "recommended_action": "SCALE",
      "created_at": "2026-07-03T11:45:00+08:00",
      "deduplication_key": "TOPIC-001:SCALE",
      "__retrospective__": false,
      "history": [
        { "decision": "CONTINUE", "created_at": "...", "archived_at": "..." }
      ]
    }
  ],
  "metadata": {
    "interface_version": "1.2",
    "total_decisions": 1,
    "computed_at": "2026-07-03T11:45:00+08:00",
    "run_mode": "dev"
  }
}
```

## 12.3 Consumer 读取注意

```javascript
// 必须检查 version
if (!data.metadata?.interface_version?.startsWith('1.')) {
  console.warn('[Consumer] ⚠️  Decision 接口版本不兼容');
}

// 多平台时 platform_avg_ctr 为 null，必须处理
if (boost.platform_avg_ctr === null) {
  // 使用 z_score 或 ratio_to_benchmark，不要直接用 platform_avg_ctr
}
```

## 12.4 激活条件

| Agent | 类型 | 激活条件 |
|-------|------|---------|
| Agent 5 | topic_boost | ✅ 直接可用 |
| Agent 6 | content_adjust | 等 Agent 6 实现消费逻辑 |
| Agent 4 | strategy_shift | 等 Agent 4 SPEC 更新 |
| Agent 7 | format_suggest | 等 Agent 7 完整定义 |

---

# 第十三部分：归因模型方法论摘要

详见 `ATTRIBUTION_MODELS.md`，核心：

**Z-Score 标准化**：`Z = (CTR - platform_avg) / platform_std`

| Z-Score | 决策 | 含义 |
|---------|------|------|
| Z ≥ 1.0 | SCALE | 超过平台平均 1 个标准差，p≈0.16 |
| Z ≥ -0.5 | CONTINUE | 在平均附近 |
| Z ≥ -1.5 | REDUCE | 低于平台平均 1.5 个标准差 |
| Z < -1.5 | STOP | 极端差 |

**content_form 阈值**：ratio ≥ 1.2，对应 Z≈0.32，与 Z-Score 体系对齐（详见 ATTRIBUTION_MODELS.md 12.1 节）

**Position-Based 40/20/40**：经验规则，非理论最优，仅作实验对比用

**最小样本**：< 5 篇仅 CONTINUE；达到 5 篇时回溯计算

---

# 第十四部分：里程碑

### M0：前置修复（0.5h）
- [ ] Agent 6 article 加 `topic_id` + `direction_id`
- [ ] Agent 5 加 `loadFeedbackFromAgent9()`
- [ ] 验证：共享路径配置正确，Agent 5 能读到 Agent 9 数据

### M1：骨架与配置（1.5h）
- [ ] 建目录结构
- [ ] 6 个接口定义文件
- [ ] `attribution-config-loader.js`
- [ ] `platform-meta-loader.js`
- [ ] `attribution-config.json`（v1.2）
- [ ] `platform-meta.json`（27 个平台）

### M2：适配器（1.5h）
- [ ] 适配器基类 + 注册表
- [ ] 6 个 Mock 适配器（含 github-mock Star Rate 版）

### M3：核心引擎（2h）
- [ ] `metric-collector.js`（含 performances 持久化）
- [ ] `attribution-engine.js`（含回溯）
- [ ] `insight-generator.js`（ratio≥1.2）
- [ ] `decision-dispenser.js`（含历史链）

### M4：主入口（0.5h）
- [ ] `agent9-core.js`（v5.0，含 prod 路径检查）

### M5：文档（0.5h）
- [ ] `ATTRIBUTION_MODELS.md`
- [ ] `PLATFORM_BENCHMARKS.md`
- [ ] `DECISION_INTERFACE.md`

### M6：端到端验证（1h）
- [ ] `node agent9-core.js`（dev 模式）
- [ ] `NODE_ENV=production node agent9-core.js`（prod 模式，Mock 应被拒绝）
- [ ] performances 持久化验证（output/performances/ 有文件）
- [ ] 回溯修正验证（同一 topic 运行两次，第2次触发回溯）
- [ ] Decision 历史链验证（latest.json 含 history 字段）
- [ ] content_form ratio≥1.2 Insight 验证

---

# 第十五部分：全部版本修复清单

## v0.1 → v0.2（平台元数据驱动）

| 变更 | 内容 |
|------|------|
| 平台维度引入 | platform-meta.json，29 个平台，geoWeight/contentFormWeight |
| ContentFormInsight | target 从 agent5 改为 agent7（格式→Agent7） |
| Agent 8 契约 | YYYY-MM/PUB-{id}.json，polling 机制 |
| Agent 6 topic_id | 设计约束写入 SPEC |
| Decision 路由 | Agent 4/5/6/7/8 |

## v0.2 → v1.x（路由修正 + 架构稳定）

| 变更 | 内容 |
|------|------|
| Agent 8 移除路由 | Agent 8 是数据源，不在决策路由名单 |
| Agent 5 闭环 | loadFeedbackFromAgent9() 三处 err/warn |
| Agent 6 topic_id | direction_id 字段 |
| TopicBoost 更新策略 | latest-overwrites，Agent 5 读最新 |
| Decision 接口 v1.0 | version 字段 + TTL = 24h |

## v1.x → v2.0（完整贯通版）

| 变更 | 内容 |
|------|------|
| 所有代码整合 | agent9-core / 4 个 Skill 完整代码 |
| 27 平台列表 | 精简平台数量（29→27） |
| M0 前置修复 | Agent 5/6 改动完整代码 |

## v2.0 → v3.0（调研验证）

| 变更 | 内容 |
|------|------|
| Z-Score 标准化 | ratio 加权平均 → Z-Score 替代 |
| Position-Based 说明 | 40/20/40 标注为经验规则 |
| 调研印证 | GrowthBook/MTA 方法论印证设计 |

## v3.0 → v4.0（PUA 复审修复）

| 变更 | 内容 |
|------|------|
| H1 语法修复 | agent9-core.js 缺右括号 |
| H2 回溯实现 | performances 持久化 + 真正回溯计算 |
| M1 performances 持久化 | metric-collector._writePerformances() |
| M2 ratio≥1.5→1.2 | 对齐 Z-Score 标准（Z≈0.32） |
| M3 历史链 | latest.json 保留5条 + history/ 存档 |

---

# 第十六部分：零新风险承诺

| 风险类型 | 防护措施 |
|---------|---------|
| 孤儿文件 | Agent 4/6/7 接口注明激活条件 |
| 静默失败 | 全部异常 err/warn |
| 路径错误 | prod 模式启动时检查 OUTPUT_DIR 可写 |
| 接口演进 | Decision 加 `version: "1.2"` |
| Mock 误用 | prod 模式强制拒绝 |
| Z-Score 无依据 | 标注工程经验值，1 年内替换 |
| 回溯失败 | 降级为当前批次计算，不报错 |
| null 字段 | Consumer 文档明确说明必须检查 |
| JSON 损坏 | JSON.parse 异常被 catch，返回空 |
| history 过多 | 最多 20 条，超出自动截断 |

---

*本文档为 Agent 9 v5.0 完整实施计划，整合 v0.1→v0.2→v1.x→v2.0→v3.0→v4.0 全部技术细节。*
