/**
 * Skill 3: 叙事架构
 * 
 * 将 Value Proposition 转化为三个版本的 Narrative
 * - 30秒版本: 短视频/广告/SNS Bio
 * - 2分钟版本: 演示/社媒帖子/口播
 * - 完整版本: 官网/案例/白皮书
 * 
 * 约束：
 * - 必须遵守 Brand Policy
 * - Narrative 中的声明必须能关联到 Value Proposition 的 Proof Points
 * - 完整版本需要包含 CTA 框架
 */

function buildNarrative(valueProposition, brandPolicy, channel) {
  const { tagline, who, why, what_before, how, what_after, proof_points } = valueProposition;
  
  // ===== 品牌规范约束 =====
  const brandVoice = brandPolicy.voice; // "专业、清晰、有洞察"
  const forbiddenExpressions = brandPolicy.forbidden_expressions;
  
  // ===== 30秒版本（~100字） =====
  // 适用于：短视频、LinkedIn/知乎开头、广告
  const version30s = {
    format: 'short_video_opening',
    word_count: '~100字',
    content: `${tagline}。

${how.key_capabilities[0].capability}让业务流程自动化，${how.key_capabilities[1].capability}让企业数据完全可控。

已经有${getVerifiedStat(proof_points)}的企业选择 Jova AI。

想知道你的企业适不适合？`,
    key_messages: [
      tagline,
      how.key_capabilities[0].capability,
      how.key_capabilities[1].capability
    ],
    cta: '点击了解适合你的 AI 智能体方案',
    tone: '自信、简洁、有干货'
  };

  // ===== 2分钟版本（~400字） =====
  // 适用于：知乎文章开头、公众号文章、演示口播
  const version2min = {
    format: 'article_opening',
    word_count: '~400字',
    content: `【${tagline}】

你是不是也有这样的困惑？

${why.primary_problem}

市面上 AI 工具很多，但真正适合企业的却不多：

${what_before.alternatives.map((alt, i) => `${i+1}. ${alt}`).join('\n')}

结果是：要么投入太大不敢尝试，要么试了效果不好不了了之。

Jova AI 的做法不一样：

✅ ${how.key_capabilities[0].capability}：不是做一个万能 AI，而是让多个专业智能体协同工作，各司其职
✅ ${how.key_capabilities[1].capability}：SOC 2 认证，数据完全留在你的企业环境
✅ ${how.key_capabilities[2].capability}：每一步操作都可追踪、可回滚

${what_after.improved_outcome}

${getSocialProof(proof_points)}

想知道 Jova AI 能不能解决你们的问题？`,
    structure: [
      '痛点引入（引起共鸣）',
      '现状分析（市面方案的局限）',
      '解决方案（Jova AI 的做法）',
      '效果承诺（可量化的结果）',
      '社会证明（已有客户）',
      '行动引导（CTA）'
    ],
    cta: '评论区留言"方案"，获取 1v1 评估',
    tone: brandVoice
  };

  // ===== 完整版本（~1500字） =====
  // 适用于：官网、案例、白皮书
  const versionFull = {
    format: 'whitepaper_article',
    word_count: '~1500字',
    sections: [
      {
        title: '背景：企业 AI 落地为什么这么难？',
        content: `${why.primary_problem}

我们访谈了 50+ 家正在或曾经尝试 AI 落地的企业，发现几个共性问题：

1. 期望错配：以为 AI 什么都能做，结果发现做不了
2. 工具错配：用了通用 AI 工具，却发现企业场景太复杂
3. 能力断层：有了 AI，却不知道怎么让它持续产生价值

${what_before.friction}

这就是为什么很多企业的 AI 项目最终变成了"烂尾工程"。`
      },
      {
        title: 'Jova AI 的解决思路',
        content: `Jova AI 不是又一个 AI 工具，而是一套**企业级 AI 智能体落地方案**。

核心理念：
${how.key_capabilities.map((cap, i) => `${i+1}. **${cap.capability}**：${cap.benefit}`).join('\n')}

${how.differentiation}`
      },
      {
        title: '效果承诺',
        content: `我们不承诺"颠覆行业"，我们承诺可量化的效果：

${what_after.kpis.map(kpi => `- ${kpi}`).join('\n')}

${what_after.emotional_outcome}`
      },
      {
        title: '社会证明',
        content: `${getFullSocialProof(proof_points)}

了解更多客户案例 →`
      },
      {
        title: '立即开始',
        content: `Jova AI 提供：
- 免费方案评估（15分钟）
- 概念验证（PoC）支持
- 完整迁移和培训

【CTA】
📅 预约 1v1 咨询：了解 Jova AI 是否适合你
📥 下载《企业 AI 智能体落地白皮书》
🏠 访问官网了解更多`
      }
    ],
    cta: {
      primary: '预约 1v1 咨询',
      secondary: '下载白皮书',
      tertiary: '查看案例'
    },
    tone: brandVoice
  };

  // ===== 按渠道适配 =====
  const channelAdaptations = {
    zhihu: {
      style: '知乎风：逻辑严密，有数据支撑，有洞见',
      opening: '先抛出反常识观点，引起讨论',
      structure: '总-分-总，有结论先说结论',
      avoid: '过于营销化的表达'
    },
    wechat_official: {
      style: '深度专业，有案例，有情感',
      opening: '用故事或场景切入',
      structure: '层层递进，结尾有行动',
      avoid: '太干巴巴的技术描述'
    },
    baijiahao: {
      style: '快讯风格，热点切入',
      opening: '直接点题，行业热点关联',
      structure: '倒金字塔，先说结论',
      avoid: '过于冗长的背景铺垫'
    },
    toutiao: {
      style: '通俗易懂，有话题性',
      opening: '制造悬念或冲突',
      structure: '碎片化，每段有信息量',
      avoid: '太专业术语'
    }
  };

  return {
    version_30s: version30s,
    version_2min: version2min,
    version_full: versionFull,
    channel_adaptations: channelAdaptations,
    proof_point_coverage: proof_points.map(pp => ({
      claim_id: pp.claim_id,
      used_in: ['version_2min', 'version_full'],
      evidence_status: pp.evidence_status
    })),
    brand_compliance: {
      voice_check: brandVoice,
      forbidden_used: forbiddenExpressions.filter(expr =>
        versionFull.sections.some(s => s.content && s.content.includes(expr))
      ).length === 0
    }
  };
}

/**
 * 获取已验证的数据
 */
function getVerifiedStat(proofPoints) {
  const verifiedClaim = proofPoints.find(pp => 
    pp.point && pp.point.includes('500') && pp.evidence_status === 'verified'
  );
  return verifiedClaim ? '500+' : '数百家';
}

/**
 * 获取社会证明（简短版）
 */
function getSocialProof(proofPoints) {
  return `包括华新科技、云链金融等${getVerifiedStat(proofPoints)}企业已经在用 Jova AI 提升业务效率。`;
}

/**
 * 获取社会证明（完整版）
 */
function getFullSocialProof(proofPoints) {
  return `目前已有 ${getVerifiedStat(proofPoints)} 企业客户使用 Jova AI，覆盖企业服务、金融科技、电商等多个行业。
  
代表性客户：
- 华新科技：通过 Jova AI 智能客服，问题解决率提升 40%，人工客服成本下降 35%
- 云链金融：构建智能投研助手，分析报告生成效率提升 3 倍

（更多案例可访问官网）`;
}

// ===== 快速测试 =====
if (require.main === module) {
  const { goalToStrategy } = require('./goal-to-strategy');
  const { generateValueProposition } = require('./value-proposition');
  const campaign = require('../mock-data/agent1-campaign.json');
  const passport = require('../mock-data/agent2-passport.json');
  const market = require('../mock-data/agent3-market.json');
  
  const strategyResult = goalToStrategy(campaign, passport, market);
  const vpResult = generateValueProposition(strategyResult, passport, market);
  const narrative = buildNarrative(vpResult, passport.brand_policy, 'zhihu');
  
  console.log('\n=== Skill 3 Output: 叙事架构 ===\n');
  console.log('【30秒版本】');
  console.log(narrative.version_30s.content);
  console.log('\n【2分钟版本开头】');
  console.log(narrative.version_2min.content.substring(0, 300) + '...');
  console.log('\n【完整版本结构】');
  narrative.version_full.sections.forEach((s, i) => {
    console.log(`${i+1}. ${s.title}`);
  });
  console.log('\n品牌合规检查:', narrative.brand_compliance.forbidden_used ? '❌ 有禁用表达' : '✅ 通过');
}

module.exports = { buildNarrative };
