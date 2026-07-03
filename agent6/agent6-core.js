// agent6-core.js
// Agent 6 Pipeline 主入口
// 用法: node agent6-core.js --input mock-data/sample-topic-brief.json

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { generateArticleId } = require('./lib/id-generator');
const { writeJsonAtomic } = require('./lib/file-utils');
const { TokenBudget } = require('./lib/token-budget');
const { PipelineQueue } = require('./lib/pipeline-queue');

const { buildCapabilityIndex } = require('./skills/capability-index-builder');
const { matchTopicToCapabilities } = require('./skills/topic-capability-matcher');
const { decideInsertionStrategy } = require('./skills/insertion-strategy-decider');
const { selectWritingMode, getPrimarySkill, getAuxSkills, runWritingSkill } = require('./skills/skill-selector');
const { runSkill, SkillTimeoutError } = require('./lib/skill-runner');
const { kaiGate } = require('./skills/kai-gate');
const { KnowledgeSync } = require('./skills/knowledge-sync');
const { getCurrentCampaign } = require('./skills/campaign-consumer');

class HumanActionRequiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HumanActionRequiredError';
  }
}

/**
 * 替换占位符
 */
function replacePlaceholders(content, companyName) {
  return content
    .replace(/\[COMPANY_NAME\]/g, companyName)
    .replace(/\{\{COMPANY\}\}/g, companyName)
    .replace(/\{\{BRAND\}\}/g, companyName);
}

/**
 * 通过 Jova Agent Session 触发 show_ui Skill 调用
 * @param {string} skillId - 不带 'skill::' 前缀
 * @param {Object} params - { topicBrief, insertionStrategy, companyName }
 * @returns {Promise<string>} Skill 返回的内容
 */
async function invokeJovaSkill(skillId, params) {
  // 延迟加载 invoker（避免循环 require）
  const { invokeSkill } = require('./lib/jova-skill-invoker');
  try {
    return await invokeSkill(skillId, params);
  } catch (err) {
    // sessions_spawn 在 node 直接调用时不可用，fallback 到 skill-prompt 方式
    if (err.message && err.message.includes('sessions_spawn')) {
      console.warn(`[agent6] ⚠️ sessions_spawn 不可用（standalone 模式），跳过 Skill 调用`);
      console.warn(`[agent6] 💡 提示: 在 Jova 对话中调用 Agent 6 以使用真实 Skill`);
      const prompt = buildSkillPrompt(skillId, params);
      return `[STANDALONE MODE] Skill "${skillId}" prompt:\n\n${prompt.slice(0, 500)}...\n\n(在 Jova 环境中调用以获得完整文章产出)`;
    }
    throw err;
  }
}

/**
 * 根据 skill 类型构造 Skill 调用指令
 */
function buildSkillPrompt(skillId, params) {
  const { topicBrief, insertionStrategy, companyName } = params;
  const topic = topicBrief.topic_title || '未命名主题';
  const brief = topicBrief.brief || '';
  const keywords = (topicBrief.keywords || []).join('、');

  if (skillId === 'khazix-writer') {
    return `你是数字生命卡兹克，用卡兹克的风格写一篇公众号长文。

【主题】${topic}
【摘要】${brief}
【关键词】${keywords || 'AI、行业洞察、技术趋势'}
【公司】${companyName}

要求：
- 有见识的普通人在认真聊一件打动他的事
- 讲人话，像个活人，有温度
- 不用小标题，从头到尾一口气顺下来
- 禁用"首先、其次、最后"、"综上所述"、"值得注意的是"
- 不用冒号和破折号
- 结尾callback开头埋的钩子
- 字数1500-2500字`;
  }

  // 通用 Skill 指令
  return `用 ${skillId} 技能，基于以下信息生成内容：
【主题】${topic}
【摘要】${brief}
【关键词】${keywords}
【公司】${companyName}`;
}

/**
 * 生成文章内容（通过 Skill 选择器调用主笔+辅笔）
 */
async function generateContent(topicBrief, insertionStrategy, companyName) {
  const mode = selectWritingMode(topicBrief, insertionStrategy);
  const primarySkill = getPrimarySkill(mode);

  console.log(`[agent6] 写作模式: ${mode}，主笔: ${primarySkill}`);

  // 主笔执行（带超时 + Jova Skill 路由）
  let content;
  try {
    content = await runSkill(primarySkill, () =>
      runWritingSkill(primarySkill, { topicBrief, insertionStrategy, companyName }),
      { timeoutMs: 60000 }
    );
  } catch (err) {
    // Jova Skill 真实调用（show_ui 路径）
    if (err.code === 'JOVA_SKILL_REQUIRED') {
      console.log(`[agent6] 真实 Skill 调用: ${err.skillId}，通过 Jova 会话触发`);
      content = await invokeJovaSkill(err.skillId, err.params);
    } else if (err instanceof SkillTimeoutError) {
      console.warn(`[agent6] 主笔 ${primarySkill} 超时，触发 HumanActionRequiredError`);
      throw new HumanActionRequiredError(`主笔 Skill ${primarySkill} 执行超时（60s），需要人工介入`);
    } else {
      throw err;
    }
  }

  // 辅笔并发执行（不阻塞主流程，Jova Skill 路径同理）
  const auxSkills = getAuxSkills(mode);
  if (auxSkills.length > 0) {
    const auxResults = await Promise.allSettled(
      auxSkills.map(skillId =>
        runSkill(skillId, () =>
          runWritingSkill(skillId, { topicBrief, insertionStrategy, companyName }),
          { timeoutMs: 30000 }
        ).then(r => ({ skill: skillId, content: r }))
        .catch(err => {
          // 辅笔 Jova Skill 路径
          if (err.code === 'JOVA_SKILL_REQUIRED') {
            return invokeJovaSkill(err.skillId, err.params)
              .then(c => ({ skill: skillId, content: c }))
              .catch(e => ({ skill: skillId, error: e.message }));
          }
          return { skill: skillId, error: err.message };
        })
      )
    );

    const success = auxResults.filter(r => r.status === 'fulfilled' && !r.value.error);
    if (success.length > 0) {
      console.log(`[agent6] 辅笔完成: ${success.map(r => r.value.skill).join(', ')}`);
    }
  }

  return content;
}

/**
 * 主函数
 */
async function runAgent6({ topicBrief, strategyContext, pendingKeywords }) {
  // === 0. 启动时同步 ===
  const companyName = process.env.COMPANY_NAME;
  if (!companyName) {
    throw new Error('COMPANY_NAME 环境变量未设置，Agent 6 无法启动');
  }

  console.log(`[agent6] 启动，主题：「${topicBrief.topic_title}」`);

  // 预加载所有 Skill 的 SKILL.md（用于 sessions_spawn 子 agent 执行写作）
  const { preloadSkills } = require('./lib/jova-skill-invoker');
  await preloadSkills(['khazix-writer', 'ljg-writes', 'hv-analysis', 'ljg-think', 'ljg-rank', 'ljg-card', 'huashu-douyin-script']);

  // 同步 Agent2/3 知识
  await buildCapabilityIndex({ source: 'agent2' });
  await buildCapabilityIndex({ source: 'agent3' });

  // === 0b. Agent 1 Campaign（如有）===
  const activeCampaign = getCurrentCampaign();
  if (activeCampaign) {
    console.log(`[agent6] active campaign: ${activeCampaign.campaign_id} (goal: ${activeCampaign.goal})`);
    await buildCapabilityIndex({ source: 'campaign', campaign: activeCampaign });
  }

  // === 1. 匹配 ===
  const indexPath = path.join(__dirname, 'knowledge/_index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const matchReport = matchTopicToCapabilities(topicBrief, index.cards);

  console.log(`[agent6] 匹配结果：${matchReport.insertion_type}，top=${matchReport.top_matches[0]?.headline}`);

  // === 2. 策略 ===
  const insertionStrategy = decideInsertionStrategy({ matchReport, companyName });

  // === 3. 生成 ===
  const content = await generateContent(topicBrief, insertionStrategy, companyName);

  // === 4. 质量门 ===
  const gateResult = kaiGate(content);
  const qualityCheck = {
    pass: gateResult.pass,
    reasons: gateResult.reasons
  };
  if (!gateResult.pass) {
    console.warn(`[agent6] 质量门警告: ${gateResult.reasons.join(', ')}`);
  }

  // === 5. 组装输出 ===
  const article = {
    article_id: generateArticleId(),
    topic_id: topicBrief.topic_id,
    direction_id: topicBrief.direction_id || null,
    content,
    content_structure: {
      hook: content.split('\n')[0],
      body: content.split('\n').slice(1, -1).join('\n').slice(0, 200),
      cta: content.split('\n').slice(-1)[0]
    },
    insertion_strategy: insertionStrategy,
    match_report: matchReport,
    evidence_references: (matchReport.top_matches || [])
      .filter(m => m.id)
      .map(m => ({ capability_id: m.id, evidence_text: m.headline, source_file: null })),
    capability_cards_used: (matchReport.top_matches || []).map(m => m.id).filter(Boolean),
    quality_check: qualityCheck,
    generated_at: new Date().toISOString()
  };

  return article;
}

/**
 * CLI 入口
 */
async function main() {
  const args = process.argv.slice(2);
  let inputPath = null;
  let outputDir = 'output';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) inputPath = args[i + 1];
    if (args[i] === '--output' && args[i + 1]) outputDir = args[i + 1];
  }

  if (!inputPath) {
    console.error('用法: node agent6-core.js --input <file.json> [--output <dir>]');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`输入文件不存在: ${inputPath}`);
    process.exit(1);
  }

  const topicBrief = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // ── Phase 1.4: pending_keywords.json 空数组检测 ──────────────────────────
  const PENDING_KW_PATH = path.join(__dirname, 'knowledge/pending_keywords.json');
  if (!fs.existsSync(PENDING_KW_PATH)) {
    console.error('[agent6] ❌ pending_keywords.json 不存在，请先配置 knowledge/pending_keywords.json');
    process.exit(1);
  }
  // pending_keywords.json 根是对象: { keywords: [...], updated_at: "...", ... }
  // 数组在 .keywords 字段里
  let pendingKeywordsArr;
  try {
    const raw = JSON.parse(fs.readFileSync(PENDING_KW_PATH, 'utf8'));
    if (Array.isArray(raw)) {
      pendingKeywordsArr = raw;  // 根直接是数组（兼容旧格式）
    } else if (Array.isArray(raw.keywords)) {
      pendingKeywordsArr = raw.keywords;
    } else {
      pendingKeywordsArr = [];
    }
  } catch (e) {
    console.error(`[agent6] ❌ pending_keywords.json 解析失败: ${e.message}`);
    process.exit(1);
  }
  if (pendingKeywordsArr.length === 0) {
    console.warn('[agent6] ⚠️ WARN: pending_keywords.json 为空，建议填充后再试');
    console.warn('[agent6] ⚠️ 参考: 从 PRD Section 3/4 提取关键词写入 knowledge/pending_keywords.json');
  } else {
    console.log(`[agent6] ✓ pending_keywords.json 加载成功 (${pendingKeywordsArr.length} 条关键词)`);
  }
  // 传给 runAgent6 时用对象形式
  const pendingKeywords = { keywords: pendingKeywordsArr };

  try {
    const article = await runAgent6({ topicBrief, pendingKeywords });

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, `${article.article_id}.json`);
    writeJsonAtomic(outPath, article);

    console.log(`[agent6] 完成: ${outPath}`);
    console.log(`[agent6] 策略: ${article.insertion_strategy.strategy}`);
    console.log(`[agent6] 质量门: ${article.quality_check.pass ? '通过' : '警告'}`);
  } catch (err) {
    if (err.name === 'HumanActionRequiredError') {
      console.error(`[agent6] 需要人工介入: ${err.message}`);
    } else {
      console.error(`[agent6] 错误: ${err.message}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runAgent6, HumanActionRequiredError };
