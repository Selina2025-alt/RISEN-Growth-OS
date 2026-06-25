# Agent 9 Feedback 数据接口契约
> 定义 Agent 9 → Agent 4/5/6 的反馈数据格式。
> 供 Agent 9 开发者和 Agent 4/5/6 对接使用。

---

## 数据流向

```
Agent 6 产出文章
    ↓ 发布到各平台
Agent 9 归因追踪
    ↓
Agent 5 接收反馈 → 调整选题 Boost
Agent 4 接收反馈 → 调整 Strategy Card
```

---

## 核心数据类型

### 1. ArticlePerformance（文章表现）

Agent 9 追踪的核心数据单元。

```typescript
interface ArticlePerformance {
  // 文章标识
  article_id: string;          // 格式: ART-{timestamp}-{random}
  topic_id: string;          // 对应 Agent5 的 topic_id
  direction_id: string;        // 对应 Agent5 的 direction_id

  // 发布信息
  platform: PlatformId;        // 平台ID
  published_at: string;         // ISO 8601

  // 表现指标
  metrics: PerformanceMetrics;

  // 元数据
  metadata: {
    content_form: string;      // 图文/视频/短视频
    target_audience: string;  // 目标受众
    topic_keywords: string[]; // 选题关键词（用于Boost匹配）
  };
}

type PlatformId =
  | 'aike短视频' | 'wechat_gzh' | 'jova_video'
  | 'zhihu' | 'toutiao' | 'baijiahao' | 'xueqiu'
  | 'netease' | 'sohu' | 'tencent' | 'sina' | 'ifeng';

interface PerformanceMetrics {
  impressions: number;    // 曝光量
  clicks: number;        // 点击量
  ctr: number;          // 点击率 = clicks / impressions
  conversions: number;   // 转化数（注册/咨询/下载）
  cvr: number;           // 转化率 = conversions / clicks
  shares: number;        // 转发数
  likes: number;        // 点赞数
  comments: number;     // 评论数
  avg_read_time: number; // 平均阅读时长（秒）
 读完率: number;        // 百分比 0-100
}
```

---

### 2. TopicBoost（选题 Boost）

Agent 9 汇总的选题级别反馈，用于驱动 Agent 5 选题优先级调整。

```typescript
interface TopicBoost {
  topic_id: string;
  topic_title: string;
  content_type: string;

  // Boost 计算信号
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  avg_ctr: number;           // 加权平均 CTR
  article_count: number;      // 该选题累计文章数

  // Boost 决策
  boost_score: number;       // 0.0 - 2.0，1.0=不变
  decision: 'SCALE' | 'CONTINUE' | 'REDUCE' | 'STOP';

  // 来源证据
  source_articles: string[]; // article_id 列表

  computed_at: string;       // ISO 8601
}
```

**Boost 决策规则：**
```
avg_ctr >= 5%  → SCALE（boost_score = 1.2）
avg_ctr 2-5%  → CONTINUE（boost_score = 1.0）
avg_ctr 0.5-2% → REDUCE（boost_score = 0.8）
avg_ctr < 0.5% → STOP（boost_score = 0.0）
```

---

### 3. CapabilityEffectiveness（能力卡片效果）

Agent 9 追踪每个 Capability Card 的实际效果，用于优化 Agent 6 的植入策略。

```typescript
interface CapabilityEffectiveness {
  capability_id: string;
  capability_name: string;

  // 效果数据
  articles_using: number;       // 使用该卡片的文章数
  avg_ctr: number;              // 使用该卡片文章的平局CTR
  avg_conversions: number;       // 平均转化数

  // 置信度
  confidence: number;          // 0.0-1.0，数据越多越置信

  // 建议
  recommendation: 'PROMOTE' | 'DEMOTE' | 'KEEP';
}
```

---

## Agent 9 输出文件格式

Agent 9 将数据写入共享目录，Agent 4/5 通过轮询文件获取。

### 文件路径规范

```
{AGENT9_OUTPUT_DIR}/
  article-performances/
    {YYYY-MM}/                    # 按月分目录
      {article_id}.json           # 每篇文章一条
  topic-boosts/
    {YYYY-MM}/                   # 按月分目录
      boost-{topic_id}.json       # 每话题一条汇总
  capability-effectiveness/
    {YYYY-MM}/                   # 按月分目录
      capability-{id}.json       # 每卡片一条
  _latest/
    article-performances-latest.json   # 最新N条
    topic-boosts-latest.json          # 最新N条
    capability-effectiveness-latest.json
```

### 文件示例

**article-performances/2026-06/ART-MQTB1X2Y.json**
```json
{
  "article_id": "ART-MQTB1X2Y",
  "topic_id": "TOPIC-001",
  "direction_id": "D1",
  "platform": "wechat_gzh",
  "published_at": "2026-06-25T00:00:00.000Z",
  "metrics": {
    "impressions": 5000,
    "clicks": 250,
    "ctr": 0.05,
    "conversions": 15,
    "cvr": 0.06,
    "shares": 30,
    "likes": 120,
    "comments": 18,
    "avg_read_time": 145,
    "读完率": 62
  },
  "metadata": {
    "content_form": "图文",
    "target_audience": "CTO/技术VP",
    "topic_keywords": ["Claude Code", "AI Coding", "编程Agent"]
  }
}
```

**topic-boosts/2026-06/boost-TOPIC-001.json**
```json
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
  "source_articles": ["ART-MQTB1X2Y", "ART-MQTA9Z1W"],
  "computed_at": "2026-06-25T12:00:00.000Z"
}
```

---

## Agent 4/5 读取接口（已预埋）

Agent 5 已预埋读取接口，当 Agent 9 数据可用时自动切换：

```javascript
// agent5-core.js 中已预埋
async function loadFeedbackData() {
  const feedbackDir = process.env.AGENT9_OUTPUT_DIR || '../agent9/output';

  // 1. 读取 TopicBoost（驱动选题权重）
  const topicBoostFiles = glob.sync(`${feedbackDir}/topic-boosts/_latest/*.json`);
  const topicBoosts = topicBoostFiles.map(f => JSON.parse(readFile(f)));

  // 2. 读取 ArticlePerformance（细节参考）
  const articleFiles = glob.sync(`${feedbackDir}/article-performances/_latest/*.json`);
  const articles = articleFiles.map(f => JSON.parse(readFile(f)));

  // 3. 读取 CapabilityEffectiveness（Agent6 使用）
  const capFiles = glob.sync(`${feedbackDir}/capability-effectiveness/_latest/*.json`);
  const capabilities = capFiles.map(f => JSON.parse(readFile(f)));

  return { topicBoosts, articles, capabilities };
}
```

**环境变量：**
```bash
AGENT9_OUTPUT_DIR=/path/to/agent9/output
```

**当环境变量未设置时：** 自动 fallback 到 Mock 数据（现有行为不变）

---

## 数据新鲜度要求

| 数据类型 | 建议刷新频率 | 超时处理 |
|---------|------------|---------|
| TopicBoost | 每6小时 | 超过48小时的数据不用于决策 |
| ArticlePerformance | 每天 | 超过7天的数据不用于决策 |
| CapabilityEffectiveness | 每周 | 超过30天的数据不用于决策 |

---

## 注意事项

1. **CTR 计算**：以 `impressions` 为分母，不是曝光次数
2. **平台去重**：同一 article_id 可能在多平台发布，每个平台一条记录
3. **Boost 上限**：`boost_score` 最大 2.0（即使 CTR 超过 10% 也封顶）
4. **冷启动**：新选题（无数据）boost_score = 1.0（中性）

---

*本文档供 Agent 9 开发者对接使用，Agent 5/6 无需修改代码即可接入真实数据。*
