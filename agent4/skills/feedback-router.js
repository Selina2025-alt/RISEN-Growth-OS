/**
 * Skill 7B: Agent 9 Feedback Router（反馈路由中枢）
 * 
 * 功能：接收 Agent 9 实验数据，路由到正确的下游 Agent
 * 规则：PRD Section 17.4 问题回流逻辑
 * 
 * 路由矩阵：
 * 
 * 信号类型              →  路由目标      →  触发动作
 * ──────────────────────────────────────────────────────
 * 价值主张错误           →  Agent 4      →  Strategy Card 重建
 * 选题错误              →  Agent 5      →  选题方向调整
 * 事实/观点错误         →  Agent 6      →  Evidence Pack 重建
 * 目标客户错误          →  Agent 3      →  ICP/Account 重建
 * 内容形式/渠道错误     →  Agent 7      →  多模态/渠道适配调整
 * 发布/账号错误         →  Agent 8      →  传播策略调整
 * 数据缺失/归因异常     →  Human/Connector →  人工复核或数据修复
 */

const { decide } = require('./stop-scale-decision');
const { createVersion, TRIGGERS } = require('./strategy-version-manager');

// ===== 信号类型 =====
const SIGNAL_TYPE = {
  VALUE_PROP_ERROR: 'value_prop_error',
  TOPIC_ERROR: 'topic_error',
  FACT_ERROR: 'fact_error',
  TARGET_ACCOUNT_ERROR: 'target_account_error',
  CONTENT_FORMAT_ERROR: 'content_format_error',
  PUBLISH_ERROR: 'publish_error',
  DATA_ANOMALY: 'data_anomaly',
  NO_ERROR: 'no_error'
};

// ===== 路由目标 =====
const ROUTE_TARGET = {
  AGENT_4: 'agent_4',
  AGENT_5: 'agent_5',
  AGENT_3: 'agent_3',
  AGENT_6: 'agent_6',
  AGENT_7: 'agent_7',
  AGENT_8: 'agent_8',
  HUMAN: 'human',
  NONE: 'none'
};

/**
 * 主路由函数
 * 
 * @param {Object} agent9Data - Agent 9 的实验数据
 * @param {Object} currentStrategyCard - 当前 Strategy Card
 * @returns {Object} 路由决策
 */
function route(agent9Data, currentStrategyCard) {
  const {
    experiment_results = [],
    performance_metrics = {},
    attribution_data = {},
    anomaly_flags = []
  } = agent9Data;

  const routing_decisions = [];

  // ===== Step 1: 运行 Stop/Scale 决策 =====
  let stopScaleDecision = null;
  if (experiment_results.length > 0) {
    const primaryResult = experiment_results[0];
    stopScaleDecision = decide(primaryResult, currentStrategyCard);
  }

  // ===== Step 2: 分析异常标志 =====
  anomaly_flags.forEach(flag => {
    routing_decisions.push(analyzeAnomaly(flag, currentStrategyCard));
  });

  // ===== Step 3: 分析归因数据 =====
  if (attribution_data.wrong_customer_signals) {
    routing_decisions.push({
      signal_type: SIGNAL_TYPE.TARGET_ACCOUNT_ERROR,
      target: ROUTE_TARGET.AGENT_3,
      confidence: attribution_data.confidence || 0.7,
      payload: {
        reason: '客户信号与ICP不匹配',
        wrong_signals: attribution_data.wrong_customer_signals,
        recommended_action: '重新审视ICP定义和目标客户画像'
      }
    });
  }

  // ===== Step 4: Stop/Scale 决策触发路由 =====
  if (stopScaleDecision) {
    const stopScaleRouting = translateStopScaleRouting(stopScaleDecision);
    if (stopScaleRouting) {
      routing_decisions.push(stopScaleRouting);
    }
  }

  // ===== Step 5: 聚合去重 =====
  const consolidated = consolidateRouting(routing_decisions);

  return {
    timestamp: new Date().toISOString(),
    experiment_results_summary: {
      experiments_count: experiment_results.length,
      avg_roi: experiment_results.length > 0 
        ? experiment_results.reduce((s, r) => s + r.actual_roi, 0) / experiment_results.length 
        : null,
      stop_scale_decision: stopScaleDecision?.primary_decision?.decision || null
    },
    routing_decisions: consolidated,
    prioritized_actions: prioritizeActions(consolidated),
    downstream_tasks: buildDownstreamTasks(consolidated)
  };
}

/**
 * 分析异常标志
 */
function analyzeAnomaly(flag, strategyCard) {
  const { type, severity, details } = flag;
  
  switch (type) {
    case 'low_ctr':
      return {
        signal_type: SIGNAL_TYPE.CONTENT_FORMAT_ERROR,
        target: ROUTE_TARGET.AGENT_5,
        confidence: 0.7,
        payload: {
          reason: `点击率过低: ${details.ctr}`,
          content_type: details.content_type,
          recommended_action: '调整内容形式或选题角度'
        }
      };
    
    case 'wrong_audience':
      return {
        signal_type: SIGNAL_TYPE.TARGET_ACCOUNT_ERROR,
        target: ROUTE_TARGET.AGENT_3,
        confidence: 0.8,
        payload: {
          reason: '内容触达了非目标受众',
          actual_audience: details.actual_audience,
          recommended_action: '重新定义ICP和目标账户'
        }
      };
    
    case 'low_conversion':
      return {
        signal_type: SIGNAL_TYPE.VALUE_PROP_ERROR,
        target: ROUTE_TARGET.AGENT_4,
        confidence: 0.6,
        payload: {
          reason: '高流量但低转化，价值主张可能不匹配客户需求',
          details,
          recommended_action: '审视并重建价值主张'
        }
      };
    
    case 'brand_voice_mismatch':
      return {
        signal_type: SIGNAL_TYPE.FACT_ERROR,
        target: ROUTE_TARGET.AGENT_6,
        confidence: 0.9,
        payload: {
          reason: '内容与品牌声音不匹配',
          details,
          recommended_action: '审核并修正内容调性'
        }
      };
    
    case 'fact_error':
      return {
        signal_type: SIGNAL_TYPE.FACT_ERROR,
        target: ROUTE_TARGET.AGENT_6,
        confidence: 0.95,
        payload: {
          reason: '事实性错误被用户指出',
          details,
          recommended_action: '立即修正事实，更新Evidence Pack'
        }
      };
    
    default:
      return {
        signal_type: SIGNAL_TYPE.DATA_ANOMALY,
        target: ROUTE_TARGET.HUMAN,
        confidence: 0.5,
        payload: {
          reason: `未知异常: ${type}`,
          details,
          recommended_action: '人工审核'
        }
      };
  }
}

/**
 * 将 Stop/Scale 决策转换为路由信号
 */
function translateStopScaleRouting(stopScaleDecision) {
  const { decision } = stopScaleDecision.primary_decision;
  const routing = stopScaleDecision.agent_routing;

  if (!routing || !routing.target_agent) return null;

  return {
    signal_type: mapDecisionToSignalType(decision),
    target: routing.target_agent,
    confidence: stopScaleDecision.experiment_summary?.confidence || 0.7,
    payload: {
      reason: `Stop/Scale决策: ${decision}`,
      stop_scale_decision: decision,
      routing_signal: routing.signal_type,
      data: routing.payload,
      recommended_action: stopScaleDecision.primary_decision.recommended_action
    }
  };
}

function mapDecisionToSignalType(decision) {
  const mapping = {
    'PIVOT': SIGNAL_TYPE.VALUE_PROP_ERROR,
    'STOP': SIGNAL_TYPE.TOPIC_ERROR,
    'SCALE': SIGNAL_TYPE.NO_ERROR,
    'CONTINUE': SIGNAL_TYPE.NO_ERROR,
    'COLLECT_MORE': SIGNAL_TYPE.NO_ERROR
  };
  return mapping[decision] || SIGNAL_TYPE.NO_ERROR;
}

/**
 * 聚合去重路由决策
 */
function consolidateRouting(decisions) {
  const byTarget = {};
  
  decisions.forEach(d => {
    if (!byTarget[d.target]) {
      byTarget[d.target] = [];
    }
    byTarget[d.target].push(d);
  });
  
  // 合并同一目标的决策
  return Object.entries(byTarget).map(([target, signals]) => ({
    target,
    signals: signals.map(s => s.signal_type).filter(t => t !== SIGNAL_TYPE.NO_ERROR),
    consolidated_payload: signals.reduce((acc, s) => ({ ...acc, ...s.payload }), {}),
    max_confidence: Math.max(...signals.map(s => s.confidence)),
    requires_immediate_action: signals.some(s => s.confidence >= 0.9)
  }));
}

/**
 * 优先级排序
 */
function prioritizeActions(consolidated) {
  return consolidated
    .filter(c => c.target !== ROUTE_TARGET.NONE)
    .sort((a, b) => {
      // 高置信度优先
      if (a.max_confidence >= 0.9 && b.max_confidence < 0.9) return -1;
      if (b.max_confidence >= 0.9 && a.max_confidence < 0.9) return 1;
      // 紧急优先
      if (a.requires_immediate_action && !b.requires_immediate_action) return -1;
      if (b.requires_immediate_action && !a.requires_immediate_action) return 1;
      return b.max_confidence - a.max_confidence;
    });
}

/**
 * 构建下游任务
 */
function buildDownstreamTasks(prioritizedActions) {
  return prioritizedActions.map(action => ({
    task_id: `task_${Date.now()}_${action.target}`,
    assigned_to: action.target,
    signal_type: action.signals[0],
    payload: action.consolidated_payload,
    priority: action.requires_immediate_action ? 'high' : 'normal',
    deadline: action.requires_immediate_action ? 'immediate' : 'within_24h',
    strategy_card_version: 'requires_update'
  }));
}

/**
 * 执行路由（带版本管理）
 */
function routeWithVersionUpdate(agent9Data, currentStrategyCard) {
  const routingResult = route(agent9Data, currentStrategyCard);
  
  // 如果有 Agent 4 路由（价值主张错误/PIVOT），触发 Strategy Card 版本更新
  const agent4Actions = routingResult.prioritized_actions.filter(a => a.target === ROUTE_TARGET.AGENT_4);
  
  if (agent4Actions.length > 0) {
    // 触发策略重建（新版本）
    const rebuildSignal = agent4Actions[0];
    
    // 创建新版本（由Agent 4后续处理）
    const rebuildContext = {
      trigger: TRIGGERS.PIVOT,
      reason: rebuildSignal.consolidated_payload.reason || '价值主张重建',
      routing: routingResult,
      requires_full_rebuild: rebuildSignal.max_confidence >= 0.9
    };
    
    routingResult.strategy_rebuild_signal = rebuildContext;
  }
  
  return routingResult;
}

// ===== CLI测试 =====
if (require.main === module) {
  const mockAgent9Data = {
    experiment_results: [
      {
        actual_roi: 0.5,
        confidence: 0.75,
        sample_size: 400,
        time_in_market_days: 12,
        winning_variant: null,
        hypothesis_test_results: []
      }
    ],
    anomaly_flags: [
      { type: 'low_conversion', severity: 'high', details: { conversion_rate: 0.005, expected: 0.02 } }
    ],
    attribution_data: {},
    performance_metrics: {}
  };
  
  const mockCard = {
    id: 'stg_v2',
    version: 'v2',
    target_roi: 1.2,
    content: {
      value_proposition: { tagline: 'JovaAI企业AI落地首选' }
    }
  };
  
  const result = routeWithVersionUpdate(mockAgent9Data, mockCard);
  
  console.log('\n🔀 Skill 7B: Feedback Router 输出\n');
  console.log(`Stop/Scale决策: ${result.experiment_results_summary.stop_scale_decision}`);
  console.log(`路由决策数: ${result.routing_decisions.length}`);
  console.log('\n优先级动作:');
  result.prioritized_actions.forEach((a, i) => {
    console.log(`  ${i+1}. [${a.target}] ${a.signals.join(', ')} (置信度: ${(a.max_confidence*100).toFixed(0)}%)`);
    console.log(`     原因: ${a.consolidated_payload.reason || 'N/A'}`);
  });
  console.log('\n下游任务:');
  result.downstream_tasks.forEach(t => {
    console.log(`  → ${t.assigned_to} (${t.priority})`);
  });
  
  // 写入（去除循环引用）
  require('fs').writeFileSync('../mock-data/feedback-router-output.json', 
    JSON.stringify({
      timestamp: result.timestamp,
      experiment_results_summary: result.experiment_results_summary,
      routing_decisions: result.routing_decisions,
      prioritized_actions: result.prioritized_actions,
      downstream_tasks: result.downstream_tasks,
      strategy_rebuild_signal: result.strategy_rebuild_signal ? {
        trigger: result.strategy_rebuild_signal.trigger,
        reason: result.strategy_rebuild_signal.reason,
        requires_full_rebuild: result.strategy_rebuild_signal.requires_full_rebuild
      } : null
    }, null, 2)
  );
  console.log('\n✅ 已写入 mock-data/feedback-router-output.json');
}

module.exports = { 
  route, 
  routeWithVersionUpdate,
  SIGNAL_TYPE, 
  ROUTE_TARGET 
};
