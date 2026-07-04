// skills/skill-selector.js
// P1.2：写作 Skill 路由选择器 v2
// 三元路由：content_type × platform × insertion_type
//
// 不使用 js-yaml（避免依赖），路由配置以内联 JS 给出。
// skill_routes.yml 仍保留作为文档。

// ============ Skill 注册表 ============

/**
 * Skill 注册表
 * 本地 JS Skill：直接 require 路径
 * Jova Skill：格式 'skill::skill-id'（触发 show_ui 调用）
 */
const SKILL_REGISTRY = {
  // ---- 主笔 ----
  'khazix-writer':    'skill::khazix-writer',
  'ljg-writes':       'skill::ljg-writes',
  'hv-analysis':     'skill::hv-analysis',
  'ljg-think':        'skill::ljg-think',
  'ljg-rank':         'skill::ljg-rank',
  'ljg-learn':        'skill::ljg-learn',
  'huashu-douyin-script': 'skill::huashu-douyin-script',
  'kai-write':        'skill::kai-write',
  'kai-topical-map':  'skill::kai-topical-map',

  // ---- 本地 P0 新增 Skill（直接调用）----
  'seo-structure-skill':        { type: 'local', path: './seo-structure-skill' },
  'geo-article-generator':      { type: 'local', path: './geo-article-generator' },
  'geo-article-transformer':    { type: 'local', path: './geo-article-transformer' },
  'evidence-pack-skill':        { type: 'local', path: './evidence-pack-skill' },

  // ---- 待集成 P1 Skill（占位，fallback）----
  'fact-grounding-skill':   { type: 'local', path: './fact-grounding-skill' },
  'source-discovery-skill': { type: 'local', path: './source-discovery-skill' },
  'multi-source-research-skill': { type: 'local', path: './multi-source-research-skill' },
  'brand-policy-reader':  { type: 'local', path: './brand-policy-reader' },

  // ---- 本地 Stub ----
  'local-stub': { type: 'local', path: './writing-stub' },
};

// ============ Fallback 链 ============

const FALLBACK_CHAIN = {
  'khazix-writer':    ['ljg-writes', 'hv-analysis'],
  'ljg-writes':       ['khazix-writer', 'ljg-learn'],
  'hv-analysis':      ['ljg-think', 'ljg-rank'],
  'ljg-think':        ['hv-analysis'],
  'ljg-rank':         ['hv-analysis'],
  'ljg-learn':        ['ljg-writes'],
  'huashu-douyin-script': ['ljg-writes', 'ljg-card'],
  'kai-write':        ['khazix-writer'],
  'kai-topical-map':  ['content-strategy'],
  'seo-structure-skill':     ['ljg-writes'],
  'geo-article-generator':   ['khazix-writer'],
  'geo-article-transformer': ['ljg-writes'],
  'evidence-pack-skill':     ['ljg-writes'],
};

// ============ 路由配置（内联）============

const CONTENT_TYPE_MAP = {
  news: 'deep_long_form', analysis: 'deep_long_form', case_study: 'case_study',
  tutorial: 'technical', opinion: 'opinion', comparison: 'comparison',
  product_promo: 'product_promo', hot_chase: 'quick_social',
};

const MODES = {
  deep_long_form: { primary: 'khazix-writer', aux: ['geo-article-generator','hv-analysis','ljg-think','seo-structure-skill'], description: '公众号/知乎深度' },
  technical:     { primary: 'ljg-writes',     aux: ['ljg-learn','seo-structure-skill'], description: '技术教程/CSDN' },
  quick_social:  { primary: 'huashu-douyin-script', aux: ['geo-article-transformer','ljg-card','seo-structure-skill'], description: '热点/抖音/微博' },
  case_study:   { primary: 'kai-write',       aux: ['hv-analysis','ljg-rank','evidence-pack-skill','geo-article-generator'], description: '案例/视频号/小红书' },
  comparison:   { primary: 'hv-analysis',      aux: ['ljg-think','seo-structure-skill','evidence-pack-skill'], description: '竞品对比/知乎' },
  opinion:      { primary: 'khazix-writer',  aux: ['ljg-learn','geo-article-transformer'], description: '观点文章' },
  product_promo:{ primary: 'kai-write',       aux: ['evidence-pack-skill','geo-article-generator','brand-policy-reader'], description: '品牌硬推广' },
};

const PLATFORM_RULES = {
  zhihu:      { mode: 'technical',     require_seo: true,  require_geo: true,  min_length: 3000 },
  wechat_gzh: { mode: 'deep_long_form', require_seo: false, require_geo: true,  min_length: 2000 },
  csdn:       { mode: 'technical',     require_seo: true,  require_geo: false, min_length: 1500 },
  xiaohongshu:{ mode: 'quick_social',  require_seo: false, require_geo: false, min_length: 800,  max_length: 1000 },
  juejin:     { mode: 'technical',     require_seo: true,  require_geo: false, min_length: 2000 },
  bilibili:   { mode: 'quick_social',  require_seo: false, require_geo: false, min_length: 500 },
};

const INSERTION_RULES = {
  hard:   { aux_add: ['evidence-pack-skill','brand-policy-reader'], seo_mult: 1.2, geo_mult: 1.0 },
  soft:   { aux_add: ['geo-article-transformer','hv-analysis'],       seo_mult: 1.0, geo_mult: 1.3 },
  minimal:{ aux_add: ['ljg-learn'],                               seo_mult: 0.8, geo_mult: 0.8 },
};

// ============ 核心路由函数 ============

/**
 * 三元路由：content_type × platform × insertion_type
 *
 * @param {Object} params
 * @param {string} params.content_type  - news|analysis|case_study|tutorial|opinion|comparison|product_promo|hot_chase
 * @param {string} params.platform     - zhihu|wechat_gzh|csdn|xiaohongshu|juejin|bilibili
 * @param {string} params.insertion_type - soft|hard|minimal
 * @param {Object} [params.topic_brief] - TopicBrief（可选，用于日志）
 * @returns {Object} { primary, aux, seo, geo, mode }
 */
function selectSkills({ content_type, platform, insertion_type, topic_brief } = {}) {
  // 第一维：content_type → 基础模式
  const mode = selectMode(content_type);

  // 第二维：platform → 规则覆盖
  const platformRules = getPlatformRules(platform);

  // 如果 platform 强制指定了 mode，使用平台模式
  const finalMode = platformRules?.mode || mode;

  // 第三维：insertion_type → aux 增强
  const insertionRules = getInsertionRules(insertion_type);

  // 从路由表获取模式配置
  const modeConfig = getModeConfig(finalMode);

  // 构建最终 aux 列表
  const baseAux = modeConfig?.aux || [];
  const addedAux = insertionRules?.aux_add || [];
  // 去重合并
  const aux = [...new Set([...baseAux, ...addedAux])];

  // 确定 SEO / GEO Skill
  const seoSkill = platformRules?.require_seo ? 'seo-structure-skill' : null;
  const geoSkill = platformRules?.require_geo ? 'geo-article-generator' : null;

  const result = {
    primary: modeConfig?.primary || 'khazix-writer',
    aux,
    seo: seoSkill,
    geo: geoSkill,
    mode: finalMode,
    platform,
    insertion_type,
    platform_rules: platformRules || {},
    insertion_rules: insertionRules || {},
    _log: {
      content_type,
      platform,
      insertion_type,
      resolved_mode: finalMode,
      seo_applied: !!seoSkill,
      geo_applied: !!geoSkill,
    },
  };

  return result;
}

/**
 * 根据 content_type 选择基础模式
 */
function selectMode(content_type) {
  return CONTENT_TYPE_MAP[content_type] || 'deep_long_form';
}

/**
 * 获取平台规则（覆盖模式 + 平台约束）
 */
function getPlatformRules(platform) {
  return platform ? (PLATFORM_RULES[platform] || null) : null;
}

/**
 * 获取植入类型规则
 */
function getInsertionRules(insertion_type) {
  return insertion_type ? (INSERTION_RULES[insertion_type] || null) : null;
}

/**
 * 获取模式配置
 */
function getModeConfig(mode) {
  return MODES[mode] || null;
}

// ============ 兼容旧接口 ============

/**
 * 旧接口：selectWritingMode（兼容 agent6-core.js）
 * @deprecated 使用 selectSkills 代替
 */
function selectWritingMode(topicBrief, insertionStrategy) {
  const content_type = topicBrief?.content_type || 'analysis';
  const platform = topicBrief?.platform || 'wechat_gzh';
  const insertion_type = insertionStrategy?.strategy || 'soft';

  const selected = selectSkills({ content_type, platform, insertion_type, topic_brief: topicBrief });
  return selected.mode || 'deep_long_form';
}

/**
 * 旧接口：getPrimarySkill
 */
function getPrimarySkill(mode) {
  const cfg = MODES[mode];
  return cfg?.primary || 'khazix-writer';
}

/**
 * 旧接口：getAuxSkills
 */
function getAuxSkills(mode) {
  const cfg = MODES[mode];
  return cfg?.aux || [];
}

// ============ Skill 执行 ============

/**
 * 解析 Skill 注册表条目
 */
function resolveSkill(skillId) {
  const entry = SKILL_REGISTRY[skillId];
  if (!entry) return { type: 'unknown' };

  if (typeof entry === 'string') {
    if (entry === 'fallback:ljg-writes') return { type: 'fallback', to: 'ljg-writes' };
    if (entry.startsWith('skill::')) return { type: 'jova', skillId: entry.replace('skill::', '') };
    return { type: 'unknown' };
  }

  if (entry.type === 'local') return { type: 'local', path: entry.path };
  return { type: 'unknown' };
}

/**
 * 执行单个 Skill
 * @param {string} skillId
 * @param {Object} params
 * @returns {Promise<any>}
 */
async function runSkill(skillId, params) {
  const resolved = resolveSkill(skillId);

  if (resolved.type === 'local') {
    const mod = require(resolved.path);
    return typeof mod.run === 'function' ? mod.run(params) : mod(params);
  }

  if (resolved.type === 'jova') {
    const err = new Error(`JOVA_SKILL_REQ:${resolved.skillId}`);
    err.code = 'JOVA_SKILL_REQUIRED';
    err.skillId = resolved.skillId;
    err.params = params;
    throw err;
  }

  if (resolved.type === 'fallback') {
    console.warn(`[skill-selector] ${skillId} not available, using fallback ${resolved.to}`);
    return runSkill(resolved.to, params);
  }

  throw new Error(`[skill-selector] unknown skill: ${skillId}`);
}

/**
 * 执行 Skill 并自动 fallback
 * @param {string} primarySkill
 * @param {Object} params
 * @returns {Promise<any>}
 */
async function runSkillWithFallback(primarySkill, params) {
  const chain = [primarySkill, ...(FALLBACK_CHAIN[primarySkill] || [])];

  let lastError;
  for (const skillId of chain) {
    try {
      return await runSkill(skillId, params);
    } catch (err) {
      if (err.code === 'JOVA_SKILL_REQUIRED') throw err; // Jova Skill 报错直接抛
      lastError = err;
      console.warn(`[skill-selector] ${skillId} failed: ${err.message}, trying fallback...`);
    }
  }

  throw lastError || new Error(`[skill-selector] all skills failed for ${primarySkill}`);
}

// ============ CLI 路由测试 ============

if (require.main === module) {
  const testCases = [
    { content_type: 'analysis', platform: 'zhihu', insertion_type: 'soft' },
    { content_type: 'analysis', platform: 'zhihu', insertion_type: 'hard' },
    { content_type: 'case_study', platform: 'xiaohongshu', insertion_type: 'soft' },
    { content_type: 'tutorial', platform: 'csdn', insertion_type: 'soft' },
    { content_type: 'opinion', platform: 'wechat_gzh', insertion_type: 'hard' },
    { content_type: 'product_promo', platform: 'zhihu', insertion_type: 'hard' },
  ];

  console.log('\n🔀 Skill Selector 路由测试\n');
  console.log('─'.repeat(70));

  for (const tc of testCases) {
    const result = selectSkills(tc);
    console.log(`\n📋 ${tc.content_type} × ${tc.platform} × ${tc.insertion_type}`);
    console.log(`   模式: ${result.mode}`);
    console.log(`   主笔: ${result.primary}`);
    console.log(`   辅笔: ${result.aux.join(', ') || '（无）'}`);
    console.log(`   SEO:   ${result.seo || '（不需要）'}`);
    console.log(`   GEO:   ${result.geo || '（不需要）'}`);
    if (result.platform_rules?.min_length) {
      console.log(`   平台要求: ≥${result.platform_rules.min_length}字`);
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log('✅ 路由测试完成\n');
}

module.exports = {
  // 核心三元路由
  selectSkills,
  // 兼容旧接口
  selectWritingMode,
  getPrimarySkill,
  getAuxSkills,
  // 执行
  runSkill,
  runSkillWithFallback,
  resolveSkill,
  // 路由配置（常量）
  CONTENT_TYPE_MAP,
  MODES,
  PLATFORM_RULES,
  INSERTION_RULES,
};
