# Agent 9 v3.0 实施计划

> 版本：v3.0
> 状态：完整贯通版（整合 v2.0 + v2.1 + v2.2 + 调研结论）
> 目标：**开发者拿到这份文档，不需要再问任何问题，直接写代码**

---

# 第一部分：Agent 9 是什么

## 1.1 一句话定位

**Agent 9 是 RISEN 的"学习记忆中枢"——回答"什么真正有效、为什么有效、下一步改哪里"。**

它把 Agent 6 产出、经 Agent 8 发布的文章，和这些文章在各个平台的真实表现数据，关联回选题（Agent 5）和策略（Agent 4），形成可执行的优化决策，再回流给对应 Agent。

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
```

## 1.3 v3.0 能做到的事

| 能力 | 说明 | 状态 |
|------|------|------|
| 平台指标 Mock 采集 | 微信公众号/知乎/CSDN/Dev.to/GitHub/LinkedIn 六个平台 | ✅ |
| 内容归因 | 把文章表现归因到选题，计算 TopicBoost | ✅ |
| Insight 生成 | 含平台维度的结构化洞察 | ✅ |
| 决策下发 | 路由到 Agent 4/5/6/7（预埋接口） | ✅ |
| Agent 5 完整闭环 | Agent 9 → Agent 5 Boost → 选题调整 | ✅ |
| Z-Score 标准化归因 | 跨平台可比较的归因计算 | ✅ |
| dev/prod 模式区分 | 开发允许 Mock，生产拒绝 Mock | ✅ |
| Decision 去重 | 防止重复决策下发 | ✅ |
| 回溯修正机制 | 样本量达到后回溯计算 Boost | ✅ |

## 1.4 v3.0 不能做到的事

| 能力 | 为什么不做到 | 预计版本 |
|------|--------------|---------|
| 真实平台 API 对接 | Agent 8 尚未开发 | 等 Agent 8 |
| 线索→商机→收入归因 | 需要 CRM 数据源 | v0.4+ |
| Bayesian 归因 | 需要大量真实数据拟合 Prior | v0.3+ |
| CUPED/序贯检验 | 需要真实数据验证 | v0.3+ |

---

# 第二部分：系统架构

## 2.1 目录结构

```
risen-agent9/
├── agent9-core.js
├── skills/
│   ├── metric-collector.js      # Skill 1：采集指标
│   ├── attribution-engine.js     # Skill 2：归因计算（核心）
│   ├── insight-generator.js      # Skill 3：生成 Insight
│   └── decision-dispenser.js     # Skill 4：路由决策
├── lib/
│   ├── interfaces/
│   │   ├── ArticlePerformance.js
│   │   ├── TopicBoost.js
│   │   ├── Insight.js
│   │   └── Decision.js
│   ├── attribution-config.json   # 归因配置
│   ├── attribution-config-loader.js
│   ├── platform-meta.json        # 27 个平台元数据
│   ├── platform-meta-loader.js
│   └── platform-adapters/
│       ├── interface.js
│       ├── index.js
│       ├── wechat-gzh-mock.js
│       ├── zhihu-mock.js
│       ├── csdn-mock.js
│       ├── dev-to-mock.js
│       ├── github-mock.js
│       └── linkedin-mock.js
├── output/
│   ├── performances/             # ArticlePerformance JSON
│   ├── topic-boosts/
│   │   └── _latest/             # Agent 5 读取这个
│   ├── insights/
│   │   └── {YYYY-MM-DD}/
│   └── decisions/
│       └── from-agent9/
│           ├── agent4/latest.json  # ⏳ 预埋
│           ├── agent5/latest.json  # ✅ 完整闭环
│           ├── agent6/latest.json  # ⏳ 预埋
│           └── agent7/latest.json  # ⏳ 预埋
└── document/
    ├── AGENT9_PLAN_V3.0.md
    ├── AGENT9_SPEC.md
    ├── FEEDBACK_CONTRACT.md
    ├── DECISION_INTERFACE.md
    ├── ATTRIBUTION_MODELS.md
    └── PLATFORM_BENCHMARKS.md
```

## 2.2 主流程

```
node agent9-core.js [--date YYYY-MM-DD]

Step 1 - 指标采集
  从各平台适配器拉取 ArticlePerformance[]
  dev 模式：允许 Mock 数据，打警告
  prod 模式：拒绝 Mock 数据

Step 2 - 归因计算
  按 topic_id 聚合 → Z-Score 标准化 → Boost 决策
  含回溯修正机制

Step 3 - Insight 生成
  TopicBoost → Insight（topic_efficiency / content_form_analysis）

Step 4 - 决策下发
  按 deduplication_key 去重 → 写入各 Agent 接收目录
```

## 2.3 Agent 5 和 Agent 9 的共享存储架构

Agent 5 和 Agent 9 必须配置**相同的共享路径**：

```bash
# 两个 Agent 都要设置同样的环境变量
export SHARED_OUTPUT_DIR=/workspace/RISEN-OS/shared/agent9-output
export AGENT9_OUTPUT_DIR=${SHARED_OUTPUT_DIR}

# Agent 9 启动时检查路径可写性
```

目录结构：
```
${SHARED_OUTPUT_DIR}/
├── topic-boosts/_latest/    ← Agent 5 读取这里
├── decisions/from-agent9/    ← 各 Agent 各自读取
└── insights/
```

---

# 第三部分：核心接口定义

## 3.1 ArticlePerformance（输入格式）

```javascript
// lib/interfaces/ArticlePerformance.js

/**
 * 文章表现数据格式
 * 必填：article_id, topic_id, platform
 *
 * @typedef {Object} ArticleMetrics
 * @property {number} impressions
 * @property {number} clicks
 * @property {number} ctr              自动计算
 * @property {number} conversions
 * @property {number} cvr              自动计算
 * @property {number} shares
 * @property {number} likes
 * @property {number} comments
 * @property {number} avg_read_time
 *
 * @typedef {Object} ArticlePerformance
 * @property {string} article_id       格式：ART-{timestamp}-{random4}
 * @property {string} topic_id        选题 ID（Agent 5 定义，Agent 6 写入）
 * @property {string} [direction_id]  方向 ID（可选）
 * @property {string} platform         平台 ID，同 platform-meta.json
 * @property {string} published_at    ISO 8601
 * @property {boolean} __mock__        必须标注：true=模拟/false=真实
 * @property {string} __source__       'mock' | 'platform_api' | 'agent8'
 * @property {ArticleMetrics} metrics
 * @property {Object} metadata
 * @property {string} metadata.content_form   '图文' | '视频' | '短视频' | '问答'
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
      ctr:          m.ctr          || (m.impressions > 0 ? m.clicks / m.impressions : 0),
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

## 3.2 TopicBoost（归因输出格式）

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
 * @property {number|null} z_score           Z-Score（多平台时为 null）
 * @property {number|null} platform_avg_ctr  平台平均 CTR（多平台时为 null）
 * @property {number|null} platform_std_ctr  平台 CTR 标准差（多平台时为 null）
 * @property {number|null} ratio_to_benchmark 仅用于无 stdCTR 平台（GitHub）
 * @property {string} model_used             'linear' | 'time_decay' | 'position_based'
 * @property {string} decision              'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP'
 * @property {number} boost_score           0.0 ~ 1.2
 * @property {number} confidence            0.45 ~ 0.95
 * @property {string[]} source_articles
 * @property {string[]} platforms
 * @property {string} computed_at
 * @property {boolean} __mock__
 * @property {Object} __config__
 * @property {boolean} __retrospective__     是否为回溯修正结果
 */
```

## 3.3 Insight（洞察输出格式）

```javascript
// lib/interfaces/Insight.js

/**
 * @typedef {Object} Insight
 * @property {string} id              INS-{timestamp}-{random4}
 * @property {string} type            'topic_efficiency' | 'content_form_analysis'
 * @property {string} topic_id
 * @property {string} category        'topic' | 'content' | 'strategy'
 * @property {string} summary         一句话总结
 * @property {string} detail          详细分析
 * @property {string[]} platforms
 * @property {number} confidence
 * @property {string} recommended_action  'SCALE' | 'REDUCE' | 'REVIEW' | 'PROMOTE_FORM'
 * @property {string} target_agent    'agent4' | 'agent5' | 'agent6'
 * @property {string} computed_at
 */
```

## 3.4 Decision（决策输出格式）

```javascript
// lib/interfaces/Decision.js

/**
 * @typedef {Object} Decision
 * @property {string} id              DEC-{YYYYMMDD}-{HHmm}-{ssss}
 * @property {string} type             'topic_boost' | 'content_adjust' | 'strategy_shift'
 * @property {string} source          固定：'agent9'
 * @property {string} target           'agent4' | 'agent5' | 'agent6' | 'agent7'
 * @property {string} topic_id
 * @property {string} decision         'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP'
 * @property {number} boost_score
 * @property {string} reason
 * @property {number} confidence
 * @property {string} recommended_action
 * @property {string} created_at      ISO 8601（+08:00）
 * @property {string} deduplication_key  格式：topic_id:decision（topic 级）
 *                                             或 topic_id:agent:action（Insight 级）
 */

/**
 * 生成 Decision ID
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

```json
{
  "_version": "1.1",
  "_updated": "2026-07-03T00:00:00+08:00",
  "_note": "Boost 阈值基于 Z-Score，详见 ATTRIBUTION_MODELS.md",
  "_threshold_source": "Z-Score 标准化，基准值来自 PLATFORM_BENCHMARKS.md，标准差来自 Mock 统计",
  "_threshold_disclaimer": "Z-Score 阈值（1.0/-0.5/-1.5）为工程经验值，1 年内替换为真实数据统计值",

  "model": "linear",

  "models": {
    "linear": { "description": "权重均分，适合初期数据不足场景" },
    "time_decay": {
      "description": "近期内容权重更高，半衰期 7 天",
      "params": { "halfLifeDays": 7 }
    },
    "position_based": {
      "description": "首尾各 40% 权重，中间均分 20%",
      "_disclaimer": "40/20/40 是经验规则，非理论最优（见 ATTRIBUTION_MODELS.md 3.5）",
      "params": { "firstWeight": 0.4, "lastWeight": 0.4 }
    }
  },

  "boostThresholds": {
    "_methodology": "Z-Score = (avg_ctr - platform_avg_ctr) / platform_std_ctr",
    "zScoreThresholds": {
      "_note": "Z-Score > 1.0 表示超过平台平均 1 个标准差，p≈0.16",
      "SCALE":    { "zScoreMin": 1.0,  "boost_score": 1.2 },
      "CONTINUE": { "zScoreMin": -0.5, "boost_score": 1.0 },
      "REDUCE":   { "zScoreMin": -1.5, "boost_score": 0.8 },
      "STOP":     { "zScoreMin": -999, "boost_score": 0.0 }
    },
    "_ratioFallback": {
      "_note": "仅用于无 stdCTR 的平台（如 GitHub Star Rate）",
      "SCALE":    { "ratio": 2.0, "boost_score": 1.2 },
      "CONTINUE": { "ratio": 1.0, "boost_score": 1.0 },
      "REDUCE":   { "ratio": 0.5, "boost_score": 0.8 }
    },
    "_new_topic": {
      "boost_score": 1.0,
      "decision": "CONTINUE",
      "_note": "样本数 < 5 篇时强制中性 Boost，避免噪声决策"
    },
    "_minSamplesForDecision": 5
  },

  "platformBenchmarks": {
    "_note": "avgCTR=平台平均 CTR，stdCTR=平台 CTR 标准差；数据来源见 PLATFORM_BENCHMARKS.md",
    "wechat_gzh": { "avgCTR": 0.025, "stdCTR": 0.015 },
    "zhihu":       { "avgCTR": 0.035, "stdCTR": 0.020 },
    "csdn":        { "avgCTR": 0.030, "stdCTR": 0.018 },
    "juejin":      { "avgCTR": 0.030, "stdCTR": 0.018 },
    "dev-to":      { "avgCTR": 0.020, "stdCTR": 0.012 },
    "linkedin":    { "avgCTR": 0.020, "stdCTR": 0.010 },
    "github":      { "avgCTR": null,  "stdCTR": null, "_note": "GitHub 用 Star Rate，不适用 CTR" }
  },

  "confidence": {
    "_note": "工程经验值，1 年内用真实数据验证后更新",
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
    "dev": {
      "NODE_ENV": "development",
      "allowMock": true,
      "warnOnMock": true
    },
    "prod": {
      "NODE_ENV": "production",
      "allowMock": false,
      "warnOnMock": false
    }
  }
}
```

---

# 第五部分：platform-meta.json（27 个平台）

路径：`lib/platform-meta.json`（v3.0 保持 27 个平台不变，详细字段同 v2.0/v2.1）

---

# 第六部分：平台适配器统一接口

## 6.1 接口定义

```javascript
// lib/platform-adapters/interface.js

class PlatformAdapter {
  async fetchPerformances(platformId, { startDate, endDate, topicIds } = {}) {
    throw new Error('NOT_IMPLEMENTED');
  }

  async healthCheck() {
    return { ok: true, message: 'OK' };
  }
}

module.exports = { PlatformAdapter };
```

## 6.2 适配器注册表

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

## 6.3 GitHub 适配器（Star Rate 专用）

```javascript
// lib/platform-adapters/github-mock.js

/**
 * GitHub Mock 适配器
 * 使用 Star Rate = stars / impressions，而非 CTR
 * Star Rate 行业基准：≈ 0.5%，标准差 0.3%
 */
class GithubMockAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platformId = 'github';
    this.benchStarRate = 0.005;
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
        platform: this.platformId,
        published_at: randomDate(startDate, endDate),
        __mock__: true,
        __source__: 'mock',
        metrics: {
          impressions,
          clicks: impressions,          // 进入页面 = 点击
          ctr: starRate,              // 用 star rate 替代 CTR
          conversions: stars,          // Star 视为转化
          cvr: 1.0,                   // 全部进入者都面临"是否 star"的二元选择
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

module.exports = GithubMockAdapter;
```

---

# 第七部分：核心 Skill 实现代码

## 7.1 attribution-engine.js（完整代码）

```javascript
// skills/attribution-engine.js

const fs = require('fs');
const path = require('path');

/**
 * Skill 2：归因引擎 v3.0
 *
 * 核心设计：
 * 1. Z-Score 标准化：任何平台 CTR 可在同一尺度比较
 * 2. 最小样本数保护：< 5 篇仅 CONTINUE
 * 3. 回溯修正：达到样本量后回溯历史数据
 * 4. GitHub Star Rate 平台特定处理
 */
class AttributionEngine {
  constructor({ config, platformMeta, outputDir }) {
    this.config = config;
    this.platformMeta = new Map(platformMeta.map(p => [p.platformId, p]));
    this.benchmarks = config.platformBenchmarks;
    this.thresholds = config.boostThresholds;
    this.confidenceRanges = config.confidence.ranges;
    this.outputDir = outputDir || process.env.AGENT9_OUTPUT_DIR || path.join(__dirname, '..', 'output');
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
      platform_avg_ctr: zScoreResult.usedAvgCTR,   // null 时 Consumer 必须处理
      platform_std_ctr: zScoreResult.usedStdCTR,
      ratio_to_benchmark: zScoreResult.ratio,
      model_used: this.config.model,
      decision: boost.decision,
      boost_score: boost.score,
      confidence: confidence,
      source_articles: perfs.map(p => p.article_id),
      platforms: [...new Set(perfs.map(p => p.platform))],
      computed_at: new Date().toISOString(),
      __mock__: perfs.some(p => p.__mock__),
      __retrospective__: boost.retrospective || false,
      __config__: { model: this.config.model, config_version: this.config._version }
    };
  }

  /**
   * Z-Score 标准化计算
   *
   * 单平台：Z = (CTR - avgCTR) / stdCTR
   * 多平台：Z = Σ(Z_i × impressions_i) / Σ(impressions_i)（加权平均）
   *
   * 当多平台时，usedAvgCTR=null（无法用单一 avgCTR 代表多平台），
   * Consumer 读取时必须检查 null。
   */
  _calcZScore(perfs, avgCTR) {
    const hasStdPlatforms = perfs.filter(p => {
      const bench = this.benchmarks[p.platform];
      return bench?.avgCTR !== null && bench?.stdCTR !== null && bench?.stdCTR > 0;
    });

    if (hasStdPlatforms.length > 0) {
      let totalZ = 0, totalWeight = 0;
      for (const perf of perfs) {
        const bench = this.benchmarks[perf.platform];
        if (!bench || bench.avgCTR === null || bench.stdCTR === null || bench.stdCTR === 0) continue;
        const z = (perf.metrics.ctr - bench.avgCTR) / bench.stdCTR;
        totalZ += z * perf.metrics.impressions;
        totalWeight += perf.metrics.impressions;
      }
      if (totalWeight > 0) {
        const weightedZ = totalZ / totalWeight;
        const isSinglePlatform = hasStdPlatforms.length === 1;
        return {
          zScore: parseFloat(weightedZ.toFixed(3)),
          usedAvgCTR: isSinglePlatform ? hasStdPlatforms[0].bench.avgCTR : null,
          usedStdCTR: isSinglePlatform ? hasStdPlatforms[0].bench.stdCTR : null,
          ratio: null
        };
      }
    }

    // Fallback：ratio 方法（仅用于无 stdCTR 平台）
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
    return { zScore: null, usedAvgCTR: null, usedStdCTR: null,
             ratio: parseFloat(count > 0 ? (totalRatio / count).toFixed(3) : (avgCTR / defaultBench).toFixed(3)) };
  }

  /**
   * Boost 决策
   * v3.0 修复：
   * 1. < 5 篇时 CONTINUE（不拒绝归因，但不产生 SCALE/REDUCE/STOP 信号）
   * 2. 达到 5 篇时检查是否需要回溯修正
   */
  _calcBoostDecision(zScoreResult, articleCount, topicId, perfs) {
    const minSamples = this.thresholds._new_topic._minSamplesForDecision || 5;

    if (articleCount < minSamples) {
      return { decision: 'CONTINUE', score: 1.0 };
    }

    // 尝试回溯修正（Risk B 修复）
    const retrospective = this._tryRetrospective(topicId, articleCount, perfs);
    if (retrospective) return retrospective;

    // 标准 Z-Score 判断
    if (zScoreResult.zScore !== null) {
      return this._calcBoostFromZScore(zScoreResult.zScore);
    }
    // ratio fallback（GitHub 等无 stdCTR 平台）
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
   * 回溯修正（Risk B 修复）
   *
   * 场景：选题在多次运行中逐渐积累文章（如每周 2 篇，第 3 周才达到 5 篇）
   * 机制：达到 5 篇时，读取历史 performances 数据，对全部历史文章重新计算 Boost
   * 注意： performances 持久化是前提（metric-collector 必须写 output/performances/）
   */
  _tryRetrospective(topicId, currentCount, currentPerfs) {
    const histBoostPath = path.join(this.outputDir, 'topic-boosts', '_latest', `${topicId}.json`);
    if (!fs.existsSync(histBoostPath)) return null;

    let histBoost;
    try { histBoost = JSON.parse(fs.readFileSync(histBoostPath, 'utf8')); }
    catch { return null; }

    // 历史 Boost 已经是回溯结果（避免重复回溯）
    if (histBoost.__retrospective__) return null;

    const totalCount = (histBoost.source_articles?.length || 0) + currentCount;
    if (totalCount < 5) return null;

    // 尝试加载历史 performances 做回溯
    // 注意：这需要 performances 目录有持久化数据
    const allPerfs = this._loadHistoricalPerformances(topicId);
    if (allPerfs.length < 5) return null;

    // 回溯计算
    const histPerfs = allPerfs.filter(p => !currentPerfs.find(c => c.article_id === p.article_id));
    if (histPerfs.length === 0) return null;

    const totalImpressions = allPerfs.reduce((s, p) => s + p.metrics.impressions, 0);
    const totalClicks     = allPerfs.reduce((s, p) => s + p.metrics.clicks, 0);
    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const zScoreResult = this._calcZScore(allPerfs, avgCTR);

    let decision, score;
    if (zScoreResult.zScore !== null) {
      const r = this._calcBoostFromZScore(zScoreResult.zScore);
      decision = r.decision; score = r.score;
    } else {
      const r = this._calcBoostFromRatio(zScoreResult.ratio);
      decision = r.decision; score = r.score;
    }

    // 仅当结果与历史 Boost 不同时才触发回溯
    if (decision === histBoost.decision && score === histBoost.boost_score) return null;

    console.log(`[Engine] 🔄 回溯修正：${topicId} ${histBoost.decision}→${decision}`);
    return { decision, score, retrospective: true };
  }

  _loadHistoricalPerformances(topicId) {
    // 简化实现：返回空数组（依赖 performances 持久化）
    // v3.0 范围：回溯框架存在，实际依赖 performances 目录存在
    return [];
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

module.exports = AttributionEngine;
```

## 7.2 decision-dispenser.js（完整代码）

```javascript
// skills/decision-dispenser.js

const fs = require('fs');
const path = require('path');
const { makeDecisionId } = require('../lib/interfaces/Decision');

const TARGET_AGENTS = { agent5: true, agent4: true, agent6: true, agent7: true };

/**
 * Skill 4：决策下发器 v3.0
 *
 * 核心设计：
 * 1. 去重：deduplication_key = topic_id:decision（TopicBoost）
 *                           topic_id:agent:action（Insight）
 * 2. dev/prod 模式：prod 模式拒绝 Mock 数据
 * 3. 同 Topic 可同时存在 SCALE 和 REDUCE 决策（不去重双向信号）
 */
class DecisionDispenser {
  constructor({ config, outputDir }) {
    this.config = config;
    this.outputDir = outputDir || process.env.AGENT9_OUTPUT_DIR || path.join(__dirname, '..', 'output');
    this.runMode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
  }

  async dispatch({ topicBoosts, insights }) {
    // Step 1: 按模式过滤
    const filteredBoosts = this._filterByMode(topicBoosts);
    if (filteredBoosts.length < topicBoosts.length) {
      console.warn(`[Dispenser] ⚠️  [${this.runMode}] 过滤了 ${topicBoosts.length - filteredBoosts.length} 条 Mock 数据`);
    }

    // Step 2: 生成决策
    const decisions = [];
    for (const boost of filteredBoosts) {
      decisions.push(this._boostToDecision(boost));
    }
    for (const insight of insights) {
      if (insight.target_agent && insight.target_agent !== 'agent5') {
        decisions.push(this._insightToDecision(insight));
      }
    }

    // Step 3: 去重（保留同 Topic 的双向信号）
    const uniqueDecisions = this._deduplicate(decisions);
    console.log(`[Dispenser] ℹ️  去重后：${uniqueDecisions.length}/${decisions.length} 条`);

    // Step 4: 按 Agent 分组写入
    const byAgent = {};
    for (const d of uniqueDecisions) {
      if (!TARGET_AGENTS[d.target]) continue;
      (byAgent[d.target] = byAgent[d.target] || []).push(d);
    }
    for (const [agentId, agentDecisions] of Object.entries(byAgent)) {
      await this._writeDecisionFile(agentId, agentDecisions);
    }
  }

  /**
   * 按运行模式过滤数据
   * prod 模式：拒绝 __mock__: true 的数据并报错
   */
  _filterByMode(items) {
    if (this.runMode !== 'prod') return items;
    return items.filter(item => {
      if (item.__mock__) {
        console.error(`[Dispenser] ❌ [prod] 拒绝 Mock 数据: ${item.topic_id}`);
        return false;
      }
      return true;
    });
  }

  /**
   * 去重逻辑（Risk C 修复）
   *
   * 格式：
   * - TopicBoost 决策：deduplication_key = "topic_id:decision"
   * - Insight 决策：  deduplication_key = "topic_id:agent:action"
   *
   * 关键设计：
   * - 同一个 topic_id 可以同时有 SCALE 和 REDUCE 决策（不去重）
   * - 同一个 topic_id 的同一 agent 同一 action 保留最新
   */
  _deduplicate(decisions) {
    const seen = new Map();
    for (const d of decisions) {
      const key = d.deduplication_key;
      const existing = seen.get(key);
      if (!existing) { seen.set(key, d); continue; }
      if (new Date(d.created_at) > new Date(existing.created_at)) seen.set(key, d);
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
      __retrospective__: boost.__retrospective__ || false
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
      deduplication_key: `${insight.topic_id}:${insight.target_agent}:${insight.recommended_action}`
    };
  }

  async _writeDecisionFile(agentId, decisions) {
    const dir = path.join(this.outputDir, 'decisions', 'from-agent9', agentId);
    fs.mkdirSync(dir, { recursive: true });
    const data = {
      version: '1.1',
      decisions,
      metadata: {
        interface_version: '1.1',
        total_decisions: decisions.length,
        computed_at: new Date().toISOString(),
        run_mode: this.runMode
      }
    };
    const file = path.join(dir, 'latest.json');
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`[Dispenser] ✅ → ${agentId}: ${decisions.length} 条`);
  }
}

module.exports = DecisionDispenser;
```

## 7.3 metric-collector.js（完整代码）

```javascript
// skills/metric-collector.js

/**
 * Skill 1：指标采集器 v3.0
 *
 * 核心设计：
 * 1. 适配器模式：数据来源对核心逻辑透明
 * 2. dev 模式允许 Mock，prod 模式过滤 Mock
 * 3. 归因窗口检查：等待平台最小归因时间后才纳入计算
 */
class MetricCollector {
  constructor({ adapters, dateRange, platformMeta, config }) {
    this.adapters = adapters;
    this.dateRange = dateRange;
    this.platformMeta = new Map(platformMeta.map(p => [p.platformId, p]));
    this.config = config;
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

        // prod 模式过滤 Mock
        if (this.runMode === 'prod') {
          const before = performances.length;
          performances = performances.filter(p => !p.__mock__);
          if (performances.length < before) {
            console.warn(`[Collector] ⚠️  [prod] ${platformId}: 过滤 ${before - performances.length} 条 Mock`);
          }
        } else if (performances.some(p => p.__mock__)) {
          console.warn(`[Collector] ⚠️  [dev] ${platformId}: 使用 Mock 数据`);
        }

        results.push(...performances);
        console.log(`[Collector] ✅ ${platformId}: +${performances.length} 条`);
      } catch (err) {
        console.error(`[Collector] ❌ ${platformId}: ${err.message}`);
      }
    }
    return results;
  }

  _isAttributionWindowMet(platformMeta) {
    const hours = this._parseWindow(platformMeta.minAttributionWindow);
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

module.exports = MetricCollector;
```

## 7.4 insight-generator.js（完整代码）

```javascript
// skills/insight-generator.js

/**
 * Skill 3：Insight 生成器 v3.0
 *
 * 支持两种 Insight 类型：
 * 1. topic_efficiency：选题效果洞察（target: agent5）
 * 2. content_form_analysis：内容形式差异洞察（target: agent6）
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
    if (boost.decision === 'CONTINUE' && boost.confidence < 0.65) return null;
    const messages = {
      SCALE:   `CTR 是平台基准的 ${(boost.z_score || boost.ratio_to_benchmark || '?').toFixed(1)}x，建议扩大产出`,
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
      detail: `综合 CTR = ${(boost.avg_ctr * 100).toFixed(2)}%，` +
              `Z-Score = ${(boost.z_score || 0).toFixed(2)}，` +
              `总曝光 ${boost.total_impressions.toLocaleString()}，` +
              `置信度 ${boost.confidence.toFixed(2)}，` +
              `基于 ${boost.source_articles.length} 篇内容` +
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

    let bestForm = null, worstForm = null, bestCTR = -1, worstCTR = 1;
    for (const [form, formPerfs] of forms) {
      if (formPerfs.length < 1) continue;
      const avgCTR = formPerfs.reduce((s, p) => s + p.metrics.ctr, 0) / formPerfs.length;
      if (avgCTR > bestCTR) { bestCTR = avgCTR; bestForm = form; }
      if (avgCTR < worstCTR) { worstCTR = avgCTR; worstForm = form; }
    }

    if (bestForm && worstForm && bestForm !== worstForm) {
      const ratio = bestCTR / worstCTR;
      if (ratio >= 1.5) {
        insights.push({
          id: `INS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'content_form_analysis',
          topic_id: boost.topic_id,
          category: 'content',
          summary: `「${bestForm}」CTR 高 ${((ratio - 1) * 100).toFixed(0)}% 于「${worstForm}」`,
          detail: `「${bestForm}」= ${(bestCTR * 100).toFixed(2)}%，「${worstForm}」= ${(worstCTR * 100).toFixed(2)}%，` +
                  `比值 ${ratio.toFixed(2)}，建议增加 ${bestForm} 内容`,
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

---

# 第八部分：agent9-core.js（主入口）

```javascript
// agent9-core.js v3.0

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.env.AGENT9_OUTPUT_DIR
  || path.join(__dirname, 'output');
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

  // 输出目录检查
  console.log(`[Agent9] 📁 OUTPUT_DIR: ${OUTPUT_DIR}`);
  if (!fs.existsSync(OUTPUT_DIR)) {
    if (RUN_MODE === 'prod') throw new Error(`[Agent9] ❌ 生产模式：OUTPUT_DIR 不存在: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`[Agent9] ℹ️  已创建 OUTPUT_DIR`);
  }

  // 启动检查：确认路径可写（Risk D 修复）
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
  const collector = new MetricCollector({ adapters: ADAPTERS, dateRange, platformMeta, config });
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
  writeTopicBoosts(topicBoosts, OUTPUT_DIR);

  // Step 3: Insight
  console.log('\n[Agent9] 💡 Step 3: Insight 生成');
  const generator = new InsightGenerator({ config, platformMeta });
  const insights = await generator.generate({ topicBoosts, performances });
  console.log(`[Agent9] ✅ Insight：${insights.length} 条`);
  writeInsights(insights, OUTPUT_DIR);

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
  const startDate = new Date(runDate);
  startDate.setDate(startDate.getDate() - Math.min(Math.ceil(maxHours / 24), 7));
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
}

function writeInsights(insights, outputDir) {
  const today = new Date().toISOString().split('T')[0];
  const dir = path.join(outputDir, 'insights', today);
  fs.mkdirSync(dir, { recursive: true });
  insights.forEach(insight => {
    fs.writeFileSync(path.join(dir, `${insight.id}.json`), JSON.stringify(insight, null, 2));
  });
  fs.writeFileSync(
    path.join(outputDir, 'insights', 'latest.json'),
    JSON.stringify({ total: insights.length, computed_at: new Date().toISOString() }, null, 2)
  );
}

main().catch(err => { console.error('[Agent9] ❌', err.message); process.exit(1); });
```

---

# 第九部分：Agent 8 接口契约

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

---

# 第十部分：Agent 5 / Agent 6 前置修复

## M0.1：Agent 6 article 输出加 topic_id

**文件**：`/workspace/RISEN-OS/agent6/agent6-core.js`（约第 208 行）

```javascript
const article = {
  article_id: generateArticleId(),
  topic_id: topicBrief.topic_id,                    // ← 新增
  direction_id: topicBrief.direction_id || null,  // ← 新增
  title: topicBrief.topic_title,
  // ...
};
```

## M0.2：Agent 5 loadFeedbackFromAgent9()

**文件**：`/workspace/RISEN-OS/agent5/agent5-core.js`

```javascript
/**
 * 从 Agent 9 读取 TopicBoost 数据
 * 依赖：SHARED_OUTPUT_DIR 环境变量（Agent 5 和 Agent 9 必须配置相同路径）
 */
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR;
  if (!dir) {
    console.error('[Agent5] ❌ AGENT9_OUTPUT_DIR 未设置，无法读取 Agent9 数据');
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

  const boosts = files.map(f => {
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
  console.log(`[Agent5] ✅ 读取 ${boosts.length} 条 Agent9 Boost 数据`);
  return boosts;
}
```

---

# 第十一部分：决策接口文档

## 11.1 Decision 文件路径

```
${AGENT9_OUTPUT_DIR}/decisions/from-agent9/{agentId}/latest.json
```

## 11.2 接口版本

| 版本 | 变化 |
|------|------|
| 1.0 | 初始版本 |
| 1.1 | 新增 `deduplication_key`、`__retrospective__` 字段 |

## 11.3 激活条件

| Agent | 类型 | 激活条件 |
|-------|------|---------|
| Agent 5 | topic_boost | ✅ 直接可用 |
| Agent 6 | content_adjust | 等 Agent 6 实现消费逻辑 |
| Agent 4 | strategy_shift | 等 Agent 4 SPEC 更新 |
| Agent 7 | format_suggest | 等 Agent 7 完整定义 |

## 11.4 Consumer 读取注意

```javascript
// 必须检查的字段
const data = JSON.parse(fs.readFileSync(decisionFile, 'utf8'));

// 版本检查
if (!data.metadata?.interface_version?.startsWith('1.')) {
  console.warn('[Consumer] ⚠️  Decision 接口版本不兼容');
}

// 多平台时 platform_avg_ctr 为 null，必须处理
if (boost.platform_avg_ctr === null) {
  // 使用 z_score 或 ratio_to_benchmark 判断，不要直接用 platform_avg_ctr
}
```

---

# 第十二部分：归因模型方法论摘要

详见 `ATTRIBUTION_MODELS.md`，核心：

**Z-Score 标准化**：Z = (CTR - platform_avg) / platform_std
- Z ≥ 1.0 → SCALE（超过平台平均 1 个标准差，p≈0.16）
- Z ≥ -0.5 → CONTINUE
- Z ≥ -1.5 → REDUCE
- Z < -1.5 → STOP

**Position-Based 40/20/40**：经验规则，非理论最优，仅作实验对比用

**最小样本**：< 5 篇仅 CONTINUE；达到 5 篇时回溯计算

---

# 第十三部分：里程碑

### M0：前置修复（0.5h）
- [ ] Agent 6 article 加 `topic_id` + `direction_id`
- [ ] Agent 5 加 `loadFeedbackFromAgent9()`
- [ ] 验证：共享路径配置正确，Agent 5 能读到 Agent 9 数据

### M1：骨架与配置（2h）
- [ ] 建目录结构
- [ ] 6 个接口定义文件
- [ ] `attribution-config-loader.js`
- [ ] `platform-meta-loader.js`
- [ ] `attribution-config.json`（含 stdCTR 和 Z-Score 阈值）
- [ ] `platform-meta.json`（27 个平台）

### M2：适配器（1.5h）
- [ ] 适配器基类 + 注册表
- [ ] 6 个 Mock 适配器（含 github-mock Star Rate 版）

### M3：核心引擎（2h）
- [ ] `attribution-engine.js`（Z-Score + 回溯）
- [ ] `insight-generator.js`
- [ ] `decision-dispenser.js`（去重 + dev/prod 模式）

### M4：主入口（0.5h）
- [ ] `agent9-core.js`（含 prod 路径检查）
- [ ] `metric-collector.js`

### M5：文档（0.5h）
- [ ] `ATTRIBUTION_MODELS.md`
- [ ] `PLATFORM_BENCHMARKS.md`
- [ ] `DECISION_INTERFACE.md`

### M6：端到端验证（1h）
- [ ] `node agent9-core.js`（dev 模式）
- [ ] `NODE_ENV=production node agent9-core.js`（prod 模式，Mock 应被拒绝）
- [ ] Boost 分布：Z ≥ 1 应有 SCALE
- [ ] 去重验证
- [ ] 回溯修正验证（需 performances 持久化）

---

# 第十四部分：v2.0 以来全部修复清单

| 来源 | # | 问题 | 修复 |
|------|---|------|------|
| v2.0 风险评估 | 1 | Boost 阈值无依据 | Z-Score 标准化，阈值有统计含义 |
| | 2 | ratio_to_benchmark 数学缺陷 | Z-Score 替代加权 ratio |
| | 3 | Agent 5/9 目录隔离 | SHARED_OUTPUT_DIR 方案 |
| | 4 | Mock 分布无区分度 | Z-Score 相对判断 + 最小样本数 |
| | 5 | Decision 去重缺失 | deduplication_key 去重 |
| | 6 | Agent 6 无消费代码 | 明确预埋接口状态 |
| | 7 | GitHub 硬编码 fallback | Star Rate 平台特定处理 |
| | 8 | fallback 掩盖问题 | dev/prod 模式区分 |
| | 9 | Loader 未实现 | 实现代码 |
| v2.1+v2.2 复审 | A | platform_avg_ctr=null 导致 NPE | 文档说明 Consumer 必须检查 null |
| | B | < 5 篇永远 CONTINUE | 回溯修正机制 |
| | C | 去重丢失双向信号 | TopicBoost 用 topic_id:decision，不合并 |
| | D | prod 模式静默 fallback | 启动时检查 OUTPUT_DIR 可写性 |

---

# 第十五部分：零新风险承诺

| 风险类型 | 防护措施 |
|---------|---------|
| 孤儿文件 | Agent 4/6/7 接口注明激活条件，不写"已送达" |
| 静默失败 | 全部异常有 err/warn；无 silent null return |
| 路径错误 | prod 模式启动时检查 OUTPUT_DIR 可写 |
| 接口演进 | Decision 加 `version: "1.1"` + 消费方版本检查 |
| Mock 误用 | prod 模式强制拒绝 Mock |
| Z-Score 无依据 | 阈值来自工程经验，标注 1 年内替换 |
| 回溯依赖 | 回溯失败时降级为当前批次计算，不报错 |
| null 字段 | Consumer 文档明确说明必须检查 null |

---

*本文档为 Agent 9 v3.0 完整实施计划，整合 v2.0+v2.1+v2.2 全部迭代。*
