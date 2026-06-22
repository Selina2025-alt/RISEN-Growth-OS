# Agent 6 技术规格文档（SPEC）
## 版本：V1.0 | 日期：2026-06-18 | 状态：已归档

---

## 一、系统定位

**名称：** Agent 6 — 研究与母内容智能体

**一句话定义：** 接收 Agent 5 的外部热点选题，结合该公司/产品的内部知识库，自主判断软/硬植入策略，输出可直接进入生产流程的完整母文章。

**在 RISEN OS 内容链路中的位置：**

```
Agent 1（增长总控）→ 增长方向与预算
Agent 2（企业身份）→ 公司介绍/产品信息/能力声明/证据
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

---

## 二、输入规格

### 2.1 必选输入

**来自 Agent 5：**
```javascript
{
  topic_id: string,              // 选题唯一标识
  topic_title: string,           // 选题标题
  content_type: string,          // news | analysis | case_study | tutorial
  directions: [{
    direction_id: string,
    angle: string,               // 切入角度
    content_forms: string[]      // 适配内容形态
  }],
  search_intent: {
    primary: string[],           // 核心关键词（来自 Agent5）
    secondary: string[],         // 次要关键词
    geo: string[],              // 地理关键词
    intent_type: string         // informational | navigational | transactional | commercial
  },
  evidence_score: number         // 0-100，证据强度
}
```

**来自 Agent 4：**
```javascript
{
  narrative: {
    main_axis: string,          // 叙事主轴关键词
    story_arc: string          // 故事弧（30s/2min/完整）
  },
  channel_mix: [{channel, budget_ratio}],
  brand_policy: { tone, values }
}
```

**环境变量（必须配置）：**
```bash
COMPANY_NAME=string   # 必须：当前公司名称，用于占位符替换
LLM_MODEL=string      # 可选：LLM模型，默认使用内置模型
MAX_TOKENS=8000       # 可选：Token预算上限
MAX_CONCURRENT=3       # 可选：最大并发数
```

> 如果 `COMPANY_NAME` 未设置，Agent 6 拒绝启动。

### 2.2 可选输入

**用户上传（触发知识更新）：**
```javascript
{
  uploadedFile: string | Buffer,  // 上传的文档
  userMessage: string            // 用户附带说明
}
```

**Agent 9 反馈（触发闭环优化）：**
```javascript
{
  article_id: string,
  capability_cards_used: string[],
  performance: { impressions, clicks, conversions }
}
```

**Agent 1 Campaign 变更（触发能力优先级重排）：**
```javascript
{
  campaign_id: string,
  goal: string,                // brand_building | lead_gen | conversion
  updated_at: string
}
```

---

## 三、输出规格

### 3.1 MasterArticle（主输出）

```javascript
{
  article_id: string,           // 格式：MA-{timestamp}-{random}
  topic_id: string,
  content: string,              // 完整文章正文

  content_structure: {
    hook: string,               // 开头钩子（吸引用户停留阅读）
    body: string,               // 主体内容方向（含真实公司名）
    cta: string                 // 行动号召（含真实公司名）
  },

  insertion_strategy: {
    strategy: string,             // soft | hard | minimal
    insertion_points: [{
      position: string,           // P20 | P40 | P60 | P80（全文分位）
      description: string,        // 植入内容描述
      type: string,              // soft | hard
      capability_id: string,
      rationale: string
    }],
    seo_keywords: {
      primary: string[],
      secondary: string[],
      geo: string[],
      capability_based: string[], // 已完成占位符替换
      intent_type: string
    }
  },

  match_report: {
    insertion_type: string,
    keywords: {
      primary: string[],
      secondary: string[],
      geo: string[]
    },
    stage1_signal_count: number,
    stage2_result_count: number,
    used_stage2: boolean,
    top_matches: [{
      id: string,
      headline: string,
      match_score: number,
      insertion_type: string,
      evidence_count: number
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
    reasons: string[]
  },

  generated_at: string           // ISO 8601
}
```

---

## 四、核心能力

### 能力一：知识整合

**读取来源：**
- `knowledge/company/` — Agent 2 输出（公司介绍/品牌规范/能力声明）
- `knowledge/product/` — Agent 2 输出（产品画像/功能列表）
- `knowledge/market/` — Agent 3 输出（ICP/竞品/问题地图）
- `knowledge/docs/` — 用户人工上传的原始文档
- `knowledge/campaign/` — Agent 1 当前 Campaign 上下文

**输出：** CapabilityCard 数组，存入 `knowledge/_index.json`

### 能力二：选题-能力匹配

**输入：** Agent 5 的 Topic Brief（含 search_intent）

**算法：** TF-IDF 相似度（不依赖外部 embedding 服务，Jova 内置能力）

**关键词来源：** 全部来自 `topicBrief.search_intent`（primary/secondary），不自行生成

**判断规则：**
```
hard:   matchScore >= 0.5 AND evidenceCount >= 3
soft:   matchScore >= 0.3 AND isHotTopic === true
minimal: 其他情况

isHotTopic 来源：intent_type === 'transactional' 或 'commercial' → true
               intent_type === 'informational' 或 'navigational' → false
```

### 能力三：软/硬植入决策

**Soft（软植入）：**
- 以热点选题为主，自然融入公司/产品
- 出现在 1-2 个分位点（P20/P40）
- 不破坏干货节奏，适合品牌建设

**Hard（硬植入）：**
- 选题只是"黄金三秒"钩子
- 后半部分深度展开公司/产品能力
- 出现在多个分位点，含 CTA，适合转化

**Minimal（最小植入）：**
- 选题与公司能力几乎无关
- 不做能力匹配，直接生成干货内容

### 能力四：内容生成

**主笔+辅笔并发模式：**

| 模式 | 主笔 | 辅笔 | 适用场景 |
|-----|------|------|---------|
| deep_long_form | khazix-writer | hv-analysis, ljg-think | 公众号深度长文 |
| quick_social | huashu-douyin-script | ljg-card | 短视频/小红书 |
| technical | ljg-writes | hv-analysis, ljg-rank | 知乎/技术博客 |
| marketing | kai-write | kai-topical-map | 转化类内容 |

**Skill 选择：** goal × channel × topic_type 三维决策

**致命失败处理：**
- 3 个以上 Skill 失败 → 抛 `HumanActionRequiredError`，人工介入
- 1 个 Skill 失败 → 按 fallback 映射重试最多 2 次
- 所有 Skill 失败 → 降级到 khazix-writer

### 能力五：质量门验收

生成后必须通过以下检查：
1. **长度检查：** 500 ≤ content.length ≤ 50000
2. **占位符残留检查：** `[COMPANY_NAME]` / `{{COMPANY}}` / `{{BRAND}}` 不得出现在正式内容中
3. **环境变量检查：** `COMPANY_NAME` 已设置
4. **Four U's 检查：** LLM 判断内容质量，有 fallback

### 能力六：知识持续更新

**五种触发机制：**

| 触发 | 时机 | 处理 |
|-----|------|------|
| 1. 目录文件变化 | chokidar 实时监听 | 扫描 `knowledge/`，防抖刷新 |
| 2. Agent 2 输出 | 启动时 + 事件通知 | 读取 company/ + product/，更新索引 |
| 3. Agent 3 输出 | 启动时 + 事件通知 | 读取 market/，更新索引 |
| 4. Agent 1 Campaign | 事件通知 | 重排 capability cards 优先级 |
| 5. 用户上传 | 用户对话实时 | 分析内容，追加关键词或确认后更新 |

**用户上传三情况：**
```
情况A：用户明确说了更新什么 → 直接执行
情况B：用户没说清楚 → 提取关键词追加到 pending，3天后过期
情况C：用户提到变化但没上传 → 追问引导用户提供
```

**Agent 9 反馈闭环：**
```
CTR >= 5%   → 对应 card confidence += 0.1
CTR 1-5%   → 不变
CTR < 1%   → 对应 card confidence -= 0.05
```

---

## 五、能力边界

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

## 六、与 Agent 4/5 的边界对比

| 维度 | Agent 4 | Agent 6 | 说明 |
|-----|---------|---------|------|
| 叙事主轴 | ✅ 提供 | 引用 | Agent 4 写，Agent 6 用 |
| 渠道策略 | ✅ 提供 | 引用 | Agent 4 分配，Agent 6 遵循 |
| 选题生成 | 无 | 无 | Agent 5 负责 |
| 能力匹配 | 无 | ✅ 有 | Agent 6 独有 |
| 软/硬植入决策 | 无 | ✅ 有 | Agent 6 独有 |
| 内容生成 | 无 | ✅ 有 | Agent 6 负责生成母文章 |
| SEO 框架 | 无 | ✅ 有 | Agent 6 输出 SEO 框架，Agent 7 落地 |

**重合风险：无明显重合。** 两者的数据流是单向的：Agent 4 → Agent 6，Agent 4 不会消费 Agent 6 的输出。

---

## 七、完整 Skill 池

| 层级 | Skill | 来源 | 优先级 |
|-----|-------|------|-------|
| Knowledge | knowledge-base-reader | **自研** | P0 |
| | capability-index-builder | **自研** | P0 |
| | knowledge-sync.js | **自研** | P0 |
| | knowledge-update-handler | **自研** | P0 |
| | feedback-loop.js | **自研** | P0 |
| Matching | topic-capability-matcher | **自研** | P0 |
| Strategy | insertion-strategy-decider | **自研** | P0 |
| Writing | khazix-writer | 现成 | 主笔 |
| | ljg-writes | 现成 | 主笔 |
| | huashu-douyin-script | 现成 | 主笔 |
| | kai-write | 引入 | 主笔 |
| | hv-analysis | 现成改装 | 辅笔 |
| | ljg-think | 现成 | 辅笔 |
| | ljg-rank | 现成 | 辅笔 |
| | ljg-card | 现成 | 辅笔 |
| SEO/GEO | kai-topical-map | 引入 | P0 |
| | content-strategy | 现成改装 | P1 |
| Validation | kai-gate | 引入 | P0 |
| | huashu-proofreading | 现成 | P1 |
| Discovery | huashu-research | 现成 | P1 |
| | huashu-info-search | 现成 | P1 |
| | web-scraping | 现成 | 底层 |

---

## 八、数据依赖关系图

```
Agent 2 ──→ knowledge/company/ + product/
Agent 3 ──→ knowledge/market/
Agent 5 ──→ TopicBrief + SearchIntentMap
Agent 4 ──→ StrategyContext
Agent 1 ──→ knowledge/campaign/
用户 ──→ knowledge/docs/
Agent 9 ──→ feedback ──→ feedback-loop.js
                              │
                              ↓
                    MasterArticle ──→ Agent 7
```

---

## 九、验收标准

一份合格的 MasterArticle 必须满足：

| 检查项 | 要求 |
|-------|------|
| quality_check.pass | === true |
| 占位符残留 | content 不含 `[COMPANY_NAME]` 等占位符 |
| 策略有效 | insertion_strategy.strategy 为 soft/hard/minimal 其一 |
| 能力引用 | capability_cards_used.length >= 1 |
| 结构完整 | content_structure.hook / body / cta 非空 |
| 长度合规 | 500 ≤ content.length ≤ 50000 |
| 公司名已替换 | cta 不含 `[COMPANY_NAME]` |

---

## 十、版本

| 版本 | 日期 | 说明 |
|-----|------|------|
| V1.0 | 2026-06-18 | 初版归档 |
