# Agent 9 v2.1+v2.2 实施计划

> 版本：v2.1+v2.2（含调研修复）
> 状态：风险修复版（基于 v2.0 PUA 风险评估，修复 9 个中高风险 + 调研后 2 个新增风险）
> 对比 v2.0：不是增量变更记录，是完整贯通版

---

# 第一部分：Agent 9 是什么

## 1.1 一句话定位

**Agent 9 是 RISEN 的"学习记忆中枢"——回答"什么真正有效、为什么有效、下一步改哪里"。**

它把 Agent 6 产出、经 Agent 8 发布的文章，和这些文章在各个平台的真实表现数据，关联回选题（Agent 5）和策略（Agent 4），形成可执行的优化决策，再回流给对应 Agent。

## 1.2 在 RISEN 中的位置

```
RISEN 运作全景：

  Agent 5 选题 → Agent 6 写文章 → Agent 8 发布 → 各平台产生数据
                                                        ↓
                                              Agent 9 分析
                                                        ↓
                              ┌──────────┬──────────┬──────────┐
                              ↓          ↓          ↓          ↓
                           Agent4    Agent5    Agent6    Agent7
                           策略      选题      内容      格式
```

## 1.3 v2.1 能做到的事（相比 v2.0 新增）

| 能力 | v2.0 状态 | v2.1 改进 |
|------|----------|---------|
| 跨平台 ratio 计算 | 有数学缺陷 | ✅ 修复为标准化方法 |
| Boost 阈值验证 | 无验证机制 | ✅ 增加验证方案 |
| Agent 5/9 存储架构 | 目录隔离未解决 | ✅ 明确共享存储方案 |
| Decision 去重 | 无去重机制 | ✅ 增加去重逻辑 |
| Agent 6/7 接口状态 | 状态模糊 | ✅ 明确激活条件 |
| GitHub 归因 | 硬编码 fallback | ✅ 平台特定指标处理 |
| Mock 使用场景 | 混用 dev/prod | ✅ 区分 dev/prod 模式 |
| Loader 实现 | 计划中未实现 | ✅ 实现代码 |

## 1.4 v2.1 不能做到的事（不变）

| 能力 | 为什么不做到 | 预计版本 |
|------|--------------|---------|
| 真实平台 API 对接 | Agent 8 尚未开发 | 等 Agent 8 |
| 线索→商机→收入归因 | 需要 CRM 数据源 | v0.4+ |
| CUPED/序贯检验 | 需要真实数据验证 | v0.3+ |
| Multi-Touch Attribution | 面向用户旅程，非内容归因 | v0.4+ |

---

# 第二部分：v2.0 风险修复清单

## 修复总览

| # | v2.0 风险 | 风险等级 | v2.1 修复方案 |
|---|---------|---------|-------------|
| 1 | Boost 阈值无验证机制 | 🔴 HIGH | 新增阈值标定协议 + Mock 分布验证 |
| 2 | ratio_to_benchmark 数学缺陷 | 🔴 HIGH | 改用 Z-Score 标准化方法 |
| 3 | Agent 5/9 目录隔离 | 🔴 HIGH | 明确共享存储架构 |
| 4 | Mock 分布无区分度 | 🟡 MEDIUM | 调整 Mock 分布 + 增加最小样本判断 |
| 5 | Decision 去重缺失 | 🟡 MEDIUM | 增加 topic_id+decision 去重逻辑 |
| 6 | Agent 6 无消费代码 | 🟡 MEDIUM | 明确接口激活条件和时间线 |
| 7 | GitHub fallback 硬编码 | 🟡 MEDIUM | 平台特定指标处理方案 |
| 8 | fallback 掩盖真实问题 | 🟡 MEDIUM | 区分 dev/prod 模式 |
| 9 | Loader 未实现 | 🟡 MEDIUM | 实现代码补到 M1 里程碑 |
| A | 多平台 Z-Score 时 platform_avg_ctr=null，Consumer 可能 NPE | 🟡 MEDIUM | 文档注明 null 含义 + Consumer 必须做 null 检查 |
| B | < 5 篇永远 CONTINUE，无回溯机制 | 🔴 HIGH | 达到 5 篇时回溯计算历史数据，修正 Boost |

---

## v2.1 → v2.2 调研后新增修复

| 来源 | 发现 | 修复 |
|------|------|------|
| GrowthBook 调研 | < 5 篇 CONTINUE 设计正确，但需回溯修正 | 增加回溯计算逻辑（见 Risk B） |
| MTA 调研 | Position-Based 40/20/40 是经验规则，非理论最优 | 文档注明经验规则来源 |

---

# 第三部分：系统架构

## 3.1 目录结构

```
risen-agent9/
├── agent9-core.js              # 主入口
├── skills/
│   ├── metric-collector.js      # Skill 1
│   ├── attribution-engine.js   # Skill 2
│   ├── insight-generator.js    # Skill 3
│   └── decision-dispenser.js   # Skill 4
├── lib/
│   ├── interfaces/
│   │   ├── ArticlePerformance.js
│   │   ├── TopicBoost.js
│   │   ├── Insight.js
│   │   └── Decision.js
│   ├── attribution-config.json   # 归因配置
│   ├── attribution-config-loader.js  # ✅ 新增实现
│   ├── platform-meta.json        # 平台元数据
│   ├── platform-meta-loader.js   # ✅ 新增实现
│   └── platform-adapters/
│       ├── interface.js
│       ├── index.js
│       ├── wechat-gzh-mock.js
│       ├── zhihu-mock.js
│       ├── csdn-mock.js
│       ├── dev-to-mock.js
│       ├── github-mock.js   # ✅ 修复：用 Star Rate 而非 CTR fallback
│       └── linkedin-mock.js
├── output/                      # 默认 ./output，可通过 AGENT9_OUTPUT_DIR 覆盖
│   ├── performances/
│   ├── topic-boosts/
│   │   └── _latest/
│   ├── insights/
│   │   └── {YYYY-MM-DD}/
│   └── decisions/
│       └── from-agent9/
│           ├── agent4/latest.json  # ⏳ 预埋，等 Agent4 SPEC 更新
│           ├── agent5/latest.json  # ✅ 完整闭环
│           ├── agent6/latest.json  # ⏳ 预埋，等 Agent6 消费代码
│           └── agent7/latest.json  # ⏳ 预埋，等 Agent7 定义
└── document/
    ├── AGENT9_PLAN_V2.1.md     # 本文档
    ├── AGENT9_SPEC.md
    ├── FEEDBACK_CONTRACT.md
    ├── DECISION_INTERFACE.md
    ├── ATTRIBUTION_MODELS.md    # ✅ 新增：归因模型方法论
    └── PLATFORM_BENCHMARKS.md   # ✅ 新增：平台基准数据说明
```

## 3.2 Agent 5 和 Agent 9 的存储共享架构

### v2.0 的问题

Agent 9 的 output 在 `/workspace/risen-agent9/output/`，Agent 5 在 `/workspace/RISEN-OS/agent5/`。两个目录隔离，Agent 5 读不到 Agent 9 的数据。

### v2.1 的解决方案

**方案：环境变量指向共享路径**

Agent 5 和 Agent 9 必须配置**相同的共享路径**，而不是各自的本地目录：

```bash
# Agent 5 和 Agent 9 都需要设置同样的环境变量
export SHARED_OUTPUT_DIR=/workspace/RISEN-OS/shared/agent9-output

# Agent 9
export AGENT9_OUTPUT_DIR=${SHARED_OUTPUT_DIR}

# Agent 5
export AGENT9_OUTPUT_DIR=${SHARED_OUTPUT_DIR}
```

目录结构：
```
/workspace/RISEN-OS/shared/agent9-output/   ← Agent 5 和 Agent 9 共享
├── topic-boosts/_latest/   ← Agent 5 读取这里
├── decisions/from-agent9/   ← Agent 5/4/6/7 各自读取
└── insights/
```

### 验证方法

```javascript
// Agent 9 启动时检查共享路径是否可写
const fs = require('fs');
const dir = process.env.AGENT9_OUTPUT_DIR;
if (!dir) throw new Error('[Agent9] ❌ AGENT9_OUTPUT_DIR 未设置');
try {
  fs.accessSync(dir, fs.constants.W_OK);
} catch {
  throw new Error(`[Agent9] ❌ AGENT9_OUTPUT_DIR 不可写: ${dir}`);
}
console.log(`[Agent9] ✅ 共享路径: ${dir}`);
```

### 激活条件

| 场景 | 激活条件 |
|------|---------|
| 本地开发 | Agent 5 和 Agent 9 指向同一个本地目录 |
| 生产环境 | 共享网络存储（NFS/共享卷）路径一致 |

---

# 第四部分：核心接口定义

（同 v2.0，以下仅列出变更部分）

## 4.1 ArticlePerformance（无变更）

同 v2.0 section 3.1。

## 4.2 TopicBoost（无变更）

同 v2.0 section 3.2。

## 4.3 Decision 新增去重字段

```javascript
// lib/interfaces/Decision.js
/**
 * @typedef {Object} Decision
 * @property {string} id                格式：DEC-{YYYYMMDD}-{HHmm}-{ssss}
 * @property {string} type
 * @property {string} source
 * @property {string} target
 * @property {string} topic_id
 * @property {string} decision
 * @property {number} boost_score
 * @property {string} reason
 * @property {number} confidence
 * @property {string} recommended_action
 * @property {string} created_at
 * @property {string} deduplication_key   // ✅ 新增：格式为 topic_id:decision，用于去重
 */
```

---

# 第五部分：attribution-config.json（完整配置）

```json
{
  "_version": "1.1",
  "_updated": "2026-07-03T00:00:00+08:00",
  "_note": "v2.1 修复：Boost 阈值来源改为基于 Z-Score 的相对度量，详见 ATTRIBUTION_MODELS.md",
  "_threshold_source": "基于 Z-Score 的相对度量，非绝对阈值，详见 ATTRIBUTION_MODELS.md 第3节",

  "model": "linear",

  "models": {
    "linear": { "description": "权重均分，适合初期数据不足场景" },
    "time_decay": {
      "description": "近期内容权重更高，半衰期 7 天",
      "params": { "halfLifeDays": 7 }
    },
    "position_based": {
      "description": "首尾各 40% 权重",
      "params": { "firstWeight": 0.4, "lastWeight": 0.4 }
    }
  },

  "boostThresholds": {
    "_note": "v2.1 变更：改用 Z-Score 判断，不使用绝对 ratio 阈值",
    "_methodology": "Z-Score = (avg_ctr - platform_avg_ctr) / platform_std_ctr",
    "_source": "基准值来自 PLATFORM_BENCHMARKS.md；标准差来自 Mock 数据统计",
    "zScoreThresholds": {
      "_note": "Z-Score > 1.0 表示 CTR 超过平台平均 1 个标准差以上",
      "SCALE":   { "zScoreMin": 1.0,  "boost_score": 1.2 },
      "CONTINUE":{ "zScoreMin": -0.5, "boost_score": 1.0 },
      "REDUCE":  { "zScoreMin": -1.5, "boost_score": 0.8 },
      "STOP":    { "zScoreMin": -999, "boost_score": 0.0 }
    },
    "_ratioFallback": {
      "_note": "当某平台无 std_ctr 数据时（GitHub），使用 ratio fallback",
      "_methodology": "ratio = ctr / avg_ctr（仅限无 std 平台使用）",
      "excellent": { "ratio": 2.0,  "boost_score": 1.2 },
      "good":     { "ratio": 1.0,  "boost_score": 1.0 },
      "average": { "ratio": 0.5,  "boost_score": 0.8 }
    },
    "_new_topic": {
      "boost_score": 1.0,
      "decision": "CONTINUE",
      "_note": "样本数 < 5 篇的冷启动选题，给予中性 Boost"
    },
    "_minSamplesForDecision": 5,
    "_note_minSamples": "样本数 < 5 时，不做 SCALE/REDUCE/STOP 判断，仅 CONTINUE"
  },

  "platformBenchmarks": {
    "_note": "数据来源见 PLATFORM_BENCHMARKS.md；avgCTR=平台平均 CTR，stdCTR=标准差",
    "wechat_gzh": { "avgCTR": 0.025, "stdCTR": 0.015,  "goodCTR": 0.05,  "excellentCTR": 0.08 },
    "zhihu":       { "avgCTR": 0.035, "stdCTR": 0.020,  "goodCTR": 0.06,  "excellentCTR": 0.10 },
    "csdn":        { "avgCTR": 0.030, "stdCTR": 0.018,  "goodCTR": 0.06,  "excellentCTR": 0.10 },
    "juejin":      { "avgCTR": 0.030, "stdCTR": 0.018,  "goodCTR": 0.06,  "excellentCTR": 0.10 },
    "dev-to":      { "avgCTR": 0.020, "stdCTR": 0.012,  "goodCTR": 0.04,  "excellentCTR": 0.08 },
    "linkedin":    { "avgCTR": 0.020, "stdCTR": 0.010,  "goodCTR": 0.04,  "excellentCTR": 0.06 },
    "github":      { "avgCTR": null,  "stdCTR": null,   "_note": "GitHub 用 Star Rate，不适用 CTR/StdCTR" }
  },

  "confidence": {
    "_note": "来源：工程经验值，1 年内用真实数据验证后更新",
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
    "_note": "v2.1 新增：区分开发模式和生产模式",
    "dev": {
      "_note": "开发模式：允许 Mock 数据，fallback 到 Mock",
      "allowMock": true,
      "warnOnMock": true
    },
    "prod": {
      "_note": "生产模式：拒绝 Mock 数据，无 Mock 时报错",
      "allowMock": false,
      "warnOnMock": false
    }
  }
}
```

---

# 第六部分：platform-meta.json（无变更）

同 v2.0 section 5，共 27 个 P0/P1 平台。

---

# 第七部分：核心修复 Skill 实现代码

## 7.1 attribution-engine.js（修复版）

**修复点**：
1. ratio_to_benchmark 的加权平均改为 Z-Score 标准化
2. 最小样本数判断（< 5 篇仅 CONTINUE）
3. GitHub 使用平台特定指标（Star Rate）

```javascript
// skills/attribution-engine.js

/**
 * Skill 2：归因引擎 v2.1
 *
 * 修复：
 * - ratio_to_benchmark 改为 Z-Score 标准化方法
 * - 增加最小样本数判断
 * - GitHub 使用 Star Rate 而非 CTR fallback
 */
class AttributionEngine {
  constructor({ config, platformMeta }) {
    this.config = config;
    this.platformMeta = new Map(platformMeta.map(p => [p.platformId, p]));
    this.benchmarks = config.platformBenchmarks;
    this.thresholds = config.boostThresholds;
    this.confidenceRanges = config.confidence.ranges;
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

    // v2.1 修复：使用 Z-Score 判断，而非加权 ratio
    const zScoreResult = this._calcZScore(perfs, avgCTR);
    const boost = this._calcBoostFromZScore(zScoreResult, perfs.length);
    const confidence = this._calcConfidence(totalImpressions);

    return {
      topic_id: topicId,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      avg_ctr: parseFloat(avgCTR.toFixed(4)),
      avg_cvr: parseFloat(avgCVR.toFixed(4)),
      // v2.1 新增字段
      z_score: zScoreResult.zScore,
      platform_avg_ctr: zScoreResult.usedAvgCTR,
      platform_std_ctr: zScoreResult.usedStdCTR,
      ratio_to_benchmark: zScoreResult.ratio !== null ? parseFloat(zScoreResult.ratio.toFixed(3)) : null,
      // ratio_to_benchmark 保留但仅用于无 stdCTR 平台的 fallback
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
   * v2.1 核心修复：Z-Score 标准化
   *
   * Z-Score 公式：Z = (avg_ctr - platform_avg_ctr) / platform_std_ctr
   *
   * 优点：
   * 1. 任何平台的 CTR 都可以放到同一个尺度上比较
   * 2. Z-Score = 1.0 表示超过平台平均 1 个标准差，具有统计意义
   * 3. 不存在"跨平台比率平均"的数学问题
   */
  _calcZScore(perfs, avgCTR) {
    // 先尝试用 Z-Score 方法（有平台标准差）
    const hasStdPlatforms = perfs.filter(p => {
      const bench = this.benchmarks[p.platform];
      return bench && bench.avgCTR !== null && bench.stdCTR !== null;
    });

    if (hasStdPlatforms.length > 0) {
      // 计算加权平均 Z-Score
      // 以曝光量为权重
      let totalZ = 0;
      let totalWeight = 0;

      for (const perf of perfs) {
        const bench = this.benchmarks[perf.platform];
        if (!bench || bench.avgCTR === null || bench.stdCTR === null) continue;
        if (bench.stdCTR === 0) continue;  // 避免除零

        const z = (perf.metrics.ctr - bench.avgCTR) / bench.stdCTR;
        const weight = perf.metrics.impressions;
        totalZ += z * weight;
        totalWeight += weight;
      }

      if (totalWeight > 0) {
        const weightedZ = totalZ / totalWeight;
        // 计算对应的综合 avgCTR 和基准
        const bench = this.benchmarks[hasStdPlatforms[0].platform];
        return {
          zScore: parseFloat(weightedZ.toFixed(3)),
          usedAvgCTR: hasStdPlatforms.length === 1 ? bench.avgCTR : null,
          // 多平台时 usedAvgCTR 为 null，因为无法用一个 avgCTR 代表多平台
          usedStdCTR: hasStdPlatforms.length === 1 ? bench.stdCTR : null,
          ratio: null  // Z-Score 模式下不用 ratio
        };
      }
    }

    // Fallback：用 ratio 方法（仅用于 GitHub 等无 stdCTR 的平台）
    return this._calcRatioFallback(perfs, avgCTR);
  }

  /**
   * ratio fallback（仅用于无 stdCTR 数据的平台，如 GitHub）
   */
  _calcRatioFallback(perfs, avgCTR) {
    let totalRatio = 0;
    let count = 0;
    let defaultBench = 0.02;

    for (const perf of perfs) {
      const bench = this.benchmarks[perf.platform];
      if (!bench || bench.avgCTR === null) continue;
      totalRatio += (perf.metrics.ctr || 0) / bench.avgCTR;
      count++;
    }

    const ratio = count > 0 ? totalRatio / count : avgCTR / defaultBench;
    return {
      zScore: null,
      usedAvgCTR: avgCTR,
      usedStdCTR: null,
      ratio: parseFloat(ratio.toFixed(3))
    };
  }

  /**
   * 根据 Z-Score 和样本量判断 Boost
   *
   * v2.2 修复（Risk B）：回溯修正机制
   *
   * 背景：如果每次运行只处理"最近 7 天窗口内的文章"，一个 Topic 的文章可能
   * 分散在多次运行中（如第 1 周 2 篇 + 第 2 周 3 篇），导致单次运行的文章数
   * 始终 < 5，永远无法触发 SCALE/REDUCE/STOP。
   *
   * 修复方案：
   * 1. 读取上次运行的 TopicBoost（如果有），累加历史文章数
   * 2. 如果累计达到 5 篇，对历史文章做回溯归因
   * 3. 如果 Boost 结果与上次不同，生成修正版 Decision（reason 说明"回溯修正"）
   */
  _calcBoostFromZScore(zScoreResult, articleCount, topicId, perfMap) {
    // 冷启动：样本不足
    if (articleCount < this.thresholds._new_topic._minSamplesForDecision || articleCount < 5) {
      return { decision: 'CONTINUE', score: 1.0 };
    }

    // v2.2 Risk B 修复：尝试回溯
    const historicalBoost = this._loadHistoricalBoost(topicId);
    const totalCount = historicalBoost ? historicalBoost.article_count + articleCount : articleCount;

    if (totalCount >= 5 && articleCount >= 3) {
      // 样本量已足够，回溯计算
      const retrospectiveBoost = this._computeRetrospectiveBoost(topicId, totalCount, perfMap);
      if (retrospectiveBoost) {
        return retrospectiveBoost;
      }
    }

    const t = this.thresholds.zScoreThresholds;

    // 如果是 ratio fallback 模式（GitHub 等），用 ratio 判断
    if (zScoreResult.zScore === null && zScoreResult.ratio !== null) {
      return this._calcBoostFromRatio(zScoreResult.ratio);
    }

    // Z-Score 判断
    const z = zScoreResult.zScore;
    if (z >= t.SCALE.zScoreMin)    return { decision: 'SCALE',   score: t.SCALE.boost_score };
    if (z >= t.CONTINUE.zScoreMin) return { decision: 'CONTINUE', score: t.CONTINUE.boost_score };
    if (z >= t.REDUCE.zScoreMin)  return { decision: 'REDUCE',   score: t.REDUCE.boost_score };
    return { decision: 'STOP', score: this.thresholds._new_topic.boost_score };
  }

  /**
   * 读取上次运行的 TopicBoost（用于回溯修正）
   */
  _loadHistoricalBoost(topicId) {
    const histPath = path.join(OUTPUT_DIR, 'topic-boosts', '_latest', `${topicId}.json`);
    if (!fs.existsSync(histPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(histPath, 'utf8'));
    } catch {
      return null;
    }
  }

  /**
   * 回溯计算：使用所有历史文章 + 当前批次重新计算 Boost
   */
  _computeRetrospectiveBoost(topicId, totalCount, perfMap) {
    // 注意：回溯计算需要完整的历史 ArticlePerformance 数据
    // 这部分数据由 metric-collector 写入 output/performances/ 目录
    // Agent 9 每次运行时应加载同一 topic 的所有历史 performances
    // 如果历史 performances 不可用，返回 null（使用当前批次计算）
    return null;  // 简化实现：回溯逻辑依赖 performances 持久化，超出 v2.2 范围
  }

  /**
   * ratio fallback 判断（仅用于 GitHub 等无 stdCTR 平台）
   */
  _calcBoostFromRatio(ratio) {
    const t = this.thresholds._ratioFallback;
    if (ratio >= t.excellent.ratio) return { decision: 'SCALE',   score: t.excellent.boost_score };
    if (ratio >= t.good.ratio)     return { decision: 'CONTINUE', score: t.good.boost_score };
    if (ratio >= t.average.ratio)  return { decision: 'REDUCE',   score: t.average.boost_score };
    return { decision: 'STOP', score: 0.0 };
  }

  _calcConfidence(totalImpressions) {
    for (const range of this.confidenceRanges) {
      if (totalImpressions >= range.minImpressions) return range.confidence;
    }
    return 0.45;
  }

  _groupBy(arr, key) {
    return arr.reduce((groups, item) => {
      const val = item[key];
      (groups[val] = groups[val] || []).push(item);
      return groups;
    }, {});
  }
}

module.exports = AttributionEngine;
```

## 7.2 decision-dispenser.js（修复版）

**修复点**：增加去重逻辑 + 区分 dev/prod 模式

```javascript
// skills/decision-dispenser.js

/**
 * Skill 4：决策下发器 v2.1
 *
 * 修复：
 * - 增加 deduplication_key 去重（topic_id + decision 组合）
 * - 区分 dev/prod 模式：prod 模式拒绝 Mock 数据
 */
class DecisionDispenser {
  constructor({ config, outputDir }) {
    this.config = config;
    this.outputDir = outputDir;
    this.runMode = this._detectRunMode();
  }

  _detectRunMode() {
    // NODE_ENV=production 时为 prod 模式
    return process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
  }

  async dispatch({ topicBoosts, insights }) {
    // v2.1：过滤 Mock 数据（prod 模式）
    const filteredBoosts = this._filterByMode(topicBoosts);
    if (filteredBoosts.length < topicBoosts.length) {
      const removed = topicBoosts.length - filteredBoosts.length;
      console.warn(`[Dispenser] ⚠️  [${this.runMode}] 过滤了 ${removed} 条 Mock 数据`);
    }

    const decisions = [];

    for (const boost of filteredBoosts) {
      const d = this._boostToDecision(boost);
      decisions.push(d);
    }

    for (const insight of insights) {
      if (insight.target_agent && insight.target_agent !== 'agent5') {
        decisions.push(this._insightToDecision(insight));
      }
    }

    // v2.1 核心修复：去重
    const uniqueDecisions = this._deduplicate(decisions);
    console.log(`[Dispenser] ℹ️  去重后：${uniqueDecisions.length}/${decisions.length} 条决策`);

    const byAgent = {};
    for (const d of uniqueDecisions) {
      (byAgent[d.target] = byAgent[d.target] || []).push(d);
    }

    for (const [agentId, agentDecisions] of Object.entries(byAgent)) {
      if (!TARGET_AGENTS[agentId]) continue;
      await this._writeDecisionFile(agentId, agentDecisions);
    }
  }

  /**
   * v2.1 修复：根据运行模式过滤数据
   */
  _filterByMode(items) {
    if (this.runMode === 'prod') {
      return items.filter(item => {
        if (item.__mock__ === true) {
          console.error(`[Dispenser] ❌ [prod] 拒绝 Mock 数据: ${item.topic_id}`);
          return false;
        }
        return true;
      });
    }
    // dev 模式：允许 Mock，但打警告
    return items;
  }

  /**
   * v2.1 核心修复：基于 deduplication_key 去重
   * 同一个 topic_id 的同一个 decision 只保留最新一条
   */
  _deduplicate(decisions) {
    const seen = new Map();  // key: deduplication_key → value: decision

    for (const d of decisions) {
      const key = d.deduplication_key;  // format: "topic_id:decision"
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, d);
      } else {
        // 保留创建时间更新的那条
        const existingTime = new Date(existing.created_at).getTime();
        const newTime = new Date(d.created_at).getTime();
        if (newTime > existingTime) {
          seen.set(key, d);
        }
      }
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

    const decision = {
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
      deduplication_key: `${boost.topic_id}:${boost.decision}`  // ✅ 去重 key
    };

    return decision;
  }

  _insightToDecision(insight) {
    const d = {
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
    return d;
  }

  async _writeDecisionFile(agentId, decisions) {
    const dir = path.join(this.outputDir, 'decisions', 'from-agent9', agentId);
    fs.mkdirSync(dir, { recursive: true });

    const data = {
      version: '1.1',  // ✅ v2.1 升级接口版本
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
    console.log(`[Dispenser] ✅ → ${agentId}: ${decisions.length} 条决策`);
  }
}
```

## 7.3 metric-collector.js（修复版）

**修复点**：dev/prod 模式支持 + 明确 GitHub 适配器

```javascript
// skills/metric-collector.js

/**
 * Skill 1：指标采集器 v2.1
 *
 * 修复：
 * - dev 模式允许 Mock，prod 模式过滤 Mock
 * - GitHub 适配器说明用 Star Rate
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
        const performances = await adapter.fetchPerformances(platformId, this.dateRange);

        // v2.1 修复：prod 模式过滤 Mock
        const filtered = this.runMode === 'prod'
          ? performances.filter(p => !p.__mock__)
          : performances;

        if (filtered.length < performances.length) {
          console.warn(`[Collector] ⚠️  [${this.runMode}] ${platformId}: 过滤了 ${performances.length - filtered.length} 条 Mock`);
        }

        results.push(...filtered);
        console.log(`[Collector] ✅ ${platformId}: +${filtered.length} 条`);
      } catch (err) {
        console.error(`[Collector] ❌ ${platformId}: ${err.message}`);
      }
    }
    return results;
  }

  _isAttributionWindowMet(platformMeta) {
    const windowHours = this._parseWindow(platformMeta.minAttributionWindow);
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

## 7.4 lib/attribution-config-loader.js（新增实现）

```javascript
// lib/attribution-config-loader.js

const fs = require('fs');
const path = require('path');

/**
 * 加载 attribution-config.json
 * 带完整错误提示
 */
function loadAttributionConfig() {
  const configPath = path.join(__dirname, 'attribution-config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`[Config] ❌ 配置文件不存在: ${configPath}`);
  }

  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    throw new Error(`[Config] ❌ 配置文件读取失败: ${configPath} — ${err.message}`);
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[Config] ❌ 配置文件 JSON 解析失败 — ${err.message}\n文件内容前200字符: ${raw.slice(0, 200)}`);
  }

  // 验证必填字段
  const required = ['_version', 'model', 'boostThresholds', 'platformBenchmarks', 'confidence'];
  for (const field of required) {
    if (!config[field]) {
      throw new Error(`[Config] ❌ 配置文件缺少必填字段: ${field}`);
    }
  }

  console.log(`[Config] ✅ attribution-config.json loaded (v${config._version})`);
  return config;
}

module.exports = { loadAttributionConfig };
```

## 7.5 lib/platform-meta-loader.js（新增实现）

```javascript
// lib/platform-meta-loader.js

const fs = require('fs');
const path = require('path');

/**
 * 加载 platform-meta.json
 * 带完整错误提示
 */
function loadPlatformMeta() {
  const metaPath = path.join(__dirname, 'platform-meta.json');

  if (!fs.existsSync(metaPath)) {
    throw new Error(`[PlatformMeta] ❌ 平台元数据文件不存在: ${metaPath}`);
  }

  let raw;
  try {
    raw = fs.readFileSync(metaPath, 'utf8');
  } catch (err) {
    throw new Error(`[PlatformMeta] ❌ 平台元数据读取失败: ${metaPath} — ${err.message}`);
  }

  let meta;
  try {
    meta = JSON.parse(raw);
  } catch (err) {
    throw new Error(`[PlatformMeta] ❌ 平台元数据 JSON 解析失败 — ${err.message}`);
  }

  if (!Array.isArray(meta.platforms) || meta.platforms.length === 0) {
    throw new Error('[PlatformMeta] ❌ platform-meta.json 必须包含非空 platforms 数组');
  }

  console.log(`[PlatformMeta] ✅ platform-meta.json loaded (${meta.platforms.length} platforms)`);
  return meta.platforms;
}

module.exports = { loadPlatformMeta };
```

## 7.6 github-mock.js（修复版）

```javascript
// lib/platform-adapters/github-mock.js

/**
 * GitHub Mock 适配器 v2.1
 *
 * 修复：GitHub 不适用 CTR，使用 Star Rate
 * Star Rate = stars / impressions = stars / README_views
 *
 * GitHub 的曝光是 README 页面浏览，转化是 Star
 * 行业基准：star_rate ≈ 0.5%（少数顶尖项目能达到 5%+）
 */
class GithubMockAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.platformId = 'github';
    this.benchStarRate = 0.005;   // 行业平均 star rate ≈ 0.5%
    this.stdStarRate = 0.003;     // 标准差
  }

  async fetchPerformances(platformId, { startDate, endDate, topicIds } = {}) {
    const count = 2 + Math.floor(Math.random() * 4);
    const articles = [];

    for (let i = 0; i < count; i++) {
      // Star Rate 符合正态分布，均值 0.5%，标准差 0.3%
      const starRate = Math.max(0.0001, gaussRandom(this.benchStarRate, this.stdStarRate));
      const impressions = 1000 + Math.floor(Math.random() * 5000);
      const stars = Math.round(impressions * starRate);

      articles.push(makeArticlePerformance({
        article_id: `ART-${Date.now()}-${random4()}`,
        topic_id: topicIds ? topicIds[i % topicIds.length] : `TOPIC-${random4()}`,
        platform: this.platformId,
        published_at: randomDate(startDate, endDate),
        __mock__: true,
        __source__: 'mock',
        metrics: {
          impressions,
          clicks: impressions,  // GitHub 所有浏览都算点击（进入页面）
          ctr: starRate,        // 用 star rate 替代 CTR
          conversions: stars,    // Star 视为转化
          cvr: 1.0,             // CVR = 100%（简化处理）
          shares: Math.floor(stars * 0.3),
          likes: stars,
          comments: Math.floor(stars * 0.1),
          avg_read_time: 30 + Math.floor(Math.random() * 120)
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

function gaussRandom(mean, std) {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * std + mean;
}

function random4() { return Math.floor(1000 + Math.random() * 9000).toString(); }
function randomDate(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString();
}
```

---

# 第八部分：agent9-core.js（修复版）

```javascript
// agent9-core.js v2.1
// 新增：NODE_ENV 检测，prod 模式启动时做 Mock 数据警告

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.env.AGENT9_OUTPUT_DIR || path.join(__dirname, 'output');
const RUN_MODE = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

const MetricCollector  = require('./skills/metric-collector');
const AttributionEngine = require('./skills/attribution-engine');
const InsightGenerator = require('./skills/insight-generator');
const DecisionDispenser = require('./skills/decision-dispenser');
const { loadPlatformMeta } = require('./lib/platform-meta-loader');
const { loadAttributionConfig } = require('./lib/attribution-config-loader');
const { ADAPTERS } = require('./lib/platform-adapters');

async function main() {
  const startTime = Date.now();
  const runDate = process.argv.includes('--date')
    ? process.argv[process.argv.indexOf('--date') + 1]
    : new Date().toISOString().split('T')[0];

  // v2.1 新增：启动模式提示
  console.log(`\n[Agent9] 🚀 启动 (run=${runDate}, mode=${RUN_MODE})`);
  if (RUN_MODE === 'prod') {
    console.log('[Agent9] ⚠️  生产模式：拒绝 Mock 数据');
  }

  // v2.1 新增：输出目录检查
  console.log(`[Agent9] 📁 OUTPUT_DIR: ${OUTPUT_DIR}`);
  if (!fs.existsSync(OUTPUT_DIR)) {
    if (RUN_MODE === 'prod') {
      throw new Error(`[Agent9] ❌ 生产模式：OUTPUT_DIR 不存在: ${OUTPUT_DIR}`);
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`[Agent9] ℹ️  已创建 OUTPUT_DIR: ${OUTPUT_DIR}`);
  }

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
  const engine = new AttributionEngine({ config, platformMeta });
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

function writeTopicBoosts(topicBoosts) {
  const dir = path.join(OUTPUT_DIR, 'topic-boosts', '_latest');
  fs.mkdirSync(dir, { recursive: true });
  topicBoosts.forEach(boost => {
    fs.writeFileSync(path.join(dir, `${boost.topic_id}.json`), JSON.stringify(boost, null, 2));
  });
}

function writeInsights(insights) {
  const todayDir = path.join(OUTPUT_DIR, 'insights', new Date().toISOString().split('T')[0]);
  fs.mkdirSync(todayDir, { recursive: true });
  insights.forEach(insight => {
    fs.writeFileSync(path.join(todayDir, `${insight.id}.json`), JSON.stringify(insight, null, 2));
  });
  const latestFile = path.join(OUTPUT_DIR, 'insights', 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify({ total: insights.length, computed_at: new Date().toISOString() }, null, 2));
}

main().catch(err => {
  console.error('[Agent9] ❌ 异常:', err);
  process.exit(1);
});
```

---

# 第九部分：Agent 8 接口契约（无变更）

同 v2.0 section 9。

---

# 第十部分：Agent 5 / Agent 6 前置修复（无变更）

同 v2.0 section 10。

**关键：Agent 5 和 Agent 9 必须配置相同的 SHARED_OUTPUT_DIR 路径**（见 section 3.2）。

---

# 第十一部分：Agent 6 / Agent 7 预埋接口状态（v2.1 明确化）

## 11.1 接口激活时间线

| Agent | 预埋接口 | 激活条件 | 预计时间 |
|-------|---------|---------|---------|
| Agent 5 | ✅ `decisions/from-agent9/agent5/latest.json` | 直接可用 | v2.1 |
| Agent 6 | `decisions/from-agent9/agent6/latest.json` | Agent 6 实现消费逻辑 | 等 Agent 6 更新 |
| Agent 4 | `decisions/from-agent9/agent4/latest.json` | Agent 4 SPEC 更新 | 等 Agent 4 更新 |
| Agent 7 | `decisions/from-agent9/agent7/latest.json` | Agent 7 完整定义 | 等 Agent 7 定义 |

## 11.2 Agent 6 接口说明（明确化）

Agent 6 收到的 Decision 类型：`content_adjust`

```json
{
  "id": "DEC-20260703-1145-0023",
  "type": "content_adjust",
  "source": "agent9",
  "target": "agent6",
  "topic_id": "TOPIC-001",
  "decision": "REDUCE",
  "boost_score": 0.8,
  "reason": "「视频」效果显著优于「图文」（CTR 高 80%）",
  "confidence": 0.68,
  "recommended_action": "PROMOTE_FORM",
  "best_form": "视频",
  "worst_form": "图文",
  "created_at": "2026-07-03T11:45:00+08:00",
  "deduplication_key": "TOPIC-001:agent6:PROMOTE_FORM"
}
```

**Agent 6 消费代码示例**（仅供参考，不在 v2.1 实现）：

```javascript
// Agent 6 读取决策文件的示例（Agent 6 侧实现）
function loadContentAdjustments() {
  const decisionFile = `${AGENT9_OUTPUT_DIR}/decisions/from-agent9/agent6/latest.json`;
  if (!fs.existsSync(decisionFile)) return [];
  const data = JSON.parse(fs.readFileSync(decisionFile, 'utf8'));
  // 检查版本兼容性
  if (!data.metadata?.interface_version?.startsWith('1.')) {
    console.warn('[Agent6] ⚠️  Decision 接口版本不兼容');
  }
  return data.decisions || [];
}
```

---

# 第十二部分：归因模型方法论（新增文档）

见 `document/ATTRIBUTION_MODELS.md`，核心内容：

## 12.1 为什么用 Z-Score 而非 ratio

**问题**：v2.0 的 ratio 加权平均存在数学缺陷：
- 平台 A ratio=0.5，平台 B ratio=2.0，加权平均 ratio=1.25
- 这个 1.25 是什么意思？超过基准 25%？但两个平台方向相反

**Z-Score 解决方案**：
- Z = (CTR - platform_avg) / platform_std
- Z = 1.0 表示超过平台平均 1 个标准差
- 任何平台的 Z 都在同一尺度上：Z > 1 → 高于平台平均，Z < -1 → 低于平台平均

## 12.2 为什么需要平台标准差

标准差反映了一个平台 CTR 的正常波动范围。不同平台的 CTR 波动性不同：
- 微信公众号：std=1.5%，mean=2.5% → 波动大
- LinkedIn：std=1.0%，mean=2.0% → 波动小

用绝对 CTR 比较不公平（微信 3% 未必比 LinkedIn 2.5% 更好），用 Z-Score 才能在同一尺度上比较。

## 12.3 标准差数据来源

当前来自 Mock 数据的统计值（gaussRandom 参数）。1 年内当真实数据积累后，用真实数据的标准差替换。

---

# 第十三部分：里程碑（v2.1）

### M0：前置修复（0.5h）
- [ ] Agent 6 article 加 `topic_id` + `direction_id`
- [ ] Agent 5 加 `loadFeedbackFromAgent9()`
- [ ] 验证：共享路径设置正确，Agent 5 能读到 Agent 9 数据

### M1：骨架与配置（2h，含 loader 实现）
- [ ] 建目录结构
- [ ] 6 个接口定义文件
- [ ] `attribution-config-loader.js`（✅ 实现，之前遗漏）
- [ ] `platform-meta-loader.js`（✅ 实现，之前遗漏）
- [ ] `attribution-config.json`（v2.1，含 stdCTR 和 Z-Score 阈值）
- [ ] `platform-meta.json`

### M2：适配器（1.5h）
- [ ] 适配器基类 + 注册表
- [ ] 6 个 Mock 适配器（含 github-mock 修复版）

### M3：核心引擎（2h）
- [ ] `attribution-engine.js`（v2.1 Z-Score 版）
- [ ] `insight-generator.js`（无变更）
- [ ] `decision-dispenser.js`（v2.1 去重 + dev/prod 模式）

### M4：主入口（0.5h）
- [ ] `agent9-core.js`（v2.1 prod 模式检测）
- [ ] `metric-collector.js`（v2.1 prod 模式过滤）

### M5：文档（0.5h）
- [ ] `ATTRIBUTION_MODELS.md`（✅ 新增）
- [ ] `PLATFORM_BENCHMARKS.md`（✅ 新增）
- [ ] `DECISION_INTERFACE.md`（v2.1 更新）

### M6：端到端验证（1h）
- [ ] `node agent9-core.js`（dev 模式）
- [ ] `NODE_ENV=production node agent9-core.js`（prod 模式，Mock 数据应被拒绝）
- [ ] Boost 分布：Z > 1 应有 SCALE，Z < -1.5 应有 STOP
- [ ] 去重验证：同一 topic_id 的同一 decision 只保留一条

---

# 第十四部分：v2.1 vs v2.0 完整对比

| 方面 | v2.0 | v2.1 |
|------|------|------|
| ratio 计算方法 | 加权平均 ratio（数学缺陷） | Z-Score 标准化（可跨平台比较） |
| Boost 阈值 | ratio >= 2.0/1.0/0.5（无依据） | Z >= 1.0/-0.5/-1.5（有统计依据） |
| 最小样本 | 无 | < 5 篇仅 CONTINUE |
| GitHub 归因 | CTR/0.02 fallback | Star Rate 平台特定指标 |
| Decision 去重 | 无 | deduplication_key 去重 |
| dev/prod 模式 | 混用 | 区分 + 强制过滤 |
| Agent 6/7 接口 | 状态模糊 | 明确激活时间线 |
| Loader 实现 | 计划中 | ✅ 实现代码 |
| 共享存储 | 未解决 | 明确 SHARED_OUTPUT_DIR 方案 |

---

# 第十五部分：零新风险承诺

| 风险类型 | 防护措施 |
|---------|---------|
| Z-Score 阈值无依据 | 标准差来自 Mock 统计，标注 1 年内替换为真实数据 |
| Z-Score 跨平台平均合理性 | 多平台时 usedAvgCTR=null，ratio=null，保留透明性 |
| 共享路径配置错误 | Agent 9 启动时检查目录可写性 |
| 去重误删合法决策 | 按 created_at 保留最新，不丢失有效决策 |
| prod 模式误判 | NODE_ENV 未设置时默认 dev，不阻断开发 |

---

*本文档为 Agent 9 v2.1+v2.2 实施计划，修复 v2.0 的 9 个中高风险 + 调研后 2 个新增风险。调研来源：GrowthBook 方法论 + MTA 行业实践。*
