/**
 * Agent 5 · Skill 6 · platform-scorer.js
 * 10维选题评分 + 平台适配评分
 *
 * 输入：TopicPool + Narrative约束
 * 输出：TopicScore[]（每个选题 × 每个平台）
 */

const PLATFORMS = [
  { id: 'zhihu', name: '知乎', type: '图文', daily_limit: 2 },
  { id: 'wechat_gzh', name: '微信公众号', type: '图文', daily_limit: 1 },
  { id: 'baijiahao', name: '百家号', type: '图文', daily_limit: 1 },
  { id: 'toutiao', name: '今日头条', type: '图文', daily_limit: 1 },
  { id: 'xueqiu', name: '雪球', type: '分析', daily_limit: 1 },
  { id: 'netease', name: '网易新闻', type: '新闻', daily_limit: 1 },
  { id: 'sohu', name: '搜狐号', type: '新闻', daily_limit: 1 },
  { id: 'tencent', name: '腾讯新闻', type: '新闻', daily_limit: 1 },
  { id: 'sina', name: '新浪新闻', type: '新闻', daily_limit: 1 },
  { id: 'ifeng', name: '凤凰新闻', type: '新闻', daily_limit: 1 },
  { id: 'aike短视频', name: '艾氪智能OS（短视频）', type: '短视频', daily_limit: 1 },
  { id: 'jova_video', name: 'JovaAI视频号', type: '视频', daily_limit: 1 }
];

// 10维评分维度
const DIMENSIONS = [
  { id: 'strategy_fit', label: '策略匹配度', weight: 0.20 },
  { id: 'jtbd_strength', label: '客户需求强度', weight: 0.15 },
  { id: 'search_opportunity', label: '搜索机会', weight: 0.10 },
  { id: 'social_heat', label: '社交热度', weight: 0.10 },
  { id: 'differentiation', label: '差异化', weight: 0.10 },
  { id: 'evidence_quality', label: '证据充足度', weight: 0.10 },
  { id: 'platform_fit', label: '平台适配度', weight: 0.10 },
  { id: 'biz_value', label: '商业价值', weight: 0.05 },
  { id: 'risk', label: '风险', weight: 0.05 },
  { id: 'prod_cost', label: '生产成本', weight: 0.05 }
];

/**
 * 主函数
 * @param {Object} opts
 * @param {Array} opts.topics - TopicPool.topics
 * @param {Object} opts.narrativeConstraint - Narrative约束（来自Agent4）
 * @param {Object} opts.platformData - 各平台数据（可选）
 */
function scoreTopics(opts = {}) {
  const { topics = [], narrativeConstraint = {}, platformData = {} } = opts;

  const results = [];

  for (const topic of topics) {
    const platformScores = {};

    for (const platform of PLATFORMS) {
      const scores = scoreTopicOnPlatform(topic, platform, narrativeConstraint, platformData);
      platformScores[platform.id] = scores;
    }

    // 收集每个平台的搜索意图，供 Trend Brief 使用
    const searchIntentMap = {};
    for (const platform of PLATFORMS) {
      searchIntentMap[platform.id] = calcSearchOpportunity(topic, platform);
    }

    results.push({
      topic_id: topic.topic_id,
      title: topic.title,
      search_intent: searchIntentMap,   // 供 Trend Brief 使用
      direction_scores: topic.directions.map(d => ({
        direction_id: d.direction_id,
        content_forms: d.content_forms || [],
        angle_type: d.angle_type || '',
        platform_scores: platformScores
      })),
      best_platform: pickBestPlatform(platformScores),
      platform_ranking: rankPlatforms(platformScores)
    });
  }

  return {
    results,
    dimensions: DIMENSIONS,
    platforms: PLATFORMS.map(p => ({ id: p.id, name: p.name, type: p.type }))
  };
}

/**
 * 对单个选题在单个平台上评分
 */
function scoreTopicOnPlatform(topic, platform, narrativeConstraint, platformData) {
  const scores = {};
  let total = 0;

  // 维度评分
  scores.strategy_fit = calcStrategyFit(topic, narrativeConstraint);
  scores.jtbd_strength = calcJTBDSstrength(topic, narrativeConstraint);
  scores.search_opportunity = calcSearchOpportunity(topic, platform).score;
  scores.social_heat = calcSocialHeat(topic, platform);
  scores.differentiation = calcDifferentiation(topic, platform);
  scores.evidence_quality = calcEvidenceQuality(topic, platform);
  scores.platform_fit = calcPlatformFit(topic, platform, narrativeConstraint);
  scores.biz_value = calcBizValue(topic, platform, narrativeConstraint);
  scores.risk = calcRisk(topic, platform, narrativeConstraint);
  scores.prod_cost = calcProdCost(topic, platform);

  // 加权求和
  for (const dim of DIMENSIONS) {
    const raw = scores[dim.id] || 0;
    // risk和prod_cost是越低越好，反向计算
    let val = raw;
    if (dim.id === 'risk' || dim.id === 'prod_cost') {
      val = (5 - raw) / 5; // 反向：5分风险→0，1分→0.8
    }
    scores[dim.id] = Math.round(val * dim.weight * 100) / 100;
    total += scores[dim.id];
  }

  return {
    dimension_scores: scores,
    total_score: Math.round(total * 100) / 100,
    recommendation: buildRecommendation(topic, platform, scores)
  };
}

/**
 * 策略匹配度（最重要）
 */
function calcStrategyFit(topic, narrativeConstraint) {
  if (!narrativeConstraint || !narrativeConstraint.main_axis) return 3;
  const axis = narrativeConstraint.main_axis;
  const axisWords = axis.split(/[，,、]/).filter(w => w.trim());
  let match = 0;
  for (const word of axisWords) {
    if (topic.title.includes(word) || (topic.core_viewpoint && topic.core_viewpoint.includes(word))) match++;
  }
  const ratio = match / Math.max(axisWords.length, 1);
  if (ratio >= 0.7) return 5;
  if (ratio >= 0.4) return 4;
  if (ratio >= 0.2) return 3;
  return 2;
}

/**
 * 客户需求强度
 */
function calcJTBDSstrength(topic, narrativeConstraint) {
  const target = (narrativeConstraint && narrativeConstraint.target_role) || '企业老板';
  const keywords = {
    '企业老板': ['ROI', '效率', '成本', '决策', '风险', '增长', '落地'],
    'AI从业者': ['模型', 'API', '集成', 'Agent', '工作流', '自动化'],
    '开发者': ['代码', 'SDK', '文档', '部署', 'API', '开源'],
    '创业者': ['融资', '商业', '市场', '竞争', 'Scaling']
  };
  const words = keywords[target] || keywords['企业老板'];
  let score = 3;
  for (const w of words) {
    if (topic.title.includes(w)) score = Math.min(5, score + 0.5);
  }
  return Math.round(score * 10) / 10;
}

/**
 * 搜索意图分析（Search Intent Map）
 * 实现 PRD Section 13 要求的 Search Intent Skill
 *
 * 四类意图：
 * - 导航型（Navigational）：找特定品牌/产品（如"Jova AI官网"）
 * - 信息型（Informational）：学知识（如"Agent是什么"）
 * - 商业型（Commercial）：比较研究（如"Jova vs Coze哪个好"）
 * - 交易型（Transactional）：直接行动（如"Jova AI注册试用"）
 *
 * 同时输出 intent_type 和 intent_strength，用于 Topic Brief 的 SEO/GEO 分析
 */
function calcSearchOpportunity(topic, platform) {
  const title = topic.title || '';
  const contentType = topic.content_type || '';

  // ── 意图类型检测 ────────────────────────────────────────────
  const INTENT_KEYWORDS = {
    '导航型': ['官网', '网站', '登录', '注册地址', '下载', '安装', 'Jova', 'Coze', 'Dify', 'FastGPT', 'Manus'],
    '信息型': ['是什么', '原理', '教程', '怎么用', '如何', '为什么', '哪个好', '对比', '区别', '比较', '评测', '解析', '分析', '入门', '指南', '一文读懂', '全面', '解读', '介绍'],
    '商业型': ['多少钱', '价格', '免费', '收费', '订阅', '企业版', '专业版', 'API价格', '报价', '套餐', '试用', '相比', 'vs', 'Versus', '推荐'],
    '交易型': ['购买', '购买', '付费', '开通', '注册', '试用', '下载App', '获取', '获取优惠', '领取', '申请'],
  };

  // 检测标题意图
  let detectedIntent = '信息型';
  let intentStrength = 3.0;
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const matchCount = keywords.filter(k => title.includes(k)).length;
    if (matchCount > 0) {
      detectedIntent = intent;
      intentStrength = Math.min(5, 3.0 + matchCount * 0.4);
      break;
    }
  }

  // 内容类型也影响意图判断
  if (contentType.includes('教程') || contentType.includes('利他')) {
    detectedIntent = '信息型';
    intentStrength = Math.max(intentStrength, 3.5);
  }
  if (contentType.includes('产品发布')) {
    detectedIntent = '信息型';
    intentStrength = Math.max(intentStrength, 3.5);
  }
  if (contentType.includes('企业案例')) {
    detectedIntent = '商业型';
    intentStrength = Math.max(intentStrength, 4.0);
  }

  // ── 平台×意图 适配矩阵 ─────────────────────────────────────
  // 知乎：信息型最高，商业型次之；不适合纯交易型
  if (platform.id === 'zhihu') {
    if (detectedIntent === '信息型') return { score: Math.min(5, intentStrength + 0.5), intent_type: detectedIntent, intent_strength: intentStrength };
    if (detectedIntent === '商业型') return { score: Math.min(5, intentStrength - 0.3), intent_type: detectedIntent, intent_strength: intentStrength };
    if (detectedIntent === '导航型') return { score: 2.5, intent_type: detectedIntent, intent_strength: intentStrength };
    return { score: 3.0, intent_type: detectedIntent, intent_strength: intentStrength };
  }

  // 公众号：商业型最高，信息型次之；交易型给高分（直接转化）
  if (platform.id === 'wechat_gzh') {
    if (detectedIntent === '商业型') return { score: Math.min(5, intentStrength + 0.5), intent_type: detectedIntent, intent_strength: intentStrength };
    if (detectedIntent === '交易型') return { score: Math.min(5, intentStrength + 0.3), intent_type: detectedIntent, intent_strength: intentStrength };
    if (detectedIntent === '信息型') return { score: intentStrength - 0.3, intent_type: detectedIntent, intent_strength: intentStrength };
    return { score: 3.0, intent_type: detectedIntent, intent_strength: intentStrength };
  }

  // 头条：商业型+信息型；搜索流量大
  if (platform.id === 'toutiao') {
    if (detectedIntent === '商业型' || detectedIntent === '信息型') return { score: Math.min(5, intentStrength + 0.3), intent_type: detectedIntent, intent_strength: intentStrength };
    return { score: 3.0, intent_type: detectedIntent, intent_strength: intentStrength };
  }

  // 百家号：商业型权重高
  if (platform.id === 'baijiahao') {
    if (detectedIntent === '商业型') return { score: Math.min(5, intentStrength + 0.3), intent_type: detectedIntent, intent_strength: intentStrength };
    if (detectedIntent === '信息型') return { score: intentStrength, intent_type: detectedIntent, intent_strength: intentStrength };
    return { score: 3.0, intent_type: detectedIntent, intent_strength: intentStrength };
  }

  // 短视频平台：不适合搜索意图，搜索机会低
  if (platform.type === '短视频' || platform.type === '视频') {
    return { score: 2.0, intent_type: detectedIntent, intent_strength: intentStrength };
  }

  // 新闻类：信息型+商业型都适合
  if (platform.type === '新闻') {
    if (detectedIntent === '信息型') return { score: Math.min(5, intentStrength + 0.3), intent_type: detectedIntent, intent_strength: intentStrength };
    if (detectedIntent === '商业型') return { score: Math.min(5, intentStrength), intent_type: detectedIntent, intent_strength: intentStrength };
    return { score: 3.0, intent_type: detectedIntent, intent_strength: intentStrength };
  }

  return { score: 3.0, intent_type: detectedIntent, intent_strength: intentStrength };
}

/**
 * 社交热度：按内容类型 × 平台特性交叉打分
 * 热点头条 → 知乎/雪球/新闻门户得分高
 * 教程/案例类 → 知乎得高分
 * 新兴技术 → 短视频平台得分高
 */
function calcSocialHeat(topic, platform) {
  const type = topic.content_type || '';
  const title = topic.title || '';

  // 高热度话题信号：热点词 + 社区类来源
  const heatSignals = ['热', '火', '爆发', '爆发', 'Hot', '暴涨'];
  const isHot = heatSignals.some(s => title.includes(s)) ||
    type.includes('热点') || type.includes('资讯');

  // 新兴/实验性话题信号
  const noveltySignals = ['新', '首', '首测', '发布', '开源', '新发布'];
  const isNovel = noveltySignals.some(s => title.includes(s)) ||
    type.includes('论文') || type.includes('研究');

  // 知乎/雪球：高热度 + 教程/案例类话题
  if (['zhihu', 'xueqiu'].includes(platform.id)) {
    if (isHot || type.includes('行业洞察')) return 4.5;
    if (type.includes('教程') || type.includes('案例')) return 4.0;
    if (isNovel || type.includes('论文')) return 3.5;
    return 3.0;
  }

  // 新闻类平台：高热度话题得最高分
  if (platform.type === '新闻') {
    if (isHot) return 4.5;
    if (isNovel) return 4.0;
    if (type.includes('资讯') || type.includes('快讯')) return 4.0;
    return 3.0;
  }

  // 短视频平台：新兴/热点话题适合
  if (['aike短视频', 'jova_video'].includes(platform.id)) {
    if (isNovel || isHot) return 4.5;
    if (type.includes('教程') || type.includes('案例')) return 3.5;
    return 3.0;
  }

  // 公众号/图文：行业洞察类得分高
  if (platform.type === '图文') {
    if (type.includes('行业洞察') || type.includes('案例')) return 4.0;
    if (type.includes('教程')) return 3.5;
    return 3.0;
  }

  return 3.0;
}

/**
 * 差异化：按内容类型 × 平台受众期望交叉打分
 * 知乎/雪球：需要独特视角/一手观点才给高分
 * 新闻类平台：不需要高度差异化
 * 短视频平台：需要反差感/新视角
 */
function calcDifferentiation(topic, platform) {
  const type = topic.content_type || '';
  const title = topic.title || '';

  // 判断话题是否有差异化特征
  const diffSignals = ['对比', '评测', '揭秘', '真相', '背后', 'vs', ' Versus ', '真的', '其实', '老板视角', '反常识', '误区'];
  const hasDiffAngle = diffSignals.some(s => title.includes(s)) ||
    type.includes('对比') || type.includes('评测');

  const genericSignals = ['是什么', '入门', '教程', '如何使用', '一文读懂', '全面'];
  const isGeneric = genericSignals.some(s => title.includes(s));

  if (['zhihu', 'xueqiu'].includes(platform.id)) {
    if (hasDiffAngle) return 4.5;
    if (isGeneric) return 2.5;
    return 3.5;
  }

  if (platform.type === '新闻') {
    // 新闻平台不需要高度差异化，客观陈述为主
    if (hasDiffAngle) return 3.5;
    return 3.5;
  }

  if (['aike短视频', 'jova_video'].includes(platform.id)) {
    // 短视频需要反差/冲突感
    if (hasDiffAngle) return 4.5;
    if (isGeneric) return 2.5;
    return 3.5;
  }

  // 公众号：差异化+深度组合给高分
  if (platform.id === 'wechat_gzh') {
    if (hasDiffAngle && (type.includes('案例') || type.includes('行业洞察'))) return 4.5;
    if (type.includes('案例') || type.includes('行业洞察')) return 4.0;
    return 3.5;
  }

  return 3.0;
}

/**
 * 证据充足度
 */
function calcEvidenceQuality(topic, platform) {
  if (topic.source_signals && topic.source_signals.length >= 3) return 4;
  if (topic.source_signals && topic.source_signals.length >= 1) return 3;
  return 2;
}

/**
 * 平台适配度：按 direction.content_forms × platform.type 交叉打分
 * 核心逻辑：内容形态决定渠道，不是反过来
 * 来自选题Agent的 content_formats 逻辑
 */
function calcPlatformFit(topic, platform, narrativeConstraint) {
  const contentForms = getContentForms(topic);
  const platformId = platform.id;
  const platformType = platform.type;

  // 图文/长文类 content_forms
  if (contentForms.has('图文') || contentForms.has('长文') || contentForms.has('深度文章')) {
    if (platformId === 'zhihu') return 4.5;      // 知乎最适合深度图文
    if (platformId === 'wechat_gzh') return 4.5;  // 公众号适合深度完整叙事
    if (platformId === 'baijiahao') return 4.0;   // 百家号适合较正式图文
    if (platformId === 'toutiao') return 3.5;     // 头条图文适配度一般
    if (platformType === '新闻') return 2.5;      // 新闻平台不适合深度图文
    if (platformType === '短视频' || platformType === '视频') return 1.5;
  }

  // 短视频/视频 content_forms
  if (contentForms.has('短视频') || contentForms.has('视频')) {
    if (platformId === 'aike短视频') return 5.0;  // 艾氪短视频最匹配
    if (platformId === 'jova_video') return 4.5;  // 视频号次之
    if (platformId === 'wechat_gzh') return 2.0; // 公众号不适合纯视频
    if (platformId === 'zhihu') return 2.0;       // 知乎视频适配一般
    if (platformType === '新闻') return 1.5;
  }

  // 社交短帖 content_forms（知乎回答、雪球动态）
  if (contentForms.has('社交短帖')) {
    if (platformId === 'zhihu') return 4.5;    // 知乎回答
    if (platformId === 'xueqiu') return 4.5;    // 雪球
    if (platformId === 'toutiao') return 3.5;   // 头条号动态
    return 3.0;
  }

  // 播客 content_forms → 视频/音频平台
  if (contentForms.has('播客')) {
    if (platformId === 'jova_video') return 4.5;
    if (platformId === 'aike短视频') return 3.5;
    return 2.0;
  }

  // 通用默认值
  return 3.0;
}

/**
 * 获取选题的内容形态集合（合并 topic.content_type 和各 direction.content_forms）
 */
function getContentForms(topic) {
  const forms = new Set();
  if (topic.content_type) {
    // 从 content_type 推断
    const ct = topic.content_type;
    if (ct.includes('图文')) forms.add('图文');
    if (ct.includes('视频') || ct.includes('短视频')) forms.add('短视频');
    if (ct.includes('长文')) forms.add('长文');
    if (ct.includes('播客')) forms.add('播客');
    if (ct.includes('社交')) forms.add('社交短帖');
  }
  // 从 directions 合并
  if (topic.directions) {
    for (const d of topic.directions) {
      if (d.content_forms && Array.isArray(d.content_forms)) {
        for (const f of d.content_forms) forms.add(f);
      }
    }
  }
  return forms;
}

/**
 * 商业价值
 */
function calcBizValue(topic, platform, narrativeConstraint) {
  // 公众号信任属性强，商业价值高
  if (platform.id === 'wechat_gzh') return 4.5;
  if (['aike短视频', 'jova_video'].includes(platform.id)) return 4;
  if (platform.id === 'zhihu') return 3.5;
  return 3;
}

/**
 * 风险
 */
function calcRisk(topic, platform, narrativeConstraint) {
  let risk = 2;
  const forbid = (narrativeConstraint && narrativeConstraint.forbidden_content) || [];
  for (const f of forbid) {
    if (topic.title.includes(f)) risk += 2;
  }
  // 新闻平台风险略高
  if (platform.type === '新闻') risk += 0.5;
  return Math.min(5, risk);
}

/**
 * 生产成本
 */
function calcProdCost(topic, platform) {
  // 短视频生产成本高
  if (platform.type === '短视频' || platform.type === '视频') return 4;
  // 长文生产成本高
  if (topic.content_type === '长文') return 3.5;
  // 新闻类生产成本低
  if (platform.type === '新闻') return 1.5;
  return 2.5;
}

function pickBestPlatform(scores) {
  let best = null;
  let max = -1;
  for (const [pid, s] of Object.entries(scores)) {
    if (s.total_score > max) {
      max = s.total_score;
      best = pid;
    }
  }
  return best;
}

function rankPlatforms(scores) {
  return Object.entries(scores)
    .sort((a, b) => b[1].total_score - a[1].total_score)
    .map(([pid, s]) => ({ platform_id: pid, score: s.total_score }));
}

function buildRecommendation(topic, platform, scores) {
  if (scores.total_score >= 4) return '强推';
  if (scores.total_score >= 3) return '建议';
  if (scores.total_score >= 2) return '可选';
  return '不建议';
}

module.exports = { scoreTopics, PLATFORMS, DIMENSIONS };
