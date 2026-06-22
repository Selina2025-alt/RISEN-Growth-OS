#!/usr/bin/env node
/**
 * Agent 4 CLI Dashboard — 最终版
 *
 * @deprecated 请使用: python3 agent4-report.py
 * chalk v5 是纯ESM，与本项目CJS不兼容，保留此文件仅作参考。
 *
 * 运行方式: node agent4-dashboard.js
 */

const chalk = require('chalk').default;
const fs = require('fs');
const path = require('path');

// ===== Banner =====
const printBanner = () => {
  console.log(chalk.cyan(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   RISEN Agent 4  ·  策略与实验智能体                     ║
  ║   Strategy & Experiment Agent                            ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `));
};

// ===== 加载数据（无独立spinner）=====
const loadData = () => {
  return {
    campaign: require('./mock-data/agent1-campaign.json'),
    passport: require('./mock-data/agent2-passport.json'),
    market: require('./mock-data/agent3-market.json'),
    strategyCard: require('./mock-data/output-strategy-card.json')
  };
};

// ===== 加载Skills =====
// Lazy-load each skill to show real-time progress
const loadSkill = (name, path) => {
  process.stdout.write(chalk.gray(`  loading ${name}... `));
  const mod = require(path);
  console.log(chalk.green('✓'));
  return mod;
};

// ===== Section Printers =====

const printSection = (icon, title) => {
  console.log(chalk.bold(`\n${icon} ${title}`));
  console.log(chalk.gray('─'.repeat(56)));
};

const printRow = (label, value, color = 'white') => {
  const c = chalk[color] || chalk.white;
  console.log(`  ${chalk.gray(label+':')} ${c(value)}`);
};

const printList = (items) => {
  items.forEach(item => console.log(chalk.gray(`    • ${item}`)));
};

const printStatus = (label, ok, detail) => {
  const icon = ok ? chalk.green('✓') : chalk.red('✗');
  const status = ok ? chalk.green(' 通过') : chalk.red(' 未通过');
  console.log(`  ${icon} ${label}${status} ${chalk.gray(detail || '')}`);
};

// ===== 展示策略卡片（UI卡片格式）=====
const printStrategyCardUI = (s1, s2, s4, s6, s7) => {
  console.log(chalk.bold('\n📋 STRATEGY CARD'));
  console.log(chalk.gray('═'.repeat(56)));
  
  // 基本信息
  const card = [
    { label: 'ID', value: s1.strategic_bet?.strategic_bet_number ? `STR-${s1.strategic_bet.strategic_bet_number}` : 'STR-001' },
    { label: 'Strategic Bet', value: s1.strategic_bet?.bet_on || s1.strategic_bet?.hypothesis?.substring(0,50) || '内容营销建立技术领导力' },
    { label: 'Approach', value: s1.strategic_approach?.type || 'thought_leadership' },
    { label: 'Value Prop', value: s2.tagline || 'Jova AI：让企业AI落地不再困难' },
    { label: '预算', value: `¥${(s6?.total_budget || 300000).toLocaleString()}` },
  ];
  
  card.forEach(row => {
    console.log(`  ${chalk.cyan(row.label.padEnd(14))} ${chalk.white(row.value)}`);
  });
  
  // Stop/Scale状态
  console.log(chalk.gray('─'.repeat(56)));
  const decision = s7?.primary_decision?.decision || 'CONTINUE';
  const decisionColor = decision === 'SCALE' ? 'green' : decision === 'STOP' ? 'red' : 'yellow';
  console.log(`  ${chalk.cyan('Decision'.padEnd(14))} ${chalk[decisionColor].bold(decision)}`);
  console.log(`  ${chalk.cyan('Success Threshold'.padEnd(14))} ${chalk.green('ROI > 1.2x, conf > 70%')}`);
  console.log(`  ${chalk.cyan('Stop Condition'.padEnd(14))} ${chalk.red('ROI < 0.6x, samples > 300')}`);
};

// ===== 主函数 =====

async function main() {
  console.clear();
  printBanner();
  
  // 加载数据
  console.log(chalk.bold('\n📥 LOADING INPUTS\n'));
  let data;
  try {
    data = loadData();
    console.log(chalk.green('  ✓ ') + 'Campaign: ' + chalk.white(data.campaign.campaign_name || 'H2 2024 Campaign'));
    console.log(chalk.green('  ✓ ') + 'Passport: ' + chalk.white(data.passport.company_name || 'JovaAI'));
    console.log(chalk.green('  ✓ ') + 'Market: ' + chalk.white((data.market.target_segment?.primary || []).join(', ')));
  } catch(e) {
    console.log(chalk.red('  ✗ 加载失败: ' + e.message));
    process.exit(1);
  }
  
  // 逐个加载并执行Skills
  console.log(chalk.bold('\n⚙️  EXECUTING SKILLS\n'));
  
  const s1 = loadSkill('goal-to-strategy', './skills/goal-to-strategy');
  const goalResult = s1.goalToStrategy(data.campaign, data.passport, data.market);
  
  const s2 = loadSkill('value-proposition', './skills/value-proposition');
  const vpResult = s2.generateValueProposition(goalResult, data.passport, data.market);
  
  const s3 = loadSkill('narrative-arch', './skills/narrative-arch');
  const narrativeResult = s3.buildNarrative(vpResult, data.passport.brand_policy, 'wechat');
  
  const s4 = loadSkill('channel-mix', './skills/channel-mix');
  const channelResult = s4.generateChannelMix(goalResult, data.campaign, {});
  
  const s5 = loadSkill('experiment-design', './skills/experiment-design');
  const expSc = { id:'t', version:'v1', target_segment: goalResult.target_segment, content:{strategic_approach:goalResult.strategic_approach, experiment_plan:{strategy_count:3}} };
  const expResult = s5.designExperiment(data.campaign, expSc, channelResult);
  
  const s6 = loadSkill('budget-allocator', './skills/budget-allocator');
  const budgetResult = s6.allocateBudget({ goal:'leads', target:300 }, 300000, { experimentCount:3 });
  
  const s7 = loadSkill('stop-scale-decision', './skills/stop-scale-decision');
  const sc = { id:'t', version:'v1', target_roi:1.2, content:{strategic_approach:{type:'thought_leadership'}, experiment_plan:{strategy_count:3}} };
  const decisionResult = s7.decide({ actual_roi:1.4, confidence:0.75, sample_size:800, time_in_market_days:10, winning_variant:'content_a' }, sc);
  
  const s8 = loadSkill('strategy-version-manager', './skills/strategy-version-manager');
  const mockCard = { id:'t', version:'v1', strategic_bet:{bet_on:'内容营销建立技术领导力'}, content:{value_proposition:{tagline:'JovaAI企业AI落地'}}, target_roi:1.2, target_segment: goalResult.target_segment };
  const v1 = s8.createVersion(mockCard, 'initial', { reason:'初始版本' });
  const v2card = JSON.parse(JSON.stringify(mockCard));
  v2card.content.value_proposition.tagline = 'JovaAI：让企业AI落地更简单';
  const v2 = s8.createVersion(v2card, 'agent9_feedback', { reason:'基于反馈优化' });
  
  const s9 = loadSkill('narrative-constraint-generator', './skills/narrative-constraint-generator');
  const constraintsResult = s9.generateConstraints(data.strategyCard);
  
  const s7b = loadSkill('feedback-router', './skills/feedback-router');
  const routingResult = s7b.route({
    experiment_results: [{actual_roi:0.5, confidence:0.75, sample_size:400, time_in_market_days:12, winning_variant:null}],
    anomaly_flags: [{type:'low_conversion', severity:'high', details:{}}],
    attribution_data: {}
  }, sc);
  
  // ===== 输出展示 =====
  console.log(chalk.bold('\n' + '='.repeat(56)));
  console.log(chalk.bold('  OUTPUT — 策略卡片与实验结果'));
  console.log(chalk.bold('='.repeat(56)));
  
  // Strategy Card UI
  printStrategyCardUI(goalResult, vpResult, channelResult, budgetResult, decisionResult);
  
  // 渠道
  printSection('📡', 'CHANNEL MIX — 10个平台');
  const channels = channelResult.channel_mix || [];
  channels.forEach(c => {
    const role = c.role === 'primary' ? chalk.green('●') : chalk.gray('○');
    const pct = ((c.budget_ratio || 0)*100).toFixed(0)+'%';
    const type = c.content_type || c.form || '';
    console.log(`  ${role} ${c.channel_name.padEnd(10)} ${chalk.gray('|')} ${chalk.yellow(pct.padStart(4))} ${chalk.gray('|')} ${chalk.gray(type)}`);
  });
  
  // 预算
  printSection('💰', 'BUDGET ALLOCATION — ¥300,000');
  const total = budgetResult.total_budget || 300000;
  const owned = budgetResult.channel_budgets?.owned_media?.amount || 0;
  const paid = budgetResult.channel_budgets?.paid_media?.amount || 0;
  const earned = budgetResult.channel_budgets?.earned_media?.amount || 0;
  
  const bar = (amt) => {
    const w = Math.round((amt/total)*30);
    return '█'.repeat(w) + '░'.repeat(30-w);
  };
  
  console.log(`  ${chalk.green('Owned')} ${bar(owned)} ${chalk.green('¥'+owned.toLocaleString())} ${chalk.gray('('+((owned/total)*100).toFixed(0)+'%)')}`);
  console.log(`  ${chalk.yellow('Paid')}  ${bar(paid)} ${chalk.yellow('¥'+paid.toLocaleString())} ${chalk.gray('('+((paid/total)*100).toFixed(0)+'%)')}`);
  console.log(`  ${chalk.cyan('Earned')} ${bar(earned)} ${chalk.cyan('¥'+earned.toLocaleString())} ${chalk.gray('('+((earned/total)*100).toFixed(0)+'%)')}`);
  
  // 实验
  printSection('🔬', 'EXPERIMENTS — 3个并行策略实验');
  (expResult.experiments || []).forEach((exp, i) => {
    const hyp = typeof exp.hypothesis === 'object' ? exp.hypothesis?.primary : exp.hypothesis;
    console.log(`  ${chalk.yellow((i+1)+'.')} ${exp.name || '实验'+(i+1)}`);
    if (hyp) console.log(`     ${chalk.gray(hyp.substring(0, 60)+'...')}`);
  });
  
  // 版本
  printSection('📜', 'VERSION HISTORY');
  console.log(`  ${chalk.green('✓')} v1  ${chalk.gray('初始版本')}  ${chalk.gray('● superseded')}`);
  console.log(`  ${chalk.yellow('✓')} v2  ${chalk.gray('Agent9反馈优化')}  ${chalk.yellow('● active')}`);
  if (v2.created?.changes_summary?.length > 0) {
    v2.created.changes_summary.forEach(c => {
      console.log(`     ${chalk.yellow('•')} ${c.summary}`);
    });
  }
  
  // 反馈路由
  printSection('🔀', 'FEEDBACK ROUTING — Agent9 → 下游');
  if (routingResult.downstream_tasks?.length > 0) {
    routingResult.downstream_tasks.forEach(t => {
      const icon = t.priority === 'high' ? chalk.red('▸') : chalk.yellow('▸');
      console.log(`  ${icon} ${chalk.white(t.assigned_to)} ${chalk.gray('|')} ${chalk[ t.priority==='high' ? 'red' : 'yellow' ](t.signal_type)} ${chalk.gray('|')} ${t.priority}`);
    });
  } else {
    console.log(`  ${chalk.gray('  无待处理路由（当前CONTINUE）')}`);
  }
  
  // Narrative约束（给Agent5）
  printSection('📋', 'NARRATIVE CONSTRAINTS — 传递给Agent5');
  const nc = constraintsResult.narrative_constraints;
  if (nc) {
    if (nc.main_axis) console.log(`  ${chalk.cyan('主轴:')} ${nc.main_axis}`);
    if (nc.account_differentiation) {
      Object.entries(nc.account_differentiation).forEach(([acc, val]) => {
        console.log(`  ${chalk.cyan(acc+':')} ${chalk.gray(val.role)} | ${val.constraint?.substring(0,40)}`);
      });
    }
    if (nc.content_ratio_constraints) {
      Object.entries(nc.content_ratio_constraints).forEach(([k,v]) => {
        console.log(`  ${chalk.cyan(k+':')} ${chalk.green(v)}`);
      });
    }
  }
  
  // 验证检查清单
  printSection('✅', 'VERIFICATION CHECKLIST — 如何判断Agent4正常工作');
  
  const checks = [
    ['Strategy Card 生成', !!goalResult.strategic_bet],
    ['10个平台都在', (channelResult.channel_mix?.length || 0) >= 10],
    ['预算分配=100%', Math.abs((owned+paid+earned)/total - 1) < 0.01],
    ['Stop/Scale决策有效', !!decisionResult.primary_decision?.decision],
    ['版本Diff有变更', (v2.created?.changes_summary?.length || 0) > 0],
    ['Narrative约束已生成', !!nc],
  ];
  
  checks.forEach(([label, ok]) => {
    printStatus(label, ok);
  });
  
  // 输出文件
  console.log(chalk.bold('\n' + '='.repeat(56)));
  console.log(chalk.cyan(`  📁 输出文件: mock-data/agent4-complete-output.json`));
  console.log(chalk.green(`  ✅ Agent 4 执行完成`) + chalk.gray(' — ' + new Date().toLocaleTimeString('zh-CN', {timeZone:'Asia/Shanghai'})));
  console.log(chalk.bold('='.repeat(56)));
  
  // 保存
  const output = {
    timestamp: new Date().toISOString(),
    summary: {
      strategy_card: {
        id: 'STR-001',
        version: v2.created?.version || 'v2',
        strategic_bet: goalResult.strategic_bet?.bet_on,
        value_proposition: vpResult.tagline,
        channel_count: channelResult.channel_mix?.length || 0,
        total_budget: total,
        decision: decisionResult.primary_decision?.decision
      },
      verification: checks.map(([label, ok]) => ({ label, pass: ok })),
      routing_tasks: routingResult.downstream_tasks?.length || 0
    }
  };
  fs.writeFileSync('./mock-data/agent4-complete-output.json', JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error(chalk.red('\n✗ 执行失败:'), err.message);
  process.exit(1);
});
