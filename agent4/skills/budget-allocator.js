/**
 * Skill 6: Budget Allocator
 * 
 * PRD来源: Section 12 — "预算分配Skill"
 * 功能: 分配内容、渠道和广告资源，与实验周期挂钩
 */

const fs = require('fs');

// ===== 渠道类型配置 =====
const CHANNEL_TYPES = {
  owned_media: {
    name: 'Owned Media',
    description: '自有渠道（公众号、官网、邮件）',
    default_pct: 0.60,
    platforms: ['wechat', 'zhihu', 'baijiahao', 'toutiao', 'xueqiu', 'news_portals']
  },
  paid_media: {
    name: 'Paid Media',
    description: '付费渠道（广告、投放）',
    default_pct: 0.30,
    platforms: []
  },
  earned_media: {
    name: 'Earned Media',
    description: '赢得渠道（PR、媒体转载）',
    default_pct: 0.10,
    platforms: []
  }
};

// ===== 内容形式配置 =====
const CONTENT_TYPES = {
  text_articles: {
    name: '图文内容',
    description: '长文、知乎回答、百家号文章',
    default_pct_of_total: 0.25,
    unit_cost_estimate: 500  // CNY per piece
  },
  short_videos: {
    name: '短视频',
    description: '抖音、视频号、B站',
    default_pct_of_total: 0.40,
    unit_cost_estimate: 2000
  },
  design_assets: {
    name: '视觉素材',
    description: '封面图、信息图、PPT',
    default_pct_of_total: 0.15,
    unit_cost_estimate: 300
  },
  distribution: {
    name: '分发与运营',
    description: 'KOL转发、媒体投放、代运营',
    default_pct_of_total: 0.20,
    unit_cost_estimate: 0
  }
};

// ===== 平台优先级配置 =====
const PLATFORM_PRIORITY = {
  wechat_official: { priority: 1, base_pct: 0.22, min_budget: 30000 },
  zhihu: { priority: 2, base_pct: 0.18, min_budget: 20000 },
  toutiao: { priority: 3, base_pct: 0.14, min_budget: 15000 },
  baijiahao: { priority: 4, base_pct: 0.10, min_budget: 10000 },
  xueqiu: { priority: 5, base_pct: 0.08, min_budget: 8000 },
  netEase_news: { priority: 6, base_pct: 0.06, min_budget: 8000 },
  sohu_news: { priority: 7, base_pct: 0.05, min_budget: 6000 },
  tencent_news: { priority: 8, base_pct: 0.05, min_budget: 6000 },
  sina_news: { priority: 9, base_pct: 0.05, min_budget: 6000 },
  ifeng_news: { priority: 10, base_pct: 0.05, min_budget: 6000 },
  paid_ads: { priority: 11, base_pct: 0.02, min_budget: 0 }
};

/**
 * 分配预算
 */
function allocateBudget(campaignGoal, totalBudget, options = {}) {
  const {
    experimentCount = 3,           // 并行实验策略数
    experimentDurationWeeks = 4,   // 每个实验持续周数
    shortVideoHeavy = false,       // 是否短视频为主
    isNewMarket = true            // 是否新市场
  } = options;

  // ===== Step 1: 按渠道类型分配 =====
  const channelBudgets = {};
  const ownedPct = isNewMarket ? 0.65 : 0.55;
  const paidPct = isNewMarket ? 0.25 : 0.35;
  
  channelBudgets.owned_media = {
    type: 'owned_media',
    amount: Math.round(totalBudget * ownedPct),
    pct: ownedPct,
    description: CHANNEL_TYPES.owned_media.description
  };
  channelBudgets.paid_media = {
    type: 'paid_media',
    amount: Math.round(totalBudget * paidPct),
    pct: paidPct,
    description: CHANNEL_TYPES.paid_media.description
  };
  channelBudgets.earned_media = {
    type: 'earned_media',
    amount: Math.round(totalBudget * 0.10),
    pct: 0.10,
    description: CHANNEL_TYPES.earned_media.description
  };

  // ===== Step 2: 按内容形式分配（基于总预算）=====
  const contentBudgets = {};
  const videoPct = shortVideoHeavy ? 0.50 : 0.35;
  contentBudgets.short_videos = {
    type: 'short_videos',
    amount: Math.round(totalBudget * videoPct),
    pct: videoPct,
    description: CONTENT_TYPES.short_videos.description
  };
  contentBudgets.text_articles = {
    type: 'text_articles',
    amount: Math.round(totalBudget * 0.25),
    pct: 0.25,
    description: CONTENT_TYPES.text_articles.description
  };
  contentBudgets.design_assets = {
    type: 'design_assets',
    amount: Math.round(totalBudget * 0.15),
    pct: 0.15,
    description: CONTENT_TYPES.design_assets.description
  };
  contentBudgets.distribution = {
    type: 'distribution',
    amount: Math.round(totalBudget * 0.15),
    pct: 0.15,
    description: CONTENT_TYPES.distribution.description
  };

  // ===== Step 3: 按平台分配（基于Owned预算）=====
  const ownedBudget = channelBudgets.owned_media.amount;
  
  // 归一化平台优先级权重
  const totalPriorityWeight = Object.values(PLATFORM_PRIORITY).reduce((sum, p) => sum + (1 / p.priority), 0);
  
  const platformBudgets = {};
  let remainingBudget = ownedBudget;
  const allocatedPlatforms = [];
  
  Object.entries(PLATFORM_PRIORITY)
    .filter(([key]) => key !== 'paid_ads')
    .sort((a, b) => a[1].priority - b[1].priority)
    .forEach(([platform, config], index) => {
      // 分配金额 = 预算 × 基础占比 × (1/优先级权重)
      const weight = 1 / config.priority;
      const rawPct = config.base_pct * (weight / (1 / config.priority));
      const amount = index === 0 
        ? Math.max(config.min_budget, Math.round(ownedBudget * rawPct))
        : Math.max(config.min_budget, Math.round(remainingBudget * rawPct));
      
      platformBudgets[platform] = {
        platform,
        amount: Math.min(amount, remainingBudget),
        pct: ownedBudget > 0 ? Math.round(amount / ownedBudget * 100) / 100 : 0,
        priority: config.priority,
        min_budget: config.min_budget
      };
      
      remainingBudget -= platformBudgets[platform].amount;
      allocatedPlatforms.push(platform);
    });
  
  // 剩余预算追加到公众号
  platformBudgets.wechat_official.amount += remainingBudget;
  platformBudgets.wechat_official.pct = Math.round(platformBudgets.wechat_official.amount / ownedBudget * 100) / 100;

  // ===== Step 4: 实验预算分配 =====
  const perExperimentBudget = Math.round(ownedBudget / experimentCount);
  const experimentBudgets = [];
  for (let i = 1; i <= experimentCount; i++) {
    experimentBudgets.push({
      experiment_id: `exp_${i}`,
      amount: perExperimentBudget,
      duration_weeks: experimentDurationWeeks,
      weekly_budget: Math.round(perExperimentBudget / experimentDurationWeeks)
    });
  }

  // ===== Step 5: 汇总 =====
  const summary = {
    total_budget: totalBudget,
    currency: 'CNY',
    channel_budgets: { ...channelBudgets },
    content_budgets: { ...contentBudgets },
    platform_budgets: platformBudgets,
    experiment_budgets: experimentBudgets,
    budget_utilization: {
      allocated: totalBudget,
      utilization_rate: 1.0,
      contingency_reserve: 0
    },
    metadata: {
      experiment_count: experimentCount,
      experiment_duration_weeks: experimentDurationWeeks,
      short_video_heavy: shortVideoHeavy,
      is_new_market: isNewMarket,
      generated_at: new Date().toISOString()
    }
  };

  return summary;
}

/**
 * 生成实验周期（与预算挂钩）
 */
function generateExperimentTimeline(budgetResult, targetDurationWeeks = 12) {
  const { experiment_budgets, content_budgets } = budgetResult;
  const phases = [];
  
  // Phase 1: 冷启动（第1-2周）
  phases.push({
    phase: 1,
    name: '冷启动',
    weeks: [1, 2],
    budget_pct: 0.15,
    objectives: ['验证渠道可行性', '收集初期数据'],
    success_criteria: { min_sample_size: 200, min_engagement: 0.01 }
  });
  
  // Phase 2: 快速迭代（第3-6周）
  phases.push({
    phase: 2,
    name: '快速迭代',
    weeks: [3, 4, 5, 6],
    budget_pct: 0.35,
    objectives: ['扩大有效策略', '淘汰低效策略'],
    success_criteria: { min_sample_size: 800, roi_threshold: 1.0 }
  });
  
  // Phase 3: 放大（第7-10周）
  phases.push({
    phase: 3,
    name: '放大',
    weeks: [7, 8, 9, 10],
    budget_pct: 0.35,
    objectives: ['放大高效渠道', '优化内容形式'],
    success_criteria: { min_sample_size: 1500, roi_threshold: 1.3 }
  });
  
  // Phase 4: 收割（第11-12周）
  phases.push({
    phase: 4,
    name: '收割',
    weeks: [11, 12],
    budget_pct: 0.15,
    objectives: ['最大化高效渠道', '准备下一轮'],
    success_criteria: { min_sample_size: 2000, roi_threshold: 1.5 }
  });

  return { phases, total_weeks: targetDurationWeeks };
}

// ===== CLI测试 =====
if (require.main === module) {
  const result = allocateBudget(
    { goal: 'leads', target: 300 },
    300000,
    { experimentCount: 3, experimentDurationWeeks: 4, shortVideoHeavy: false, isNewMarket: true }
  );
  
  console.log('\n💰 Skill 6: Budget Allocator 输出\n');
  console.log(`总预算: ¥${result.total_budget.toLocaleString()}`);
  console.log('\n渠道分配:');
  Object.values(result.channel_budgets).forEach(c => {
    console.log(`  ${c.type}: ¥${c.amount.toLocaleString()} (${(c.pct*100).toFixed(0)}%)`);
  });
  console.log('\n内容分配:');
  Object.values(result.content_budgets).forEach(c => {
    console.log(`  ${c.type}: ¥${c.amount.toLocaleString()} (${(c.pct*100).toFixed(0)}%)`);
  });
  console.log('\n平台分配（Owned Media）:');
  Object.entries(result.platform_budgets).slice(0, 5).forEach(([k, v]) => {
    console.log(`  ${k}: ¥${v.amount.toLocaleString()} (${(v.pct*100).toFixed(0)}%)`);
  });
  console.log('\n实验预算:');
  result.experiment_budgets.forEach(e => {
    console.log(`  ${e.experiment_id}: ¥${e.amount.toLocaleString()} (${e.duration_weeks}周, ¥${e.weekly_budget.toLocaleString()}/周)`);
  });
  
  // 写入文件
  const timeline = generateExperimentTimeline(result, 12);
  const output = { ...result, experiment_timeline: timeline };
  fs.writeFileSync('../mock-data/budget-allocation.json', JSON.stringify(output, null, 2));
  console.log('\n✅ 已写入 mock-data/budget-allocation.json');
}

module.exports = { allocateBudget, generateExperimentTimeline };
