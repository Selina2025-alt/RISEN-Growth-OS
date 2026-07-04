/**
 * Agent 4 Core - 策略与实验智能体
 * 
 * 完整 Skills 1-8 对齐 PRD Section 12:
 * Skill 1: 目标→策略
 * Skill 2: 价值主张
 * Skill 3: 叙事架构
 * Skill 4: 渠道组合
 * Skill 5: 实验设计
 * Skill 6: 预算分配（新增）
 * Skill 7: 停止与放大（新增）
 * Skill 8: 策略版本管理（新增）
 */

const { goalToStrategy } = require('./skills/goal-to-strategy');
const { generateValueProposition } = require('./skills/value-proposition');
const { buildNarrative } = require('./skills/narrative-arch');
const { generateChannelMix } = require('./skills/channel-mix');
const { designExperiment } = require('./skills/experiment-design');
const { allocateBudget, generateExperimentTimeline } = require('./skills/budget-allocator');
const { decide } = require('./skills/stop-scale-decision');
const { createVersion, getCurrentVersion, getVersionHistory, compareVersions } = require('./skills/strategy-version-manager');
const fs = require('fs');
const path = require('path');

/**
 * 从 Agent 9 读取反馈数据
 * 路径：${AGENT9_OUTPUT_DIR}/decisions/from-agent9/agent4/latest.json
 * 格式：Decision v1.2
 */
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR;
  if (!dir) {
    console.warn('[Agent4] ⚠️  AGENT9_OUTPUT_DIR 未设置，Agent9 反馈不可用');
    return null;
  }
  const latestPath = path.join(dir, 'decisions', 'from-agent9', 'agent4', 'latest.json');
  if (!fs.existsSync(latestPath)) {
    console.warn('[Agent4] ⚠️  Agent4 Decision 文件不存在，尝试读 agent5 数据');
    // fallback：读 agent5 的决策（包含 topic_boost，可推断内容效果）
    const agent5Path = path.join(dir, 'decisions', 'from-agent9', 'agent5', 'latest.json');
    if (!fs.existsSync(agent5Path)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(agent5Path, 'utf8'));
      return { decisions: data.decisions || [], source: 'agent5' };
    } catch { return null; }
  }
  try {
    const data = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    return { decisions: data.decisions || [], source: 'agent4' };
  } catch (e) {
    console.warn(`[Agent4] ⚠️  读取 Agent9 反馈失败: ${e.message}`);
    return null;
  }
}

/**
 * 从 Agent 9 Decision 数据转换为 experimentResults 格式
 * 用于 stop-scale-decision Skill
 *
 * 转换逻辑：
 * - strategy_shift 类型决策 → 直接映射为 ROI 信号
 * - topic_boost 决策 → 从 SCALE/REDUCE 推断内容效果
 */
function convertAgent9ToExperimentResults(agent9Feedback) {
  if (!agent9Feedback || !agent9Feedback.decisions) return null;
  const { decisions, source } = agent9Feedback;

  // 优先用 agent4 专属的 strategy_shift
  const strategyDecisions = decisions.filter(d => d.type === 'strategy_shift');
  const topicDecisions = decisions.filter(d => d.type === 'topic_boost');

  if (strategyDecisions.length > 0) {
    const latest = strategyDecisions[strategyDecisions.length - 1];
    // 从 reason 字段解析 ROI（格式如 "ROI 1.4 超过目标 1.2"）
    const roiMatch = latest.reason?.match(/ROI\s*([\d.]+)/);
    const actual_roi = roiMatch ? parseFloat(roiMatch[1]) : null;
    return {
      actual_roi: actual_roi || 1.0,
      confidence: latest.confidence || 0.5,
      sample_size: 100,
      time_in_market_days: 7,
      winning_variant: null,
      metrics: { engagement_rate: 0.03 },
      source: 'agent9_strategy_shift',
      decision: latest.decision
    };
  }

  if (topicDecisions.length > 0) {
    // 从 topic_boost 分布推断整体内容效果
    const scale = topicDecisions.filter(d => d.decision === 'SCALE').length;
    const reduce = topicDecisions.filter(d => d.decision === 'REDUCE').length;
    const total = topicDecisions.length;
    const netSignal = (scale - reduce) / total; // -1 到 1
    // netSignal > 0 → 内容有效，< 0 → 无效
    const estimated_roi = 0.8 + netSignal * 0.8; // 映射到 0~1.6
    return {
      actual_roi: parseFloat(estimated_roi.toFixed(2)),
      confidence: 0.6,
      sample_size: total * 100,
      time_in_market_days: 7,
      winning_variant: null,
      metrics: { engagement_rate: 0.03 + netSignal * 0.015 },
      source: 'agent9_topic_boost',
      decision: netSignal > 0.2 ? 'SCALE' : netSignal < -0.2 ? 'REDUCE' : 'CONTINUE'
    };
  }

  return null;
}

/**
 * 基于 Agent 9 信号动态更新策略内容
 */
function buildUpdatedStrategyFromAgent9(agent9Feedback, originalStrategy) {
  const conversion = convertAgent9ToExperimentResults(agent9Feedback);
  if (!conversion) return null;

  const { decision, source } = conversion;
  let updatedContent = { ...originalStrategy.content || {} };

  if (decision === 'SCALE') {
    updatedContent.strategic_bet = '内容表现优异，扩大产出规模验证规模化假设';
  } else if (decision === 'REDUCE') {
    updatedContent.strategic_bet = '内容效果低于预期，重新审视目标受众定位和内容形式';
  } else {
    updatedContent.strategic_bet = originalStrategy.content?.strategic_bet
      || originalStrategy.strategic_bet?.bet_on
      || '继续积累数据，验证内容方向有效性';
  }

  // 记录反馈来源
  updatedContent._agent9_feedback = {
    source,
    decision,
    computed_at: new Date().toISOString()
  };

  return updatedContent;
}

/**
 * 运行完整 Agent 4 Pipeline
 */
async function runAgent4(campaignInput, passportInput, marketInput, options = {}) {
  const { totalBudget = 300000 } = options;

  console.log('\n' + '='.repeat(60));
  console.log('Agent 4 Core — 8 Skills 完整执行');
  console.log('='.repeat(60) + '\n');

  // ===== Skill 1: 目标→策略 =====
  console.log('📌 Skill 1: 目标→策略');
  const strategyResult = goalToStrategy(campaignInput, passportInput, marketInput);
  console.log(`  策略类型: ${strategyResult.strategic_approach?.type}`);
  console.log(`  Strategic Bet: ${strategyResult.strategic_bet?.bet_on || JSON.stringify(strategyResult.strategic_bet).substring(0, 50)}`);

  // ===== Skill 2: 价值主张 =====
  console.log('\n📌 Skill 2: 价值主张');
  const vpResult = generateValueProposition(strategyResult, passportInput, marketInput);
  console.log(`  Tagline: ${vpResult.tagline}`);
  console.log(`  Claims: ${vpResult.claims?.length || 0}条`);

  // ===== Skill 3: 叙事架构 =====
  console.log('\n📌 Skill 3: 叙事架构');
  const narrativeResult = buildNarrative(vpResult, passportInput.brand_policy, 'wechat');
  console.log(`  30s钩子: ${narrativeResult.version_30s?.content?.substring(0, 40)}...`);
  console.log(`  2min版本: ${narrativeResult.version_2min ? '✓' : '✗'}`);

  // ===== Skill 4: 渠道组合 =====
  console.log('\n📌 Skill 4: 渠道组合');
  const channelResult = generateChannelMix(strategyResult, campaignInput, {});
  const platformCount = channelResult.channel_mix?.length || 0;
  console.log(`  平台数: ${platformCount}`);
  channelResult.channel_mix?.slice(0, 3).forEach(c => {
    console.log(`  - ${c.channel_name}: ${(c.budget_ratio * 100).toFixed(0)}%`);
  });

  // ===== Skill 5: 实验设计 =====
  console.log('\n📌 Skill 5: 实验设计');
  const expStrategyCard = {
    id: 'stg_current', version: 'v1',
    target_segment: strategyResult.target_segment,
    content: { strategic_approach: strategyResult.strategic_approach, experiment_plan: { strategy_count: 3 } }
  };
  const experimentResult = designExperiment(campaignInput, expStrategyCard, channelResult);
  console.log(`  实验数: ${experimentResult.experiments?.length || 0}`);
  console.log(`  类型: ${experimentResult.experiment_type}`);

  // ===== Skill 6: 预算分配（新增）=====
  console.log('\n📌 Skill 6: 预算分配');
  const budgetResult = allocateBudget(
    { goal: campaignInput.objectives?.[0]?.type || 'leads', target: 300 },
    totalBudget,
    {
      experimentCount: experimentResult.experiments?.length || 3,
      experimentDurationWeeks: 4,
      shortVideoHeavy: false,
      isNewMarket: true
    }
  );
  const timeline = generateExperimentTimeline(budgetResult, 12);
  console.log(`  总预算: ¥${budgetResult.total_budget.toLocaleString()}`);
  console.log(`  Owned: ¥${budgetResult.channel_budgets.owned_media.amount.toLocaleString()} (${(budgetResult.channel_budgets.owned_media.pct*100).toFixed(0)}%)`);
  console.log(`  Paid: ¥${budgetResult.channel_budgets.paid_media.amount.toLocaleString()} (${(budgetResult.channel_budgets.paid_media.pct*100).toFixed(0)}%)`);
  console.log(`  实验阶段: ${timeline.phases.length}个`);

  // ===== Skill 7: 停止与放大 =====
  console.log('\n📌 Skill 7: 停止与放大');
  const strategyCard = buildStrategyCard(strategyResult, vpResult, narrativeResult, channelResult, experimentResult, budgetResult, timeline);
  console.log(`  Strategy Card ID: ${strategyCard.id}`);
  console.log(`  状态: ${strategyCard.status}`);
  console.log(`  成功指标: ROI > ${strategyCard.content.success_threshold?.roi || 1.2}`);
  console.log(`  停止条件: ROI < ${strategyCard.content.stop_conditions?.roi_threshold || 0.6}`);

  // 从 Agent 9 读取真实反馈数据
  const agent9Feedback = loadFeedbackFromAgent9();
  let stopScaleDecision;

  if (agent9Feedback) {
    console.log(`  Agent9 数据来源: ${agent9Feedback.source}，共 ${agent9Feedback.decisions.length} 条决策`);
    const experimentResults = convertAgent9ToExperimentResults(agent9Feedback);
    if (experimentResults) {
      console.log(`  Agent9 信号: decision=${experimentResults.decision}, estimated_roi=${experimentResults.actual_roi}, source=${experimentResults.source}`);
      stopScaleDecision = decide(experimentResults, strategyCard);
    } else {
      console.log(`  ⚠️  Agent9 数据无法解析，使用 CONTINUE 默认决策`);
      stopScaleDecision = {
        primary_decision: { decision: 'CONTINUE', reason: '数据不足，维持现状' },
        agent_routing: { target_agent: null }
      };
    }
  } else {
    console.log(`  ⚠️  无 Agent9 反馈数据，使用 CONTINUE 默认决策`);
    stopScaleDecision = {
      primary_decision: { decision: 'CONTINUE', reason: '无 Agent9 数据，维持现状' },
      agent_routing: { target_agent: null }
    };
  }
  console.log(`  Agent9反馈决策: ${stopScaleDecision.primary_decision.decision}`);
  console.log(`  路由目标: ${stopScaleDecision.agent_routing.target_agent || '无'}`);

  // ===== Skill 8: 策略版本管理 =====
  console.log('\n📌 Skill 8: 策略版本管理');
  const versionResult = createVersion(strategyCard, 'initial', { reason: 'Agent 4 初始化生成' });
  console.log(`  当前版本: ${versionResult.created.version}`);
  console.log(`  触发: ${versionResult.created.trigger}`);
  console.log(`  回滚可用: ${versionResult.created.rollback_available ? '✓' : '✗'}`);

  // 基于 Agent 9 真实反馈更新策略
  if (agent9Feedback) {
    const updatedContent = buildUpdatedStrategyFromAgent9(agent9Feedback, strategyCard);
    if (updatedContent) {
      const updatedCard = {
        ...strategyCard,
        version: 'v2',
        content: updatedContent
      };
      const v2Result = createVersion(updatedCard, 'agent9_feedback', {
        reason: `基于Agent 9 ${agent9Feedback.source} 数据反馈优化，decision=${stopScaleDecision.primary_decision.decision}`
      });
      console.log(`  新版本: ${v2Result.created.version}`);
      console.log(`  变更数: ${v2Result.created.changes_summary?.length || 0}项`);
      console.log(`  触发: ${v2Result.created.trigger}`);
    }
  } else {
    console.log(`  无 Agent9 反馈，跳过策略更新`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Agent 4 完整执行完成');
  console.log('='.repeat(60));

  return {
    strategy_card: strategyCard,
    budget_allocation: budgetResult,
    experiment_timeline: timeline,
    stop_scale_decision: stopScaleDecision,
    version_info: {
      current: versionResult.created.version,
      history: getVersionHistory()
    }
  };
}

/**
 * 构建完整的 Strategy Card（含所有PRD要求字段）
 */
function buildStrategyCard(strategy, vp, narrative, channel, experiment, budget, timeline) {
  return {
    id: `stg_${Date.now()}`,
    version: 'v1',
    status: 'approved',
    generated_at: new Date().toISOString(),
    
    // PRD要求: 基础信息
    promoted_object: 'JovaAI',
    business_objective: strategy.business_objective || '品牌增长+商机获取',
    target_market: strategy.target_segment?.market || '中国',
    target_accounts: strategy.target_segment?.accounts || [],
    target_roles: strategy.target_segment?.personas || [],
    
    // PRD要求: 认知差距
    current_perception: strategy.current_perception || '市场对JovaAI认知不足',
    target_perception: strategy.target_perception || 'JovaAI是企业AI落地的首选平台',
    
    // PRD要求: 核心内容
    value_proposition: vp,
    narrative,
    
    // PRD要求: 实验配置
    experiment_plan: {
      ...experiment,
      timeline,
      budget_allocation: budget
    },
    
    // PRD要求: 渠道组合（Skill 4输出）
    channel_mix: channel.channel_mix,
    
    // PRD要求: 成功/停止/放大条件（Skill 7输出）
    success_threshold: {
      roi: 1.2,
      min_sample_size: 500,
      min_engagement_rate: 0.03,
      confidence: 0.70,
      description: 'ROI > 1.2x 且置信度 > 70% 且样本量 > 500'
    },
    stop_conditions: {
      roi_threshold: 0.6,
      min_sample_size: 300,
      description: 'ROI < 0.6x 且样本量 > 300 → 停止'
    },
    scale_conditions: {
      roi_multiplier: 1.5,
      confidence: 0.80,
      description: 'ROI > 目标1.5倍 且置信度 > 80% → 放大'
    },
    
    // PRD要求: 风险
    risks: strategy.risks || [],
    
    // PRD要求: 实验周期
    experiment_duration_weeks: timeline.total_weeks,
    
    // PRD要求: 预算上限
    budget_ceiling: budget.total_budget,
    
    // 版本管理（Skill 8）
    version_history: getVersionHistory(),
    
    content: {
      strategic_approach: strategy.strategic_approach,
      strategic_bet: strategy.strategic_bet,
      value_proposition: vp,
      narrative,
      channel_mix: channel.channel_mix,
      experiment_plan: experiment,
      success_threshold: {
        roi: 1.2,
        min_sample_size: 500,
        confidence: 0.70
      },
      stop_conditions: { roi_threshold: 0.6 },
      scale_conditions: { roi_multiplier: 1.5 }
    }
  };
}

module.exports = { runAgent4, buildStrategyCard, loadFeedbackFromAgent9 };
