/**
 * jova-skill-invoker.js
 *
 * Skill 调用模块：通过 sessions_spawn 启动 sub-agent，在 Jova 上下文中执行 Skill
 *
 * sessions_spawn 是 Jova Agent 内置工具，可直接调用，无需 import
 * sub-agent 运行在独立 session，拥有完整 Agent 上下文
 *
 * 防护机制：
 * - Token 预算：单次 prompt 不超过 50000 tokens
 * - cleanup()：任何出口（正常/超时/报错）都调用，不留残留文件
 * - NODE_ENV=test：测试模式返回 mock，不调用真实 sessions_spawn
 * - skill_calls.jsonl：每次调用记录日志
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CALL_DIR = path.join(os.tmpdir(), 'agent6-skill-calls');
const CALL_LOG = path.join(CALL_DIR, 'skill_calls.jsonl');
const PROMPT_MAX_TOKENS = 50000;
const CALL_TIMEOUT_MS = 60000;

if (!fs.existsSync(CALL_DIR)) fs.mkdirSync(CALL_DIR, { recursive: true });

// ─── Skill Cache（进程级单例）────────────────────────────────────

const SKILL_CACHE = {};

function preloadSkills(skillIds) {
  const SKILL_BASE = path.join(process.env.HOME || '/root', 'SKILL');
  for (const skillId of skillIds) {
    const skillPath = path.join(SKILL_BASE, skillId, 'SKILL.md');
    try {
      if (fs.existsSync(skillPath)) {
        SKILL_CACHE[skillId] = fs.readFileSync(skillPath, 'utf8');
        console.log(`[skill-cache] ✓ ${skillId} loaded (${SKILL_CACHE[skillId].length}b)`);
      }
    } catch (e) {
      console.warn(`[skill-cache] ✗ ${skillId}: ${e.message}`);
    }
  }
}

// ─── Call Logger ─────────────────────────────────────────────────

function logCall(callId, skillId, startTime, status, extra = {}) {
  const record = {
    callId,
    skillId,
    start: startTime,
    end: new Date().toISOString(),
    status,
    ...extra,
  };
  try {
    fs.appendFileSync(CALL_LOG, JSON.stringify(record) + '\n', 'utf8');
  } catch (_) {
    // 日志失败不阻断主流程
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────

function cleanup(callId) {
  const files = [
    path.join(CALL_DIR, `${callId}-input.json`),
    path.join(CALL_DIR, `${callId}-output.json`),
  ];
  for (const f of files) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) {}
  }
}

// ─── Token 估算（简单按字符数估算，1 token ≈ 2 字符）────────────

function estimateTokens(text) {
  return Math.ceil(text.length / 2);
}

// ─── Prompt Builder ───────────────────────────────────────────────

function buildSkillPrompt(skillId, params) {
  const { topicBrief, companyName } = params;
  const topic = topicBrief?.topic_title || '未命名主题';
  const brief = topicBrief?.brief || '';
  const keywords = (topicBrief?.keywords || []).join('、');
  const contentType = topicBrief?.content_type || '行业分析';
  const trendSignal = topicBrief?.trend_signal || '';

  const skillMd = SKILL_CACHE[skillId] || '';

  return `你是内容创作专家。请根据以下信息，用指定风格完成文章写作。

【Skill 指令摘要】
${skillMd.slice(0, 8000)}

【选题信息】
- 标题：${topic}
- 摘要/要点：${brief}
- 关键词：${keywords || 'AI、行业洞察、技术趋势'}
- 内容类型：${contentType}
${trendSignal ? `- 热点背景：${trendSignal}` : ''}
- 公司：${companyName}

【任务】
1. 仔细阅读上方 Skill 指令，理解该 Skill 的写作风格要求
2. 基于选题信息，产出一篇完整文章
3. 直接输出文章正文（纯文本，不要 JSON，不要 markdown 格式，就是文章正文）
4. 字数要求：1500-2500字
5. 文章必须严格遵循 Skill 中的风格要求

请开始写作，直接输出正文：`;
}

// ─── Skill Invoker ───────────────────────────────────────────────

/**
 * 通过 sessions_spawn 触发 Skill 执行
 *
 * @param {string} skillId - skill 名称（不含 skill:: 前缀）
 * @param {Object} params - { topicBrief, companyName }
 * @returns {Promise<string>} Skill 输出的文章内容
 * @throws {Error} 超时或调用失败
 */
async function invokeSkill(skillId, params) {
  // NODE_ENV=test → 返回 mock
  if (process.env.NODE_ENV === 'test') {
    console.log(`[jova-skill-invoker] ⏭️ TEST MODE: returning mock for ${skillId}`);
    return `[TEST MODE] Mock article content for skill "${skillId}". In production this would be real content.`;
  }

  const callId = `sk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const startTime = new Date().toISOString();
  const inputFile = path.join(CALL_DIR, `${callId}-input.json`);
  const outputFile = path.join(CALL_DIR, `${callId}-output.json`);

  // 写入输入文件（供调试）
  fs.writeFileSync(inputFile, JSON.stringify({ skillId, params, callId }, null, 2), 'utf8');

  let result;
  let status = 'success';

  try {
    const prompt = buildSkillPrompt(skillId, params);

    // Token 预算检查
    const tokenEstimate = estimateTokens(prompt);
    if (tokenEstimate > PROMPT_MAX_TOKENS) {
      const err = new Error(`[jova-skill-invoker] prompt too large: ${tokenEstimate} tokens, max ${PROMPT_MAX_TOKENS}`);
      console.error(err.message);
      status = 'token_limit_exceeded';
      logCall(callId, skillId, startTime, status, { tokenEstimate, max: PROMPT_MAX_TOKENS });
      throw err;
    }

    console.log(`[jova-skill-invoker] → sessions_spawn skill=${skillId} callId=${callId} tokens≈${tokenEstimate}`);

    // sessions_spawn 是 Jova 内置工具，直接调用
    // eslint-disable-next-line no-undef
    result = await sessions_spawn({
      task: prompt,
      label: `agent6-skill-${callId}`,
      runTimeoutSeconds: 0,  // 由外层超时控制
    });

    // 解析返回值
    let content;
    if (typeof result === 'string') {
      content = result;
    } else if (result && typeof result.content === 'string') {
      content = result.content;
    } else if (result === undefined || result === null) {
      // sessions_spawn 超时或无返回
      status = 'timeout';
      logCall(callId, skillId, startTime, status, { resultType: typeof result });
      cleanup(callId);
      throw new Error(`[jova-skill-invoker] sessions_spawn 超时或无返回 (callId=${callId})`);
    } else {
      status = 'parse_error';
      logCall(callId, skillId, startTime, status, { resultType: typeof result });
      cleanup(callId);
      throw new Error(`[jova-skill-invoker] sessions_spawn 返回格式异常: ${typeof result}`);
    }

    // 写入输出文件
    fs.writeFileSync(outputFile, JSON.stringify({ content }, null, 2), 'utf8');
    logCall(callId, skillId, startTime, 'success', { tokens: tokenEstimate, contentLen: content.length });
    cleanup(callId);
    return content;

  } catch (err) {
    // 任何异常出口：cleanup + log
    if (status === 'success') status = 'error';
    logCall(callId, skillId, startTime, status, { error: err.message });
    cleanup(callId);
    throw err;
  }
}

module.exports = { preloadSkills, invokeSkill, PROMPT_MAX_TOKENS };
