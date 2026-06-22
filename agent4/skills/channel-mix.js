/**
 * Skill 4: 渠道组合
 * 
 * 基于 Strategy Card 选择渠道组合 + 分配预算比例
 * 
 * 渠道角色：
 * - primary（主攻）: 覆盖目标受众最集中、转化路径最短的渠道
 * - test（测试）: 有潜力但不确定的渠道，小预算验证
 * - longtail（长尾）: 低成本覆盖长尾受众，不强求转化
 * 
 * 输出：
 * - channel_mix: 渠道列表 + 角色 + 预算比例
 * - content_adaptation_rules: 各渠道的内容适配要求
 */

function generateChannelMix(strategicBet, campaign, platformRegistry) {
  const { channel_priority, target_segment } = strategicBet;
  const { goal, scope } = campaign;
  
  // ===== 国内图文平台能力注册表（MVP版本） =====
  const defaultRegistry = {
    wechat_official: {
      name: '微信公众号',
      content_type: ['长文文章'],
      format: '图文',
      length: '1500-3000字',
      style: '深度专业',
      seo_value: '低（私域为主）',
      reach: '中（依赖粉丝量）',
      conversion_path: '关注公众号 → 菜单 → 官网 → 咨询',
      must_have: ['封面图', '摘要'],
      posting_frequency: '1-2篇/周',
      advantages: ['私域沉淀', '深度内容', '高信任度'],
      disadvantages: ['曝光有限', '需要粉丝基础']
    },
    zhihu: {
      name: '知乎',
      content_type: ['长文回答', '文章'],
      format: '图文',
      length: '2000-5000字',
      style: '逻辑严密有洞见',
      seo_value: '高（百度权重高）',
      reach: '中（搜索流量）',
      conversion_path: '搜索 → 回答 → 官网 → 咨询',
      must_have: ['干货结构', '数据引用', '专业引用'],
      posting_frequency: '2-3篇/周',
      advantages: ['搜索友好', '高净值用户', '长尾流量'],
      disadvantages: ['内容质量要求高', '冷启动难']
    },
    baijiahao: {
      name: '百家号',
      content_type: ['资讯文章'],
      format: '图文',
      length: '800-1500字',
      style: '资讯快讯',
      seo_value: '高（百度搜索权重最高）',
      reach: '高（百度推荐）',
      conversion_path: '百度搜索/推荐 → 文章 → 百家号主页 → 官网',
      must_have: ['热点切入', '关键词'],
      posting_frequency: '3-5篇/周',
      advantages: ['百度流量大', 'SEO效果好', '内容需求量大'],
      disadvantages: ['内容同质化严重', '单价低']
    },
    toutiao: {
      name: '今日头条',
      content_type: ['资讯文章', '微头条'],
      format: '图文/短视频',
      length: '1000-2000字',
      style: '通俗易懂',
      seo_value: '中（字节算法）',
      reach: '高（推荐算法）',
      conversion_path: '推荐 → 文章 → 落地页',
      must_have: ['热点标题', '配图'],
      posting_frequency: '1-2篇/天',
      advantages: ['流量大', '算法推荐'],
      disadvantages: ['用户质量参差', '品牌调性难保持']
    },
    xueqiu: {
      name: '雪球',
      content_type: ['分析文章', '问答'],
      format: '图文',
      length: '1000-3000字',
      style: '投资分析风',
      seo_value: '中',
      reach: '小众（投资者群体）',
      conversion_path: '搜索 → 文章 → 关注 → 官网',
      must_have: ['数据支撑', '投资视角'],
      posting_frequency: '1-2篇/周',
      advantages: ['面向投资者', '高端受众'],
      disadvantages: ['受众窄', '内容专业性强']
    },
    news_portals: {
      name: '新闻门户（网易/搜狐/腾讯/新浪/凤凰）',
      content_type: ['新闻资讯'],
      format: '图文',
      length: '500-1000字',
      style: '新闻通稿',
      seo_value: '中',
      reach: '广（但分散）',
      conversion_path: '新闻收录 → 点击 → 官网',
      must_have: ['新闻点', '官方口吻'],
      posting_frequency: '按需',
      advantages: ['公信力', 'SEO收录'],
      disadvantages: ['传播弱', '合作成本高']
    },
    wangyi_news: {
      name: '网易新闻',
      content_type: ['新闻资讯', '号外'],
      format: '图文',
      length: '500-1200字',
      style: '新闻通稿+深度',
      seo_value: '高（百度权重）',
      reach: '广',
      conversion_path: '百度搜索 → 文章 → 官网',
      must_have: ['新闻由头', '热点关联'],
      posting_frequency: '按需',
      advantages: ['百度权重高', '公信力'],
      disadvantages: ['编辑审核慢']
    },
    sohu_news: {
      name: '搜狐号',
      content_type: ['新闻资讯', '专栏'],
      format: '图文',
      length: '500-1500字',
      style: '新闻通稿',
      seo_value: '高（百度权重）',
      reach: '广',
      conversion_path: '百度搜索 → 文章 → 官网',
      must_have: ['新闻由头'],
      posting_frequency: '按需',
      advantages: ['百度权重高', '易入驻'],
      disadvantages: ['竞争激烈']
    },
    tencent_news: {
      name: '腾讯新闻',
      content_type: ['新闻资讯'],
      format: '图文',
      length: '500-1000字',
      style: '新闻通稿',
      seo_value: '高（搜狗+微信生态）',
      reach: '广（微信生态）',
      conversion_path: '微信搜一搜 → 文章 → 官网',
      must_have: ['新闻由头', '腾讯生态适配'],
      posting_frequency: '按需',
      advantages: ['腾讯生态曝光', '公信力高'],
      disadvantages: ['入驻门槛高', '内容质量要求严']
    },
    sina_news: {
      name: '新浪新闻',
      content_type: ['新闻资讯', '博客'],
      format: '图文',
      length: '500-1200字',
      style: '新闻通稿',
      seo_value: '高（微博+百度）',
      reach: '广',
      conversion_path: '百度搜索/微博 → 文章 → 官网',
      must_have: ['新闻由头'],
      posting_frequency: '按需',
      advantages: ['微博生态', '公信力'],
      disadvantages: ['竞争激烈']
    },
    ifeng_news: {
      name: '凤凰新闻',
      content_type: ['新闻资讯', '深度'],
      format: '图文',
      length: '800-1500字',
      style: '新闻通稿+深度',
      seo_value: '高',
      reach: '中广',
      conversion_path: '百度搜索 → 文章 → 官网',
      must_have: ['新闻由头', '有一定深度'],
      posting_frequency: '按需',
      advantages: ['公信力高', '高端受众'],
      disadvantages: ['入驻门槛较高', '审核严']
    }
  };

  // ===== 国外图文平台（MVP阶段可选） =====
  const internationalPlatforms = {
    linkedin: {
      name: 'LinkedIn',
      content_type: ['文章', '帖子'],
      format: '图文',
      length: '500-1500字',
      style: '专业洞察',
      seo_value: '中',
      reach: 'B2B精准',
      conversion_path: '帖子 → 官网 → 咨询',
      advantages: ['B2B精准', '决策者聚集'],
      disadvantages: ['国内企业覆盖弱']
    },
    medium: {
      name: 'Medium',
      content_type: ['文章'],
      format: '图文',
      length: '1500-3000字',
      style: '深度长文',
      seo_value: '高（英文内容）',
      reach: '国际',
      conversion_path: '搜索 → 文章 → 官网',
      advantages: ['国际曝光', 'SEO'],
      disadvantages: ['国内受众少']
    }
  };

  // ===== 根据 Campaign 目标确定渠道角色 =====
  const platforms = scope.platforms;
  const primaryPlatforms = platforms.primary || [];
  const secondaryPlatforms = platforms.secondary || [];
  const experimentalPlatforms = platforms.experimental || [];

  // ===== 预算分配规则 =====
  const totalBudget = goal.budget.total;
  const contentBudget = goal.budget.breakdown.content_production;

  // 简单目标：主攻 70% / 测试 20% / 长尾 10%
  // 复杂目标：主攻 40% / 测试 40% / 长尾 20%
  const isComplexGoal = goal.type.includes('revenue') || goal.target_leads > 100;
  const allocationRatio = isComplexGoal 
    ? { primary: 0.4, test: 0.4, longtail: 0.2 }
    : { primary: 0.6, test: 0.25, longtail: 0.15 };

  // ===== 渠道名称映射 =====
  const platformNameMap = {
    'wechat_official': 'wechat_official',
    'weixin': 'wechat_official',
    '微信公众号': 'wechat_official',
    'zhihu': 'zhihu',
    '知乎': 'zhihu',
    'baijiahao': 'baijiahao',
    '百家号': 'baijiahao',
    'toutiao': 'toutiao',
    '今日头条': 'toutiao',
    'xueqiu': 'xueqiu',
    '雪球': 'xueqiu',
    'news_portals': 'news_portals',
    '网易新闻': 'wangyi_news',
    '搜狐号': 'sohu_news',
    '腾讯新闻': 'tencent_news',
    '新浪新闻': 'sina_news',
    '凤凰新闻': 'ifeng_news'
  };

  // ===== 构建 Channel Mix =====
  const channelMix = [];

  // Primary 渠道
  primaryPlatforms.forEach(platform => {
    const registryKey = platformNameMap[platform] || platform;
    const reg = defaultRegistry[registryKey] || defaultRegistry.news_portals;
    const displayName = defaultRegistry[registryKey]?.name || platform;
    channelMix.push({
      channel_id: platform,
      channel_name: displayName,
      role: 'primary',
      budget_ratio: allocationRatio.primary / primaryPlatforms.length,
      content_type: reg.content_type[0],
      length: reg.length,
      style: reg.style,
      posting_frequency: reg.posting_frequency,
      rationale: channel_priority.find(c => c.channel === registryKey)?.reason || channel_priority.find(c => c.channel === platform)?.reason || '主攻渠道',
      conversion_path: reg.conversion_path,
      advantages: reg.advantages,
      disadvantages: reg.disadvantages,
      success_metric: getPlatformSuccessMetric(registryKey, goal)
    });
  });

  // Secondary 渠道
  secondaryPlatforms.forEach(platform => {
    const registryKey = platformNameMap[platform] || platform;
    const reg = defaultRegistry[registryKey] || {};
    const displayName = defaultRegistry[registryKey]?.name || platform;
    channelMix.push({
      channel_id: platform,
      channel_name: displayName,
      role: 'test',
      budget_ratio: allocationRatio.test / secondaryPlatforms.length,
      content_type: reg.content_type?.[0] || '图文',
      length: reg.length || '1000-2000字',
      style: reg.style || '资讯风格',
      posting_frequency: reg.posting_frequency || '2-3篇/周',
      rationale: channel_priority.find(c => c.channel === registryKey)?.reason || channel_priority.find(c => c.channel === platform)?.reason || '测试渠道',
      conversion_path: reg.conversion_path || '',
      advantages: reg.advantages || [],
      disadvantages: reg.disadvantages || [],
      success_metric: getPlatformSuccessMetric(registryKey, goal)
    });
  });

  // Experimental 渠道
  experimentalPlatforms.forEach(platform => {
    const registryKey = platformNameMap[platform] || platform;
    const reg = defaultRegistry[registryKey] || {};
    const displayName = defaultRegistry[registryKey]?.name || platform;
    channelMix.push({
      channel_id: platform,
      channel_name: displayName,
      role: 'experimental',
      budget_ratio: allocationRatio.longtail / experimentalPlatforms.length,
      content_type: '图文',
      length: '500-1000字',
      style: '轻量',
      posting_frequency: '1篇/周',
      rationale: '长尾覆盖，探索新渠道',
      conversion_path: '',
      advantages: ['探索成本低'],
      disadvantages: ['效果未知'],
      success_metric: getPlatformSuccessMetric(registryKey, goal)
    });
  });

  // ===== 内容适配规则 =====
  const contentAdaptationRules = {};
  Object.entries(defaultRegistry).forEach(([platform, reg]) => {
    contentAdaptationRules[platform] = {
      length_range: reg.length,
      style: reg.style,
      must_have: reg.must_have || [],
      avoid: getAvoidRules(platform),
      seo_tips: getSeoTips(platform),
      best_practices: getBestPractices(platform)
    };
  });

  // ===== 汇总 =====
  const totalBudgetCNY = totalBudget;
  const allocationSummary = {
    primary_total: Math.round(totalBudgetCNY * allocationRatio.primary),
    test_total: Math.round(totalBudgetCNY * allocationRatio.test),
    longtail_total: Math.round(totalBudgetCNY * allocationRatio.longtail),
    content_budget: contentBudget,
    channel_budget: Math.round(contentBudget * 0.7),
    promotion_budget: goal.budget.breakdown.paid_promotion
  };

  return {
    channel_mix: channelMix,
    allocation_summary: allocationSummary,
    content_adaptation_rules: contentAdaptationRules,
    platform_capability_registry: { ...defaultRegistry, ...internationalPlatforms },
    recommendations: generateRecommendations(channelMix, goal),
    metadata: {
      total_budget: totalBudgetCNY,
      primary_channels: primaryPlatforms,
      goal_type: goal.type,
      timeline_months: goal.timeline.duration_months
    }
  };
}

/**
 * 各平台成功指标
 */
function getPlatformSuccessMetric(platform, goal) {
  const metrics = {
    wechat_official: {
      primary: '新增关注 >= 500/月',
      secondary: '文章打开率 >= 5%'
    },
    zhihu: {
      primary: '自然搜索流量占比 >= 40%',
      secondary: '回答获赞 >= 50'
    },
    baijiahao: {
      primary: '百家号推荐量 >= 10000/篇',
      secondary: '阅读完成率 >= 30%'
    },
    toutiao: {
      primary: '推荐量 >= 50000/篇',
      secondary: 'CTR >= 3%'
    },
    xueqiu: {
      primary: '粉丝增长 >= 100/月',
      secondary: '文章互动 >= 20'
    }
  };
  return metrics[platform] || { primary: '曝光 >= 10000', secondary: 'CTR >= 1%' };
}

/**
 * 各平台避免规则
 */
function getAvoidRules(platform) {
  const rules = {
    wechat_official: ['过于营销化', '硬广', '频繁推送'],
    zhihu: ['答非所问', '没有数据支撑的观点', '太明显的软广'],
    baijiahao: ['标题党', '内容与标题不符', '低质量洗稿'],
    toutiao: ['标题党', '过于专业化', '缺乏热点'],
    xueqiu: ['不专业的表述', '没有数据支撑', '荐股倾向']
  };
  return rules[platform] || [];
}

/**
 * 各平台 SEO 小贴士
 */
function getSeoTips(platform) {
  const tips = {
    zhihu: ['标题包含目标关键词', '回答被收录后长期有效', '定期更新回答保持活跃'],
    baijiahao: ['标题包含热点关键词', '内容与热点关联', '百度搜索结果优先展示'],
    toutiao: ['标题决定推荐量', '前100字决定用户是否继续阅读', '标签影响分发']
  };
  return tips[platform] || [];
}

/**
 * 各平台最佳实践
 */
function getBestPractices(platform) {
  const practices = {
    wechat_official: ['固定发布时间', '系列文章培养粉丝习惯', '文末引导关注'],
    zhihu: ['选择高关注问题回答', '专业深度 > 长度', '互动回复增加权重'],
    baijiahao: ['蹭热点', '追时效', '量大于质'],
    toutiao: ['标题党 + 质量', '配图精美', '内容垂直']
  };
  return practices[platform] || [];
}

/**
 * 生成渠道建议
 */
function generateRecommendations(channelMix, goal) {
  const recommendations = [];
  
  const primaryCount = channelMix.filter(c => c.role === 'primary').length;
  const testCount = channelMix.filter(c => c.role === 'test').length;
  
  if (primaryCount < 2) {
    recommendations.push({
      type: 'warning',
      message: '主攻渠道少于2个，建议至少选择2个主攻渠道以分散风险'
    });
  }
  
  if (testCount > 4) {
    recommendations.push({
      type: 'info',
      message: '测试渠道较多，建议控制在4个以内以集中资源验证'
    });
  }
  
  recommendations.push({
    type: 'action',
    message: '建议按周监控各渠道 ROI，将资源倾斜到效果最好的渠道'
  });
  
  return recommendations;
}

// ===== 快速测试 =====
if (require.main === module) {
  const { goalToStrategy } = require('./goal-to-strategy');
  const campaign = require('../mock-data/agent1-campaign.json');
  const passport = require('../mock-data/agent2-passport.json');
  const market = require('../mock-data/agent3-market.json');
  
  const strategyResult = goalToStrategy(campaign, passport, market);
  const result = generateChannelMix(strategyResult, campaign, {});
  
  console.log('\n=== Skill 4 Output: 渠道组合 ===\n');
  console.log('渠道分配：');
  result.channel_mix.forEach(ch => {
    console.log(`  [${ch.role.toUpperCase()}] ${ch.channel_name}: ${(ch.budget_ratio * 100).toFixed(0)}% - ${ch.rationale}`);
  });
  console.log('\n预算汇总：');
  console.log(result.allocation_summary);
  console.log('\n建议：');
  result.recommendations.forEach(r => console.log(`  ${r.message}`));
}

module.exports = { generateChannelMix };
