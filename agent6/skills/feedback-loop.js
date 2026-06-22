// skills/feedback-loop.js
// P2.4：Agent 9 反馈闭环

const fs = require('fs');
const path = require('path');
const { writeJsonAtomic, readJsonFile } = require('../lib/file-utils');

const INDEX_PATH = path.join(__dirname, '../knowledge/_index.json');

/**
 * 接收 Agent 9 反馈，调整 capability cards 的 confidence
 * @param {Object} feedback
 * @param {string} feedback.article_id
 * @param {string[]} feedback.capability_cards_used
 * @param {Object} feedback.performance - { impressions, clicks, conversions }
 */
async function handleAgent9Feedback(feedback) {
  const { article_id, capability_cards_used = [], performance = {} } = feedback;
  const { impressions = 0, conversions = 0 } = performance;

  if (!fs.existsSync(INDEX_PATH)) {
    console.warn('[feedback-loop] no _index.json found');
    return { updated: 0 };
  }

  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const cards = index.cards || [];

  // 计算 CTR
  const ctr = impressions > 0 ? conversions / impressions : 0;

  let updated = 0;
  for (const card of cards) {
    if (capability_cards_used.includes(card.id)) {
      const oldConf = card.confidence || 0.5;

      if (ctr >= 0.05) {
        // 高转化：上调 confidence
        card.confidence = Math.min(1.0, +(oldConf + 0.1).toFixed(3));
      } else if (ctr < 0.01) {
        // 低转化：下调 confidence
        card.confidence = Math.max(0.1, +(oldConf - 0.05).toFixed(3));
      }
      // 1%-5% 之间不变

      card.updated_at = new Date().toISOString();
      updated++;
      console.log(`[feedback-loop] ${card.id}: ${oldConf} → ${card.confidence} (CTR=${(ctr*100).toFixed(2)}%)`);
    }
  }

  index.cards = cards;
  index.updated_at = new Date().toISOString();
  writeJsonAtomic(INDEX_PATH, index);

  return { updated, ctr };
}

/**
 * 接收反馈的标准接口
 */
async function receiveFeedback(feedbackPayload) {
  return handleAgent9Feedback(feedbackPayload);
}

module.exports = { receiveFeedback, handleAgent9Feedback };
