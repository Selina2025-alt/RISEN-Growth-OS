# Agent 9 SPEC — 收入归因与增长学习智能体

> 版本：v5.0（对应 AGENT9_PLAN_V5.0.md）
> 状态：实现完成
> 所属：RISEN 瑞森全球智能增长操作系统

---

## 一、Agent 9 定位

**一句话定位**：回答"什么真正有效、为什么有效、下一轮应该改哪里"。

Agent 9 是整个 RISEN 的**反馈学习闭环**——把 Agent 6 产出的内容经 Agent 8 发布后的真实表现，关联回选题 / 策略 / 能力，形成可执行的优化决策，并回流给对应 Agent。

---

## 二、能力边界（v5.0 完整实现）

### 核心输出

| 输出 | 说明 | 状态 |
|------|------|------|
| ArticlePerformance | 各平台文章表现数据 | ✅ |
| TopicBoost | 选题归因结果（Z-Score） | ✅ |
| Insight | 结构化业务发现 | ✅ |
| Decision | 下一步行动建议 | ✅ |
| 回溯修正 | 积累≥5篇后用历史数据重新计算 | ✅ |

### 核心 Skill（v5.0 实现版）

| Skill | 功能 | 文件 |
|-------|------|------|
| metric-collector | 采集指标，持久化 performances | ✅ |
| attribution-engine | Z-Score 归因，含回溯机制 | ✅ |
| insight-generator | 生成 topic_efficiency / content_form_analysis | ✅ |
| decision-dispenser | 去重 + 历史链 + 下发决策 | ✅ |

---

## 三、Boost 决策规则（v5.0 Z-Score 版）

### 3.1 Z-Score 公式

```
Z = (avg_ctr - platform_avg_ctr) / platform_std_ctr
```

单平台：直接计算。多平台：Z = Σ(Z_i × impressions_i) / Σ(impressions_i)。

### 3.2 决策阈值

| Z-Score | 决策 | boost_score | 含义 |
|---------|------|-------------|------|
| Z ≥ 1.0 | SCALE | 1.2 | 超过平台平均 1 个标准差，p≈0.16 |
| Z ≥ -0.5 | CONTINUE | 1.0 | 在平均附近 |
| Z ≥ -1.5 | REDUCE | 0.8 | 低于平台平均 1~1.5 个标准差 |
| Z < -1.5 | STOP | 0.0 | 极端差 |

**ratio 回退**：无 stdCTR 的平台（GitHub Star Rate）使用 ratio = ctr / benchmark，阈值 2.0/1.0/0.5。

### 3.3 最小样本保护

| 条件 | 行为 |
|------|------|
| article_count < 5 | 强制 CONTINUE，boost_score = 1.0 |
| article_count ≥ 5 | 正常归因计算 |

### 3.4 回溯修正

当 Topic 达到 5 篇时，从 `performances/` 目录加载全部历史数据，合并重算，标记 `__retrospective__: true`。

---

## 四、数据格式（v5.0 最新版）

### 4.1 ArticlePerformance

```typescript
interface ArticlePerformance {
  article_id: string;           // ART-{timestamp}-{random4}
  topic_id: string;             // 必须，Agent 5 定义
  direction_id: string | null;  // 可选
  platform: string;             // platform-meta.json 中的 platformId
  published_at: string;         // ISO 8601
  __mock__: boolean;            // 必须标注
  __source__: string;           // 'mock' | 'platform_api' | 'agent8'
  metrics: {
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    cvr: number;
    shares: number;
    likes: number;
    comments: number;
    avg_read_time: number;
  };
  metadata: {
    content_form: string;       // '图文' | '视频' | '短视频' | '问答'
    topic_keywords: string[];
  };
}
```

### 4.2 TopicBoost

```typescript
interface TopicBoost {
  topic_id: string;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  avg_ctr: number;
  avg_cvr: number;
  z_score: number | null;          // 多平台时为 null
  platform_avg_ctr: number | null;  // 多平台时为 null，Consumer 必须检查
  platform_std_ctr: number | null;  // 多平台时为 null
  ratio_to_benchmark: number | null; // 仅用于无 stdCTR 的平台
  model_used: string;              // 'linear'
  decision: 'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP';
  boost_score: number;             // 0.0 ~ 1.2
  confidence: number;              // 0.45 ~ 0.95
  source_articles: string[];
  platforms: string[];
  computed_at: string;             // ISO 8601
  __mock__: boolean;
  __retrospective__: boolean;
  __config__: { model: string; config_version: string; };
}
```

### 4.3 Insight

```typescript
interface Insight {
  id: string;                     // INS-{timestamp}-{random4}
  type: 'topic_efficiency' | 'content_form_analysis';
  topic_id: string;
  category: 'topic' | 'content' | 'strategy';
  summary: string;                // 一句话，Agent 5 可直接读
  detail: string;                 // 详细分析
  platforms: string[];
  confidence: number;
  recommended_action: string;
  target_agent: 'agent4' | 'agent5' | 'agent6' | 'agent7';
  computed_at: string;
  best_form?: string;            // content_form_analysis 时有
  worst_form?: string;           // content_form_analysis 时有
}
```

### 4.4 Decision（v1.2）

```typescript
interface Decision {
  id: string;                     // DEC-{YYYYMMDD}-{HHmm}-{ssss}
  type: 'topic_boost' | 'content_adjust' | 'strategy_shift';
  source: 'agent9';
  target: 'agent4' | 'agent5' | 'agent6' | 'agent7';
  topic_id: string;
  decision: 'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP';
  boost_score: number;
  reason: string;
  confidence: number;
  recommended_action: string;
  created_at: string;
  deduplication_key: string;       // topic_id:decision 或 topic_id:agent:action
  __retrospective__: boolean;
  history: Array<{ decision: string; created_at: string; archived_at: string; }>;
}
```

---

## 五、目录结构（v5.0 最新版）

```
risen-agent9/
├── agent9-core.js              # 主入口
├── skills/
│   ├── metric-collector.js      # Skill 1
│   ├── attribution-engine.js    # Skill 2（含回溯）
│   ├── insight-generator.js     # Skill 3
│   └── decision-dispenser.js    # Skill 4（含历史链）
├── lib/
│   ├── interfaces/              # 接口定义
│   │   ├── ArticlePerformance.js
│   │   ├── TopicBoost.js
│   │   ├── Insight.js
│   │   └── Decision.js
│   ├── attribution-config.json  # 归因配置 v1.2
│   ├── attribution-config-loader.js
│   ├── platform-meta.json       # 27 个 P0/P1 平台
│   ├── platform-meta-loader.js
│   └── platform-adapters/       # 适配器（Mock）
│       ├── interface.js
│       ├── index.js
│       ├── wechat-gzh-mock.js
│       ├── zhihu-mock.js
│       ├── csdn-mock.js
│       ├── dev-to-mock.js
│       ├── github-mock.js       # Star Rate 版
│       └── linkedin-mock.js
├── output/                     # 由 AGENT9_OUTPUT_DIR 指定
│   ├── performances/
│   │   └── {YYYY-MM}/
│   │       └── {YYYY-MM-DD}/
│   │           └── {article_id}.json
│   ├── topic-boosts/
│   │   └── _latest/
│   │       └── {topic_id}.json   # Agent 5 读取这个
│   ├── insights/
│   │   └── {YYYY-MM-DD}/
│   │       └── {insight_id}.json
│   └── decisions/
│       └── from-agent9/
│           └── {agentId}/
│               ├── latest.json     # v1.2，含 history 字段
│               └── history/
│                   └── {topic_id}.json  # 存档最多 20 条
└── document/
    ├── AGENT9_PLAN_V5.0.md     # 完整实施计划
    ├── AGENT9_SPEC.md           # 本文档
    ├── FEEDBACK_CONTRACT.md     # Agent 间契约
    ├── DECISION_INTERFACE.md    # Decision 接口文档
    ├── ATTRIBUTION_MODELS.md    # 归因方法论
    └── PLATFORM_BENCHMARKS.md   # 平台基准数据
```

---

## 六、决策回流路径（v5.0 激活状态）

| 决策类型 | 目标 Agent | 条件 | 状态 |
|---------|-----------|------|------|
| topic_boost | Agent 5 | loadFeedbackFromAgent9() | ✅ 已实现 |
| content_adjust | Agent 6 | 等 Agent 6 消费逻辑 | ⏳ 预埋 |
| strategy_shift | Agent 4 | 等 Agent 4 SPEC 更新 | ⏳ 预埋 |
| format_suggest | Agent 7 | 等 Agent 7 完整定义 | ⏳ 预埋 |

Agent 8 不在路由名单里（数据源，不是决策接收方）。

---

## 七、dev / prod 模式

| 模式 | NODE_ENV | allowMock | warnOnMock |
|------|----------|-----------|------------|
| dev | development | true | true |
| prod | production | false | false |

prod 模式：`__mock__: true` 的数据会被过滤掉，不会进入归因计算。

---

## 八、与其他 Agent 的关系

### 上游（数据来源）

| Agent | 提供 | 说明 |
|-------|------|------|
| Agent 5 | topic_id, direction_id | 选题系统 |
| Agent 6 | article(topic_id) | 文章输出 |
| Agent 8 | publication(article_id, topic_id, platform) | 发布记录 |

### 下游（决策去向）

| Agent | 接收类型 | 说明 |
|-------|---------|------|
| Agent 5 | topic_boost | ✅ 已对接 |
| Agent 6 | content_adjust | ⏳ 预埋 |
| Agent 4 | strategy_shift | ⏳ 预埋 |
| Agent 7 | format_suggest | ⏳ 预埋 |

---

## 九、SHARED_OUTPUT_DIR 配置约束

Agent 5 和 Agent 9 必须配置相同的共享路径：

```bash
export SHARED_OUTPUT_DIR=/workspace/RISEN-OS/shared/agent9-output
export AGENT9_OUTPUT_DIR=${SHARED_OUTPUT_DIR}
```

---

## 十、验收标准（v5.0 完成状态）

- [x] `agent9-core.js` 完整运行无报错
- [x] `metric-collector.js` 输出符合格式的 ArticlePerformance
- [x] `attribution-engine.js` 正确计算 Z-Score TopicBoost
- [x] performances 持久化到 `output/performances/{YYYY-MM}/{YYYY-MM-DD}/`
- [x] `decision-dispenser.js` 下发到 `decisions/from-agent9/{agentId}/latest.json`
- [x] Agent 5 `loadFeedbackFromAgent9()` 可读取 Agent 9 数据
- [x] Decision 历史链：`latest.json` 保留 5 条 + `history/` 存档 20 条
- [x] dev/prod 模式区分
- [x] 回溯修正：当 article_count ≥ 5 时从历史重算
- [x] content_form ratio ≥ 1.2 Insight 生成

---

*本文档跟随 AGENT9_PLAN_V5.0.md 更新，v5.0 为最终实现版。*
