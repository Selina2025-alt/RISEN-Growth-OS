/**
 * Skill 7: Strategy Feedback Router
 * 
 * 功能：接收Agent 9的内容表现数据，判断是否触发策略调整
 * 
 * 决策规则：
 * 1. 高反馈内容 → 深化选题信号 → Agent 5
 * 2. 低反馈内容 → 策略减码信号 → Skill 8
 * 3. 持续高/低 → 策略调整 → Skill 8
 */

const fs = require('fs');

// ===== 阈值配置 =====
const THRESHOLDS = {
  highPerformance: {
    viewsMultiplier: 2.0,      // 阅读量 > 平台均值 × 2
    engagementMultiplier: 1.5   // 互动率 > 平台均值 × 1.5
  },
  lowPerformance: {
    viewsMultiplier: 0.5,       // 阅读量 < 平台均值 × 0.5
    engagementMultiplier: 0.5
  },
  consecutiveWeeks: 3            // 连续N周触发策略调整
};

// ===== 平台基准 =====
const PLATFORM_BASELINE = {
  zhihu: { avgViews: 3200, avgEngagement: 0.031 },
  baijiahao: { avgViews: 8000, avgEngagement: 0.015 },
  toutiao: { avgViews: 15000, avgEngagement: 0.022 },
  wechat_official: { avgViews: 2000, avgEngagement: 0.045 },
  xueqiu: { avgViews: 1500, avgEngagement: 0.028 },
  news_portals: { avgViews: 5000, avgEngagement: 0.010 }
};

/**
 * 路由决策
 */
function route(performanceData) {
  const { contents, period = 'last_week' } = performanceData;
  
  const decisions = {
    timestamp: new Date().toISOString(),
    period,
    routed_signals: [],
    strategy_adjustments: [],
    topic_deepening: [],
    content_pause: []
  };

  // 按内容类型分组
  const byType = {};
  contents.forEach(c => {
    const type = c.content_type || 'general';
    if (!byType[type]) byType[type] = [];
    byType[type].push(c);
  });

  // 分析每种内容类型
  Object.entries(byType).forEach(([type, items]) => {
    const avgViews = items.reduce((sum, i) => sum + (i.metrics?.views || 0), 0) / items.length;
    const avgEngagement = items.reduce((sum, i) => sum + (i.metrics?.engagement_rate || 0), 0) / items.length;
    
    const platform = items[0]?.platform || 'general';
    const baseline = PLATFORM_BASELINE[platform] || { avgViews: 3000, avgEngagement: 0.020 };

    const viewsRatio = avgViews / baseline.avgViews;
    const engagementRatio = avgEngagement / baseline.avgEngagement;

    // 高反馈
    if (viewsRatio >= THRESHOLDS.highPerformance.viewsMultiplier || 
        engagementRatio >= THRESHOLDS.highPerformance.engagementMultiplier) {
      items.forEach(item => {
        decisions.topic_deepening.push({
          content_id: item.content_id,
          signal: 'high_performance',
          reason: `views_ratio=${viewsRatio.toFixed(1)}, engagement_ratio=${engagementRatio.toFixed(1)}`,
          action: item.platform === 'wechat_official' 
            ? 'already_on_wechat' 
            : 'expand_to_wechat_public_account',
          platforms_to_cross_post: getCrossPostPlatforms(item.platform)
        });
      });
    }

    // 低反馈
    if (viewsRatio < THRESHOLDS.lowPerformance.viewsMultiplier &&
        engagementRatio < THRESHOLDS.lowPerformance.engagementMultiplier) {
      items.forEach(item => {
        decisions.strategy_adjustments.push({
          content_id: item.content_id,
          signal: 'low_performance',
          reason: `views_ratio=${viewsRatio.toFixed(1)}, engagement_ratio=${engagementRatio.toFixed(1)}`,
          action: 'reduce_allocation',
          content_type: type,
          platform: item.platform
        });
      });
    }
  });

  return decisions;
}

/**
 * 获取跨平台分发目标
 */
function getCrossPostPlatforms(sourcePlatform) {
  const crossPostMap = {
    zhihu: ['baijiahao', 'toutiao', 'wechat_official'],
    baijiahao: ['toutiao', 'zhihu'],
    toutiao: ['baijiahao'],
    xueqiu: ['wechat_official'],
    news_portals: ['wechat_official', 'zhihu']
  };
  return crossPostMap[sourcePlatform] || [];
}

// ===== Mock测试 =====
if (require.main === module) {
  const mockData = {
    period: 'last_week',
    contents: [
      {
        content_id: 'art_001',
        platform: 'zhihu',
        content_type: '竞品对比',
        title: 'Dify vs JovaAI：企业级场景技术对比',
        metrics: { views: 12500, engagement_rate: 0.085 }
      },
      {
        content_id: 'art_002',
        platform: 'baijiahao',
        content_type: '竞品对比',
        title: '企业AI平台选型指南',
        metrics: { views: 3200, engagement_rate: 0.008 }
      },
      {
        content_id: 'art_003',
        platform: 'toutiao',
        content_type: '方法论',
        title: '30天AI落地完整指南',
        metrics: { views: 45000, engagement_rate: 0.065 }
      }
    ]
  };

  const result = route(mockData);
  console.log('\n📊 Skill 7 输出：反馈路由决策\n');
  console.log('深化选题:', result.topic_deepening.length, '条');
  result.topic_deepening.forEach(t => {
    console.log(`  - [${t.platform}] ${t.action}: ${t.reason}`);
  });
  console.log('策略调整:', result.strategy_adjustments.length, '条');
  result.strategy_adjustments.forEach(t => {
    console.log(`  - [${t.platform}] ${t.action}: ${t.reason}`);
  });
}

module.exports = { route, THRESHOLDS, PLATFORM_BASELINE };
