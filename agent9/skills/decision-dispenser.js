/**
 * Skill 4: Decision Dispenser
 * 决策下发器
 *
 * 核心设计：
 * 1. dev/prod 模式：prod 模式拒绝 __mock__: true 的数据
 * 2. 去重：deduplication_key = topic_id:decision（TopicBoost）
 *                              topic_id:agent:action（Insight）
 * 3. 同 Topic 可同时存在 SCALE 和 REDUCE（不去重双向信号）
 * 4. 历史链：latest.json 保留最近5条，history/{topic_id}.json 追加存档（最多20条）
 */
const fs = require('fs');
const path = require('path');

const TARGET_AGENTS = { agent4: true, agent5: true, agent6: true, agent7: true };

function makeDecisionId() {
  const d = new Date();
  const pad = (n, w) => String(n).padStart(w, '0');
  return [
    'DEC',
    `${d.getFullYear()}${pad(d.getMonth()+1,2)}${pad(d.getDate(),2)}`,
    `${pad(d.getHours(),2)}${pad(d.getMinutes(),2)}`,
    pad(Math.floor(Math.random() * 9999), 4)
  ].join('-');
}

class DecisionDispenser {
  constructor({ config, outputDir }) {
    this.config = config;
    this.outputDir = outputDir || process.env.AGENT9_OUTPUT_DIR
      || path.join(__dirname, '..', 'output');
    this.runMode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
  }

  async dispatch({ topicBoosts, insights }) {
    const filtered = this._filterByMode(topicBoosts);
    const decisions = [];
    for (const boost of filtered) decisions.push(this._boostToDecision(boost));
    for (const insight of insights) {
      if (insight.target_agent && insight.target_agent !== 'agent5') {
        decisions.push(this._insightToDecision(insight));
      }
    }
    const unique = this._deduplicate(decisions);
    const byAgent = {};
    for (const d of unique) {
      if (!TARGET_AGENTS[d.target]) continue;
      (byAgent[d.target] = byAgent[d.target] || []).push(d);
    }
    for (const [agentId, agentDecisions] of Object.entries(byAgent)) {
      await this._writeDecisionFile(agentId, agentDecisions);
    }
  }

  _filterByMode(items) {
    if (this.runMode !== 'prod') return items;
    return items.filter(item => {
      if (item.__mock__) {
        console.error(`[Dispenser] ❌ [prod] 拒绝 Mock: ${item.topic_id}`);
        return false;
      }
      return true;
    });
  }

  _deduplicate(decisions) {
    const seen = new Map();
    for (const d of decisions) {
      const existing = seen.get(d.deduplication_key);
      if (!existing) { seen.set(d.deduplication_key, d); continue; }
      if (new Date(d.created_at) > new Date(existing.created_at)) seen.set(d.deduplication_key, d);
    }
    return Array.from(seen.values());
  }

  _boostToDecision(boost) {
    const messages = {
      SCALE:   'CTR 显著高于平台基准，建议扩大该选题的内容产出',
      CONTINUE:'CTR 接近平台基准，继续保持当前节奏',
      REDUCE:  'CTR 低于平台基准，建议减少该选题的内容投入',
      STOP:    'CTR 远低于平台基准，建议暂停该选题'
    };
    return {
      id: makeDecisionId(),
      type: 'topic_boost',
      source: 'agent9',
      target: 'agent5',
      topic_id: boost.topic_id,
      decision: boost.decision,
      boost_score: boost.boost_score,
      reason: messages[boost.decision],
      confidence: boost.confidence,
      recommended_action: boost.decision === 'CONTINUE' ? 'REVIEW' : boost.decision,
      created_at: new Date().toISOString(),
      deduplication_key: `${boost.topic_id}:${boost.decision}`,
      __retrospective__: boost.__retrospective__ || false,
      history: []
    };
  }

  _insightToDecision(insight) {
    return {
      id: makeDecisionId(),
      type: insight.type === 'content_form_analysis' ? 'content_adjust' : 'strategy_shift',
      source: 'agent9',
      target: insight.target_agent,
      topic_id: insight.topic_id,
      decision: insight.recommended_action === 'SCALE' ? 'SCALE' :
                insight.recommended_action === 'REDUCE' ? 'REDUCE' : 'CONTINUE',
      boost_score: 1.0,
      reason: insight.summary,
      confidence: insight.confidence,
      recommended_action: insight.recommended_action,
      created_at: new Date().toISOString(),
      deduplication_key: `${insight.topic_id}:${insight.target_agent}:${insight.recommended_action}`,
      __retrospective__: false,
      history: []
    };
  }

  async _writeDecisionFile(agentId, decisions) {
    const dir = path.join(this.outputDir, 'decisions', 'from-agent9', agentId);
    fs.mkdirSync(dir, { recursive: true });

    // 读取历史 latest
    const latestPath = path.join(dir, 'latest.json');
    let existing = [];
    if (fs.existsSync(latestPath)) {
      try { existing = JSON.parse(fs.readFileSync(latestPath, 'utf8')).decisions || []; }
      catch { existing = []; }
    }

    // 合并：同 key 保留最新，旧的进入 history
    const merged = new Map();
    for (const d of existing) merged.set(d.deduplication_key, d);
    for (const d of decisions) {
      if (merged.has(d.deduplication_key)) {
        this._appendHistory(agentId, merged.get(d.deduplication_key));
      }
      merged.set(d.deduplication_key, d);
    }

    // latest.json 保留最近 5 条
    const latestDecisions = Array.from(merged.values()).slice(-5);
    for (const d of latestDecisions) {
      d.history = this._loadHistory(agentId, d.topic_id);
    }

    const data = {
      version: '1.2',
      decisions: latestDecisions,
      metadata: {
        interface_version: '1.2',
        total_decisions: latestDecisions.length,
        computed_at: new Date().toISOString(),
        run_mode: this.runMode
      }
    };
    fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
    console.log(`[Dispenser] ✅ → ${agentId}: ${latestDecisions.length} 条决策（含历史链）`);
  }

  _appendHistory(agentId, decision) {
    const histDir = path.join(this.outputDir, 'decisions', 'from-agent9', agentId, 'history');
    fs.mkdirSync(histDir, { recursive: true });
    const histPath = path.join(histDir, `${decision.topic_id}.json`);
    let history = [];
    if (fs.existsSync(histPath)) {
      try { history = JSON.parse(fs.readFileSync(histPath, 'utf8')); }
      catch { history = []; }
    }
    history.push({ ...decision, archived_at: new Date().toISOString() });
    if (history.length > 20) history = history.slice(-20);
    fs.writeFileSync(histPath, JSON.stringify(history, null, 2));
  }

  _loadHistory(agentId, topicId) {
    const histPath = path.join(this.outputDir, 'decisions', 'from-agent9', agentId, 'history', `${topicId}.json`);
    if (!fs.existsSync(histPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(histPath, 'utf8')).slice(-5);
    } catch { return []; }
  }
}

module.exports = DecisionDispenser;
