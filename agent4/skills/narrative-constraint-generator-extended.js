/**
 * Skill 9: Narrative Constraint Generator（扩展版）
 * 
 * 功能：
 * 1. 把 Strategy Card 转换为 Agent 5 可用的 Narrative 约束
 * 2. 三账号内容策略（艾氪智能OS / 公众号 / JovaAI视频号）
 * 3. 图文平台 → 公众号深化规则
 * 4. 短视频方向判断（基于 Agent 9 数据）
 */

const { generateConstraints: baseGenerate } = require('./narrative-constraint-generator');

// ===== 三账号配置 =====
const THREE_ACCOUNTS = {
  aikezhios: {
    name: '艾氪智能OS',
    platform: '抖音/视频号',
    role: 'awareness',
    description: '建立行业解释权，建立艾氪判断力',
    narrative_type: '短视频钩子+热点解读',
    constraints: {
      product_visibility: '轻产品露出（<10%）',
      brand_presence: '艾氪品牌为主（90%+）',
      content_focus: '行业趋势、热点解读、方法论',
     不许: ['硬广', '产品功能罗列', '竞品贬低', '无热点硬蹭'],
      必须: ['3秒注意力钩子', '具体业务场景', 'JovaAI自然植入']
    }
  },
  wechat_official: {
    name: '公众号',
    platform: '微信公众号',
    role: 'trust',
    description: '深度内容，完整叙事，可复用资产',
    narrative_type: '完整Narrative（30秒/2分钟/完整版）',
    constraints: {
      product_visibility: '产品为辅（30-40%）',
      brand_presence: 'JovaAI品牌为主（60-70%）',
      content_focus: '企业AI落地方法论、案例分析、行业深度',
     不许: ['纯产品介绍', '无数据支撑的观点', '情绪化表达'],
      必须: ['完整叙事结构', '数据支撑', '可传播分享']
    }
  },
  jovavi_video: {
    name: 'JovaAI视频号',
    platform: '视频号',
    role: 'conversion',
    description: '产品化叙事，落到真实场景和销售线索',
    narrative_type: '短视频场景Demo+产品价值',
    constraints: {
      product_visibility: '产品为主（50-70%）',
      brand_presence: 'JovaAI品牌（30-50%）',
      content_focus: '真实场景Demo、产品价值、行动号召',
     不许: ['无场景的纯功能介绍', '虚假案例', '过度承诺'],
      必须: ['具体业务场景', '可量化的结果', '明确CTA']
    }
  }
};

// ===== 账号分发矩阵 =====
const REPURPOSING_MATRIX = {
  // 从哪个账号/平台来 → 分发到哪些账号/平台
  from: {
    'aikezhios_抖音': {
      to: [
        { account: 'aikezhios_视频号', action: '同步发布', adaptation: '最小调整' },
        { account: 'wechat_official', action: '深化扩展', adaptation: '完整Narrative扩展' },
        { account: 'weibo', action: '话题延伸', adaptation: '话题梗概' }
      ],
      trigger: '数据好(完播率>50%)'
    },
    'aikezhios_视频号': {
      to: [
        { account: 'aikezhios_抖音', action: '跨平台同步', adaptation: '最小调整' },
        { account: 'wechat_official', action: '深化扩展', adaptation: '图文转化' }
      ],
      trigger: '互动率>3%'
    },
    'wechat_official': {
      to: [
        { account: 'zhihu', action: '深度回答', adaptation: '问答形式改编' },
        { account: 'baijiahao', action: '平台适配', adaptation: '头条风改编' },
        { account: 'toutiao', action: '热点匹配', adaptation: '热点角度切入' },
        { account: 'xueqiu', action: '投资视角', adaptation: '雪球风格改编' }
      ],
      trigger: '阅读量>5000'
    },
    'jovavi_video': {
      to: [
        { account: 'wechat_official', action: '图文转化', adaptation: '图文版本' },
        { account: 'aikezhios_抖音', action: '扩大覆盖', adaptation: '竖版改横版' }
      ],
      trigger: '转化率>1%'
    }
  }
};

// ===== 图文平台 → 公众号深化规则 =====
const CONTENT_DEEPENING_RULES = {
  high_feedback_signals: {
    views_multiplier: 2.0,        // 阅读量 > 平台均值 × 2
    engagement_rate: 0.05,         // 互动率 > 5%
    share_rate: 0.02,             // 分享率 > 2%
    comment_sentiment: 'positive' // 评论情感正面
  },
  trigger_conditions: {
    to_wechat_public: [
      { signal: 'high_views', platform: 'zhihu', threshold: 5000 },
      { signal: 'high_views', platform: 'toutiao', threshold: 20000 },
      { signal: 'high_views', platform: 'baijiahao', threshold: 10000 },
      { signal: 'high_engagement', platform: 'xueqiu', threshold: 0.05 }
    ],
    to_multi_platform: [
      { signal: 'high_feedback', threshold: 'any_2_of_3' } // 3个指标中有2个满足
    ]
  },
  cross_platform_rules: {
    'zhihu': {
      preferred_target: ['wechat_official', 'xueqiu'],
      adaptation: '从问答形式转为图文形式，扩展深度'
    },
    'toutiao': {
      preferred_target: ['baijiahao', 'wechat_official'],
      adaptation: '从热点形式转为深度分析，保持时效性'
    },
    'baijiahao': {
      preferred_target: ['toutiao', 'zhihu'],
      adaptation: '从百度搜索角度优化，增加专业深度'
    },
    'xueqiu': {
      preferred_target: ['wechat_official'],
      adaptation: '从投资分析视角转为企业落地视角'
    }
  }
};

// ===== 短视频方向判断规则 =====
const SHORT_VIDEO_DIRECTION_RULES = {
  // 基于数据判断短视频策略方向
  data_signals: {
    high_awareness: {
      trigger: '艾氪智能OS 完播率>50%，点赞率>3%',
      action: '加大行业解读内容投入',
      agent4_decision: 'expand_awareness_content'
    },
    high_trust: {
      trigger: '公众号 阅读量>10000，分享率>2%',
      action: '深化公众号深度内容，生产更多案例',
      agent4_decision: 'deepen_trust_content'
    },
    high_conversion: {
      trigger: 'JovaAI视频号 转化率>1%，咨询量增长',
      action: '加大转化内容，制作更多Demo视频',
      agent4_decision: 'scale_conversion_content'
    },
    low_performance: {
      trigger: '某账号持续低表现（4周以上）',
      action: '重新评估该账号策略或暂停投入',
      agent4_decision: 'reassess_or_pause'
    }
  },
  
  // 栏目调整规则
  category_adjustment: {
    add: {
      trigger: '某类内容连续3篇高表现',
      action: '新增该类型栏目',
      constraint: '不超过5个栏目，新栏目需测试2周'
    },
    remove: {
      trigger: '某类内容连续4篇低表现',
      action: '暂停该类型内容',
      constraint: '标记为低优先级，可周期性重测'
    },
    adjust: {
      trigger: '某类内容表现波动大',
      action: '调整内容角度或形式',
      constraint: '保持实验心态，A/B测试不同角度'
    }
  }
};

/**
 * 生成扩展约束（含三账号策略）
 */
function generateExtendedConstraints(strategyCard) {
  // 先调用基础约束
  const base = baseGenerate(strategyCard);
  
  // 扩展三账号策略
  const threeAccountStrategy = {
    accounts: THREE_ACCOUNTS,
    repurposing_matrix: REPURPOSING_MATRIX,
    content_deepening: CONTENT_DEEPENING_RULES,
    short_video_direction: SHORT_VIDEO_DIRECTION_RULES
  };
  
  // 构建 Agent 5 的 Topic Brief 约束
  const topicBriefConstraints = buildTopicBriefConstraints(base, threeAccountStrategy);
  
  return {
    ...base,
    three_account_strategy: threeAccountStrategy,
    topic_brief_constraints: topicBriefConstraints
  };
}

/**
 * 构建 Topic Brief 约束（供 Agent 5 使用）
 */
function buildTopicBriefConstraints(base, threeAccount) {
  return {
    narrative_constraints: base.narrative_constraints,
    three_account_constraints: {
      aikezhios: {
        awareness_role: true,
        content_angles: ['AI行业趋势', '热点解读', '技术方法论'],
        forbidden_angles: ['竞品对比（硬碰硬）', '无场景产品介绍'],
        required_elements: ['3秒钩子', '具体场景', '自然植入']
      },
      wechat_official: {
        trust_role: true,
        content_angles: ['企业AI落地', '案例分析', '行业深度报告'],
        repurposing_source: ['zhihu', 'toutiao', 'xueqiu'],
        required_elements: ['完整叙事', '数据支撑', '可分享性']
      },
      jovavi_video: {
        conversion_role: true,
        content_angles: ['产品Demo', '场景演示', '客户证言'],
        required_elements: ['具体场景', '量化结果', '明确CTA'],
        trigger_for_wechat: 'high_conversion_data'
      }
    },
    
    // 图文平台 → 公众号深化
    platform_to_wechat_rules: {
      trigger_signals: CONTENT_DEEPENING_RULES.high_feedback_signals,
      platforms: CONTENT_DEEPENING_RULES.trigger_conditions.to_wechat_public,
      adaptation_rules: CONTENT_DEEPENING_RULES.cross_platform_rules,
      must_include: ['场景', '数据', 'JovaAI角色', '具体结果'],
      must_not_include: ['绝对化表述', '无来源数据', '竞品贬低']
    },
    
    // Agent 9 数据 → 短视频策略调整
    short_video_feedback_rules: {
      signals: SHORT_VIDEO_DIRECTION_RULES.data_signals,
      category_rules: SHORT_VIDEO_DIRECTION_RULES.category_adjustment,
      agent4_feedback_integration: true
    }
  };
}

// ===== CLI测试 =====
if (require.main === module) {
  const mockCard = require('../mock-data/output-strategy-card.json');
  const result = generateExtendedConstraints(mockCard);
  
  console.log('\n📋 Skill 9 扩展版：三账号策略约束\n');
  
  console.log('三账号:');
  Object.entries(result.three_account_strategy.accounts).forEach(([key, acc]) => {
    console.log(`  ${acc.name} (${acc.role}): ${acc.description}`);
    console.log(`    产品露出: ${acc.constraints.product_visibility}`);
    console.log(`    不许: ${acc.constraints.不许.join(', ')}`);
  });
  
  console.log('\n分发矩阵（从公众号）:');
  const fromWechat = result.three_account_strategy.repurposing_matrix.from.wechat_official;
  fromWechat.to.forEach(t => console.log(`  → ${t.account}: ${t.action}`));
  
  console.log('\n公众号深化触发条件:');
  result.topic_brief_constraints.platform_to_wechat_rules.platforms
    .forEach(p => console.log(`  ${p.platform}: 阅读量>${p.threshold}`));
  
  // 写入
  require('fs').writeFileSync('../mock-data/narrative-constraints-extended.json', JSON.stringify(result, null, 2));
  console.log('\n✅ 已写入 mock-data/narrative-constraints-extended.json');
}

module.exports = {
  generateConstraints: generateExtendedConstraints,  // ← 别名，pipeline调用此名
  generateExtendedConstraints,
  THREE_ACCOUNTS,
  CONTENT_DEEPENING_RULES,
  SHORT_VIDEO_DIRECTION_RULES
};
