# Agent 6 · 研究与母内容智能体
## 技术规格文档 V1.1

> 本文档是 Agent 6 的唯一权威技术规格。
> 无需查阅其他文档，按本文档可直接理解或实施 Agent 6 系统。
>
> **更新说明 (V1.1):**
> - 补充 lib/ 目录完整模块清单（7个文件）
> - 补充所有 Skills 的 module.exports 导出接口
> - 补充 `jova-skill-invoker.js` Jova Skill 调用机制说明
> - 补充 `ruleBasedJudge` 和 `llmCall` 导出
> - 补充 `receiveFeedback` 导出（feedback-loop.js）
> - 补充 `preloadSkills` + `invokeSkill` Jova Skill 调用流程
> - 补充 `generateStubContent` 本地 Stub 说明
> - 补充 `pending_keywords.json` 初始化检测逻辑
> - 补充 4大场景知识库目录
> - 更新文件索引

---

## 一、系统定位

### 1.1 在 RISEN OS 中的角色

```
Agent 1（增长总控）→ 增长方向与预算
Agent 2（品牌护照）→ 公司介绍/产品信息/能力声明/证据
Agent 3（市场情报）→ ICP/用户画像/竞品/问题地图
Agent 4（策略）→ 叙事主轴/渠道组合/品牌规范
Agent 5（选题）→ 热点选题/搜索意图/平台建议
      ↓
Agent 6（内容生成）→ 软硬植入/母文章  ← 本文档范围
      ↓
Agent 7（多模态）→ 多渠道内容适配
      ↓
Agent 8（传播）→ 发布/互动/线索获取
      ↓
Agent 9（归因）→ 效果归因 → 反馈 → Agent 6（闭环）
```

### 1.2 一句话定义

接收 Agent 5 的外部热点选题，结合公司/产品的内部知识库，自主判断软/硬植入策略，输出可直接进入生产流程的完整母文章。

### 1.3 环境变量要求

| 变量 | 必需 | 说明 |
|------|------|------|
| `COMPANY_NAME` | **是** | 公司名称，用于占位符替换 |
| `LLM_MODEL` | 否 | LLM 模型，默认使用内置规则判断 |
| `MAX_TOKENS` | 否 | Token 预算上限（默认 8000） |
| `MAX_CONCURRENT` | 否 | 最大并发数（默认 3） |

> **如果 `COMPANY_NAME` 未设置，Agent 6 拒绝启动。**

---

## 二、输入规格

### 2.1 必选输入（来自 Agent 5）

```javascript
{
  topic_id: string,
  topic_title: string,
  content_type: string,  // 'news' | 'analysis' | 'case_study' | 'tutorial'
  directions: [{
    direction_id: string,
    angle: string,
    content_forms: string[]
  }],
  search_intent: {
    primary: string[],
    secondary: string[],
    geo: string[],
    intent_type: string  // 'informational' | 'navigational' | 'transactional' | 'commercial'
  },
  evidence_score: number  // 0-100
}
```

### 2.2 必选输入（来自 Agent 4）

```javascript
{
  narrative: {
    main_axis: string,
    story_arc: string
  },
  channel_mix: [{ channel, budget_ratio }],
  brand_policy: { tone, values }
}
```

### 2.3 可选输入

**用户上传（触发知识更新）：**
```javascript
{ uploadedFile: string | Buffer, userMessage: string }
```

**Agent 9 反馈（触发闭环优化）：**
```javascript
{ article_id: string, capability_cards_used: string[], performance: { impressions, clicks, conversions } }
```

**Agent 1 Campaign 变更：**
```javascript
{ campaign_id: string, goal: string, updated_at: string }
```

---

## 三、Pipeline 执行流程

```
runAgent6({ topicBrief, strategyContext, pendingKeywords })
│
├─ 0. 启动时同步
│   ├─ buildCapabilityIndex({ source: 'agent2' })  // 读 knowledge/company/ + product/
│   ├─ buildCapabilityIndex({ source: 'agent3' })  // 读 knowledge/market/
│   └─ buildCapabilityIndex({ source: 'campaign' }) // 读 knowledge/campaign/
│
├─ 1. 选题-能力匹配
│   └─ matchTopicToCapabilities(topicBrief, index.cards) → MatchReport
│
├─ 2. 植入策略决策
│   └─ decideInsertionStrategy({ matchReport, companyName }) → InsertionStrategy
│
├─ 3. 内容生成（主笔+辅笔并发）
│   ├─ selectWritingMode() → mode
│   ├─ getPrimarySkill(mode) → primarySkillId
│   ├─ runWritingSkill(primarySkill, params)  // 主笔
│   └─ getAuxSkills(mode) → auxSkillIds  // 辅笔并发
│
└─ 4. 质量门验收
    └─ kaiGate(content) → { pass, reasons, scores }
```

---

## 四、输出规格（MasterArticle）

```javascript
{
  article_id: string,           // 格式: MA-{timestamp}-{random}
  topic_id: string,
  content: string,

  content_structure: {
    hook: string,
    body: string,
    cta: string
  },

  insertion_strategy: {
    strategy: string,             // 'soft' | 'hard' | 'minimal'
    insertion_points: [{
      position: string,           // P20 | P40 | P60 | P80
      description: string,
      type: string,
      capability_id: string,
      rationale: string
    }]
  },

  match_report: {
    insertion_type: string,
    keywords: { primary, secondary, geo },
    stage1_signal_count: number,
    stage2_result_count: number,
    used_stage2: boolean,
    top_matches: [{
      id: string, headline: string, match_score: number,
      insertion_type: string, evidence_count: number
    }],
    reasoning: string
  },

  evidence_references: [{
    capability_id: string,
    evidence_text: string,
    source_file: string
  }],

  capability_cards_used: string[],

  quality_check: {
    pass: boolean,
    reasons: string[],
    scores: { useful, user_focused, clear, actionable }
  },

  generated_at: string  // ISO 8601
}
```

---

## 五、核心能力

### 5.1 知识整合

**读取来源：**
- `knowledge/company/` — Agent 2 输出（公司介绍/品牌规范/能力声明）
- `knowledge/product/` — Agent 2 输出（产品画像/功能列表）
- `knowledge/market/` — Agent 3 输出（ICP/竞品/问题地图）
- `knowledge/scene_*/` — **4大场景知识库**（定制化场景）
- `knowledge/docs/` — 用户人工上传的原始文档
- `knowledge/campaign/` — Agent 1 当前 Campaign 上下文

**输出：** CapabilityCard 数组，存入 `knowledge/_index.json`

### 5.2 选题-能力匹配

**算法：** TF-IDF 子串匹配 + ngram 相似度（不依赖外部 embedding）

**关键词来源：** 全部来自 `topicBrief.search_intent`（primary/secondary）

**判断规则：**
```
hard:   matchScore >= 0.5 AND evidenceCount >= 3
soft:   matchScore >= 0.3 AND isHotTopic === true
minimal: 其他情况

isHotTopic = intent_type === 'transactional' || 'commercial'
```

### 5.3 软/硬植入决策

| 策略 | 条件 | 分位点 |
|------|------|--------|
| **Hard** | matchScore ≥ 0.5 且 evidence ≥ 3 | P20/P40/P60/P80（4个） |
| **Soft** | matchScore ≥ 0.3 且 isHotTopic | P20/P40（1-2个） |
| **Minimal** | 其他 | 无植入 |

### 5.4 写作 Skill 路由

#### 写作模式配置

```javascript
const WRITING_MODES = {
  deep_long_form: {
    primary: 'khazix-writer',  // 公众号深度长文
    aux: ['hv-analysis', 'ljg-think'],
    fallback: 'ljg-writes'
  },
  quick_social: {
    primary: 'huashu-douyin-script',  // 短视频/小红书
    aux: ['ljg-card'],
    fallback: 'ljg-writes'
  },
  technical: {
    primary: 'ljg-writes',  // 知乎/技术博客
    aux: ['hv-analysis', 'ljg-rank'],
    fallback: 'khazix-writer'
  },
  marketing: {
    primary: 'kai-write',  // 转化类内容
    aux: ['kai-topical-map'],
    fallback: 'khazix-writer'
  }
};
```

#### Skill 选择逻辑

```
selectWritingMode(topicBrief, insertionStrategy):
  1. content_type 优先映射: news→deep_long_form, analysis→technical, case_study→marketing, tutorial→technical
  2. hard策略 + analysis → marketing（转化导向）
  3. 默认 → deep_long_form
```

#### Jova Skill 调用流程

```
skill-selector.js
  ↓ SKILL_REGISTRY['khazix-writer'] = 'skill::khazix-writer'
  ↓ 抛出 JOVA_SKILL_REQUIRED 错误
  ↓ jova-skill-invoker.js
      ├─ preloadSkills([...])  // 预加载 SKILL.md
      └─ invokeSkill(skillId, params)  // sessions_spawn 启动 sub-agent
```

### 5.5 Four U's 质量门

```javascript
function kaiGate(content) → { pass, reasons, scores }
```

| 维度 | 检测项 | 权重 |
|------|--------|------|
| Useful | 10+汉字段落 + 列表/步骤词 | 0.4+0.3+0.3 |
| User-focused | 收益词 + 第二人称 | 0.5+0.3+0.2 |
| Clear | Markdown标题 + 3+段落 | 0.4+0.3+0.3 |
| Actionable | CTA词 + 联系方式 | 0.5+0.3+0.2 |

---

## 六、知识持续更新

### 6.1 5种触发机制

| # | 触发 | 时机 | 处理 |
|---|------|------|------|
| 1 | 目录文件变化 | chokidar 实时监听 | 扫描 `knowledge/`，防抖刷新 |
| 2 | Agent 2 输出 | 启动时 + 事件通知 | 读 company/ + product/，更新索引 |
| 3 | Agent 3 输出 | 启动时 + 事件通知 | 读 market/，更新索引 |
| 4 | Agent 1 Campaign | 事件通知 | 重排 capability cards 优先级 |
| 5 | 用户上传 | 用户对话实时 | 分析内容，追加关键词或确认后更新 |

### 6.2 用户上传三情况

```
情况A：用户明确说了更新什么 → 直接执行
情况B：用户没说清楚 → 提取关键词追加到 pending，3天后过期
情况C：用户提到变化但没上传 → 追问引导用户提供
```

### 6.3 pending_keywords.json 初始化

```javascript
// 检测逻辑（agent6-core.js）
const PENDING_PATH = path.join(__dirname, 'knowledge/pending_keywords.json');
const raw = JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'));
// 根是对象: { keywords: [...], updated_at: "..." }
// 数组在 .keywords 字段里
```

**文件格式：**
```json
{
  "keywords": ["AI落地", "企业级AI", "智能体", "..."],
  "updated_at": "2026-06-23T..."
}
```

### 6.4 Diff 阈值检测（20%）

```javascript
// diff-detector.js
const DIFF_THRESHOLD = 0.20;  // 变化超过20%才触发刷新
computeDiffRatio(oldText, newText)  // 字级别diff比例
```

### 6.5 Agent 9 反馈闭环

```javascript
// feedback-loop.js
handleAgent9Feedback({ article_id, capability_cards_used, performance })
  CTR >= 5%   → confidence += 0.1（最高1.0）
  CTR 1-5%   → 不变
  CTR < 1%   → confidence -= 0.05（最低0.0）
```

---

## 七、lib/ 核心工具模块

| 文件 | 类/函数 | 说明 |
|------|---------|------|
| `id-generator.js` | `generateId()`, `generateArticleId()`, `generateCardId()` | ID生成器 |
| `file-utils.js` | `writeJsonAtomic()`, `readJsonFile()` | 原子文件写入（POSIX rename） |
| `llm-call.js` | `llmCall()`, `ruleBasedJudge()`, `CALL_COUNT` | LLM调用封装（无LLM时用规则判断） |
| `token-budget.js` | `TokenBudget` | Token预算控制（reserve/canAfford/check） |
| `pipeline-queue.js` | `PipelineQueue` | 并发队列（控制最大并发数） |
| `skill-runner.js` | `runSkill()`, `runSkillsParallel()`, `SkillError`, `SkillTimeoutError` | Skill运行器（超时控制+错误标准化） |
| `jova-skill-invoker.js` | `preloadSkills()`, `invokeSkill()`, `PROMPT_MAX_TOKENS` | Jova Skill调用器（sessions_spawn路由） |

### Jova Skill 调用机制

```javascript
// 步骤1: 预加载 SKILL.md
await preloadSkills(['khazix-writer', 'ljg-writes', 'hv-analysis', ...]);

// 步骤2: 触发 Skill
await invokeSkill('khazix-writer', { topicBrief, insertionStrategy, companyName });
//   ↓ sessions_spawn 启动独立 sub-agent session
//   ↓ sub-agent 读取 SKILL.md，执行写作逻辑
//   ↓ 返回 content
```

---

## 八、skills/ 完整清单

### 8.1 Knowledge Skills

| 文件 | 导出 | 功能 |
|------|------|------|
| `knowledge-base-reader.js` | `scanKnowledgeDir`, `getCapabilityCards` | 扫描知识库目录，提取能力卡片 |
| `capability-index-builder.js` | `buildCapabilityIndex`, `loadIndex`, `saveIndex` | 从 Agent2/3 构建能力索引 |
| `knowledge-sync.js` | `KnowledgeSync` | chokidar 目录实时监听 |
| `knowledge-update-handler.js` | `handleKnowledgeUpdate`, `extractKeywordsFromContent`, `cleanupExpired` | 用户上传知识更新处理 |
| `diff-detector.js` | `checkFileShouldRefresh`, `computeDiffRatio`, `computeQuickHash`... | 20% Diff 阈值检测 |

### 8.2 Matching Skills

| 文件 | 导出 | 功能 |
|------|------|------|
| `topic-capability-matcher.js` | `matchTopicToCapabilities`, `isHotTopic`, `computeSimilarity` | 选题-能力匹配 + ngram相似度 |

### 8.3 Strategy Skills

| 文件 | 导出 | 功能 |
|------|------|------|
| `insertion-strategy-decider.js` | `decideInsertionStrategy`, `computeInsertionPoints` | 软/硬植入策略决策 |

### 8.4 Writing Skills

| 文件 | 导出 | 功能 |
|------|------|------|
| `skill-selector.js` | `selectWritingMode`, `getPrimarySkill`, `getAuxSkills`, `getFallbackChain`, `SKILL_REGISTRY`, `SKILL_FALLBACKS` | 写作模式路由选择 |
| `writing-stub.js` | `generateStubContent` | 本地 Stub（开发阶段占位） |

### 8.5 Validation Skills

| 文件 | 导出 | 功能 |
|------|------|------|
| `kai-gate.js` | `kaiGate`, `kaiGateWithSuggestion` | Four U's 质量门 |
| `validate-skill.js` | `validateSkill`, `validateDir` | CI 合规检查（占位符/硬编码检测） |

### 8.6 Integration Skills

| 文件 | 导出 | 功能 |
|------|------|------|
| `feedback-loop.js` | `receiveFeedback`, `handleAgent9Feedback` | Agent 9 反馈闭环 |
| `campaign-consumer.js` | `consumeCampaignUpdate`, `getCurrentCampaign` | Agent 1 Campaign 事件消费 |

---

## 九、4大场景知识库

```
knowledge/
├── company/              # 公司介绍/战略手册
├── product/              # 产品介绍/功能列表
├── market/               # 市场/竞品/ICP
├── scene_01_urgent_order/  # 场景1：加急单
├── scene_02_quotation/     # 场景2：报价
├── scene_03_customs/       # 场景3：海关
├── scene_04_website/       # 场景4：官网
├── campaign/             # Campaign 上下文
├── docs/                 # 用户上传原始文档
├── pending_keywords.json  # 待处理关键词（初始化检测）
├── _index.json           # CapabilityCard 索引
└── _index.md            # 索引可视化
```

---

## 十、能力边界

| 不做的事 | 说明 |
|---------|------|
| 不自创关键词 | 所有关键词来自 Agent5 / Agent2 / 用户 |
| 不硬编码公司名 | 代码只写 `[COMPANY_NAME]` 占位符 |
| 不做分发 | 分发由 Agent 7/8 负责 |
| 不做多模态适配 | 文字/图片/视频适配由 Agent 7 负责 |
| 不做传播 | 发布/互动由 Agent 8 负责 |
| 不做归因 | 归因由 Agent 9 负责 |
| 不做 SEO 落地 | SEO 框架由 Agent 6 生成，落地由 Agent 7 负责 |

---

## 十一、验收标准

| 检查项 | 要求 |
|-------|------|
| `quality_check.pass` | === true |
| 占位符残留 | content 不含 `[COMPANY_NAME]` 等占位符 |
| 策略有效 | `insertion_strategy.strategy` 为 soft/hard/minimal 其一 |
| 能力引用 | `capability_cards_used.length >= 1` |
| 结构完整 | `content_structure.hook / body / cta` 非空 |
| 长度合规 | 500 ≤ content.length ≤ 50000 |
| 公司名已替换 | cta 不含 `[COMPANY_NAME]` |

---

## 十二、运行命令

```bash
cd /workspace/RISEN-OS/agent6
npm install
COMPANY_NAME=艾氪智能 node agent6-core.js --input mock-data/sample-topic-brief.json
```

---

## 十三、文件索引

### 13.1 入口文件

| 文件 | 用途 |
|------|------|
| agent6-core.js | Pipeline 主入口 |
| mock-data/ | 测试用 TopicBrief 样本 |

### 13.2 lib/ 核心工具（7个）

| 文件 | 说明 |
|------|------|
| lib/id-generator.js | ID生成器 |
| lib/file-utils.js | 原子文件写入 |
| lib/llm-call.js | LLM调用封装 |
| lib/token-budget.js | Token预算控制 |
| lib/pipeline-queue.js | 并发队列 |
| lib/skill-runner.js | Skill运行器 |
| lib/jova-skill-invoker.js | Jova Skill调用器 |

### 13.3 Skills（12个）

| 类别 | 文件 | 功能 |
|------|------|------|
| Knowledge | skills/knowledge-base-reader.js | 扫描知识库 |
| Knowledge | skills/capability-index-builder.js | 构建能力索引 |
| Knowledge | skills/knowledge-sync.js | 目录实时监听 |
| Knowledge | skills/knowledge-update-handler.js | 用户上传处理 |
| Knowledge | skills/diff-detector.js | Diff阈值检测 |
| Matching | skills/topic-capability-matcher.js | 选题-能力匹配 |
| Strategy | skills/insertion-strategy-decider.js | 植入策略决策 |
| Writing | skills/skill-selector.js | 写作模式路由 |
| Writing | skills/writing-stub.js | 本地Stub占位 |
| Validation | skills/kai-gate.js | Four U's质量门 |
| Validation | skills/validate-skill.js | CI合规检查 |
| Integration | skills/feedback-loop.js | Agent9反馈闭环 |
| Integration | skills/campaign-consumer.js | Agent1 Campaign消费 |

### 13.4 Knowledge 目录

| 目录 | 内容 |
|------|------|
| knowledge/company/ | 公司介绍/战略手册 |
| knowledge/product/ | 产品介绍/功能列表 |
| knowledge/market/ | 市场/竞品/ICP |
| knowledge/scene_*/ | 4大场景知识库 |
| knowledge/campaign/ | Campaign上下文 |
| knowledge/docs/ | 用户上传文档 |
| knowledge/_index.json | CapabilityCard索引 |
| knowledge/pending_keywords.json | 待处理关键词 |

### 13.5 output/ 目录

```
output/
├── ART-*.json           # 实际产出文章
└── *.md                 # 降级输出
```

---

## 十四、版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| V1.0 | 2026-06-18 | 初始归档版本 |
| V1.1 | 2026-06-23 | 补充lib/7个模块，补充所有Skills导出接口，补充jova-skill-invoker机制，补充pending_keywords检测，补充4大场景目录，更新文件索引 |

---

*本文档与 /workspace/RISEN-OS/document/AGENT45-OPTIMIZATION-V5.md 配套使用。*
