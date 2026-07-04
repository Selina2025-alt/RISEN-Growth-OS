# Agent 9 Feedback Contract

> 版本：v1.0
> 状态：最终版
> 描述：Agent 5 ↔ Agent 9 反馈闭环，以及 Agent 8 → Agent 9 数据接口

---

## 1. 整体数据流

```
Agent5  选题
  ↓ topic_id
Agent6  写文章  ─── article(topic_id, direction_id)
  ↓
Agent8  发布    ─── publication(article_id, topic_id, platform)
  ↓
Agent9  采集    ─── ArticlePerformance(article_id, topic_id, platform, metrics)
  ↓ 归因
TopicBoost(topic_id, decision, boost_score)
  ↓
Agent5  消费    ─── loadFeedbackFromAgent9()
```

---

## 2. ArticlePerformance 数据格式

路径：`${AGENT9_OUTPUT_DIR}/performances/{YYYY-MM}/{YYYY-MM-DD}/{article_id}.json`

```json
{
  "article_id": "ART-20260703-1806-9644",
  "topic_id": "TOPIC-001",
  "direction_id": "DIR-001",
  "platform": "wechat_gzh",
  "published_at": "2026-07-03T10:00:00+08:00",
  "__mock__": true,
  "__source__": "mock",
  "metrics": {
    "impressions": 25000,
    "clicks": 625,
    "ctr": 0.025,
    "conversions": 25,
    "cvr": 0.04,
    "shares": 31,
    "likes": 62,
    "comments": 12,
    "avg_read_time": 180
  },
  "metadata": {
    "content_form": "图文",
    "topic_keywords": ["AI Agent", "Claude Code"]
  }
}
```

### 必填字段

| 字段 | 来源 | 说明 |
|------|------|------|
| `article_id` | Agent 6 | 文章唯一标识 |
| `topic_id` | Agent 5 | 选题唯一标识（**设计约束，不允许为空**）|
| `direction_id` | Agent 5/6 | 方向 ID（可选） |
| `platform` | Agent 8 | 平台 ID，同 platform-meta.json |
| `published_at` | Agent 8 | ISO 8601 |
| `metrics` | Agent 8/API | 见 metrics 字段 |
| `__mock__` | 数据来源 | `true`=模拟 / `false`=真实 |
| `__source__` | 数据来源 | `mock` \| `platform_api` \| `agent8` |

---

## 3. Agent 8 → Agent 9 数据接口

### 3.1 Agent 8 产出文件

路径：`${AGENT8_OUTPUT_DIR}/publications/{YYYY-MM}/PUB-{publication_id}.json`

```json
{
  "publication_id": "PUB-20260703-001",
  "article_id": "ART-20260703-1806-9644",
  "topic_id": "TOPIC-001",
  "direction_id": "DIR-001",
  "platform": "wechat_gzh",
  "remote_publication_id": "xxxxx",
  "remote_url": "https://mp.weixin.qq.com/s/xxxx",
  "published_at": "2026-07-03T10:00:00+08:00",
  "status": "published",
  "__source__": "agent8",
  "__mock__": false
}
```

### 3.2 Agent 9 读取方式

```javascript
// metric-collector.js 中的真实 API 读取逻辑（适配器中实现）
const pubFiles = fs.readdirSync(`${AGENT8_OUTPUT_DIR}/publications/${YYYY-MM}/`)
  .filter(f => f.startsWith('PUB-') && f.endsWith('.json'));

for (const file of pubFiles) {
  const pub = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (pub.status !== 'published') continue;
  // 转换为 ArticlePerformance 格式
  const perf = {
    article_id: pub.article_id,
    topic_id: pub.topic_id,
    direction_id: pub.direction_id || null,
    platform: pub.platform,
    published_at: pub.published_at,
    __mock__: pub.__mock__,
    __source__: 'agent8',
    metrics: await fetchPlatformMetrics(pub),  // 真实 API 调用
    metadata: {}
  };
}
```

---

## 4. Agent 9 → Agent 5 反馈闭环

### 4.1 TopicBoost 输出

路径：`${AGENT9_OUTPUT_DIR}/topic-boosts/_latest/{topic_id}.json`

```json
{
  "topic_id": "TOPIC-001",
  "total_impressions": 125000,
  "total_clicks": 4375,
  "total_conversions": 175,
  "avg_ctr": 0.035,
  "avg_cvr": 0.04,
  "z_score": 0.5,
  "platform_avg_ctr": 0.025,
  "platform_std_ctr": 0.015,
  "ratio_to_benchmark": null,
  "model_used": "linear",
  "decision": "SCALE",
  "boost_score": 1.2,
  "confidence": 0.85,
  "source_articles": ["ART-xxx", "ART-yyy", "ART-zzz"],
  "platforms": ["wechat_gzh", "zhihu", "csdn"],
  "computed_at": "2026-07-03T10:06:33+08:00",
  "__mock__": false,
  "__retrospective__": false,
  "__config__": { "model": "linear", "config_version": "1.2" }
}
```

### 4.2 Agent 5 消费函数

```javascript
// Agent 5 agent5-core.js 中
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR;
  if (!dir) return null;
  const latestDir = path.join(dir, 'topic-boosts', '_latest');
  const files = fs.readdirSync(latestDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) return null;
  return files.map(f => {
    const b = JSON.parse(fs.readFileSync(path.join(latestDir, f), 'utf8'));
    return {
      topic_keyword: b.topic_id,       // 兼容原有格式
      engagement_score: b.boost_score,
      decision: b.decision,
      confidence: b.confidence,
      data_source: '__agent9__',
      computed_at: b.computed_at,
      __retrospective__: b.__retrospective__ || false
    };
  });
}
```

### 4.3 激活条件

| 条件 | 说明 |
|------|------|
| `AGENT9_OUTPUT_DIR` 已设置 | Agent 5 和 Agent 9 必须配置相同路径 |
| `topic-boosts/_latest/` 有文件 | Agent 9 已完成当次运行 |
| `NODE_ENV !== 'production'` 或数据 `__mock__: false` | 生产模式只接受真实数据 |

---

## 5. SHARED_OUTPUT_DIR 配置约束

**Agent 5 和 Agent 9 必须配置相同的共享路径。**

```bash
# 两个 Agent 都要设置同样的环境变量
export SHARED_OUTPUT_DIR=/workspace/RISEN-OS/shared/agent9-output
export AGENT9_OUTPUT_DIR=${SHARED_OUTPUT_DIR}
```

**验证方式：**

```javascript
// Agent 9 启动时
const dir = process.env.AGENT9_OUTPUT_DIR;
if (!dir) throw new Error('[Agent9] ❌ AGENT9_OUTPUT_DIR 未设置');
try { fs.accessSync(dir, fs.constants.W_OK); }
catch { throw new Error(`[Agent9] ❌ AGENT9_OUTPUT_DIR 不可写: ${dir}`); }
```

---

## 6. 错误处理

| 场景 | Agent 5 行为 | Agent 9 行为 |
|------|------------|-------------|
| `AGENT9_OUTPUT_DIR` 未设置 | 返回 `null`，fallback 到 Mock | 启动时报错 |
| 目录不存在 | `fs.existsSync` 检查，返回 `null` | 启动时创建（dev）/ 报错（prod）|
| JSON 损坏 | `try/catch`，跳过损坏文件 | `try/catch`，跳过损坏文件 |
| 无数据 | 返回 `null` | 跳过归因步骤 |
| `NODE_ENV=production` + Mock 数据 | N/A | 过滤掉 `__mock__: true` 的数据 |

---

## 7. 数据新鲜度

| 数据类型 | TTL | 说明 |
|---------|-----|------|
| TopicBoost | 24h | Agent 9 每日运行一次即可 |
| ArticlePerformance | 无 TTL | 永久保存，用于回溯修正 |
| Decision | 无 TTL | latest.json 保留5条，history 存档20条 |

---

## 8. 版本约束

| 接口 | 版本 | 状态 |
|------|------|------|
| ArticlePerformance | v1.0 | ✅ 稳定 |
| TopicBoost | v1.0 | ✅ 稳定 |
| Decision | v1.2 | ✅ 稳定 |
| FEEDBACK_CONTRACT | v1.0 | ✅ 稳定 |
