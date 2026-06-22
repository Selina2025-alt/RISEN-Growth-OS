// skills/campaign-consumer.js
// P2.6：Agent 1 Campaign 事件消费者

const fs = require('fs');
const path = require('path');
const { buildCapabilityIndex } = require('./capability-index-builder');

const CAMPAIGN_DIR = path.join(__dirname, '../knowledge/campaign');

/**
 * 消费最新的 Campaign 变更事件
 * 由 knowledge-sync.js 在检测到 campaign/ 变化时调用
 */
async function consumeCampaignUpdate() {
  const currentPath = path.join(CAMPAIGN_DIR, 'current_campaign.json');
  if (!fs.existsSync(currentPath)) return null;

  try {
    const campaign = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    await buildCapabilityIndex({ source: 'campaign', campaign });
    console.log(`[campaign-consumer] campaign ${campaign.campaign_id} updated, re-indexed`);
    return campaign;
  } catch (err) {
    console.error(`[campaign-consumer] failed: ${err.message}`);
    return null;
  }
}

/**
 * 获取当前活跃 Campaign（供 Pipeline 引用）
 */
function getCurrentCampaign() {
  const currentPath = path.join(CAMPAIGN_DIR, 'current_campaign.json');
  if (!fs.existsSync(currentPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(currentPath, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { consumeCampaignUpdate, getCurrentCampaign };
