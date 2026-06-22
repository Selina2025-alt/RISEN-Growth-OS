/**
 * Agent 5 · Skill 9 · topic-brief-builder.js
 * Topic Brief 结构化构建
 *
 * 输入：选题 + 方向 + 素材（来自Skill 8）
 * 输出：Topic Brief → Agent 6
 *
 * Phase 2.3: brief 新增 content_type 字段（兼容 Agent 6 skill-selector 路由）
 */

const crypto = require('crypto');

/**
 * 将 content_form 映射为 content_type enum
 * @param {string} contentForm - 分发路由或方向指定的 content_form
 * @returns {string} content_type enum
 */
function mapContentType(contentForm) {
  const form = (contentForm || '').toLowerCase();
  if (form.includes('短视频') || form.includes('视频') || form.includes('抖音') || form.includes('youtube') || form.includes('视频号')) {
    return 'tutorial';
  }
  if (form.includes('小红书') || form.includes('微博') || form.includes('朋友圈') || form.includes('推特') || form.includes('twitter')) {
    return 'marketing';
  }
  if (form.includes('案例') || form.includes('case') || form.includes('客户')) {
    return 'case_study';
  }
  if (form.includes('新闻') || form.includes('pr') || form.includes('公告') || form.includes('快讯')) {
    return 'news';
  }
  // 默认：分析深度文章
  return 'analysis';
}

/**
 * 主函数
 * @param {Object} opts
 * @param {Object} opts.topic - 选题（来自Skill 5）
 * @param {Object} opts.direction - 选题方向（已确认的D1/D2等）
 * @param {Object} opts.resources - 采集结果（来自Skill 8）
 * @param {Object} opts.narrativeConstraint - Narrative约束（来自Agent 4）
 * @param {Object} opts.distributionRoute - 分发路由（来自Skill 10）
 */
function buildTopicBrief(opts = {}) {
  const {
    topic = {},
    direction = {},
    resources = {},
    narrativeConstraint = {},
    distributionRoute = {},
    topicScores = {}
  } = opts;

  const briefId = `BRIEF-${Date.now().toString(36).toUpperCase()}`;

  // 核心论点
  const coreClaims = buildCoreClaims(direction, resources);

  // 事实支撑（按S/A/B级）
  const evidenceSupport = buildEvidenceSupport(resources);

  // 关键数据点
  const dataPoints = extractDataPoints(resources);

  // 风险提示
  const riskWarnings = buildRiskWarnings(topic, direction, resources);

  // 证据充分度
  const evidenceSufficiency = assessEvidenceSufficiency(resources);

  // 给Agent6的创作指引
  const agent6Guidance = buildAgent6Guidance(topic, direction, narrativeConstraint);

  const brief = {
    brief_id: briefId,
    brief_type: 'Trend Brief',   // PRD要求命名
    // Phase 2.3: content_type 字段（Agent 6 skill-selector 路由依赖此字段）
    content_type: mapContentType(distributionRoute.content_form || direction.content_form),
    meta: {
      topic_id: topic.topic_id,
      direction_id: direction.direction_id,
      topic_title: topic.title,
      direction_title: direction.title,
      content_form: distributionRoute.content_form || direction.content_form,
      target_platform: distributionRoute.target_platform,
      target_account: distributionRoute.target_account,
      narrative_constraint_source: narrativeConstraint.main_axis,
      created_at: new Date().toISOString(),
      // 搜索意图地图（来自Skill 6 calcSearchOpportunity）
      search_intent: (topicScores && topicScores.results && topicScores.results[0]?.search_intent && distributionRoute.target_platform)
        ? topicScores.results[0].search_intent[distributionRoute.target_platform] || { intent_type: '信息型', intent_strength: 3.0, score: 3.0 }
        : { intent_type: '信息型', intent_strength: 3.0, score: 3.0 }
    },
    core_claims: coreClaims,
    evidence_support: evidenceSupport,
    data_points: dataPoints,
    key_data: dataPoints.key_data,
    risk_warnings: riskWarnings,
    evidence_sufficiency: evidenceSufficiency,
    agent6_guidance: agent6Guidance,
    raw_sources: buildSourceReference(resources),
    repurposing_notes: buildRepurposingNotes(direction, resources)
  };

  return {
    brief,
    brief_markdown: renderBriefMarkdown(brief)
  };
}

function buildCoreClaims(direction, resources) {
  const claims = [];

  // 从方向的核心观点生成claim
  if (direction.core_viewpoint) {
    claims.push({
      claim_id: 'C1',
      statement: direction.core_viewpoint,
      evidence_count: 0,
      evidence_level: 'inferred'
    });
  }

  // 从素材中提取claim
  const sources = resources.sources || [];
  const texts = sources.map(s => `${s.title} ${s.excerpt || ''} ${s.abstract || ''}`).join('。');

  if (texts.length > 20) {
    // 简单句子分割
    const sentences = texts.split(/[。！？\n]/).filter(s => s.length > 15 && s.length < 150);
    let claimId = claims.length + 1;
    for (const s of sentences.slice(0, 4)) {
      claims.push({
        claim_id: `C${claimId++}`,
        statement: s.trim(),
        evidence_count: 0,
        evidence_level: 'extracted'
      });
    }
  }

  return claims;
}

function buildEvidenceSupport(resources) {
  const sources = resources.sources || [];

  return {
    S_grade: sources.filter(s => s.tier === 'S').map(s => ({
      source_id: s.source_id,
      title: s.title,
      url: s.url,
      tier: 'S',
      why_strong: '官方/一手来源'
    })),
    A_grade: sources.filter(s => s.tier === 'A').map(s => ({
      source_id: s.source_id,
      title: s.title,
      url: s.url,
      tier: 'A',
      why_strong: '权威媒体/专业报告'
    })),
    B_grade: sources.filter(s => s.tier === 'B').map(s => ({
      source_id: s.source_id,
      title: s.title,
      url: s.url,
      tier: 'B',
      why_strong: '专业内容，有参考价值'
    })),
    C_grade: sources.filter(s => s.tier === 'C').map(s => ({
      source_id: s.source_id,
      title: s.title,
      tier: 'C',
      why_weak: '二手转述，仅辅助理解'
    }))
  };
}

function extractDataPoints(resources) {
  const sources = resources.sources || [];
  const texts = sources.map(s => `${s.title} ${s.excerpt || ''} ${s.abstract || ''}`).join(' ');

  // 提取数字/百分比
  const numbers = texts.match(/\d+[%,倍,万,亿,千]?(?:增长|下降|提升|减少|增加)?/g) || [];
  const uniqueNumbers = [...new Set(numbers)].slice(0, 10);

  // 提取具体公司/产品名
  const companies = texts.match(/[A-Z][a-zA-Z]*(?:AI|Inc|Corp|Labs|OS|Agent|Studio)/g) || [];
  const uniqueCompanies = [...new Set(companies)].slice(0, 5);

  return {
    key_numbers: uniqueNumbers,
    key_companies: uniqueCompanies,
    key_data: uniqueNumbers.length > 0
      ? `关键数据：${uniqueNumbers.slice(0, 3).join('；')}`
      : null
  };
}

function buildRiskWarnings(topic, direction, resources) {
  const warnings = [];
  const sources = resources.sources || [];

  // 证据不足风险
  if (sources.length < 3) {
    warnings.push('⚠️ 证据数量偏少，建议继续补充来源');
  }

  // 无S/A级来源
  const hasStrong = sources.some(s => s.tier === 'S' || s.tier === 'A');
  if (!hasStrong) {
    warnings.push('⚠️ 缺少S/A级强证据，内容说服力受限');
  }

  // 无日期来源
  const hasDate = sources.some(s => s.published_at);
  if (!hasDate) {
    warnings.push('⚠️ 部分来源缺少发布日期，影响时效性判断');
  }

  // 方向本身的风险
  if (direction.risks) {
    for (const risk of direction.risks) {
      warnings.push(`⚠️ ${risk}`);
    }
  }

  // Narrative禁止内容
  if (topic.narrative_fit === false) {
    warnings.push('❌ 当前选题可能不符合Narrative约束，需人工确认');
  }

  return warnings;
}

function assessEvidenceSufficiency(resources) {
  const sources = resources.sources || [];
  const strongCount = sources.filter(s => s.tier === 'S' || s.tier === 'A').length;
  const totalCount = sources.length;

  if (strongCount >= 3 && totalCount >= 5) {
    return { level: 'sufficient', score: 5, message: '证据充足' };
  }
  if (strongCount >= 1 && totalCount >= 3) {
    return { level: 'adequate', score: 3, message: '证据基本够用，建议补充' };
  }
  if (totalCount >= 1) {
    return { level: 'weak', score: 2, message: '证据薄弱，建议继续采集' };
  }
  return { level: 'insufficient', score: 1, message: '证据不足，暂不适合生产' };
}

function buildAgent6Guidance(topic, direction, narrative) {
  const constraints = narrative || {};
  const lines = [];

  lines.push('## Agent 6 创作指引\n');

  // 主轴约束
  if (constraints.main_axis) {
    lines.push(`**主轴**（必须贯穿全文）：${constraints.main_axis}`);
  }

  // 账号角色
  if (constraints.account_roles) {
    for (const [account, role] of Object.entries(constraints.account_roles)) {
      lines.push(`**${account}（${role}）**：${getRoleGuidance(role)}`);
    }
  }

  // 内容比例
  if (constraints.content_ratio) {
    lines.push(`**内容比例**：竞品对比${constraints.content_ratio.competitor || '20-25%'}；方法论${constraints.content_ratio.methodology || '25-30%'}；案例${constraints.content_ratio.case_study || '25-30%'}；趋势${constraints.content_ratio.trend || '15-20%'}`);
  }

  // 禁止方向
  if (constraints.forbidden_directions && constraints.forbidden_directions.length > 0) {
    lines.push(`**禁止**：${constraints.forbidden_directions.join('；')}`);
  }

  // 角度指引
  if (direction.core_viewpoint) {
    lines.push(`\n**核心角度**：${direction.core_viewpoint}`);
  }

  // 受众
  if (direction.audience) {
    lines.push(`**目标受众**：${direction.audience}`);
  }

  // CTA
  if (direction.content_form && direction.content_form.includes('视频')) {
    lines.push('\n**CTA建议**：欢迎评论区留言，或私信领取完整资料');
  }

  return lines.join('\n');
}

function getRoleGuidance(role) {
  const map = {
    awareness: '轻产品露出(<10%)，重行业解释权，用3秒注意力钩子',
    trust: '深度完整叙事，建立专业信任，可复用资产',
    conversion: '产品化叙事，真实场景+量化结果，明确CTA'
  };
  return map[role] || '';
}

function buildSourceReference(resources) {
  const sources = resources.sources || [];
  return sources.map(s => ({
    source_id: s.source_id,
    type: s.type,
    title: s.title,
    url: s.url,
    tier: s.tier
  }));
}

function buildRepurposingNotes(direction, resources) {
  const notes = [];
  const sources = resources.sources || [];
  const hasVideo = sources.some(s => s.type === 'youtube');
  const hasLongArticle = direction.content_form?.includes('长文') || direction.content_form?.includes('图文');

  if (hasVideo) {
    notes.push({
      tag: 'repurpose_video',
      action: 'extract_short_video_angle',
      from: 'YouTube素材',
      to: '艾氪短视频',
      note: 'YouTube内容可提炼为短视频钩子'
    });
  }

  if (hasLongArticle) {
    notes.push({
      tag: 'repurpose_deepen',
      action: 'deepen_to_gzh',
      from: '长文/图文',
      to: '公众号',
      note: '优质长文值得深化为公众号完整叙事'
    });
  }

  return notes;
}

function renderBriefMarkdown(brief) {
  const lines = [
    `# Trend Brief：${brief.meta.topic_title}`,
    '',
    `**Brief ID**: ${brief.brief_id}`,
    `**方向**: ${brief.meta.direction_id} — ${brief.meta.direction_title}`,
    `**目标平台**: ${brief.meta.target_platform}（${brief.meta.target_account}）`,
    `**内容形式**: ${brief.meta.content_form}`,
    `**创建时间**: ${brief.meta.created_at}`,
    ''
  ];

  // 核心论点
  if (brief.core_claims && brief.core_claims.length > 0) {
    lines.push('## 核心论点\n');
    for (const c of brief.core_claims) {
      lines.push(`**C${c.claim_id.replace('C', '')}**：${c.statement}`);
    }
    lines.push('');
  }

  // 事实支撑
  lines.push('## 事实支撑\n');
  if (brief.evidence_support.S_grade.length > 0) {
    lines.push('**S级（强证据）**');
    for (const s of brief.evidence_support.S_grade) {
      lines.push(`- [${s.source_id}] ${s.title}`);
    }
  }
  if (brief.evidence_support.A_grade.length > 0) {
    lines.push('**A 级（高可信）**');
    for (const s of brief.evidence_support.A_grade) {
      lines.push(`- [${s.source_id}] ${s.title}`);
    }
  }
  if (brief.evidence_support.B_grade.length > 0) {
    lines.push('**B 级（可参考）**');
    for (const s of brief.evidence_support.B_grade) {
      lines.push(`- [${s.source_id}] ${s.title}`);
    }
  }
  lines.push('');

  // 证据充分度
  lines.push('## 证据充分度\n');
  lines.push(`${brief.evidence_sufficiency.message}（${brief.evidence_sufficiency.score}/5）`);
  lines.push('');

  // 数据点
  if (brief.data_points.key_data) {
    lines.push('## 关键数据\n');
    lines.push(brief.data_points.key_data);
    if (brief.data_points.key_numbers.length > 0) {
      lines.push('\n**数字提取**：');
      lines.push(brief.data_points.key_numbers.map(n => `\`${n}\``).join('；'));
    }
    lines.push('');
  }

  // 风险提示
  if (brief.risk_warnings.length > 0) {
    lines.push('## 风险提示\n');
    for (const w of brief.risk_warnings) {
      lines.push(w);
    }
    lines.push('');
  }

  // Agent6指引
  lines.push(brief.agent6_guidance || '');
  lines.push('');

  // Repurposing
  if (brief.repurposing_notes && brief.repurposing_notes.length > 0) {
    lines.push('## Repurposing 建议\n');
    for (const n of brief.repurposing_notes) {
      lines.push(`- ${n.note}（${n.from} → ${n.to}）`);
    }
  }

  return lines.join('\n');
}

module.exports = { buildTopicBrief };
