/**
 * Skill 5: 实验设计
 * 
 * 基于 Strategy Card + Channel Mix 设计实验计划
 * 
 * 支持的实验类型：
 * - A/B Test: 两个策略变体对比
 * - Multi-arm: 多策略并行测试
 * - Holdout: 策略 vs. 自然状态
 * 
 * 每个实验必须包含：
 * - Hypothesis: 可证伪的假设
 * - Variant: 变体内容
 * - Control: 对照组定义
 * - Success Metric: 可量化指标
 * - Stop Condition: 停止条件
 * - Scale Condition: 放大条件
 * - Duration: 实验周期
 */

function designExperiment(campaign, strategyCard, channelMix) {
  const { goal } = campaign;
  const { value_proposition, content } = strategyCard;
  const channels = channelMix.channel_mix.filter(ch => ch.role === 'primary');

  // ===== 确定实验类型 =====
  const strategyCount = content.experiment_plan?.strategy_count || 2;
  const experimentType = strategyCount > 2 ? 'multi_arm' : 'a_b_test';

  // ===== 实验1: 叙事角度对比 =====
  // 假设：技术深度内容 vs 案例驱动内容 的线索获取效果差异
  const experiment1 = {
    experiment_id: `exp_${Date.now()}_narrative_angle`,
    experiment_type: experimentType,
    name: '叙事角度对比：技术深度 vs 案例驱动',
    
    hypothesis: {
      primary: '案例驱动的内容相比纯技术内容，能带来更高质量的销售线索（留资率提升 >= 30%）',
      secondary: '技术深度的内容在知乎能获得更好的自然搜索排名',
      null_hypothesis: '两种叙事角度的线索质量没有显著差异'
    },
    
    variants: buildNarrativeVariants(strategyCard),
    
    control: {
      definition: 'A组：技术深度角度（现有策略）',
      baseline_metrics: {
        content_form: '技术解析 + 功能说明',
        expected_lead_quality: 'baseline',
        expected_ctr: 0.02
      }
    },
    
    success_metrics: [
      {
        metric_name: '线索转化率',
        description: '内容浏览 → 留资 的转化率',
        baseline: 0.02,
        target: 0.026,  // 30%提升
        minimum_detectable_effect: 0.008,
        measurement: 'UTM + 表单提交'
      },
      {
        metric_name: '线索质量评分',
        description: '销售团队对线索质量的1-5分评分',
        baseline: 3.0,
        target: 3.5,
        minimum_detectable_effect: 0.3,
        measurement: '销售反馈回传'
      },
      {
        metric_name: '阅读完成率',
        description: '文章阅读完成率（衡量内容质量）',
        baseline: 0.25,
        target: 0.30,
        minimum_detectable_effect: 0.05,
        measurement: '平台数据分析'
      }
    ],
    
    targeting: {
      platforms: channels.map(ch => ch.channel_id),
      audience: strategyCard.target_segment,
      geography: strategyCard.target_segment.geography,
      duration_days: 21,
      minimum_sample_per_variant: 1000
    },
    
    stop_condition: {
      primary: {
        rule: '线索转化率连续7天低于基线，且样本量 >= 500/变体',
        action: '停止该变体，将预算转移到表现好的变体'
      },
      secondary: {
        rule: '出现明显负面舆情（评论情绪 < 20%正面）',
        action: '立即停止该变体内容，进入人工审核'
      }
    },
    
    scale_condition: {
      primary: {
        rule: '线索转化率比基线提升 >= 30%，且保持稳定 >= 7天',
        action: '将获胜策略的预算增加 50%，推广到所有渠道'
      },
      secondary: {
        rule: '某渠道的 ROI 显著高于其他渠道（>= 2x）',
        action: '重新分配预算，增加高效渠道投入'
      }
    },
    
    statistical: {
      confidence_level: 0.95,
      power: 0.8,
      sample_size_calculation: {
        method: '基于线索转化率',
        baseline_rate: 0.02,
        minimum_detectable_effect: 0.008,
        alpha: 0.05,
        power: 0.8,
        required_sample_per_variant: 3800
      }
    },
    
    resources: {
      content_variants: 2,
      estimated_cost_per_variant: Math.round(goal.budget.total * 0.08),
      total_experiment_budget: Math.round(goal.budget.total * 0.15)
    }
  };

  // ===== 实验2: 渠道优先级验证 =====
  // 假设：知乎作为主攻渠道 vs 微信公众号作为主攻渠道 的综合效果差异
  const experiment2 = {
    experiment_id: `exp_${Date.now()}_channel_priority`,
    experiment_type: 'holdout',
    name: '渠道优先级验证：知乎优先 vs 微信优先',
    
    hypothesis: {
      primary: '以知乎为主攻渠道能带来更高质量的品牌线索（SEO流量转化率高）',
      secondary: '以微信公众号为主攻渠道能在更短时间内获得更多留资（私域优势）',
      null_hypothesis: '两个渠道的线索综合质量没有显著差异'
    },
    
    variants: [
      {
        variant_id: 'A',
        name: '知乎优先策略',
        channel_priority: ['zhihu', 'wechat_official', 'baijiahao'],
        content_focus: 'SEO友好的技术深度内容',
        budget_allocation: { zhihu: 0.5, wechat_official: 0.3, baijiahao: 0.2 }
      },
      {
        variant_id: 'B',
        name: '微信优先策略',
        channel_priority: ['wechat_official', 'zhihu', 'toutiao'],
        content_focus: '私域运营导向的深度内容',
        budget_allocation: { wechat_official: 0.5, zhihu: 0.3, toutiao: 0.2 }
      }
    ],
    
    success_metrics: [
      {
        metric_name: '综合线索数量',
        description: '各渠道留资总数的对比',
        baseline: 50,
        target: 65,
        measurement: 'CRM数据汇总'
      },
      {
        metric_name: '线索质量综合评分',
        description: '销售团队对线索的1-5分质量评分',
        baseline: 3.2,
        target: 3.6,
        measurement: '销售反馈'
      },
      {
        metric_name: '线索响应率',
        description: '销售联系线索后5分钟内的响应率',
        baseline: 0.6,
        target: 0.75,
        measurement: 'CRM跟踪'
      }
    ],
    
    targeting: {
      platforms: ['zhihu', 'wechat_official', 'baijiahao', 'toutiao'],
      duration_days: 30,
      minimum_sample: 30
    },
    
    stop_condition: {
      primary: {
        rule: '某个渠道30天内线索 < 5条',
        action: '降低该渠道预算，尝试其他渠道'
      }
    },
    
    scale_condition: {
      primary: {
        rule: '某渠道线索质量评分 >= 4.0，且数量稳定',
        action: '将该渠道升级为主攻渠道'
      }
    },
    
    resources: {
      estimated_cost: Math.round(goal.budget.total * 0.06)
    }
  };

  // ===== 实验3: 内容长度测试 =====
  // 假设：长文（3000字）vs 短文（1500字）的内容效果差异
  const experiment3 = {
    experiment_id: `exp_${Date.now()}_content_length`,
    experiment_type: 'a_b_test',
    name: '内容长度测试：长文 vs 短文',
    
    hypothesis: {
      primary: '长文内容的线索转化率高于短文（深度内容建立信任）',
      secondary: '短文在今日头条/百家号等平台表现更好（流量属性差异）',
      null_hypothesis: '内容长度对线索转化率没有显著影响'
    },
    
    variants: [
      {
        variant_id: 'A',
        name: '长文策略',
        content_length: '2500-4000字',
        content_type: '深度分析 + 案例',
        platforms: ['zhihu', 'wechat_official']
      },
      {
        variant_id: 'B',
        name: '短文策略',
        content_length: '800-1500字',
        content_type: '快讯 + 热点',
        platforms: ['baijiahao', 'toutiao']
      }
    ],
    
    success_metrics: [
      {
        metric_name: '阅读完成率',
        baseline: 0.25,
        target: 0.35,
        measurement: '平台数据'
      },
      {
        metric_name: '线索转化率',
        baseline: 0.02,
        target: 0.028,
        measurement: 'UTM追踪'
      },
      {
        metric_name: '页面停留时间',
        baseline: 120,
        target: 180,
        measurement: 'GA/平台数据'
      }
    ],
    
    targeting: {
      platforms: ['zhihu', 'wechat_official', 'baijiahao', 'toutiao'],
      duration_days: 14,
      minimum_sample: 500
    },
    
    stop_condition: {
      primary: {
        rule: '某内容类型完成率 < 20%，且线索 < 3条',
        action: '停止该内容类型的投放'
      }
    },
    
    scale_condition: {
      primary: {
        rule: '某内容类型 CTR >= 3.5%，且完成率 >= 30%',
        action: '加大该内容类型的投入'
      }
    },
    
    resources: {
      estimated_cost: Math.round(goal.budget.total * 0.04)
    }
  };

  // ===== 综合实验计划 =====
  const experimentPlan = {
    experiments: [experiment1, experiment2, experiment3],
    
    timeline: {
      phase_1: { weeks: '1-3', experiments: [experiment1.experiment_id] },
      phase_2: { weeks: '4-6', experiments: [experiment2.experiment_id] },
      phase_3: { weeks: '7-9', experiments: [experiment3.experiment_id] }
    },
    
    total_budget: experiment1.resources.total_experiment_budget + 
                   (experiment2.resources?.estimated_cost || 0) + 
                   (experiment3.resources?.estimated_cost || 0),
    
    success_criteria: {
      primary: `达成 ${goal.target_leads} 个 SQL`,
      secondary: '线索质量评分 >= 3.5',
      tertiary: 'CPA <= 2500 CNY'
    },
    
    // 如果是简单目标（出3个策略），选择Top2做A/B
    ab_test_pair: strategyCount === 3 
      ? { variant_a: '案例驱动策略', variant_b: '技术深度策略' }
      : null,
    
    recommendations: [
      {
        priority: 'high',
        message: '优先运行实验1（叙事角度），因为对内容策略影响最大'
      },
      {
        priority: 'medium',
        message: '实验2（渠道优先级）和实验3（内容长度）可以并行运行以节省时间'
      },
      {
        priority: 'low',
        message: '建议每2周Review一次实验数据，根据结果动态调整'
      }
    ]
  };

  return experimentPlan;
}

/**
 * 构建叙事变体
 */
function buildNarrativeVariants(strategyCard) {
  return [
    {
      variant_id: 'A',
      name: '技术深度角度（对照组）',
      angle: '用技术原理和架构讲解，展示Jova AI的技术实力',
      content_approach: '技术解析 + 架构图 + 代码示例',
      key_messages: [
        '多智能体协同的技术原理',
        '企业级安全合规的技术实现',
        '全链路可观测性的架构设计'
      ],
      cta: '了解更多技术细节 →'
    },
    {
      variant_id: 'B',
      name: '案例驱动角度（实验组）',
      angle: '用真实客户案例和量化结果，展示Jova AI的实际效果',
      content_approach: '客户故事 + 业务问题 + 解决方案 + 数据结果',
      key_messages: [
        '华新科技如何用Jova AI提升客服效率40%',
        '云链金融如何构建智能投研助手',
        '可复制的AI落地方法论'
      ],
      cta: '获取你的专属方案评估 →'
    }
  ];
}

// ===== 快速测试 =====
if (require.main === module) {
  const { goalToStrategy } = require('./goal-to-strategy');
  const { generateValueProposition } = require('./value-proposition');
  const { generateChannelMix } = require('./channel-mix');
  const campaign = require('../mock-data/agent1-campaign.json');
  const passport = require('../mock-data/agent2-passport.json');
  const market = require('../mock-data/agent3-market.json');
  
  const strategyResult = goalToStrategy(campaign, passport, market);
  const vpResult = generateValueProposition(strategyResult, passport, market);
  const channelResult = generateChannelMix(strategyResult, campaign, {});
  
  // 构建模拟 Strategy Card
  const mockStrategyCard = {
    id: 'stg_test_001',
    version: 'v1',
    value_proposition: vpResult,
    target_segment: strategyResult.target_segment,
    content: {
      strategic_approach: strategyResult.strategic_approach,
      experiment_plan: { strategy_count: 2 }
    }
  };
  
  const result = designExperiment(campaign, mockStrategyCard, channelResult);
  
  console.log('\n=== Skill 5 Output: 实验设计 ===\n');
  console.log(`实验数量: ${result.experiments.length}`);
  result.experiments.forEach((exp, i) => {
    console.log(`\n实验${i+1}: ${exp.name}`);
    console.log(`  假设: ${exp.hypothesis.primary}`);
    console.log(`  时长: ${exp.targeting.duration_days}天`);
    console.log(`  停止条件: ${exp.stop_condition.primary.rule}`);
    console.log(`  放大条件: ${exp.scale_condition.primary.rule}`);
  });
  console.log(`\n总实验预算: ${result.total_budget} CNY`);
  console.log('\nA/B测试配对:', result.ab_test_pair || 'N/A');
}

module.exports = { designExperiment };
