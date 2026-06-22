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
 * 生成文章内容（通过 Skill 选择器调用主笔+辅笔）
 */
async function generateContent(topicBrief, insertionStrategy, companyName) {
  const mode = selectWritingMode(topicBrief, insertionStrategy);
  const primarySkill = getPrimarySkill(mode);

  console.log(`[agent6] 写作模式: ${mode}，主笔: ${primarySkill}`);

  // 主笔执行（带超时）
  let content;
  try {
    content = await runSkill(primarySkill, () =>
      runWritingSkill(primarySkill, { topicBrief, insertionStrategy, companyName }),
      { timeoutMs: 60000 }
    );
  } catch (err) {
    if (err instanceof SkillTimeoutError) {
      console.warn(`[agent6] 主笔 ${primarySkill} 超时，触发 HumanActionRequiredError`);
      throw new HumanActionRequiredError(`主笔 Skill ${primarySkill} 执行超时（60s），需要人工介入`);
    }
    throw err;
  }

  // 辅笔并发执行（不阻塞主流程）
  const auxSkills = getAuxSkills(mode);
  if (auxSkills.length > 0) {
    const auxResults = await Promise.allSettled(
      auxSkills.map(skillId =>
        runSkill(skillId, () =>
          runWritingSkill(skillId, { topicBrief, insertionStrategy, companyName }),
          { timeoutMs: 30000 }
        ).then(r => ({ skill: skillId, content: r }))
        .catch(err => ({ skill: skillId, error: err.message }))
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
async function runAgent6({ topicBrief, strategyContext }) {
  // === 0. 启动时同步 ===
  const companyName = process.env.COMPANY_NAME;
  if (!companyName) {
    throw new Error('COMPANY_NAME 环境变量未设置，Agent 6 无法启动');
  }

  console.log(`[agent6] 启动，主题：「${topicBrief.topic_title}」`);

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

  try {
    const article = await runAgent6({ topicBrief });

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
