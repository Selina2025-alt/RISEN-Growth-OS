/**
 * geo-article-generator.js
 * P0: GEO 文章生成 Skill
 *
 * 来源：参考 yao-open-prompts/geo-article-generator.md
 * 改动：适配 Jova Skill 格式，集成 capability-index-builder + insertion-strategy-decider
 *
 * 功能：
 *   1. 结合公司能力上下文生成 GEO 优化文章
 *   2. SEO 结构自动注入（meta + h_structure + FAQ）
 *   3. 软/硬植入自动决策
 *   4. 输出 GEO 评分
 *
 * 输入：
 *   {
 *     topic_brief: TopicBrief,
 *     brand_info: { company_name, product_name, tagline },
 *     capabilities: CapabilityCard[],     // 来自 capability-index-builder
 *     seo_keywords: { primary, secondary, geo },
 *     insertion_type: 'soft' | 'hard',   // 来自 insertion-strategy-decider
 *     platform: string,
 *     options: { length: 'short' | 'medium' | 'long' }
 *   }
 *
 * 输出：
 *   {
 *     article: string,
 *     seo_metadata: seo-structure-skill输出,
 *     geo_score: { overall, dimensions },
 *     insertion_points: [],  // 软/硬植入位置
 *     evidence_hints: []    // 建议补充的证据
 *   }
 */

// ============ 主入口 ============

function run({ topic_brief, brand_info, capabilities = [], seo_keywords = {}, insertion_type = 'soft', platform = 'zhihu', options = {} }) {
  const length = options.length || 'medium';

  const topicTitle = topic_brief?.topic_title || '未定义选题';
  const primaryKw = seo_keywords.primary?.[0] || topicTitle;
  const companyName = brand_info?.company_name || '[公司名]';
  const tagline = brand_info?.tagline || '';

  // 1. 生成 GEO 结构化元数据
  const seo_metadata = generateSEOMetadata(topicTitle, seo_keywords, platform);

  // 2. 确定文章长度
  const targetLength = LENGTH_TARGETS[length] || LENGTH_TARGETS.medium;

  // 3. 构建文章结构（分章节）
  const sections = buildSections({ topic_brief, topicTitle, primaryKw, capabilities, insertion_type, companyName, tagline, platform, targetLength });

  // 4. 组装文章
  const article = assembleArticle({ sections, seo_metadata, insertion_type, platform });

  // 5. 植入点记录
  const insertion_points = buildInsertionPoints(sections, insertion_type);

  // 6. 证据建议
  const evidence_hints = buildEvidenceHints(sections, capabilities);

  // 7. GEO 评分（简化版）
  const geo_score = estimateGEOScore(article, sections, capabilities);

  return {
    article,
    seo_metadata,
    geo_score,
    insertion_points,
    evidence_hints,
    _meta: {
      topic_id: topic_brief?.topic_id || 'unknown',
      platform,
      insertion_type,
      length,
      target_length: targetLength,
    },
  };
}

// ============ SEO 元数据生成 ============

function generateSEOMetadata(topicTitle, seo_keywords, platform) {
  const primary = seo_keywords.primary?.[0] || topicTitle;
  const secondary = seo_keywords.secondary || [];
  const geo = seo_keywords.geo || [];

  // Meta title
  const meta_titles = {
    zhihu: `${primary}：深度解析与实操指南`,
    wechat_gzh: `全面解读${primary}，从入门到精通`,
    csdn: `${primary}完整攻略（2024最新版）`,
    xiaohongshu: `📖 ${primary} | 看完就懂了`,
    default: `${primary}（2024深度解读）`,
  };
  const meta_title = meta_titles[platform] || meta_titles.default;

  // Meta description
  const meta_description = `${primary}是当前行业热点。本文深入分析${primary}的核心逻辑、实施路径和真实案例，帮助你快速掌握${primary}的核心要点。`;

  // H2 结构
  const h_structure = buildHStructure(primary, platform);

  // FAQ
  const faq_schema = buildFAQ(primary, platform);

  return {
    meta_title: meta_title.slice(0, 60),
    meta_description: meta_description.slice(0, 160),
    h_structure,
    faq_schema,
    keywords: { primary: [primary, ...secondary].slice(0, 5), secondary, geo },
  };
}

function buildHStructure(primary, platform) {
  if (platform === 'csdn' || platform === 'zhihu') {
    return [
      `一、前言：什么是${primary}`,
      `二、${primary}的核心原理`,
      `三、${primary}的实施步骤`,
      `四、真实案例与效果分析`,
      `五、常见问题与解决方案`,
      `六、总结与行动建议`,
    ];
  }
  if (platform === 'xiaohongshu') {
    return [
      `📌 ${primary}是什么`,
      `💡 ${primary}的核心要点`,
      `✅ 如何正确${primary}`,
      `⚠️ 注意事项`,
    ];
  }
  return [
    `一、${primary}的定义与价值`,
    `二、${primary}的核心优势`,
    `三、如何落地${primary}`,
    `四、案例与效果`,
    `五、总结`,
  ];
}

function buildFAQ(primary, platform) {
  if (platform === 'xiaohongshu') return [];
  return [
    { question: `${primary}到底是什么？`, answer: `请参考正文第一节详细说明。` },
    { question: `为什么${primary}很重要？`, answer: `${primary}是当前行业趋势，具备核心能力的企业将获得竞争优势。` },
    { question: `如何开始${primary}？`, answer: `建议从本文第三节的实施步骤开始，结合企业自身情况制定计划。` },
    { question: `${primary}的效果如何评估？`, answer: `可从效率提升、成本降低、用户满意度等维度评估，具体见正文第四节。` },
  ];
}

// ============ 文章章节构建 ============

function buildSections({ topic_brief, topicTitle, primaryKw, capabilities, insertion_type, companyName, tagline, platform, targetLength }) {
  const sections = [];
  const isHard = insertion_type === 'hard';
  const usedCapabilities = capabilities.slice(0, isHard ? 4 : 2);

  // Hook（开头）
  sections.push({
    type: 'hook',
    weight: 0.10,
    content: generateHook(topicTitle, primaryKw, platform),
  });

  // 背景/定义
  sections.push({
    type: 'background',
    weight: 0.15,
    content: generateBackground(topicTitle, primaryKw, topic_brief),
  });

  // 核心价值（这里可以植入公司能力）
  const valueSection = generateCoreValue(topicTitle, primaryKw, usedCapabilities, companyName, isHard);
  sections.push({ type: 'core_value', weight: 0.20, content: valueSection });

  // 实施路径
  sections.push({
    type: 'method',
    weight: 0.20,
    content: generateMethod(topicTitle, primaryKw, platform),
  });

  // 案例
  sections.push({
    type: 'case',
    weight: 0.15,
    content: generateCase(topicTitle, primaryKw, usedCapabilities, companyName, tagline, isHard),
  });

  // 总结
  sections.push({
    type: 'conclusion',
    weight: 0.10,
    content: generateConclusion(topicTitle, primaryKw, companyName, tagline, isHard),
  });

  // FAQ
  if (platform !== 'xiaohongshu' && platform !== 'video') {
    sections.push({ type: 'faq', weight: 0.10, content: generateFAQSection(primaryKw) });
  }

  return sections;
}

function generateHook(topicTitle, primaryKw, platform) {
  if (platform === 'xiaohongshu') {
    return `📖 关于${primaryKv || topicTitle}，这篇全说清楚了！

你是不是也遇到过这种情况：${primaryKw}看起来很简单，但真正做起来却处处踩坑？`;
  }
  if (platform === 'zhihu') {
    return `# ${topicTitle}

**作者按：** 这篇文章将从实际经验出发，系统性地拆解${primaryKw}的核心逻辑和实操方法。全文无废话，建议先收藏后阅读。`;
  }
  return `${primaryKw || topicTitle}，正在成为各行各业的关注焦点。

为什么有些企业能快速落地并见到成效，而另一些却进展缓慢？本文将揭示背后的关键因素。`;
}

function generateBackground(topicTitle, primaryKw, topic_brief) {
  const intent_type = topic_brief?.search_intent?.intent_type || 'informational';
  const angle = topic_brief?.directions?.[0]?.angle || '';

  if (intent_type === 'commercial') {
    return `## ${primaryKw}的市场现状

当前，${primaryKw}已成为企业数字化转型的核心方向之一。根据行业数据，**超过67%的企业已将${primaryKw}纳入战略优先级**。

${angle ? '本选题聚焦：' + angle : ''}

为什么${primaryKw}突然这么火？三个原因：

1. **技术成熟度提升**：AI和相关技术已达到商用临界点
2. **市场需求旺盛**：企业降本增效的刚性需求
3. **成功案例增多**：先行企业的验证降低了后来者的风险`;
  }

  return `## 什么是${primaryKw}

简单来说，${primaryKw}是一种[关键方法论/技术方案]，它能够帮助企业/个人在[特定场景]中实现[核心价值]。

${topic_brief?.content_type === 'tutorial' ? '本教程将手把手带你从零掌握' + primaryKw + '，适合新手入门。' : ''}

本文基于真实案例和行业研究，帮助你全面理解${primaryKw}的本质。`;
}

function generateCoreValue(topicTitle, primaryKw, capabilities, companyName, isHard) {
  if (!capabilities || capabilities.length === 0) {
    return `## ${primaryKw}的核心价值

${primaryKw}能为企业带来：

- **效率提升**：自动化处理重复性工作，节省人力成本
- **决策优化**：数据驱动，降低主观判断失误
- **用户体验**：更快速、更个性化的服务响应

> ${isHard ? '选择正确的' + primaryKw + '方案，需要关注技术能力、服务支持和落地经验三个维度。' : ''}`;
  }

  const cap = capabilities[0];
  const capHeadline = cap?.headline || '行业领先能力';
  const capEvidence = cap?.evidence || '具备多年行业深耕经验';

  return `## ${primaryKw}为什么重要

**核心洞察：** ${capHeadline}是衡量${primaryKw}能力的黄金标准。

具体来说，优秀的${primaryKw}方案应具备以下特征：

| 维度 | 关键指标 | 行业参考 |
|------|---------|---------|
| 技术能力 | 算法精度/响应速度 | 行业领先 |
| 落地经验 | 成功案例数量 | ${capEvidence} |
| 服务支持 | 响应时效/定制能力 | 专业团队 |

${isHard ? `**${companyName}**在以上维度均有成熟积累，可提供从咨询到落地的一站式服务。` : ''}`;
}

function generateMethod(topicTitle, primaryKw, platform) {
  if (platform === 'csdn' || platform === 'zhihu') {
    return `## ${primaryKw}实施路径（分步指南）

### 第一步：需求评估

明确企业当前痛点，判断${primaryKw}的优先级。

### 第二步：方案选型

对比市面上主流方案，从技术能力、成本、服务三个维度评估。

### 第三步：试点验证

选择1-2个部门或场景进行试点，收集数据验证效果。

### 第四步：全面推广

试点成功后，制定推广计划，分阶段落地。

> **注意：** 每个阶段都建议设置里程碑和验收标准，便于及时调整策略。`;
  }

  return `## 如何正确推进${primaryKw}

**关键原则：从小到大，从点到面。**

第一步：选择切入点——从最痛、最容易出效果的场景开始
第二步：快速验证——用最小成本验证假设
第三步：沉淀经验——把成功经验标准化、可复制化
第四步：规模复制——验证成功后加大投入，快速扩张

${primaryKw}不是一蹴而就的事，保持耐心很重要。`;
}

function generateCase(topicTitle, primaryKw, capabilities, companyName, tagline, isHard) {
  const caseTemplate = `## 真实案例

**案例背景：**
[某行业]企业面临[具体痛点]，引入${primaryKw}后取得显著成效。

**实施过程：**
从需求对接到方案落地，历时约[周期]，经历了三个阶段。

**核心数据：**
- 效率提升：[X]%
- 成本降低：[X]%
- 用户满意度：[X]%

**关键启示：**
${primaryKw}的成功落地需要业务、技术、管理三方面协同配合。`;

  if (isHard && tagline) {
    return caseTemplate + `\n\n**关于${companyName}：**\n${tagline}\n如需了解更多${primaryKw}案例，欢迎与我们交流。`;
  }
  return caseTemplate;
}

function generateConclusion(topicTitle, primaryKw, companyName, tagline, isHard) {
  const conclusion = `## 总结

${primaryKw}不是一个可选项，而是企业发展的必经之路。

**核心要点回顾：**
1. ${primaryKw}的本质是[核心价值]
2. 落地路径：从小到大，从点到面
3. 成功的关键是选择合适的方案并坚持执行

**行动建议：**
现在就开始评估你的企业是否适合推进${primaryKw}，不要等到竞争对手已经领先才追悔莫及。`;

  if (isHard && tagline) {
    return conclusion + `\n\n---\n${companyName} | ${tagline}`;
  }
  return conclusion;
}

function generateFAQSection(primaryKw) {
  return `## 常见问题

**Q1: ${primaryKw}需要多长时间能看到效果？**
A：通常1-3个月可以见到初步成效，完全验证需要3-6个月。

**Q2: 哪些企业不适合推进${primaryKw}？**
A：基础数据不完善、组织变革意愿不强的企业，建议先做基础准备。

**Q3: ${primaryKw}的成本大概是多少？**
A：根据企业规模和方案复杂度，成本差异较大。建议先做需求评估获取准确报价。`;
}

// ============ 文章组装 ============

function assembleArticle({ sections, seo_metadata, insertion_type, platform }) {
  const parts = [];

  // SEO meta（在文章开头或结尾）
  if (platform !== 'xiaohongshu') {
    parts.push(`> **关键词：** ${seo_metadata.keywords.primary.join(' / ')}`);
    parts.push('');
  }

  // 按顺序拼接章节
  for (const section of sections) {
    if (section.type === 'hook') {
      parts.push(section.content);
      parts.push('');
    } else if (section.type === 'faq') {
      parts.push('');
      parts.push(section.content);
    } else {
      parts.push(section.content);
      parts.push('');
    }
  }

  return parts.join('\n');
}

// ============ 植入点记录 ============

function buildInsertionPoints(sections, insertion_type) {
  if (insertion_type === 'minimal') return [];

  const points = [];
  sections.forEach((section, idx) => {
    if (['core_value', 'case', 'conclusion'].includes(section.type)) {
      points.push({
        position: `P${Math.round((idx / sections.length) * 100)}`,
        type: insertion_type,
        section: section.type,
        rationale: `${section.type}章节适合${insertion_type === 'hard' ? '深度' : '自然'}植入`,
      });
    }
  });

  return points;
}

// ============ 证据建议 ============

function buildEvidenceHints(sections, capabilities) {
  const hints = [];

  if (sections.some(s => s.type === 'background')) {
    hints.push({ type: 'data', suggestion: '建议补充行业数据（如 adoption rate、市场规模）' });
  }
  if (sections.some(s => s.type === 'case')) {
    hints.push({ type: 'case_study', suggestion: '建议补充具体客户名称和量化数据' });
  }
  if (capabilities && capabilities.length > 0) {
    hints.push({ type: 'authority', suggestion: `建议引用${capabilities[0]?.headline || '核心能力'}的权威来源` });
  }

  return hints;
}

// ============ GEO 评分（简化）============

function estimateGEOScore(article, sections, capabilities) {
  const len = article.length;
  const hasData = /[0-9]+[%％倍]/.test(article);
  const hasQuote = /[""'""《]/.test(article);
  const hasFAQ = sections.some(s => s.type === 'faq');
  const hasStructure = sections.length >= 4;
  const hasCapability = capabilities && capabilities.length > 0;

  let score = 30; // 基础分

  if (hasData) score += 20;
  if (hasQuote) score += 15;
  if (hasFAQ) score += 12;
  if (hasStructure) score += 15;
  if (hasCapability) score += 8;

  return {
    overall: Math.min(score, 100),
    note: '简化评估，完整评估需 LLM 辅助',
    dimensions: {
      authority_quotes: hasQuote ? 12 : 4,
      statistics: hasData ? 11 : 3,
      structure: hasStructure ? 10 : 4,
      faq: hasFAQ ? 10 : 0,
    },
  };
}

// ============ 常量 ============

const LENGTH_TARGETS = {
  short: 800,
  medium: 1500,
  long: 3000,
};

// ============ CLI 测试入口 ============

if (require.main === module) {
  const sample = {
    topic_brief: {
      topic_id: 'TOPIC-001',
      topic_title: '企业如何通过AI实现数字化转型',
      content_type: 'analysis',
      directions: [{ angle: '中小企业如何低成本落地AI' }],
      search_intent: { primary: ['AI数字化转型', '企业AI落地'], secondary: [], geo: [], intent_type: 'commercial' },
    },
    brand_info: {
      company_name: '瑞森科技',
      product_name: 'RISEN增长OS',
      tagline: '企业智能增长，从瑞森开始',
    },
    capabilities: [
      { id: 'KB-001', headline: '30天上线企业知识库', evidence: '已服务200+企业' },
      { id: 'KB-002', headline: '多Agent协作引擎', evidence: '自研核心算法' },
    ],
    seo_keywords: { primary: ['AI数字化转型', '企业AI落地'], secondary: ['数字员工', 'AI转型'], geo: [] },
    insertion_type: 'hard',
    platform: 'zhihu',
    options: { length: 'medium' },
  };

  console.log('\n📊 GEO Article Generator 输入：');
  console.log(`  选题：${sample.topic_brief.topic_title}`);
  console.log(`  品牌：${sample.brand_info.company_name}`);
  console.log(`  平台：${sample.platform}`);
  console.log(`  植入：${sample.insertion_type}\n`);

  const result = run(sample);

  console.log('📝 GEO Article Generator 输出：\n');
  console.log(`  ✅ 文章字数：${result.article.length}`);
  console.log(`  ✅ Meta Title：${result.seo_metadata.meta_title}`);
  console.log(`  ✅ GEO 评分：${result.geo_score.overall}/100`);
  console.log(`  ✅ 植入点：${result.insertion_points.length}个`);
  console.log(`  ✅ 证据建议：${result.evidence_hints.length}条`);
  console.log(`\n  📄 文章预览（前800字）：`);
  console.log('  ' + '─'.repeat(60));
  console.log('  ' + result.article.slice(0, 800).replace(/\n/g, '\n  '));
  console.log('  ' + '─'.repeat(60));
  console.log('\n✅ GEO Article Generator 执行完成\n');
}

module.exports = { run };
