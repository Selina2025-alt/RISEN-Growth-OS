/**
 * Signal Collector — Node.js 并发采集
 * 采集三个技能的真实信号:
 * 1. aihot.virxact.com (REST API)
 * 2. follow-builders RSS (Builder 博客)
 * 3. tech-news RSS (HackerNews/TechCrunch/etc)
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fetch(url, timeoutMs = 6000) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location;
        const base = `https://${parsed.host}`;
        const redirectUrl = loc.startsWith('http') ? loc : (loc.startsWith('/') ? base + loc : `${base}/${loc}`);
        resolve(fetch(redirectUrl, timeoutMs));
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ ok: true, status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

function shortHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h &= 0xFFFFFFFF;
  }
  return Math.abs(h).toString(16).slice(0, 8);
}

function nowISO() {
  return new Date().toISOString();
}

function unescapeXML(str) {
  return str.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/<!\[CDATA\[|\]\]>/g, '');
}

function parseRSS(xml) {
  const items = [];
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const item of itemMatches.slice(0, 10)) {
    const titleM = item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/);
    const linkM = item.match(/<link>([\s\S]*?)<\/link>/);
    const descM = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/);
    const pubM = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const title = unescapeXML((titleM ? (titleM[1] || titleM[2]) : '') || '').trim();
    const link = (linkM ? linkM[1] : '') || '';
    const desc = unescapeXML((descM ? (descM[1] || descM[2]) : '') || '').replace(/<[^>]+>/g, '').trim().slice(0, 150);
    const pub = (pubM ? pubM[1] : '') || '';
    if (title && link) items.push({ title, link, desc, pub });
  }
  return items;
}

// ─── Aihot ─────────────────────────────────────────────────────────

async function collectAihot(limit = 8) {
  const { ok, body } = await fetch(`https://aihot.virxact.com/api/public/items?mode=selected&take=${limit}`);
  if (!ok) { console.error('[aihot] fetch failed:', body); return []; }
  let data;
  try { data = JSON.parse(body); } catch { return []; }
  const items = data?.items || [];
  const catMap = { industry: '行业洞察', 'ai-products': '产品发布', paper: '论文研究', tip: '利他（教程）', product: '企业案例', people: '人物观点' };
  return items.map((item, i) => ({
    id: `SIG-AIHOT-${item.id || shortHash(item.title || String(i))}`,
    type: 'aihot',
    title: item.title || item.title_en || `AI热点 ${i + 1}`,
    summary: item.summary || '',
    url: item.url || null,
    published_at: item.publishedAt || null,
    collected_at: nowISO(),
    tags: [item.category].filter(Boolean),
    weight: Math.min(1.5, (parseFloat(item.score) || 0) / 70 + 0.8),
    content_type: catMap[item.category] || '行业洞察',
    metadata: { aihot_id: String(item.id || ''), source_name: item.source || '', category: item.category || '', score: item.score || 0 }
  }));
}

// ─── Follow Builders RSS ──────────────────────────────────────────

async function collectFollowBuilders() {
  const feeds = [
    { name: 'Anthropic', url: 'https://www.anthropic.com/feed.xml' },
    { name: 'OpenAI', url: 'https://openai.com/blog/feed' },
    { name: 'DeepMind', url: 'https://deepmind.google/blog/rss.xml' },
    { name: 'Google AI', url: 'https://blog.google/technology/ai/feed/' },
    { name: 'Meta AI', url: 'https://ai.meta.com/blog/feed/' },
    { name: 'Microsoft AI', url: 'https://blogs.microsoft.com/ai/feed/' },
    { name: 'Stability AI', url: 'https://stability.ai/feed' },
  ];
  const results = [];
  const r = await Promise.all(feeds.map(async f => {
    const { ok, body } = await fetch(f.url);
    if (!ok || !body) return [];
    return parseRSS(body).map(item => ({
      id: `SIG-FB-${shortHash(item.link)}`,
      type: 'follow-builders',
      title: item.title,
      summary: item.desc,
      url: item.link,
      published_at: item.pub || null,
      collected_at: nowISO(),
      tags: [f.name],
      weight: 1.0,
      content_type: '行业洞察',
      metadata: { source: f.name, feed: 'rss' }
    }));
  }));
  for (const batch of r) results.push(...batch);
  console.error(`[follow-builders] ✓ ${results.length} 条信号`);
  return results;
}

// ─── Tech News RSS ────────────────────────────────────────────────

async function collectTechNews() {
  const feeds = [
    { name: 'HackerNews', url: 'https://hnrss.org/frontpage' },
    { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
    { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/' },
    { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
    { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
    { name: 'Wired AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
    { name: 'AI Blog', url: 'https://feeds.feedburner.com/AIblog' },
    { name: 'AI Trends', url: 'https://www.artificialintelligence-news.com/feed/' },
  ];
  const results = [];
  const r = await Promise.all(feeds.map(async f => {
    const { ok, body } = await fetch(f.url);
    if (!ok || !body) return [];
    return parseRSS(body).map(item => ({
      id: `SIG-TN-${shortHash(item.link)}`,
      type: 'tech-news',
      title: item.title,
      summary: item.desc,
      url: item.link,
      published_at: item.pub || null,
      collected_at: nowISO(),
      tags: [f.name],
      weight: 1.0,
      content_type: '行业洞察',
      metadata: { source: f.name, feed: 'rss' }
    }));
  }));
  for (const batch of r) results.push(...batch);
  console.error(`[tech-news] ✓ ${results.length} 条信号`);
  return results;
}

// ─── Main ────────────────────────────────────────────────────────

;(async () => {
  const [aihot, fb, tn] = await Promise.all([
    collectAihot(50),
    collectFollowBuilders(),
    collectTechNews()
  ]);

  // 去重
  const seen = new Set();
  const all = [...aihot, ...fb, ...tn].filter(s => {
    const k = s.title.slice(0, 40).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  console.error(`[采集] ✅ aihot=${aihot.length} follow-builders=${fb.length} tech-news=${tn.length} | 去重后=${all.length}`);

  process.stdout.write(JSON.stringify({
    collected_at: nowISO(),
    total: all.length,
    sources: { aihot: aihot.length, 'follow-builders': fb.length, 'tech-news': tn.length },
    signals: all
  }, null, 0));
})();
