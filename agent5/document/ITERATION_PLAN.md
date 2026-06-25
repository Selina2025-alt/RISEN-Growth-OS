# Agent5 迭代优化计划
> 基于 2026-06-25 分析报告，本文档记录所有迭代优化项及其状态。

---

## 设计原则

> **保守迭代 — 只修已确认的 bug，不动正在正常工作的模块，不引入新的外部依赖。**

---

## P0 — 已确认问题，立即修复

### ✅ P0.1 — Agent4 → Agent5 数据管道接通

**问题**：Agent5 永远读硬编码的 `DEFAULT_NARRATIVE`，从不读 Agent4 的输出文件

**修复**：`agent5-core.js` 新增 `loadAgent4Outputs()` 函数

**改动文件**：`agent5/agent5-core.js`

**读取的文件**：
- `../agent4/mock-data/narrative-constraints-extended.json` → `narrative_constraints`
- `../agent4/mock-data/output-strategy-card.json` → `strategyCard`
- `../agent4/mock-data/platform-intelligence-report.json` → `platformReport`

**Fallback**：文件不存在时使用默认值，不抛错

**验证**：
```
[Agent4] ✅ 读取 Narrative 约束: .../narrative-constraints-extended.json
[Agent4] ✅ 读取 Strategy Card: .../output-strategy-card.json
[Agent4] ✅ 读取平台情报报告: .../platform-intelligence-report.json
[输入] Narrative来源: Agent4文件
```

**状态**：✅ 已完成并验证

---

### ✅ P0.2 — 三信号源 30天时间过滤

**问题**：RSS feed 不按时间排序，旧帖（最老166天前）被当作新帖收录

**修复**：`collect-signals.js` 新增 `parseRSSDate()` + `isWithinMaxAge()` 过滤

**常量**：`SIGNAL_MAX_AGE_DAYS = 30`

**应用范围**：三个采集函数全部加过滤
- `collectAihot()` ✅
- `collectFollowBuilders()` ✅
- `collectTechNews()` ✅

**验证**：
```
[采集] ✅ aihot=50 follow-builders=0 tech-news=60
（之前 tech-news=67，过滤掉7条过期帖子）
[tech-news] [VentureBeat AI] 过滤掉 7/7 条过期信号（>30天）
```

**状态**：✅ 已完成并验证

---

### ✅ P0.3 — follow-builders RSS 能力验证

**结论**：follow-builders 受 `signal-health.js` 管理，aihot 健康时跳过是**预期行为**

**验证方式**：临时关闭 aihot 可触发 follow-builders（需独立测试脚本）

**状态**：✅ 验证完成（健康检查机制正确，无需修改）

---

## P1 — 短期迭代（3-7天）

### ✅ P1.1 — Resource Collector 本地 Fallback

**问题**：`collectResources()` 外部 API 全部失败时返回空

**修复**：`resource-collector.js` 末尾加本地 Fallback——从选题信号本身提取摘要作为最低保障来源

**改动文件**：`agent5/skills/resource-collector.js`

**逻辑**：
```javascript
if (sources.length === 0 && topic && topic.title) {
  const localSource = {
    source_id: `LOCAL-${topic.topic_id}`,
    type: 'local_fallback',
    title: topic.title,
    excerpt: topic.summary || '',
    tier: 'B',
    ...
  };
  sources.push(localSource);
  errors.push({ type: 'fallback', reason: '外部API全部失败，使用选题信号摘要作为最低保障来源' });
}
```

**状态**：✅ 已完成并验证

---

### ✅ P1.2 — Step6 buildTopicBrief 传空 resources Bug

**问题**：`buildTopicBrief` 原来传的是硬编码空 `resources`，没有用 Step5 采集结果

**修复**：`agent5-core.js` 中 `resourcesResult` 正确传递到 `buildTopicBrief`

**改动文件**：`agent5/agent5-core.js`

**状态**：✅ 已完成并验证

---

### ⏳ P1.3 — Agent5 完整读取 Agent4 输出（扩展 P0.1）

**内容**：除了 Narrative，还读取 Strategy Card 和平台情报报告

**状态**：✅ 已包含在 P0.1 中（`loadAgent4Outputs()` 同时读取三个文件）

---

## P2 — 中期规划（需要产品决策）

### 📋 P2.1 — Agent 9 归因引擎（反馈闭环核心）

**问题**：整个 RISEN OS 是开环的——选题出去、效果不知道

**方案**：
1. 先定义 Feedback 数据格式（Agent 9 应该吐什么 JSON 结构）
2. 在 Agent 5 里预留 Mock 接口
3. 等 Agent 9 实现后对插

**预估工作量**：中等

**Agent 9 需要提供的数据格式**（草案）：
```json
{
  "article_id": "ART-xxx",
  "published_at": "2026-06-25T00:00:00Z",
  "platform": "wechat_gzh",
  "metrics": {
    "impressions": 10000,
    "clicks": 500,
    "ctr": 0.05,
    "conversions": 10,
    "shares": 50
  },
  "capability_cards_used": ["KB-001", "KB-003"]
}
```

**状态**：📋 计划中（等待 Agent 9 开发）

---

### 📋 P2.2 — Distribution Rules 配置文件化

**问题**：`max_daily` / `max_weekly` 目前是代码常量

**方案**：提取到 `mock-data/distribution-rules.json`，Agent5 启动时读取

**风险**：低。不改变算法逻辑，只改变配置管理方式

**状态**：📋 计划中

---

## 不做的项（防止引入新风险）

| 放弃项 | 原因 |
|--------|------|
| 引入数据库（MySQL/PostgreSQL） | 增加部署复杂度，当前 JSON 文件完全够用 |
| 引入消息队列（Kafka/RabbitMQ） | Agent 间同步频率不高，轮询文件足够 |
| 重写 Skill 路由算法 | 当前算法逻辑正确，只是缺真实数据 |
| 添加新的外部 API 依赖 | 会引入凭证管理和稳定性问题 |
| 修改 Pipeline Step 执行顺序 | 当前顺序经过设计验证，不要动 |

---

## Agent1/2/3/9 接口契约（计划中）

### Agent 1 → Agent 4

```json
{
  "campaign_id": "CAMP-001",
  "goal": "品牌增长+商机获取",
  "budget": 100000,
  "start_date": "2026-07-01",
  "end_date": "2026-09-30",
  "target_sql_count": 200,
  "updated_at": "2026-06-25T00:00:00Z"
}
```

### Agent 2 → Agent 4

```json
{
  "passport_id": "PP-001",
  "company_name": "艾氪智能",
  "claims": [...],
  "evidence": [...],
  "updated_at": "2026-06-25T00:00:00Z"
}
```

### Agent 3 → Agent 4

```json
{
  "market_id": "MKT-001",
  "icp": {...},
  "target_accounts": [...],
  "market_brief": "...",
  "updated_at": "2026-06-25T00:00:00Z"
}
```

### Agent 9 → Agent 4/5/6

```json
{
  "article_id": "ART-xxx",
  "published_at": "2026-06-25T00:00:00Z",
  "platform": "wechat_gzh",
  "metrics": {
    "impressions": 10000,
    "clicks": 500,
    "ctr": 0.05,
    "conversions": 10
  },
  "capability_cards_used": ["KB-001"]
}
```

---

## 迭代路线图

```
Week 1 (P0) ✅
├── P0.1 Agent4→Agent5 文件读取      ✅
├── P0.2 tech-news 30天过滤           ✅
├── P0.3 follow-builders 验证         ✅
├── P1.1 Resource Collector Fallback  ✅
└── P1.2 buildTopicBrief Bug          ✅

Week 2 (P1)
├── P2.1 Feedback 数据格式定义       📋 计划中
└── P2.2 分发规则配置文件化          📋 计划中

长期
└── Agent 9 归因引擎                 📋 等待 Agent9 开发
```

---

*更新于 2026-06-25*
