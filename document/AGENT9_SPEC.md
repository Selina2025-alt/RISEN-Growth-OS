# Agent 9 SPEC — 收入归因与增长学习智能体

> 版本：v0.1（对应 PRD V2.0）
> 状态：起草中
> 所属：RISEN 瑞森全球智能增长操作系统

---

## 一、Agent 9 定位

**一句话定位**：回答"什么真正有效、为什么有效、下一轮应该改哪里"。

Agent 9 是整个 RISEN 的**反馈学习闭环**——把 Agent 6 产出的内容经 Agent 8 发布后的真实表现，关联回选题 / 策略 / 能力，形成可执行的优化决策，并回流给对应 Agent。

---

## 二、能力边界（PRD V2.0 定义）

### 核心输出

| 输出 | 说明 |
|------|------|
| Performance Snapshot | 各渠道发布后的真实指标 |
| Attribution Report | 内容 → 线索 → 商机 → 收入的归因 |
| Experiment Result | A/B 实验的统计分析结论 |
| Cost Report | 各环节实际消耗 |
| Insight | 结构化的业务发现 |
| Decision | 下一步行动建议 |
| Next Experiment | 下一轮实验假设 |

### 核心 Skill（PRD 定义，共 6 项）

| Skill | 功能 | 来源 |
|-------|------|------|
| 事件采集与标准化 | 汇总平台、网站、CRM 和产品事件 | GitHub：Snowplow/RudderStack 参考 |
| 身份和账户解析 | 关联匿名行为、个人和企业 | RISEN 自研 |
| 归因和 Pipeline | 关联内容、线索、商机和收入 | RISEN 自研 |
| 实验分析 | 分析策略、选题和渠道实验 | GitHub：PostHog/GrowthBook 参考 |
| 异常、成本和质量 | 识别异常、成本和质量问题 | Langfuse/OpenTelemetry/LiteLLM |
| 学习、回归和回滚 | 生成新假设并验证升级 | Promptfoo + RISEN 自研 |

### v0.1 实现范围

**做**（v0.1）：
- 平台指标 Mock 采集（YouTube / 微信 / 知乎 / 抖音）
- 内容 → 选题归因（TopicBoost）
- 简化版 Insight 生成
- 决策下发到 Agent 5/4/6 文件

**不做**（v0.1）：
- 线索 → 商机 → 收入归因
- 真实平台 API 对接
- A/B 实验统计显著性分析
- 多租户隔离
- Temporal 工作流

### v0.2 实现范围（新增）

**新增**（v0.2）：
- 平台元数据驱动归因（`platform-meta.json`）
- 适配器模式（数据来源对核心逻辑透明）
- 6个 Mock 适配器（微信公众号/知乎/CSDN/Dev.to/GitHub/LinkedIn）
- 平台感知版 Insight（包含 GEO 权重、内容形式维度）
- 决策路由到 Agent 4/5/6/7/8
- Agent 8 接口契约补充到 `FEEDBACK_CONTRACT.md`
- M0 前置修复（Agent6 topic_id / Agent5 loadFeedbackFromAgent9）

---

## 三、决策回流路径（PRD 规定）

| 问题类型 | 回流给 | 说明 |
|---------|--------|------|
| 目标客户错误 | Agent 3（市场客户） | ICP / 目标账户偏差 |
| 价值主张错误 | Agent 4（策略实验） | Strategy Card 需调整 |
| 选题错误 | Agent 5（趋势选题） | Boost 调整或选题替换 |
| 事实/观点错误 | Agent 6（研究母内容） | Evidence Pack 需补强 |
| 视频/渠道形式错误 | Agent 7（多模态） | 格式或渠道不对 |
| 发布时间/账号错误 | Agent 8（传播激活） | 账号或排期问题 |
| 数据缺失/归因异常 | 数据连接器或人工复核 | 无法归因时标记 |

---

## 四、数据格式（FEEDBACK_CONTRACT 兼容）

### ArticlePerformance（表现数据）

```typescript
interface ArticlePerformance {
  article_id: string;           // ART-{timestamp}-{random}
  topic_id: string;             // 对应 Agent5 的 topic_id（必须，M0 修复）
  direction_id: string;
  __mock__: boolean;             // 是否为 Mock 数据（强制标注）
  __source__: string;              // 'platform_api' | 'agent8' | 'mock'          // 对应 Agent5 的 direction_id
  platform: PlatformId;         // 平台标识
  published_at: string;          // ISO 8601
  metrics: {
    impressions: number;         // 曝光量
    clicks: number;             // 点击量
    ctr: number;                // = clicks / impressions
    conversions: number;         // 转化数
    cvr: number;                // = conversions / clicks
    shares: number;             // 转发数
    likes: number;              // 点赞数
    comments: number;           // 评论数
    avg_read_time: number;      // 平均阅读时长（秒）
  };
  metadata: {
    content_form: string;       // 图文/视频/短视频
    target_audience: string;    // 目标受众
    topic_keywords: string[];   // 选题关键词
  };
}
```

### TopicBoost（选题 Boost）

```typescript
interface TopicBoost {
  topic_id: string;
  topic_title: string;
  content_type: string;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  avg_ctr: number;
  article_count: number;
  boost_score: number;          // 0.0 - 2.0，1.0=不变
  decision: 'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP';
  source_articles: string[];    // article_id 列表
  computed_at: string;          // ISO 8601
}
```

### Insight（洞察）

```typescript
interface Insight {
  id: string;
  topic_id?: string;
  platform?: string;
  category: 'strategy' | 'topic' | 'content' | 'channel' | 'audience';
  summary: string;              // 一句话发现
  detail: string;               // 详细说明
  confidence: number;          // 0.0 - 1.0
  recommended_action: string;   // 建议动作
  target_agent: 'agent3' | 'agent4' | 'agent5' | 'agent6' | 'agent7' | 'agent8';
  computed_at: string;
}
```

---

## 五、Boost 决策规则

```
avg_ctr >= 5%  → boost_score = 1.2，decision = 'SCALE'   （高效，扩大生产）
avg_ctr 2%-5%  → boost_score = 1.0，decision = 'CONTINUE' （正常，继续观察）
avg_ctr 0.5%-2% → boost_score = 0.8，decision = 'REDUCE'  （低迷，减少投入）
avg_ctr < 0.5% → boost_score = 0.0，decision = 'STOP'     （失效，暂停）
```

**冷启动**：新选题（无数据）→ boost_score = 1.0（中性）
**Boost 上限**：boost_score 最大 2.0

---

## 六、文件路径规范

```
risen-agent9/output/
├── performances/
│   └── {YYYY-MM}/
│       └── ART-{id}.json              # 每篇文章一条
├── topic-boosts/
│   ├── {YYYY-MM}/
│   │   └── boost-{topic_id}.json     # 每话题每月一条
│   └── _latest/
│       └── boost-{topic_id}.json     # 最新版本（Agent5 读取这个）
├── insights/
│   └── _latest/
│       └── insight-{id}.json
└── experiments/
    └── {YYYY-MM}/
        └── exp-{id}.json
```

---

## 七、权限边界（PRD 规定）

Agent 9 的最小权限集合：

```
metric:read       # 读取平台表现数据
insight:write    # 写入 Insight 和 Decision
topic:write      # 写入 TopicBoost（影响 Agent5）
experiment:read  # 读取实验配置
```

**Agent 9 不得**：
- 直接修改 Agent 4 的 Strategy Card
- 直接修改 Agent 5 的选题池
- 直接修改 Agent 6 的 Capability Index
- 自行发布内容或操控账号
- 修改他人内容或伪造数据

---

## 八、与其他 Agent 的关系

| 上游 | 数据来源 | 说明 |
|------|---------|------|
| Agent 5 | TopicPool / EditorialCalendar | 选题和分发计划 |
| Agent 6 | MasterContent / ChannelPackage | 母内容和渠道包 |
| Agent 7 | CreativeAsset | 图文/视频资产 |
| Agent 8 | Publication / Interaction | 实际发布和互动 |

| 下游（回流） | 数据去往 | 说明 |
|------------|---------|------|
| Agent 4 | Strategy Card | 策略实验结论 |
| Agent 5 | TopicBoost | 选题 Boost |
| Agent 6 | CapabilityEffectiveness | 能力效果反馈 |
| Agent 7 | FormatRecommendation | 格式和渠道建议 |
| Agent 8 | ChannelRecommendation | 渠道和账号建议 |

---

## 九、v0.1 验收标准

- [ ] `agent9-core.js` 完整运行无报错
- [ ] `metric-collector.js` 输出符合 FEEDBACK_CONTRACT 格式的 ArticlePerformance
- [ ] `attribution-engine.js` 正确计算 TopicBoost（SCALE/CONTINUE/REDUCE/STOP）
- [ ] `decision-dispenser.js` 将 Boost 写入 `output/topic-boosts/_latest/`
- [ ] Agent 5 读取 Agent 9 输出的 Boost（非 Mock）
- [ ] GitHub 推送完成

---

*本文档跟随 PRD V2.0 和实施计划更新。v0.1 完成后补充真实 API 对接和完整归因逻辑。*
