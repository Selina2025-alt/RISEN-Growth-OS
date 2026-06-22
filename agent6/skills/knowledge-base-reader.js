// skills/knowledge-base-reader.js
// P0.2：读取知识库，提取 CapabilityCard

const fs = require('fs');
const path = require('path');
const { generateCardId } = require('../lib/id-generator');

// 能力信号模式（强信号）
const STRONG_SIGNALS = [
  { pattern: /[可以能够可]实现[^\s]{0,6}(自动化|优化|诊断|生成)/, confidence: 0.8 },
  { pattern: /[^\s]{0,4}(平台|系统|引擎|工具)支持[^\s]{0,8}(多|全|实时)/, confidence: 0.8 },
  { pattern: /[^\s]{0,4}(私有化|本地|自建)/, confidence: 0.8 },
];

// 能力信号模式（弱信号）
const WEAK_SIGNALS = [
  { pattern: /基于[^\s]{0,6}(大模型|知识图谱|向量)/, confidence: 0.5 },
  { pattern: /[^\s]{0,4}(AI|智能|数字)化[^\s]{0,4}(转型|升级|落地)/, confidence: 0.5 },
  { pattern: /[^\s]{0,4}(自动|智能)[^\s]{0,4}(化|型)/, confidence: 0.5 },
];

const STOPWORDS = new Set([
  '的','了','是','在','和','有','我','你','他','她','它',
  '这','那','就','也','都','而','及','与','把','被',
  '一个','没有','什么','怎么','可以','能够','这个','那个'
]);

/**
 * 从文本中提取关键词
 */
function extractKeywords(text) {
  const words = (text.match(/[\w]{2,8}/g) || [])
    .map(w => w.toLowerCase())
    .filter(w => !STOPWORDS.has(w));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
}

/**
 * 计算能力信号匹配分数
 * @param {string} text
 * @returns {{ score: number, signals: Array }}
 */
function scoreCapabilitySignals(text) {
  const signals = [];
  let totalScore = 0;

  for (const sig of STRONG_SIGNALS) {
    if (sig.pattern.test(text)) {
      signals.push({ ...sig, matched: true });
      totalScore += sig.confidence;
    }
  }
  for (const sig of WEAK_SIGNALS) {
    if (sig.pattern.test(text)) {
      signals.push({ ...sig, matched: true });
      totalScore += sig.confidence;
    }
  }

  return { score: totalScore, signals };
}

/**
 * 从单个文档提取 CapabilityCard
 */
function extractCardFromDoc(filePath, content) {
  const headline = content
    .replace(/^#+ .*/gm, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 100);

  const keywords = extractKeywords(content);
  const { score, signals } = scoreCapabilitySignals(content);

  return {
    id: generateCardId(),
    headline: headline || '未知能力',
    applicable_topics: keywords.slice(0, 5),
    insertion_type: score >= 0.8 ? 'hard' : score >= 0.3 ? 'soft' : 'minimal',
    confidence: Math.min(1.0, 0.3 + score * 0.5),
    capability_signals: signals,
    evidence: filePath,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * 扫描知识库目录，返回所有 CapabilityCard
 * @param {Object} opts
 * @param {boolean} [opts.forceRefresh=false] - 是否强制刷新
 * @returns {Promise<{ capabilityCards: Array, totalDocs: number }>}
 */
async function scanKnowledgeDir({ forceRefresh = false } = {}) {
  const docsDir = path.join(__dirname, '../knowledge/docs');
  if (!fs.existsSync(docsDir)) {
    return { capabilityCards: [], totalDocs: 0 };
  }

  const files = fs.readdirSync(docsDir).filter(f => /\.(md|txt)$/i.test(f));
  const cards = [];

  for (const file of files) {
    const filePath = path.join(docsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const card = extractCardFromDoc(`knowledge/docs/${file}`, content);
    cards.push(card);
  }

  return { capabilityCards: cards, totalDocs: files.length };
}

/**
 * 获取知识库索引（优先读缓存）
 */
async function getCapabilityCards({ forceRefresh = false } = {}) {
  const indexPath = path.join(__dirname, '../knowledge/_index.json');
  const index = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    : { cards: [], updated_at: null };

  if (forceRefresh || !index.cards || index.cards.length === 0) {
    const { capabilityCards } = await scanKnowledgeDir({ forceRefresh: true });
    return capabilityCards;
  }

  return index.cards;
}

module.exports = { scanKnowledgeDir, getCapabilityCards };
