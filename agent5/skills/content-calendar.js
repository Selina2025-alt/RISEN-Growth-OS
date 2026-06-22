/**
 * Agent 5 · Skill 7 · content-calendar.js
 * 日粒度全平台分发计划
 *
 * 输入：DistributionMap + Strategy Card渠道组合
 * 输出：EditorialCalendar（日粒度 × 全平台 × 选题）
 */

const { getDefaultRules } = require('./distribution-router');

const DEFAULT_DAILY_SLOTS = {
  '09:00': ['zhihu', 'baijiahao', 'toutiao'],
  '10:00': ['netease', 'sohu'],
  '11:00': ['tencent', 'sina', 'ifeng'],
  '12:00': ['aike短视频'],
  '14:00': ['xueqiu'],
  '15:00': ['wechat_gzh'],
  '18:00': ['jova_video']
};

const PLATFORM_NAMES = {
  'zhihu': '知乎', 'wechat_gzh': '微信公众号', 'baijiahao': '百家号',
  'toutiao': '今日头条', 'xueqiu': '雪球', 'netease': '网易新闻',
  'sohu': '搜狐号', 'tencent': '腾讯新闻', 'sina': '新浪新闻',
  'ifeng': '凤凰新闻', 'aike短视频': '艾氪智能OS（短视频）',
  'jova_video': 'JovaAI视频号'
};

/**
 * 主函数
 * @param {Object} opts
 * @param {Array} opts.routes - routeDistribution()输出
 * @param {number} opts.horizonDays - 日历向前几天，默认7天
 * @param {Object} opts.distributionRules - 分发规则（用于日历排期约束）
 */
function buildContentCalendar(opts = {}) {
  const { routes = [], horizonDays = 7, distributionRules = {} } = opts;

  const rules = distributionRules._version ? distributionRules : getDefaultRules();
  const days = generateDays(horizonDays);

  // 按平台分组，看每个平台每天发什么
  const calendar = {};
  const platformDailyCount = {};

  for (const day of days) {
    const dateKey = day.date; // 'YYYY-MM-DD'
    calendar[dateKey] = { date: dateKey, weekday: day.weekday, slots: [] };

    for (const [slotTime, slotPlatforms] of Object.entries(DEFAULT_DAILY_SLOTS)) {
      for (const platformId of slotPlatforms) {
        // 找这个平台在这个slot可以发的最高优先级路由
        const candidates = routes.filter(r => {
          if (r.target_platform !== platformId) return false;
          if (r._date === dateKey) return false; // 已有
          if (r._published) return false;

          // 检查日更上限
          const todayCount = platformDailyCount[`${dateKey}:${platformId}`] || 0;
          const dailyLimit = rules.platform_weights[platformId]?.max_daily || 1;
          return todayCount < dailyLimit;
        });

        if (candidates.length === 0) continue;

        // 取最优路由：先按优先级排序，同优先级按得分
        const priorityOrder = { P0: 0, P1: 1, P2: 2 };
        candidates.sort((a, b) => {
          const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (pd !== 0) return pd;
          return b.score - a.score; // 同优先级按得分降序
        });
        const best = candidates[0];

        calendar[dateKey].slots.push({
          time: slotTime,
          platform_id: best.target_platform,
          platform_name: PLATFORM_NAMES[best.target_platform] || best.target_platform,
          topic_id: best.topic_id,
          direction_id: best.direction_id,
          content_form: best.content_form,
          priority: best.priority,
          score: best.score,
          account: best.target_account,
          repurposing_chain: best.repurposing_chain || null
        });

        // 标记已排
        best._date = dateKey;
        best._published = true;
        platformDailyCount[`${dateKey}:${platformId}`] = (platformDailyCount[`${dateKey}:${platformId}`] || 0) + 1;
      }
    }
  }

  // 未排期的路由（overflow）
  const overflow = routes.filter(r => !r._date && !r._published);

  return {
    calendar,
    overflow_routes: overflow,
    summary: buildCalendarSummary(calendar),
    rules_version: rules._version
  };
}

/**
 * 生成指定天数的日期列表
 */
function generateDays(horizonDays) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      date: d.toISOString().split('T')[0],
      weekday: WEEKDAYS[d.getDay()]
    });
  }
  return days;
}

const WEEKDAYS = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/**
 * 构建日历摘要
 */
function buildCalendarSummary(calendar) {
  const dateKeys = Object.keys(calendar).sort();
  const platformCount = {};
  const formCount = {};
  const priorityCount = { P0: 0, P1: 0, P2: 0 };

  for (const dk of dateKeys) {
    for (const slot of calendar[dk].slots) {
      platformCount[slot.platform_name] = (platformCount[slot.platform_name] || 0) + 1;
      formCount[slot.content_form] = (formCount[slot.content_form] || 0) + 1;
      priorityCount[slot.priority] = (priorityCount[slot.priority] || 0) + 1;
    }
  }

  return {
    total_days: dateKeys.length,
    total_publishes: dateKeys.reduce((s, k) => s + calendar[k].slots.length, 0),
    platform_distribution: platformCount,
    content_form_distribution: formCount,
    priority_distribution: priorityCount
  };
}

/**
 * 渲染成可读Markdown
 */
function renderCalendarMarkdown(calendarResult) {
  const { calendar, overflow_routes, summary } = calendarResult;
  const lines = ['# 内容日历\n'];

  lines.push(`**规则版本**: ${summary.rules_version}  **总计发布**: ${summary.total_publishes}条\n`);

  for (const [date, info] of Object.entries(calendar).sort()) {
    lines.push(`\n## ${date} ${info.weekday}\n`);
    if (info.slots.length === 0) {
      lines.push('_暂无安排_');
      continue;
    }
    lines.push('| 时间 | 平台 | 账号 | 选题 | 方向 | 形式 | 优先级 |');
    lines.push('|------|------|------|------|------|------|------|');
    for (const s of info.slots) {
      lines.push(`| ${s.time} | ${s.platform_name} | ${s.account} | ${s.topic_id} | ${s.direction_id} | ${s.content_form} | ${s.priority} |`);
    }
  }

  if (overflow_routes.length > 0) {
    lines.push('\n## 待排期（超出日历容量）\n');
    for (const r of overflow_routes) {
      lines.push(`- ${r.topic_id} ${r.direction_id} → ${PLATFORM_NAMES[r.target_platform]}（${r.priority}）`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  buildContentCalendar,
  renderCalendarMarkdown,
  generateDays,
  DEFAULT_DAILY_SLOTS
};
