// lib/llm-call.js
// LLM 调用封装
// 如果设置了 LLM_MODEL 环境变量则调用外部 LLM，否则使用内置规则判断

require('dotenv').config();

const LLM_MODEL = process.env.LLM_MODEL;
const CALL_COUNT = { value: 0 };

/**
 * 调用 LLM
 * @param {Object} opts
 * @param {string} opts.system - 系统提示词
 * @param {string} opts.user - 用户消息
 * @param {string} [opts.model] - 可覆盖 LLM_MODEL 的模型
 * @param {number} [opts.maxTokens] - 最大 token 数
 * @param {any} [opts.fallback] - 调用失败时的 fallback 值
 * @returns {Promise<string>}
 */
async function llmCall({ system, user, model, maxTokens, fallback }) {
  CALL_COUNT.value++;
  const modelToUse = model || LLM_MODEL;

  if (!modelToUse) {
    // 无 LLM 时返回 fallback（同步规则判断）
    if (typeof fallback === 'function') return fallback();
    if (fallback !== undefined) return fallback;
    throw new Error('[llm-call] no LLM_MODEL configured and no fallback provided');
  }

  // TODO: 接入外部 LLM（如 OpenAI兼容 API）
  // const response = await fetch(`${process.env.LLM_BASE_URL}/chat/completions`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.LLM_API_KEY}` },
  //   body: JSON.stringify({ model: modelToUse, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens || 800 })
  // });
  // return (await response.json()).choices[0].message.content;

  throw new Error(`[llm-call] LLM_MODEL="${modelToUse}" configured but not yet implemented. Set fallback or implement LLM integration.`);
}

/**
 * 规则判断（无 LLM 时的 fallback）
 */
function ruleBasedJudge({ keyword, cardHeadline }) {
  // 简单关键词重叠判断，用于无 LLM 的降级场景
  const kwSet = new Set(keyword.toLowerCase().split(/\s+/).filter(Boolean));
  const hlSet = new Set(cardHeadline.toLowerCase().split(/\s+/).filter(Boolean));
  let overlap = 0;
  for (const w of hlSet) { if (kwSet.has(w)) overlap++; }
  const score = hlSet.size > 0 ? overlap / hlSet.size : 0;
  return score;
}

module.exports = { llmCall, ruleBasedJudge, CALL_COUNT };
