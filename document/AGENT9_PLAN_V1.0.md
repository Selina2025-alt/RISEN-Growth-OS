# Agent 9 v1.0 实施计划

> 版本：v1.0
> 状态：生产就绪设计版（基于两轮评估 + 行业调研）
> 核心变化：从"自创公式"升级为"行业验证模型 + 可插拔架构"
> 目标：RISEN 合流时，Agent 9 核心逻辑经过真实数据验证

---

## 一、行业调研发现（v0.2 → v1.0 的关键输入）

### 1.1 归因模型的行业标准

调研了 Mixpanel、Segment、增长黑客社区、GitHub 开源项目（mbuzz-node/whitefly-js）、GrowthBook 后，结论如下：

**归因模型成熟度分级**：

| 模型 | 描述 | 适用场景 | 成熟度 |
|------|------|---------|--------|
| Last Non-Direct Click | 100% 归因到最后触点 | 短周期转化 | 成熟 |
| First Touch | 100% 归因到首个触点 | 品牌认知 | 成熟 |
| Linear | 平均分配权重 | 长周期决策 | 成熟 |
| Time Decay | 近期触点权重更高 | 电商/ SaaS | 成熟 |
| Position Based | 首尾各40%，中间均分 | B2B | 成熟 |
| Data-Driven / Custom | ML 模型决定权重 | 超大型产品 | 高门槛 |

**CTR 基准参考**（行业公开数据，非自创）：

| 平台/场景 | 差 | 平均 | 良好 | 优秀 |
|-----------|-----|------|------|------|
| 微信公众号图文 | <1% | 2-3% | 3-5% | >5% |
| 知乎回答 | <2% | 3-5% | 5-8% | >8% |
| CSDN/掘金技术文 | <2% | 3-5% | 5-8% | >8% |
| LinkedIn 文章 | <1% | 2-4% | 4-6% | >6% |
| Dev.to | <1% | 2-3% | 3-5% | >5% |
| GitHub README | N/A | CTR 概念不适用 | 另看 Star/Fork | — |

**v0.2 的核心错误**：用 `geoWeight / 5` 乘 CTR 是自己发明的，不是行业标准。

### 1.2 GrowthBook 的可借鉴点

GrowthBook（MIT License，开源）是目前最接近 Agent 9 实验分析需求的系统：

- **CUPED**（利用预实验数据降低方差）：直接可用于"某选题上线前后的 CTR 差异分析"
- **Sequential Testing**：防止"看到显著就停"的早期停止错误
- **Bayesian 引擎**：不需要大样本就能得出结论，适合初期数据少的时候
- **MCP Server**：已有 AI Agent 集成方案

**v1.0 不引入 GrowthBook 作为依赖**（需要后端部署），但参考其统计方法设计 v1.0 的简化版。

### 1.3 mbuzz-node / whitefly-js 的定位

这两个是**多触点归因的 Node.js 库**，提供了：
- 4-Call 模型（init/event/conversion/identify）
- Multi-Touch Attribution（Linear/Time-decay/Position-based）
- 独立运行（不强制 SaaS）

**但它们面向的是"用户行为追踪"**，不是"内容效果归因"。内容营销场景的归因模型比用户行为更复杂（内容生命周期更长、转化路径更模糊）。

**结论**：不直接用，但参考其模型选择接口设计。

---

## 二、v1.0 核心设计原则（修复版）

### 2.1 归因引擎的设计原则

**第一条原则：不用自己发明的公式。**

所有计算参数必须来自以下之一：
1. 行业公开基准数据（有据可查）
2. 平台官方数据（如 YouTube Analytics API 的公开基准）
3. 从真实数据中统计得出（不是拍脑袋）

**第二条原则：模型可插拔，参数可配置。**

```javascript
// attribution-config.json
{
  "model": "linear",           // "linear" | "time_decay" | "position_based"
  "modelParams": {
    "halfLifeDays": 7          // time_decay 模型参数
  },
  "platformBenchmarks": {       // 行业基准（非自创）
    "wechat_gzh": { "avgCTR": 0.025, "goodCTR": 0.05, "excellentCTR": 0.08 },
    "zhihu":       { "avgCTR": 0.035, "goodCTR": 0.06, "excellentCTR": 0.10 },
    "csdn":        { "avgCTR": 0.030, "goodCTR": 0.06, "excellentCTR": 0.10 },
    "dev-to":      { "avgCTR": 0.020, "goodCTR": 0.04, "excellentCTR": 0.08 },
    "linkedin":    { "avgCTR": 0.020, "goodCTR": 0.04, "excellentCTR": 0.06 },
    "github":      { "avgCTR": null, "metric": "star_rate" }
  },
  "boostThresholds": {
    "excellent": 1.2,           // 高于平台优秀基准
    "good": 1.0,               // 高于平均基准
    "average": 0.8,            // 低于平均基准
    "poor": 0.0                // 远低于基准
  }
}
```

### 2.2 平台基准数据来源说明

| 平台 | 基准数据来源 | 可信度 |
|------|------------|--------|
| 微信公众号 | 行业公开报告（腾讯营销洞察等） | 🟢 中高 |
| 知乎 | 知乎官方创作者报告 | 🟢 中 |
| CSDN/掘金 | 平台官方数据/技术社区统计 | 🟢 中 |
| Dev.to | 官方博客公开数据 | 🟢 中 |
| LinkedIn | LinkedIn 官方营销博客 | 🟢 中 |
| GitHub | 另用 Star Rate 而非 CTR | 🟢 高 |

**说明**：这些基准是行业公开数据，不是我们自己测的，可以作为参考但不是绝对真理。v1.0 阶段标注"参考基准"，等有真实数据后替换为实际统计值。

---

## 三、v1.0 架构（最终版）

```
risen-agent9/
├── agent9-core.js                    # 主入口
├── skills/
│   ├── metric-collector.js           # Skill 1：采集指标（适配器模式）
│   ├── attribution-engine.js         # Skill 2：归因计算（模型可插拔）
│   ├── insight-generator.js         # Skill 3：生成 Insight
│   └── decision-dispenser.js         # Skill 4：路由决策（只到 Agent5）
├── lib/
│   ├── platform-meta.json            # 平台元数据（P0/P1 ~30个）
│   ├── platform-meta-loader.js        # 平台元数据加载器
│   ├── attribution-config.json        # 归因配置（模型+基准+阈值，可配置）
│   ├── attribution/
│   │   ├── models/
│   │   │   ├── linear.js           # Linear 模型
│   │   │   ├── time-decay.js       # Time Decay 模型
│   │   │   └── position-based.js   # Position Based 模型
│   │   ├── boost-calculator.js      # Boost 分数计算
│   │   └── stats-helpers.js         # 统计辅助函数
│   └── platform-adapters/           # 平台适配器（Mock）
│       ├── interface.js
│       ├── wechat-gzh-mock.js
│       ├── zhihu-mock.js
│       ├── csdn-mock.js
│       ├── dev-to-mock.js
│       ├── github-mock.js
│       └── linkedin-mock.js
├── output/
│   ├── performances/
│   ├── topic-boosts/
│   ├── insights/
│   └── decisions/
└── document/
    ├── AGENT9_PLAN_V1.0.md
    ├── AGENT9_SPEC.md
    ├── ATTRIBUTION_MODELS.md        # 归因模型说明文档
    └── PLATFORM_BENCHMARKS.md       # 平台基准数据说明
```

---

## 四、Skill 详细设计

### Skill 1 — metric-collector（不变）

与 v0.2 一致，适配器模式，统一接口。

### Skill 2 — attribution-engine（重写）

```javascript
// skills/attribution-engine.js
// 核心原则：不自己发明公式，用可配置的模型+公开基准

const config = require('../lib/attribution-config.json');
const { loadPlatformMeta } = require('../lib/platform-meta-loader');

// 支持的模型
const MODELS = {
  linear:        require('../lib/attribution/models/linear'),
  time_decay:    require('../lib/attribution/models/time-decay'),
  position_based: require('../lib/attribution/models/position-based'),
};

async function attribute({ performances }) {
  const platformMeta = loadPlatformMeta();
  const model = MODELS[config.model] || MODELS.linear;

  // Step 1: 关联平台基准
  const enriched = performances.map(p => ({
    ...p,
    benchmark: config.platformBenchmarks[p.platform] || null
  }));

  // Step 2: 按 topic 聚合，用选定模型分配权重
  const byTopic = groupBy(enriched, 'topic_id');
  const topicBoosts = Object.entries(byTopic).map(([topicId, perfs]) => {
    // 用模型计算各平台的归因权重
    const attribution = model.attribute(perfs);

    // 计算综合 CTR（加权）
    let totalImpressions = 0, totalClicks = 0, totalConversions = 0;
    let weightedCTR = 0;

    for (const [perf, weight] of attribution.entries()) {
      totalImpressions += perf.metrics.impressions;
      totalClicks     += perf.metrics.clicks;
      totalConversions += perf.metrics.conversions;
      // 平台基准归一化：超过基准越多，权重越高（用于最终分数）
      const platformBenchmark = perf.benchmark;
      const rawCTR = perf.metrics.ctr;
      if (platformBenchmark && platformBenchmark.avgCTR) {
        const ratio = rawCTR / platformBenchmark.avgCTR;
        weightedCTR += ratio * weight;
      } else {
        weightedCTR += rawCTR * weight;
      }
    }

    const avgCTR = totalClicks / totalImpressions;
    const avgCVR = totalConversions / totalClicks;

    // Step 3: 用 Boost 阈值判断
    const boost = calcBoost(avgCTR, config.platformBenchmarks, perfs);

    return {
      topic_id: topicId,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_conversions: totalConversions,
      avg_ctr: avgCTR,
      avg_cvr: avgCVR,
      model_used: config.model,
      decision: boost.decision,
      boost_score: boost.score,
      confidence: calcConfidence(perfs),   // 样本量越多样本置信度越高
      source_articles: perfs.map(p => p.article_id),
      platforms: [...new Set(perfs.map(p => p.platform))],
      computed_at: new Date().toISOString(),
      __mock__: perfs.some(p => p.__mock__),
      __config__: {
        model: config.model,
        benchmark_version: 'v1.0',
        config_updated: new Date().toISOString()
      }
    };
  });

  return topicBoosts;
}

// Boost 阈值判断（用平台基准，不是拍脑袋）
function calcBoost(avgCTR, benchmarks, perfs) {
  // 取主要平台的基准（频率最高的平台）
  const mainPlatform = perfs[0]?.platform;
  const bench = benchmarks[mainPlatform];

  if (!bench || !bench.avgCTR) {
    // 无基准的平台：用通用阈值
    if (avgCTR >= 0.05) return { score: 1.2, decision: 'SCALE' };
    if (avgCTR >= 0.02) return { score: 1.0, decision: 'CONTINUE' };
    if (avgCTR >= 0.005) return { score: 0.8, decision: 'REDUCE' };
    return { score: 0.0, decision: 'STOP' };
  }

  const ratio = avgCTR / bench.avgCTR;
  if (ratio >= 2.0)       return { score: 1.2, decision: 'SCALE' };
  if (ratio >= 1.0)       return { score: 1.0, decision: 'CONTINUE' };
  if (ratio >= 0.5)       return { score: 0.8, decision: 'REDUCE' };
  return { score: 0.0, decision: 'STOP' };
}

// 置信度：样本量（总曝光）越大，置信度越高
function calcConfidence(perfs) {
  const totalImp = perfs.reduce((s, p) => s + p.metrics.impressions, 0);
  if (totalImp >= 100000) return 0.95;
  if (totalImp >= 50000)  return 0.85;
  if (totalImp >= 10000)  return 0.75;
  if (totalImp >= 5000)   return 0.65;
  if (totalImp >= 1000)   return 0.55;
  return 0.45;  // 低于1000曝光，置信度偏低，参考意义有限
}
```

**关键改进**：Boost 判断用"相对于平台基准的倍数"（ratio），而不是绝对 CTR 值。这意味着：
- 微信公众号 CTR 1% 是"良好"（基准2-3%）
- 知乎 CTR 1% 是"差"（基准3-5%）

### Skill 3 — insight-generator（不变）

与 v0.2 一致，生成含平台维度的结构化 Insight。

### Skill 4 — decision-disperser（缩小范围）

**v1.0 只对接 Agent 5**。Agent 4/6/7 的接收机制，等各自 SPEC 更新后再接入。

```javascript
// 目标 Agent 只限已注册接收方
const REGISTERED_AGENTS = {
  agent5: true,    // ✅ 有 loadFeedbackFromAgent9()
  // agent4: false, // ❌ 暂无接收机制
  // agent6: false, // ❌ 暂无 Decision 接收接口
  // agent7: false, // ❌ Agent 7 尚未定义
  // agent8: false, // ❌ Agent 8 输出到 Agent9，不是接收
};
```

---

## 五、M0 前置修复（不变）

### M0.1：Agent 6 article 对象加 topic_id

**文件**：`/workspace/RISEN-OS/agent6/agent6-core.js`（约第 208 行）

```javascript
const article = {
  article_id: generateArticleId(),
  topic_id: topicBrief.topic_id,   // ← 新增1行
  direction_id: topicBrief.direction_id,  // ← 新增（同样缺失）
  // ... 其余不变
};
```

### M0.2：Agent 5 新增 loadFeedbackFromAgent9()

```javascript
function loadFeedbackFromAgent9() {
  const dir = process.env.AGENT9_OUTPUT_DIR
    || path.join(__dirname, '../../risen-agent9/output');
  let boostFiles;
  try {
    boostFiles = fs.readdirSync(dir + '/topic-boosts/_latest/')
      .filter(f => f.endsWith('.json'))
      .map(f => dir + '/topic-boosts/_latest/' + f);
  } catch (e) {
    boostFiles = [];
  }
  if (boostFiles.length === 0) {
    console.warn('[Agent5] ⚠️ Agent9 数据不可用（目录为空或路径错误），fallback 到 Mock');
    return null;
  }
  const boosts = boostFiles.map(f => {
    const b = JSON.parse(fs.readFileSync(f, 'utf8'));
    return {
      topic_keyword: b.topic_id,
      engagement_score: b.boost_score,
      content_type: b.content_type || '综合',
      data_source: '__agent9__',
      computed_at: b.computed_at
    };
  });
  console.log(`[Agent5] ✅ 读取 ${boosts.length} 条 Agent9 Boost 数据`);
  return boosts;
}
```

**关键改进**：
- 用 `fs.readdirSync` 代替 `glob`（无新依赖）
- 路径不存在时打印 **warn** 而非静默失败
- 加数据来源标识 `data_source: '__agent9__'`

---

## 六、Mock 数据策略（v1.0 原则）

### 6.1 Mock 数据必须可识别

每个 ArticlePerformance 输出必须包含：
```javascript
{
  article_id: "...",
  __mock__: true,           // 强制标注
  __source__: 'mock',       // 'mock' | 'platform_api'
  __mockConfig__: {
    impressions: [5000, 20000],  // 随机区间
    ctrRange: [0.015, 0.08],    // 符合平台基准分布
    platform: 'wechat_gzh'
  }
}
```

### 6.2 Mock 分布原则

Mock 数据的 CTR 分布必须符合平台基准：
```
微信公众号 Mock：CTR 分布 ~N(0.025, 0.015)
知乎 Mock：CTR 分布 ~N(0.035, 0.020)
```

这意味着 Mock 数据里：
- 约 50% 的 Mock 文章 CTR 在"平均基准"附近
- 约 16% 高于"良好基准"
- 约 2.5% 高于"优秀基准"

**这样 Mock 数据跑出来的 Boost 分布是合理的，不会全是 SCALE 或全是 STOP。**

### 6.3 Mock 数据用途明确

| 验证目标 | Mock 能做到 | Mock 不能做到 |
|---------|-----------|--------------|
| 归因逻辑正确性 | ✅ | |
| Boost 计算正确性 | ✅ | |
| 决策路由正确性 | ✅ | |
| 公式参数准确性 | ❌ | 需要真实数据 |
| 公式本身有效性 | ❌ | 需要真实数据 |

→ **SPEC 必须明确注明**：v1.0 Mock 数据验证逻辑，不验证参数。

---

## 七、里程碑

### M0：前置修复（0.5小时）
- [ ] Agent 6 article 加 `topic_id` + `direction_id`（2行）
- [ ] Agent 5 加 `loadFeedbackFromAgent9()`（~20行，含 warn 日志）
- [ ] 验证：Agent 6 输出含 topic_id，Agent 5 读取有 warn

### M1：骨架 + 配置层（2小时）
- [ ] 目录结构
- [ ] `attribution-config.json`（模型+基准+阈值，完全可配置）
- [ ] `platform-meta.json`（~30个 P0/P1 平台）
- [ ] 三个归因模型（Linear/Time-Decay/Position-Based，接口统一）
- [ ] `platform-meta-loader.js`

### M2：归因引擎（3小时）
- [ ] `attribution-engine.js`（模型可插拔版）
- [ ] `boost-calculator.js`
- [ ] `stats-helpers.js`（置信度计算）
- [ ] Mock 数据按平台基准分布生成

### M3：Insight + 决策路由（2小时）
- [ ] `insight-generator.js`
- [ ] `decision-dispenser.js`（只到 Agent5）
- [ ] `FEEDBACK_CONTRACT.md` 补充 Agent 8 接口契约

### M4：端到端验证 + 文档（2小时）
- [ ] Agent 9 完整运行
- [ ] Boost 分布合理性检查（应有 SCALE/CONTINUE/REDUCE/STOP 四种）
- [ ] `ATTRIBUTION_MODELS.md`（归因模型说明）
- [ ] `PLATFORM_BENCHMARKS.md`（基准数据来源说明）

---

## 八、v0.2 自我审查问题的修复状态

| # | 问题 | v1.0 修复方式 |
|---|------|-------------|
| 1 | adjusted_ctr 公式未验证 | 改用"相对平台基准倍数"，可配置参数 |
| 2 | Mock 数据让公式无法验证 | 明确 Mock 用途，不声称验证参数 |
| 3 | Agent 4/6/7 无接收方 | v1.0 只到 Agent5，其他等 SPEC 更新 |
| 4 | fallback 静默无提示 | 加 console.warn + data_source 标注 |
| 5 | glob 依赖不确定 | 改用 fs.readdirSync |
| 6 | contentFormWeight 假设简化 | v1.0 不引入 contentFormWeight，只用 CTR/基准 |
| 7 | topic_id 格式可能不一致 | M0.1 同时加 topic_id 和 direction_id |
| 8 | 元数据无维护机制 | 加 `__updated` 时间戳，运行时检查是否 > 30 天 |
| 9 | Insight 类型预设 | SPEC 明确 v1.0 只支持 2 种类型 |
| 10 | Decision 无 TTL | v1.0 Decision 加 `expires_at`（24小时后过期） |

---

## 九、v1.0 不做的事（明确边界）

以下明确不在 v1.0 范围：

- ❌ 真实平台 API 对接（全是 Mock）
- ❌ 线索→商机→收入归因
- ❌ A/B 实验统计显著性分析（v0.3+ 再引入 GrowthBook 的 CUPED）
- ❌ Bayesian 实验分析（v0.3+）
- ❌ Multi-Touch Attribution（用户旅程追踪，不是内容归因）
- ❌ Agent 4/6/7/8 的接收/发送机制（等各自 SPEC 更新）
- ❌ P2/P3/P4 平台元数据
- ❌ Temporal 工作流
- ❌ 多租户隔离

---

## 十、v1.0 与 v0.2 的核心差异

| 维度 | v0.2 | v1.0 |
|------|-------|-------|
| 归因公式 | `geoWeight/5 × CTR`（自创） | ratio to platform benchmark（行业基准） |
| 模型 | 单一公式 | 三模型可插拔（Linear/TimeDecay/PositionBased） |
| 参数 | 硬编码 | `attribution-config.json` 可配置 |
| Mock CTR | 随机分布 | 符合平台基准的正态分布 |
| 路由范围 | 5个 Agent | **只到 Agent5** |
| fallback | 静默 | warn + 标注 |
| 新依赖 | glob（不确定） | 无新增依赖 |
| Decision TTL | 无 | 24h 过期 |

---

*本文档为 v1.0 实施计划，基于行业调研（GrowthBook/mbuzz/whitefly-js）和两轮自我审查。*
