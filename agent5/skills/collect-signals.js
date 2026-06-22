/**
 * Signal Collector — Node.js 并发采集（含信号源健康检查）
 *
 * Fallback 链：aihot → follow-builders → tech-news → throw
 * 健康状态：lib/signal-health.js（进程内单例）
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getSource, recordAihotFailure, recordAihotSuccess,
        recordFollowBuildersFailure, recordFollowBuildersSuccess,
        recordTechNewsFailure, getState } = require('../lib/signal-health');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function fetch(url, timeoutMs = 8000) {
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
      res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ ok: false, error: e.message, status: 0 }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, error: 'timeout', status: 0 }); });
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

// ─── Aihot（有健康检查）──────────────────────────────────────────

async function collectAihot(limit = 8) {
  const source = getSource();

  // 已降级到 follow-builders，不走 aihot
  if (source !== 'aihot') {
    console.error(`[aihot] ⏭️ 跳过（当前信号源：${source}）`);
    return [];
  }

  const { ok, status, body } = await fetch(
    `https://aihot.virxact.com/api/public/items?mode=selected&take=${limit}`
  );

  if (!ok) {
    console.error(`[aihot] ❌ HTTP ${status} body: ${(body || '').slice(0, 80)}`);
    recordAihotFailure(`HTTP_${status}`);
    return [];
  }

  let data;
  try { data = JSON.parse(body); } catch { recordAihotFailure('JSON_parse_error'); return []; }

  recordAihotSuccess();

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

// ─── Follow Builders RSS（有健康检查）────────────────────────────

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

  const health = getState();
  // 如果 aihot 正常，不需要走 follow-builders
  if (health.status === 'healthy') {
    console.error(`[follow-builders] ⏭️ 跳过（aihot 健康）`);
    return [];
  }

  let anySuccess = false;
  const results = [];

  const r = await Promise.allSettled(feeds.map(async f => {
    const { ok, body } = await fetch(f.url);
    if (!ok || !body) return [];
    anySuccess = true;
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

  for (const settled of r) {
    if (settled.status === 'fulfilled') results.push(...settled.value);
  }

  if (results.length === 0 && !anySuccess) {
    recordFollowBuildersFailure();
    console.error(`[follow-builders] ❌ 所有 feed 均失败`);
  } else {
    recordFollowBuildersSuccess();
    console.error(`[follow-builders] ✓ ${results.length} 条信号`);
  }

  return results;
}

// ─── Tech News RSS（最后兜底）───────────────────────────────────

async function collectTechNews() {
  const feeds = [
    { name: 'HackerNews', url: 'https://hnrss.org/frontpage' },
    { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
    { name: 'AI News', url: 'https://www.artificialintelligence-news.com/feed/' },
    { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
    { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
    { name: 'Wired AI', url: 'https://wired.com/feed/tag/ai/latest/rss' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  ];

  let anySuccess = false;
  const results = [];

  const r = await Promise.allSettled(feeds.map(async f => {
    const { ok, body } = await fetch(f.url);
    if (!ok || !body) return [];
    anySuccess = true;
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

  for (const settled of r) {
    if (settled.status === 'fulfilled') results.push(...settled.value);
  }

  if (results.length === 0 && !anySuccess) {
    recordTechNewsFailure();
    console.error(`[tech-news] ❌ 所有 feed 均失败 → 系统 down`);
  } else {
    console.error(`[tech-news] ✓ ${results.length} 条信号`);
  }

  return results;
}

// ─── Main ───────────────────────────────────────────────────────

;(async () => {
  const health = getState();
  console.error(`[采集] 🔍 信号源健康状态: ${health.status} | aihot_failures=${health.aihot_consecutive_failures} | fallback=${health.active_fallback || '-'}`);

  // 并发采集所有源（各源内部判断是否跳过）
  const [aihot, fb, tn] = await Promise.all([
    collectAihot(50),
    collectFollowBuilders(),
    collectTechNews()
  ]);

  // 如果所有源都没有数据，说明系统 down
  if (aihot.length === 0 && fb.length === 0 && tn.length === 0) {
    const finalHealth = getState();
    console.error(`[采集] 🔴 所有信号源失败，系统 down！`);
    console.error(`[采集]   health=${JSON.stringify(finalHealth)}`);
    // 输出空信号，抛出错误
    process.stdout.write(JSON.stringify({
      collected_at: nowISO(),
      total: 0,
      sources: { aihot: 0, 'follow-builders': 0, 'tech-news': 0 },
      signals: [],
      health_status: finalHealth.status,
      error: 'All signal sources failed. System down.'
    }, null, 2));
    return;
  }

  // 去重
  const seen = new Set();
  const all = [...aihot, ...fb, ...tn].filter(s => {
    const k = s.title.slice(0, 40).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });

  const finalHealth = getState();
  console.error(`[采集] ✅ aihot=${aihot.length} follow-builders=${fb.length} tech-news=${tn.length} | 去重后=${all.length} | status=${finalHealth.status}`);

  process.stdout.write(JSON.stringify({
    collected_at: nowISO(),
    total: all.length,
    sources: { aihot: aihot.length, 'follow-builders': fb.length, 'tech-news': tn.length },
    health_status: finalHealth.status,
    active_fallback: finalHealth.active_fallback,
    signals: all
  }, null, 0));
})();
