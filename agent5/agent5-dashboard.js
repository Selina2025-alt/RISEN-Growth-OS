#!/usr/bin/env node
/**
 * Agent 5 Dashboard
 */
const { runAgent5 } = require('./agent5-core');

const c = {
  cyan:   s => `\x1b[36m${s}\x1b[0m`,
  gray:   s => `\x1b[90m${s}\x1b[0m`,
  white:  s => s,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  red:    s => `\x1b[31m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`
};

const MOCK_SIGNALS = [
  { id: 'SIG-001', type: 'aihot', title: 'Claude Code 编程 Agent 持续火爆，企业落地成为新瓶颈', weight: 1.2, content_type: '行业洞察' },
  { id: 'SIG-002', type: 'follow-builders', title: 'OpenAI 高管谈 Agent 标准：可靠性是关键', weight: 1.1, content_type: '行业洞察' },
  { id: 'SIG-003', type: 'aihot', title: 'Manus 发布后用户反馈：上手容易但企业集成难', weight: 1.0, content_type: '用户反馈' },
  { id: 'SIG-004', type: 'arxiv', title: 'arXiv 新论文：Agent 记忆模块的 4 种主流方案对比', weight: 0.9, content_type: '论文研究' },
  { id: 'SIG-005', type: 'social', title: '知乎热帖：AI Agent 落地到底卡在哪里？', weight: 1.3, content_type: '社区讨论' },
  { id: 'SIG-006', type: 'tech-news', title: '百度发布企业级 Agent 开发平台', weight: 0.8, content_type: '产品发布' },
  { id: 'SIG-007', type: 'competitor', title: 'Coze 企业版发布，定位对标 Jova AI', weight: 1.0, content_type: '竞品动态' },
  { id: 'SIG-008', type: 'manual', title: '客户访谈：制造业 AI 质检 Agent 落地复盘', weight: 1.4, content_type: '企业案例' }
];

async function runDashboard() {
  console.log(c.cyan('\n========== Agent 5 · 趋势与选题智能体 ==========\n'));
  console.log(c.gray('信号: ') + MOCK_SIGNALS.length + ' 个\n');

  let result;
  try {
    const fs = require('fs');
    const outPath = __dirname + '/mock-data/agent5-complete-output.json';
    if (fs.existsSync(outPath)) {
      result = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      console.log(c.yellow('[ Dashboard ] 读取已有输出\n'));
    } else {
      throw new Error('no file');
    }
  } catch {
    result = await runAgent5({ signals: MOCK_SIGNALS });
  }

  const pool = (result.topic_pool || {}).topics || [];
  const routes = (result.distribution_map || {}).routes || [];
  const cal = (result.editorial_calendar || {}).calendar || {};
  const threeRoutes = routes.filter(r => r.account_role);
  const topResult = ((result.topic_scores || {}).results || [])[0];
  const brief = (result.topic_brief || {}).brief;

  // 1. 选题概览
  console.log(c.cyan('【1】选题池概览'));
  console.log(c.gray('─').repeat(55));
  const hi = pool.filter(t => t.total_score >= 3.5).length;
  const md = pool.filter(t => t.total_score >= 2.5 && t.total_score < 3.5).length;
  const lo = pool.filter(t => t.total_score < 2.5).length;
  console.log('  ' + c.white('总选题: ') + c.bold(pool.length) + c.white(' 个  |  总方向: ') + c.bold(pool.reduce((s, t) => s + t.directions.length, 0)) + c.white(' 个'));
  console.log('  ' + c.green('高优:') + hi + '  ' + c.yellow('中优:') + md + '  ' + c.gray('低优:') + lo + '\n');
  for (const topic of pool.slice(0, 6)) {
    const sc = topic.total_score >= 3.5 ? 'green' : topic.total_score >= 2.5 ? 'yellow' : 'gray';
    console.log('  ' + c.white(topic.topic_id) + ' ' + c[sc]('[' + topic.total_score.toFixed(1) + ']') + ' ' + topic.title.substring(0, 42));
    for (const d of topic.directions.slice(0, 2)) {
      console.log('    ' + c.gray(d.direction_id) + ' ' + d.angle_type + ' -> ' + d.content_forms.join('/'));
    }
  }

  // 2. 平台评分
  console.log(c.cyan('\n【2】平台评分热力（TOP选题）'));
  console.log(c.gray('─').repeat(55));
  const pNames = { zhihu:'知乎', wechat_gzh:'公众号', baijiahao:'百家号', aike短视频:'艾氪短视频', jova_video:'视频号', toutiao:'头条', xueqiu:'雪球', netease:'网易', sohu:'搜狐', tencent:'腾讯', sina:'新浪', ifeng:'凤凰' };
  if (topResult && topResult.platform_ranking) {
    for (const p of topResult.platform_ranking.slice(0, 6)) {
      const score = p.score;
      const barLen = Math.max(0, Math.round(score * 4));
      const bar = '\u2588'.repeat(barLen) + '\u2591'.repeat(Math.max(0, 20 - barLen));
      const col = score >= 3 ? 'green' : score >= 2 ? 'yellow' : 'gray';
      console.log('  ' + c.white((pNames[p.platform_id] || p.platform_id).padEnd(8)) + c[col](bar) + ' ' + score.toFixed(2));
    }
  }

  // 3. 三账号分发路由
  console.log(c.cyan('\n【3】三账号分发路由'));
  console.log(c.gray('─').repeat(55));
  const roleTag = { awareness: '[awareness]', trust: '[trust]', conversion: '[conversion]' };
  for (const r of threeRoutes.slice(0, 9)) {
    const pc = r.priority === 'P0' ? 'green' : r.priority === 'P1' ? 'yellow' : 'gray';
    console.log('  ' + c.white(r.topic_id) + c.gray('/') + c.white(r.direction_id) + '  ' + c.cyan(roleTag[r.account_role] || r.account_role) + '  ' + c[pc](r.priority) + '  -> ' + r.target_account + ' (' + r.content_form + ')');
  }

  // 4. 内容日历
  console.log(c.cyan('\n【4】内容日历'));
  console.log(c.gray('─').repeat(55));
  for (const date of Object.keys(cal).sort().slice(0, 5)) {
    const info = cal[date];
    const slots = (info.slots || []).map(s => s.time + ' ' + (pNames[s.platform_id] || s.platform_id)).join(' | ');
    console.log('  ' + c.white(date) + ' ' + c.gray(info.weekday) + '  ' + (slots ? c.yellow(slots) : c.gray('无')));
  }

  // 5. Topic Brief
  if (brief) {
    console.log(c.cyan('\n【5】Topic Brief 示例'));
    console.log(c.gray('─').repeat(55));
    console.log('  ' + c.white('Brief:') + ' ' + c.green(brief.brief_id));
    console.log('  ' + c.white('选题:') + ' ' + brief.meta.topic_title);
    console.log('  ' + c.white('方向:') + ' ' + brief.meta.direction_id + ' -- ' + brief.meta.direction_title);
    const suff = brief.evidence_sufficiency;
    const sc = suff && suff.level === 'sufficient' ? 'green' : suff && suff.level === 'adequate' ? 'yellow' : 'red';
    const sMsg = suff ? suff.message + ' (' + suff.score + '/5)' : '未知';
    console.log('  ' + c.white('证据:') + ' ' + c[sc](sMsg));
  }

  // 6. 验证清单
  console.log(c.cyan('\n【6】验证清单'));
  console.log(c.gray('─').repeat(55));
  const checks = [
    ['选题数>=5', pool.length >= 5],
    ['每题>=5方向', pool.length > 0 && pool.every(t => t.directions.length >= 5)],
    ['平台评分完成', ((result.topic_scores || {}).results || []).length >= 5],
    ['三账号分发路由', threeRoutes.length >= 3],
    ['日历>=7天', Object.keys(cal).length >= 7],
    ['Topic Brief生成', !!brief],
  ];
  for (const [label, pass] of checks) {
    console.log('  ' + (pass ? c.green('PASS') : c.red('FAIL')) + '  ' + label);
  }

  console.log(c.cyan('\n========== Dashboard Complete =========='));
  console.log(c.gray('输出: mock-data/agent5-complete-output.json\n'));
}

runDashboard().catch(e => { console.error(e.message); process.exit(1); });
