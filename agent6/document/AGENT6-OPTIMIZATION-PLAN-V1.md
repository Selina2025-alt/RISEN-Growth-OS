# Agent 6 完整优化实施计划

**版本：V1.1 | 日期：2026-07-04 | 状态：✅ 阶段1-5全部完成（6个commit）**

---

## 一、根因分析

### 1.1 问题总结

| 根因 | 表现 | 影响 |
|------|------|------|
| Agent 6 把自己当纯写作工具 | 只调用 khazix-writer | 无法 SEO/GEO |
| 输入上下文只有 topic_id | 缺少 Strategy Card / Brand Policy / ICP | 文章无约束 |
| SEO/GEO Skill 全缺失 | 0 个相关 Skill | PRD 要求为零 |
| 多写作模式只有 4 种 | 每种 1 个主笔 | 无法场景切换 |
| 多源调研能力缺失 | 只靠 knowledge/ | 文章无原始来源 |

### 1.2 PRD 定义的核心数据流（vs 实际）

**PRD 标准流程：**
```
Agent2 → Brand Policy + Evidence Graph  \
                                    → Agent6 → Master Article
Agent3 → ICP + Persona + Intent Signal  /
Agent4 → Strategy Card + Channel Mix    /
Agent5 → Topic Brief + Editorial Calendar → Agent6
```

**实际流程：**
```
Agent5 → topic_id（仅此一项）
Agent4 → mock 数据（不是 Agent2/3 的真实输出）
Agent2/3 → 不存在，无真实输入
```

---

## 二、Skill 能力矩阵

### 2.1 已有 Skills（13个）

| Skill | 功能 | 评级 |
|-------|------|------|
| `capability-index-builder` | 从 knowledge/ 构建能力索引 | ✅ 好 |
| `topic-capability-matcher` | 选题↔能力匹配（ngram相似度） | ✅ 好 |
| `insertion-strategy-decider` | 软/硬植入决策 + 分位点分配 | ✅ 好 |
| `knowledge-sync` | 文件监听触发重建 | ✅ 好 |
| `knowledge-update-handler` | diff检测 + 增量更新索引 | ✅ 好 |
| `skill-selector` | 写作模式路由（4种模式） | ⚠️ 需扩展 |
| `kai-gate` | 质量门 | ✅ 好 |
| `validate-skill` | Skill质量验证 | ✅ 好 |
| `feedback-loop` | 反馈回路 | ✅ 好 |
| `writing-stub` | 写作fallback兜底 | ⚠️ 需提升 |
| `campaign-consumer` | 读取 Campaign | ✅ 好 |
| `diff-detector` | 文件差异检测 | ✅ 好 |

### 2.2 新增 Skills（12个）

| Skill | 类型 | 优先级 | 来源 |
|-------|------|--------|------|
| `seo-structure-skill` | 自研 | **P0** | 参考 yao-open-prompts + 自研 |
| `geo-article-generator` | 集成/改写 | **P0** | yao-open-prompts/geo-article-generator |
| `geo-article-transformer` | 集成/改写 | **P0** | yao-open-prompts/geo-article-ai-friendly-transformation |
| `evidence-pack-skill` | 自研 | **P0** | PRD 要求 + 自研方法论 |
| `fact-grounding-skill` | 集成 | P1 | 接 llama_index（MIT）|
| `source-discovery-skill` | 集成 | P1 | 接 RAGFlow（Apache-2.0）|
| `multi-source-research-skill` | 集成 | P1 | 接 DATAGEN（MIT）|
| `seo-keyword-research` | 自研 | P1 | 参考 yao-open-prompts SEO 思路 |
| `schema-org-generator` | 集成 | P1 | yao-open-prompts/schema-org-geo-optimization |
| `geo-metrics-skill` | 集成 | P2 | yao-open-prompts/geo-metrics-monitoring |
| `content-lineage-tracker` | 自研 | P2 | PRD 要求 |
| `brand-policy-reader` | 自研 | P1 | PRD Agent2 输出接口 |

---

## 三、GEO 知识库参考（姚金刚 yao-open-prompts）

**GitHub：** https://github.com/yaojingang/yao-open-prompts

**核心引用文件：**

| 文件 | 用途 | 核心概念 |
|------|------|---------|
| `geo-article-ai-friendly-transformation.md` | GEO 文章改造 | 12维度权重体系、证据引用层43%、三层验证 |
| `geo-article-generator.md` | GEO文章生成 | IVF模型、信息熵、品牌战略植入 |
| `schema-org-geo-optimization.md` | Schema.org优化 | name/description语义优化、AI信任度提升 |
| `source-authority-building.md` | 来源权威建设 | 学术论文 > 行业报告 > 权威机构 > 专家观点 |
| `geo-metrics-monitoring-analysis.md` | GEO指标监控 | 12维度评分、AI引用率追踪 |

**12维度GEO权重（来自 yao-open-prompts）：**

```
证据引用层（43%总权重）
  ├── 权威原文引语     16%
  ├── 统计数据         14%
  └── 可引用性/可信来源 13%

结构理解层（12%）
  └── 清晰标题/摘要/FAQ/步骤化内容

其他维度（45%）
  ├── 表达流畅度       10%
  ├── 语义密度          8%
  ├── 权威信号          8%
  ├── 专业术语          6%
  ├── 鲁棒性            5%
  └── 跨域连接          4%
```

---

## 四、GitHub 高星项目调研（可集成）

| 项目 | Stars | 许可 | Agent 6 用途 |
|------|-------|------|-------------|
| RAGFlow | 84,245 | Apache-2.0 | GEO + 研究，最强RAG引擎 |
| llama_index | 50,637 | MIT | 知识检索 + 事实核验 |
| AnythingLLM | 62,551 | MIT | 本地知识库管理 |
| DATAGEN | 1,764 | MIT | 多智能体调研自动化 |
| n8n | 195,108 | Fair-code | SEO工作流编排（自部署） |

**许可安全：**
- ✅ MIT / Apache-2.0：RAGFlow、llama_index、AnythingLLM、DATAGEN
- ⚠️ GPL-3.0：WritingTools、MaxKB（不作为库直接集成）
- ⚠️ Fair-code：n8n（自部署可用）

---

## 五、分阶段技术实施

### 📦 阶段 1：补齐 PRD 强制要求（Week 1-2）

#### 1.1 `seo-structure-skill`（自研）⭐ P0

**功能：** 为文章生成 SEO 结构化元数据

**输入：** `article_content, target_keywords, platform`

**输出：**
```javascript
{
  meta_title: string,        // ≤60字符
  meta_description: string,  // ≤160字符
  h_structure: string[],     // H2/H3 标题数组（3-8个）
  internal_links: string[],  // 内链占位符 [相关阅读：TOPIC_ID]
  faq_schema: object[],      // FAQ 结构化数据
  keywords: { primary: [], secondary: [], long_tail: [] }
}
```

**实现要点：**
- 提取主关键词 + 3-5 个长尾词
- 生成 meta title + meta description
- 设计 H2/H3 标题结构
- 自动生成 FAQ（基于文章核心问题）
- 输出 Schema.org FAQ 标记

**文件位置：** `skills/seo-structure-skill.js`

---

#### 1.2 `geo-article-generator`（基于 yao-open-prompts 改写）⭐ P0

**来源：** `yao-open-prompts/geo-article-generator.md`

**改动：**
- 适配 Jova Skill 输入/输出 Schema
- 集成 `capability-index-builder` 的公司能力作为 brand_context
- 添加软/硬植入决策（调用 `insertion-strategy-decider`）
- 添加 SEO 关键词注入

**输入：**
```javascript
{
  topic_brief: TopicBrief,
  brand_info: { company_name, product_name, capabilities },
  seo_keywords: { primary, secondary, geo },
  insertion_type: 'soft' | 'hard'
}
```

**输出：**
```javascript
{
  article: string,
  seo_metadata: seo-structure-skill输出,
  geo_score: { overall: 0-100, dimensions: {...} },
  evidence_references: [{ source, quote, relevance }]
}
```

**文件位置：** `skills/geo-article-generator.js`

---

#### 1.3 `geo-article-transformer`（基于 yao-open-prompts 改写）⭐ P0

**来源：** `yao-open-prompts/geo-article-ai-friendly-transformation.md`

**核心流程：**
```
原文分析 → GEO差距诊断（12维度）→ 权重驱动改造 → 三层验证
```

**三层验证：**
1. **原意保真验证**：核心观点对照、关键事实一致、无编造
2. **GEO优化度验证**：权重要素覆盖度、各维度评分≥70分
3. **可用性验证**：可读性、自然度、实用性

**红线控制：**
- ❌ 改变原文核心观点或结论
- ❌ 编造原文不存在的数据、引用、案例
- ❌ 过度优化导致可读性大幅下降

**输入：** 已生成的 article + target keywords
**输出：** GEO优化后的 article + 改造说明

**文件位置：** `skills/geo-article-transformer.js`

---

#### 1.4 `evidence-pack-skill`（自研）⭐ P0

**PRD 要求：** Agent 6 必须输出 Evidence Pack（事实与观点分离）

**输出格式：**
```javascript
{
  facts: [{
    statement: string,      // 事实陈述
    source: string,         // 来源
    confidence: 0-1,        // 置信度
    traceability: string    // 可追溯性
  }],
  viewpoints: [{
    claim: string,          // 观点
    stance: string,         // 立场
    supporting_facts: [],   // 支撑事实
    counter_arguments: []   // 反驳论点
  }],
  citations: [{
    text: string,
    source: string,
    type: 'academic' | 'report' | 'expert' | 'case',
    relevance_score: 0-1
  }],
  evidence_graph: {
    nodes: [],  // 事实节点
    edges: []   // 关系边
  }
}
```

**核心逻辑：**
- 调用 `source-discovery-skill` 获取原始来源
- 用 llama_index 做事实核验
- 生成 Fact List 和 Viewpoint Map（PRD 要求）
- 记录内容血缘（用于 Agent 9 归因）

**文件位置：** `skills/evidence-pack-skill.js`

---

### 📦 阶段 2：扩展 Skill 路由（Week 3）

#### 2.1 扩展 `skill_routes.yml`

```yaml
# 扩展后的完整路由

deep_long_form:
  primary: khazix-writer
  aux:
    - geo-article-generator      # ⭐ GEO文章生成
    - hv-analysis               # 竞品横评
    - ljg-think                 # 概念深挖
    - seo-structure-skill       # ⭐ SEO结构化
  fallback: ljg-writes

technical:
  primary: ljg-writes
  aux:
    - ljg-learn
    - seo-structure-skill       # ⭐
    - fact-grounding-skill      # ⭐ 接llama_index
  fallback: khazix-writer

hot_chase:
  primary: huashu-douyin-script
  aux:
    - geo-article-transformer   # ⭐ 快速GEO改造
    - ljg-card                 # 视觉摘要
    - seo-structure-skill      # 爆款标题
  fallback: ljg-writes

case_study:
  primary: kai-write
  aux:
    - hv-analysis
    - ljg-rank
    - evidence-pack-skill      # ⭐ 事实/观点分离
    - geo-article-generator
  fallback: khazix-writer

comparison:
  primary: hv-analysis
  aux:
    - ljg-think
    - seo-structure-skill
    - evidence-pack-skill
  fallback: ljg-writes

opinion:
  primary: khazix-writer
  aux:
    - ljg-learn
    - geo-article-transformer
    - fact-grounding-skill
  fallback: khazix-writer

product_promo:
  primary: kai-write
  aux:
    - evidence-pack-skill
    - geo-article-generator
    - brand-policy-reader       # ⭐ 读Agent2输出
  fallback: khazix-writer

# 平台特定规则
platform_rules:
  zhihu:
    require_seo: true
    require_geo: true
    min_length: 3000
    include_faq: true
  wechat_gzh:
    require_seo: false
    require_geo: true
    min_length: 2000
    cta_required: true
  csdn:
    require_seo: true
    require_geo: false
    min_length: 1500
    code_blocks: true
```

---

#### 2.2 改造 `skill-selector.js`（三元路由）

```javascript
// skills/skill-selector.js 新增

/**
 * 三元路由：content_type × platform × insertion_type
 * @param {Object} params
 * @returns {Object} { primary, aux, seo, geo }
 */
function selectSkills({ content_type, platform, topic_brief, insertion_type }) {
  // 第一维：content_type → 基础模式
  const baseMode = CONTENT_TYPE_MAP[content_type] || 'deep_long_form';

  // 第二维：platform → 调整权重和aux
  const platformRules = PLATFORM_REQUIREMENTS[platform] || {};

  // 第三维：insertion_type（软/硬）→ 决定 aux 组合
  const insertionRules = INSERTION_STRATEGY[insertion_type] || {};

  // 综合决策
  const primary = selectPrimary(baseMode);
  const aux = selectAux(baseMode, platformRules, insertionRules);

  return {
    primary,
    aux,
    seo: platformRules.require_seo ? 'seo-structure-skill' : null,
    geo: platformRules.require_geo ? 'geo-article-generator' : null,
  };
}

// 平台要求映射
const PLATFORM_REQUIREMENTS = {
  zhihu: { require_seo: true, require_geo: true, min_length: 3000 },
  wechat_gzh: { require_seo: false, require_geo: true, min_length: 2000 },
  csdn: { require_seo: true, require_geo: false, min_length: 1500 },
  xiaohongshu: { require_seo: false, require_geo: false, min_length: 800 },
  video: { require_seo: false, require_geo: false, min_length: 500 },
};

// 软硬植入策略
const INSERTION_STRATEGY = {
  hard: {
    aux: ['evidence-pack-skill', 'brand-policy-reader'],
    seo_multiplier: 1.2,
    geo_multiplier: 1.0,
  },
  soft: {
    aux: ['geo-article-transformer', 'hv-analysis'],
    seo_multiplier: 1.0,
    geo_multiplier: 1.3,
  },
  minimal: {
    aux: ['ljg-learn'],
    seo_multiplier: 0.8,
    geo_multiplier: 0.8,
  },
};
```

---

### 📦 阶段 3：集成 GitHub 高星项目（Week 4）

#### 3.1 `source-discovery-skill`（接 RAGFlow）⭐ P1

**集成方式：**
```javascript
// skills/source-discovery-skill.js
// 调用 RAGFlow API 进行网络搜索和来源发现

async function discoverSources(topic, keywords) {
  // 调用 RAGFlow search API
  // 返回：[{ title, url, snippet, authority_score, relevance }]
  const results = await callRAGFlowAPI({
    query: topic,
    keywords: keywords,
    limit: 10,
  });
  return results.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    authority: scoreAuthority(r.source), // 学术>报告>权威>专家>案例
    relevance: r.score,
  }));
}
```

**RAGFlow 优势：**
- Deep document understanding（理解比普通 vector search 深）
- 适合做 GEO 的原始来源发现
- Apache-2.0，商用安全

---

#### 3.2 `fact-grounding-skill`（接 llama_index）⭐ P1

**集成方式：**
```javascript
// skills/fact-grounding-skill.js
// 用 llama_index 构建公司知识库索引并做事实核验

const { VectorStoreIndex } = require('llama-index');

async function groundFacts(claims, knowledgeBasePath) {
  // 加载知识库索引
  const index = await VectorStoreIndex.fromPersistable(knowledgeBasePath);

  const results = [];
  for (const claim of claims) {
    const queryEngine = index.asQueryEngine();
    const response = await queryEngine.query(
      `核实以下说法，给出支撑或反驳：${claim}`
    );
    results.push({
      claim,
      verdict: response.verdict,     // supported / refuted / uncertain
      evidence: response.evidence,
      confidence: response.confidence,
    });
  }
  return results;
}
```

---

#### 3.3 `multi-source-research-skill`（接 DATAGEN）⭐ P1

**集成方式：**
```javascript
// skills/multi-source-research-skill.js
// DATAGEN 负责：假设生成 → 数据采集 → 分析 → 报告

async function multiSourceResearch(topicBrief) {
  // DATAGEN 的多智能体研究流程
  // 适合 case_study 和 comparison 类型文章的前置调研
  const report = await DATAGEN.run({
    task: 'research',
    topic: topicBrief.topic_title,
    angles: topicBrief.directions.map(d => d.angle),
    depth: 'deep',
  });
  return report; // { hypotheses, data_points, analysis, conclusions }
}
```

---

### 📦 阶段 4：输入上下文补全（Week 5）

#### 4.1 `brand-policy-reader`（自研）⭐ P1

**功能：** 读取 Agent 2 的 Brand Policy，注入文章生成约束

**PRD 定义的 Agent 2 输出：**
- Promotion Passport
- Brand Policy（品牌声音规范）
- Claim List（能力声明）
- Evidence Graph（证据关系）

**接口（模拟，等待 Agent 2 开发）：**
```javascript
// skills/brand-policy-reader.js

const AGENT2_OUTPUT_PATHS = [
  './agent2/output/brand-policy.json',
  './agent2/output/promotion-passport.json',
  './agent2/output/claim-list.json',
];

function loadBrandPolicy() {
  for (const p of AGENT2_OUTPUT_PATHS) {
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      console.log(`[brand-policy-reader] loaded from ${p}`);
      return data;
    }
  }
  // Fallback：返回空对象，不阻塞流程
  return {
    brand_voice: {},
    claims: [],
    evidence_graph: { nodes: [], edges: [] },
    _source: 'fallback',
  };
}
```

---

#### 4.2 `strategy-reader`（自研）⭐ P1

**功能：** 读取 Agent 4 的 Strategy Card，注入策略约束

**PRD 定义的 Agent 4 输出：**
- Strategy Card
- Value Proposition
- Channel Mix

```javascript
// skills/strategy-reader.js

const AGENT4_OUTPUT_PATH = './agent4/output/strategy-card.json';

function loadStrategyCard() {
  if (fs.existsSync(AGENT4_OUTPUT_PATH)) {
    return JSON.parse(fs.readFileSync(AGENT4_OUTPUT_PATH, 'utf8'));
  }
  return { _source: 'fallback', channels: [], value_proposition: '' };
}
```

---

#### 4.3 `icp-reader`（自研）⭐ P2

**功能：** 读取 Agent 3 的 ICP，注入受众约束

（目前 Agent 3 不存在，reader 先做 fallback）

```javascript
// skills/icp-reader.js

const AGENT3_OUTPUT_PATHS = [
  './agent3/output/icp.json',
  './agent3/output/persona.json',
];

function loadICP() {
  for (const p of AGENT3_OUTPUT_PATHS) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  return { _source: 'fallback', personas: [], icp: {} };
}
```

---

### 📦 阶段 5：质量保障体系（Week 6）

#### 5.1 `geo-metrics-skill`（基于 yao-open-prompts 改写）⭐ P2

**来源：** `yao-open-prompts/geo-metrics-monitoring-analysis.md`

**功能：** 对产出的文章打 GEO 分（12维度评估）

**输出：**
```javascript
{
  overall_score: 0-100,
  dimensions: {
    authority_quotes: { score: 0-16, status: 'good/warning/critical' },
    statistics: { score: 0-14, status: '...' },
    citability: { score: 0-13, status: '...' },
    structure: { score: 0-12, status: '...' },
    fluency: { score: 0-10, status: '...' },
    semantic_density: { score: 0-8, status: '...' },
    authority_signals: { score: 0-8, status: '...' },
    terminology: { score: 0-6, status: '...' },
    robustness: { score: 0-5, status: '...' },
    cross_domain: { score: 0-4, status: '...' },
  },
  recommendations: [
    { dimension: 'authority_quotes', suggestion: '补充X处专家原话引用' },
    { dimension: 'statistics', suggestion: '完善X处数据的样本量和周期' },
  ]
}
```

---

#### 5.2 `content-lineage-tracker`（自研）⭐ P2

**PRD 要求：** 记录文章用了哪些来源，用于 Agent 9 归因

**输出：**
```javascript
{
  article_id: string,
  sources: [{
    type: 'knowledge_base' | 'web_search' | 'llm_generated',
    url: string | null,
    content_id: string,
    used_at: string,
    paragraph_index: number,
  }],
  capabilities_used: ['KB-001', 'KB-002'],  // capability-index-builder 的 card IDs
  insertion_type: 'soft' | 'hard',
  platform: string,
  created_at: string,
}
```

---

## 六、完整 Skill 地图

```
Agent6 Skill Registry
├── 🔴 P0 必须（PRD 强制）
│   ├── seo-structure-skill          [自研]       SEO结构化输出
│   ├── geo-article-generator        [yao改写]    GEO文章生成
│   ├── geo-article-transformer     [yao改写]    GEO文章改造
│   ├── evidence-pack-skill         [自研]       事实/观点分离
│   └── brand-policy-reader         [自研]       读Agent2输出
│
├── 🟡 P1 重要（PRD 要求）
│   ├── fact-grounding-skill        [llama_index] 事实核验
│   ├── source-discovery-skill      [RAGFlow]    原始来源发现
│   ├── multi-source-research-skill [DATAGEN]    多智能体调研
│   ├── seo-keyword-research        [自研]       关键词研究
│   ├── schema-org-generator        [yao改写]    结构化数据
│   └── strategy-reader             [自研]       读Agent4输出
│
├── 🟢 P2 增强（体验优化）
│   ├── geo-metrics-skill           [yao改写]    GEO评分
│   ├── content-lineage-tracker     [自研]       内容血缘追踪
│   └── icp-reader                 [自研]       读Agent3输出
│
└── 🔧 已有 Skills（复用/改造）
    ├── capability-index-builder     ✅ 13个已有
    ├── topic-capability-matcher    ✅
    ├── insertion-strategy-decider  ✅
    ├── knowledge-sync              ✅
    ├── skill-selector             ⚠️ 需改造（扩展路由）
    └── writing-stub               ⚠️ 需提升（质量）
```

---

## 七、技术实施甘特图

```
Week 1-2：阶段1（P0强制）
  ├─ seo-structure-skill（自研）
  ├─ geo-article-generator（姚金刚改写）
  ├─ geo-article-transformer（姚金刚改写）
  └─ evidence-pack-skill（自研）

Week 3：阶段2（Skill路由扩展）
  ├─ skill_routes.yml（扩展到6+种模式）
  └─ skill-selector.js（三元路由改造）

Week 4：阶段3（GitHub集成）
  ├─ source-discovery-skill（RAGFlow）
  ├─ fact-grounding-skill（llama_index）
  └─ multi-source-research-skill（DATAGEN）

Week 5：阶段4（输入上下文补全）
  ├─ brand-policy-reader（自研）
  ├─ strategy-reader（自研）
  └─ icp-reader（自研，fallback）

Week 6：阶段5（质量保障）
  ├─ geo-metrics-skill（姚金刚改写）
  └─ content-lineage-tracker（自研）
```

---

## 八、数据流闭环（优化后）

```
Agent5 → Topic Brief + direction_id
Agent4 → Strategy Card + channel_mix     （待接 → strategy-reader）
Agent2 → Brand Policy + Evidence Graph  （待接 → brand-policy-reader）
        ↓
   Agent6 核心引擎
        ↓
   ┌──────────────────────────────────────┐
   │ capability-index-builder              │
   │ (扫描 knowledge/ 动态生成能力卡片)       │
   └──────────────────────────────────────┘
        ↓
   ┌──────────────────────────────────────┐
   │ topic-capability-matcher              │
   │ (选题 ↔ 能力匹配 + 软/硬判断)           │
   └──────────────────────────────────────┘
        ↓
   ┌──────────────────────────────────────┐
   │ Skill 路由（三元路由）                  │
   │ content_type × platform × insertion   │
   │  → 主笔 + aux + seo + geo             │
   └──────────────────────────────────────┘
        ↓
   ┌──────────────────────────────────────┐
   │ 写作 Skills（扩展后）                   │
   │ 主笔：khazix-writer 等               │
   │ 辅笔：hv-analysis, ljg-learn 等       │
   │ SEO：seo-structure-skill              │
   │ GEO：geo-article-generator             │
   │ 证据：evidence-pack-skill             │
   └──────────────────────────────────────┘
        ↓
   ┌──────────────────────────────────────┐
   │ 产出                                   │
   │ Article + Evidence Pack + Lineage      │
   │ SEO Metadata + GEO Score               │
   └──────────────────────────────────────┘
        ↓
   Agent8 → Publication  （待开发）
        ↓
   Agent9 → Attribution → Decision → Agent5 回流
```

---

## 九、关键设计原则

**原则1：动态知识库**
- `capability-index-builder` 扫描 `knowledge/` → 动态生成 capability cards
- Agent 6 换公司时，只需替换 `knowledge/` 内容，能力自动适配
- 不写死任何公司特定信息

**原则2：Skill 可替换**
- 每个 Skill 都是独立模块，有标准输入/输出 Schema
- RAGFlow / llama_index 可替换为其他 RAG 引擎
- yao-open-prompts 的 prompt 可替换为其他 GEO 方案

**原则3：数据流闭环**
- Agent 6 输出 → Agent 8 发布 → Agent 9 归因 → Decision 回流
- Agent 9 的归因结果通过 `feedback-loop.js` 调整 capability cards 的 confidence

---

## 十、实施结果（2026-07-04 完成）

### 已完成 ✅

| 阶段 | 内容 | Commit | Skill数量 |
|------|------|--------|---------|
| 阶段1 P0 | seo-structure / geo-article-transformer / evidence-pack / geo-article-generator | `867be51` | 4个 |
| 阶段2 | skill-selector v2 三元路由 + skill_routes.yml | `a2516f7` | 1个 |
| 阶段3 P1 | source-discovery / fact-grounding / multi-source-research | `30117da` | 3个 |
| 阶段4 | brand-policy-reader / strategy-reader / icp-reader | `0298739` | 3个 |
| 阶段5 P2 | geo-metrics-skill / content-lineage-tracker | `0298739` | 2个 |

**合计新增 13个 Skill 文件，全部无第三方依赖，可独立运行。**

### GitHub 集成状态

| Skill | 来源 | Mock→真实切换方式 |
|-------|------|------------------|
| source-discovery-skill | RAGFlow（Apache-2.0）| `MOCK_IMPLEMENTATION = false` |
| fact-grounding-skill | llama_index（MIT）| 同上 |
| multi-source-research-skill | DATAGEN（MIT）| 同上 |

### Skill 总览（Agent6 全部 Skills）

```
Skills/
├── P0 自研（阶段1）
│   ├── seo-structure-skill.js          ✅
│   ├── geo-article-transformer.js     ✅
│   ├── evidence-pack-skill.js          ✅
│   └── geo-article-generator.js        ✅
├── P1 GitHub集成（阶段3）
│   ├── source-discovery-skill.js      ✅ Mock
│   ├── fact-grounding-skill.js         ✅ Mock
│   └── multi-source-research-skill.js  ✅ Mock
├── P1 上下文读取（阶段4）
│   ├── brand-policy-reader.js          ✅ fallback
│   ├── strategy-reader.js             ✅ fallback
│   └── icp-reader.js                 ✅ fallback
├── P2 质量保障（阶段5）
│   ├── geo-metrics-skill.js          ✅
│   └── content-lineage-tracker.js     ✅
├── 核心基础（已有）
│   ├── capability-index-builder.js    ✅
│   ├── topic-capability-matcher.js    ✅
│   ├── insertion-strategy-decider.js  ✅
│   ├── knowledge-sync.js              ✅
│   ├── knowledge-update-handler.js    ✅
│   ├── skill-selector.js              ✅ v2
│   ├── kai-gate.js                   ✅
│   ├── validate-skill.js             ✅
│   ├── feedback-loop.js              ✅
│   ├── campaign-consumer.js           ✅
│   └── diff-detector.js              ✅
└── 待补（PRD要求）
    ├── schema-org-generator.js         ⬜
    └── seo-keyword-research.js        ⬜
```

### 三元路由验证（skill-selector v2）

```
analysis × zhihu × soft → technical | ljg-writes | aux:[ljg-learn,seo,transform,hv] | SEO✅ GEO✅
analysis × zhihu × hard → technical | ljg-writes | aux:[...+evidence,brand]     | SEO✅ GEO✅
case_study × xhs × soft → quick_social | huashu | aux:[geo-transform,ljg-card,seo] | SEO❌ GEO❌
opinion × wechat_gzh × hard → deep_long_form | khazix | aux:[...+evidence,brand] | SEO❌ GEO✅
```

**启动命令：**
```bash
node skills/seo-structure-skill.js \
  --content "文章正文..." \
  --keywords "AI,智能写作,GEO优化" \
  --platform "zhihu"
```
