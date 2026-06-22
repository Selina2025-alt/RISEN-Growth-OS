/**
 * Skill 8: Strategy Version Manager
 * 
 * PRD来源: Section 12 — "策略版本Skill"
 * 功能: 管理策略对照和回滚
 * 能力: 版本历史 + Diff对比 + 回滚机制
 */

const fs = require('fs');
const crypto = require('crypto');

// ===== 初始版本库（内存存储，生产环境应持久化）=====
let versionStore = {};

// ===== 版本状态 =====
const VERSION_STATUS = {
  ACTIVE: 'active',
  SUPERSEDED: 'superseded',
  ROLLED_BACK: 'rolled_back'
};

// ===== 触发类型 =====
const TRIGGERS = {
  INITIAL: 'initial',
  AGENT9_FEEDBACK: 'agent9_feedback',
  PLATFORM_INTELLIGENCE: 'platform_intelligence',
  MANUAL_APPROVAL: 'manual_approval',
  ROLLBACK: 'rollback',
  PIVOT: 'pivot'
};

/**
 * 创建新版本
 */
function createVersion(strategyCard, trigger, metadata = {}) {
  const existingVersions = Object.keys(versionStore);
  const previousVersion = existingVersions.length > 0 
    ? existingVersions.sort().pop() 
    : null;
  
  const versionNum = previousVersion 
    ? parseInt(previousVersion.replace('v', '')) + 1 
    : 1;
  const versionId = `v${versionNum}`;
  
  // 如果存在前一版本，标记为 superseded
  if (previousVersion && versionStore[previousVersion]) {
    versionStore[previousVersion].status = VERSION_STATUS.SUPERSEDED;
    versionStore[previousVersion].superseded_at = new Date().toISOString();
    versionStore[previousVersion].superseded_by = versionId;
  }
  
  // 生成策略指纹（用于变更检测）
  const fingerprint = generateFingerprint(strategyCard);
  
  // 计算与前一版本的差异
  let diff = null;
  if (previousVersion) {
    diff = computeDiff(versionStore[previousVersion]?.card, strategyCard);
  }
  
  const versionRecord = {
    version: versionId,
    created_at: new Date().toISOString(),
    trigger,
    trigger_reason: metadata.reason || '',
    status: VERSION_STATUS.ACTIVE,
    
    // 策略内容（深拷贝，防止引用被修改）
    card: JSON.parse(JSON.stringify(strategyCard)),
    fingerprint,
    
    // 版本链
    previous_version: previousVersion,
    next_version: null,
    
    // Diff信息
    diff_from_previous: diff,
    changes_summary: diff ? summarizeChanges(diff) : [],
    
    // 性能记录（由Agent 9填充）
    performance: null,
    
    // 回滚信息
    rollback_available: previousVersion !== null,
    can_rollback_to: previousVersion ? [previousVersion] : [],
    
    // 元数据
    metadata
  };
  
  versionStore[versionId] = versionRecord;
  
  return {
    created: versionRecord,
    previous_version: previousVersion,
    version_history: getVersionHistory()
  };
}

/**
 * 生成策略指纹（用于变更检测）
 */
function generateFingerprint(card) {
  const content = JSON.stringify({
    strategic_bet: card.strategic_bet,
    value_proposition: card.content?.value_proposition?.tagline,
    channel_mix: card.content?.channel_mix?.map(c => c.platform),
    budget: card.content?.experiment_plan?.total_budget
  });
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

/**
 * 计算两个策略版本的差异
 */
function computeDiff(oldCard, newCard) {
  if (!oldCard) return null;
  
  const diff = {
    strategic_bet: {
      field: 'strategic_bet',
      before: oldCard.strategic_bet,
      after: newCard.strategic_bet,
      changed: oldCard.strategic_bet !== newCard.strategic_bet
    },
    value_proposition: {
      field: 'value_proposition',
      before: oldCard.content?.value_proposition?.tagline,
      after: newCard.content?.value_proposition?.tagline,
      changed: oldCard.content?.value_proposition?.tagline !== newCard.content?.value_proposition?.tagline
    },
    channel_mix: {
      field: 'channel_mix',
      before: oldCard.content?.channel_mix?.map(c => `${c.platform}:${c.budget_pct}`),
      after: newCard.content?.channel_mix?.map(c => `${c.platform}:${c.budget_pct}`),
      changed: JSON.stringify(oldCard.content?.channel_mix) !== JSON.stringify(newCard.content?.channel_mix)
    },
    budget: {
      field: 'budget',
      before: oldCard.content?.experiment_plan?.total_budget,
      after: newCard.content?.experiment_plan?.total_budget,
      changed: oldCard.content?.experiment_plan?.total_budget !== newCard.content?.experiment_plan?.total_budget
    }
  };
  
  return diff;
}

/**
 * 变更摘要
 */
function summarizeChanges(diff) {
  if (!diff) return [];
  const changes = [];
  
  Object.entries(diff).forEach(([field, data]) => {
    if (data.changed) {
      changes.push({
        field,
        type: 'modified',
        summary: `${field} 已变更`
      });
    }
  });
  
  return changes;
}

/**
 * 回滚到指定版本
 */
function rollback(targetVersion) {
  const target = versionStore[targetVersion];
  if (!target) {
    throw new Error(`版本 ${targetVersion} 不存在`);
  }
  
  if (!target.rollback_available) {
    throw new Error(`版本 ${targetVersion} 不支持回滚`);
  }
  
  // 创建新版本，标记为 rollback
  const rollbackVersion = createVersion(
    target.card,
    TRIGGERS.ROLLBACK,
    {
      reason: `从 v${target.version} 回滚`,
      rolled_back_from: getCurrentVersion()?.version
    }
  );
  
  rollbackVersion.created.performance = target.performance;
  
  return {
    rolled_back_from: target.version,
    rolled_back_to: rollbackVersion.created.version,
    restored_card: target.card,
    is_restoration: true
  };
}

/**
 * 获取当前版本
 */
function getCurrentVersion() {
  const active = Object.values(versionStore).find(v => v.status === VERSION_STATUS.ACTIVE);
  return active || null;
}

/**
 * 获取版本历史
 */
function getVersionHistory() {
  return Object.values(versionStore)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(v => ({
      version: v.version,
      created_at: v.created_at,
      trigger: v.trigger,
      trigger_reason: v.trigger_reason,
      status: v.status,
      fingerprint: v.fingerprint,
      performance: v.performance,
      rollback_available: v.rollback_available,
      superseded_by: v.superseded_by
    }));
}

/**
 * 获取两个版本的对比
 */
function compareVersions(versionA, versionB) {
  const a = versionStore[versionA];
  const b = versionStore[versionB];
  
  if (!a || !b) {
    throw new Error(`版本 ${!a ? versionA : versionB} 不存在`);
  }
  
  const diff = computeDiff(a.card, b.card);
  
  return {
    version_a: versionA,
    version_b: versionB,
    compared_at: new Date().toISOString(),
    diff,
    changes_count: diff ? Object.values(diff).filter(d => d.changed).length : 0,
    performance_comparison: {
      [versionA]: a.performance,
      [versionB]: b.performance
    }
  };
}

/**
 * 记录性能数据（由Agent 9调用）
 */
function recordPerformance(versionId, performanceData) {
  const version = versionStore[versionId];
  if (!version) {
    throw new Error(`版本 ${versionId} 不存在`);
  }
  
  version.performance = {
    ...performanceData,
    recorded_at: new Date().toISOString()
  };
  
  return version;
}

/**
 * 导出版本库（持久化用）
 */
function exportVersionStore() {
  return JSON.stringify(versionStore, null, 2);
}

/**
 * 导入版本库
 */
function importVersionStore(data) {
  versionStore = JSON.parse(data);
}

// ===== CLI测试 =====
if (require.main === module) {
  const mockCardV1 = {
    id: 'stg_test',
    version: 'v1',
    strategic_bet: '通过技术对比内容建立JovaAI技术领先认知',
    content: {
      value_proposition: { tagline: 'JovaAI: 让企业AI落地不再困难' },
      channel_mix: [
        { platform: 'zhihu', budget_pct: 0.20 },
        { platform: 'wechat', budget_pct: 0.25 }
      ],
      experiment_plan: { total_budget: 100000 }
    }
  };
  
  const mockCardV2 = {
    id: 'stg_test',
    version: 'v2',
    strategic_bet: '通过企业AI落地方法论建立JovaAI行业权威认知',
    content: {
      value_proposition: { tagline: 'JovaAI: 企业AI落地的完整指南' },
      channel_mix: [
        { platform: 'zhihu', budget_pct: 0.30 },
        { platform: 'wechat', budget_pct: 0.25 }
      ],
      experiment_plan: { total_budget: 150000 }
    }
  };
  
  console.log('\n📊 Skill 8: Strategy Version Manager 测试\n');
  
  // 创建 v1
  const r1 = createVersion(mockCardV1, TRIGGERS.INITIAL, { reason: '初始版本' });
  console.log(`创建版本: ${r1.created.version} (触发: ${r1.created.trigger})`);
  
  // 创建 v2
  const r2 = createVersion(mockCardV2, TRIGGERS.AGENT9_FEEDBACK, { reason: '基于Agent 9反馈调整' });
  console.log(`创建版本: ${r2.created.version} (触发: ${r2.created.trigger})`);
  console.log(`变更数量: ${r2.created.changes_summary.length}项`);
  r2.created.changes_summary.forEach(c => console.log(`  - ${c.summary}`));
  
  // 版本对比
  const comparison = compareVersions('v1', 'v2');
  console.log(`\n版本对比 (v1 vs v2):`);
  Object.entries(comparison.diff).forEach(([field, data]) => {
    if (data.changed) {
      console.log(`  ${field}: "${data.before}" → "${data.after}"`);
    }
  });
  
  // 版本历史
  console.log('\n版本历史:');
  getVersionHistory().forEach(v => {
    console.log(`  ${v.version} | ${v.trigger} | ${v.status} | ${v.performance ? JSON.stringify(v.performance) : '无性能数据'}`);
  });
  
  // 写入文件
  const output = {
    version_store: versionStore,
    current_version: getCurrentVersion()?.version,
    history: getVersionHistory()
  };
  fs.writeFileSync('../mock-data/strategy-version-store.json', JSON.stringify(output, null, 2));
  console.log('\n✅ 已写入 mock-data/strategy-version-store.json');
}

module.exports = { 
  createVersion, 
  rollback, 
  getCurrentVersion, 
  getVersionHistory, 
  compareVersions,
  recordPerformance,
  exportVersionStore,
  importVersionStore,
  TRIGGERS,
  VERSION_STATUS
};
