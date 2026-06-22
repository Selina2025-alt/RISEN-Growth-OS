// skills/knowledge-update-handler.js
// P2.2：用户上传知识更新处理器

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic } = require('../lib/file-utils');

const STOPWORDS = new Set([
  '的','了','是','在','和','有','我','你','他','她','它',
  '这','那','就','也','都','而','及','与','把','被',
  '一个','没有','什么','怎么','可以','能够','这个','那个'
]);

const PENDING_PATH = path.join(__dirname, '../knowledge/pending_keywords.json');

/**
 * 从文本内容提取关键词
 */
function extractKeywordsFromContent(input) {
  const text = (input.content || input)
    .replace(/[#*`>\[\]]/g, ' ')
    .replace(/\n+/g, ' ');
  const words = (text.match(/[\w]{2,6}/g) || [])
    .map(w => w.toLowerCase());
  const freq = {};
  words.forEach(w => { if (!STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 10);
}

/**
 * 处理知识更新请求
 * @param {Object} input
 * @param {string|Buffer} input.uploadedFile
 * @param {string} input.userMessage
 * @returns {Object} 处理结果
 */
function handleKnowledgeUpdate(input) {
  const extracted = extractKeywordsFromContent(input.uploadedFile || input.userMessage || '');

  const pending = fs.existsSync(PENDING_PATH)
    ? JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'))
    : [];

  const newPending = extracted.map(k => ({
    keyword: k,
    source: input.uploadedFile ? 'document' : 'message',
    added_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
  }));

  writeJsonAtomic(PENDING_PATH, [...pending, ...newPending]);

  return {
    action: 'notify',
    pendingKeywords: extracted,
    message: `已将新关键词加入待确认列表：${extracted.join(', ')}`
  };
}

/**
 * 清理过期关键词（每天 cron 调用）
 */
function cleanupExpired() {
  if (!fs.existsSync(PENDING_PATH)) return { removed: 0 };
  const pending = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'));
  const now = new Date();
  const valid = pending.filter(p => new Date(p.expires_at) > now);
  const removed = pending.length - valid.length;
  writeJsonAtomic(PENDING_PATH, valid);
  return { removed, remaining: valid.length };
}

module.exports = { handleKnowledgeUpdate, extractKeywordsFromContent, cleanupExpired };
