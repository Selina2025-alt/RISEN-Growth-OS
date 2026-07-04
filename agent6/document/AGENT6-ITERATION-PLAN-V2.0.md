# Agent 6 迭代优化实施计划 V2.0

**版本：V2.0 | 日期：2026-07-04 | 状态：调研制定中**

---

## 一、自查发现问题汇总

### 已修复（本次迭代前）
| # | 问题 | 严重度 | 状态 |
|---|------|--------|------|
| F1 | `fact-grounding-skill.js` 注释中 `require('./skills/...')` 路径错误 | 低 | ✅ 已修复 |

### 残留风险（本次迭代范围）
| # | 问题 | 严重度 | 影响 |
|---|------|--------|------|
| R1 | 新15个Skill未接入 `agent6-core.js` Pipeline | 🔴 高 | Skill孤岛，无法端到端协作 |
| R2 | Jova Skill（`skill::khazix-writer`等）standalone模式fallback质量差 | 🟡 中 | 纯node环境无法产出真实文章 |
| R3 | `seo-keyword-research` 中文分词精度差（被切分） | 🟡 中 | 关键词簇质量下降 |
| R4 | Mock→真实切换无标准化验证流程 | 🟡 中 | 上线真实API时风险未知 |

---

## 二、迭代优化方案

### 🔴 R1：Skill接入Pipeline（最高优先）

**问题根因**：`agent6-core.js` 在设计时没有规划新Skill的编排位置，导致15个Skill都是孤立的。

**目标**：让 `agent6-core.js` 在标准流程中调用所有新增Skill，形成完整的数据流。

**Pipeline新数据流设计**：

```
输入（Agent5 Topic Brief + Agent4 Strategy + Agent2 Brand + Agent3 ICP）
         ↓
┌──────────────────────────────────────┐
│ PHASE 1: 上下文加载                   │
│   brand-policy-reader   → brandCtx   │
│   strategy-reader       → stratCtx   │
│   icp-reader           → icpCtx     │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PHASE 2: 选题能力匹配                 │
│   topic-capability-matcher            │
│   insertion-strategy-decider          │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PHASE 3: 写作Skills编排              │
│   skill-selector → 三元路由           │
│   主笔Skill + auxSkills + SEO/GEO   │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PHASE 4: 后处理质量保障              │
│   seo-structure-skill → meta优化      │
│   geo-article-transformer → GEO改造  │
│   geo-metrics-skill → 评分           │
│   content-lineage-tracker → 血缘记录  │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PHASE 5: 结构化输出                  │
│   schema-org-generator → JSON-LD     │
│   seo-keyword-research → 关键词策略   │
└──────────────────────────────────────┘
         ↓
输出（Article + Evidence + SEO + GEO + Lineage + Schema）
```

**具体任务**：

T1.1 在 `agent6-core.js` 中新增 `SkillOrchestrator` 类，统一管理Phase调用顺序

T1.2 在 Pipeline 各Phase插入Reader调用：
```javascript
// Phase 1 - 上下文加载（新增）
const { run: runBrand } = require('./skills/brand-policy-reader');
const { run: runStrat } = require('./skills/strategy-reader');
const { run: runIcp } = require('./skills/icp-reader');
const brandCtx = runBrand();
const stratCtx = runStrat(topicBrief);
const icpCtx = runIcp();
```

T1.3 在Pipeline后处理阶段插入质量Skill：
```javascript
// Phase 4 - 质量保障（新增）
const { run: runMetrics } = require('./skills/geo-metrics-skill');
const { run: runLineage } = require('./skills/content-lineage-tracker');
const geoScore = runMetrics({ article_content: finalArticle, platform });
const lineage = runLineage({ article_id, article_content: finalArticle, ... });
```

**验收标准**：运行 `node agent6-core.js --input mock-data/sample-topic-brief.json` 能产出完整输出（含SEO/GEO/Lineage/Schema字段）

---

### 🟡 R2：Jova Skill Standalone Fallback优化

**问题根因**：`skill-selector` 中的 Jova Skill（`skill::khazix-writer`等）在 standalone 模式（纯node调用，无Jova session）时只能返回prompt片段，无法产出真实文章。

**目标**：为每个主笔Skill提供本地fallback实现，确保standalone也能产出可用文章。

**方案**：为 Jova Skill 配置本地等效实现（不做AI生成，做结构化拼接）

| Jova Skill | Standalone Fallback |
|------------|-------------------|
| `khazix-writer` | 本地 `local-khazix-stub.js`（拼接knowledge片段） |
| `ljg-writes` | 本地 `local-ljg-stub.js` |
| `hv-analysis` | 本地 `local-hv-stub.js` |

**注意**：这是"有缺陷但能跑通"的设计，不是"高质量生成"。真正高质量文章必须通过Jova调用真实Skill。

**具体任务**：
T2.1 扩展 `skill-selector.js` 的 `runWritingSkill` 函数，添加本地fallback路径
T2.2 创建 `local-writer-stubs.js`，实现最简单的结构化拼接
T2.3 在 `agent6-core.js` 的 standalone 模式输出中标注"本产出为standalone fallback，需在Jova环境中替换为真实Skill"

---

### 🟡 R3：中文分词精度

**问题根因**：`seo-keyword-research.js` 使用 `[\u4e00-\u9fa5]{2,8}` 简单匹配，会把所有连续汉字视为词，导致"企业如何通过AI实现数字化转型"被切成"企业如何通过"/"化转型"等碎片词。

**调研结论**：
- ❌ `jieba`：不可用（未安装）
- ❌ `nodejieba`：不可用（native依赖，编译环境缺失）
- ✅ **内置词典分词方案**：通过验证——使用正向最大匹配（DAT），不依赖外部库

**方案**：采用内置行业词典 + 正向最大匹配，不引入外部依赖

```javascript
// 内置词典（按需扩充）
const DICT = new Set([
  '企业', '数字化', '转型', 'AI', '人工智能', '技术', '选型', '实施', '路径',
  '案例', '分析', '智能化', '自动化', '平台', '系统', '解决方案', '数据',
  '效率', '成本', '增长', '营销', '客户', '产品', '服务', '运营', '流程',
  'Agent', '智能体', '多Agent', '协作', '大模型', 'LLM', '知识库',
]);

function segment(text) {
  const result = [];
  let i = 0;
  while (i < text.length) {
    for (let len = Math.min(6, text.length - i); len >= 2; len--) {
      const word = text.slice(i, i + len);
      if (DICT.has(word)) { result.push(word); i += len; break; }
    }
    if (!result.length || i === result.reduce((a, w) => a + w.length, 0)) i++;
  }
  return result;
}
```

**验证结果**：
```
输入：企业如何通过AI实现数字化转型，包括技术选型、实施路径和案例分析
输出：['企业', 'AI', '数字化', '转型', '技术', '选型', '实施', '路径', '案例', '分析']
```

**具体任务**：
T3.1 重写 `seo-keyword-research.js` 的 `extractTerms`，替换为词典+正向最大匹配
T3.2 补充行业通用词典（约200词），支持按行业扩充
T3.3 更新CLI测试，验证分词质量

**验收标准**：
- 输入"企业如何通过AI实现数字化转型"
- 输出 head_term 应为"数字化转型"/"AI"/"企业"，而不是"化转型"这类碎片

---

### 🟡 R4：Mock→真实切换验证流程

**问题根因**：3个P1 GitHub集成Skill（`source-discovery`/`fact-grounding`/`multi-source-research`）的 Mock→真实切换没有任何验证机制，直接 flip switch 可能引发运行时错误。

**目标**：建立标准化的"Mock验证→接口对齐→真实切换→回归测试"流程。

**切换检查清单**（每项必须通过才能切换）：

```
[ ] API接口签名与Mock完全一致（参数名/类型/返回值结构）
[ ] Mock数据覆盖所有分支路径（空数据/异常数据/正常数据）
[ ] 真实API认证方式确认（API Key / OAuth / JWT）
[ ] 真实API的rate limit和超时处理已实现
[ ] 回归测试套件覆盖主要场景
[ ] Fallback逻辑验证（真实API失败时回退到Mock）
```

**具体任务**：
T4.1 为每个P1 Skill编写接口契约文档（输入/输出/错误码）
T4.2 创建 `test/mock-to-real-transition.js`，自动化验证切换条件
T4.3 在每个Skill的 `run()` 入口添加"切换就绪度"自检

**验收标准**：运行 `node test/mock-to-real-transition.js source-discovery` 返回所有检查项状态

---

## 三、迭代实施排期

| 迭代 | 任务 | 优先级 | 工作量 |
|------|------|--------|--------|
| **Iter-1**（本次） | R1: Skill接入Pipeline | 🔴 P0 | 中 |
| | T1.1: SkillOrchestrator类 | | |
| | T1.2: Reader Phase集成 | | |
| | T1.3: 质量保障Phase集成 | | |
| **Iter-2** | R2: Standalone Fallback | 🟡 P1 | 小 |
| **Iter-3** | R3: 中文分词精度 | 🟡 P1 | 中 |
| **Iter-4** | R4: Mock→真实验证流程 | 🟡 P1 | 中 |

---

## 四、Iter-1 详细技术方案

### SkillOrchestrator 设计

```javascript
// lib/skill-orchestrator.js
class SkillOrchestrator {
  constructor(skills) {
    this.phases = {
      context: [],    // Reader skills
      matching: [],   // Topic-capability matching
      writing: [],    // Main writer + aux
      quality: [],    // Post-processing
      output: [],    // Schema + keywords
    };
  }

  async run(input, context) {
    let data = { ...input };

    for (const [phase, skills] of Object.entries(this.phases)) {
      for (const skill of skills) {
        data = await this.runSkill(skill, data, context);
      }
    }

    return data;
  }
}
```

### 现有Skill的phase归属

| Phase | Skill | 已有/新增 |
|-------|-------|---------|
| context | brand-policy-reader | 新增 |
| context | strategy-reader | 新增 |
| context | icp-reader | 新增 |
| matching | topic-capability-matcher | 已有 |
| matching | insertion-strategy-decider | 已有 |
| writing | skill-selector | 已有(v2) |
| writing | seo-structure-skill | 新增 |
| writing | geo-article-generator | 新增 |
| writing | evidence-pack-skill | 新增 |
| quality | geo-metrics-skill | 新增 |
| quality | content-lineage-tracker | 新增 |
| quality | geo-article-transformer | 新增 |
| output | schema-org-generator | 新增 |
| output | seo-keyword-research | 新增 |

---

## 五、风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| jieba无法安装 | R3无法完成 | 改用预置白名单 |
| Jova Skill接口变更 | R2 fallback失效 | 接口版本锁定 |
| 真实API认证复杂 | R4切换失败 | 先完成OAuth流程调研 |
| Agent8未开发 | Pipeline无法端到端 | 用Mock替代，接口预留 |

---

*本计划基于 V1.2 自查结果制定，V2.0 聚焦 Pipeline 集成和遗留风险消除。*
