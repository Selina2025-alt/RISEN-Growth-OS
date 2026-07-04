/**
 * agent6-core.js
 * Agent 6 Pipeline 主入口
 * 用法: node agent6-core.js --input mock-data/sample-topic-brief.json
 *
 * Pipeline（6 Phase）：
 *   Phase 1: 上下文加载（Reader Skills）
 *   Phase 2: 网络调研（Source Discovery + Multi-Source Research）
 *   Phase 3: 选题匹配（Topic-Capability Matcher + Insertion Strategy Decider）
 *   Phase 4: 写作编排（Skill Selector + Evidence Pack）
 *   Phase 5: 后处理（Geo Generator + SEO Structure + Geo Transformer）
 *   Phase 6: 质量保障（Geo Metrics + Content Lineage + Schema + Keywords）
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { generateArticleId } = require('./lib/id-generator');
const { writeJsonAtomic } = require('./lib/file-utils');
const { SkillOrchestrator } = require('./lib/skill-orchestrator');

const { buildCapabilityIndex } = require('./skills/capability-index-builder');
const { matchTopicToCapabilities } = require('./skills/topic-capability-matcher');
const { decideInsertionStrategy } = require('./skills/insertion-strategy-decider');
const { selectWritingMode, getPrimarySkill, getAuxSkills, runSkillWithFallback } = require('./skills/skill-selector');
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

// ============ 辅助函数 ============

function replacePlaceholders(content, companyName) {
  return content
    .replace(/\[COMPANY_NAME\]/g, companyName)
    .replace(/\{\{COMPANY\}\}/g, companyName)
    .replace(/\{\{BRAND\}\}/g, companyName);
}

async function invokeJovaSkill(skillId, params) {
  const { invokeSkill } = require('./lib/jova-skill-invoker');
  try {
    return await invokeSkill(skillId, params);
  } catch (err) {
    if (err.message && err.message.includes('sessions_spawn')) {
      console.warn(`[agent6] ⚠️ sessions_spawn 不可用（standalone 模式）`);
      const prompt = buildSkillPrompt(skillId, params);
      return `[STANDALONE MODE] Skill "${skillId}" prompt:\n\n${prompt.slice(0, 500)}...\n\n(在 Jova 环境中调用以获得完整文章产出)`;
    }
    throw err;
  }
}

function buildSkillPrompt(skillId, params) {
  const { topicBrief, insertionStrategy, companyName } = params;
  const topic = topicBrief?.topic_title || '未命名主题';
  const brief = topicBrief?.brief || '';
  const keywords = (topicBrief?.keywords || []).join('、');

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
  return `用 ${skillId} 技能，基于以下信息生成内容：
【主题】${topic}【摘要】${brief}【关键词】${keywords}【公司】${companyName}`;
}

// ============ 内容生成（调用 Skill Selector）============

async function generateContent(topicBrief, insertionStrategy, companyName) {
  const mode = selectWritingMode(topicBrief, insertionStrategy);
  const primarySkill = getPrimarySkill(mode);
  console.log(`[agent6] 写作模式: ${mode}，主笔: ${primarySkill}`);

  let content;
  try {
    content = await runSkill(primarySkill, () =>
      runSkillWithFallback(primarySkill, { topicBrief, insertionStrategy, companyName }),
      { timeoutMs: 60000 }
    );
  } catch (err) {
    if (err.code === 'JOVA_SKILL_REQUIRED') {
      console.log(`[agent6] 通过 Jova 会话触发 Skill: ${err.skillId}`);
      content = await invokeJovaSkill(err.skillId, err.params);
    } else if (err instanceof SkillTimeoutError) {
      throw new HumanActionRequiredError(`主笔 Skill ${primarySkill} 执行超时（60s）`);
    } else {
      throw err;
    }
  }

  // 辅笔并发
  const auxSkills = getAuxSkills(mode);
  if (auxSkills.length > 0) {
    const auxResults = await Promise.allSettled(
      auxSkills.map(skillId =>
        runSkill(skillId, () =>
          runSkillWithFallback(skillId, { topicBrief, insertionStrategy, companyName }),
          { timeoutMs: 30000 }
        ).then(r => ({ skill: skillId, content: r }))
        .catch(err => {
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

// ============ 核心 Pipeline ============

/**
 * 构建初始 Pipeline 上下文
 */
function buildPipelineContext({ topicBrief, companyName }) {
  return {
    topicBrief,
    companyName,
    brandCtx: null,
    stratCtx: null,
    icpCtx: null,
    matchReport: null,
    insertionStrategy: null,
    article_content: null,
    article_id: generateArticleId(),
    _capabilityCards: [],
  };
}

/**
 * 执行 Phase 1-3（同步部分：在 Orchestrator 之前完成）
 * 原因：这些阶段的输出是后面写作的必要输入
 */
async function runPreWritePhases(ctx) {
  const { topicBrief, companyName } = ctx;

  // Phase 0: 同步 Agent2/3 知识
  await buildCapabilityIndex({ source: 'agent2' });
  await buildCapabilityIndex({ source: 'agent3' });

  const activeCampaign = getCurrentCampaign();
  if (activeCampaign) {
    console.log(`[agent6] active campaign: ${activeCampaign.campaign_id}`);
    await buildCapabilityIndex({ source: 'campaign', campaign: activeCampaign });
  }

  // Phase 3: 选题匹配（必须先执行）
  const indexPath = path.join(__dirname, 'knowledge/_index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const matchReport = matchTopicToCapabilities(topicBrief, index.cards);
  ctx.matchReport = matchReport;
  ctx._capabilityCards = index.cards;
  console.log(`[agent6] 匹配结果：${matchReport.insertion_type}，top=${matchReport.top_matches?.[0]?.headline}`);

  // Phase 3: 策略决策
  const insertionStrategy = decideInsertionStrategy({ matchReport, companyName });
  ctx.insertionStrategy = insertionStrategy;

  return ctx;
}

/**
 * 执行写作（Phase 4：独立方法，保留原有 Jova Skill 调用逻辑）
 */
async function runWritingPhase(ctx) {
  const { topicBrief, insertionStrategy, companyName } = ctx;
  const content = await generateContent(topicBrief, insertionStrategy, companyName);
  ctx.article_content = content;
  return ctx;
}

/**
 * 执行 Orchestrator（Phase 1 Reader + Phase 2 调研 + Phase 5 后处理 + Phase 6 质量）
 * 注意：Phase 3（匹配）和 Phase 4（写作）已在外部执行
 */
async function runOrchestratedPhases(ctx, skipPhases = []) {
  // 注入预执行结果到 ctx（避免重复执行 Phase 3 和 4）
  const orchestrator = new SkillOrchestrator({ skipPhases });

  // 执行 Orchestrator（内部会跳过已执行的 Phase）
  ctx = await orchestrator.run(ctx);

  // 如果 orchestrator 成功执行了质量 phase，提取结果
  if (ctx._skillOutputs?.['geo-metrics-skill']) {
    ctx.geo_metrics = ctx._skillOutputs['geo-metrics-skill'];
  }
  if (ctx._skillOutputs?.['content-lineage-tracker']) {
    ctx.lineage = ctx._skillOutputs['content-lineage-tracker'];
  }
  if (ctx._skillOutputs?.['schema-org-generator']) {
    ctx.schema_org = ctx._skillOutputs['schema-org-generator'];
  }
  if (ctx._skillOutputs?.['seo-keyword-research']) {
    ctx.seo_keywords = ctx._skillOutputs['seo-keyword-research'];
  }
  if (ctx._skillOutputs?.['seo-structure-skill']) {
    ctx.seo_metadata = ctx._skillOutputs['seo-structure-skill'];
  }
  if (ctx._skillOutputs?.['geo-article-transformer']) {
    ctx.geo_transformed = ctx._skillOutputs['geo-article-transformer'];
  }
  if (ctx._skillOutputs?.['source-discovery-skill']) {
    ctx.sources = ctx._skillOutputs['source-discovery-skill'].sources || [];
  }

  return ctx;
}

// ============ 主入口 ============

async function runAgent6({ topicBrief, pendingKeywords }) {
  const companyName = process.env.COMPANY_NAME;
  if (!companyName) throw new Error('COMPANY_NAME 环境变量未设置');

  console.log(`[agent6] 启动，主题：「${topicBrief.topic_title}」`);

  // 预加载 Jova Skills
  const { preloadSkills } = require('./lib/jova-skill-invoker');
  await preloadSkills(['khazix-writer', 'ljg-writes', 'hv-analysis', 'ljg-think', 'ljg-rank', 'ljg-card', 'huashu-douyin-script']);

  // 构建初始上下文
  let ctx = buildPipelineContext({ topicBrief, companyName });

  // Phase 3（匹配）和 Phase 4（写作）— 必须串行
  ctx = await runPreWritePhases(ctx);
  ctx = await runWritingPhase(ctx);

  // Phase 1/2/5/6 — 通过 Orchestrator 执行（含 Reader/调研/后处理/质量）
  ctx = await runOrchestratedPhases(ctx, ['matching', 'writing']);

  // 质量门（基于最终文章内容）
  const finalContent = ctx.geo_transformed?.content || ctx.article_content;
  const gateResult = kaiGate(finalContent);

  // 组装输出
  const article = {
    article_id: ctx.article_id,
    topic_id: topicBrief.topic_id,
    direction_id: topicBrief.direction_id || null,
    content: finalContent,
    content_structure: {
      hook: finalContent.split('\n')[0],
      body: finalContent.split('\n').slice(1, -1).join('\n').slice(0, 200),
      cta: finalContent.split('\n').slice(-1)[0],
    },
    insertion_strategy: ctx.insertionStrategy,
    match_report: ctx.matchReport,
    evidence_references: (ctx.matchReport?.top_matches || [])
      .filter(m => m.id)
      .map(m => ({ capability_id: m.id, evidence_text: m.headline, source_file: null })),
    capability_cards_used: (ctx.matchReport?.top_matches || []).map(m => m.id).filter(Boolean),
    // 新增输出字段（来自 Orchestrator）
    seo_metadata: ctx.seo_metadata || null,
    seo_keywords: ctx.seo_keywords || null,
    geo_score: ctx.geo_metrics?.overall || null,
    geo_dimensions: ctx.geo_metrics?.dimensions || null,
    content_lineage: ctx.lineage || null,
    schema_org: ctx.schema_org || null,
    sources: ctx.sources || [],
    // 质量门
    quality_check: {
      pass: gateResult.pass,
      reasons: gateResult.reasons,
    },
    // Pipeline 执行元数据
    pipeline_phases: ctx._phases || null,
    generated_at: new Date().toISOString(),
  };

  return article;
}

// ============ CLI 入口 ============

async function main() {
  const args = process.argv.slice(2);
  let inputPath = null;
  let outputDir = 'output';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) inputPath = args[i + 1];
    if (args[i] === '--output' && args[i + 1]) outputDir = args[i + 1];
    if (args[i] === '--skip-phase' && args[i + 1]) {
      console.log(`[agent6] 跳过 Phase: ${args[i + 1]}`);
    }
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

  // pending_keywords 检测
  const PENDING_KW_PATH = path.join(__dirname, 'knowledge/pending_keywords.json');
  if (!fs.existsSync(PENDING_KW_PATH)) {
    console.error('[agent6] ❌ pending_keywords.json 不存在');
    process.exit(1);
  }
  let pendingKeywordsArr;
  try {
    const raw = JSON.parse(fs.readFileSync(PENDING_KW_PATH, 'utf8'));
    pendingKeywordsArr = Array.isArray(raw) ? raw : (Array.isArray(raw.keywords) ? raw.keywords : []);
  } catch (e) {
    console.error(`[agent6] ❌ pending_keywords.json 解析失败: ${e.message}`);
    process.exit(1);
  }
  if (pendingKeywordsArr.length === 0) {
    console.warn('[agent6] ⚠️ pending_keywords.json 为空');
  } else {
    console.log(`[agent6] ✓ pending_keywords.json 加载成功 (${pendingKeywordsArr.length} 条)`);
  }

  try {
    const article = await runAgent6({ topicBrief, pendingKeywords: { keywords: pendingKeywordsArr } });

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, `${article.article_id}.json`);
    writeJsonAtomic(outPath, article);

    console.log(`[agent6] 完成: ${outPath}`);
    console.log(`[agent6] 策略: ${article.insertion_strategy?.strategy}`);
    console.log(`[agent6] 质量门: ${article.quality_check?.pass ? '通过' : '警告'}`);
    console.log(`[agent6] GEO评分: ${article.geo_score ?? '(无)'}`);
    console.log(`[agent6] SEO元数据: ${article.seo_metadata ? '有' : '无'}`);
    console.log(`[agent6] 血缘记录: ${article.content_lineage ? '有' : '无'}`);
    console.log(`[agent6] Schema: ${article.schema_org ? '有' : '无'}`);
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
