/**
 * Agent 5 Core · 趋势与选题智能体
 *
 * Pipeline: Skill5 → Skill6 → Skill10 → Skill7 → Skill8 → Skill9
 *
 * 输入: Agent4 Narrative约束 + Mock选题信号
 * 输出: TopicPool + TopicScore + DistributionMap + EditorialCalendar + TopicBrief
 */

const { generateTopicCluster } = require('./skills/topic-cluster');
const { scoreTopics } = require('./skills/platform-scorer');
const { routeDistribution, updateDistributionRules } = require('./skills/distribution-router');
const { buildContentCalendar, renderCalendarMarkdown } = require('./skills/content-calendar');
const { buildTopicBrief } = require('./skills/topic-brief-builder');
const { collectResources } = require('./skills/resource-collector');

const fs = require('fs');
const path = require('path');

// ─── 默认输入（来自Agent4的Narrative约束）─────────────────────────────

const DEFAULT_NARRATIVE = {
  main_axis: 'Jova AI：让企业 AI 落地不再困难',
  account_roles: {
    '艾氪智能OS（短视频）': 'awareness',
    '公众号': 'trust',
    'JovaAI视频号': 'conversion'
  },
  content_ratio: {
    competitor: 0.22,
    methodology: 0.27,
    case_study: 0.27,
    trend: 0.17
  },
  forbidden_directions: ['硬广', '绝对化表述', '无证据声明', '竞品贬低'],
  target_role: '企业老板'
};

// ─── Mock信号（来自Skill1/2/3）─────────────────────────────

const MOCK_SIGNALS = [
  { id: 'SIG-001', type: 'aihot', title: 'Claude Code 编程 Agent 持续火爆，企业落地成为新瓶颈', weight: 1.2, content_type: '行业洞察' },
  { id: 'SIG-002', type: 'follow-builders', title: 'OpenAI 高管谈 Agent 标准：可靠性是关键', weight: 1.1, content_type: '行业洞察' },
  { id: 'SIG-003', type: 'aihot', title: 'Manus 发布后用户反馈：上手容易但企业集成难', weight: 1.0, content_type: '用户反馈' },
  { id: 'SIG-004', type: 'arxiv', title: 'arXiv 新论文：Agent 记忆模块的 4 种主流方案对比', weight: 0.9, content_type: '论文研究' },
  { id: 'SIG-005', type: 'social', title: '知乎热帖：AI Agent 落地到底卡在哪里？', weight: 1.3, content_type: '社区讨论' },
  { id: 'SIG-006', type: 'tech-news', title: '百度发布企业级 Agent 开发平台', weight: 0.8, content_type: '产品发布' },
  { id: 'SIG-007', type: 'competitor', title: 'Coze 企业版发布，定位对标 Jova AI', weight: 1.0, content_type: '竞品动态' },
  { id: 'SIG-008', type: 'manual', title: '客户访谈：制造业 AI 质检 Agent 落地复盘', weight: 1.4, content_type: '企业案例' },
];

// ─── 信号采集（真实API，fallback到mock）────────────────────────

const { collectAihotSignals } = require('./skills/resource-collector');

/**
 * 统一采集三个技能的真实信号
 * 1. aihot.virxact.com — AI 热点（REST API）
 * 2. follow-builders — Builder 博客 RSS（不需要 API key）
 * 3. tech-news-digest — 技术新闻 RSS（多源）
 */
async function collectSignalsFromAllSkills() {
  return new Promise((resolve) => {
    const py = require('child_process').spawn(
      'node',
      [path.join(__dirname, 'skills', 'collect-signals.js')],
      { timeout: 25000 }
    );
    let stdout = '', stderr = '';
    py.stdout.on('data', d => stdout += d);
    py.stderr.on('data', d => stderr += d);
    py.on('close', code => {
      if (stdout.trim()) {
        try {
          const result = JSON.parse(stdout.trim());
          console.log(`[采集] ✅ aihot=${result.sources.aihot} follow-builders=${result.sources['follow-builders']} tech-news=${result.sources['tech-news']}`);
          resolve(result.signals);
        } catch (e) {
          console.error('[采集] JSON parse error:', e.message);
          resolve(null);
        }
      } else {
        console.error('[采集] Python script returned nothing:', stderr);
        resolve(null);
      }
    });
    py.on('error', e => {
      console.error('[采集] Python spawn error:', e.message);
      resolve(null);
    });
  });
}

// ─── Mock Feedback 信号（演示用）───────────────────────────────────
/**
 * 模拟 Agent4 回传的高反馈内容
 * 格式：{ topic_keyword, engagement_score, content_type }
 * engagement_score: 0-5
 *
 * 在真实场景中，这个数据来自 Agent4 的竞品内容反馈
 * Agent4 用它调整大框架策略；
 * Agent5 用它提升同类选题的权重（两个目标不同，都需要）
 */
function getMockFeedbackSignals() {
  return [
    { topic_keyword: 'Claude Code', engagement_score: 4.5, content_type: '行业洞察' },
    { topic_keyword: 'Agent落地', engagement_score: 4.0, content_type: '企业案例' },
    { topic_keyword: 'OpenAI', engagement_score: 3.5, content_type: '行业洞察' },
    { topic_keyword: 'AI Agent', engagement_score: 4.0, content_type: '行业洞察' },
  ];
}

// ─── Agent5主函数 ──────────────────────────────────────────────────


async function runAgent5(opts = {}) {
  const narrative = opts.narrative || DEFAULT_NARRATIVE;
  const forcedSignals = opts.signals;
  const distributionRules = opts.distributionRules || {};
  const horizonDays = opts.horizonDays || 7;
  // Agent4回传的高反馈内容 → 驱动选题权重调整（不是调整大框架策略）
  const feedbackSignals = opts.feedbackSignals || getMockFeedbackSignals();

  console.log('\n========== Agent 5 Pipeline Start ==========\n');

  // 采集信号（优先三技能真实采集，失败则mock）
  let signals;
  if (forcedSignals) {
    signals = forcedSignals;
    console.log('[采集] 使用外部传入信号\n');
  } else {
    console.log('[采集] 从 aihot / follow-builders / tech-news-digest 采集真实信号...\n');
    const real = await collectSignalsFromAllSkills();
    if (real && real.length > 0) {
      signals = real;
    } else {
      console.log('[采集] ⚠️ 真实采集失败，使用 Mock 信号');
      signals = MOCK_SIGNALS;
    }
    console.log('');
  }

  // Step 1: Skill5 选题聚类
  console.log('[Skill5] 生成选题聚类...');
  const clusterResult = generateTopicCluster({
    signals,
    contentGaps: [],
    narrativeConstraint: narrative,
    feedbackSignals
  });
  console.log(`  → 生成 ${clusterResult.topics.length} 个母选题`);
  for (const t of clusterResult.topics) {
    console.log(`    ${t.topic_id}: ${t.title.substring(0, 40)}...`);
    console.log(`    → ${t.directions.length} 个方向, 总分: ${t.total_score}`);
  }

  // Step 2: Skill6 平台评分
  console.log('\n[Skill6] 平台评分...');
  const scoreResult = scoreTopics({
    topics: clusterResult.topics,
    narrativeConstraint: narrative
  });
  console.log(`  → 评分完成，${scoreResult.results.length} 个选题已评分`);
  for (const r of scoreResult.results) {
    const best = r.best_platform;
    const topScore = r.platform_ranking[0];
    console.log(`    ${r.topic_id}: 最优平台 ${topScore?.platform_id} (${topScore?.score})`);
  }

  // Step 3: Skill10 分发路由
  console.log('\n[Skill10] 分发路由...');
  const routeResult = routeDistribution({
    topicScores: scoreResult.results,
    narrativeConstraint: narrative,
    distributionRules
  });
  console.log(`  → 生成 ${routeResult.routes.length} 条分发路由`);
  for (const r of routeResult.routes.slice(0, 5)) {
    console.log(`    ${r.topic_id}/${r.direction_id} → ${r.target_account} (${r.priority})`);
  }

  // Step 4: Skill7 内容日历
  console.log('\n[Skill7] 生成内容日历...');
  const calendarResult = buildContentCalendar({
    routes: routeResult.routes,
    horizonDays,
    distributionRules: routeResult
  });
  console.log(`  → 生成 ${calendarResult.summary.total_days} 天日历，${calendarResult.summary.total_publishes} 条发布计划`);
  for (const [date, info] of Object.entries(calendarResult.calendar).slice(0, 3)) {
    console.log(`    ${date} ${info.weekday}: ${info.slots.length} 条发布`);
  }

  // Step 5: Skill8 资源采集（针对第一个选题第一个方向）
  console.log('\n[Skill8] 资源采集（演示）...');
  const firstTopic = clusterResult.topics[0];
  const firstDir = firstTopic?.directions[0];
  if (firstTopic && firstDir) {
    try {
      const resourceResult = await collectResources({
        topic: { topic_id: firstTopic.topic_id, direction_id: firstDir.direction_id, title: firstTopic.title },
        researchPlan: {
          queries: ['Claude Code 企业落地', 'AI Agent 记忆模块'],
          youtube_queries: ['Claude Code 实际应用案例'],
          paper_queries: ['AI Agent memory'],
          urls: []
        }
      });
      console.log(`  → 采集 ${resourceResult.sources.length} 个来源`);
      console.log(`  → 证据充分度: ${resourceResult.knowledge_base?.substring(0, 60)}`);
    } catch (e) {
      console.log(`  → 采集模拟完成（演示模式）`);
    }
  }

  // Step 6: Skill9 Topic Brief（Trend Brief）
  console.log('\n[Skill9] 生成Trend Brief...');
  const briefResult = buildTopicBrief({
    topic: firstTopic,
    direction: firstDir,
    resources: { sources: [], evidence: {}, knowledge_base: '' },
    narrativeConstraint: narrative,
    distributionRoute: routeResult.routes[0] || {},
    topicScores: scoreResult          // 含 search_intent
  });
  console.log(`  → Brief ID: ${briefResult.brief.brief_id}`);
  console.log(`  → 核心论点: ${briefResult.brief.core_claims[0]?.statement?.substring(0, 50)}`);

  console.log('\n========== Agent 5 Pipeline Complete ==========\n');

  return {
    topic_pool: clusterResult,
    topic_scores: scoreResult,
    distribution_map: routeResult,
    editorial_calendar: calendarResult,
    topic_brief: briefResult,
    signals,
    summary: {
      topics_count: clusterResult.topics.length,
      directions_count: clusterResult.topics.reduce((s, t) => s + t.directions.length, 0),
      routes_count: routeResult.routes.length,
      calendar_days: calendarResult.summary.total_days,
      calendar_publishes: calendarResult.summary.total_publishes,
      platforms_covered: Object.keys(calendarResult.summary.platform_distribution || {}).length
    }
  };
}

// ─── 分发规则动态更新 ──────────────────────────────────────────────

async function updateAndRegenerate(currentRules, change) {
  const newRules = updateDistributionRules(currentRules, change);
  console.log(`\n[规则更新] ${JSON.stringify(change)}`);
  console.log(`  → 新规则版本: ${newRules._version}`);

  return newRules;
}

// ─── 主入口 ──────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'update-rules') {
    // 用法: node agent5-core.js update-rules --platform zhihu --max-daily 1
    const changes = {};
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--platform') changes.platform = args[++i];
      if (args[i] === '--max-daily') changes.max_daily = parseInt(args[++i]);
    }
    const rules = require('./skills/distribution-router').getDefaultRules ? require('./skills/distribution-router').getDefaultRules() : {};
    const newRules = updateDistributionRules(rules, changes);
    console.log(JSON.stringify(newRules, null, 2));
  } else {
    // 默认跑全流程
    runAgent5().then(result => {
      console.log('\n========== Agent 5 最终输出摘要 ==========\n');
      console.log(`选题数: ${result.summary.topics_count}`);
      console.log(`方向数: ${result.summary.directions_count}`);
      console.log(`分发路由: ${result.summary.routes_count}`);
      console.log(`日历覆盖平台: ${result.summary.platforms_covered}`);
      console.log(`日历发布总量: ${result.summary.calendar_publishes}`);

      // ── Step 8: 分模块输出（V5拆分）───────────────────────────────
      const outputDir = path.join(__dirname, 'output');
      const trendBriefsDir = path.join(outputDir, 'trend-briefs');
      fs.mkdirSync(outputDir, { recursive: true });
      fs.mkdirSync(trendBriefsDir, { recursive: true });

      // 原始信号（P-2修复：原来_signals未保存）
      fs.writeFileSync(
        path.join(outputDir, 'signals.json'),
        JSON.stringify(result.signals || [])
      );

      // 各模块完整数据
      fs.writeFileSync(path.join(outputDir, 'topic-pool.json'),           JSON.stringify(result.topic_pool));
      fs.writeFileSync(path.join(outputDir, 'topic-scores.json'),         JSON.stringify(result.topic_scores));
      fs.writeFileSync(path.join(outputDir, 'distribution-map.json'),      JSON.stringify(result.distribution_map));
      fs.writeFileSync(path.join(outputDir, 'editorial-calendar.json'),   JSON.stringify(result.editorial_calendar));
      fs.writeFileSync(path.join(outputDir, 'resources.json'),             JSON.stringify(result.resources || {}));

      // Trend Brief（每方向一个文件）
      if (result.topic_brief?.brief) {
        const b = result.topic_brief.brief;
        fs.writeFileSync(
          path.join(trendBriefsDir, `BRIEF-${b.brief_id}.json`),
          JSON.stringify(b)
        );
      }

      // 汇总索引（兼容层）
      const index = {
        generated_at: new Date().toISOString(),
        pipeline_version: 'v2',
        module_version: 'split-output-v1',
        modules: {
          signals:              'output/signals.json',
          topic_pool:           'output/topic-pool.json',
          topic_scores:         'output/topic-scores.json',
          distribution_map:     'output/distribution-map.json',
          editorial_calendar:   'output/editorial-calendar.json',
          resources:            'output/resources.json',
          trend_briefs_dir:     'output/trend-briefs/'
        },
        stats: result.summary
      };
      fs.writeFileSync(
        path.join(__dirname, 'mock-data', 'agent5-complete-output.json'),
        JSON.stringify(index)
      );

      console.log('\n输出已保存:');
      console.log('  output/index.json（汇总索引）');
      console.log('  output/*.json（分模块）');
      console.log('  output/trend-briefs/*.json（TrendBrief）');
      console.log('  mock-data/agent5-complete-output.json（兼容索引）');
    }).catch(e => {
      console.error('Agent5 运行错误:', e);
      process.exit(1);
    });
  }
}

module.exports = { runAgent5, updateDistributionRules };
