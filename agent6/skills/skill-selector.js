// skills/skill-selector.js
// P1.2：写作 Skill 路由选择器（主笔+辅笔模式）

const fs = require('fs');
const path = require('path');

/**
 * 写作模式配置
 * primary: 主笔 Skill（必须成功）
 * aux: 辅笔 Skill（并发执行，结果合并到主笔）
 * fallback: 所有 Skill 失败时的降级
 */
const WRITING_MODES = {
  deep_long_form: {
    primary: 'khazix-writer',
    aux: ['hv-analysis', 'ljg-think'],
    fallback: 'ljg-writes',
    description: '公众号深度长文'
  },
  quick_social: {
    primary: 'huashu-douyin-script',
    aux: ['ljg-card'],
    fallback: 'ljg-writes',
    description: '短视频脚本/小红书'
  },
  technical: {
    primary: 'ljg-writes',
    aux: ['hv-analysis', 'ljg-rank'],
    fallback: 'khazix-writer',
    description: '知乎/技术博客'
  },
  marketing: {
    primary: 'kai-write',
    aux: ['kai-topical-map'],
    fallback: 'khazix-writer',
    description: '转化类内容'
  }
};

/**
 * Skill 路由表（skill_id → 本地 JS 模块或 Jova Skill ID）
 * 本地 JS：require() 相对路径
 * Jova Skill：格式 'skill::khazix-writer'
 */
const SKILL_REGISTRY = {
  'khazix-writer': 'skill::khazix-writer',           // Jova Skill（公众号长文）
  'ljg-writes': 'skill::ljg-writes',                   // Jova Skill（通用框架）
  'hv-analysis': 'skill::hv-analysis',               // Jova Skill（深度分析）
  'ljg-think': 'skill::ljg-think',                    // Jova Skill（观点锐化）
  'ljg-rank': 'skill::ljg-rank',                      // Jova Skill（亮点提炼）
  'ljg-card': 'skill::ljg-card',                      // Jova Skill（配图卡）
  'huashu-douyin-script': 'skill::huashu-douyin-script', // Jova Skill（短视频脚本）
  'kai-write': 'skill::kai-write',                     // Jova Skill（营销内容）
  'kai-topical-map': 'skill::kai-topical-map',         // Jova Skill（SEO主题图）
  // 本地 Stub（开发阶段）
  'local-stub': require('./writing-stub')
};

// Skill 失败时的降级映射
const SKILL_FALLBACKS = {
  'khazix-writer': ['ljg-writes'],
  'ljg-writes': ['khazix-writer'],
  'hv-analysis': [],
  'ljg-think': [],
  'ljg-rank': [],
  'ljg-card': [],
  'huashu-douyin-script': ['ljg-writes'],
  'kai-write': ['khazix-writer'],
  'kai-topical-map': []
};

/**
 * 根据 topic 和 context 选择写作模式
 * @param {Object} topicBrief
 * @param {Object} insertionStrategy
 * @returns {string} mode name
 */
function selectWritingMode(topicBrief, insertionStrategy) {
  const contentType = topicBrief.content_type || 'analysis';
  const strategy = insertionStrategy?.strategy || 'soft';

  // content_type 优先
  const typeMap = {
    'news': 'deep_long_form',
    'analysis': 'technical',
    'case_study': 'marketing',
    'tutorial': 'technical'
  };

  // hard 策略优先用营销模式（转化导向）
  if (strategy === 'hard' && contentType === 'analysis') {
    return 'marketing';
  }

  return typeMap[contentType] || 'deep_long_form';
}

/**
 * 获取某个模式的 primary skill
 */
function getPrimarySkill(mode) {
  const cfg = WRITING_MODES[mode];
  return cfg ? cfg.primary : 'khazix-writer';
}

/**
 * 获取某个模式的辅笔 skills
 */
function getAuxSkills(mode) {
  const cfg = WRITING_MODES[mode];
  return cfg ? (cfg.aux || []) : [];
}

/**
 * 获取降级技能链
 */
function getFallbackChain(primarySkill) {
  return SKILL_FALLBACKS[primarySkill] || [];
}

/**
 * 执行写作 Skill
 * 目前优先使用本地 Stub，Jova Skill 接入后替换
 * @param {string} skillId
 * @param {Object} params - { topicBrief, insertionStrategy, companyName }
 * @returns {Promise<string>} 写作内容
 */
async function runWritingSkill(skillId, params) {
  const { topicBrief, insertionStrategy, companyName } = params;

  const registryEntry = SKILL_REGISTRY[skillId];

  // 本地 Stub
  if (skillId === 'local-stub' || typeof registryEntry === 'function') {
    const fn = typeof registryEntry === 'function' ? registryEntry : registryEntry;
    return fn(topicBrief, insertionStrategy, companyName);
  }

  // Jova Skill（show_ui 触发）
  if (registryEntry && registryEntry.startsWith('skill::')) {
    // TODO: 通过 Jova skill 调用机制执行
    // 目前降级到 stub
    console.warn(`[skill-selector] Jova skill ${skillId} not yet integrated, using stub`);
    const stub = SKILL_REGISTRY['local-stub'];
    return stub(topicBrief, insertionStrategy, companyName);
  }

  // 未知 skill
  throw new Error(`[skill-selector] unknown skill: ${skillId}`);
}

module.exports = {
  WRITING_MODES,
  SKILL_REGISTRY,
  SKILL_FALLBACKS,
  selectWritingMode,
  getPrimarySkill,
  getAuxSkills,
  getFallbackChain,
  runWritingSkill
};
