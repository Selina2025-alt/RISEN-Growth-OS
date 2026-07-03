/**
 * Agent 9 Core - 收入归因与增长学习智能体
 *
 * 运行方式：
 *   node agent9-core.js [--date YYYY-MM-DD]
 *
 * 环境变量：
 *   AGENT9_OUTPUT_DIR  — 输出目录（默认 ./output）
 *   NODE_ENV=production — 生产模式（拒绝 Mock 数据）
 */
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = process.env.AGENT9_OUTPUT_DIR
  || path.join(__dirname, 'output');  // ✅ v3.0 H1 修复：补上右括号
const RUN_MODE = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

const { loadPlatformMeta } = require('./lib/platform-meta-loader');
const { loadAttributionConfig } = require('./lib/attribution-config-loader');
const { ADAPTERS } = require('./lib/platform-adapters');
const MetricCollector = require('./skills/metric-collector');
const AttributionEngine = require('./skills/attribution-engine');
const InsightGenerator = require('./skills/insight-generator');
const DecisionDispenser = require('./skills/decision-dispenser');

async function main() {
  const startTime = Date.now();
  const runDate = process.argv.includes('--date')
    ? process.argv[process.argv.indexOf('--date') + 1]
    : new Date().toISOString().split('T')[0];

  console.log(`\n[Agent9] 🚀 启动 (run=${runDate}, mode=${RUN_MODE})`);
  if (RUN_MODE === 'prod') console.log('[Agent9] ⚠️  生产模式：拒绝 Mock 数据');
  console.log(`[Agent9] 📁 OUTPUT_DIR: ${OUTPUT_DIR}`);

  // 路径检查
  if (!fs.existsSync(OUTPUT_DIR)) {
    if (RUN_MODE === 'prod') throw new Error(`[Agent9] ❌ 生产模式：OUTPUT_DIR 不存在: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`[Agent9] ℹ️  已创建 OUTPUT_DIR`);
  }
  try { fs.accessSync(OUTPUT_DIR, fs.constants.W_OK); }
  catch { throw new Error(`[Agent9] ❌ OUTPUT_DIR 不可写: ${OUTPUT_DIR}`); }

  const config = loadAttributionConfig();
  const platformMeta = loadPlatformMeta();

  // Step 1: 采集
  console.log('\n[Agent9] 📥 Step 1: 指标采集');
  const dateRange = {
    startDate: getAttributionWindowStart(runDate, platformMeta),
    endDate: `${runDate}T23:59:59+08:00`
  };
  console.log(`[Agent9] ℹ️  归因窗口: ${dateRange.startDate} → ${dateRange.endDate}`);

  const collector = new MetricCollector({
    adapters: ADAPTERS,
    dateRange,
    platformMeta,
    config,
    outputDir: OUTPUT_DIR
  });
  const performances = await collector.collect();
  console.log(`[Agent9] ✅ 采集完成：${performances.length} 条`);

  if (performances.length === 0) {
    console.warn('[Agent9] ⚠️  无数据，归因跳过');
    return;
  }

  // Step 2: 归因
  console.log('\n[Agent9] 🧠 Step 2: 归因计算');
  const engine = new AttributionEngine({
    config,
    platformMeta,
    outputDir: OUTPUT_DIR
  });
  const topicBoosts = await engine.attribute(performances);
  const dist = { SCALE: 0, CONTINUE: 0, REDUCE: 0, STOP: 0 };
  topicBoosts.forEach(b => dist[b.decision]++);
  console.log(`[Agent9] 📊 分布: SCALE=${dist.SCALE} CONTINUE=${dist.CONTINUE} REDUCE=${dist.REDUCE} STOP=${dist.STOP}`);
  writeTopicBoosts(topicBoosts);

  // Step 3: Insight
  console.log('\n[Agent9] 💡 Step 3: Insight 生成');
  const generator = new InsightGenerator({ config, platformMeta });
  const insights = await generator.generate({ topicBoosts, performances });
  writeInsights(insights);

  // Step 4: 决策下发
  console.log('\n[Agent9] 📤 Step 4: 决策下发');
  const dispenser = new DecisionDispenser({ config, outputDir: OUTPUT_DIR });
  await dispenser.dispatch({ topicBoosts, insights });

  console.log(`\n[Agent9] ✅ 完成，耗时: ${Date.now() - startTime}ms`);
}

function getAttributionWindowStart(runDate, platformMeta) {
  let maxHours = 24;
  for (const p of platformMeta) {
    const h = parseWindow(p.minAttributionWindow);
    if (h > maxHours) maxHours = h;
  }
  const start = new Date(runDate);
  start.setDate(start.getDate() - Math.min(Math.ceil(maxHours / 24), 7));
  return start.toISOString().split('T')[0] + 'T00:00:00+08:00';
}

function parseWindow(w) {
  if (!w) return 24;
  if (w.endsWith('h')) return parseInt(w);
  if (w.endsWith('d')) return parseInt(w) * 24;
  return 24;
}

function writeTopicBoosts(topicBoosts) {
  const dir = path.join(OUTPUT_DIR, 'topic-boosts', '_latest');
  fs.mkdirSync(dir, { recursive: true });
  topicBoosts.forEach(b => {
    fs.writeFileSync(
      path.join(dir, `${b.topic_id}.json`),
      JSON.stringify(b, null, 2)
    );
  });
  console.log(`[Agent9] 💾 写入 ${topicBoosts.length} 个 TopicBoost → topic-boosts/_latest/`);
}

function writeInsights(insights) {
  const today = new Date().toISOString().split('T')[0];
  const dir = path.join(OUTPUT_DIR, 'insights', today);
  fs.mkdirSync(dir, { recursive: true });
  insights.forEach(i => {
    fs.writeFileSync(path.join(dir, `${i.id}.json`), JSON.stringify(i, null, 2));
  });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'insights', 'latest.json'),
    JSON.stringify({ total: insights.length, computed_at: new Date().toISOString() }, null, 2)
  );
  console.log(`[Agent9] 💾 写入 ${insights.length} 条 Insight`);
}

main().catch(err => {
  console.error('[Agent9] ❌', err.message);
  process.exit(1);
});
