/**
 * Agent 5 · Skill 8 · resource-collector.js
 * 资料采集：YouTube / arXiv / 网页 / PDF / RSS
 *
 * 输入：选题方向（已确认要深研的）
 * 输出：SourceIndex + EvidenceMap + KnowledgeBase
 */

const https = require('https');
const http = require('http');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const SOURCE_TIERS = {
  S: ['official_blog', 'official_docs', 'customer_case', 'official_customer_case', 'paper', 'launch_video'],
  A: ['authority_media', 'industry_report', 'podcast', 'customer_story'],
  B: ['professional_blog', 'technical_community', 'analysis_article'],
  C: ['secondary_summary', 'media_repost', 'self_media'],
  D: ['unverifiable', 'unsourced', 'no_date', 'repost', 'ai_spam', 'screenshot']
};

/**
 * 主函数
 * @param {Object} opts
 * @param {Object} opts.topic - 选题方向（包含title/direction_id/content_form等）
 * @param {Object} opts.researchPlan - 研究计划（关键词等）
 */
async function collectResources(opts = {}) {
  const { topic = {}, researchPlan = {} } = opts;

  const sources = [];
  const errors = [];

  // YouTube采集
  const ytQueries = researchPlan.youtube_queries || researchPlan.queries || [];
  for (const q of (ytQueries.slice(0, 3))) {
    try {
      const result = await collectYouTube(q, topic.topic_id);
      if (result) {
        sources.push(result);
      }
    } catch (e) {
      errors.push({ type: 'youtube', query: q, error: e.message });
    }
  }

  // arXiv采集
  const paperQueries = researchPlan.paper_queries || [];
  for (const q of (paperQueries.slice(0, 3))) {
    try {
      const result = await collectArxiv(q, topic.topic_id);
      if (result) sources.push(result);
    } catch (e) {
      errors.push({ type: 'arxiv', query: q, error: e.message });
    }
  }

  // 网页正文采集
  const urls = researchPlan.urls || [];
  for (const url of (urls.slice(0, 5))) {
    try {
      const result = await extractWebContent(url, topic.topic_id);
      if (result) sources.push(result);
    } catch (e) {
      errors.push({ type: 'web', url, error: e.message });
    }
  }

  // 来源分级
  const tiered = assignTiers(sources);

  // 证据整理
  const evidence = buildEvidenceMap(topic, tiered);

  // 知识库
  const knowledgeBase = buildKnowledgeBase(topic, tiered);

  return {
    topic_id: topic.topic_id,
    direction_id: topic.direction_id,
    sources: tiered,
    evidence,
    knowledge_base: knowledgeBase,
    stats: {
      total: sources.length,
      by_tier: countByTier(tiered)
    },
    errors
  };
}

// ─── YouTube ────────────────────────────────────────────────────────

async function collectYouTube(query, topicId) {
  // 用 YouTube Data API v3 搜索
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // 没有API key时，用Innertube模拟
    return mockYouTubeResult(query, topicId);
  }

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=3&key=${apiKey}`;
  const data = await fetchJson(searchUrl);

  const results = [];
  for (const item of (data.items || [])) {
    results.push({
      source_id: `S${String(Date.now()).slice(-6)}`,
      type: 'youtube',
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      author: item.snippet.channelTitle,
      published_at: item.snippet.publishedAt,
      view_count: null,
      transcript: null,
      topic_id: topicId,
      collected_at: new Date().toISOString()
    });
  }

  return results[0];
}

async function mockYouTubeResult(query, topicId) {
  return {
    source_id: `S${String(Date.now()).slice(-6)}`,
    type: 'youtube',
    title: `YouTube视频：${query}`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    author: '待采集',
    published_at: new Date().toISOString(),
    view_count: null,
    transcript: null,
    topic_id: topicId,
    collected_at: new Date().toISOString(),
    status: 'pending',
    note: '需YouTube API Key才能抓元数据'
  };
}

// ─── arXiv ────────────────────────────────────────────────────────

async function collectArxiv(query, topicId) {
  const searchUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3&sortBy=relevance`;
  const xml = await fetchText(searchUrl);

  // 解析Atom feed
  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
  if (entries.length === 0) return null;

  const entry = entries[0];
  const getField = (tag) => {
    const m = entry.match(new RegExp(`<${tag}[^>]*>([\s\S]*?)</${tag}>`));
    return m ? m[1].trim() : '';
  };

  return {
    source_id: `S${String(Date.now()).slice(-6)}`,
    type: 'paper',
    title: getField('title').replace(/\n/g, ' '),
    url: getField('id'),
    author: getField('author').replace(/<name>([\s\S]*?)<\/name>/g, '$1, ').trim(),
    published_at: getField('published'),
    abstract: getField('summary'),
    topic_id: topicId,
    collected_at: new Date().toISOString()
  };
}

// ─── 网页正文 ──────────────────────────────────────────────────────

async function extractWebContent(url, topicId) {
  const html = await fetchText(url);
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window);
  const article = reader.parse();

  if (!article) throw new Error('无法解析正文');

  return {
    source_id: `S${String(Date.now()).slice(-6)}`,
    type: detectSourceType(url),
    title: article.title,
    url,
    author: article.byline || null,
    published_at: null,
    excerpt: article.excerpt || null,
    topic_id: topicId,
    collected_at: new Date().toISOString()
  };
}

function detectSourceType(url) {
  if (url.includes('zhihu') || url.includes('toutiao') || url.includes('baijiahao')) return 'chinese_article';
  if (url.includes('36kr') || url.includes('pingwest') || url.includes('thepaper')) return 'authority_media';
  if (url.includes('github') || url.includes('docs.')) return 'official_docs';
  return 'article';
}

// ─── 来源分级 ──────────────────────────────────────────────────────

function assignTiers(sources) {
  return sources.map(s => {
    const tier = guessTier(s);
    return {
      ...s,
      tier,
      status: tier === 'D' ? 'rejected' : 'pending',
      quality_warnings: getQualityWarnings(s, tier)
    };
  });
}

function guessTier(source) {
  const url = source.url || '';
  const type = source.type || '';
  const title = source.title || '';

  // 官方来源 → S
  if (url.includes('github.com') || url.includes('docs.') || url.includes('developer.')) return 'S';
  if (type === 'paper' && source.published_at) return 'S';
  if (url.includes('arxiv.org')) return 'S';

  // 权威媒体 → A
  if (['36kr', 'thepaper', 'pingwest', 'sina', 'tencent'].some(d => url.includes(d))) return 'A';
  if (type === 'authority_media') return 'A';

  // 专业内容 → B
  if (type === 'chinese_article' && source.author) return 'B';
  if (type === 'professional_blog') return 'B';

  // C级：二手转述
  if (!source.author || !source.published_at) return 'C';
  if (type === 'secondary_summary' || type === 'media_repost') return 'C';

  return 'C';
}

function getQualityWarnings(source, tier) {
  const warnings = [];
  if (!source.author) warnings.push('无作者');
  if (!source.published_at) warnings.push('无发布日期');
  if (tier === 'D') warnings.push('来源不可追溯');
  if (source.type === 'screenshot') warnings.push('截图来源不可验证');
  return warnings;
}

// ─── Evidence Map ──────────────────────────────────────────────────

function buildEvidenceMap(topic, tieredSources) {
  const accepted = tieredSources.filter(s => s.status !== 'rejected');
  const facts = extractFacts(topic, accepted);

  return {
    topic_id: topic.topic_id,
    direction_id: topic.direction_id,
    core_claims: facts.map((f, i) => ({
      claim_id: `E${i + 1}`,
      claim: f,
      source_ids: accepted.slice(0, 3).map(s => s.source_id),
      evidence_type: guessEvidenceType(f),
      strength: guessStrength(f, accepted)
    }))
  };
}

function extractFacts(topic, sources) {
  // 简单：从标题和摘要提取关键事实
  const texts = sources.map(s => `${s.title} ${s.excerpt || ''} ${s.abstract || ''}`).join(' ');
  const sentences = texts.split(/[。！？\n]/).filter(s => s.length > 10 && s.length < 200);
  return sentences.slice(0, 5);
}

function guessEvidenceType(text) {
  if (text.match(/数据|数字|%|增长|下降/)) return 'data';
  if (text.match(/案例|客户|企业/)) return 'case';
  if (text.match(/说|认为|观点/)) return 'quote';
  if (text.match(/论文|研究|实验/)) return 'theory';
  return 'fact';
}

function guessStrength(text, sources) {
  const strongSources = sources.filter(s => s.tier === 'S' || s.tier === 'A');
  if (strongSources.length >= 2) return 'strong';
  if (strongSources.length === 1) return 'medium';
  return 'weak';
}

// ─── Knowledge Base ────────────────────────────────────────────────

function buildKnowledgeBase(topic, tieredSources) {
  const strong = tieredSources.filter(s => s.tier === 'S' || s.tier === 'A');
  const medium = tieredSources.filter(s => s.tier === 'B');
  const rejected = tieredSources.filter(s => s.tier === 'D');

  const lines = [
    `# 知识库：${topic.title}`,
    '',
    `## 选题方向：${topic.direction_id}`,
    '',
    `## 核心事实`,
  ];

  for (const s of strong) {
    lines.push(`- ${s.title} [${s.source_id}]`);
  }

  if (medium.length > 0) {
    lines.push('', '## 参考资料');
    for (const s of medium) {
      lines.push(`- ${s.title} [${s.source_id}]`);
    }
  }

  if (rejected.length > 0) {
    lines.push('', '## 已排除来源');
    for (const s of rejected) {
      lines.push(`- ${s.title} — ${s.quality_warnings.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function countByTier(sources) {
  const counts = { S: 0, A: 0, B: 0, C: 0, D: 0, total: sources.length };
  for (const s of sources) {
    if (counts[s.tier] !== undefined) counts[s.tier]++;
  }
  return counts;
}

// ─── HTTP helpers ─────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ─── AIHOT 信号采集（真实API） ───────────────────────────────────

const AIHOT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const AIHOT_BASE = 'https://aihot.virxact.com';

/**
 * 从 aihot.virxact.com 真实 API 拉每日 AI 热点信号
 * @param {number} limit - 最多返回多少条，默认8条
 * @returns {Promise<Array>} RawSignal[]
 */
async function collectAihotSignals(limit = 8) {
  try {
    const data = await fetchJson(
      `${AIHOT_BASE}/api/public/items?mode=selected&take=${Math.min(limit, 50)}`,
      { headers: { 'User-Agent': AIHOT_UA }, timeoutMs: 8000 }
    );
    return ((data?.items) || []).map((item, index) => ({
      id: `SIG-AIHOT-${item.id || String(index).padStart(3, '0')}`,
      type: 'aihot',
      title: item.title || item.title_en || `AI HOT ${index + 1}`,
      summary: item.summary || '',
      url: item.url || null,
      published_at: item.publishedAt || null,
      collected_at: isoNow(),
      tags: [item.category].filter(Boolean),
      weight: item.score ? Math.min(1.5, item.score / 70) : 1.0,
      content_type: categoryToContentType(item.category),
      metadata: {
        aihot_id: item.id || '',
        source_name: item.source || '',
        category: item.category || '',
        score: item.score || 0
      }
    }));
  } catch (e) {
    console.error('[aihot] API调用失败:', e.message);
    return [];
  }
}

function categoryToContentType(category) {
  const map = {
    'industry': '行业洞察',
    'ai-products': '产品发布',
    'paper': '论文研究',
    'tip': '利他（教程）',
    'product': '企业案例',
    'people': '人物观点',
    'security': '行业洞察',
    'policy': '行业洞察'
  };
  return map[category] || '行业洞察';
}

// ─── Helpers ────────────────────────────────────────────────────

function shortHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

function isoNow() {
  return new Date().toISOString();
}

function fetchJson(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: opts.headers || {} }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    if (opts.timeoutMs) {
      req.setTimeout(opts.timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
    }
  });
}

module.exports = { collectResources, collectAihotSignals };
