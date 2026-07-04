/**
 * Skill 3: Insight Generator
 * 洞察生成器
 *
 * 支持两种 Insight 类型：
 * 1. topic_efficiency：选题效果洞察（target: agent5）
 * 2. content_form_analysis：内容形式差异洞察（target: agent6）
 *    - 同一 Topic 下不同 content_form 的 CTR 差异
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
    // CONTINUE 且置信度 < 0.65 时不生成（避免噪音）
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

module.exports = InsightGenerator;
