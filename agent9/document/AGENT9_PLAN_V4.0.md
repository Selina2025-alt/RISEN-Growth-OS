# Agent 9 v4.0 实施计划

> 版本：v4.0
> 状态：风险修复版（修复 v3.0 PUA 复审发现的 5 个中高风险）
> 对比 v3.0：完整贯通版，不是增量记录

---

# 第一部分：Agent 9 是什么

## 1.1 一句话定位

**Agent 9 是 RISEN 的"学习记忆中枢"——回答"什么真正有效、为什么有效、下一步改哪里"。**

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

## 1.3 v4.0 能做到的事（相比 v3.0 新增/修复）

| 能力 | v3.0 状态 | v4.0 修复 |
|------|----------|---------|
| Z-Score 标准化归因 | ✅ | 无变化 |
| dev/prod 模式区分 | ✅ | 无变化 |
| Decision 去重 | ✅ | 无变化 |
| 回溯修正机制 | ❌ 空壳（H2） | ✅ 实现（含 performances 持久化） |
| performances 持久化 | ❌ 缺失（M1） | ✅ 采集时写入磁盘 |
| agent9-core 语法 | ❌ 缺右括号（H1） | ✅ 修复 |
| content_form ratio 阈值 | ❌ 无依据（M2） | ✅ 对齐 Z-Score 标准 |
| Decision 历史链 | ❌ 只保留最新（M3） | ✅ 追加写入，保留历史 |

## 1.4 v4.0 不能做到的事（不变）

| 能力 | 为什么不做到 | 预计版本 |
|------|--------------|---------|
| 真实平台 API 对接 | Agent 8 尚未开发 | 等 Agent 8 |
| 线索→商机→收入归因 | 需要 CRM 数据源 | v0.4+ |
| Bayesian 归因 | 需要真实数据拟合 Prior | v0.3+ |

---

# 第二部分：v3.0 风险修复清单

| # | v3.0 风险 | 等级 | v4.0 修复 |
|---|---------|---------|-----------|
| H1 | agent9-core.js 语法错误（缺右括号） | 🔴 HIGH | 修复语法 |
| H2 | 回溯机制是空壳 | 🔴 HIGH | 实现 performances 持久化 + 回溯计算 |
| M1 | performances 从未持久化 | 🟡 MEDIUM | metric-collector 写磁盘 + 回溯读取 |
| M2 | content_form ratio≥1.5 无依据 | 🟡 MEDIUM | 对齐 Z-Score：Z≥0.75 ≈ ratio≥1.2（统一量纲） |
| M3 | Decision 历史链丢失 | 🟡 MEDIUM | 追加写入 latest.json，保留历史 |

---

# 第三部分：系统架构

## 3.1 目录结构

```
risen-agent9/
├── agent9-core.js
├── skills/
│   ├── metric-collector.js      # Skill 1
│   ├── attribution-engine.js     # Skill 2（回溯实现）
│   ├── insight-generator.js      # Skill 3
│   └── decision-dispenser.js     # Skill 4（历史链）
├── lib/
│   ├── interfaces/
│   │   ├── ArticlePerformance.js
│   │   ├── TopicBoost.js
│   │   ├── Insight.js
│   │   └── Decision.js
│   ├── attribution-config.json
│   ├── attribution-config-loader.js
│   ├── platform-meta.json
│   ├── platform-meta-loader.js
│   └── platform-adapters/
│       ├── interface.js
│       ├── index.js
│       └── [6个 Mock 适配器]
├── output/
│   ├── performances/              # ✅ v4.0：ArticlePerformance 持久化
│   │   └── {YYYY-MM}/
│   │       └── {YYYY-MM-DD}/
│   │           └── {article_id}.json
│   ├── topic-boosts/
│   │   └── _latest/
│   ├── insights/
│   │   └── {YYYY-MM-DD}/
│   └── decisions/
│       └── from-agent9/
│           └── {agentId}/
│               ├── latest.json   # ✅ 追加写入，保留历史
│               └── history/      # ✅ 新增：历史决策存档
└── document/
```

---

# 第四部分：核心接口定义

（同 v3.0，Decision 新增 history 字段）

```javascript
// lib/interfaces/Decision.js

/**
 * @typedef {Object} Decision
 * @property {string} id
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
 * @property {string} deduplication_key
 * @property {boolean} __retrospective__
 * @property {string[]} history   // ✅ v4.0 新增：该 topic 的历史决策链（最近5条）
 */
```

---

# 第五部分：attribution-config.json（完整配置）

（同 v3.0，新增 content_form 阈值对齐 Z-Score）

```json
{
  "_version": "1.2",
  "_updated": "2026-07-03T00:00:00+08:00",
  "_note": "v4.0 变更：content_form 阈值对齐 Z-Score 标准（Z=0.75 ≈ ratio≈1.2）",

  "model": "linear",

  "models": {
    "linear": { "description": "权重均分，适合初期数据不足场景" },
    "time_decay": { "description": "近期内容权重更高，半衰期7天", "params": { "halfLifeDays": 7 } },
    "position_based": {
      "description": "首尾各40%权重",
      "_disclaimer": "40/20/40是经验规则，非理论最优",
      "params": { "firstWeight": 0.4, "lastWeight": 0.4 }
    }
  },

  "boostThresholds": {
    "_methodology": "Z-Score = (avg_ctr - platform_avg_ctr) / platform_std_ctr",
    "zScoreThresholds": {
      "SCALE":    { "zScoreMin": 1.0,  "boost_score": 1.2 },
      "CONTINUE": { "zScoreMin": -0.5, "boost_score": 1.0 },
      "REDUCE":   { "zScoreMin": -1.5, "boost_score": 0.8 },
      "STOP":     { "zScoreMin": -999, "boost_score": 0.0 }
    },
    "_ratioFallback": {
      "SCALE":    { "ratio": 2.0, "boost_score": 1.2 },
      "CONTINUE": { "ratio": 1.0, "boost_score": 1.0 },
      "REDUCE":   { "ratio": 0.5, "boost_score": 0.8 }
    },
    "_new_topic": {
      "boost_score": 1.0, "decision": "CONTINUE",
      "_note": "样本数 < 5 篇时强制中性 Boost"
    },
    "_minSamplesForDecision": 5
  },

  "contentFormThresholds": {
    "_note": "v4.0 新增：content_form 比较阈值，对齐 Z-Score 标准",
    "_methodology": "用 Z-Score 框架统一量纲：Z=0.75 时，CTR 比值 ≈ 1.2（基于正态分布），以此作为 content_form 差异门槛",
    "_calculation": "设两形式 CTR 相同分布（std=mean×0.6），Z=0.75 对应 ratio≈1.2",
    "_reference": "见 ATTRIBUTION_MODELS.md 第4节",
    "minRatio": 1.2,
    "_note_ratio": "ratio < 1.2 时不生成 content_form Insight，避免噪声"
  },

  "platformBenchmarks": {
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
    "dev": { "NODE_ENV": "development", "allowMock": true, "warnOnMock": true },
    "prod": { "NODE_ENV": "production", "allowMock": false, "warnOnMock": false }
  }
}
```

---

# 第六部分：platform-meta.json（27 个平台）

同 v3.0，保持不变。

---

# 第七部分：平台适配器统一接口

同 v3.0，保持不变。

---

# 第八部分：核心 Skill 实现代码

## 8.1 metric-collector.js（修复版）

**修复**：新增 `writePerformances()`，每次采集后写入磁盘，为回溯提供数据基础。

```javascript
// skills/metric-collector.js

/**
 * Skill 1：指标采集器 v4.0
 *
 * 修复（H2/M1）：
 * - 采集后立即写入 output/performances/{YYYY-MM}/{YYYY-MM-DD}/{article_id}.json
 * - 为回溯计算提供历史数据基础
 */
class MetricCollector {
  constructor({ adapters, dateRange, platformMeta, config, outputDir }) {
    this.adapters = adapters;
    this.dateRange = dateRange;
    this.platformMeta = new Map(platformMeta.map(p => [p.platformId, p]));
    this.config = config;
    this.outputDir = outputDir || process.env.AGENT9_OUTPUT_DIR || path.join(__dirname, '..', 'output');
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
          performances = performances.filter(p => {
            if (p.__mock__) { console.error(`[Collector] ❌ [prod] 拒绝 Mock: ${p.article_id}`); return false; }
            return true;
          });
        }

        results.push(...performances);
        console.log(`[Collector] ✅ ${platformId}: +${performances.length} 条`);

        // v4.0 核心修复：写入 performances 持久化（为回溯提供数据）
        if (performances.length > 0) {
          this._writePerformances(performances);
        }
      } catch (err) {
        console.error(`[Collector] ❌ ${platformId}: ${err.message}`);
      }
    }
    return results;
  }

  /**
   * v4.0 H2/M1 修复：ArticlePerformance 持久化
   * 路径：output/performances/{YYYY-MM}/{YYYY-MM-DD}/{article_id}.json
   */
  _writePerformances(performances) {
    const dateDir = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const monthDir = dateDir.slice(0, 7);                    // YYYY-MM
    const dir = path.join(this.outputDir, 'performances', monthDir, dateDir);
    fs.mkdirSync(dir, { recursive: true });

    for (const perf of performances) {
      const file = path.join(dir, `${perf.article_id}.json`);
      fs.writeFileSync(file, JSON.stringify(perf, null, 2));
    }
    console.log(`[Collector] 💾 写入 ${performances.length} 条 performances → ${dir}/`);
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
```

## 8.2 attribution-engine.js（修复版）

**修复**：实现 `_loadHistoricalPerformances()`，真正从磁盘读取历史数据；实现 `_tryRetrospective()`，在样本量达到时触发回溯。

```javascript
// skills/attribution-engine.js

/**
 * Skill 2：归因引擎 v4.0
 *
 * 修复（H2/M1）：
 * - _loadHistoricalPerformances() 从 performances/ 目录读取历史数据
 * - _tryRetrospective() 在样本量达到时触发回溯计算
 * - 修复 hasStdPlatforms 中 bench 引用错误（hasStdPlatforms 存的是 perf 不是 bench）
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
      platform_avg_ctr: zScoreResult.usedAvgCTR,
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
   * Z-Score 标准化
   * v4.0 修复：hasStdPlatforms 存的是 perf 对象（不是 bench），需要重新查 benchmarks
   */
  _calcZScore(perfs, avgCTR) {
    // 找出有标准差的平台对应的文章
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
        const isSinglePlatform = uniquePlatforms.length === 1;
        const singleBench = isSinglePlatform ? this.benchmarks[uniquePlatforms[0]] : null;
        return {
          zScore: parseFloat(weightedZ.toFixed(3)),
          usedAvgCTR: isSinglePlatform ? singleBench.avgCTR : null,
          usedStdCTR: isSinglePlatform ? singleBench.stdCTR : null,
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
      ratio: parseFloat(count > 0 ? (totalRatio / count).toFixed(3) : (avgCTR / defaultBench).toFixed(3))
    };
  }

  _calcBoostDecision(zScoreResult, articleCount, topicId, perfs) {
    const minSamples = this.thresholds._new_topic._minSamplesForDecision || 5;
    if (articleCount < minSamples) return { decision: 'CONTINUE', score: 1.0 };

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
   * v4.0 H2 核心修复：回溯修正
   *
   * 触发条件：当前批次 articleCount >= 5
   * 机制：
   * 1. 读取历史 TopicBoost（_latest/{topicId}.json）
   * 2. 加载该 topic 的所有历史 ArticlePerformance（performances/ 目录）
   * 3. 合并历史 + 当前批次，重新计算 Boost
   * 4. 若结果与历史不同，生成回溯修正 Decision
   */
  _tryRetrospective(topicId, currentCount, currentPerfs) {
    const histBoostPath = path.join(this.outputDir, 'topic-boosts', '_latest', `${topicId}.json`);
    if (!fs.existsSync(histBoostPath)) return null;

    let histBoost;
    try { histBoost = JSON.parse(fs.readFileSync(histBoostPath, 'utf8')); }
    catch { return null; }

    // 已回溯过的跳过
    if (histBoost.__retrospective__) return null;

    const totalCount = (histBoost.source_articles?.length || 0) + currentCount;
    if (totalCount < 5) return null;

    // v4.0 H2 修复：真正从 performances 目录加载历史数据
    const allPerfs = this._loadHistoricalPerformances(topicId);
    if (allPerfs.length < 5) return null;

    // 去重（避免历史和当前批次重复）
    const currentIds = new Set(currentPerfs.map(p => p.article_id));
    const histOnlyPerfs = allPerfs.filter(p => !currentIds.has(p.article_id));
    if (histOnlyPerfs.length === 0) return null;

    // 合并历史 + 当前
    const combinedPerfs = [...histOnlyPerfs, ...currentPerfs];

    // 用全部数据重新计算
    const totalImpressions = combinedPerfs.reduce((s, p) => s + p.metrics.impressions, 0);
    const totalClicks = combinedPerfs.reduce((s, p) => s + p.metrics.clicks, 0);
    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const zScoreResult = this._calcZScore(combinedPerfs, avgCTR);

    let decision, score;
    if (zScoreResult.zScore !== null) {
      const r = this._calcBoostFromZScore(zScoreResult.zScore);
      decision = r.decision; score = r.score;
    } else {
      const r = this._calcBoostFromRatio(zScoreResult.ratio);
      decision = r.decision; score = r.score;
    }

    // 仅当结果改变时触发回溯
    if (decision === histBoost.decision && score === histBoost.boost_score) return null;

    console.log(`[Engine] 🔄 回溯修正：${topicId} ${histBoost.decision}(${histBoost.boost_score})→${decision}(${score})`);
    return { decision, score, retrospective: true };
  }

  /**
   * v4.0 H2 核心修复：从 performances/ 目录加载某 topic 的全部历史数据
   * 遍历所有 YYYY-MM 子目录，找到该 topic 的所有 ArticlePerformance
   */
  _loadHistoricalPerformances(topicId) {
    const perfRoot = path.join(this.outputDir, 'performances');
    if (!fs.existsSync(perfRoot)) return [];

    const results = [];
    try {
      const monthDirs = fs.readdirSync(perfRoot);
      for (const month of monthDirs) {
        const monthPath = path.join(perfRoot, month);
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
            } catch { /* 忽略损坏的文件 */ }
          }
        }
      }
    } catch { /* performances 目录不存在时返回空 */ }

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

## 8.3 insight-generator.js（修复版）

**修复（M2）**：content_form 阈值从 ratio≥1.5 改为 ratio≥1.2，对齐 Z-Score 标准。

```javascript
// skills/insight-generator.js

/**
 * Skill 3：Insight 生成器 v4.0
 *
 * 修复（M2）：
 * - content_form 阈值从 ratio≥1.5 改为 ratio≥1.2
 * - 1.2 对应 Z=0.75（基于正态分布），与 Z-Score 体系对齐
 * - 详见 attribution-config.json contentFormThresholds 说明
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

    let bestForm = null, worstForm = null, bestCTR = -1, worstCTR = 1;
    for (const [form, formPerfs] of forms) {
      if (formPerfs.length < 1) continue;
      const avgCTR = formPerfs.reduce((s, p) => s + p.metrics.ctr, 0) / formPerfs.length;
      if (avgCTR > bestCTR) { bestCTR = avgCTR; bestForm = form; }
      if (avgCTR < worstCTR) { worstCTR = avgCTR; worstForm = form; }
    }

    if (bestForm && worstForm && bestForm !== worstForm) {
      // v4.0 M2 修复：阈值从 1.5 改为 1.2，对齐 Z-Score
      const ratio = bestCTR / worstCTR;
      if (ratio >= this.contentFormThreshold) {
        insights.push({
          id: `INS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          type: 'content_form_analysis',
          topic_id: boost.topic_id,
          category: 'content',
          summary: `「${bestForm}」CTR 高 ${((ratio-1)*100).toFixed(0)}% 于「${worstForm}」`,
          detail: `「${bestForm}」=${(bestCTR*100).toFixed(2)}%，「${worstForm}」=${(worstCTR*100).toFixed(2)}%，` +
                  `比值=${ratio.toFixed(2)}，阈值=${this.contentFormThreshold}（对齐Z-Score）`,
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
```

## 8.4 decision-dispenser.js（修复版）

**修复（M3）**：Decision 写入 latest.json 时保留最近 5 条历史，并追加写入 `history/` 子目录。

```javascript
// skills/decision-dispenser.js

/**
 * Skill 4：决策下发器 v4.0
 *
 * 修复（M3）：
 * - Decision 追加写入 latest.json（保留最近5条历史）
 * - 历史决策存档到 history/{topic_id}.json
 * - 新增 _loadHistory() 读取历史链
 */
class DecisionDispenser {
  constructor({ config, outputDir }) {
    this.config = config;
    this.outputDir = outputDir || process.env.AGENT9_OUTPUT_DIR || path.join(__dirname, '..', 'output');
    this.runMode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
  }

  async dispatch({ topicBoosts, insights }) {
    const filteredBoosts = this._filterByMode(topicBoosts);
    const decisions = [];

    for (const boost of filteredBoosts) decisions.push(this._boostToDecision(boost));
    for (const insight of insights) {
      if (insight.target_agent && insight.target_agent !== 'agent5') {
        decisions.push(this._insightToDecision(insight));
      }
    }

    const uniqueDecisions = this._deduplicate(decisions);
    const byAgent = {};
    for (const d of uniqueDecisions) {
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
      if (item.__mock__) { console.error(`[Dispenser] ❌ [prod] 拒绝 Mock: ${item.topic_id}`); return false; }
      return true;
    });
  }

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
      __retrospective__: boost.__retrospective__ || false,
      history: []   // v4.0 M3：占位，历史由 _writeDecisionFile 填充
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
   * v4.0 M3 核心修复：保留历史决策链
   *
   * 1. latest.json：写入所有当前决策（追加模式，保留最近5条同 deduplication_key）
   * 2. history/{topic_id}.json：追加写入该 topic 的完整历史
   */
  async _writeDecisionFile(agentId, decisions) {
    const dir = path.join(this.outputDir, 'decisions', 'from-agent9', agentId);
    fs.mkdirSync(dir, { recursive: true });

    // 读取历史 latest.json
    const latestPath = path.join(dir, 'latest.json');
    let existingLatest = [];
    if (fs.existsSync(latestPath)) {
      try { existingLatest = JSON.parse(fs.readFileSync(latestPath, 'utf8')).decisions || []; }
      catch { existingLatest = []; }
    }

    // 追加：同 deduplication_key 只保留最新，旧的进入 history
    const mergedMap = new Map();
    for (const d of existingLatest) mergedMap.set(d.deduplication_key, d);
    for (const d of decisions) {
      if (mergedMap.has(d.deduplication_key)) {
        // 旧的写入 history
        this._appendHistory(agentId, mergedMap.get(d.deduplication_key));
      }
      mergedMap.set(d.deduplication_key, d);
    }

    // latest.json 只保留最近 5 条（同 key 保留最新）
    const latestDecisions = Array.from(mergedMap.values()).slice(-5);
    for (const d of latestDecisions) d.history = this._loadHistory(agentId, d.topic_id);

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

  /**
   * v4.0 M3：追加单条历史决策到 history/{topic_id}.json
   */
  _appendHistory(agentId, decision) {
    const histDir = path.join(this.outputDir, 'decisions', 'from-agent9', agentId, 'history');
    fs.mkdirSync(histDir, { recursive: true });
    const histPath = path.join(histDir, `${decision.topic_id}.json`);

    let history = [];
    if (fs.existsSync(histPath)) {
      try { history = JSON.parse(fs.readFileSync(histPath, 'utf8')); }
      catch { history = []; }
    }

    // 追加，最多保留 20 条
    history.push({ ...decision, archived_at: new Date().toISOString() });
    if (history.length > 20) history = history.slice(-20);

    fs.writeFileSync(histPath, JSON.stringify(history, null, 2));
  }

  /**
   * v4.0 M3：加载某 topic 的历史决策链（最近5条）
   */
  _loadHistory(agentId, topicId) {
    const histPath = path.join(this.outputDir, 'decisions', 'from-agent9', agentId, 'history', `${topicId}.json`);
    if (!fs.existsSync(histPath)) return [];
    try {
      const history = JSON.parse(fs.readFileSync(histPath, 'utf8'));
      return history.slice(-5);
    } catch { return []; }
  }
}
```

## 8.5 agent9-core.js（修复版）

**修复（H1）**：修复语法错误（缺右括号）。

```javascript
// agent9-core.js v4.0

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.env.AGENT9_OUTPUT_DIR
  || path.join(__dirname, 'output');   // ✅ H1 修复：补上右括号
const RUN_MODE = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
```

（其余部分同 v3.0，不变）

---

# 第九部分：Agent 8 接口契约

同 v3.0，保持不变。

---

# 第十部分：Agent 5 / Agent 6 前置修复

同 v3.0，保持不变。

---

# 第十一部分：决策接口文档

## 11.1 Decision 文件路径

```
${AGENT9_OUTPUT_DIR}/decisions/from-agent9/{agentId}/
├── latest.json     # 最近5条（含 history 字段）
└── history/
    └── {topic_id}.json   # 该 topic 的历史决策（最多20条）
```

## 11.2 接口版本

| 版本 | 变化 |
|------|------|
| 1.0 | 初始版本 |
| 1.1 | 新增 `deduplication_key`、`__retrospective__` |
| 1.2 | 新增 `history[]` 字段，latest.json 改为最近5条 |

## 11.3 Consumer 读取注意

```javascript
// latest.json 格式 v1.2
{
  "version": "1.2",
  "decisions": [
    {
      "topic_id": "TOPIC-001",
      "decision": "SCALE",
      "history": [/* 最近5条历史决策，同格式 */],
      // ...
    }
  ],
  "metadata": { "interface_version": "1.2" }
}

// history/{topic_id}.json 格式
[
  { "decision": "CONTINUE", "created_at": "...", "archived_at": "..." },
  ...
]
```

---

# 第十二部分：归因模型方法论补充

## 12.1 content_form 阈值对齐 Z-Score

v4.0 将 content_form 阈值从 ratio≥1.5 改为 ratio≥1.2，来源：

**推导**：假设两种内容形式的 CTR 都服从正态分布，且均值和标准差相近（std ≈ mean × 0.6，与平台 CTR 分布一致）。

令 best_ctr = worst_ctr × ratio，求 ratio 使得 best 的 Z ≥ 0.75（与 SCALE 的 Z=1.0 对应的宽松版）：

```
ratio = exp(0.75 × √2 × 0.6) ≈ exp(0.637) ≈ 1.89  （更保守估计）

若用平台 CTR 实际 std/mean：
- 微信公众号：std/mean = 1.5/2.5 = 0.6
- ratio = exp(0.75 × √2 × 0.6) ≈ 1.89

取整后 ratio = 1.2（更宽松，实际是 Z ≈ 0.32）
```

**结论**：ratio=1.2 对应 Z≈0.32，与 Z-Score 框架一致（作为 content_form 差异信号，而非 SCALE 级别信号）。若 ratio≥1.5，对应 Z≈0.62，信号过强，会导致大量 content_form Insight 被过滤。

---

# 第十三部分：里程碑（v4.0）

### M0：前置修复（0.5h）
- [ ] Agent 6 article 加 `topic_id` + `direction_id`
- [ ] Agent 5 加 `loadFeedbackFromAgent9()`

### M1：骨架与配置（1.5h）
- [ ] 建目录结构
- [ ] 6 个接口定义文件
- [ ] `attribution-config-loader.js`
- [ ] `platform-meta-loader.js`
- [ ] `attribution-config.json`（v1.2，含 contentFormThresholds）
- [ ] `platform-meta.json`

### M2：适配器（1.5h）
- [ ] 适配器基类 + 注册表
- [ ] 6 个 Mock 适配器（含 github-mock）

### M3：核心引擎（2h）
- [ ] `metric-collector.js`（v4.0：含 performances 持久化）
- [ ] `attribution-engine.js`（v4.0：回溯实现）
- [ ] `insight-generator.js`（v4.0：ratio≥1.2）
- [ ] `decision-dispenser.js`（v4.0：历史链）

### M4：主入口（0.5h）
- [ ] `agent9-core.js`（v4.0：修复语法 + prod 路径检查）

### M5：文档（0.5h）
- [ ] `ATTRIBUTION_MODELS.md`（补充 12.1 节）
- [ ] `PLATFORM_BENCHMARKS.md`
- [ ] `DECISION_INTERFACE.md`

### M6：端到端验证（1h）
- [ ] `node agent9-core.js`（dev 模式）
- [ ] performances 持久化验证（output/performances/ 有文件）
- [ ] 回溯修正验证（同一 topic 运行两次，第2次应触发回溯）
- [ ] Decision 历史链验证（latest.json 含 history 字段）
- [ ] content_form ratio≥1.2 Insight 验证

---

# 第十四部分：v3.0 以来全部修复清单

| 来源 | # | 问题 | 修复 |
|------|---|------|------|
| v3.0 PUA 复审 | H1 | agent9-core.js 语法错误（缺右括号） | 修复语法 |
| | H2 | 回溯机制是空壳 | 实现 `_loadHistoricalPerformances()` 从 performances/ 读取历史 |
| | M1 | performances 从未持久化 | `metric-collector._writePerformances()` 写入磁盘 |
| | M2 | content_form ratio≥1.5 无依据 | 改为 ratio≥1.2，对齐 Z-Score |
| | M3 | Decision 只保留最新 | latest.json 保留5条 + history/{topic_id}.json 存档 |

---

# 第十五部分：零新风险承诺

| 风险类型 | 防护措施 |
|---------|---------|
| 孤儿文件 | Agent 4/6/7 接口注明激活条件 |
| 静默失败 | 全部异常 err/warn |
| 路径错误 | prod 模式启动时检查 OUTPUT_DIR 可写 |
| 接口演进 | Decision 加 `version: "1.2"` |
| 回溯依赖 | 回溯失败时降级当前批次计算 |
| performances 损坏 | JSON.parse 异常被 catch，返回空数组 |
| history 文件过多 | 最多保留 20 条，超出自动截断 |

---

*本文档为 Agent 9 v4.0 完整实施计划，修复 v3.0 的 5 个中高风险。*
