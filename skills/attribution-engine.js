/**
 * Skill 2: Attribution Engine
 * 归因引擎
 *
 * 核心设计：
 * 1. Z-Score 标准化：跨平台可比较的归因计算
 * 2. 最小样本保护：< 5 篇仅 CONTINUE
 * 3. 回溯修正：达到样本量后从 performances/ 读取历史数据重新计算
 * 4. GitHub 平台特定处理（Star Rate，非 CTR）
 */
const fs = require('fs');
const path = require('path');

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

module.exports = AttributionEngine;
