# Agent 6 · 内容创作智能体
## 技术规格文档 V2.0

> **V2.0 更新 (2026-07-06)：**
> - 基于完整测试验证，更新 Pipeline 结构（6 Phase）
> - 补充 15 个新 Skill 及 SkillOrchestrator
> - 补充 GEO/SEO/血缘/Schema 输出规格
> - 补充与 Agent4/5/9 的数据接口

---

## 一、系统定位

### 1.1 在 RISEN OS 中的角色

```
Agent5 ──→ Topic Brief + Resources
     ↓
Agent6 ──→ 实际文章（含 SEO + GEO + 血缘）
     ↓
Agent8 ──→ 发布到各平台（待开发）
     ↓
Agent9 ──→ 归因数据
```

**核心职责：** Agent6 是"内容引擎"，将 Agent5 提供的选题 Brief 转化为符合 SEO/GEO 标准的完整文章，并记录血缘供 Agent9 归因。

---

## 二、输入与输出

### 2.1 输入

| 输入 | 来源 | 必需 | 说明 |
|------|------|------|------|
| Topic Brief | Agent5 | ✅ | `trend-briefs/BRIEF-*.json` |
| Brand Policy | Agent2（模拟）| ✅ | `skills/brand-policy-reader.js` |
| Strategy | Agent4（模拟）| ✅ | `skills/strategy-reader.js` |
| ICP | Agent3（模拟）| ✅ | `skills/icp-reader.js` |
| Knowledge Base | 用户上传 | 🔶 | `knowledge/` 目录 |

### 2.2 输出

| 输出 | 字段 | 接收方 |
|------|------|--------|
| 文章内容 | `content` | Agent8 → 平台 |
| SEO 元数据 | `seo_metadata` | 各平台 |
| GEO 评分 | `geo_score`, `geo_dimensions` | 内部优化 |
| 血缘记录 | `content_lineage` | Agent9 |
| Schema.org | `schema_org` | SEO 插件 |
| 关键词策略 | `seo_keywords` | Agent8 |

---

## 三、Pipeline 结构（6 Phase）

### 3.1 Phase 概览

```
Phase 1: 上下文加载
  brand-policy-reader   → 品牌上下文
  strategy-reader       → 策略上下文
  icp-reader          → 受众上下文

Phase 2: 网络调研
  source-discovery-skill → 来源发现
  multi-source-research  → 多源研究

Phase 3: 选题匹配
  topic-capability-matcher   → 选题-能力匹配
  insertion-strategy-decider  → 植入策略决策

Phase 4: 写作编排
  skill-selector → 三元路由（content_type × platform × insertion_type）
  evidence-pack  → 证据包构建

Phase 5: 后处理
  geo-article-generator   → GEO增强生成
  seo-structure-skill    → SEO结构优化
  geo-article-transformer → GEO文章改造

Phase 6: 质量保障 + 输出
  geo-metrics-skill       → GEO评分
  content-lineage-tracker  → 血缘追踪
  schema-org-generator     → Schema.org
  seo-keyword-research    → 关键词策略
```

### 3.2 SkillOrchestrator

```javascript
// lib/skill-orchestrator.js
class SkillOrchestrator {
  constructor({ skipPhases = [], skipSkills = [] } = {})
  async run(ctx)  // ctx 是 Pipeline 全局上下文
  _buildSkillInput(skillId, ctx)  // 为每个 Skill 构建输入
}
```

### 3.3 三元路由规则

```javascript
// content_type × platform × insertion_type → [primary, aux...]
MODES = {
  analysis: {
    zhihu: { primary: 'khazix-writer', aux: ['ljg-writes', 'hv-analysis'], seo: true, geo: true }
    wechat_gzh: { primary: 'khazix-writer', aux: ['ljg-writes'], seo: false, geo: true }
  }
  // ...
}
```

---

## 四、Skills 清单（27个）

### 4.1 自研 Skills（P0，阶段1）

| Skill | 文件 | 职责 |
|-------|------|------|
| SEO Structure | `skills/seo-structure-skill.js` | meta title/description, H2/H3, FAQ, Schema FAQ |
| GEO Transformer | `skills/geo-article-transformer.js` | 12维度GEO诊断 + 权重驱动改造 |
| Evidence Pack | `skills/evidence-pack-skill.js` | Fact提取, Viewpoint识别, Evidence Graph |
| GEO Generator | `skills/geo-article-generator.js` | GEO原生生成, 软硬植入决策 |

### 4.2 路由 Skills（阶段2）

| Skill | 文件 | 职责 |
|-------|------|------|
| Skill Selector | `skills/skill-selector.js` | 三元路由 + fallback编排 |

### 4.3 GitHub集成 Skills（阶段3，P1）

| Skill | 文件 | 状态 |
|-------|------|------|
| Source Discovery | `skills/source-discovery-skill.js` | Mock（接RAGFlow）|
| Fact Grounding | `skills/fact-grounding-skill.js` | Mock（接llama_index）|
| Multi-Source Research | `skills/multi-source-research-skill.js` | Mock（接DATAGEN）|

### 4.4 Reader Skills（阶段4，P1）

| Skill | 文件 | 职责 |
|-------|------|------|
| Brand Policy Reader | `skills/brand-policy-reader.js` | 读Agent2输出 |
| Strategy Reader | `skills/strategy-reader.js` | 读Agent4输出 |
| ICP Reader | `skills/icp-reader.js` | 读Agent3输出 |

### 4.5 质量 Skills（阶段5，P2）

| Skill | 文件 | 职责 |
|-------|------|------|
| GEO Metrics | `skills/geo-metrics-skill.js` | 12维度评分 |
| Content Lineage Tracker | `skills/content-lineage-tracker.js` | 血缘记录 |

### 4.6 收尾 Skills

| Skill | 文件 | 职责 |
|-------|------|------|
| Schema.org Generator | `skills/schema-org-generator.js` | JSON-LD生成 |
| SEO Keyword Research | `skills/seo-keyword-research.js` | 关键词簇生成 |

---

## 五、输出规格

### 5.1 Article JSON 结构

```json
{
  "article_id": "MA-mr8js96m-2f4ba5",
  "topic_id": "TOPIC-001",
  "direction_id": "D1",
  "content": "# 文章标题\n\n正文...",
  "insertion_strategy": {
    "strategy": "minimal",
    "primary_keywords": ["企业", "AI", "落地"],
    "secondary_keywords": ["转型", "数字化"]
  },
  "match_report": { "top_matches": [...] },
  "seo_metadata": {
    "meta_title": "全面解读claude，从入门到精通",
    "meta_description": "...",
    "h2_headings": ["一、...", "二、..."],
    "faq": [{ "q": "...", "a": "..." }]
  },
  "geo_score": 59,
  "geo_dimensions": {
    "authority_quotes": { "score": 8, "max": 16 },
    "statistics": { "score": 6, "max": 14 },
    "..."
  },
  "content_lineage": {
    "lineage_id": "LINEAGE-mr8jpila-w59mf",
    "fingerprint": "LIN-5CCBA6C37CCA",
    "paragraphs": [...],
    "sources": [...]
  },
  "schema_org": {
    "name_optimized": "分享8个Claude...",
    "description_optimized": "...",
    "schemas": { "article": "{...}", "faq": "{...}" }
  },
  "seo_keywords": {
    "clusters": [...],
    "primary_keywords": ["分享", "AI", "企业"],
    "long_tail_keywords": [...]
  },
  "quality_check": {
    "pass": true,
    "reasons": ["字数>500", "包含数据引用"]
  },
  "pipeline_phases": {
    "context": { "started_at": "...", "skills": {...} },
    "research": { "...": "..." }
  }
}
```

### 5.2 GEO 12维度评分体系（yao-open-prompts）

```
证据引用层（43%权重）：
  authority_quotes: 16%  — 权威原文引语
  statistics:       14%  — 统计数据完整度
  citability:       13%  — 可引用性/可信来源

结构理解层（12%权重）：
  structure:        12%  — 结构规范性

其他（45%权重）：
  fluency:          10%  — 表达流畅度
  semantic_density:  8%  — 语义密度
  authority_signals:  8%  — 权威信号
  terminology:        6%  — 专业术语
  robustness:         5%  — 鲁棒性
  cross_domain:       4%  — 跨域连接
```

---

## 六、测试验证

### 6.1 验证命令

```bash
# 完整Pipeline
node agent6-core.js --input mock-data/sample-topic-brief.json

# 仅测试Orchestrator（跳过后处理）
node agent6-core.js --input ... --skip-phase post-write
```

### 6.2 验证清单

- [x] Phase1 上下文加载（3个Reader）
- [x] Phase2 网络调研（source-discovery + multi-source）
- [x] Phase3 选题匹配
- [x] Phase4 写作编排
- [x] Phase5 后处理（geo-generator + seo-structure + geo-transformer）
- [x] Phase6 质量保障（geo-metrics + lineage + schema + keywords）
- [x] 质量门通过
- [x] GEO评分输出（59/100）
- [x] 血缘记录生成
- [x] Schema.org输出

### 6.3 实际输出

```
Pipeline 完成:
  ✅ Phase1-6 全部通过
  质量门: ✅ 通过（547字）
  GEO评分: 59/100
  SEO元数据: ✅ 有
  血缘记录: ✅ 有
  Schema: ✅ 有
```

---

## 七、技术约束

- Node.js >= 18
- 无外部 npm 依赖（纯内置模块）
- 执行时间：< 60s（standalone模式）
- Token限制：文章长度 500-3000字

---

## 八、迭代历史

| 版本 | 内容 |
|------|------|
| V1.0 | 初始版本，13个Skill |
| V1.1 | 增加3个P1 GitHub集成Stub |
| V1.2 | 完成5阶段15个Skill |
| V2.0 | SkillOrchestrator + 6 Phase Pipeline + Iter-1/2/3 |

---

*本文档版本：V2.0 | 更新日期：2026-07-06*
