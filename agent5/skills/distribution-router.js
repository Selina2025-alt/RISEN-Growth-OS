/**
 * Agent 5 · Skill 10 · distribution-router.js
 * 三账号 + 全平台分发路由
 *
 * 输入：TopicScore + Narrative约束 + 三账号规则
 * 输出：DistributionMap（每个选题方向 → 目标平台 × 账号 × 内容形式）
 */

const { PLATFORMS } = require('./platform-scorer');

const THREE_ACCOUNTS = {
  awareness: {
    id: 'aike短视频',
    name: '艾氪智能OS',
    role: 'awareness',
    forms: ['短视频'],
    constraint: {
      max_daily: 1,
      product_exposure_ratio: '<10%',
      focus: '行业解释权，轻产品露出'
    }
  },
  trust: {
    id: 'wechat_gzh',
    name: '公众号',
    role: 'trust',
    forms: ['图文', '长文'],
    constraint: {
      max_daily: 1,
      max_weekly: 3,
      focus: '深度完整叙事，可复用资产'
    }
  },
  conversion: {
    id: 'jova_video',
    name: 'JovaAI视频号',
    role: 'conversion',
    forms: ['视频'],
    constraint: {
      max_daily: 1,
      max_weekly: 3,
      focus: '产品化叙事，真实场景+量化结果+明确CTA'
    }
  }
};

const REPURPOSING_RULES = {
  trigger_threshold: {
    engagement_rate: 0.05,  // 5%互动率触发深化
    views: 5000,
    positive_signals: 3
  },
  repurposing_chain: [
    { from: '图文平台高反馈', to: '公众号深化', action: 'deepen_to_gzh' },
    { from: '公众号深化', to: '多角度图文平台', action: 'multi_angle_repost' },
    { from: '公众号深化', to: '短视频', action: 'extract_short_video_angle' }
  ]
};

/**
 * 主函数
 * @param {Object} opts
 * @param {Array} opts.topicScores - scoreTopics()输出
 * @param {Object} opts.narrativeConstraint - Narrative约束（来自Agent4）
 * @param {Object} opts.distributionRules - 分发规则（可动态调整）
 */
function routeDistribution(opts = {}) {
  const { topicScores = [], narrativeConstraint = {}, distributionRules = {} } = opts;

  // 合并默认规则和用户可调规则
  const rules = deepMerge(getDefaultRules(), distributionRules);

  const routes = [];

  for (const item of topicScores) {
    const { topic_id, title, direction_scores } = item;

    for (const ds of direction_scores || []) {
      const { direction_id, platform_scores } = ds;

      // 排序平台：得分最高的最优
      const ranked = Object.entries(platform_scores || {})
        .sort((a, b) => b[1].total_score - a[1].total_score)
        .map(([pid, s]) => ({ platform_id: pid, score: s.total_score, recommendation: s.recommendation }));

      // 方向内相对排名 → 优先级
      const calcPriority = (rank) => {
        if (rank <= 1) return 'P0';   // 第1名
        if (rank <= 3) return 'P1';   // 第2-3名
        return 'P2';                   // 其余
      };

      // ① 三账号路由
      for (const [role, account] of Object.entries(THREE_ACCOUNTS)) {
        const fit = ranked.find(r => r.platform_id === account.id);
        if (!fit) continue;
        const allowed = checkDistributionRules(ranked, role, rules, routes);
        if (!allowed) continue;
        const rank = ranked.findIndex(r => r.platform_id === account.id);
        routes.push({
          topic_id,
          direction_id,
          target_platform: account.id,
          target_account: account.name,
          account_role: role,
          content_form: pickContentForm(ds, account),
          score: fit.score,
          priority: calcPriority(rank),
          repurposing_chain: buildRepurposingChain(ds, role),
          recommendation: fit.recommendation
        });
      }

      // ② 图文/新闻平台路由（按 content_forms 匹配，不受三账号日更容量限制）
      const directionForms = ds.content_forms || ['图文'];
      for (const platform of PLATFORMS) {
        const pid = platform.id;
        // 跳过三账号，它们在①处理
        if (['aike短视频', 'wechat_gzh', 'jova_video'].includes(pid)) continue;
        const fit = ranked.find(r => r.platform_id === pid);
        if (!fit) continue;
        // 内容形式匹配
        const is图文 = platform.type === '图文';
        const is视频 = platform.type === '短视频' || platform.type === '视频';
        if (is图文 && !directionForms.some(f => ['图文', '长文', '深度文章'].includes(f))) continue;
        if (is视频 && !directionForms.some(f => ['短视频', '视频'].includes(f))) continue;
        const rank = ranked.findIndex(r => r.platform_id === pid);
        routes.push({
          topic_id,
          direction_id,
          target_platform: pid,
          target_account: platform.name,
          account_role: null,
          content_form: is图文 ? '图文' : is视频 ? '短视频' : '资讯',
          score: fit.score,
          priority: calcPriority(rank),
          repurposing_chain: null,
          recommendation: fit.recommendation
        });
      }
    }
  }

  // 按优先级排序
  const sorted = routes.sort((a, b) => {
    const priorityOrder = { P0: 0, P1: 1, P2: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return {
    routes: sorted,
    rules_version: rules._version,
    three_accounts: THREE_ACCOUNTS,
    repurposing_triggers: REPURPOSING_RULES.trigger_threshold
  };
}

function checkDistributionRules(ranked, role, rules, existingRoutes) {
  const today = new Date().toISOString().split('T')[0];
  const todayRoutes = existingRoutes.filter(r =>
    r.target_account === THREE_ACCOUNTS[role].name &&
    r._date === today
  );

  // 检查日更上限
  const dailyLimit = rules.platform_weights[THREE_ACCOUNTS[role].id]?.max_daily || 1;
  if (todayRoutes.length >= dailyLimit) return false;

  // 检查周更上限
  const weekKey = getWeekKey();
  const weekRoutes = existingRoutes.filter(r =>
    r.target_account === THREE_ACCOUNTS[role].name &&
    r._week === weekKey
  );
  const weeklyLimit = rules.platform_weights[THREE_ACCOUNTS[role].id]?.max_weekly || 3;
  if (weekRoutes.length >= weeklyLimit) return false;

  return true;
}

function pickContentForm(directionScore, account) {
  const accountForms = Array.isArray(account.forms) ? account.forms : ['图文'];
  if (accountForms.length === 0) return '图文';
  return accountForms[0];
}

function buildRepurposingChain(directionScore, triggeredByRole) {
  const chains = [];

  // 账号触发深化链
  if (triggeredByRole === 'awareness') {
    chains.push({
      trigger: '视频互动率>阈值',
      action: 'deepen_to_gzh',
      from: '艾氪短视频',
      to: '公众号',
      reason: '高互动内容值得深化为完整叙事'
    });
  }

  if (triggeredByRole === 'trust') {
    chains.push({
      trigger: '文章看完率高+收藏多',
      action: 'multi_angle_repost',
      from: '公众号',
      to: '知乎/头条/百家号',
      reason: '优质内容多角度再分发'
    });
    chains.push({
      trigger: '文章提到具体产品场景',
      action: 'extract_short_video_angle',
      from: '公众号',
      to: 'JovaAI视频号',
      reason: '从文章提炼短视频角度'
    });
  }

  return chains;
}

function getDefaultRules() {
  return {
    _version: '1.0.0',
    _updated: new Date().toISOString(),
    platform_weights: {
      'aike短视频': { weight: 0.25, max_daily: 1, max_weekly: 7, priority: 'P0' },
      'wechat_gzh': { weight: 0.20, max_daily: 1, max_weekly: 3, priority: 'P0' },
      'jova_video': { weight: 0.15, max_daily: 1, max_weekly: 3, priority: 'P0' },
      'zhihu': { weight: 0.13, max_daily: 2, max_weekly: 14, priority: 'P1' },
      'baijiahao': { weight: 0.10, max_daily: 1, max_weekly: 7, priority: 'P1' },
      'toutiao': { weight: 0.06, max_daily: 1, max_weekly: 7, priority: 'P2' },
      'xueqiu': { weight: 0.06, max_daily: 1, max_weekly: 7, priority: 'P2' },
      'netease': { weight: 0.05, max_daily: 1, max_weekly: 7, priority: 'P2' },
      'sohu': { weight: 0.05, max_daily: 1, max_weekly: 7, priority: 'P2' },
      'tencent': { weight: 0.05, max_daily: 1, max_weekly: 7, priority: 'P2' },
      'sina': { weight: 0.05, max_daily: 1, max_weekly: 7, priority: 'P2' },
      'ifeng': { weight: 0.05, max_daily: 1, max_weekly: 7, priority: 'P2' }
    },
    content_type_ratio: {
      '案例拆解': 0.30,
      '方法论': 0.25,
      '行业洞察': 0.25,
      '资讯快讯': 0.20
    }
  };
}

function getWeekKey() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * 更新分发规则（用户说"知乎降到周更"时调用这个）
 * @param {Object} currentRules
 * @param {Object} changes - 用户想要的改动
 * @param {string} changes.platform - 哪个平台
 * @param {number} changes.max_daily - 新的日更上限
 */
function updateDistributionRules(currentRules, changes) {
  const platform = changes.platform;
  if (!currentRules.platform_weights[platform]) {
    throw new Error(`未知平台: ${platform}`);
  }

  const updated = deepMerge(currentRules, {
    platform_weights: {
      [platform]: {
        weight: changes.weight !== undefined ? changes.weight : currentRules.platform_weights[platform].weight,
        max_daily: changes.max_daily !== undefined ? changes.max_daily : currentRules.platform_weights[platform].max_daily,
        max_weekly: changes.max_weekly !== undefined ? changes.max_weekly : currentRules.platform_weights[platform].max_weekly
      }
    },
    _version: String(parseFloat(currentRules._version || '1.0') + 0.01),
    _updated: new Date().toISOString()
  });

  return updated;
}

module.exports = {
  routeDistribution,
  updateDistributionRules,
  getDefaultRules,
  THREE_ACCOUNTS,
  REPURPOSING_RULES
};
