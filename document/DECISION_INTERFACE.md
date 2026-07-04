# Decision 接口文档

> 版本：v1.2
> 状态：最终版
> Agent 9 输出，Agent 4/5/6/7 消费

---

## 1. 文件路径

```
${AGENT9_OUTPUT_DIR}/decisions/from-agent9/{agentId}/
├── latest.json          # 最近5条（含 history 字段）
└── history/
    └── {topic_id}.json  # 该 topic 的历史存档（最多20条）
```

---

## 2. latest.json 格式（v1.2）

```json
{
  "version": "1.2",
  "decisions": [
    {
      "id": "DEC-20260703-1145-3847",
      "type": "topic_boost",
      "source": "agent9",
      "target": "agent5",
      "topic_id": "TOPIC-001",
      "decision": "SCALE",
      "boost_score": 1.2,
      "reason": "CTR 显著高于平台基准，建议扩大该选题的内容产出",
      "confidence": 0.75,
      "recommended_action": "SCALE",
      "created_at": "2026-07-03T11:45:00+08:00",
      "deduplication_key": "TOPIC-001:SCALE",
      "__retrospective__": false,
      "history": [
        {
          "decision": "CONTINUE",
          "created_at": "2026-07-02T10:00:00+08:00",
          "archived_at": "2026-07-03T11:45:00+08:00"
        }
      ]
    }
  ],
  "metadata": {
    "interface_version": "1.2",
    "total_decisions": 1,
    "computed_at": "2026-07-03T11:45:00+08:00",
    "run_mode": "dev"
  }
}
```

---

## 3. 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 格式：`DEC-{YYYYMMDD}-{HHmm}-{ssss}` |
| `type` | string | ✅ | `topic_boost` \| `content_adjust` \| `strategy_shift` |
| `source` | string | ✅ | 固定值：`agent9` |
| `target` | string | ✅ | `agent4` \| `agent5` \| `agent6` \| `agent7` |
| `topic_id` | string | ✅ | 选题 ID |
| `decision` | string | ✅ | `SCALE` \| `CONTINUE` \| `REDUCE` \| `STOP` |
| `boost_score` | number | ✅ | 0.0 ~ 1.2 |
| `reason` | string | ✅ | 人类可读的原因说明 |
| `confidence` | number | ✅ | 0.45 ~ 0.95 |
| `recommended_action` | string | ✅ | 与 `decision` 相同，CONTINUE 时为 `REVIEW` |
| `created_at` | string | ✅ | ISO 8601（+08:00） |
| `deduplication_key` | string | ✅ | 见"去重逻辑"节 |
| `__retrospective__` | boolean | ✅ | 是否为回溯修正结果 |
| `history` | array | ✅ | 该 topic 最近5条历史决策 |

---

## 4. deduplication_key 去重逻辑

| 类型 | 格式 | 说明 |
|------|------|------|
| TopicBoost | `{topic_id}:{decision}` | 如 `TOPIC-001:SCALE` |
| Insight | `{topic_id}:{agent}:{action}` | 如 `TOPIC-001:agent6:PROMOTE_FORM` |

**去重规则：**
- 同一 `deduplication_key` 保留时间最新的一条
- 同 Topic 可同时存在 `SCALE` 和 `REDUCE（不去重）
- 不同 `deduplication_key` 信号可共存

**示例（同一 topic 的双向信号）：**
```
TOPIC-001:SCALE    → 建议扩大
TOPIC-001:REDUCE   → 建议收缩
```
两者同时存在，Consumer 自行决定优先级。

---

## 5. 版本历史

| 版本 | 变更 |
|------|------|
| v1.0 | 初始格式，`deduplication_key` 未引入 |
| v1.1 | 新增 `deduplication_key`、`__retrospective__`、`deduplication` |
| v1.2 | 新增 `history[]` 数组，latest.json 保留最近5条记录 |

---

## 6. Consumer 读取注意

### 6.1 必须检查 version

```javascript
const data = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
if (!data.metadata?.interface_version?.startsWith('1.')) {
  console.warn('[Consumer] ⚠️  Decision 接口版本不兼容');
}
```

### 6.2 多平台时 platform_avg_ctr 为 null

```javascript
if (boost.platform_avg_ctr === null) {
  // 多平台聚合时，无法用单一基准
  // 使用 z_score 或 ratio_to_benchmark
  const signal = boost.z_score ?? boost.ratio_to_benchmark;
}
```

### 6.3 __retrospective__ 标识

```javascript
if (boost.__retrospective__) {
  console.log('[Consumer] ℹ️  这是回溯修正结果，基于更多历史数据重新计算');
}
```

### 6.4 读取 latest.json 示例（Agent 5）

```javascript
function readAgent9Decisions() {
  const dir = process.env.AGENT9_OUTPUT_DIR;
  const latestPath = `${dir}/decisions/from-agent9/agent5/latest.json`;
  if (!fs.existsSync(latestPath)) return [];
  const data = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
  return data.decisions || [];
}
```

---

## 7. 激活条件

| Agent | 类型 | 激活条件 |
|-------|------|---------|
| Agent 5 | topic_boost | ✅ 直接可用，`loadFeedbackFromAgent9()` 已实现 |
| Agent 6 | content_adjust | 等 Agent 6 实现消费逻辑 |
| Agent 4 | strategy_shift | 等 Agent 4 SPEC 更新 |
| Agent 7 | format_suggest | 等 Agent 7 完整定义 |

---

## 8. Agent 9 决策下发流程

```
Step 4: decision-dispenser.dispatch()
         │
         ├─ _filterByMode()      ← dev: 通过 / prod: 过滤 __mock__
         ├─ _deduplicate()        ← 按 deduplication_key 去重
         ├─ _writeDecisionFile()
         │    ├─ latest.json      ← 保留最近5条
         │    └─ history/         ← 追加存档（最多20条）
         └─ 输出 → {agent4,agent5,agent6,agent7}/latest.json
```
