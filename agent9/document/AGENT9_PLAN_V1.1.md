# Agent 9 v1.1 实施计划

> 版本：v1.1
> 状态：修订版（基于"路由范围"问题重新设计）
> 核心变化：决策接口预埋 + 路由写文件 + 接收方激活条件明确
> 目标：路由范围合理，不产生孤儿文件，不引入新风险

---

## 一、核心决策：路由范围的重新设计

### v0.2 的错误设计

```
decision-dispenser.js 路由到 Agent4/6/7
→ 写文件 output/decisions/from-agent9/agent4/latest.json
→ agent4-core.js 没有读取这个文件的逻辑
→ 文件变成孤儿，无人认领
→ 团队以为决策已下发，实际完全没生效
```

### v1.1 的正确设计

把"写决策文件"和"对方读取文件"拆成两个独立动作：

```
Agent 9 → 写决策文件（v1.1 做）
           ↓
        Agent 4/6/7 → 各自 SPEC 里定义"我会读这个文件"（未来做）
           ↓
        激活条件：对方 SPEC 更新 + 对方代码实现 = 环路闭环
```

**v1.1 Agent 9 做的**：写文件到约定路径，发消息告知对方 Agent。
**未来 Agent 4/6/7 做的**：在各自 SPEC 里声明接收接口，实现读取逻辑。

这样设计的好处：
- 不产生孤儿文件（因为不声称"已送达"）
- 不需要等 Agent 4/6/7 开发完才能完成 Agent 9
- 接口是预埋的，未来接上就能用

---

## 二、决策路由架构（v1.1）

### 路由矩阵

| 目标 Agent | 决策类型 | v1.1 写文件 | 对方接收状态 |
|-----------|---------|------------|------------|
| Agent 4 | strategy_shift | ✅ 写 | ⏳ 等 SPEC 更新 |
| Agent 5 | topic_boost | ✅ 写 | ✅ 已有接收逻辑 |
| Agent 6 | content_adjust | ✅ 写 | ⏳ 等 SPEC 更新 |
| Agent 7 | format_suggest | ✅ 写 | ⏳ 等 SPEC 更新 |
| Agent 8 | channel_hint | ✅ 写 | ⏳ 等 SPEC 更新 |

### 决策文件格式（统一）

```javascript
// output/decisions/from-agent9/{agentId}/latest.json
{
  "decisions": [
    {
      "id": "DEC-2026-07-02-001",
      "type": "topic_boost",       // topic_boost | strategy_shift | content_adjust | format_suggest | channel_hint
      "source": "agent9",
      "target": "agent5",
      "topic_id": "TOPIC-xxx",
      "decision": "SCALE",
      "boost_score": 1.2,
      "reason": "CTR 7.2% vs 平台基准 3.5%，ratio=2.06",
      "confidence": 0.75,
      "recommended_action": "增加该选题内容产出频率",
      "expires_at": "2026-07-03T17:00:00+08:00",   // 24h TTL
      "created_at": "2026-07-02T17:00:00+08:00",
      "__mock__: false,
      "__source__: "agent9_attribution_engine"
    }
  ],
  "metadata": {
    "total_decisions": 1,
    "by_target_agent": { "agent5": 1 }
  }
}
```

### 每个 Decision 类型对应的含义

| Decision 类型 | 触发条件 | 告诉对方什么 |
|-------------|---------|------------|
| `topic_boost` | topic 综合 CTR 偏离基准 | 调整这个选题的 Boost |
| `strategy_shift` | 跨选题的规律性模式（如所有技术选题都低迷） | 调整策略约束 |
| `content_adjust` | 某篇具体文章数据异常 | 调整这篇内容的写法 |
| `format_suggest` | 内容形式效果差异显著 | 换一种内容形式 |
| `channel_hint` | 某些平台持续表现差 | 减少该平台分发 |

---

## 三、Agent 5 完整接收流程（v1.1 重点）

Agent 5 是唯一已有接收逻辑的，是 v1.0 端到端验证的目标。

### Agent 5 调用路径

```
Agent 9 attribution-engine 运行
  → 写 output/decisions/from-agent9/agent5/latest.json
  → 同时写 output/topic-boosts/_latest/{topic_id}.json
  ↓
Agent 5 下次运行（runAgent5）
  → loadFeedbackFromAgent9() 被调用
  → 读取 agent9/output/topic-boosts/_latest/*.json
  → 转换为 Agent5 格式的 Boost 信号
  → 与 getMockFeedbackSignals() 结果合并
  → 影响下一次的 distribution-map.json
  ↓
验证方式：对比有 Agent9 数据 vs 无 Agent9 数据的 distribution-map 差异
```

### Agent 5 的 Boost 合并逻辑

```javascript
// agent5-core.js loadFeedbackFromAgent9() 改造
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR
    || path.join(__dirname, '../../risen-agent9/output');
  let boostFiles;
  try {
    boostFiles = fs.readdirSync(dir + '/topic-boosts/_latest/')
      .filter(f => f.endsWith('.json'))
      .map(f => dir + '/topic-boosts/_latest/' + f);
  } catch (e) {
    boostFiles = [];
  }
  if (boostFiles.length === 0) {
    console.warn('[Agent5] ⚠️ Agent9 数据不可用，fallback 到 Mock');
    return null;
  }
  const boosts = boostFiles.map(f => {
    const b = JSON.parse(fs.readFileSync(f, 'utf8'));
    return {
      topic_id: b.topic_id,
      engagement_score: b.boost_score,
      decision: b.decision,           // 新增
      confidence: b.confidence,        // 新增
      data_source: '__agent9__',
      computed_at: b.computed_at
    };
  });
  console.log(`[Agent5] ✅ 读取 ${boosts.length} 条 Agent9 Boost 数据`);
  return boosts;
}

// 在 runAgent5() 中合并
const agent9Boosts = loadFeedbackFromAgent9();
const mockSignals = getMockFeedbackSignals();
// 如果有 Agent9 数据，以 Agent9 为准（真实数据优先）
const effectiveSignals = agent9Boosts || mockSignals;
// 用 effectiveSignals 参与 distribution-map 生成
```

---

## 四、Agent 4/6/7/8 决策接口预埋

### 预埋接口（v1.1 完成，不等对方）

在 `risen-agent9/output/decisions/from-agent9/` 下按 Agent 分别写文件：

```
output/decisions/from-agent9/
├── agent4/latest.json    # strategy_shift 决策
├── agent5/latest.json    # topic_boost 决策 ✅ 对方会读
├── agent6/latest.json    # content_adjust 决策
├── agent7/latest.json    # format_suggest 决策
└── agent8/latest.json    # channel_hint 决策
```

### 激活条件（需要对方完成）

| Agent | 激活条件 | 需要对方做的 |
|-------|---------|-----------|
| Agent 5 | ✅ 已满足 | 无，v1.1 直接连通 |
| Agent 4 | Agent 4 SPEC 更新声明接收接口 | `loadAgent9Decisions()` |
| Agent 6 | Agent 6 SPEC 更新声明接收接口 | `loadAgent9Decisions()` |
| Agent 7 | Agent 7 完整定义（含反馈闭环） | 新增接收逻辑 |
| Agent 8 | Agent 8 开发时声明接收接口 | `loadAgent9ChannelHints()` |

### 预埋接口文档

```markdown
## Agent 9 → Agent X 决策接口（预埋）

### 文件路径
`{AGENT9_OUTPUT_DIR}/decisions/from-agent9/{agentId}/latest.json`

### 读取方式
每个 Agent 在自己 SPEC 里声明：
```javascript
function loadAgent9Decisions() {
  const dir = process.env.AGENT9_OUTPUT_DIR || path.join(__dirname, '../../risen-agent9/output');
  const file = `${dir}/decisions/from-agent9/{agentId}/latest.json`;
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  // 过滤过期决策
  const now = new Date();
  return data.decisions.filter(d => new Date(d.expires_at) > now);
}
```

### 激活条件
- Agent SPEC 更新声明接收该接口
- Agent 代码实现 `loadAgent9Decisions()`
```

---

## 五、归因引擎核心设计（v1.1）

与 v1.0 一致，核心改进保留：

### 归因公式（行业基准，非自创）

```javascript
// 不用自创公式，用"相对平台基准倍数"
const ratio = avgCTR / platformBenchmark.avgCTR;
// ratio > 1 → 超过平台平均
// ratio > 2 → 超过平台优秀基准

if (ratio >= 2.0)      return { score: 1.2, decision: 'SCALE' };
else if (ratio >= 1.0) return { score: 1.0, decision: 'CONTINUE' };
else if (ratio >= 0.5) return { score: 0.8, decision: 'REDUCE' };
else                     return { score: 0.0, decision: 'STOP' };
```

### 平台基准（行业公开数据）

| 平台 | 平均 CTR | 优秀 CTR | 数据来源 |
|------|---------|---------|---------|
| 微信公众号 | 2.5% | 5% | 行业公开报告 |
| 知乎 | 3.5% | 7% | 平台公开数据 |
| CSDN/掘金 | 3.0% | 6% | 技术社区统计 |
| Dev.to | 2.0% | 4% | 官方博客 |
| LinkedIn | 2.0% | 4% | LinkedIn 营销博客 |
| GitHub | 不用 CTR | 用 Star Rate | — |

### 三模型可插拔

```javascript
// attribution-config.json
{
  "model": "linear",        // 切模型只改这一行
  "models": {
    "linear": {
      "description": "平均分配权重，适合初期数据"
    },
    "time_decay": {
      "description": "近期内容权重更高",
      "params": { "halfLifeDays": 7 }
    },
    "position_based": {
      "description": "首尾内容各40%权重",
      "params": { "firstWeight": 0.4, "lastWeight": 0.4 }
    }
  }
}
```

---

## 六、决策 TTL 设计

所有 Decision 带 24h TTL，防止过期数据被读取：

```javascript
function makeDecision(decision) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    ...decision,
    id: `DEC-${formatDate(now)}-${randomId(4)}`,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString()   // 24小时后过期
  };
}
```

消费方必须检查 `expires_at`：

```javascript
function loadAgent9Decisions(agentId) {
  const file = `${dir}/decisions/from-agent9/${agentId}/latest.json`;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const now = new Date();
  return data.decisions.filter(d => new Date(d.expires_at) > now);
}
```

---

## 七、M0 前置修复（不变）

### M0.1：Agent 6 加 topic_id + direction_id

```javascript
// /workspace/RISEN-OS/agent6/agent6-core.js 约第208行
const article = {
  article_id: generateArticleId(),
  topic_id: topicBrief.topic_id,         // ← 新增
  direction_id: topicBrief.direction_id,  // ← 新增
  // ...
};
```

### M0.2：Agent 5 加 loadFeedbackFromAgent9()

```javascript
// /workspace/RISEN-OS/agent5/agent5-core.js
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR
    || path.join(__dirname, '../../risen-agent9/output');
  let files;
  try {
    files = fs.readdirSync(dir + '/topic-boosts/_latest/')
      .filter(f => f.endsWith('.json'))
      .map(f => dir + '/topic-boosts/_latest/' + f);
  } catch (e) { files = []; }
  if (files.length === 0) {
    console.warn('[Agent5] ⚠️ Agent9 数据不可用，fallback 到 Mock');
    return null;
  }
  return files.map(f => {
    const b = JSON.parse(fs.readFileSync(f, 'utf8'));
    return {
      topic_id: b.topic_id,
      engagement_score: b.boost_score,
      decision: b.decision,
      confidence: b.confidence,
      data_source: '__agent9__',
      computed_at: b.computed_at
    };
  });
}
```

---

## 八、里程碑

### M0：前置修复（0.5小时）
- [ ] Agent 6 article 加 `topic_id` + `direction_id`（2行）
- [ ] Agent 5 加 `loadFeedbackFromAgent9()`（~20行，含 warn）

### M1：骨架 + 配置层（2小时）
- [ ] 目录结构
- [ ] `attribution-config.json`（模型+基准+阈值，完全可配置）
- [ ] `platform-meta.json`（~30个 P0/P1 平台）
- [ ] 三个归因模型（Linear/Time-Decay/Position-Based，接口统一）
- [ ] `platform-meta-loader.js`

### M2：归因引擎 + Insight（3小时）
- [ ] `attribution-engine.js`（模型可插拔版）
- [ ] `boost-calculator.js`
- [ ] `stats-helpers.js`（置信度计算）
- [ ] `insight-generator.js`
- [ ] Mock 数据按平台基准正态分布生成

### M3：决策路由 + 预埋接口（2小时）
- [ ] `decision-dispenser.js`（5个 Agent 全部写文件）
- [ ] 预埋接口文档（`DECISION_INTERFACE.md`）
- [ ] `FEEDBACK_CONTRACT.md` 补充 Agent 8 接口契约
- [ ] Decision 文件 TTL 实现（24h 过期）

### M4：端到端验证（2小时）
- [ ] Agent 9 → Agent 5 完整闭环验证
- [ ] Boost 分布合理性检查（应有 SCALE/CONTINUE/REDUCE/STOP）
- [ ] Decision TTL 过期验证
- [ ] `ATTRIBUTION_MODELS.md`
- [ ] `PLATFORM_BENCHMARKS.md`

---

## 九、与 v1.0 的差异

| 维度 | v1.0 | v1.1 |
|------|-------|-------|
| 路由范围 | 只到 Agent5 | **到所有 5 个 Agent（写文件）** |
| Agent 4/6/7/8 | 不写文件 | **写文件（预埋接口）** |
| 环路状态 | 只 Agent5 闭环 | Agent5 ✅，其他 ⏳ |
| 孤儿文件 | 无 | **无（接口预埋，不声称送达）** |
| 接收激活 | — | 等对方 SPEC 更新 |

---

## 十、v1.1 明确不引入的风险

| 风险 | 状态 |
|------|------|
| 孤儿文件（写了没人读） | ✅ 不产生，预埋接口而非声称送达 |
| Agent 4/6/7 无接收能力 | ✅ 预埋接口，等对方 SPEC 更新再激活 |
| 自创归因公式 | ✅ 已修复，用行业基准倍数 |
| Mock fallback 静默 | ✅ 加 warn 日志 |
| 新依赖引入 | ✅ 无新增依赖 |
| 参数不可配置 | ✅ attribution-config.json 完全可配置 |

---

*本文档为 v1.1 实施计划，修复了 v1.0"只到 Agent5"的过度保守设计，同时不引入孤儿文件风险。*
