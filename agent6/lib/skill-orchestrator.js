/**
 * lib/skill-orchestrator.js
 *
 * Agent 6 Pipeline 编排器
 *
 * 管理 6 个 Phase 的顺序执行：
 *   Phase 1: 上下文加载（Reader Skills）
 *   Phase 2: 网络调研（Source Discovery + Multi-Source Research）
 *   Phase 3: 选题匹配（Topic-Capability Matcher + Insertion Strategy Decider）
 *   Phase 4: 写作编排（Skill Selector + Evidence Pack）
 *   Phase 5: 后处理（Geo Generator + SEO Structure + Geo Transformer）
 *   Phase 6: 质量保障（Geo Metrics + Content Lineage + Schema + Keywords）
 *
 * 设计原则：
 *   - 每个 Phase 内的 Skill 顺序执行（sequential）
 *   - Phase 之间顺序执行（pipeline）
 *   - 单个 Skill 失败不影响整个 Pipeline（graceful degradation）
 *   - 所有 Skills 必须是本地 JS Skills（Jova Skill 通过 runWritingSkill 路由）
 */

const fs = require('fs');
const path = require('path');

// ============ Phase 定义 ============

const PHASES = [
  {
    name: 'context',
    label: '上下文加载',
    skills: [
      { id: 'brand-policy-reader',     module: './skills/brand-policy-reader',     source: 'local' },
      { id: 'strategy-reader',         module: './skills/strategy-reader',         source: 'local' },
      { id: 'icp-reader',             module: './skills/icp-reader',             source: 'local' },
    ],
  },
  {
    name: 'research',
    label: '网络调研',
    skills: [
      { id: 'source-discovery-skill',  module: './skills/source-discovery-skill',  source: 'local' },
      { id: 'multi-source-research',  module: './skills/multi-source-research-skill', source: 'local' },
    ],
  },
  {
    name: 'matching',
    label: '选题匹配',
    skills: [
      { id: 'topic-capability-matcher', module: './skills/topic-capability-matcher', source: 'local' },
      { id: 'insertion-strategy-decider', module: './skills/insertion-strategy-decider', source: 'local' },
    ],
  },
  {
    name: 'writing',
    label: '写作编排',
    skills: [
      { id: 'evidence-pack-skill',    module: './skills/evidence-pack-skill',     source: 'local' },
    ],
  },
  {
    name: 'post-write',
    label: '后处理',
    skills: [
      { id: 'geo-article-generator',  module: './skills/geo-article-generator',   source: 'local' },
      { id: 'seo-structure-skill',    module: './skills/seo-structure-skill',    source: 'local' },
      { id: 'geo-article-transformer', module: './skills/geo-article-transformer', source: 'local' },
    ],
  },
  {
    name: 'quality',
    label: '质量保障',
    skills: [
      { id: 'geo-metrics-skill',      module: './skills/geo-metrics-skill',      source: 'local' },
      { id: 'content-lineage-tracker', module: './skills/content-lineage-tracker', source: 'local' },
      { id: 'schema-org-generator',    module: './skills/schema-org-generator',   source: 'local' },
      { id: 'seo-keyword-research',    module: './skills/seo-keyword-research',    source: 'local' },
    ],
  },
];

// Skill 缓存（避免重复 require）
const skillCache = new Map();

const SKILLS_BASE = __dirname + '/../skills';

function loadSkill(modulePath) {
  if (!skillCache.has(modulePath)) {
    try {
      skillCache.set(modulePath, require(modulePath));
    } catch (err) {
      console.warn(`[orchestrator] ⚠️ 无法加载 Skill: ${modulePath} — ${err.message}`);
      skillCache.set(modulePath, null);
    }
  }
  return skillCache.get(modulePath);
}

// ============ SkillOrchestrator 主类 ============

class SkillOrchestrator {
  /**
   * @param {Object} opts
   * @param {boolean} opts.skipPhases - 要跳过的 Phase 名列表，如 ['research']
   * @param {string[]} opts.skipSkills - 要跳过的 Skill ID 列表
   */
  constructor({ skipPhases = [], skipSkills = [] } = {}) {
    this.skipPhases = new Set(skipPhases);
    this.skipSkills = new Set(skipSkills);
    this.executionLog = [];
  }

  /**
   * 核心执行方法
   * @param {Object} ctx - Pipeline 全局上下文（会被每个 Skill 修改）
   * @returns {Promise<Object>} 更新后的 ctx
   */
  async run(ctx) {
    console.log('[orchestrator] Pipeline 启动');

    for (const phase of PHASES) {
      if (this.skipPhases.has(phase.name)) {
        console.log(`[orchestrator] ⏭️ 跳过 Phase ${phase.name}（${phase.label}）`);
        continue;
      }

      console.log(`[orchestrator] 📦 Phase ${phase.name}：${phase.label}`);
      ctx._phases = ctx._phases || {};
      ctx._phases[phase.name] = { started_at: new Date().toISOString(), skills: {} };

      for (const skillDef of phase.skills) {
        if (this.skipSkills.has(skillDef.id)) {
          console.log(`[orchestrator]   ⏭️ 跳过 Skill: ${skillDef.id}`);
          continue;
        }

        const start = Date.now();
        console.log(`[orchestrator]   → 执行 Skill: ${skillDef.id}`);

        try {
          const result = await this._runSkill(skillDef, ctx);
          const duration = Date.now() - start;

          ctx._phases[phase.name].skills[skillDef.id] = {
            status: 'success',
            duration_ms: duration,
          };
          ctx._skillOutputs = ctx._skillOutputs || {};
          ctx._skillOutputs[skillDef.id] = result;

          console.log(`[orchestrator]   ✅ ${skillDef.id}（${duration}ms）`);
        } catch (err) {
          const duration = Date.now() - start;
          console.warn(`[orchestrator]   ⚠️ ${skillDef.id} 失败：${err.message}`);

          ctx._phases[phase.name].skills[skillDef.id] = {
            status: 'error',
            error: err.message,
            duration_ms: duration,
          };

          // Graceful degradation：记录错误但继续执行
          ctx._skillOutputs = ctx._skillOutputs || {};
          ctx._skillOutputs[skillDef.id] = { _error: err.message };
        }
      }

      ctx._phases[phase.name].completed_at = new Date().toISOString();
    }

    console.log('[orchestrator] Pipeline 完成');
    return ctx;
  }

  /**
   * 执行单个 Skill
   * @param {Object} skillDef - { id, module, source }
   * @param {Object} ctx - Pipeline 上下文
   * @returns {Promise<any>}
   */
  async _runSkill(skillDef, ctx) {
    if (skillDef.source === 'local') {
      // 解析相对于 skills/ 目录的路径
      const modulePath = skillDef.module.startsWith('/')
        ? skillDef.module
        : path.join(SKILLS_BASE, path.basename(skillDef.module));
      const mod = loadSkill(modulePath);
      if (!mod) throw new Error(`模块加载失败: ${modulePath}`);
      if (typeof mod.run !== 'function') throw new Error(`${skillDef.id} 没有 run() 导出`);
      return mod.run(this._buildSkillInput(skillDef.id, ctx));
    }
    throw new Error(`未知 Skill 来源: ${skillDef.source}`);
  }

  /**
   * 根据 Skill ID 从 ctx 构建输入参数
   * 每个 Skill 的输入不同，这里做智能路由
   */
  _buildSkillInput(skillId, ctx) {
    const { topicBrief, brandCtx, stratCtx, icpCtx, article_content, matchReport, insertionStrategy } = ctx;

    switch (skillId) {
      case 'brand-policy-reader':
        return { force_refresh: false };

      case 'strategy-reader':
        return { topicBrief: topicBrief || {} };

      case 'icp-reader':
        return { force_refresh: false };

      case 'source-discovery-skill':
        return {
          topic: topicBrief?.topic_title || '',
          keywords: topicBrief?.keywords || [],
          limit: 5,
        };

      case 'multi-source-research-skill':
        return {
          query: topicBrief?.topic_title || '',
          topic: topicBrief?.brief || '',
          num_results: 5,
        };

      case 'topic-capability-matcher':
        return {
          topicBrief: topicBrief || {},
          capabilityCards: ctx._capabilityCards || [],
        };

      case 'insertion-strategy-decider':
        return {
          matchReport: matchReport || {},
          companyName: ctx.companyName || '',
        };

      case 'evidence-pack-skill':
        return {
          topic: topicBrief?.topic_title || '',
          content: article_content || '',
          extraction_mode: insertionStrategy?.strategy === 'hard' ? 'strict' : 'balanced',
        };

      case 'geo-article-generator':
        return {
          topic: topicBrief?.topic_title || '',
          brief: topicBrief?.brief || '',
          brand_keywords: (brandCtx?.brand_keywords || []).join(','),
          platform: topicBrief?.platform || 'zhihu',
          insertion_type: insertionStrategy?.strategy || 'soft',
        };

      case 'seo-structure-skill':
        return {
          article_content: article_content || '',
          topic_title: topicBrief?.topic_title || '',
          platform: topicBrief?.platform || 'zhihu',
          target_keywords: topicBrief?.keywords || [],
        };

      case 'geo-article-transformer':
        return {
          article_content: article_content || '',
          brand_keywords: (brandCtx?.brand_keywords || []).join(','),
          topic: topicBrief?.topic_title || '',
          platform: topicBrief?.platform || 'zhihu',
        };

      case 'geo-metrics-skill':
        return {
          article_content: article_content || '',
          platform: topicBrief?.platform || 'default',
          intent_type: 'informational',
        };

      case 'content-lineage-tracker':
        return {
          article_id: ctx.article_id || 'unknown',
          article_content: article_content || '',
          topic_id: topicBrief?.topic_id || '',
          capability_cards_used: (matchReport?.top_matches || []).map(m => m.id).filter(Boolean),
          insertion_type: insertionStrategy?.strategy || 'soft',
          platform: topicBrief?.platform || 'unknown',
          sources: ctx._skillOutputs?.['source-discovery-skill']?.sources || [],
          seo_metadata: ctx._skillOutputs?.['seo-structure-skill'] || null,
          geo_score: ctx._skillOutputs?.['geo-metrics-skill'] || null,
        };

      case 'schema-org-generator':
        return {
          article_content: article_content || '',
          topic_title: topicBrief?.topic_title || '',
          platform: topicBrief?.platform || 'zhihu',
          publish_date: new Date().toISOString().split('T')[0],
          author: ctx.author || 'RISEN增长团队',
        };

      case 'seo-keyword-research':
        return {
          topic_title: topicBrief?.topic_title || '',
          content_type: topicBrief?.content_type || 'analysis',
          platform: topicBrief?.platform || 'zhihu',
          existing_keywords: topicBrief?.keywords || [],
          topic_description: topicBrief?.brief || '',
        };

      default:
        return { ctx };
    }
  }

  /**
   * 获取执行报告（用于调试和分析）
   */
  getExecutionReport() {
    return this.executionLog;
  }
}

module.exports = { SkillOrchestrator };
