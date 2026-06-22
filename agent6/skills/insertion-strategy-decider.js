// skills/insertion-strategy-decider.js
// P0.4：软/硬植入策略决策

/**
 * 计算全文分位点
 * @param {number} totalLength - 文章总长度（字符数）
 * @returns {Object} { P20, P40, P60, P80 }
 */
function computeInsertionPoints(totalLength) {
  return {
    P20: Math.round(totalLength * 0.2),
    P40: Math.round(totalLength * 0.4),
    P60: Math.round(totalLength * 0.6),
    P80: Math.round(totalLength * 0.8)
  };
}

/**
 * 决定植入策略
 * @param {Object} opts
 * @param {Object} opts.matchReport - topic-capability-matcher 的输出
 * @param {string} opts.companyName - 公司名称
 * @returns {Object} InsertionStrategy
 */
function decideInsertionStrategy({ matchReport, companyName }) {
  const strategy = matchReport.insertion_type || 'minimal';
  const points = [20, 40, 60, 80]; // 默认四个分位点

  // 硬植入：多个分位点，深入展开
  // 软植入：1-2个分位点，自然融入
  // 最小植入：不分发公司信息

  const insertionPoints = [];

  if (strategy === 'hard') {
    // 硬：4个分位点
    for (const pct of [20, 40, 60, 80]) {
      const topMatch = matchReport.top_matches?.[0];
      insertionPoints.push({
        position: `P${pct}`,
        description: `在全文 ${pct}% 处植入能力 "${topMatch?.headline || ''}"`,
        type: 'hard',
        capability_id: topMatch?.id || null,
        rationale: `hard模式：${pct}%分位点深入展开${companyName}的能力`
      });
    }
  } else if (strategy === 'soft') {
    // 软：2个分位点
    for (const pct of [20, 60]) {
      const topMatch = matchReport.top_matches?.[0];
      insertionPoints.push({
        position: `P${pct}`,
        description: `在全文 ${pct}% 处自然融入 "${topMatch?.headline || ''}"`,
        type: 'soft',
        capability_id: topMatch?.id || null,
        rationale: `soft模式：${pct}%分位点自然融入${companyName}能力`
      });
    }
  } else {
    // minimal：不分发能力信息
    insertionPoints.push({
      position: 'P80',
      description: '结尾自然提及品牌',
      type: 'minimal',
      capability_id: null,
      rationale: `minimal模式：仅在结尾自然提及${companyName}`
    });
  }

  // 构建 SEO 关键词（来自 matchReport）
  const seoKeywords = {
    primary: matchReport.keywords?.primary || [],
    secondary: matchReport.keywords?.secondary || [],
    geo: matchReport.keywords?.geo || [],
    capability_based: (matchReport.top_matches || [])
      .map(m => m.headline)
      .filter(Boolean),
    intent_type: 'commercial'
  };

  return {
    strategy,
    insertion_points: insertionPoints,
    seo_keywords: seoKeywords
  };
}

module.exports = { decideInsertionStrategy, computeInsertionPoints };
