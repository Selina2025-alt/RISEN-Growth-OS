# Agent 9 v0.1 实施计划

> 版本：v0.1
> 状态：初稿
> 目标：让 Agent 5 的选题 Boost 从 Mock 数据切换为 Agent 9 生成的模拟真实数据
> 完成后：Agent 5/6/9 形成第一条完整反馈闭环

---

## 一、目标定义

### v0.1 目标（一句话）

> **让 Agent 9 把"采集数据 → 分析归因 → 输出 Boost → 通知上游"这条链路跑通，Agent 5 的选题优先级第一次由数据驱动而非 Mock。**

### 验收标准

- [ ] `metric-collector.js` 能采集模拟平台数据（YouTube/微信/知乎/抖音），输出符合 `FEEDBACK_CONTRACT.md` 格式的 `ArticlePerformance`
- [ ] `attribution-engine.js` 能把 ArticlePerformance 归属到 Topic，建立 `TopicBoost`
- [ ] `decision-dispenser.js` 能把 TopicBoost 写入 Agent 5 可读的 JSON 文件
- [ ] `agent9-core.js` 能串联上述三个 Skill，输出完整闭环
- [ ] Agent 5 读取 Agent 9 的真实输出（而非 Mock），选题 Boost 发生变化
- [ ] 输出文件格式 100% 兼容 `FEEDBACK_CONTRACT.md`

---

## 二、架构设计

```
risen-agent9/
├── agent9-core.js              # 主入口，串联各 Skill
├── skills/
│   ├── metric-collector.js     # Skill 1：采集平台指标
│   ├── attribution-engine.js    # Skill 2：内容归因与 Boost 计算
│   └── decision-dispenser.js   # Skill 3：写回上游 Agent 文件
├── lib/
│   └── platform-adapters/       # 各平台适配器（v0.1 先做 Mock）
│       ├── youtube-mock.js
│       ├── wechat-mock.js
│       ├── zhihu-mock.js
│       └── douyin-mock.js
├── output/
│   ├── performances/           # ArticlePerformance JSON
│   ├── topic-boosts/            # TopicBoost JSON
│   └── insights/                # Insight JSON（v0.1 简化版）
└── document/
    ├── AGENT9_PLAN_V0.1.md
    └── AGENT9_SPEC.md
```

### 数据流

```
[平台 Mock]
    ↓
[metric-collector] → ArticlePerformance → output/performances/
    ↓
[attribution-engine] → TopicBoost + Insight → output/topic-boosts/ + output/insights/
    ↓
[decision-dispenser] → 写回 Agent 5 输出目录
    ↓
[Agent 5] 读取 TopicBoost → 调整选题 Boost → 影响分发路由
```

---

## 三、Skill 详细设计

### Skill 1 — metric-collector（指标采集）

**功能**：模拟从各平台采集文章表现数据。

**输入**：
```javascript
{
  campaignId: string,
  lookbackDays: number,   // 往前看多少天，默认 7
  platforms: string[]      // ['youtube', 'wechat_gzh', 'zhihu', 'douyin']
}
```

**输出**：符合 `FEEDBACK_CONTRACT.md` 的 `ArticlePerformance[]`

**Mock 策略**：
- v0.1 不接真实 API，用随机数模拟真实分布
- YouTube：impressions 500-50000，CTR 2%-15%
- 微信公众号：impressions 200-5000，CTR 1%-8%
- 知乎：impressions 300-8000，CTR 1%-10%
- 抖音：impressions 1000-100000，CTR 3%-20%

**平台适配器接口**（统一）：
```javascript
async function fetchArticleMetrics(articleId, dateRange) {
  return ArticlePerformance[] | null
}
```

---

### Skill 2 — attribution-engine（归因引擎）

**功能**：把 ArticlePerformance 归属到 Topic，计算 TopicBoost。

**输入**：
```javascript
{
  performances: ArticlePerformance[],
  topics: Topic[]        // 从 Agent 5 output 读取
}
```

**Boost 计算规则**（简化版，v0.1）：
```
avg_ctr >= 5%  → boost_score = 1.2，decision = 'SCALE'
avg_ctr 2%-5%  → boost_score = 1.0，decision = 'CONTINUE'
avg_ctr 0.5%-2% → boost_score = 0.8，decision = 'REDUCE'
avg_ctr < 0.5% → boost_score = 0.0，decision = 'STOP'
```

**输出**：
```javascript
TopicBoost {
  topic_id, topic_title, content_type,
  total_impressions, total_clicks, total_conversions,
  avg_ctr, article_count,
  boost_score, decision,
  source_articles: article_id[],
  computed_at
}
```

---

### Skill 3 — decision-dispenser（决策下发）

**功能**：把 TopicBoost 写入 Agent 5 可读的目录。

**输入**：
```javascript
{
  topicBoosts: TopicBoost[],
  insights: Insight[]
}
```

**输出路径**：
```
{AGENT9_OUTPUT_DIR}/topic-boosts/_latest/boost-{topic_id}.json
{AGENT9_OUTPUT_DIR}/insights/_latest/insight-{id}.json
```

**Agent 5 读取方式**：
- 环境变量 `AGENT9_OUTPUT_DIR` 控制路径
- 未设置时 fallback 到 Mock（现有行为不变）

---

## 四、agent9-core.js 主流程

```javascript
async function runAgent9(opts = {}) {
  const {
    campaignId,
    lookbackDays = 7,
    platforms = ['youtube', 'wechat_gzh', 'zhihu', 'douyin'],
    topics = []  // 从 Agent 5 读取
  } = opts;

  console.log(`[Agent9] 启动 v0.1，归因分析...`);

  // Step 1：采集指标
  const collector = require('./skills/metric-collector');
  const performances = await collector.collect({ campaignId, lookbackDays, platforms });
  console.log(`[Agent9] 采集 ${performances.length} 条表现数据`);

  // Step 2：归因计算
  const engine = require('./skills/attribution-engine');
  const { topicBoosts, insights } = await engine.attribute({ performances, topics });
  console.log(`[Agent9] 计算 ${topicBoosts.length} 个选题 Boost`);

  // Step 3：下发决策
  const dispenser = require('./skills/decision-dispenser');
  await dispenser.dispatch({ topicBoosts, insights });
  console.log(`[Agent9] 决策已下发至 Agent5`);

  return {
    performances: performances.length,
    topicBoosts: topicBoosts.length,
    insights: insights.length
  };
}
```

---

## 五、与 Agent 5 的对接

### 现有接口（已预埋）

Agent 5 的 `agent5-core.js` 中已有：
```javascript
const feedbackData = loadFeedbackData();  // 读取 AGENT9_OUTPUT_DIR
```

**v0.1 无需修改 Agent 5 代码**：
- 设置 `AGENT9_OUTPUT_DIR=/workspace/risen-agent9/output`
- Agent 5 启动时自动发现并读取 Agent 9 的真实输出

### 文件格式（100% 兼容 FEEDBACK_CONTRACT.md）

Agent 9 写入的每个文件严格遵循已定义的契约：

```json
// output/topic-boosts/_latest/boost-TOPIC-001.json
{
  "topic_id": "TOPIC-001",
  "topic_title": "Claude Code 编程 Agent 持续火爆",
  "content_type": "技术分析",
  "total_impressions": 15000,
  "total_clicks": 750,
  "total_conversions": 45,
  "avg_ctr": 0.05,
  "article_count": 3,
  "boost_score": 1.2,
  "decision": "SCALE",
  "source_articles": ["ART-001", "ART-002"],
  "computed_at": "2026-07-02T08:00:00.000Z"
}
```

---

## 六、Mock 平台适配器设计

### 原则

v0.1 所有平台都是 **Mock**：
- 数据用统计分布随机生成
- 每次运行结果不同，但分布合理
- 文件头部标注 `__mock__: true`
- 真实 API 对接留在 v0.2+

### 平台模拟参数

| 平台 | impressions 范围 | CTR 范围 | 转化率范围 |
|------|----------------|---------|-----------|
| youtube | 500-50000 | 2%-15% | 0.5%-5% |
| wechat_gzh | 200-5000 | 1%-8% | 0.2%-3% |
| zhihu | 300-8000 | 1%-10% | 0.3%-4% |
| douyin | 1000-100000 | 3%-20% | 0.5%-6% |

### 接入真实 API 时

只需替换对应平台适配器文件，接口不变：
```
lib/platform-adapters/youtube-mock.js → lib/platform-adapters/youtube.js
（接口一致，Agent 9 核心逻辑无需修改）
```

---

## 七、里程碑

### M1：骨架 + 单平台 Mock
- [ ] `risen-agent9/` 目录结构
- [ ] `agent9-core.js` 主流程
- [ ] `metric-collector.js` 单平台（YouTube）Mock
- [ ] 输出 ArticlePerformance JSON 到 `output/performances/`
- **验收**：运行后 `output/performances/` 有真实 JSON 文件

### M2：多平台 + 归因引擎
- [ ] 完成 4 个平台 Mock 适配器
- [ ] `attribution-engine.js` 实现 Boost 计算
- [ ] `output/topic-boosts/` 有数据
- **验收**：同一 Topic 多平台有数据，Boost 计算正确

### M3：决策下发 + Agent 5 对接
- [ ] `decision-dispenser.js` 实现
- [ ] `AGENT9_OUTPUT_DIR` 环境变量配置
- [ ] Agent 5 读取 Agent 9 输出（非 Mock）
- **验收**：`agent9-core.js` 完整运行，Agent 5 Boost 由数据驱动

### M4：文档 + 发布
- [ ] `AGENT9_SPEC.md` 完成
- [ ] GitHub 推送
- [ ] v0.1 验收测试通过

---

## 八、风险与规避

| 风险 | 规避方式 |
|------|---------|
| Agent 5 读取路径不对齐 | 环境变量统一用 `AGENT9_OUTPUT_DIR`，文件格式 100% 兼容契约 |
| Boost 计算不符合预期 | M2 阶段单独测试 engine，Mock 数据分布透明可见 |
| 平台适配器接真实 API 时破坏核心逻辑 | 接口（interface）先行，Mock/Real 只是实现不同 |
| 与 Agent 5 的 Mock 逻辑冲突 | Agent 5 已有 `loadFeedbackData()` 预埋，两套并存无需修改代码 |

---

## 九、依赖关系

### 外部依赖（v0.1 不引入新依赖）

- Node.js 内置：`fs`, `path`, `http`（已有）
- 无需安装：Kafka / Snowplow / PostHog / GrowthBook
- 暂不安装：LiteLLM / Langfuse / Temporal

### 内部复用

- `collect-signals.js` 框架思路（采集逻辑可参考）
- `FEEDBACK_CONTRACT.md` 数据格式（已定义，直接复用）
- RISEN-OS 已有 `output/` 目录结构（路径对齐）

### 后续版本依赖

| 版本 | 新增依赖 |
|------|---------|
| v0.2 | YouTube Data API / 微信公众号 API（真实凭证） |
| v0.3 | 线索→商机归因（需 CRM Webhook） |
| v0.4 | 实验分析（统计库或 GrowthBook） |
| v0.5 | Temporal 工作流（长周期任务） |

---

## 十、v0.1 不做的事

以下内容明确不在 v0.1 范围：

- ❌ 真实平台 API 对接（全是 Mock）
- ❌ 线索→商机→收入归因
- ❌ A/B 实验统计显著性分析
- ❌ Temporal 长周期工作流
- ❌ Skill Registry 注册
- ❌ Human Action Center
- ❌ 多租户隔离
- ❌ OAuth 账号管理

---

*本文档为 v0.1 实施计划，Agent 9 完整能力边界以 PRD V2.0 为准，v0.1 仅实现核心反馈闭环。*
