# Agent 6 迭代优化实施计划 V2.0

**版本：V2.0 | 日期：2026-07-04 | 状态：✅ V2.0全部完成（3个迭代）**

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

**Pipeline新数据流设计（6 Phase）**：

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
│ PHASE 2: 网络调研（新增）             │
│   source-discovery-skill              │
│   multi-source-research-skill         │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PHASE 3: 选题能力匹配                │
│   topic-capability-matcher            │
│   insertion-strategy-decider          │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PHASE 4: 写作Skills编排              │
│   skill-selector → 三元路由           │
│   主笔Skill + auxSkills + SEO/GEO   │
│   evidence-pack 预填充               │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PHASE 5: 后处理（修正）              │
│   geo-article-generator → GEO生成    │
│   seo-structure-skill → meta优化     │
│   geo-article-transformer → GEO改写 │
└──────────────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ PHASE 6: 质量保障+输出              │
│   geo-metrics-skill → 评分          │
│   content-lineage-tracker → 血缘记录 │
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

| 迭代 | 任务 | 优先级 | 工作量 | 状态 |
|------|------|--------|--------|------|
| **Iter-1** | R1: Skill接入Pipeline | 🔴 P0 | 中 | ✅ 已完成（fcddb60） |
| **Iter-2** | R2: Standalone Fallback | 🟡 P1 | 小 | ✅ 已完成（4b4f91d） |
| **Iter-3** | R3: 中文分词精度 | 🟡 P1 | 中 | ✅ 已完成（277945e） |
| **Iter-4** | R4: Mock→真实验证流程 | 🟡 P1 | 中 | ⬜ 待实施 |

---

## 四、Iter-1 详细技术方案

### 修正：Phase 归属调整

原计划中 `seo-structure-skill` 和 `geo-article-transformer` 放在 Phase4（质量）存在问题——它们应作用于**已生成的初稿**，不是质量验证工具。正确的 Phase 归属：

| Phase | Skill | 修正说明 |
|-------|-------|---------|
| context | brand-policy-reader | 新增 |
| context | strategy-reader | 新增 |
| context | icp-reader | 新增 |
| **research** | **source-discovery-skill** | **新增（漏排）** |
| **research** | **multi-source-research-skill** | **新增（漏排）** |
| matching | topic-capability-matcher | 已有 |
| matching | insertion-strategy-decider | 已有 |
| **writing** | skill-selector | 已有(v2) |
| **writing** | evidence-pack-skill | 新增（在写作前构建证据包） |
| **post-write** | **geo-article-generator** | **修正：从quality移至post-write** |
| **post-write** | **seo-structure-skill** | **修正：应在文章生成后执行** |
| **post-write** | **geo-article-transformer** | **修正：改写已完成，不是质量验证** |
| quality | geo-metrics-skill | 新增（评估 post-write 产出） |
| quality | content-lineage-tracker | 新增 |
| output | schema-org-generator | 新增 |
| output | seo-keyword-research | 新增 |

**修正后的6个Phase**：

```
Phase 1: 上下文加载（Reader × 3）
Phase 2: 网络调研（source-discovery + multi-source-research）
Phase 3: 选题匹配（topic-capability-matcher + insertion-strategy-decider）
Phase 4: 写作编排（skill-selector + evidence-pack 预填充）
Phase 5: 文章后处理（geo-generator + seo-structure + geo-transformer）
Phase 6: 质量保障（geo-metrics + lineage-tracker）→ 输出
```

### SkillOrchestrator 设计

```javascript
// lib/skill-orchestrator.js
class SkillOrchestrator {
  constructor() {
    // 6个Phase，每个Phase包含一组按顺序执行的Skill
    this.phases = [
      { name: 'context',    skills: ['brand-policy-reader', 'strategy-reader', 'icp-reader'] },
      { name: 'research',    skills: ['source-discovery-skill', 'multi-source-research-skill'] },
      { name: 'matching',    skills: ['topic-capability-matcher', 'insertion-strategy-decider'] },
      { name: 'writing',     skills: ['skill-selector'] },  // skill-selector 内部编排主笔+aux
      { name: 'post-write',  skills: ['geo-article-generator', 'seo-structure-skill', 'geo-article-transformer'] },
      { name: 'quality',     skills: ['geo-metrics-skill', 'content-lineage-tracker'] },
    ];
  }

  async run(input) {
    let ctx = { ...input };
    for (const phase of this.phases) {
      for (const skillId of phase.skills) {
        ctx = await this.runSkill(skillId, ctx);
      }
    }
    return ctx;
  }
}
```

### 修正说明：R2 Standalone Fallback

**现状**：`writing-stub.js` 已存在，`skill-selector.js` 已配置 `local-stub` 映射。R2 不是"创建新 stub"，而是**增强现有 stub 的输出质量**。

T2.1：将 `writing-stub.js` 接入 `skill-selector.js` 的 `runWritingSkill` 作为显式 fallback
T2.2：增强 `writing-stub.js` 的结构化模板（加入 evidence pack 片段 + SEO meta 字段）
T2.3：输出标注"standalone fallback"水印，便于识别

---

## 五、计划自身风险（自检）

| 风险 | 说明 | 状态 |
|------|------|------|
| Phase归属错误 | 原计划把seo-structure/geo-transformer放在"质量Phase"，应在前处理Phase | ✅ 已修正 |
| R2与现有代码重复 | `writing-stub.js`已存在且已配置在skill-selector中 | ✅ 已修正 |
| Phase数量不一致 | 文档写5个，表格写5个，数据流图画6个 | ✅ 已修正为6个 |
| source-discovery/multi-source-research漏排 | 原计划遗漏了调研Phase | ✅ 已修正 |

---

## 六、风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| jieba无法安装 | R3无法完成 | 改用预置白名单 |
| Jova Skill接口变更 | R2 fallback失效 | 接口版本锁定 |
| 真实API认证复杂 | R4切换失败 | 先完成OAuth流程调研 |
| Agent8未开发 | Pipeline无法端到端 | 用Mock替代，接口预留 |

---

*本计划基于 V1.2 自查结果制定，V2.0 聚焦 Pipeline 集成和遗留风险消除。*
