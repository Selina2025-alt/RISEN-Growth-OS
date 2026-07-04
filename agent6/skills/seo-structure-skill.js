/**
 * seo-structure-skill.js
 * P0: SEO 结构化输出 Skill
 *
 * 功能：
 *   1. 提取主关键词 + 长尾词
 *   2. 生成 meta title（≤60字符）+ meta description（≤160字符）
 *   3. 设计 H2/H3 标题结构（3-8个小节）
 *   4. 生成内链占位符标记
 *   5. 自动生成 FAQ（基于文章核心问题）
 *   6. 输出 Schema.org FAQ 标记
 *
 * 输入：
 *   {
 *     article_content: string,       // 文章正文
 *     topic_title: string,          // 选题标题
 *     target_keywords: string[],    // 目标关键词（来自 Agent5）
 *     platform: string,             // 发布平台
 *     intent_type: string          // informational | transactional | etc.
 *   }
 *
 * 输出：
 *   {
 *     meta_title: string,
 *     meta_description: string,
 *     h_structure: string[],
 *     internal_links: string[],
 *     faq_schema: object[],
 *     keywords: { primary: string[], secondary: string[], long_tail: string[] },
 *     schema_blocks: string  // Schema.org FAQ JSON-LD 字符串
 *   }
 */

const STOPWORDS = new Set([
  '的', '了', '是', '在', '和', '有', '我', '你', '他', '她', '它',
  '这', '那', '就', '也', '都', '而', '及', '与', '把', '被',
  '一个', '没有', '什么', '怎么', '可以', '能够', '这个', '那个',
  '如何', '怎么', '怎样', '为什么', '为何', '是不是', '要不要',
  '吗', '呢', '吧', '啊', '哦', '嗯', '之', '的', '地', '得',
]);

// ============ 核心函数 ============

/**
 * 主入口
 * @param {Object} params
 * @returns {Object} SEO 结构化输出
 */
function run({ article_content, topic_title, target_keywords = [], platform = 'default', intent_type = 'informational' }) {
  // 1. 提取/扩展关键词
  const keywords = extractKeywords(article_content, topic_title, target_keywords);

  // 2. 生成 meta title 和 description
  const meta_title = generateMetaTitle(topic_title, keywords.primary, platform);
  const meta_description = generateMetaDescription(article_content, keywords.primary, platform);

  // 3. 生成 H2/H3 标题结构
  const h_structure = generateHStructure(article_content, keywords.primary, platform);

  // 4. 生成内链占位符
  const internal_links = generateInternalLinks(keywords.secondary, keywords.primary);

  // 5. 生成 FAQ
  const faq_schema = generateFAQ(article_content, keywords.primary, intent_type);

  // 6. 生成 Schema.org FAQ JSON-LD
  const schema_blocks = generateSchemaFAQ(topic_title, faq_schema);

  return {
    meta_title,
    meta_description,
    h_structure,
    internal_links,
    faq_schema,
    keywords,
    schema_blocks,
    _meta: {
      platform,
      intent_type,
      char_count: {
        meta_title: meta_title.length,
        meta_description: meta_description.length,
      },
    },
  };
}

// ============ 关键词提取 ============

/**
 * 从文章内容 + 选题标题 + 目标关键词 提取/扩展关键词
 */
function extractKeywords(article_content, topic_title, target_keywords = []) {
  const allText = `${topic_title} ${article_content}`.toLowerCase();
  const words = (allText.match(/[\w]{2,8}/g) || [])
    .map(w => w.toLowerCase())
    .filter(w => !STOPWORDS.has(w));

  // 词频统计
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  // 按词频排序，取 Top 20
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  // primary：target_keywords 优先 + 高频词
  const primary = [
    ...new Set([
      ...target_keywords.slice(0, 5),
      ...sorted.slice(0, 5),
    ]),
  ].slice(0, 8);

  // secondary：中高频词
  const secondary = sorted
    .filter(w => !primary.includes(w))
    .slice(0, 10);

  // long_tail：从文章中抽取包含 primary 词的短语
  const long_tail = extractLongTail(allText, primary);

  return { primary, secondary, long_tail };
}

/**
 * 抽取长尾关键词（包含 primary 词的短语）
 */
function extractLongTail(text, primary) {
  const results = new Set();
  const phrases = text.match(/[\w]{4,15}/g) || [];

  for (const kw of primary.slice(0, 3)) {
    for (const phrase of phrases) {
      if (phrase.includes(kw) && phrase.length > kw.length + 2) {
        results.add(phrase);
      }
    }
  }

  return [...results].slice(0, 8);
}

// ============ Meta 标题/描述生成 ============

/**
 * 生成 meta title（≤60字符）
 * 格式：核心关键词 + 副词/品牌（可选）+ 平台适配
 */
function generateMetaTitle(topic_title, primary, platform) {
  const mainKw = primary[0] || topic_title.replace(/[^\w\u4e00-\u9fa5]/g, '').slice(0, 15);
  const brand = process.env.COMPANY_NAME || '';

  let title = mainKw;

  if (['zhihu', 'csdn', 'juejin'].includes(platform)) {
    // 技术/问答平台：加"深度"
    title = `${mainKw}：深度解析与实操指南`;
  } else if (['wechat_gzh', 'blog'].includes(platform)) {
    // 公众号/博客：加引导词
    title = `全面解读${mainKw}，从入门到精通`;
  } else if (['xiaohongshu'].includes(platform)) {
    // 小红书：emoji + 关键词
    title = `📖 ${mainKw} | 看完就懂了`;
  } else {
    title = `${mainKw}（2024最新版）`;
  }

  // 截断到 ≤60 字符
  if (title.length > 55 && brand) {
    title = `${mainKw} - ${brand}`;
  }
  return title.slice(0, 60);
}

/**
 * 生成 meta description（≤160字符）
 */
function generateMetaDescription(article_content, primary, platform) {
  // 从文章开头提取一段话作为 description
  const clean = article_content
    .replace(/[#*`>\[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim();

  let desc = clean.slice(0, 160);

  // 小红书平台：更口语化
  if (platform === 'xiaohongshu') {
    const mainKw = primary[0] || '';
    desc = `关于${mainKw}，这篇全说清楚了！建议收藏慢慢看。`.slice(0, 160);
  }

  // 截断到 ≤160 字符（不在中间截断）
  if (desc.length > 160) {
    const cutoff = desc.lastIndexOf('。', 155);
    desc = cutoff > 100 ? desc.slice(0, cutoff + 1) : desc.slice(0, 157) + '...';
  }

  return desc;
}

// ============ H2/H3 标题结构生成 ============

/**
 * 基于文章内容和高频词生成 H2/H3 标题结构
 */
function generateHStructure(article_content, primary, platform) {
  const mainKw = primary[0] || '';
  const secondaryKws = primary.slice(1, 4);

  // 基础结构模板
  const templates = {
    default: [
      `一、什么是${mainKw}（核心概念）`,
      `二、${mainKw}的核心价值与应用场景`,
      `三、如何正确使用${mainKw}（实操指南）`,
      `四、${mainKw}的常见问题与解答`,
      `五、${mainKw}的未来发展趋势`,
    ],
    tutorial: [
      `一、${mainKw}前置准备与环境搭建`,
      `二、${mainKw}核心步骤详解`,
      `三、${secondaryKws[0] || mainKw}实战案例`,
      `四、常见问题与解决方案`,
      `五、${mainKw}进阶技巧`,
    ],
    comparison: [
      `一、${mainKw}是什么`,
      `二、${mainKw}的核心优势`,
      `三、与传统方案的对比分析`,
      `四、适用场景与选型建议`,
      `五、结论与行动建议`,
    ],
  };

  // 根据 intent_type 选择模板
  let template;
  if (platform === 'csdn' || platform === 'zhihu') {
    template = templates.tutorial;
  } else if (primary.includes('对比') || primary.includes('比较')) {
    template = templates.comparison;
  } else {
    template = templates.default;
  }

  return template.slice(0, 8); // 最多8个小节
}

// ============ 内链占位符生成 ============

/**
 * 生成内链占位符
 * 格式：[相关阅读：TOPIC_ID]
 */
function generateInternalLinks(secondary_keywords = [], primary = []) {
  // 优先用 secondary，其次用 primary
  const pool = secondary_keywords.length > 0 ? secondary_keywords : primary;
  return pool
    .slice(0, 5)
    .map(kw => `[相关阅读：${kw}]`);
}

// ============ FAQ 生成 ============

/**
 * 基于文章内容生成 FAQ（5-8组）
 */
function generateFAQ(article_content, primary, intent_type) {
  const mainKw = primary[0] || '';
  const questions = [];

  // 通用问题（根据 intent_type 选择）
  if (intent_type === 'informational' || intent_type === 'commercial') {
    questions.push(
      `${mainKw}到底是什么？`,
      `为什么${mainKw}很重要？`,
      `${mainKw}适合哪些场景？`,
      `如何开始学习${mainKw}？`,
      `${mainKw}和竞品相比有什么优势？`,
    );
  } else if (intent_type === 'transactional') {
    questions.push(
      `如何快速掌握${mainKw}？`,
      `${mainKw}的正确使用方法是什么？`,
      `${mainKw}能解决什么问题？`,
      `${mainKw}的效果能持续多久？`,
      `使用${mainKw}需要注意什么？`,
    );
  } else {
    questions.push(
      `什么是${mainKw}？`,
      `${mainKw}有哪些特点？`,
      `${mainKw}怎么用？`,
      `${mainKw}多少钱/哪里获取？`,
      `${mainKw}和同类产品有何区别？`,
    );
  }

  // 从文章中提取实际答案片段作为 FAQ 答案
  const answers = questions.map(q => {
    const snippet = extractAnswerSnippet(article_content, q);
    return { question: q, answer: snippet };
  });

  return answers.slice(0, 8);
}

/**
 * 从文章中抽取与问题相关的答案片段
 */
function extractAnswerSnippet(article_content, question) {
  // 从问题中提取关键词（取最长匹配）
  const questionText = question
    .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
    .trim();
  
  // 拆分成独立词（取2-4字的中文词）
  const coreKw = questionText.slice(0, Math.min(8, questionText.length));

  // 找到包含核心词的段落
  const paragraphs = article_content.split(/\n+/).filter(p => p.trim().length > 20);

  for (const p of paragraphs) {
    if (p.includes(coreKw) && p.length > 30) {
      // 返回包含核心词的段落片段（最多100字符）
      const idx = p.indexOf(coreKw);
      const start = Math.max(0, idx - 20);
      const end = Math.min(p.length, idx + 80);
      return p.slice(start, end).replace(/\n/g, ' ').trim() + '...';
    }
  }

  // 无匹配时：从文章开头取一段
  const firstPara = paragraphs[0] || '';
  if (firstPara.length > 30) {
    return firstPara.slice(0, 100).trim() + '...';
  }

  return `关于${coreKw}，请参考正文详细说明...`;
}

// ============ Schema.org FAQ JSON-LD 生成 ============

/**
 * 生成 Schema.org FAQPage JSON-LD 字符串
 */
function generateSchemaFAQ(topic_title, faq_schema) {
  const mainKw = topic_title.replace(/[^\w\u4e00-\u9fa5]/g, '').slice(0, 20);

  const faq_jsonld = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq_schema.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return JSON.stringify(faq_jsonld, null, 2);
}

// ============ 平台特定增强 ============

/**
 * 根据平台调整输出结构
 */
function applyPlatformRules(seo_output, platform) {
  const rules = {
    zhihu: {
      add_toc: true,
      add_breadcrumb: true,
      min_h2_count: 3,
    },
    wechat_gzh: {
      add_toc: false,
      add_breadcrumb: false,
      min_h2_count: 2,
      require_cover_tip: true,
    },
    csdn: {
      add_toc: true,
      add_breadcrumb: false,
      min_h2_count: 4,
      require_code_style: true,
    },
    xiaohongshu: {
      add_toc: false,
      add_breadcrumb: false,
      min_h2_count: 2,
      use_emoji: true,
    },
  };

  const rule = rules[platform] || rules.default;
  return { ...seo_output, _platform_rules: rule };
}

// ============ CLI 测试入口 ============

if (require.main === module) {
  // 解析命令行参数（纯 Node.js，无第三方依赖）
  const argv = process.argv.slice(2);
  const get = (flag, def) => {
    const idx = argv.indexOf(flag);
    if (idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith('--')) return argv[idx + 1];
    return def;
  };
  const getMultiline = (flag, def) => {
    // 支持 --content "多行文本" 或 --content-file path
    const idx = argv.indexOf(flag);
    if (idx >= 0 && argv[idx + 1] && argv[idx + 1] === '--json') {
      // 读取 stdin
      return require('fs').readFileSync('/dev/stdin', 'utf8').trim();
    }
    return get(flag, def);
  };

  const sample = {
    article_content: `多Agent协作是当前AI领域的热门话题。多Agent系统由多个智能体组成，每个智能体负责特定任务，通过协作完成复杂工作。
在企业场景中，多Agent可以帮助实现自动化流程、智能客服、数据分析等功能。使用多Agent协作可以显著提升工作效率，降低人工成本。
本文将从多Agent的原理讲起，介绍如何搭建多Agent系统，并通过实际案例展示其应用效果。多Agent的核心是协调机制，需要解决任务分配、信息共享、冲突处理等问题。`,
    topic_title: 'AI多Agent协作完全指南',
    target_keywords: ['AI Agent', '多Agent协作', '人工智能'],
    platform: 'zhihu',
    intent_type: 'informational',
  };

  console.log('\n📊 SEO Structure Skill 输入：');
  console.log(`  选题：${sample.topic_title}`);
  console.log(`  关键词：${sample.target_keywords.join(', ')}`);
  console.log(`  平台：${sample.platform}\n`);

  const result = run(sample);
  const platformed = applyPlatformRules(result, sample.platform);

  console.log('📝 SEO Structure Skill 输出：\n');
  console.log(`  ✅ Meta Title（${result.meta_title.length}/60）：`);
  console.log(`     ${result.meta_title}\n`);
  console.log(`  ✅ Meta Description（${result.meta_description.length}/160）：`);
  console.log(`     ${result.meta_description}\n`);
  console.log(`  ✅ H2/H3 结构（共${result.h_structure.length}个）：`);
  result.h_structure.forEach((h, i) => console.log(`     ${h}`));
  console.log(`\n  ✅ 内链占位符（共${result.internal_links.length}个）：`);
  result.internal_links.forEach(l => console.log(`     ${l}`));
  console.log(`\n  ✅ FAQ（共${result.faq_schema.length}组）：`);
  result.faq_schema.forEach((f, i) => console.log(`     Q${i + 1}: ${f.question}`));
  console.log(`\n  ✅ 关键词：`);
  console.log(`     Primary: ${result.keywords.primary.join(', ')}`);
  console.log(`     Secondary: ${result.keywords.secondary.slice(0, 5).join(', ')}`);
  console.log(`\n  ✅ Schema.org FAQ JSON-LD：`);
  console.log(`     ${result.schema_blocks.slice(0, 200)}...`);

  console.log('\n✅ SEO Structure Skill 执行完成\n');
}

module.exports = { run, extractKeywords, generateMetaTitle, generateMetaDescription, generateHStructure, generateFAQ, generateSchemaFAQ };
