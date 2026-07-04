/**
 * geo-metrics-skill.js
 * P2: GEO 评分 Skill（基于 yao-open-prompts 改写）
 *
 * 功能：对文章进行12维度 GEO 评分
 *
 * 输入：
 *   { article_content: string, platform: string, intent_type: string }
 *
 * 输出：
 *   {
 *     overall: 0-100,
 *     dimensions: { [dim]: { score, max, label, status } },
 *     recommendations: [{ dimension, suggestion }],
 *     report: string
 *   }
 */

const STOPWORDS = new Set([
  '的', '了', '是', '在', '和', '有', '这', '那', '就', '也', '都',
]);

const DIMENSIONS = {
  authority_quotes:  { weight: 16, label: '权威原文引语' },
  statistics:         { weight: 14, label: '统计数据完整度' },
  citability:         { weight: 13, label: '可引用性/可信来源' },
  structure:          { weight: 12, label: '结构规范性' },
  fluency:            { weight: 10, label: '表达流畅度' },
  semantic_density:    { weight:  8, label: '语义密度' },
  authority_signals:   { weight:  8, label: '权威信号' },
  terminology:        { weight:  6, label: '专业术语' },
  robustness:         { weight:  5, label: '鲁棒性' },
  cross_domain:       { weight:  4, label: '跨域连接' },
};

function run({ article_content, platform = 'default', intent_type = 'informational' } = {}) {
  const content = article_content || '';
  const diagnostics = diagnose(content);
  const dimensions = scoreDimensions(diagnostics);
  const overall = calcOverall(dimensions);
  const recommendations = generateRecommendations(diagnostics, dimensions);
  const report = buildReport(overall, dimensions, recommendations);

  return {
    overall,
    dimensions,
    recommendations,
    report,
    _meta: { platform, intent_type, char_count: content.length },
  };
}

// ============ 诊断函数 ============

function diagnose(content) {
  const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 10);
  const sentences = content.match(/[^.!?。！？]+[.!?。！？]?/g) || [];

  return {
    // 证据引用层
    authority_quotes: diagAuthorityQuotes(sentences),
    statistics: diagStatistics(sentences),
    citability: diagCitability(paragraphs),
    // 结构
    structure: diagStructure(paragraphs, content),
    // 表达与语义
    fluency: diagFluency(sentences),
    semantic_density: diagSemanticDensity(paragraphs),
    authority_signals: diagAuthoritySignals(content),
    terminology: diagTerminology(paragraphs),
    robustness: diagRobustness(sentences),
    cross_domain: diagCrossDomain(paragraphs),
  };
}

function diagAuthorityQuotes(sentences) {
  const patterns = [
    /"[^"]{10,}"/, /'[^']{10,}'/,
    /[专家|研究|报告|数据]显示[^\n。]{5,30}[。]/,
    /[学者|机构]指出[^\n。]{5,30}[。]/,
  ];
  const found = sentences.filter(s => patterns.some(p => p.test(s)));
  const hasAuthoritative = found.some(s => /[专家|研究|报告|机构|学者]/.test(s));
  return {
    score: Math.min(found.length * 4, 16),
    found_count: found.length,
    has_authoritative: hasAuthoritative,
  };
}

function diagStatistics(sentences) {
  const hasNum = s => /[0-9]+[%％倍万千百十]/.test(s);
  const hasSource = s => /[来源|研究|报告|数据显示]/.test(s);
  const found = sentences.filter(hasNum);
  const withSource = found.filter(hasSource);
  return {
    score: Math.min(found.length * 3 + withSource.length * 2, 14),
    found_count: found.length,
    with_source: withSource.length,
  };
}

function diagCitability(paragraphs) {
  const found = paragraphs.filter(p =>
    /[来源|根据|依据|数据显示]/.test(p) || /[0-9]+%/.test(p)
  );
  return { score: Math.min(found.length * 3, 13), found_count: found.length };
}

function diagStructure(paragraphs, content) {
  let score = 0;
  const features = [];
  if (paragraphs.length >= 3) { score += 4; features.push('段落充足'); }
  if (/^[一二三四五六七八九十]、/.test(paragraphs.join('\n'))) { score += 4; features.push('有序号'); }
  if (/^#{1,3}\s/.test(paragraphs.join('\n'))) { score += 4; features.push('有H标题'); }
  if (/摘要|前言|导语/.test(content.slice(0, 200))) { score += 2; features.push('有摘要'); }
  if (/FAQ|常见问题/.test(content)) { score += 2; features.push('有FAQ'); }
  return { score: Math.min(score, 12), features };
}

function diagFluency(sentences) {
  if (sentences.length < 3) return { score: 3 };
  const lens = sentences.map(s => s.length);
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  const balanced = lens.every(l => Math.abs(l - avg) < avg * 2);
  return { score: balanced ? 8 : 5, avg_length: Math.round(avg) };
}

function diagSemanticDensity(_paragraphs) {
  return { score: 6, note: '简化评估' };
}

function diagAuthoritySignals(content) {
  const signals = [
    /[麦肯锡|Gartner|Forrester|IDC|Stanford|MIT|IEEE|ACM]/,
    /[研究院|研究所|研究中心|实验室]/,
    /[报告|白皮书|论文|期刊]/,
  ];
  const found = signals.filter(s => s.test(content));
  return { score: Math.min(found.length * 3, 8), found_count: found.length };
}

function diagTerminology(_paragraphs) {
  return { score: 4, note: '简化评估' };
}

function diagRobustness(sentences) {
  const found = sentences.filter(s => /如果|当|在.*时|取决于|视.*而定/.test(s));
  return { score: Math.min(found.length * 2, 5), found_count: found.length };
}

function diagCrossDomain(paragraphs) {
  const found = paragraphs.filter(p =>
    /[技术|行业|市场|用户|企业|产品]/.test(p)
  );
  return { score: Math.min(found.length * 1.5, 4), found_count: found.length };
}

// ============ 评分 ============

function scoreDimensions(diagnostics) {
  const result = {};
  for (const [dim, info] of Object.entries(DIMENSIONS)) {
    const diag = diagnostics[dim] || {};
    const score = Math.min(diag.score || 0, info.weight);
    const pct = info.weight > 0 ? (score / info.weight) : 0;
    result[dim] = {
      score,
      max: info.weight,
      label: info.label,
      status: pct >= 0.7 ? 'good' : pct >= 0.4 ? 'warning' : 'critical',
    };
  }
  return result;
}

function calcOverall(dimensions) {
  const total = Object.values(dimensions).reduce((a, d) => a + d.score, 0);
  const maxTotal = Object.values(DIMENSIONS).reduce((a, d) => a + d.weight, 0);
  return Math.round((total / maxTotal) * 100);
}

// ============ 建议 ============

function generateRecommendations(diagnostics, dimensions) {
  const recs = [];
  for (const [dim, diag] of Object.entries(diagnostics)) {
    const info = DIMENSIONS[dim];
    if (!info) continue;
    if ((diag.score || 0) < info.weight * 0.5) {
      recs.push({
        dimension: dim,
        label: info.label,
        priority: 'high',
        suggestion: getSuggestion(dim, diag),
      });
    }
  }
  return recs.sort((a, b) => b.priority.localeCompare(a.priority));
}

function getSuggestion(dim, diag) {
  const suggestions = {
    authority_quotes: '补充权威专家或机构原话引用（建议2-3处）',
    statistics: '为关键论点补充具体数据（含样本量、周期、来源）',
    citability: '为关键事实添加明确来源标注',
    structure: '添加清晰的标题层级、摘要和FAQ模块',
    fluency: '检查段落过渡，确保句子长度均衡',
    semantic_density: '确保每段充分展开核心观点',
    authority_signals: '明确引用权威来源（研究院、知名报告等）',
    terminology: '首次使用专业术语时附加定义',
    robustness: '为条件性结论添加边界说明',
    cross_domain: '连接相关领域知识，建立跨域认知',
  };
  return suggestions[dim] || `当前得分${diag.score}，建议加强该维度`;
}

function buildReport(overall, dimensions, recommendations) {
  const lines = [
    `GEO 综合评分：${overall}/100`,
    '',
    '各维度得分：',
    ...Object.values(dimensions).map(d => {
      const bar = '█'.repeat(Math.round(d.score / d.max * 10)) + '░'.repeat(10 - Math.round(d.score / d.max * 10));
      return `  [${d.status.padEnd(8)}] ${d.label.padEnd(12)} ${bar} ${d.score}/${d.max}`;
    }),
    '',
    recommendations.length > 0 ? '优先改进：' : '评分良好，继续保持。',
    ...recommendations.slice(0, 5).map(r => `  ⚠ ${r.label}: ${r.suggestion}`),
  ];
  return lines.join('\n');
}

// ============ CLI ============

if (require.main === module) {
  const sample = process.argv[2]
    ? require('fs').readFileSync(process.argv[2], 'utf8')
    : `数字化转型已成为企业发展的必经之路。根据麦肯锡2023年报告，AI落地可帮助企业提升效率30%以上。

多Agent协作是当前AI领域的热门话题。在企业场景中，多Agent可以帮助实现自动化流程、智能客服、数据分析等功能。

我认为，企业应该优先考虑采用多Agent方案。建议企业从试点项目开始，逐步推广。相比传统方案，多Agent在复杂任务处理上表现更优。`;

  const result = run({ article_content: sample, platform: 'zhihu' });
  console.log('\n📊 GEO Metrics 输出\n');
  console.log(result.report);
  console.log('\n✅ GEO Metrics 执行完成\n');
}

module.exports = { run };
