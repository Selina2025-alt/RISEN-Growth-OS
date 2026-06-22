/**
 * Agent 4 完整 Pipeline（含 Skills 6-9）
 * 
 * 流程：
 * 1. Agent 4 Core（Skill 1-5）→ Strategy Card
 * 2. Skill 6: Platform Intelligence → 平台策略报告
 * 3. Skill 7: Feedback Router → 反馈路由
 * 4. Skill 8: Strategy Evolver → 策略进化
 * 5. Skill 9: Narrative Constraint → Agent 5 约束
 */

const path = require('path');
const fs = require('fs');

// 加载所有 Skill
const { goalToStrategy } = require('./skills/goal-to-strategy');
const { generateValueProposition } = require('./skills/value-proposition');
const { buildNarrative } = require('./skills/narrative-arch');
const { generateChannelMix } = require('./skills/channel-mix');
const { designExperiment } = require('./skills/experiment-design');
const { runPlatformIntelligence } = require('./skills/platform-intelligence');
const { route: feedbackRoute } = require('./skills/strategy-feedback-router');
const { evolveStrategyCard } = require('./skills/strategy-evolver');
const { generateConstraints } = require('./skills/narrative-constraint-generator');

// 加载 Mock 数据
const campaign = require('./mock-data/agent1-campaign.json');
const passport = require('./mock-data/agent2-passport.json');
const market = require('./mock-data/agent3-market.json');

async function runFullPipeline() {
  console.log('\n' + '='.repeat(60));
  console.log('Agent 4 完整 Pipeline（含 Skills 6-9）');
  console.log('='.repeat(60) + '\n');

  // ===== Step 1: Agent 4 Core（Skill 1-5） =====
  console.log('📊 Step 1: Agent 4 Core（Skill 1-5）');
  console.log('-'.repeat(40));

  const strategyResult = goalToStrategy(campaign, passport, market);
  const vpResult = generateValueProposition(strategyResult, passport, market);
  const narrativeResult = buildNarrative(vpResult, passport.brand_policy, 'zhihu');
  const channelResult = generateChannelMix(strategyResult, campaign, {});
  
  const mockStrategyCardForExp = {
    id: 'stg_mock', version: 'v1',
    value_proposition: vpResult,
    target_segment: strategyResult.target_segment,
    content: { strategic_approach: strategyResult.strategic_approach, experiment_plan: { strategy_count: 3 } }
  };
  const experimentResult = designExperiment(campaign, mockStrategyCardForExp, channelResult);

  const strategyCard = {
    id: `stg_${Date.now()}`,
    version: 'v1',
    status: 'approved',
    content: {
      strategic_bet: strategyResult.strategic_bet,
      value_proposition: vpResult,
      narrative: narrativeResult,
      channel_mix: channelResult.channel_mix,
      experiment_plan: experimentResult
    }
  };
  console.log('  ✅ Strategy Card 生成完成\n');

  // ===== Step 2: Skill 6: Platform Intelligence =====
  console.log('📡 Step 2: Platform Intelligence（Skill 6）');
  console.log('-'.repeat(40));
  const platformReport = await runPlatformIntelligence(
    path.join(__dirname, 'mock-data/competitor-list.json'),
    ['zhihu', 'baijiahao', 'toutiao']
  );
  console.log('  ✅ 平台调研完成\n');

  // ===== Step 3: Skill 7: Feedback Router =====
  console.log('🔄 Step 3: Feedback Router（Skill 7）');
  console.log('-'.repeat(40));
  const mockFeedback = {
    period: 'last_week',
    contents: [
      { content_id: 'art_001', platform: 'zhihu', content_type: '竞品对比',
        metrics: { views: 12500, engagement_rate: 0.085 } },
      { content_id: 'art_002', platform: 'baijiahao', content_type: '竞品对比',
        metrics: { views: 3200, engagement_rate: 0.008 } },
      { content_id: 'art_003', platform: 'toutiao', content_type: '方法论',
        metrics: { views: 45000, engagement_rate: 0.065 } }
    ]
  };
  const feedbackDecisions = feedbackRoute(mockFeedback);
  console.log(`  深化选题: ${feedbackDecisions.topic_deepening.length}条`);
  console.log(`  策略调整: ${feedbackDecisions.strategy_adjustments.length}条`);
  console.log('  ✅ 反馈路由完成\n');

  // ===== Step 4: Skill 8: Strategy Evolver =====
  console.log('🔄 Step 4: Strategy Evolver（Skill 8）');
  console.log('-'.repeat(40));
  const evolutionResult = evolveStrategyCard(strategyCard, feedbackDecisions, platformReport);
  console.log(`  版本升级: ${evolutionResult.version_from} → ${evolutionResult.version_to}`);
  console.log(`  变更数量: ${evolutionResult.changes_count}条`);
  console.log('  ✅ 策略进化完成\n');

  // ===== Step 5: Skill 9: Narrative Constraint =====
  console.log('📝 Step 5: Narrative Constraint（Skill 9）');
  console.log('-'.repeat(40));
  const constraints = generateConstraints(evolutionResult.evolved_card);
  console.log(`  核心主轴: ${constraints.narrative_constraints.main_axis}`);
  console.log(`  账号差异化: ${Object.keys(constraints.narrative_constraints.account_differentiation).length}个账号`);
  console.log('  ✅ Narrative约束生成完成\n');

  // ===== 汇总 =====
  console.log('='.repeat(60));
  console.log('Pipeline 执行完成\n');
  console.log('最终产物:');
  console.log(`  1. Strategy Card v${strategyCard.version}（含策略+叙事+渠道+实验）`);
  console.log(`  2. 平台策略报告（${platformReport.platforms_scanned.length}个平台）`);
  console.log(`  3. 反馈路由决策（${feedbackDecisions.topic_deepening.length}条深化+${feedbackDecisions.strategy_adjustments.length}条调整）`);
  console.log(`  4. 策略进化 v${evolutionResult.version_to}`);
  console.log(`  5. Narrative约束（供Agent 5使用）`);
  console.log('='.repeat(60));

  // 保存完整输出
  const output = {
    timestamp: new Date().toISOString(),
    strategy_card: evolutionResult.evolved_card,
    platform_intelligence: platformReport,
    feedback_decisions: feedbackDecisions,
    evolution: evolutionResult,
    narrative_constraints: constraints
  };
  fs.writeFileSync('./mock-data/agent4-full-output.json', JSON.stringify(output, null, 2));
  console.log('\n✅ 完整输出已写入 mock-data/agent4-full-output.json');

  return output;
}

runFullPipeline().catch(err => {
  console.error('Pipeline失败:', err);
  process.exit(1);
});
