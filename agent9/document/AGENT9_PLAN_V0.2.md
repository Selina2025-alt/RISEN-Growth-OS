# Agent 9 v0.2 实施计划

> 版本：v0.2
> 状态：迭代版（基于两轮评估）
> 核心变化：从"4平台Mock"升级为"平台元数据驱动的归因引擎"
> 目标：RISEN 合流时，Agent 9 的核心逻辑无需改动

---

## 一、核心认知更新（v0.1 → v0.2）

### 1. Agent 9 的真正定位

Agent 9 是**平台无关的分析推理引擎**，不是平台数据采集器。

```
Agent 8 的职责：接入 293 个平台，采集数据
Agent 9 的职责：拿到数据后，分析、归因、生成 Insight、路由决策
```

两者通过统一接口契约协作，平台数量和来源对 Agent 9 的核心逻辑透明。

### 2. 平台维度是归因的上下文

同样的 CTR，数据来自不同平台，意义完全不同：

```
CTR 1% + 知乎 + GEO权重5 + 专业内容 → "高效，加大投入"
CTR 1% + 抖音 + GEO权重2 + 娱乐内容 → "曝光量大但转化弱，评估品牌心智价值"
```

没有平台元数据，归因是无上下文的数据游戏。

### 3. Content ID 链路是跨 Agent 设计债务

```
Agent 6 产出文章 → 必须携带 topic_id（设计约束）
Agent 8 发布记录 → 必须携带 content_id + topic_id（设计约束）
Agent 9 采集指标 → 必须能关联到 topic_id（归因前提）
```

这条链在 v0.2 中必须作为硬性设计约束写入 SPEC，不接受"后期再补"。

---

## 二、v0.2 目标定义

### 目标（一句话）

> **让 Agent 9 成为"平台无关的反馈学习引擎"——输入 ArticlePerformance + PlatformMeta，输出 TopicBoost + Insight + Decision，并正确路由到上游 Agent。**

### 验收标准

- [ ] Agent 6 文章输出**强制携带** `topic_id`（M0 修复）
- [ ] Agent 5 拥有 `loadFeedbackFromAgent9()` 读取函数（M0 修复）
- [ ] `platform-meta.json` 覆盖所有 P0/P1 平台（~30个）
- [ ] `attribution-engine.js` 集成平台元数据上下文
- [ ] `insight-generator.js` 生成结构化 Insight，含平台维度分析
- [ ] `decision-dispenser.js` 支持路由到 Agent 4/5/6/7/8
- [ ] Agent 9 核心（归因/Insight/路由）在 Mock 数据下完整运行
- [ ] Agent 8 接口契约写入 `FEEDBACK_CONTRACT.md`（待 Agent 8 开发时对接）
- [ ] 端到端验证：Agent 9 输出 → Agent 5 Boost 变化

---

## 三、架构设计

```
risen-agent9/
├── agent9-core.js                 # 主入口：加载→归因→Insight→路由
├── skills/
│   ├── metric-collector.js       # Skill 1：采集指标（适配器模式）
│   ├── attribution-engine.js     # Skill 2：归因计算（平台感知）
│   ├── insight-generator.js      # Skill 3：生成 Insight
│   └── decision-dispenser.js    # Skill 4：路由决策到上游 Agent
├── lib/
│   ├── platform-meta.json        # 平台元数据库（P0/P1 平台）
│   ├── platform-meta-loader.js    # 平台元数据加载器
│   ├── platform-adapters/        # 平台适配器（Mock，接口统一）
│   │   ├── interface.js         # 统一接口定义
│   │   ├── wechat-gzh-mock.js   # 微信公众号
│   │   ├── zhihu-mock.js        # 知乎
│   │   ├── csdn-mock.js        # CSDN
│   │   ├── dev-to-mock.js       # Dev.to
│   │   ├── github-mock.js       # GitHub
│   │   └── linkedin-mock.js     # LinkedIn
│   └── attribution/
│       ├── boost-calculator.js   # Boost 计算逻辑
│       └── insight-analyzer.js   # Insight 生成逻辑
├── output/
│   ├── performances/           # ArticlePerformance JSON
│   ├── topic-boosts/            # TopicBoost JSON
│   ├── insights/                # Insight JSON
│   └── decisions/               # Decision JSON
└── document/
    ├── AGENT9_PLAN_V0.2.md     # 本文档
    ├── AGENT9_SPEC.md          # 规格文档
    └── PLATFORM_META_GUIDE.md   # 平台元数据使用指南
```

---

## 四、Skill 详细设计

### Skill 1 — metric-collector

**设计原则**：适配器模式，数据来源对核心逻辑透明。

```javascript
// lib/platform-adapters/interface.js（统一接口）
async function fetchArticleMetrics(opts) {
  // opts.platformId      - 平台标识
  // opts.platformMeta     - 平台元数据（影响归因窗口）
  // opts.dateRange        - { start, end }
  // opts.articleId       - 可选，精确拉取单篇
  // 返回: ArticlePerformance[]
}

// 适配器注册表
const ADAPTERS = {
  'wechat_gzh': require('./wechat-gzh-mock'),
  'zhihu':      require('./zhihu-mock'),
  'csdn':      require('./csdn-mock'),
  'dev-to':    require('./dev-to-mock'),
  'github':    require('./github-mock'),
  'linkedin':  require('./linkedin-mock'),
};
```

**Mock 数据策略**（v0.2 所有适配器均为 Mock）：
- 每次运行随机生成，分布符合平台特性
- 文件头标注 `__mock__: true`
- 平台特性通过 `platform-meta.json` 的 `mockProfile` 字段注入

---

### Skill 2 — attribution-engine（核心）

**设计原则**：平台元数据作为归因上下文，同一个 CTR 在不同平台有不同权重。

```javascript
async function attribute({ performances, platformMeta }) {
  // performances: ArticlePerformance[]
  // platformMeta: PlatformMeta[]（从 platform-meta.json 加载）

  // Step 1：关联平台元数据
  const enriched = performances.map(p => ({
    ...p,
    meta: platformMeta[p.platform] || {}
  }));

  // Step 2：按 topic_id 聚合
  const byTopic = groupBy(enriched, 'topic_id');

  // Step 3：对每个 Topic 计算 Boost
  const topicBoosts = Object.entries(byTopic).map(([topicId, perfs]) => {
    const totalImpressions = sum(perfs, 'metrics.impressions');
    const totalClicks     = sum(perfs, 'metrics.clicks');
    const totalConversions = sum(perfs, 'metrics.conversions');
    const avgCTR = totalClicks / totalImpressions;

    // 平台权重调整：GEO权重高的平台，CTR 置信度更高
    const weightedCTR = avgCTR * (avg(perfs, 'meta.geoWeight') / 5);
    // 内容形式调整：专业内容（methodology/case）权重 > 资讯类
    const contentFormWeight = avg(perfs, 'meta.contentFormWeight');

    const adjustedCTR = weightedCTR * contentFormWeight;

    return {
      topic_id: topicId,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      avg_ctr: avgCTR,
      adjusted_ctr: adjustedCTR,   // 平台调整后的 CTR
      decision: calcBoostDecision(adjustedCTR),
      boost_score: calcBoostScore(adjustedCTR),
      source_articles: perfs.map(p => p.article_id),
      platforms: [...new Set(perfs.map(p => p.platform)],
      computed_at: new Date().toISOString()
    };
  });

  return topicBoosts;
}
```

**Boost 决策规则**：

| adjusted_ctr 范围 | boost_score | decision | 含义 |
|-----------------|------------|---------|------|
| ≥ 5% | 1.2 | SCALE | 高效，扩大生产 |
| 2% - 5% | 1.0 | CONTINUE | 正常，继续观察 |
| 0.5% - 2% | 0.8 | REDUCE | 低迷，减少投入 |
| < 0.5% | 0.0 | STOP | 失效，暂停 |

**平台调整系数**（`platform-meta.json` 中定义）：
- `geoWeight: 5` → 乘数 1.0（权威平台，数据置信度高）
- `geoWeight: 3` → 乘数 0.8（中型平台）
- `geoWeight: 1` → 乘数 0.6（长尾平台，数据波动大）

---

### Skill 3 — insight-generator

**设计原则**：每个 Insight 必须有平台维度，不做无平台的归因。

```javascript
async function generateInsights({ topicBoosts, performances, platformMeta }) {
  const insights = [];

  for (const boost of topicBoosts) {
    // Insight 类型 1：高效选题
    if (boost.decision === 'SCALE') {
      insights.push({
        id: `INS-${Date.now()}-${randomId()}`,
        type: 'topic_efficiency',
        topic_id: boost.topic_id,
        category: 'topic',
        summary: `选题在 ${boost.platforms.join('/')} 综合表现优异，建议扩大投入`,
        detail: `总曝光 ${boost.total_impressions}，总点击 ${boost.total_clicks}，` +
                `综合 CTR ${(boost.avg_ctr * 100).toFixed(1)}%，` +
                `调整后 CTR ${(boost.adjusted_ctr * 100).toFixed(1)}%`,
        platforms: boost.platforms,
        confidence: Math.min(0.95, 0.6 + boost.article_count * 0.05),
        recommended_action: 'SCALE',
        target_agent: 'agent5',
        computed_at: new Date().toISOString()
      });
    }

    // Insight 类型 2：跨平台内容形式差异
    const byForm = groupBy(boost.source_articles.map(a => findPerfs(performances, a)), 'meta.contentForm');
    for (const [form, perfs] of Object.entries(byForm)) {
      if (perfs.length < 2) continue;  // 需要多篇才有比较意义
      const formCTR = sum(perfs, 'clicks') / sum(perfs, 'impressions');
      insights.push({
        id: `INS-${Date.now()}-${randomId()}`,
        type: 'content_form_analysis',
        topic_id: boost.topic_id,
        category: 'content',
        summary: `${form}形式在 ${boost.platforms.join('/')} 效果突出`,
        detail: `该选题下 ${form}内容 CTR = ${(formCTR * 100).toFixed(1)}%，` +
                `高于综合均值 ${(boost.avg_ctr * 100).toFixed(1)}%`,
        confidence: 0.7,
        recommended_action: 'PROMOTE_FORM',
        target_agent: 'agent7',  // 格式问题 → Agent 7
        computed_at: new Date().toISOString()
      });
    }
  }

  return insights;
}
```

---

### Skill 4 — decision-dispenser

**设计原则**：Decision 必须包含目标 Agent，不接受"发给所有 Agent"。

```javascript
async function dispatch({ topicBoosts, insights }) {
  // 按目标 Agent 分组
  const byAgent = {
    agent4: [],
    agent5: [],
    agent6: [],
    agent7: [],
    agent8: [],
  };

  for (const boost of topicBoosts) {
    byAgent.agent5.push({ type: 'topic_boost', data: boost });
  }

  for (const insight of insights) {
    if (byAgent[insight.target_agent]) {
      byAgent[insight.target_agent].push({ type: 'insight', data: insight });
    }
  }

  // 写入各 Agent 对应的接收目录
  const outputDir = process.env.SHARED_OUTPUT_DIR || '../shared-output';

  for (const [agentId, items] of Object.entries(byAgent)) {
    if (items.length === 0) continue;
    const path = `${outputDir}/decisions/from-agent9/${agentId}/latest.json`;
    writeJsonAtomic(path, {
      decisions: items,
      computed_at: new Date().toISOString()
    });
    console.log(`[dispatcher] → ${agentId}: ${items.length} 条决策`);
  }
}
```

**Agent 5 接收路径**（在 `agent5-core.js` 中新增）：
```javascript
// 新增函数
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR || '../risen-agent9/output';
  const boostFiles = glob.sync(`${dir}/topic-boosts/_latest/*.json`);
  return boostFiles.map(f => JSON.parse(readFile(f)));
}
```

---

## 五、平台元数据设计（platform-meta.json）

### 字段定义

```typescript
interface PlatformMeta {
  platformId: string;           // 'wechat_gzh'
  name: string;                 // '微信公众号'
  region: string;               // '国内' | '海外' | '日本' | '韩国' ...
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  geoWeight: number;           // 1-5，GEO权重（影响归因置信度）
  contentFormWeight: number;     // 0.5-1.5，内容形式权重
  dataRefreshRate: string;     // '实时' | '小时级' | '天级' | '3天级'
  minAttributionWindow: string; // 最小归因等待窗口
  contentFit: string[];         // 适配内容类型
  mockProfile?: {              // Mock 数据生成参数
    impressionsRange: [number, number];
    ctrRange: [number, number];
    conversionRateRange: [number, number];
  };
}
```

### P0/P1 平台清单（v0.2 必须覆盖）

| 平台 | Priority | GEO权重 | 数据刷新 | 归因窗口 |
|------|---------|---------|---------|---------|
| 微信公众号 | P0 | 5 | 天级 | ≥24h |
| 知乎 | P0 | 5 | 2-3天级 | ≥72h |
| CSDN | P0 | 5 | 天级 | ≥24h |
| 掘金 | P0 | 5 | 天级 | ≥24h |
| 百家号 | P0 | 5 | 天级 | ≥24h |
| 今日头条 | P0 | 5 | 天级 | ≥24h |
| LinkedIn | P0 | 5 | 天级 | ≥24h |
| GitHub | P0 | 5 | 实时 | ≥2h |
| Medium | P0 | 5 | 天级 | ≥24h |
| Dev.to | P0 | 5 | 天级 | ≥24h |
| Hashnode | P0 | 5 | 天级 | ≥24h |
| 百度知道 | P1 | 5 | 天级 | ≥24h |
| 百度经验 | P1 | 5 | 天级 | ≥24h |
| 百度文库 | P1 | 5 | 天级 | ≥24h |
| 语雀 | P1 | 5 | 天级 | ≥24h |
| Quora | P0 | 5 | 天级 | ≥24h |
| Substack | P1 | 4 | 天级 | ≥24h |
| 博客园 | P1 | 4 | 天级 | ≥24h |
| 简书 | P2 | 3 | 天级 | ≥24h |
| 龙ithei | P2 | 3 | 天级 | ≥24h |
| SegmentFault | P1 | 4 | 天级 | ≥24h |
| Gitee | P1 | 4 | 实时 | ≥2h |
| InfoQ | P1 | 4 | 天级 | ≥24h |
| 36氪 | P1 | 4 | 天级 | ≥24h |
| 虎嗅 | P1 | 4 | 天级 | ≥24h |
| 钛媒体 | P1 | 4 | 天级 | ≥24h |
| 雷锋网 | P2 | 4 | 天级 | ≥24h |
| 机器之心 | P2 | 4 | 天级 | ≥24h |
| 量子位 | P2 | 4 | 天级 | ≥24h |

（后续按需扩展至其他 P1/P2 平台）

---

## 六、Agent 8 接口契约（FEEDBACK_CONTRACT.md 补充）

Agent 8 写入 → Agent 9 读取，约定如下：

```javascript
// Agent 8 写入路径
const AGENT8_OUTPUT = `${SHARED_OUTPUT_DIR}/agent8/publications/`;

// 文件名规范
// {YYYY-MM}/PUB-{publication_id}.json

// 文件内容
{
  "publication_id": "PUB-xxx",
  "article_id": "ART-xxx",         // 必须：关联到 Agent 6 产出
  "topic_id": "TOPIC-xxx",          // 必须：关联到 Agent 5 选题
  "platform": "wechat_gzh",         // 必须
  "remote_publication_id": "...",    // 平台侧 ID
  "remote_url": "https://...",     // 发布链接
  "published_at": "2026-07-02T...",// 发布时间
  "status": "published",            // published | failed | draft
  "__source__: "agent8",
  "__mock__: false                  // Agent 8 标记是否为 Mock
}

// Agent 9 轮询路径
const perfPath = `${AGENT8_OUTPUT}{YYYY-MM}/PUB-{id}.json`;
if (exists(perfPath)) {
  const pub = JSON.parse(readFile(perfPath));
  // 关联 ArticlePerformance
}
```

---

## 七、M0 前置修复（必须先做）

### M0.1：Agent 6 文章输出加 topic_id

**文件**：`/workspace/RISEN-OS/agent6/agent6-core.js`

**修复位置**：`runAgent6()` 的 `article` 对象（第 208 行附近）

**改动**：1行
```javascript
// 在 article 对象中加入 topic_id
const article = {
  article_id: generateArticleId(),
  topic_id: topicBrief.topic_id,   // ← 新增这行
  // ... 其余字段不变
};
```

**验证**：
```bash
node agent6-core.js --input mock-data/sample-topic-brief.json
# 检查 output/ART-*.json 中是否有 topic_id 字段
```

### M0.2：Agent 5 新增 loadFeedbackFromAgent9()

**文件**：`/workspace/RISEN-OS/agent5/agent5-core.js`

**改动**：
```javascript
// 在 getMockFeedbackSignals() 前新增
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR || path.join(__dirname, '../../risen-agent9/output');
  const boostFiles = (() => {
    try {
      const glob = require('glob');
      return glob.sync(`${dir}/topic-boosts/_latest/*.json`);
    } catch (e) {
      return [];
    }
  })();
  if (boostFiles.length === 0) return null;
  return boostFiles.map(f => {
    const b = JSON.parse(fs.readFileSync(f, 'utf8'));
    return {
      topic_keyword: b.topic_id,         // Agent5 用 topic_id 做关键词匹配
      engagement_score: b.boost_score,
      content_type: b.content_type || '综合'
    };
  });
}

// 修改 runAgent5() 中的 feedback 读取逻辑
const feedbackSignals = opts.feedbackSignals
  || loadFeedbackFromAgent9()
  || getMockFeedbackSignals();
```

---

## 八、里程碑

### M0：前置修复（1-2小时）

- [ ] Agent 6 文章输出加 topic_id（1行）
- [ ] Agent 5 新增 loadFeedbackFromAgent9()（~15行）
- [ ] 验证：Agent 6 输出包含 topic_id

### M1：工程骨架 + 平台元数据（约4小时）

- [ ] 目录结构建立
- [ ] `platform-meta.json`（覆盖 ~30个 P0/P1 平台）
- [ ] `platform-meta-loader.js`
- [ ] `agent9-core.js` 主流程

### M2：归因引擎 + Insight 生成（约4小时）

- [ ] `attribution-engine.js`（平台感知版）
- [ ] `boost-calculator.js`
- [ ] `insight-analyzer.js`
- [ ] `insight-generator.js`

### M3：决策路由 + Mock 适配器（约3小时）

- [ ] `decision-dispenser.js`
- [ ] 6个平台 Mock 适配器
- [ ] `FEEDBACK_CONTRACT.md` 更新（补充 Agent 8 接口契约）

### M4：端到端验证（约2小时）

- [ ] Agent 9 完整运行
- [ ] 输出文件格式验证
- [ ] Agent 5 读取 Boost
- [ ] Mock 数据标识检查

---

## 九、风险与规避（v0.2 更新版）

| 风险 | 类型 | 规避方式 |
|------|------|---------|
| 平台元数据维护成本高 | 🟡 中 | 只维护 P0/P1（~30个），P2/P3/P4 按需扩展 |
| 归因窗口不统一 | 🟡 中 | `platform-meta.json` 每个平台定义 `minAttributionWindow` |
| Agent 8 接口契约变更 | 🟡 中 | 写入 `FEEDBACK_CONTRACT.md`，版本化管理 |
| Mock 数据被误用 | 🔴 高 | `__mock__: true` 强制标注，UI 层显示"模拟数据" |
| Boost 计算参数主观 | 🟢 低 | 参数透明可配置，通过 `attribution-config.json` 调整 |
| 决策路由到无接收方 | 🟢 低 | `dispatcher` 跳过无接收方的 Agent，不报错 |

---

## 十、v0.2 不做的事

以下内容明确不在 v0.2 范围：

- ❌ 真实平台 API 对接（全是 Mock）
- ❌ 线索→商机→收入归因
- ❌ A/B 实验统计显著性分析
- ❌ Temporal 工作流
- ❌ 多租户隔离
- ❌ OAuth 账号管理
- ❌ P2/P3/P4 平台元数据（按需扩展）
- ❌ 跨 Agent 的 Workflow 编排（每个 Agent 独立运行，通过文件交互）

---

## 十一、与 v0.1 的差异摘要

| 维度 | v0.1 | v0.2 |
|------|-------|-------|
| 平台数量 | 4个 | ~30个（P0/P1） |
| 平台元数据 | 无 | 有（影响归因置信度） |
| Insight 生成 | 简化版 | 平台维度感知 |
| 决策路由 | 只到 Agent5 | 到 Agent4/5/6/7/8 |
| Agent 8 接口 | 无 | FEEDBACK_CONTRACT 补充 |
| M0 前置修复 | 无 | Agent6+Agent5 修复 |
| 适配器模式 | 直接 Mock | 统一接口适配器模式 |

---

*本文档为 v0.2 实施计划，Agent 9 完整能力边界以 PRD V2.0 为准。*
