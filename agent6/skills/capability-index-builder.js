// skills/capability-index-builder.js
// P1.3：从 Agent2/3 构建索引，更新 _index.json

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../lib/file-utils');
const { getCapabilityCards, scanKnowledgeDir } = require('./knowledge-base-reader');

const INDEX_PATH = path.join(__dirname, '../knowledge/_index.json');

/**
 * 加载已有索引
 */
function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) return { cards: [], updated_at: null };
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {
    return { cards: [], updated_at: null };
  }
}

/**
 * 保存索引
 */
function saveIndex(index) {
  writeJsonAtomic(INDEX_PATH, index);
}

/**
 * 从 Agent2 输出构建索引（company/ + product/）
 * @param {Object} [opts]
 * @param {string} [opts.sourceDir='../knowledge'] - 知识库根目录
 */
async function buildFromAgent2({ sourceDir = '../knowledge' } = {}) {
  const base = path.join(__dirname, sourceDir);
  const dirs = ['company', 'product'].filter(d =>
    fs.existsSync(path.join(base, d))
  );

  const allCards = [];

  for (const dir of dirs) {
    const files = fs.readdirSync(path.join(base, dir)).filter(f => /\.(md|txt|json)$/i.test(f));
    for (const file of files) {
      const filePath = path.join(base, dir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(file).toLowerCase();

      if (ext === '.json') {
        try {
          const parsed = JSON.parse(content);
          // 支持 { headline, topics } 或 { capabilities: [] } 格式
          if (parsed.headline) {
            allCards.push(buildCardFromJson(filePath, parsed));
          }
        } catch {
          // ignore invalid JSON
        }
      } else {
        allCards.push(buildCardFromText(`${dir}/${file}`, content));
      }
    }
  }

  return allCards;
}

/**
 * 从文本内容构建 CapabilityCard
 */
function buildCardFromText(source, content) {
  const lines = content.split('\n').filter(l => l.trim());
  const headline = lines[0].replace(/^#+\s*/, '').trim().slice(0, 100);
  const body = lines.slice(1).join(' ').replace(/[#*`]/g, '').trim();

  return {
    id: `KB-${require('crypto').randomBytes(2).toString('hex')}`,
    headline: headline || '未知能力',
    applicable_topics: extractTopics(headline + ' ' + body).slice(0, 5),
    insertion_type: body.includes('支持') || body.includes('实现') ? 'hard' : 'soft',
    confidence: 0.6,
    capability_signals: [],
    evidence: source,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * 从 JSON 对象构建 CapabilityCard
 */
function buildCardFromJson(source, obj) {
  return {
    id: `KB-${require('crypto').randomBytes(2).toString('hex')}`,
    headline: obj.headline || obj.name || '未知能力',
    applicable_topics: (obj.topics || obj.applicable_topics || []).slice(0, 5),
    insertion_type: obj.insertion_type || 'soft',
    confidence: obj.confidence || 0.6,
    capability_signals: [],
    evidence: source,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * 简单关键词提取（用于 headlines）
 */
function extractTopics(text) {
  const words = (text.match(/[\w]{2,6}/g) || [])
    .filter(w => !STOPWORDS.has(w.toLowerCase()));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

const STOPWORDS = new Set(['的','了','是','在','和','有','我','你','他','这','那','就','也','都']);

/**
 * 构建能力索引
 * @param {Object} opts
 * @param {'agent2'|'agent3'|'docs'|'campaign'} opts.source
 * @param {Object} [opts.campaign] - source='campaign' 时传入
 */
async function buildCapabilityIndex({ source, campaign } = {}) {
  let newCards = [];

  switch (source) {
    case 'agent2':
    case 'agent3': {
      const existing = loadIndex().cards;
      const agentCards = await buildFromAgent2();
      // 合并去重（按 headline 判重）
      const headlineSet = new Set(existing.map(c => c.headline));
      const unique = agentCards.filter(c => !headlineSet.has(c.headline));
      newCards = [...existing, ...unique];
      break;
    }
    case 'docs': {
      const { capabilityCards } = await scanKnowledgeDir({ forceRefresh: true });
      const existing = loadIndex().cards;
      const ids = new Set(existing.map(c => c.id));
      newCards = [...existing, ...capabilityCards.filter(c => !ids.has(c.id))];
      break;
    }
    case 'campaign': {
      const existing = loadIndex().cards;
      // 按 campaign goal 调整优先级
      if (campaign) {
        for (const card of existing) {
          const isMatch = card.applicable_topics?.some(t =>
            campaign.priority_topics?.includes(t)
          );
          card.priority_boost = isMatch ? 0.2 : 0;
        }
      }
      newCards = existing;
      break;
    }
    default:
      throw new Error(`[capability-index-builder] unknown source: ${source}`);
  }

  saveIndex({ cards: newCards, updated_at: new Date().toISOString() });
  console.log(`[capability-index-builder] ${source}: ${newCards.length} cards saved`);
  return newCards;
}

// 导出 scanKnowledgeDir 供外部复用（已在顶部 require）

module.exports = { buildCapabilityIndex, loadIndex, saveIndex };
