/**
 * jova-skill-invoker.js
 *
 * 正确架构：通过 sessions_spawn 启动 sub-agent，在 Jova 上下文中执行 Skill
 *
 * sessions_spawn 是 Jova Agent 内置工具，可直接调用，无需 import
 * sub-agent 运行在独立 session，拥有完整的 Agent 上下文
 * sub-agent 可以调用 show_ui（UI组件型 Skill）或直接读取 SKILL.md 执行（Prompt风格型 Skill）
 *
 * 流程：
 *   agent6-core.js → invokeSkill(skillId, params)
 *     → sessions_spawn({ task: "用 khazix-writer 风格写文章...", label: "agent6-skill-xxx" })
 *     → sub-agent 在 Jova 上下文执行
 *     → sub-agent 返回文章内容（文本或 JSON）
 *     → 本模块解析并返回纯文本
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CALL_DIR = path.join(os.tmpdir(), 'agent6-skill-calls');
if (!fs.existsSync(CALL_DIR)) fs.mkdirSync(CALL_DIR, { recursive: true });

// 预加载所有 Skill 的 SKILL.md（agent6-core.js 启动时调用一次）
const SKILL_CACHE = {};

/**
 * 预加载 Skill 内容到缓存
 * @param {string[]} skillIds - 要加载的 skill ID 列表
 */
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

/**
 * 构建 Skill 执行 Prompt
 */
function buildSkillPrompt(skillId, params) {
  const { topicBrief, insertionStrategy, companyName } = params;
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
5. 文章必须严格遵循 Skill 中的风格要求（禁用的词、标点、结构必须遵守）

请开始写作，直接输出正文：`;
}

/**
 * 通过 sessions_spawn 触发 Skill 执行
 * @param {string} skillId - skill 名称（不含 skill:: 前缀）
 * @param {Object} params - { topicBrief, insertionStrategy, companyName }
 * @returns {Promise<string>} Skill 输出的文章内容
 */
async function invokeSkill(skillId, params) {
  const callId = `sk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const inputFile = path.join(CALL_DIR, `${callId}-input.json`);
  const outputFile = path.join(CALL_DIR, `${callId}-output.json`);

  // 写入输入文件
  fs.writeFileSync(inputFile, JSON.stringify({ skillId, params, callId }, null, 2), 'utf8');

  const prompt = buildSkillPrompt(skillId, params);

  // sessions_spawn 在 Jova Agent 上下文中直接可用（无需 import）
  // eslint-disable-next-line no-undef
  const result = await sessions_spawn({
    task: prompt,
    label: `agent6-skill-${callId}`,
    runTimeoutSeconds: 0  // 由外层 runSkill 超时控制
  });

  // sessions_spawn 的返回格式是 { content: string } 或直接的字符串
  if (typeof result === 'string') {
    fs.writeFileSync(outputFile, JSON.stringify({ content: result }, null, 2), 'utf8');
    return result;
  } else if (result && typeof result.content === 'string') {
    fs.writeFileSync(outputFile, JSON.stringify({ content: result.content }, null, 2), 'utf8');
    return result.content;
  } else {
    throw new Error(`sessions_spawn 返回格式异常: ${typeof result}`);
  }
}

module.exports = { preloadSkills, invokeSkill };
