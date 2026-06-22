// lib/id-generator.js
// MasterArticle ID 生成

const crypto = require('crypto');

/**
 * 生成唯一 ID
 * @param {string} prefix - 前缀，如 'MA'、'KB'
 */
function generateId(prefix = 'ID') {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString('hex');
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * 生成 MasterArticle ID
 */
function generateArticleId() {
  return generateId('MA');
}

/**
 * 生成 CapabilityCard ID
 */
function generateCardId() {
  return generateId('KB');
}

module.exports = { generateId, generateArticleId, generateCardId };
