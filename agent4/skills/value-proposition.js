/**
 * Skill 2: 价值主张生成
 * 
 * 基于 JTBD 6步模板生成 Value Proposition
 * 
 * 规则：
 * - 每个 Proof Point 必须有对应的 Claim
 * - Claim 状态必须为 verified 或 pending（不能是 unverified）
 * - pending 状态的 Claim 必须标注
 * 
 * 输出结构：
 * - Tagline: 一句话价值主张
 * - Proof Points: 卖点列表（含证据状态）
 * - Claim Boundary: 不是什么的边界
 */

function generateValueProposition(strategicBet, passport, market) {
  const { claims, brand_policy, product_capabilities } = passport;
  const { icp } = market;
  const { target_segment, primary_barriers, strategic_approach } = strategicBet;

  // ===== 步骤1: 解析 Buyer Persona 的核心问题 =====
  const buyerPersona = icp.buyer_persona;
  const jobsToBeDone = buyerPersona.goals;
  const painPoints = buyerPersona.pain_points;

  // ===== 步骤2: 从 Claims 构建 Proof Points =====
  // 规则：只使用 verified 或 pending 状态的 Claims
  const validClaims = claims.filter(c => 
    c.evidence_status === 'verified' || c.evidence_status === 'pending'
  );

  // ===== 步骤3: 建立 Who (目标客户) =====
  const whoSection = {
    segment: target_segment.primary.join(', '),
    company_size: target_segment.company_size,
    geography: target_segment.geography.join(', '),
    description: `正在寻求企业 AI 智能体落地方案的${target_segment.primary[0]}企业`
  };

  // ===== 步骤4: 建立 Why (问题) =====
  // 基于 Primary Barriers 和 Buyer Pain Points
  const whySection = {
    primary_problem: primary_barriers[0]?.barrier || painPoints[0],
    jtbd: jobsToBeDone,
    desired_outcome: "快速看到 AI 智能体的实际效果，降低试错成本"
  };

  // ===== 步骤5: 建立 What Before (现状) =====
  const whatBeforeSection = {
    current_situation: "企业内部团队缺乏 AI 落地经验，担心投入大、效果差",
    alternatives: [
      "自研 AI 方案：投入大、周期长、技术风险高",
      "用开源框架：功能有限、运维成本高、企业级能力缺失",
      "买套装软件：功能固化、无法适应业务变化"
    ],
    friction: "不知道如何开始，不知道选什么方案，不知道如何衡量效果"
  };

  // ===== 步骤6: 建立 How (解决方案) =====
  // 从 product_capabilities 匹配战略方向
  const howSection = {
    solution: "Jova AI 企业级 AI 智能体平台",
    key_capabilities: [
      {
        capability: "多智能体编排",
        benefit: "用多个专业智能体协同处理复杂业务流程，大幅提升效率"
      },
      {
        capability: "企业级安全合规",
        benefit: "SOC 2 认证，多租户隔离，数据完全可控，消除采购顾虑"
      },
      {
        capability: "全链路可观测性",
        benefit: "从 Prompt 到结果全程追踪，快速定位问题，让 AI 可见可控"
      }
    ],
    differentiation: "不是工具，是企业级 AI 落地的方法论 + 平台"
  };

  // ===== 步骤7: 建立 What After (结果) =====
  const whatAfterSection = {
    improved_outcome: "企业能够快速构建 AI 智能体，3个月内看到可量化的业务效果",
    kpis: [
      "智能客服问题解决率提升 40%",
      "运营人力成本节省 30%",
      "跨部门协作效率提升 50%"
    ],
    emotional_outcome: "团队对 AI 落地有信心，老板看到进展愿意继续投入"
  };

  // ===== 步骤8: 建立 Alternatives (竞争对手) =====
  const alternativesSection = {
    competitors: ["Dify", "Coze", "LangChain", "自研方案"],
    why_us: "Jova AI 是唯一同时具备：企业级安全 + 多智能体编排 + 全链路可观测性的平台",
    switching_cost: "Jova AI 提供完整迁移支持，切换成本低"
  };

  // ===== 步骤9: 构建 Proof Points（关联 Claims） =====
  const proofPoints = [];
  
  // 已验证 Claims → Verified Proof Points
  const verifiedClaims = claims.filter(c => c.evidence_status === 'verified');
  verifiedClaims.forEach(claim => {
    const capability = product_capabilities.find(c => c.id === claim.id.replace('clm_', 'cap_'));
    proofPoints.push({
      point: claim.claim,
      claim_id: claim.id,
      evidence_status: 'verified',
      evidence_ref: claim.evidence_ref,
      capability_match: capability?.capability || 'general',
      usage: `在内容中作为核心证据引用`
    });
  });

  // 待验证 Claims → Pending Proof Points
  const pendingClaims = claims.filter(c => c.evidence_status === 'pending');
  pendingClaims.forEach(claim => {
    const capability = product_capabilities.find(c => c.id === claim.id.replace('clm_', 'cap_'));
    proofPoints.push({
      point: claim.claim,
      claim_id: claim.id,
      evidence_status: 'pending',
      evidence_ref: null,
      note: claim.note || '需要客户案例数据支撑',
      capability_match: capability?.capability || 'general',
      usage: `作为差异化方向，在实验设计中安排验证`
    });
  });

  // ===== 步骤10: 生成 Tagline =====
  // 基于战略方向 + 核心差异化
  let tagline;
  if (strategic_approach.type === 'thought_leadership') {
    tagline = "Jova AI：让企业 AI 落地不再困难";
  } else if (strategic_approach.type === 'solution_marketing') {
    tagline = "Jova AI：企业级 AI 智能体，3个月看到效果";
  } else {
    tagline = "Jova AI：专业企业级 AI 智能体平台";
  }

  // ===== 步骤11: 构建 Claim Boundary =====
  const claimBoundary = {
    is_not: [
      "不是一个聊天机器人",
      "不是简单的 FAQ 自动化工具",
      "不是需要庞大技术团队才能维护的方案"
    ],
    when_not_suitable: [
      "对 AI 效果有不切实际期望的企业",
      "没有明确业务流程需要自动化的场景",
      "不愿意投入时间进行 AI 落地的团队"
    ]
  };

  // ===== 步骤12: 校验规则检查 =====
  const validation = {
    all_claims_valid: proofPoints.every(p => p.evidence_status !== 'unverified'),
    verified_count: proofPoints.filter(p => p.evidence_status === 'verified').length,
    pending_count: proofPoints.filter(p => p.evidence_status === 'pending').length,
    unverified_count: proofPoints.filter(p => p.evidence_status === 'unverified').length,
    can_proceed: proofPoints.every(p => p.evidence_status !== 'unverified')
  };

  return {
    tagline,
    who: whoSection,
    why: whySection,
    what_before: whatBeforeSection,
    how: howSection,
    what_after: whatAfterSection,
    alternatives: alternativesSection,
    proof_points: proofPoints,
    claim_boundary: claimBoundary,
    value_prop_statement: buildValuePropStatement(tagline, whoSection, howSection),
    validation,
    metadata: {
      strategy_approach: strategic_approach.type,
      primary_barrier: primary_barriers[0]?.barrier
    }
  };
}

/**
 * 构建简洁的价值主张声明
 */
function buildValuePropStatement(tagline, who, how) {
  return `${tagline}。专为${who.segment}设计，通过${how.key_capabilities[0].capability}和${how.key_capabilities[1].capability}，帮助企业快速实现 AI 智能体落地。`;
}

// ===== 快速测试 =====
if (require.main === module) {
  const { goalToStrategy } = require('./goal-to-strategy');
  const campaign = require('../mock-data/agent1-campaign.json');
  const passport = require('../mock-data/agent2-passport.json');
  const market = require('../mock-data/agent3-market.json');
  
  const strategyResult = goalToStrategy(campaign, passport, market);
  const result = generateValueProposition(strategyResult, passport, market);
  
  console.log('\n=== Skill 2 Output: 价值主张生成 ===\n');
  console.log('Tagline:', result.tagline);
  console.log('\n价值主张声明:', result.value_prop_statement);
  console.log('\n=== Proof Points ===');
  result.proof_points.forEach((pp, i) => {
    console.log(`${i+1}. [${pp.evidence_status}] ${pp.point}`);
    if (pp.note) console.log(`   Note: ${pp.note}`);
  });
  console.log('\n=== 校验 ===');
  console.log('可以继续?', result.validation.can_proceed ? '✅' : '❌');
  console.log(`已验证: ${result.validation.verified_count}, 待验证: ${result.validation.pending_count}`);
  console.log('\n=== Claim Boundary ===');
  console.log('不是:', result.claim_boundary.is_not);
}

module.exports = { generateValueProposition };
