# Agent 5 · 趋势与选题智能体
## 技术规格文档 V3.0

> **V3.0 更新 (2026-07-06)：**
> - 完整测试验证，更新实际 Pipeline 输出
> - 补充 Agent9 Feedback 回流接口
> - 补充与 Agent4 的数据接口规格

---

## 一、系统定位

### 1.1 在 RISEN OS 中的角色

```
Agent4 ──→ Strategy Card + Narrative Constraint
     ↓
Agent5 ──→ TopicPool + TrendBrief + EditorialCalendar + DistributionMap
     ↓
Agent6 ──→ 实际内容产出
     ↓
Agent9 ──→ 归因数据
     ↓
Agent5（Feedback回流）
```

**核心职责：** Agent5 是"选题中枢"，将 Agent4 的策略转化为 110 个可执行的选题方向，并负责接收 Agent9 的归因反馈进行策略调整。

---

## 二、输入与输出

### 2.1 输入

| 输入 | 来源 | 必需 | 说明 |
|------|------|------|------|
| Strategy Card | Agent4 | ✅ | 价值主张、目标客群、战略赌注 |
| Narrative Constraint | Agent4 | ✅ | 核心叙事主轴、账号差异化 |
| 平台情报 | Agent4 | ✅ | 竞品情报、推荐角度 |
| AIHOT 信号 | 真实API | ✅ | 50条/次 |
| Tech News 信号 | 真实API | ✅ | 60条/次 |
| Follow Builders | 真实API | 🔶 | 0条/次（备用）|
| Agent9 Feedback | Agent9 | 🔶 | Decision + Insight回流 |

### 2.2 输出

| 输出 | 路径 | 接收方 |
|------|------|--------|
| Trend Brief | `output/trend-briefs/BRIEF-*.json` | Agent6 |
| Editorial Calendar | `output/editorial-calendar.json` | 人工 |
| Distribution Map | `output/distribution-map.json` | 人工 |
| Topic Pool | `output/topic-pool.json` | Agent6 |
| Resources | `output/resources.json` | Agent6 |

---

## 三、Pipeline 结构

### 3.1 执行步骤

```
Step 1-4: Signal Collection（3技能并发）
        aihot → 50条
        tech-news-digest → 60条
        follow-builders → 0条

Step 5: Topic Brief Builder
        50条信号 × 5个方向 = 110个母选题

Step 6: Resource Collector
        为每个选题关联 Evidence 资源

Step 7: Topic Cluster
        选题聚类（按主题/平台/内容类型）

Step 8: Distribution Router
        110选题 × 60路由 = 6600条分发规则

Step 9: Editorial Calendar
        生成84条发布计划，覆盖12个平台
```

### 3.2 入口文件

```bash
cd agent5 && node agent5-core.js
```

---

## 四、核心输出规格

### 4.1 Trend Brief 规格

```json
{
  "brief_id": "BRIEF-MR8JO4Q3",
  "brief_type": "Trend Brief",
  "content_type": "analysis",
  "meta": {
    "topic_id": "TOPIC-001",
    "direction_id": "D1",
    "topic_title": "分享8个Claude Fable 5下线前必跑的超实用Prompt",
    "direction_title": "深度拆解型：分享8个Claude...",
    "content_form": "图文",
    "target_platform": "wechat_gzh",
    "target_account": "公众号",
    "narrative_constraint_source": "Jova AI：让企业AI落地不再困难"
  },
  "core_claims": [
    {
      "claim_id": "C1",
      "statement": "Jova AI：让企业AI落地不再困难，具体来说是深入分析底层逻辑和实现路径...",
      "evidence_count": 0,
      "evidence_level": "inferred"
    }
  ],
  "evidence_support": [],
  "data_points": [],
  "repurposing_notes": [],
  "agent6_guidance": {
    "insertion_type": "soft",
    "priority": "high",
    "publish_date_range": "2026-07-06~2026-07-13"
  }
}
```

### 4.2 Distribution Map 规格

```json
{
  "topics": [],
  "routes": [
    {
      "topic_id": "TOPIC-001",
      "platform": "wechat_gzh",
      "direction_id": "D1",
      "priority": 85,
      "publish_date": "2026-07-07",
      "target_account": "公众号",
      "content_type": "analysis"
    }
  ],
  "summary": {
    "total_topics": 110,
    "total_routes": 6600,
    "platform_count": 12
  }
}
```

---

## 五、Agent9 Feedback 回流接口

### 5.1 Feedback 来源

Agent9 归因完成后，将 Decision 下发到：

```
路径: output/decisions/from-agent9/agent5/latest.json
```

### 5.2 Feedback 格式

```json
{
  "version": "v1",
  "decisions": [
    {
      "type": "topic_boost",
      "topic_id": "TOPIC-4634",
      "boost_factor": 1.3,
      "reasoning": "CTR显著高于同类平均水平，Z=1.8"
    },
    {
      "type": "topic_boost",
      "topic_id": "TOPIC-1558",
      "boost_factor": 1.2,
      "reasoning": "阅读完成率前20%"
    }
  ],
  "insights": [
    {
      "type": "platform_insight",
      "content": "知乎技术类文章CTR高于平均值40%",
      "platform": "zhihu"
    }
  ]
}
```

### 5.3 Agent5 处理 Feedback

```javascript
// lib/feedback-processor.js
async function loadAgent9Feedback() {
  const feedbackPath = path.join(process.env.AGENT9_OUTPUT_DIR, 'decisions/from-agent9/agent5/latest.json');
  if (!fs.existsSync(feedbackPath)) return { decisions: [], insights: [] };
  return JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
}
```

---

## 六、Skills 清单

| Skill | 文件 | 职责 |
|-------|------|------|
| Topic Brief Builder | `skills/topic-brief-builder.js` | 生成110个TrendBrief |
| Resource Collector | `skills/resource-collector.js` | 关联Evidence资源 |
| Topic Cluster | `skills/topic-cluster.js` | 选题聚类 |
| Distribution Router | `skills/distribution-router.js` | 生成分发路由 |
| Platform Scorer | `skills/platform-scorer.js` | 平台评分 |
| Content Calendar | `skills/content-calendar.js` | 生成发布日历 |
| Collect Signals | `skills/collect-signals.js` | 信号采集编排 |

---

## 七、测试验证

### 7.1 验证命令

```bash
cd agent5 && node agent5-core.js
```

### 7.2 验证清单

- [x] Signal Collection（aihot=50, tech-news=60）
- [x] Topic Brief 生成（110个）
- [x] Distribution Map（6600条路由）
- [x] Editorial Calendar（84条发布）
- [x] 输出文件写入正确路径

### 7.3 实际输出

```
选题数: 110
方向数: 550
分发路由: 6600
日历覆盖平台: 12
日历发布总量: 84

输出已保存:
  output/index.json（汇总索引）
  output/*.json（分模块）
  output/trend-briefs/*.json（TrendBrief）
  mock-data/agent5-complete-output.json（兼容索引）
```

---

## 八、技术约束

- Node.js >= 18
- Python >= 3.8（用于信号采集）
- 执行时间：< 60s
- 无外部 npm 依赖（纯内置模块）

---

*本文档版本：V3.0 | 更新日期：2026-07-06*
