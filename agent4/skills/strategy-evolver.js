/**
 * Skill 8: Strategy Evolver
 * 
 * 功能：基于Feedback Router的决策，更新Strategy Card版本
 */

const fs = require('fs');

/**

 * 更新Strategy Card
 */
function evolveStrategyCard(currentCard, feedbackDecisions, platformReport) {
  const { strategy_adjustments, topic_deepening } = feedbackDecisions;
  
  // 构建变更日志
  const changes = [];
  
  // 策略调整
  if (strategy_adjustments.length > 0) {
    const lowContentTypes = [...new Set(strategy_adjustments.map(a => a.content_type))];
    changes.push({
      type: 'content_type_adjustment',
      action: 'reduce_allocation',
      targets: lowContentTypes,
      reason: '内容表现持续低于平台均值',
      evidence: strategy_adjustments.map(a => ({ content_id: a.content_id, platform: a.platform }))
    });
  }

  // 深化选题
  if (topic_deepening.length > 0) {
    const expandPlatforms = [...new Set(topic_deepening.flatMap(t => t.platforms_to_cross_post || []))];
    changes.push({
      type: 'content_expansion',
      action: 'increase_allocation',
      targets: expandPlatforms,
      reason: '内容表现高于平台均值2倍以上',
      evidence: topic_deepening.map(t => ({ content_id: t.content_id }))
    });
  }

  // 平台策略更新
  if (platformReport?.reports?.length > 0) {
    const newPlatformStrategy = {};
    platformReport.reports.forEach(r => {
      newPlatformStrategy[r.platform] = {
        version: r.strategy_version,
        recommended_angles: r.strategy_recommendations.immediate,
        content_gaps: r.competitor_content_analysis.content_gaps
      };
    });
    changes.push({
      type: 'platform_strategy_update',
      action: 'refresh',
      targets: Object.keys(newPlatformStrategy),
      evidence: newPlatformStrategy
    });
  }

  // 生成新版本
  const newVersion = incrementVersion(currentCard.version);
  const evolvedCard = {
    ...currentCard,
    version: newVersion,
    status: 'evolved',
    last_evolved_at: new Date().toISOString(),
    changes,
    evolution_summary: summarizeChanges(changes)
  };

  return {
    evolved_card: evolvedCard,
    version_from: currentCard.version,
    version_to: newVersion,
    changes_count: changes.length,
    changes
  };
}

function incrementVersion(version) {
  const [prefix, num] = version.match(/^([a-z]+)(\d+)$/) ? version.match(/^([a-z]+)(\d+)$/).slice(1) : ['v', 0];
  return `${prefix}${parseInt(num) + 1}`;
}

function summarizeChanges(changes) {
  return changes.map(c => `${c.type}: ${c.action} ${(c.targets || []).join(', ')}`).join('; ');
}

// ===== Mock测试 =====
if (require.main === module) {
  const mockCard = {
    id: 'stg_test',
    version: 'v1',
    content: { channel_mix: [] }
  };
  
  const mockDecisions = {
    strategy_adjustments: [
      { content_id: 'art_002', content_type: '竞品对比', platform: 'baijiahao' }
    ],
    topic_deepening: [
      { content_id: 'art_001', platform: 'zhihu', action: 'expand_to_wechat', platforms_to_cross_post: ['wechat_official'] }
    ]
  };
  
  const mockReport = {
    reports: [{
      platform: 'zhihu',
      strategy_version: 'v2',
      strategy_recommendations: { immediate: ['Dify对比', '30天指南'] },
      competitor_content_analysis: { content_gaps: ['企业级视角'] }
    }]
  };
  
  const result = evolveStrategyCard(mockCard, mockDecisions, mockReport);
  console.log('\n📊 Skill 8 输出：策略进化\n');
  console.log('版本升级:', result.version_from, '→', result.version_to);
  console.log('变更数量:', result.changes_count);
  result.changes.forEach((c, i) => {
    console.log(`  ${i+1}. [${c.type}] ${c.action}: ${c.targets?.join(', ')}`);
  });
}

module.exports = { evolveStrategyCard };
