/**
 * Skill 7: Stop/Scale Decision Engine
 * 
 * PRD来源: Section 12 — "停止与放大Skill"
 * 功能: 定义成功、失败和放大条件 + Agent 9 实验数据判断
 * 参考: GrowthBook bandit思想 + PostHog实验分析框架
 */

const fs = require('fs');

// ===== 决策类型 =====
const DECISION = {
  SCALE: 'SCALE',           // 放大
  CONTINUE: 'CONTINUE',     // 继续观察
  STOP: 'STOP',             // 停止
  PIVOT: 'PIVOT',           // 转向
  COLLECT_MORE: 'COLLECT_MORE'  // 继续收集数据
};

// ===== 默认阈值配置 =====
const DEFAULT_THRESHOLDS = {
  scale: {
    roi_multiplier: 1.5,    // ROI > 目标 × 1.5
    confidence: 0.80,       // 置信度 > 80%
    min_sample_size: 500
  },
  continue: {
    roi_multiplier: 1.2,    // ROI > 目标 × 1.2
    confidence: 0.60,
    min_sample_size: 200
  },
  stop: {
    roi_multiplier: 0.6,    // ROI < 目标 × 0.6
    confidence: 0.70,
    min_sample_size: 300
  },
  pivot: {
    // 核心假设被证伪
    hypothesis_rejected: true
  }
};

/**
 * 核心决策函数
 */
function decide(experimentResults, strategyCard, options = {}) {
  const {
    thresholds = DEFAULT_THRESHOLDS,
    customWeights = {}
  } = options;

  const {
    strategy_id,
    target_roi = 1.2,
    experiment_type = 'ab_test'
  } = strategyCard;

  const {
    actual_roi,
    confidence,
    sample_size,
    time_in_market_days,
    metrics = {},
    hypothesis_test_results = [],
    winning_variant
  } = experimentResults;

  const decisions = [];

  // ===== Step 1: 基础ROI判断 =====
  const roiRatio = actual_roi / target_roi;
  const hasMinSamples = sample_size >= thresholds.stop.min_sample_size;

  // ===== Step 2: 检查核心假设是否被证伪 =====
  const hypothesisRejection = hypothesis_test_results.find(h => h.rejected);
  if (hypothesisRejection) {
    decisions.push({
      decision: DECISION.PIVOT,
      reason: `核心假设被证伪: ${hypothesisRejection.hypothesis}`,
      evidence: hypothesisRejection,
      confidence: hypothesisRejection.confidence || 0.9,
      recommended_action: 'redesign_strategy',
      priority: 'critical'
    });
    return buildDecisionResponse(decisions, strategyCard, experimentResults);
  }

  // ===== Step 3: ROI + 置信度 + 样本量 综合判断 =====
  
  // SCALE 判断
  if (roiRatio >= thresholds.scale.roi_multiplier && 
      confidence >= thresholds.scale.confidence &&
      sample_size >= thresholds.scale.min_sample_size) {
    decisions.push({
      decision: DECISION.SCALE,
      reason: `ROI ${actual_roi.toFixed(2)} 超过目标 ${target_roi} 的 ${thresholds.scale.roi_multiplier}倍，置信度${(confidence*100).toFixed(0)}%，样本量${sample_size}`,
      evidence: { roi_ratio: roiRatio, confidence, sample_size },
      recommended_action: 'double_budget',
      scale_factor: 2.0,
      priority: 'high'
    });
  }
  
  // CONTINUE 判断
  else if (roiRatio >= thresholds.continue.roi_multiplier && 
           confidence >= thresholds.continue.confidence) {
    decisions.push({
      decision: DECISION.CONTINUE,
      reason: `ROI ${actual_roi.toFixed(2)} 在 1.2-1.5倍目标之间，继续观察积累数据`,
      evidence: { roi_ratio: roiRatio, confidence, sample_size },
      recommended_action: 'maintain_budget_continue_experiment',
      priority: 'medium'
    });
  }
  
  // STOP 判断
  else if (roiRatio < thresholds.stop.roi_multiplier && hasMinSamples) {
    decisions.push({
      decision: DECISION.STOP,
      reason: `ROI ${actual_roi.toFixed(2)} 低于目标 ${target_roi} 的 ${thresholds.stop.roi_multiplier}倍，样本量充足，停止实验`,
      evidence: { roi_ratio: roiRatio, confidence, sample_size },
      recommended_action: 'stop_experiment_document_lesson',
      priority: 'high',
      lessons_learned: generateLessons(experimentResults, strategyCard)
    });
  }
  
  // COLLECT_MORE 判断
  else if (!hasMinSamples) {
    decisions.push({
      decision: DECISION.COLLECT_MORE,
      reason: `样本量不足 (${sample_size}/${thresholds.stop.min_sample_size})，继续收集数据`,
      evidence: { roi_ratio: roiRatio, confidence, sample_size },
      recommended_action: 'continue_experiment_collect_more',
      estimated_days_to_min_samples: estimateDaysToMinSamples(sample_size, metrics.daily_new_samples || 50),
      priority: 'low'
    });
  }

  // ===== Step 4: 多指标综合判断（备选）=====
  if (decisions.length === 0) {
    const engagementRate = metrics.engagement_rate || 0;
    const targetEngagement = 0.03;
    
    if (engagementRate > targetEngagement * 1.5) {
      decisions.push({
        decision: DECISION.CONTINUE,
        reason: `ROI不显著但互动率${(engagementRate*100).toFixed(1)}%高于目标，等待更多转化数据`,
        evidence: { engagement_rate: engagementRate, target_engagement: targetEngagement },
        recommended_action: 'continue_experiment_trust_engagement',
        priority: 'medium'
      });
    } else {
      decisions.push({
        decision: DECISION.CONTINUE,
        reason: `ROI ${actual_roi.toFixed(2)} 在可接受范围，继续观察`,
        evidence: { roi_ratio: roiRatio },
        recommended_action: 'maintain_budget',
        priority: 'low'
      });
    }
  }

  return buildDecisionResponse(decisions, strategyCard, experimentResults);
}

/**
 * 构建完整决策响应
 */
function buildDecisionResponse(decisions, strategyCard, experimentResults) {
  // 取优先级最高的决策
  const priorityOrder = ['critical', 'high', 'medium', 'low'];
  decisions.sort((a, b) => priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority));
  const primary = decisions[0];

  return {
    decision_id: `dec_${Date.now()}`,
    timestamp: new Date().toISOString(),
    
    primary_decision: primary,
    all_decisions: decisions,
    
    strategy_id: strategyCard.id || strategyCard.strategy_id,
    strategy_version: strategyCard.version,
    
    experiment_summary: {
      actual_roi: experimentResults.actual_roi,
      confidence: experimentResults.confidence,
      sample_size: experimentResults.sample_size,
      time_in_market_days: experimentResults.time_in_market_days,
      winning_variant: experimentResults.winning_variant
    },
    
    // Agent 4 内部路由信号
    agent_routing: deriveAgentRouting(primary.decision, experimentResults),
    
    // 下一轮行动
    next_actions: buildNextActions(primary),
    
    // 审批状态
    approval_status: primary.priority === 'critical' ? 'requires_human_approval' : 'auto_approved'
  };
}

/**
 * 根据决策类型推导Agent路由
 */
function deriveAgentRouting(decision, experimentResults) {
  const routing = {
    target_agent: null,
    signal_type: null,
    payload: {}
  };

  // 路由规则（PRD Section 17.4）
  switch (decision) {
    case DECISION.PIVOT:
      // 策略根本性错误 → Agent 4 重建策略
      routing.target_agent = 'agent_4';
      routing.signal_type = 'strategy_pivot_required';
      routing.payload = { reason: 'hypothesis_rejected', requires_rebuild: true };
      break;
      
    case DECISION.STOP:
      // 实验失败但非策略问题 → 路由给选题Agent
      routing.target_agent = 'agent_5';
      routing.signal_type = 'topic_adjustment';
      routing.payload = { reason: 'low_roi_content_type', avoid_topics: experimentResults.winning_variant };
      break;
      
    case DECISION.CONTINUE:
      // 继续观察 → 不触发路由
      routing.target_agent = null;
      routing.signal_type = 'continue_monitoring';
      break;
      
    case DECISION.SCALE:
      // 放大 → 路由给Agent 4 + Agent 5
      routing.target_agent = 'agent_5';
      routing.signal_type = 'scale_topics';
      routing.payload = { expand_winning_content_type: experimentResults.winning_variant, scale_factor: 2 };
      break;
      
    default:
      routing.target_agent = null;
      routing.signal_type = 'no_action';
  }

  return routing;
}

/**
 * 生成 Lessons Learned
 */
function generateLessons(experimentResults, strategyCard) {
  const lessons = [];
  
  if (experimentResults.actual_roi < 0.6) {
    lessons.push({
      category: 'value_proposition',
      lesson: '价值主张角度未被目标客户接受',
      evidence: `ROI ${experimentResults.actual_roi.toFixed(2)} 远低于预期`
    });
  }
  
  if (experimentResults.winning_variant) {
    lessons.push({
      category: 'content_format',
      lesson: `胜出版本为 ${experimentResults.winning_variant}，其他变体表现差`,
      evidence: `${experimentResults.winning_variant} 显著优于对照组`
    });
  }
  
  if (experimentResults.time_in_market_days < 7) {
    lessons.push({
      category: 'experiment_design',
      lesson: '实验周期不足7天，数据不具有统计意义',
      evidence: `仅运行${experimentResults.time_in_market_days}天`
    });
  }

  return lessons;
}

/**
 * 估算达到最小样本量的天数
 */
function estimateDaysToMinSamples(currentSamples, dailyRate) {
  if (dailyRate <= 0) return null;
  const needed = DEFAULT_THRESHOLDS.stop.min_sample_size - currentSamples;
  if (needed <= 0) return 0;
  return Math.ceil(needed / dailyRate);
}

/**
 * 构建下一步行动
 */
function buildNextActions(decision) {
  const actions = [];
  
  switch (decision.decision) {
    case DECISION.SCALE:
      actions.push({ action: 'increase_budget', factor: decision.scale_factor || 2 });
      actions.push({ action: 'expand_winning_content', variant: 'document_winning_variant' });
      actions.push({ action: 'schedule_next_review', days: 7 });
      break;
    case DECISION.CONTINUE:
      actions.push({ action: 'maintain_current_strategy' });
      actions.push({ action: 'schedule_next_review', days: 7 });
      actions.push({ action: 'monitor_key_metrics' });
      break;
    case DECISION.STOP:
      actions.push({ action: 'stop_experiment', immediate: true });
      actions.push({ action: 'document_lessons', lessons: decision.lessons_learned });
      actions.push({ action: 'design_next_experiment', based_on_lessons: true });
      break;
    case DECISION.PIVOT:
      actions.push({ action: 'trigger_strategy_rebuild', priority: 'high' });
      actions.push({ action: 'notify_stakeholders' });
      actions.push({ action: 'design_fundamentally_different_strategy' });
      break;
  }
  
  return actions;
}

// ===== CLI测试 =====
if (require.main === module) {
  // Mock实验结果
  const mockResults = {
    actual_roi: 1.8,
    confidence: 0.85,
    sample_size: 1200,
    time_in_market_days: 14,
    winning_variant: 'content_type_b',
    metrics: { engagement_rate: 0.065, click_rate: 0.12 },
    hypothesis_test_results: []
  };
  
  const mockStrategy = {
    id: 'stg_v2',
    version: 'v2',
    target_roi: 1.2
  };
  
  const result = decide(mockResults, mockStrategy);
  
  console.log('\n📊 Skill 7: Stop/Scale Decision 输出\n');
  console.log(`决策: ${result.primary_decision.decision}`);
  console.log(`原因: ${result.primary_decision.reason}`);
  console.log(`建议行动: ${result.primary_decision.recommended_action}`);
  console.log(`路由目标: ${result.agent_routing.target_agent || '无'} (${result.agent_routing.signal_type})`);
  console.log(`审批状态: ${result.approval_status}`);
  console.log('\n下一步行动:');
  result.next_actions.forEach(a => console.log(`  - ${a.action}`));
  
  // 写入文件
  fs.writeFileSync('../mock-data/stop-scale-decision.json', JSON.stringify(result, null, 2));
  console.log('\n✅ 已写入 mock-data/stop-scale-decision.json');
}

module.exports = { decide, DECISION, DEFAULT_THRESHOLDS };
