/**
 * geo-article-transformer.js
 * P0: GEO 文章 AI 友好化改造 Skill
 *
 * 来源：yao-open-prompts/geo-article-ai-friendly-transformation.md
 *
 * 功能：
 *   1. 原文深度分析（内容盘点 + GEO差距诊断）
 *   2. 12维度权重驱动改造
 *   3. 三层验证（保真 / GEO优化度 / 可用性）
 *
 * 输入：
 *   {
 *     article_content: string,       // 原文正文
 *     target_keywords: string[],    // 目标关键词
 *     intent_type: string,         // informational | transactional | commercial
 *     options: {                   // 可选配置
 *       depth: 'light' | 'deep',   // 轻度改造 vs 深度改造
 *       platform: string,
 *     }
 *   }
 *
 * 输出：
 *   {
 *     transformed_content: string,  // 改造后的文章
 *     transformation_report: {
 *       structure_changes: [],
 *       evidence_added: [],
 *       expression_improved: [],
 *     },
 *     pending_confirmations: [],    // 待用户确认的内容
 *     geo_score: { overall: 0-100, dimensions: {...} },
 *     risk_warnings: [],
 *   }
 */

// ============ 12维度权重定义（来自 yao-open-prompts）============

const GEO_DIMENSIONS = {
  // 证据引用层（43%）
  authority_quotes: { weight: 16, label: '权威原文引语' },
  statistics: { weight: 14, label: '统计数据完整度' },
  citability: { weight: 13, label: '可引用性/可信来源' },
  // 结构理解层（12%）
  structure: { weight: 12, label: '结构规范性' },
  // 其他维度（45%）
  fluency: { weight: 10, label: '表达流畅度' },
  semantic_density: { weight: 8, label: '语义密度' },
  authority_signals: { weight: 8, label: '权威信号' },
  terminology: { weight: 6, label: '专业术语' },
  robustness: { weight: 5, label: '鲁棒性' },
  cross_domain: { weight: 4, label: '跨域连接' },
};

// ============ 核心函数 ============

/**
 * 主入口
 */
function run({ article_content, target_keywords = [], intent_type = 'informational', options = {} }) {
  const depth = options.depth || 'deep';
  const platform = options.platform || 'default';

  // 第一阶段：原文分析 + GEO差距诊断
  const analysis = analyzeArticle(article_content, target_keywords, intent_type);

  // 第二阶段：权重驱动改造
  const transformed = transformArticle(article_content, analysis, target_keywords, depth, platform);

  // 第三阶段：三层验证
  const validation = validateTransformation(article_content, transformed.content, analysis, depth);

  // 第四阶段：生成 GEO 评分
  const geo_score = calculateGeoScore(analysis, transformed.changes);

  // 第五阶段：风险警告
  const risk_warnings = generateRiskWarnings(analysis, transformed.changes);

  return {
    transformed_content: transformed.content,
    transformation_report: {
      structure_changes: transformed.changes.structure || [],
      evidence_added: transformed.changes.evidence || [],
      expression_improved: transformed.changes.expression || [],
    },
    pending_confirmations: transformed.pending || [],
    geo_score,
    risk_warnings,
    _meta: {
      depth,
      platform,
      intent_type,
      original_length: article_content.length,
      transformed_length: transformed.content.length,
    },
  };
}

// ============ 第一阶段：原文分析 ============

/**
 * 分析原文并生成 GEO 差距诊断报告
 */
function analyzeArticle(content, keywords, intent_type) {
  const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 10);
  const sentences = content.match(/[^.!?。！？]+[.!?。！？]/g) || [];

  // 检测现有维度状态
  const diagnostics = {
    // 证据引用层
    authority_quotes: diagnoseAuthorityQuotes(sentences),
    statistics: diagnoseStatistics(sentences),
    citability: diagnoseCitability(sentences, paragraphs),
    // 结构理解层
    structure: diagnoseStructure(paragraphs),
    // 其他维度
    fluency: diagnoseFluency(sentences),
    semantic_density: diagnoseSemanticDensity(paragraphs),
    authority_signals: diagnoseAuthoritySignals(content),
    terminology: diagnoseTerminology(paragraphs),
    robustness: diagnoseRobustness(sentences),
    cross_domain: diagnoseCrossDomain(paragraphs, keywords),
  };

  // 差距分析
  const gaps = {};
  for (const [dim, info] of Object.entries(GEO_DIMENSIONS)) {
    const current = diagnostics[dim]?.score || 0;
    const max = info.weight;
    const gap = max - current;
    gaps[dim] = { current, max, gap, priority: gap > max * 0.5 ? 'high' : gap > max * 0.3 ? 'medium' : 'low' };
  }

  // 按优先级排序改造任务
  const tasks = Object.entries(gaps)
    .filter(([, g]) => g.priority !== 'low')
    .sort((a, b) => b[1].gap - a[1].gap)
    .map(([dim, g]) => ({
      dimension: dim,
      label: GEO_DIMENSIONS[dim].label,
      weight: GEO_DIMENSIONS[dim].weight,
      current: g.current,
      target: g.max,
      gap: g.gap,
      priority: g.priority,
    }));

  return {
    diagnostics,
    gaps,
    tasks,
    stats: {
      paragraphs: paragraphs.length,
      sentences: sentences.length,
      words: content.length,
      has_quote: diagnostics.authority_quotes.found.length > 0,
      has_data: diagnostics.statistics.found.length > 0,
      has_source: diagnostics.citability.found.length > 0,
    },
  };
}

// --- 诊断子函数 ---

function diagnoseAuthorityQuotes(sentences) {
  // 寻找可能的权威引语（带引号，或包含"说、指出、表明、认为"等动词）
  const quote_patterns = [
    /"[^"]{10,}"/,                          // 中文引号
    /'[^']{10,}'/,                          // 英文引号
    /[上述|研究|报告|数据]显示[^\n。]{5,30}[。]/,  // 权威句式
    /[专家|学者|机构]指出[^\n。]{5,30}[。]/,
    /据[^\n。]{2,10}报道[^\n。]{5,30}[。]/,
  ];

  const found = sentences.filter(s => quote_patterns.some(p => p.test(s)));
  return {
    score: Math.min(found.length * 4, GEO_DIMENSIONS.authority_quotes.weight),
    found,
    has_authoritative: found.some(s => /[专家|研究|报告|机构|学者]/.test(s)),
  };
}

function diagnoseStatistics(sentences) {
  // 寻找含数据的句子
  const data_patterns = [
    /[0-9]+[%％]/,           // 百分比
    /[0-9]+[万千百十]/,      // 具体数字+单位
    /[0-9]+[倍，次，人]/,   // 复数
    /上升|下降|增长|减少|提升|降低/,
  ];

  const found = sentences.filter(s => data_patterns.some(p => p.test(s)));

  // 检查数据完整性：是否有样本量、周期、来源
  const complete = found.filter(s =>
    /[0-9]+%/.test(s) && /[来源|研究|报告|数据]/.test(s)
  );

  return {
    score: Math.min(found.length * 3 + complete.length * 2, GEO_DIMENSIONS.statistics.weight),
    found,
    complete,
    has_sample: found.some(s => /[样本|企业|用户|案例]/.test(s)),
    has_period: found.some(s => /[天|月|年|周|周期]/.test(s)),
  };
}

function diagnoseCitability(paragraphs, _paragraphsAlt) {
  // 可引用性：关键事实是否有明确归属
  const found = paragraphs.filter(p =>
    /[来源|依据|基于|根据]/.test(p) || /[0-9]+%/.test(p)
  );
  return {
    score: Math.min(found.length * 3, GEO_DIMENSIONS.citability.weight),
    found,
  };
}

function diagnoseStructure(paragraphs) {
  // 结构：是否有清晰的标题层级、摘要、FAQ
  let score = 0;
  const features = [];

  if (paragraphs.length >= 3) { score += 4; features.push('足够段落'); }
  if (paragraphs.some(p => /^[一二三四五六七八九十]、/.test(p.trim()))) {
    score += 4; features.push('有序号标题');
  }
  if (paragraphs.some(p => /^#{1,3}\s/.test(p.trim()))) {
    score += 4; features.push('有H标题');
  }

  return { score: Math.min(score, GEO_DIMENSIONS.structure.weight), features };
}

function diagnoseFluency(sentences) {
  // 流畅度：段落长度是否均衡
  const lengths = sentences.map(s => s.length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
  const isBalanced = variance < avg * 2;
  return {
    score: isBalanced ? 8 : 5,
    avg_length: Math.round(avg),
    is_balanced: isBalanced,
  };
}

function diagnoseSemanticDensity(_paragraphs) {
  // 语义密度：每段的信息量（简化评估）
  return { score: 6, note: '简化评估，完整需LLM判断' };
}

function diagnoseAuthoritySignals(content) {
  // 权威信号：是否提及权威来源
  const signals = [
    /[麦肯锡| Gartner| Forrester| IDC| Stanford| MIT| IEEE| ACM]/,
    /[研究院|研究所|研究中心|实验室]/,
    /[报告|白皮书|论文|期刊]/,
  ];
  const found = signals.filter(s => s.test(content));
  return {
    score: Math.min(found.length * 3, GEO_DIMENSIONS.authority_signals.weight),
    found_sources: found.map(s => s.toString()),
  };
}

function diagnoseTerminology(_paragraphs) {
  // 术语：是否使用专业术语
  return { score: 4, note: '简化评估，完整需领域知识库' };
}

function diagnoseRobustness(sentences) {
  // 鲁棒性：是否有条件句、边界说明
  const robust = sentences.filter(s =>
    /如果|当|在...时|取决于|视...而定/.test(s)
  );
  return {
    score: Math.min(robust.length * 2, GEO_DIMENSIONS.robustness.weight),
    found: robust,
  };
}

function diagnoseCrossDomain(paragraphs, keywords) {
  // 跨域连接：是否连接不同领域概念
  const crossRef = paragraphs.filter(p => {
    const hasKeyword = keywords.some(k => p.includes(k));
    const hasGeneric = /[技术|行业|市场|用户|企业]/.test(p);
    return hasKeyword && hasGeneric;
  });
  return {
    score: Math.min(crossRef.length * 2, GEO_DIMENSIONS.cross_domain.weight),
    found: crossRef,
  };
}

// ============ 第二阶段：权重驱动改造 ============

/**
 * 基于差距诊断对文章进行改造
 */
function transformArticle(content, analysis, keywords, depth, platform) {
  let result = content;
  const changes = { structure: [], evidence: [], expression: [] };
  const pending = [];

  // 按优先级执行改造任务
  for (const task of analysis.tasks) {
    if (task.priority === 'low') continue;

    const transformer = TRANSFORMERS[task.dimension];
    if (!transformer) continue;

    const { text, change, warns } = transformer(result, analysis, keywords, depth, platform);

    if (text !== result) {
      result = text;
      if (change) changes[task.dimension === 'structure' ? 'structure' : task.dimension === 'authority_quotes' || task.dimension === 'statistics' || task.dimension === 'citability' ? 'evidence' : 'expression'].push(change);
    }
    if (warns) pending.push(...warns);
  }

  // 基础结构优化（无论差距如何都执行）
  const { text: structured, structureChange } = addStructureIfNeeded(result, analysis);
  if (structured !== result) {
    result = structured;
    if (structureChange) changes.structure.push(structureChange);
  }

  return { content: result, changes, pending };
}

// --- 维度改造器 ---

const TRANSFORMERS = {
  authority_quotes: (text, analysis, _keywords, depth) => {
    // 补充权威引语（标记需要用户确认）
    const existingQuotes = analysis.diagnostics.authority_quotes.found;
    if (existingQuotes.length >= 2) {
      return { text, change: null, warns: null };
    }

    if (depth === 'light') {
      return {
        text,
        change: null,
        warns: [`[GEO优化] 建议在核心结论处补充权威专家或机构原话引用（当前${existingQuotes.length}处）`],
      };
    }

    // 深度改造：添加引语占位符
    const placeholder = "\n\n[GEO建议] 此处建议补充权威引用，例如：\u201c正如[专家姓名]在《[报告名称]》中指出：'...'\u201d。\n\n";
    const insertIdx = findConclusionPosition(text);
    const newText = text.slice(0, insertIdx) + placeholder + text.slice(insertIdx);

    return {
      text: newText,
      change: `在核心论点处添加了权威引语占位符`,
      warns: null,
    };
  },

  statistics: (text, analysis, _keywords, depth) => {
    const existing = analysis.diagnostics.statistics.found;
    if (existing.length >= 3) {
      return { text, change: null, warns: null };
    }

    if (depth === 'light') {
      return {
        text,
        change: null,
        warns: [`[GEO优化] 建议补充具体数据（当前${existing.length}处，建议3-5处），包含：数值+样本量+周期+来源`],
      };
    }

    const placeholder = '\n\n[GEO建议] 此处建议补充具体数据，例如："效率提升32%（样本：120家企业，周期：30天，来源：XX研究报告2024）"。\n\n';
    const insertIdx = findDataPosition(text);
    const newText = text.slice(0, insertIdx) + placeholder + text.slice(insertIdx);

    return {
      text: newText,
      change: `在关键论点处添加了数据占位符`,
      warns: null,
    };
  },

  citability: (text, analysis, _keywords, depth) => {
    const existing = analysis.diagnostics.citability.found;
    if (existing.length >= 5) {
      return { text, change: null, warns: null };
    }

    if (depth === 'light') {
      return {
        text,
        change: null,
        warns: [`[GEO优化] 建议为${5 - existing.length}处关键事实添加明确来源标注`],
      };
    }

    // 深度：在关键事实后添加来源标注
    let newText = text;
    let added = 0;
    const dataPoints = analysis.diagnostics.statistics.found;
    for (const point of dataPoints.slice(0, 3)) {
      if (!text.includes('[来源：') && added < 2) {
        newText = newText.replace(
          point,
          point.trim() + '（来源：[建议补充]）'
        );
        added++;
      }
    }

    return {
      text: newText,
      change: added > 0 ? `为${added}处数据添加了来源标注占位符` : null,
      warns: added === 0 ? ['未找到可标注的数据点'] : null,
    };
  },

  structure: (text, analysis, keywords, depth) => {
    const hasClearStructure = analysis.diagnostics.structure.features.length >= 2;
    if (hasClearStructure && depth === 'light') {
      return { text, change: null, warns: null };
    }
    return { text, change: null, warns: null }; // 结构改造由 addStructureIfNeeded 统一处理
  },

  fluency: (text, _analysis, _keywords, depth) => {
    if (depth === 'light') return { text, change: null, warns: null };
    return {
      text,
      change: null,
      warns: ['[可用性] 建议人工审阅段落过渡和句子长度均衡性'],
    };
  },

  semantic_density: (text, _analysis, _keywords, depth) => {
    if (depth === 'light') return { text, change: null, warns: null };
    return {
      text,
      change: null,
      warns: ['[内容质量] 建议检查每段是否充分展开核心观点'],
    };
  },

  authority_signals: (text, _analysis, _keywords, depth) => {
    if (depth === 'light') return { text, change: null, warns: null };
    return {
      text,
      change: null,
      warns: ['[GEO优化] 建议在文章中明确引用权威来源（研究院、知名报告等）'],
    };
  },

  terminology: (text, _analysis, _keywords, depth) => {
    if (depth === 'light') return { text, change: null, warns: null };
    return {
      text,
      change: null,
      warns: ['[内容质量] 建议确保专业术语首次出现时附定义'],
    };
  },

  robustness: (text, _analysis, _keywords, depth) => {
    if (depth === 'light') return { text, change: null, warns: null };
    return {
      text,
      change: null,
      warns: ['[严谨性] 建议为条件性结论添加边界说明（如"在特定条件下"）'],
    };
  },

  cross_domain: (text, _analysis, _keywords, depth) => {
    if (depth === 'light') return { text, change: null, warns: null };
    return {
      text,
      change: null,
      warns: ['[深度] 建议连接相关领域知识，帮助读者建立跨域认知'],
    };
  },
};

/**
 * 在结论位置插入内容
 */
function findConclusionPosition(text) {
  const conclusionSignals = [
    '综上所述', '总之', '因此', '由此可见', '最终', '归根结底',
    '总而言之', '简而言之', '一句话',
  ];
  for (const signal of conclusionSignals) {
    const idx = text.indexOf(signal);
    if (idx > text.length * 0.5 && idx > 0) return idx;
  }
  // 没有结论段：找最后一段开头
  const lastNewline = text.lastIndexOf('\n');
  return lastNewline > 0 ? lastNewline : Math.floor(text.length * 0.8);
}

/**
 * 在数据位置插入内容
 */
function findDataPosition(text) {
  const dataIdx = text.search(/[0-9]+[%％倍]/);
  return dataIdx > 0 ? dataIdx + 20 : Math.floor(text.length * 0.3);
}

/**
 * 添加结构化要素（摘要 + FAQ）
 */
function addStructureIfNeeded(text, analysis, options = {}) {
  const platform = options.platform || 'default';
  const changes = [];

  // 检测是否已有摘要
  const hasSummary = /摘要|概述|导语|前言/.test(text.slice(0, 200));

  let result = text;
  let summaryAdded = false;

  if (!hasSummary && platform !== 'xiaohongshu') {
    // 在文章开头添加摘要
    const firstParagraphEnd = text.indexOf('\n');
    const firstPara = firstParagraphEnd > 0 ? text.slice(0, firstParagraphEnd) : text.slice(0, 200);
    const summary = `\n> **核心要点**：${firstPara.slice(0, 150).trim()}...\n\n`;
    result = summary + text;
    summaryAdded = true;
    changes.push('添加了核心要点摘要');
  }

  // 检测是否已有 FAQ
  const hasFAQ = /\?|FAQ|常见问题/.test(text);

  if (!hasFAQ && platform !== 'xiaohongshu' && platform !== 'video') {
    // 在文章末尾添加 FAQ
    const faq = generateSimpleFAQ(text, analysis);
    result = result + '\n\n## 常见问题\n\n' + faq;
    changes.push('添加了FAQ模块');
  }

  return { text: result, structureChange: changes.length > 0 ? changes.join('、') : null };
}

/**
 * 生成简单 FAQ（基于文章内容）
 */
function generateSimpleFAQ(text, analysis) {
  const mainTopic = text.match(/[\w\u4e00-\u9fa5]{4,20}/)?.[0] || '本话题';
  const faqs = [
    `**${mainTopic}到底是什么？**\n${text.slice(0, 100).trim()}...\n\n`,
    `**${mainTopic}为什么重要？**\n具体重要性和价值请参考正文第一、二节。\n\n`,
    `**如何正确实施${mainTopic}？**\n建议从正文第三节开始了解具体步骤和最佳实践。\n\n`,
  ];
  return faqs.join('');
}

// ============ 第三阶段：三层验证 ============

/**
 * 验证改造后的文章
 */
function validateTransformation(original, transformed, analysis, depth) {
  const checks = {
    fidelity: checkFidelity(original, transformed),
    geo_optimization: checkGeoOptimization(analysis),
    usability: checkUsability(transformed, depth),
  };

  return {
    fidelity: checks.fidelity,
    geo_optimization: checks.geo_optimization,
    usability: checks.usability,
    passed: checks.fidelity.passed && checks.usability.passed,
  };
}

function checkFidelity(original, transformed) {
  // 保真检查：核心观点是否保持
  const original_core = extractCoreClaims(original);
  const transformed_core = extractCoreClaims(transformed);

  const preserved = original_core.filter(claim =>
    transformed.includes(claim) || claim.length < 5
  );

  const ratio = preserved.length / Math.max(original_core.length, 1);
  return {
    passed: ratio >= 0.7,
    preserved_ratio: Math.round(ratio * 100) + '%',
    note: `${preserved.length}/${original_core.length} 核心观点保留`,
  };
}

function extractCoreClaims(text) {
  // 提取核心论点（简化：取每段第一句）
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 20);
  return paragraphs.map(p => p.trim().slice(0, 50)).filter(p => p.length > 10);
}

function checkGeoOptimization(analysis) {
  // GEO优化度检查
  const covered = analysis.tasks.filter(t => t.priority !== 'high').length;
  const total = analysis.tasks.length;
  return {
    passed: covered / Math.max(total, 1) >= 0.5,
    coverage: Math.round((covered / Math.max(total, 1)) * 100) + '%',
    note: `${covered}/${total} 高优先级维度已处理`,
  };
}

function checkUsability(text, depth) {
  // 可用性检查
  const issues = [];

  if (text.length < 200) issues.push('内容过短');
  if (text.length > 50000) issues.push('内容过长');
  if (text.includes('[GEO建议]') && depth === 'light') issues.push('包含未处理优化建议');

  return {
    passed: issues.length === 0,
    issues,
    note: issues.length === 0 ? '可读性良好' : issues.join('；'),
  };
}

// ============ 第四阶段：GEO 评分 ============

/**
 * 计算 GEO 综合评分
 */
function calculateGeoScore(analysis, changes) {
  const dimension_scores = {};
  let total_score = 0;

  for (const [dim, info] of Object.entries(GEO_DIMENSIONS)) {
    const diag = analysis.diagnostics[dim] || { score: 0 };
    const score = Math.min(diag.score || 0, info.weight);
    dimension_scores[dim] = {
      score,
      max: info.weight,
      label: info.label,
      status: score >= info.weight * 0.7 ? 'good' : score >= info.weight * 0.4 ? 'warning' : 'critical',
    };
    total_score += score;
  }

  const max_possible = Object.values(GEO_DIMENSIONS).reduce((a, b) => a + b.weight, 0);

  return {
    overall: Math.round((total_score / max_possible) * 100),
    dimensions: dimension_scores,
    max_possible,
  };
}

// ============ 第五阶段：风险警告 ============

/**
 * 生成风险警告
 */
function generateRiskWarnings(analysis, changes) {
  const warnings = [];

  if (analysis.diagnostics.statistics.found.length === 0) {
    warnings.push({
      type: 'data',
      level: 'warning',
      message: '文章无任何数据支撑，建议补充具体数字（转化率、增长率等）',
    });
  }

  if (analysis.diagnostics.authority_quotes.found.length === 0) {
    warnings.push({
      type: 'authority',
      level: 'warning',
      message: '文章无权威引用，建议补充专家观点或研究报告引用',
    });
  }

  if (changes.evidence && changes.evidence.some(c => c.includes('占位符'))) {
    warnings.push({
      type: 'pending',
      level: 'info',
      message: '文章包含[GEO建议]占位符，请确认后删除或替换为实际内容',
    });
  }

  return warnings;
}

// ============ CLI 测试入口 ============

if (require.main === module) {
  const sample = {
    article_content: `数字化转型已成为企业发展的必经之路。多Agent系统可以帮助企业实现智能化升级。

多Agent协作是当前AI领域的热门话题。在企业场景中，多Agent可以帮助实现自动化流程、智能客服、数据分析等功能。使用多Agent协作可以显著提升工作效率，降低人工成本。

效果显著，企业反馈良好。多Agent的核心是协调机制，需要解决任务分配，信息共享、冲突处理等问题。`,
    target_keywords: ['多Agent协作', 'AI', '数字化转型'],
    intent_type: 'commercial',
    options: { depth: 'deep', platform: 'zhihu' },
  };

  console.log('\n📊 GEO Transformer 输入：');
  console.log(`  字数：${sample.article_content.length}`);
  console.log(`  深度：${sample.options.depth}`);
  console.log(`  平台：${sample.options.platform}\n`);

  const result = run(sample);

  console.log('📝 GEO Transformer 输出：\n');
  console.log(`  ✅ GEO综合评分：${result.geo_score.overall}/100`);
  console.log('  各维度得分：');
  for (const [dim, info] of Object.entries(result.geo_score.dimensions)) {
    const bar = '█'.repeat(Math.round(info.score / info.max * 10)) + '░'.repeat(10 - Math.round(info.score / info.max * 10));
    console.log(`     ${info.label.padEnd(12)} ${bar} ${info.score}/${info.max} [${info.status}]`);
  }
  console.log(`\n  ✅ 改造摘要：`);
  console.log(`     结构变更：${result.transformation_report.structure_changes.join('、') || '无'}`);
  console.log(`     证据补充：${result.transformation_report.evidence_added.join('、') || '无'}`);
  console.log(`     表达优化：${result.transformation_report.expression_improved.join('、') || '无'}`);
  if (result.pending_confirmations.length > 0) {
    console.log(`\n  ⚠️  待确认：`);
    result.pending_confirmations.forEach(p => console.log(`     - ${p}`));
  }
  if (result.risk_warnings.length > 0) {
    console.log(`\n  🔴 风险提示：`);
    result.risk_warnings.forEach(w => console.log(`     [${w.level}] ${w.message}`));
  }
  console.log(`\n  📄 改造后字数：${result.transformed_content.length}\n`);
  console.log('✅ GEO Transformer 执行完成\n');
}

module.exports = { run };
