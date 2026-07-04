/**
 * content-lineage-tracker.js
 * P2: 内容血缘追踪 Skill
 *
 * 功能：
 *   1. 记录文章的完整来源血缘
 *   2. 追踪每个段落使用的 capability card
 *   3. 生成唯一的内容指纹（content fingerprint）
 *   4. 输出标准化的 lineage 记录（供 Agent9 归因使用）
 *
 * 输入：
 *   {
 *     article_id: string,
 *     article_content: string,
 *     topic_id: string,
 *     capability_cards_used: string[],
 *     insertion_type: 'soft' | 'hard',
 *     platform: string,
 *     sources: [{ type, url, content_id }],
 *     seo_metadata: object,
 *     geo_score: object,
 *   }
 *
 * 输出：
 *   {
 *     lineage_id: string,
 *     article_id: string,
 *     fingerprint: string,          // 内容指纹（用于去重/比对）
 *     sources: [...],
 *     paragraphs: [...],
 *     capabilities: [...],
 *     seo_applied: boolean,
 *     geo_score: number,
 *     created_at: string,
 *   }
 */

const crypto = require('crypto');

function run(input) {
  const {
    article_id = generateId('ART'),
    article_content = '',
    topic_id = '',
    capability_cards_used = [],
    insertion_type = 'soft',
    platform = 'unknown',
    sources = [],
    seo_metadata = null,
    geo_score = null,
  } = input;

  // 内容指纹：基于文章内容 + 时间戳的 hash
  const fingerprint = generateFingerprint(article_content, article_id);

  // 段落血缘
  const paragraphs = segmentAndTrack(article_content, capability_cards_used);

  // 来源血缘
  const sourceLineage = trackSources(sources, paragraphs);

  // Capability 血缘
  const capabilityLineage = trackCapabilities(capability_cards_used, paragraphs);

  return {
    lineage_id: generateId('LINEAGE'),
    article_id,
    fingerprint,
    topic_id,
    platform,
    insertion_type,
    sources: sourceLineage,
    paragraphs,
    capabilities: capabilityLineage,
    seo_applied: !!seo_metadata,
    geo_score: geo_score?.overall || null,
    seo_metadata: seo_metadata || null,
    created_at: new Date().toISOString(),
    _meta: {
      content_hash: crypto.createHash('sha256').update(article_content).digest('hex').slice(0, 16),
      paragraph_count: paragraphs.length,
      source_count: sources.length,
      capability_count: capability_cards_used.length,
    },
  };
}

// ============ 内容指纹 ============

function generateFingerprint(content, articleId) {
  const short = crypto
    .createHash('md5')
    .update((content || '').slice(0, 500) + articleId)
    .digest('hex')
    .slice(0, 12);
  return `LIN-${short.toUpperCase()}`;
}

// ============ 段落血缘追踪 ============

function segmentAndTrack(content, capabilityCardsUsed) {
  if (!content) return [];

  const paragraphs = content.split(/\n\n+/);
  const usedCards = new Set(capabilityCardsUsed || []);

  return paragraphs
    .filter(p => p.trim().length > 20)
    .map((p, idx) => {
      // 简单关键词匹配
      const matchedCaps = findMatchedCapabilities(p, [...usedCards]);
      return {
        index: idx,
        char_count: p.length,
        words: p.split(/\s+/).filter(Boolean).length,
        content_preview: p.slice(0, 60).replace(/\n/g, ' '),
        capability_ids: matchedCaps,
        has_data: /[0-9]+[%％倍]/.test(p),
        has_quote: /[""'""《]/.test(p),
        has_company_ref: /[公司|企业|产品|方案]/.test(p),
      };
    });
}

function findMatchedCapabilities(text, cards) {
  if (!cards.length) return [];
  const textLower = text.toLowerCase();
  return cards.filter(card => {
    const id = card.replace('KB-', '').toLowerCase();
    return textLower.includes(id);
  }).slice(0, 3);
}

// ============ 来源血缘 ============

function trackSources(sources, paragraphs) {
  return (sources || []).map((src, idx) => ({
    index: idx,
    type: src.type || 'unknown',
    url: src.url || null,
    content_id: src.content_id || null,
    used_in_paragraphs: findSourceParagraphs(src, paragraphs),
    relevance: src.relevance || 0.8,
  }));
}

function findSourceParagraphs(source, paragraphs) {
  if (!source.text && !source.url) return [];
  const searchText = ((source.text || '') + (source.url || '')).toLowerCase();
  return paragraphs
    .filter(p => {
      const preview = (p.content_preview || '').toLowerCase();
      return searchText && preview.includes(searchText.slice(0, 20));
    })
    .map(p => p.index);
}

// ============ Capability 血缘 ============

function trackCapabilities(capabilityCardsUsed, paragraphs) {
  return (capabilityCardsUsed || []).map(capId => {
    const usedIn = paragraphs
      .filter(p => (p.capability_ids || []).includes(capId))
      .map(p => p.index);

    return {
      capability_id: capId,
      used_in_paragraphs: usedIn,
      usage_count: usedIn.length,
      first_appearance: usedIn[0] ?? null,
    };
  });
}

// ============ 工具 ============

function generateId(prefix) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${ts}-${rand}`;
}

// ============ CLI ============

if (require.main === module) {
  const sample = {
    article_id: 'ART-test-001',
    article_content: `数字化转型已成为企业发展的必经之路。根据麦肯锡2023年报告，AI落地可帮助企业提升效率30%以上。

多Agent协作是当前AI领域的热门话题。在企业场景中，多Agent可以帮助实现自动化流程、智能客服、数据分析等功能。

我认为，企业应该优先考虑采用多Agent方案。建议企业从试点项目开始，逐步推广。效果显著，企业反馈良好。`,
    topic_id: 'TOPIC-001',
    capability_cards_used: ['KB-001', 'KB-002', 'KB-003'],
    insertion_type: 'hard',
    platform: 'zhihu',
    sources: [
      { type: 'report', url: 'https://mckinsey.com/report2023', text: '麦肯锡报告', relevance: 0.95 },
      { type: 'web', url: 'https://example.com/article', text: '行业分析', relevance: 0.8 },
    ],
    seo_metadata: { meta_title: 'AI数字化转型指南', meta_description: '深度解读' },
    geo_score: { overall: 72 },
  };

  const result = run(sample);

  console.log('\n🔗 Content Lineage Tracker 输出\n');
  console.log(`  Lineage ID: ${result.lineage_id}`);
  console.log(`  Article ID: ${result.article_id}`);
  console.log(`  Fingerprint: ${result.fingerprint}`);
  console.log(`  段落数: ${result.paragraphs.length}`);
  console.log(`  来源数: ${result.sources.length}`);
  console.log(`  Capability数: ${result.capabilities.length}`);
  console.log(`  SEO已应用: ${result.seo_applied}`);
  console.log(`  GEO评分: ${result.geo_score}`);

  console.log('\n  段落血缘：');
  result.paragraphs.forEach(p => {
    console.log(`    P${p.index}: ${p.content_preview}...`);
    console.log(`      数据:${p.has_data} 引用:${p.has_quote} 公司:${p.has_company_ref} Capabilities:${p.capability_ids.join(',') || '(无)'}`);
  });

  console.log('\n  Capability血缘：');
  result.capabilities.forEach(c => {
    console.log(`    ${c.capability_id}: 出现${c.usage_count}次，首次P${c.first_appearance}`);
  });

  console.log('\n✅ Content Lineage Tracker 执行完成\n');
}

module.exports = { run };
