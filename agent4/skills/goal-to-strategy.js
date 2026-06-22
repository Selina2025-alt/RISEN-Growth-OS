/**
 * Skill 1: 目标 → 策略转换
 * 
 * 将 Campaign Goal + Promotion Passport + ICP 转换为 Strategic Bet + Approach
 * 
 * 基于以下输入推理：
 * 1. 业务目标是什么类型（品牌/线索/转化/收入）
 * 2. 目标市场是新市场还是存量市场
 * 3. 企业自身有哪些证据支撑
 * 4. 目标客户当前的认知障碍是什么
 * 
 * 输出：
 * - Strategic Bet: 核心假设
 * - Target Segment: 聚焦的 ICP 子集
 * - Primary Barrier: 主攻障碍
 * - Strategic Approach: 进攻路径
 */

function goalToStrategy(campaign, passport, market) {
  const { goal, scope } = campaign;
  const { product_capabilities, claims } = passport;
  const { icp, target_accounts, campaign_notes } = market;

  // ===== 步骤1: 解析 Campaign Goal 类型 =====
  const goalType = goal.type;
  const isLeadGen = goalType.includes('lead');
  const isBrandBuilding = goalType.includes('brand');
  const isRevenue = goalType.includes('revenue');

  // ===== 步骤2: 识别市场特征 =====
  const targetMarket = campaign.target_market.primary;
  const isNewMarket = !target_accounts || target_accounts.length === 0;
  
  // ===== 步骤3: 从 Passport 中提取可用证据 =====
  const verifiedClaims = claims.filter(c => c.evidence_status === 'verified');
  const pendingClaims = claims.filter(c => c.evidence_status === 'pending');
  
  // ===== 步骤4: 从 ICP 中提取目标客户痛点 =====
  const topPainPoints = icp.buyer_persona.pain_points.slice(0, 3);
  const buyingTriggers = icp.buyer_persona.buying_triggers;

  // ===== 步骤5: 识别 Primary Barrier =====
  // 障碍 = 目标客户当前认知 vs 我们希望他们形成的认知
  const barriers = [
    {
      barrier: "企业对 AI 智能体落地有疑虑，担心投入大、效果差",
      evidence: "市场情报显示'不知道如何衡量 AI ROI'是高频痛点",
      severity: "high"
    },
    {
      barrier: "企业担心安全和合规问题，尤其是数据泄露风险",
      evidence: "SOC 2 认证是已验证证据，可作为信任锚点",
      severity: "high"
    },
    {
      barrier: "企业不清楚 AI 智能体能解决什么具体业务问题",
      evidence: "ICP 痛点显示'不知道AI能做什么'是常见障碍",
      severity: "medium"
    }
  ];

  // ===== 步骤6: 确定 Strategic Approach =====
  // 根据目标类型 + 市场特征选择进攻路径
  let strategicApproach;
  
  if (isBrandBuilding && isLeadGen) {
    // 品牌+线索双重目标：技术领导力 + 解决方案定位
    strategicApproach = {
      type: "thought_leadership",
      angle: "不是卖工具，是分享企业级 AI 落地方法论",
      key_message: "让目标客户觉得'这家公司真的懂企业 AI 落地'",
      differentiation: "用真实案例和技术深度建立信任，而非宣传功能"
    };
  } else if (isLeadGen) {
    strategicApproach = {
      type: "solution_marketing",
      angle: "直接解决具体业务问题的方案",
      key_message: "用具体场景和 ROI 数据吸引目标客户",
      differentiation: "可量化、可验证、可复制的 AI 落地效果"
    };
  } else {
    strategicApproach = {
      type: "product_capability",
      angle: "展示产品核心能力",
      key_message: "Jova AI 的差异化技术优势",
      differentiation: "企业级、安全合规、可观测"
    };
  }

  // ===== 步骤7: 确定目标细分 =====
  // 聚焦 ICP 中购买意愿最强的子集
  const highIntentAccounts = target_accounts
    .filter(a => a.priority_score >= 80)
    .map(a => a.company_name);

  const targetSegment = {
    primary: icp.company_profile.industry.slice(0, 3),
    company_size: icp.company_profile.company_size,
    geography: campaign.target_market.geography,
    buying_stage: "consideration_to_decision",
    focus_accounts: highIntentAccounts
  };

  // ===== 步骤8: 构建 Strategic Bet =====
  // Strategic Bet = 我们赌这个策略能解决客户的这个障碍
  const primaryBarriers = barriers.filter(b => b.severity === 'high');
  
  const strategicBet = {
    hypothesis: `如果我们在知乎和微信公众号持续输出"企业级 AI 智能体落地方法论"内容，
    并且用真实案例和可量化数据证明效果，
    那么目标客户（${targetSegment.primary.join(', ')}）会更信任 Jova AI，
    并且愿意留下销售线索。`,
    strategic_bet_number: 1,
    bet_on: "内容营销建立技术领导力，带来高质量线索",
    against: "纯功能宣传无法建立信任，线索质量差",
    expected_outcome: `在 ${goal.timeline.duration_months} 个月内获取 ${goal.target_leads} 个 SQL`,
    confidence: 0.7,
    evidence: [
      ...verifiedClaims.map(c => c.id),
      ...primaryBarriers.map(b => b.barrier)
    ],
    gaps: pendingClaims.map(c => c.id) // 需要在实验中验证的 Claims
  };

  // ===== 步骤9: 渠道优先级 =====
  // 根据内容类型和目标受众选择渠道
  const platformPriority = scope.platforms;
  
  const channelPriority = [
    { channel: 'zhihu', reason: '技术内容搜索友好，建立思想领导力', role: 'primary' },
    { channel: 'wechat_official', reason: '私域沉淀，深度内容传播', role: 'primary' },
    { channel: 'baijiahao', reason: '百度搜索权重高，SEO必选', role: 'primary' },
    { channel: 'toutiao', reason: '字节流量池，触达更广', role: 'secondary' },
    { channel: 'xueqiu', reason: '面向投资者群体，B端决策者', role: 'experimental' }
  ];

  return {
    strategic_bet: strategicBet,
    target_segment: targetSegment,
    primary_barriers: primaryBarriers,
    strategic_approach: strategicApproach,
    channel_priority: channelPriority,
    verified_claims: verifiedClaims.map(c => c.id),
    pending_claims: pendingClaims.map(c => c.id),
    metadata: {
      goal_type: goalType,
      is_new_market: isNewMarket,
      budget: goal.budget.total,
      timeline_months: goal.timeline.duration_months
    }
  };
}

// ===== 快速测试 =====
if (require.main === module) {
  const campaign = require('./agent1-campaign.json');
  const passport = require('./agent2-passport.json');
  const market = require('./agent3-market.json');
  
  const result = goalToStrategy(campaign, passport, market);
  console.log('=== Skill 1 Output: 目标 → 策略转换 ===\n');
  console.log('Strategic Bet:', result.strategic_bet.hypothesis);
  console.log('\n目标细分:', JSON.stringify(result.target_segment, null, 2));
  console.log('\n主要障碍:', result.primary_barriers.map(b => b.barrier));
  console.log('\n进攻路径:', result.strategic_approach.type, '-', result.strategic_approach.key_message);
  console.log('\n渠道优先级:', result.channel_priority.map(c => `${c.channel}(${c.role})`));
}

module.exports = { goalToStrategy };
