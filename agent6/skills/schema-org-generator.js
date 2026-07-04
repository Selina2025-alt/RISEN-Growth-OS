/**
 * schema-org-generator.js
 * P1: Schema.org 结构化数据生成 Skill
 *
 * 来源：参考 yao-open-prompts/schema-org-geo-optimization.md
 *
 * 功能：
 *   1. 为文章生成 Schema.org 结构化数据（JSON-LD）
 *   2. 优化 name / description 的 AI 可读性
 *   3. 生成 Article、FAQPage、BreadcrumbList 等多种 Schema 类型
 *
 * 输入：
 *   {
 *     article_content: string,
 *     topic_title: string,
 *     platform: string,
 *     publish_date: string,
 *     author: string,
 *     url: string,
 *   }
 *
 * 输出：
 *   {
 *     schemas: {
 *       article: string (JSON-LD),
 *       faq: string (JSON-LD),
 *       breadcrumb: string (JSON-LD),
 *     },
 *     name_optimized: string,
 *     description_optimized: string,
 *   }
 */

function run({ article_content, topic_title, platform, publish_date, author, url } = {}) {
  const title = topic_title || '未命名文章';
  const date = publish_date || new Date().toISOString().split('T')[0];

  // 优化 title 和 description
  const nameOptimized = optimizeName(title);
  const descOptimized = optimizeDescription(article_content, title);

  // 生成各类 Schema
  const schemas = {
    article: generateArticleSchema({ title, nameOptimized, descOptimized, date, author, url, platform }),
    faq: generateFAQSchema(article_content),
    breadcrumb: generateBreadcrumbSchema(topic_title, platform),
  };

  return {
    schemas,
    name_optimized: nameOptimized,
    description_optimized: descOptimized.slice(0, 160),
    _meta: { platform, date, author },
  };
}

// ============ name/description 优化 ============

function optimizeName(title) {
  // 移除平台特定前缀，聚焦核心关键词
  let name = title
    .replace(/^(知乎|公众号|小红书|CSDN|简书|微博|抖音)[:：]\s*/i, '')
    .replace(/\s*\(.*?\)\s*$/g, '')  // 移除括号内版本标注
    .trim();

  // 长度控制：8-60字符
  if (name.length > 60) {
    name = name.slice(0, 57) + '...';
  }

  return name || title;
}

function optimizeDescription(content, title) {
  if (!content) return title;

  // 取第一段作为 description
  const firstPara = content.split(/\n+/).find(p => p.trim().length > 50) || '';
  const clean = firstPara
    .replace(/[#*`>\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // AI 友好描述：完整句子、前沿陈述、含关键词
  let desc = clean.slice(0, 200);
  if (desc.length < 50) {
    desc = `深入分析${title}的核心逻辑、实施路径和真实案例，帮助你快速掌握关键要点。`;
  }

  return desc;
}

// ============ Article Schema ============

function generateArticleSchema({ title, nameOptimized, descOptimized, date, author, url, platform }) {
  const type = platform === 'zhihu' ? 'TechArticle' :
    platform === 'csdn' ? 'TechArticle' :
    platform === 'wechat_gzh' ? 'Article' : 'Article';

  const schema = {
    '@context': 'https://schema.org',
    '@type': type,
    headline: nameOptimized,
    description: descOptimized.slice(0, 200),
    datePublished: date,
    author: author ? {
      '@type': 'Person',
      name: author,
    } : undefined,
    publisher: {
      '@type': 'Organization',
      name: process.env.COMPANY_NAME || 'RISEN',
    },
    url: url || undefined,
    mainEntityOfPage: url ? {
      '@type': 'WebPage',
      '@id': url,
    } : undefined,
    articleSection: inferSection(title),
    keywords: extractKeywords(title),
    wordCount: countWords(descOptimized + title),
  };

  return JSON.stringify(schema, null, 2);
}

function generateFAQSchema(content) {
  if (!content) return null;

  const faqMatches = content.match(/[*#]?\s*([^\n?]{5,60}\?)\s*\n\s*([^\n]{10,100})/g) || [];
  if (faqMatches.length === 0) return null;

  const questions = faqMatches.slice(0, 10).map(match => {
    const parts = match.replace(/[*#]\s*/, '').split(/\n/);
    return {
      '@type': 'Question',
      name: parts[0].trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: (parts[1] || '').trim().slice(0, 300),
      },
    };
  });

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions,
  };

  return JSON.stringify(schema, null, 2);
}

function generateBreadcrumbSchema(title, platform) {
  const items = [
    { '@type': 'ListItem', name: '首页', position: 1 },
    { '@type': 'ListItem', name: platformMap(platform), position: 2 },
    { '@type': 'ListItem', name: title.slice(0, 30), position: 3 },
  ];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };

  return JSON.stringify(schema, null, 2);
}

// ============ 辅助函数 ============

function platformMap(platform) {
  const map = {
    zhihu: '知乎',
    csdn: 'CSDN',
    wechat_gzh: '公众号',
    xiaohongshu: '小红书',
    juejin: '掘金',
    bilibili: '哔哩哔哩',
    blog: '博客',
  };
  return map[platform] || '文章';
}

function inferSection(title) {
  const keywords = {
    '技术': '技术',
    '教程': '技术',
    '指南': '技术',
    '分析': '行业分析',
    '趋势': '行业分析',
    '报告': '行业分析',
    '案例': '成功案例',
    '经验': '经验分享',
    '观点': '观点',
    '测评': '产品测评',
  };
  for (const [kw, section] of Object.entries(keywords)) {
    if (title.includes(kw)) return section;
  }
  return '行业洞察';
}

function extractKeywords(title) {
  return title.split(/[,\s，。、]/).filter(w => w.length >= 2).slice(0, 8).join(',');
}

function countWords(text) {
  return (text.match(/[\w\u4e00-\u9fa5]+/g) || []).length;
}

// ============ CLI ============

if (require.main === module) {
  const sample = {
    article_content: `数字化转型已成为企业发展的必经之路。根据麦肯锡2023年报告，AI落地可帮助企业提升效率30%以上。

多Agent协作是当前AI领域的热门话题。在企业场景中，多Agent可以帮助实现自动化流程、智能客服、数据分析等功能。

我认为，企业应该优先考虑采用多Agent方案。因为它具有以下优势：1）效率提升明显；2）成本显著降低；3）扩展性强。

建议企业从试点项目开始，逐步推广。效果显著，企业反馈良好。`,
    topic_title: '企业如何通过AI实现数字化转型',
    platform: 'zhihu',
    publish_date: '2024-01-15',
    author: 'RISEN增长团队',
  };

  const result = run(sample);

  console.log('\n📊 Schema.org Generator 输出\n');
  console.log(`  ✅ name 优化：${result.name_optimized}`);
  console.log(`  ✅ description（${result.description_optimized.length}字）：${result.description_optimized.slice(0, 80)}...\n`);
  console.log(`  📄 Article Schema：`);
  console.log(`     ${result.schemas.article.slice(0, 200)}...\n`);
  console.log(`  📄 Breadcrumb Schema：`);
  console.log(`     ${result.schemas.breadcrumb.slice(0, 200)}...\n`);
  if (result.schemas.faq) {
    console.log(`  📄 FAQ Schema：存在（${JSON.parse(result.schemas.faq).mainEntity.length}组）`);
  } else {
    console.log(`  📄 FAQ Schema：无`);
  }
  console.log('\n✅ Schema.org Generator 执行完成\n');
}

module.exports = { run };
