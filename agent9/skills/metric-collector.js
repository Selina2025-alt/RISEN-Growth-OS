/**
 * Skill 1: Metric Collector
 * 指标采集器
 *
 * 职责：
 * 1. 从各平台适配器拉取 ArticlePerformance[]
 * 2. dev 模式允许 Mock，prod 模式过滤 Mock
 * 3. 归因窗口检查：等待平台最小归因时间后才纳入计算
 * 4. 采集后写入 performances/ 持久化（为回溯提供数据基础）
 */
const fs = require('fs');
const path = require('path');

class MetricCollector {
  /**
   * @param {Object} opts
   * @param {Object} opts.adapters     适配器注册表
   * @param {Object} opts.dateRange    { startDate, endDate }
   * @param {Array}  opts.platformMeta 平台元数据数组
   * @param {Object} opts.config        attribution-config
   * @param {string} [opts.outputDir]   输出目录
   */
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
        console.log(`[Collector] ⏭  ${platformId}: 归因窗口未满（${meta.minAttributionWindow}），跳过`);
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

        // v4.0: 写入 performances 持久化
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
    try {
      fs.mkdirSync(dir, { recursive: true });
      for (const perf of performances) {
        const file = path.join(dir, `${perf.article_id}.json`);
        fs.writeFileSync(file, JSON.stringify(perf, null, 2));
      }
      console.log(`[Collector] 💾 写入 ${performances.length} 条 performances → ${dir}/`);
    } catch (e) {
      console.error(`[Collector] ❌ 写入 performances 失败: ${e.message}`);
    }
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

module.exports = MetricCollector;
