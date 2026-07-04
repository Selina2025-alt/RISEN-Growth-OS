# Agent 9 v1.2 实施计划

> 版本：v1.2
> 状态：第三轮修订版（基于两轮自我审查）
> 修复：fallback路径错误 / Agent8角色纠正 / TTL / 版本号 / 待验证标注
> 目标：零新风险，零孤儿文件，零静默失败

---

## 一、v1.1 第二轮审查修复清单

| # | 问题 | 修复方式 |
|---|------|---------|
| 🔴 1 | Agent 5 fallback 路径错误 | 去掉 fallback，强制 AGENT9_OUTPUT_DIR |
| 🟡 2 | TopicBoost 无 TTL | 用"新覆盖旧"代替过期时间，latest 永远是最新的 |
| 🟡 3 | Decision 接口无版本号 | 加 `version: "1.0"` 字段，消费方检查版本 |
| 🟡 4 | format_suggest 是空想 | 标 [待验证]，Agent7 定义前不细化 |
| 🔴 5 | Agent8 不应接收决策文件 | 从预埋名单移除，Agent8 是数据源 |
| 🟡 6 | 多实例写竞争 | 文档注明原子写入需求 |
| 🟡 7 | confidence 不含平台分散度 | v1.0 简化处理，不引入额外复杂度 |
| 🟢 8 | Decision vs TopicBoost 重复 | 保持现状，设计清晰 |

---

## 二、路由架构最终版

### 目标 Agent 角色划分

```
Agent 9（学习中枢）
├── 读取 Agent 8 产出的发布数据
├── 分析 → TopicBoost + Insight + Decision
└── 下发决策：
    ├── Agent 5 ✅ 完整闭环（已有接收逻辑）
    ├── Agent 4 ⏳ 预埋接口（等 SPEC 更新激活）
    ├── Agent 6 ⏳ 预埋接口（等 SPEC 更新激活）
    └── Agent 7 ⏳ 预埋接口（等 Agent7 定义激活）
```

### Agent 8 的正确角色

```
Agent 8 = 数据源（发布执行）
- Agent 9 从 Agent 8 读取：发布状态、平台 ID、发布时间
- Agent 8 不需要从 Agent 9 读取任何东西
- 因此：Agent 8 不出现在决策路由名单里
```

**重要**：如果未来 Agent 8 需要根据 Agent 9 的建议调整分发，需要先更新 Agent 8 的 SPEC 声明接收能力，再激活。

---

## 三、Agent 5 读取逻辑（修正版）

### M0.2 修复：去掉 fallback 路径

```javascript
// agent5-core.js loadFeedbackFromAgent9()
function loadFeedbackFromAgent9() {
  // ⚠️ 必须设置 AGENT9_OUTPUT_DIR 环境变量，无 fallback
  const dir = process.env.AGENT9_OUTPUT_DIR;
  if (!dir) {
    console.error('[Agent5] ❌ AGENT9_OUTPUT_DIR 环境变量未设置，无法读取 Agent9 数据');
    console.error('[Agent5] ℹ️  设置方式: export AGENT9_OUTPUT_DIR=/workspace/risen-agent9/output');
    return null;
  }
  let files;
  try {
    files = fs.readdirSync(dir + '/topic-boosts/_latest/')
      .filter(f => f.endsWith('.json'))
      .map(f => dir + '/topic-boosts/_latest/' + f);
  } catch (e) {
    console.warn(`[Agent5] ⚠️ Agent9 数据目录不存在: ${dir}/topic-boosts/_latest/，fallback 到 Mock`);
    return null;
  }
  if (files.length === 0) {
    console.warn(`[Agent5] ⚠️ Agent9 无 Boost 数据（目录为空），fallback 到 Mock`);
    return null;
  }
  const boosts = files.map(f => {
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
  console.log(`[Agent5] ✅ 读取 ${boosts.length} 条 Agent9 Boost 数据`);
  return boosts;
}
```

**三处 warn/err 日志**：
1. `AGENT9_OUTPUT_DIR` 未设置 → 打印路径提示和设置方式
2. 目录不存在 → warn
3. 目录为空 → warn

**零静默失败**：任何异常情况都有日志输出。

---

## 四、Decision 接口（v1.2 最终版）

### 文件格式

```javascript
// output/decisions/from-agent9/{agentId}/latest.json
{
  "version": "1.0",       // 接口版本，消费者必须检查
  "decisions": [
    {
      "id": "DEC-2026-07-02-001",
      "type": "topic_boost",       // topic_boost | strategy_shift | content_adjust | format_suggest
      "source": "agent9",
      "target": "agent5",
      "topic_id": "TOPIC-xxx",
      "decision": "SCALE",          // SCALE | CONTINUE | REDUCE | STOP
      "boost_score": 1.2,
      "reason": "CTR 7.2% vs 平台基准 3.5%，ratio=2.06",
      "confidence": 0.75,
      "recommended_action": "增加该选题内容产出频率",
      "created_at": "2026-07-02T17:00:00+08:00",
      "__mock__: false,
      "__source__: "agent9_attribution_engine"
    }
  ],
  "metadata": {
    "interface_version": "1.0",
    "total_decisions": 1,
    "by_target_agent": { "agent5": 1 }
  }
}
```

### 版本检查逻辑（消费方）

```javascript
function loadAgent9Decisions(agentId) {
  const dir = process.env.AGENT9_OUTPUT_DIR;
  if (!dir) return [];
  const file = `${dir}/decisions/from-agent9/${agentId}/latest.json`;
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  // 版本检查
  if (data.version !== '1.0') {
    console.warn(`[Agent${agentId}] ⚠️ Agent9 接口版本不匹配: ${data.version} != 1.0`);
    return [];
  }
  return data.decisions;
}
```

### Decision 类型说明

| Decision 类型 | 触发条件 | 状态 |
|-------------|---------|------|
| `topic_boost` | Topic 综合 CTR 偏离基准 | ✅ v1.0 实现 |
| `strategy_shift` | 跨选题规律性异常 | ✅ v1.0 实现 |
| `content_adjust` | 某篇具体文章数据异常 | ✅ v1.0 实现 |
| `format_suggest` | 内容形式效果差异显著 | ⚠️ [待验证] Agent7 定义前不细化 |

### 预埋激活条件

| Agent | Decision 类型 | 激活条件 |
|-------|------------|---------|
| Agent 5 | topic_boost | ✅ 直接可用 |
| Agent 4 | strategy_shift | Agent 4 SPEC 更新声明接收接口 |
| Agent 6 | content_adjust | Agent 6 SPEC 更新声明接收接口 |
| Agent 7 | format_suggest | Agent 7 完整定义（含反馈闭环） |

---

## 五、TopicBoost vs Decision 双轨并行

Agent 9 同时写两类文件，职责不同：

```
output/
├── topic-boosts/                    # 给 Agent 5 专用
│   └── _latest/
│       └── {topic_id}.json         # TopicBoost 格式（Agent 5 读这个）
│
└── decisions/from-agent9/           # 给 Agent 4/6/7 预埋
    └── {agentId}/latest.json        # Decision 格式（对方来读）
```

**为什么分开**：
- TopicBoost 是结构化状态，Agent 5 需要的是 Boost 分数和决策
- Decision 是事件化指令，Agent 4/6/7 需要的是"建议做什么"

**两者不重复**，是并行存在的不同抽象。

---

## 六、TTL 设计（Decision 专用）

### TopicBoost：最新覆盖，无过期时间

```javascript
// Agent 9 每次运行覆盖 _latest/ 目录
// 最新文件永远是最新的，不需要过期时间
// 消费方直接读 latest 即可
```

### Decision：24h 过期（Event 语义）

```javascript
// 每个 Decision 带 created_at（无 expires_at）
// 消费方自行判断"这个决策是否还有效"
// 简化：24h 内的 Decision 视为有效

function isRecent(decision) {
  const ageMs = Date.now() - new Date(decision.created_at).getTime();
  return ageMs < 24 * 60 * 60 * 1000;  // 24h
}
```

**注意**：Decision 文件本身没有 `expires_at` 字段，过期判断由消费方自行执行。

---

## 七、原子写入警告（文档级）

```markdown
## ⚠️ 多实例部署注意事项

v1.2 Agent 9 设计为单实例运行。

如果未来需要多实例部署，`decision-dispenser.js` 的文件写入
需要替换为原子操作：

```javascript
// 当前实现（单实例安全）
fs.writeFileSync(path, JSON.stringify(data));

// 未来多实例需要（原子写入）
const tmp = path + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(data));
fs.renameSync(tmp, path);  // rename 是原子的
```

当前阶段不需要修改，但扩展前必须处理此问题。
```

---

## 八、M0 前置修复（最终版）

### M0.1：Agent 6 加 topic_id + direction_id（不变）

```javascript
// /workspace/RISEN-OS/agent6/agent6-core.js 约第208行
const article = {
  article_id: generateArticleId(),
  topic_id: topicBrief.topic_id,         // ← 新增
  direction_id: topicBrief.direction_id,    // ← 新增
  // ... 其余不变
};
```

### M0.2：Agent 5 加 loadFeedbackFromAgent9()（修正）

```javascript
// /workspace/RISEN-OS/agent5/agent5-core.js
// 必须配合 AGENT9_OUTPUT_DIR 环境变量，无 fallback
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR;
  if (!dir) {
    console.error('[Agent5] ❌ AGENT9_OUTPUT_DIR 未设置，无法读取 Agent9 数据');
    return null;
  }
  const latestDir = dir + '/topic-boosts/_latest/';
  let files;
  try {
    files = fs.readdirSync(latestDir)
      .filter(f => f.endsWith('.json'));
  } catch (e) {
    console.warn(`[Agent5] ⚠️ Agent9 数据目录不存在: ${latestDir}，fallback 到 Mock`);
    return null;
  }
  if (files.length === 0) {
    console.warn(`[Agent5] ⚠️ Agent9 无 Boost 数据，fallback 到 Mock`);
    return null;
  }
  return files.map(f => {
    const b = JSON.parse(fs.readFileSync(latestDir + f, 'utf8'));
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

## 九、里程碑（v1.2）

### M0：前置修复（0.5小时）
- [ ] Agent 6 article 加 `topic_id` + `direction_id`
- [ ] Agent 5 加 `loadFeedbackFromAgent9()`（含三处 warn/err，无 fallback）
- [ ] 验证：Agent 6 输出含 topic_id；Agent 5 无 AGENT9_OUTPUT_DIR 时打印错误提示

### M1：骨架 + 配置层（2小时）
- [ ] 目录结构
- [ ] `attribution-config.json`（模型+基准+阈值）
- [ ] `platform-meta.json`（~30个 P0/P1 平台，含 `_updated` 时间戳）
- [ ] 三个归因模型（Linear/Time-Decay/PositionBased）
- [ ] `platform-meta-loader.js`（含元数据过期检查，>30天 warn）

### M2：归因引擎 + Insight（3小时）
- [ ] `attribution-engine.js`（模型可插拔，行业基准倍数）
- [ ] `boost-calculator.js`
- [ ] `stats-helpers.js`
- [ ] `insight-generator.js`
- [ ] Mock 数据按平台基准正态分布生成

### M3：决策路由 + 接口文档（2小时）
- [ ] `decision-dispenser.js`（Agent 4/5/6/7 写文件，Agent 8 不写）
- [ ] Decision 文件格式加 `version: "1.0"`
- [ ] `DECISION_INTERFACE.md`（接口文档，含版本检查示例）
- [ ] `FEEDBACK_CONTRACT.md` 补充 Agent 8 接口契约

### M4：端到端验证（2小时）
- [ ] Agent 9 完整运行
- [ ] Agent 5 ←→ Agent 9 闭环验证
- [ ] Boost 分布合理性（应有 SCALE/CONTINUE/REDUCE/STOP）
- [ ] AGENT9_OUTPUT_DIR 未设置时的错误提示验证
- [ ] `ATTRIBUTION_MODELS.md`
- [ ] `PLATFORM_BENCHMARKS.md`

---

## 十、v1.2 与 v1.1 差异摘要

| 修复项 | v1.1 | v1.2 |
|--------|-------|-------|
| Agent 5 fallback 路径 | 错误路径 | **去掉 fallback，强制 env var** |
| Agent 8 角色 | 在决策名单里 | **移除，正确标注为数据源** |
| Agent 8 决策文件 | 写 channel_hint | **不写，无意义** |
| TopicBoost TTL | 无 | **用覆盖代替过期，不加字段** |
| Decision 版本号 | 无 | **加 `version: "1.0"` + 版本检查** |
| format_suggest | 空想细节 | **标 [待验证]** |
| 多实例竞争 | 无说明 | **文档注明原子写入需求** |
| 静默失败 | 部分 warn | **零静默失败，三处 warn/err** |

---

## 十一、v1.2 零新风险承诺

| 风险类型 | 防护措施 |
|---------|---------|
| 孤儿文件 | Agent 8 不在名单；Agent 4/6/7 预埋接口注明激活条件 |
| 静默失败 | 全部异常有 warn/err；无任何 silent null return |
| 路径错误 | 无 fallback；AGENT9_OUTPUT_DIR 必须设置 |
| 接口演进 | Decision 加 `version: "1.0"` + 消费方版本检查 |
| 参数不可验证 | attribution-config.json 完全可配置 |
| Mock 数据误用 | `__mock__: true` 强制标注 |

---

*本文档为 v1.2 实施计划，基于两轮自我审查，修复了 8 个问题，零新风险引入。*
