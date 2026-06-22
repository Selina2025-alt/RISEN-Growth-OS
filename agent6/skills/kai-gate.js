// skills/kai-gate.js
// P1.1：Four U's 质量门

/**
 * Four U's 质量检查
 * @param {string} content - 文章正文
 * @param {string} [reason] - 可选：质量问题原因
 * @returns {{ pass: boolean, reasons: string[], scores: Object }}
 */
function kaiGate(content, reason) {
  const reasons = [];
  const scores = {};

  if (!content || content.trim().length === 0) {
    reasons.push('内容为空');
    return { pass: false, reasons, scores };
  }

  // 1. Useful（有用性）：内容是否提供了有价值的信息
  const hasPracticalInfo = /[\u4e00-\u9fa5]{10,}/.test(content); // 至少10个汉字的段落
  const hasListOrSteps = /(第一|第二|第三|步骤|方法|技巧)/.test(content);
  scores.useful = (hasPracticalInfo ? 0.4 : 0) + (hasListOrSteps ? 0.3 : 0) + 0.3;
  if (scores.useful < 0.6) reasons.push('Useful不足：内容缺乏实用性信息或可操作步骤');

  // 2. User-focused（用户导向）：内容是否围绕读者需求
  const hasBenefits = /(帮助|解决|让你|教你|教你|助力)/.test(content);
  const hasSecondPerson = /(你|你的|咱们|我们)/.test(content);
  scores.user_focused = (hasBenefits ? 0.5 : 0) + (hasSecondPerson ? 0.3 : 0) + 0.2;
  if (scores.user_focused < 0.5) reasons.push('User-focused不足：内容缺乏用户视角');

  // 3. Clear（清晰性）：结构是否清晰
  const hasHeadings = /^#{1,3}\s/m.test(content);     // 有 markdown 标题
  const paragraphCount = (content.match(/\n\n/g) || []).length;
  scores.clear = (hasHeadings ? 0.4 : 0) + (paragraphCount >= 3 ? 0.3 : 0) + 0.3;
  if (scores.clear < 0.5) reasons.push('Clear不足：内容结构不清晰或分段不足');

  // 4. Actionable（可行动性）：内容是否有明确的行动引导
  const hasCTA = /(立即|赶紧|点击|访问|联系|体验|申请)/.test(content);
  const hasContact = /(官网|公众号|微信|咨询|电话)/.test(content);
  scores.actionable = (hasCTA ? 0.5 : 0) + (hasContact ? 0.3 : 0) + 0.2;
  if (scores.actionable < 0.4) reasons.push('Actionable不足：缺乏行动指引或联系方式');

  // 长度检查
  const charCount = content.replace(/\s/g, '').length;
  if (charCount < 300) reasons.push(`内容过短（${charCount}字），不足500字基准`);
  if (charCount > 30000) reasons.push(`内容过长（${charCount}字），超过30000字上限`);

  // 占位符残留检查
  if (/\[COMPANY_NAME\]|\{\{COMPANY\}\}|\{\{BRAND\}\}/.test(content)) {
    reasons.push('存在未替换的占位符');
  }

  const pass = reasons.length === 0;
  return { pass, reasons, scores };
}

/**
 * 带建议的质量门（返回改进建议）
 */
function kaiGateWithSuggestion(content) {
  const result = kaiGate(content);
  const suggestions = [];

  if (!result.pass) {
    if (result.reasons.some(r => r.includes('Useful'))) {
      suggestions.push('建议增加具体的操作步骤、案例或数据支撑');
    }
    if (result.reasons.some(r => r.includes('User-focused'))) {
      suggestions.push('建议增加第二人称视角，强调对读者的价值');
    }
    if (result.reasons.some(r => r.includes('Clear'))) {
      suggestions.push('建议增加小标题和段落分隔，提升阅读节奏');
    }
    if (result.reasons.some(r => r.includes('Actionable'))) {
      suggestions.push('建议在结尾增加明确的CTA或联系方式');
    }
  }

  return { ...result, suggestions };
}

module.exports = { kaiGate, kaiGateWithSuggestion };
