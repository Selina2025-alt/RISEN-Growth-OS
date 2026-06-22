# Agent 6 能力架构深度分析报告
## 版本：V1.1 | 日期：2026-06-18 | 状态：已归档（知识更新机制章节补充）

---

## 一、项目背景与定位

### 1.1 Agent 6 在 RISEN OS 中的角色

Agent 6（研究与母内容智能体）是 RISEN OS 九大核心智能体之一，负责将外部热点选题与公司内部知识进行匹配，生成具有增长价值的对外内容。

### 1.2 与 Agent 4/5 的协作关系

```
Agent 1（增长总控）
  └── Campaign Goal + Budget

Agent 2（企业身份与证据）
  ├── Promotion Passport（宣发护照）
  ├── Brand Policy（品牌规范）
  ├── Claim List（能力声明列表）
  ├── Evidence Graph（证据图谱）
  └── Product Profile（产品画像）

Agent 3（市场与客户情报）
  ├── ICP（理想客户画像）
  ├── Persona（用户角色）
  ├── Customer Problem Map（客户问题地图）
  └── Market Brief（市场简报）

Agent 4（策略与实验）
  ├── Strategy Card
  ├── Narrative（叙事主轴）
  └── Channel Mix（渠道组合）

Agent 5（趋势与选题）
  ├── Topic Brief（选题方向）
  ├── Search Intent Map（搜索意图）
  └── Platform Recommendation（平台建议）

Agent 6（研究与母内容）← 本文档范围
  ├── 接收所有上游输入
  ├── 读取 Knowledge Base（动态更新）
  ├── 判断软性 or 硬性植入
  ├── 生成 Master Article（含 SEO 框架 + GEO 标注）
  └── 输出给 Agent 7

Agent 7（多模态与本地化）
  └── 生成 Channel Package

Agent 8（传播与客户激活）
  └── 发布 + 互动 + 线索

Agent 9（收入归因与增长学习）
  └── 反馈 → Agent 6（闭环优化）
```

### 1.3 核心职责

**Agent 6 的核心职责：**

1. **知识整合**：动态读取公司内部资料（战略手册/产品介绍/培训文档），建立结构化的能力卡片索引
2. **选题-能力匹配**：将 Agent 5 给出的选题方向，与公司产品能力做语义关联匹配
3. **软硬植入决策**：自主判断每个选题适合软性植入还是硬性植入
4. **内容生成**：基于匹配结果和写作 Skill 池，生成符合品牌规范的母文章
5. **SEO/GEO 优化**：在文章中嵌入 SEO 框架和 GEO 引用优化标注
6. **研究闸门**：确保所有引用内容有来源支撑，不合格不进生产

---

## 二、两个核心设计原则

### 原则 1：动态能力框架（不固化）

**目标**：Agent 6 无论身处哪家公司，都能正常工作。knowledge/ 里的文档只是示例和测试数据，不是硬编码逻辑。

**错误的做法（固化）**：
```
Skill 做 "JovaAI 五层架构 × 选题" 的硬匹配
→ 换一家公司，这个 Skill 就废了
```

**正确的做法（动态）**：
```
Skill 做 "从文档提取 capability cards" 的通用能力
→ 换一家公司，capability cards 换一批，匹配逻辑不变
```

**实现要点**：
- `topic-capability-matcher` 底层是"提取-匹配-评分"三层，提取层是通用的，匹配层用 knowledge/ 的文档做上下文
- Skill Selector 是动态的，根据 topic_type × channel × goal 三维选择，不硬编码"哪个场景用哪个 Skill"

### 原则 2：多 Skill 池复用（1:N 而非 1:1）

**目标**：每个能力需求不是绑定一个 Skill，而是从一个 Skill 池里根据上下文动态选择。

**错误的做法**：
```
母文章生成 = khazix-writer  1:1
```

**正确的做法**：
```
母文章生成 = Skill Selector 动态选择：
  - 目标渠道（公众号/知乎/LinkedIn/视频脚本）
  - 选题类型（技术解读/产品发布/行业分析/方法论）
  - 内容目标（品牌建立/线索获取/思想领导）
  → 从 Skill 池选 1 个或组合多个，优胜劣出
```

---

## 三、Skill 池全景图（按需求归类）

### 3.1 Knowledge Layer（知识层）

| Skill | 来源 | 用途 |
|-------|------|------|
| knowledge-base-reader | **自研 P0** | 读取 knowledge/ 目录，解析文档，提取 capability cards |
| capability-index-builder | **自研 P0** | 从公司文档自动构建能力索引 |
| knowledge-sync.js | **自研** | 监听 knowledge/ 目录变化，触发增量更新 |

**自研原因**：必须理解公司私有文档结构，外采无法读内部资料。

### 3.2 Discovery Layer（发现层）

| Skill | 来源 | 适用场景 |
|-------|------|---------|
| huashu-research | 现成 | 深度调研，长周期研究 |
| huashu-info-search | 现成 | 快速多源验证 |
| web-scraping | 现成 | 结构化大规模采集（底层工具）|
| ljg-paper | 现成 | 学术论文解读 |
| ljg-paper-river | 现成 | 论文溯源（5层递归）|
| follow-builders | 现成 | AI 行业 KOL 动态 |
| aihot | 现成 | AI 热点每日汇总 |
| tech-news-digest | 现成 | 科技媒体汇总（RSS）|

**Selector 策略**：
```
热点/信号类 → aihot + tech-news-digest 并发
深度调研 → huashu-research + ljg-paper-river 组合
快速验证 → huashu-info-search
大规模采集 → web-scraping（Playwright/Scrapy）
```

### 3.3 Matching Layer（匹配层）

| Skill | 来源 | 用途 |
|-------|------|------|
| topic-capability-matcher | **自研 P0** | 选题-能力动态匹配引擎 |

**自研原因**：匹配的是公司私有能力资产，不是通用知识，这是 RISEN Agent 团队的核心差异竞争力。

### 3.4 Strategy Layer（策略层）

| Skill | 来源 | 用途 |
|-------|------|------|
| insertion-strategy-decider | **自研 P0** | 软/硬植入判断，自主决策 |
| hv-analysis | 现成改装 | 横纵分析，改装为"选题角度 × 公司能力轴" |
| content-strategy | 现成改装 | 关键词战略，改装为"植入点位设计" |
| ljg-rank | 现成 | 把现象砍到不可少的生成器，提炼产品亮点 |

**insertion-strategy-decider 决策逻辑**：

```javascript
function decideInsertionStrategy(topicBrief, capabilityMatch) {
  const matchScore = capabilityMatch.relevance_score;
  const evidenceStrength = capabilityMatch.evidence_count;

  // 硬性植入条件：
  // 1. 选题与核心能力高度匹配（matchScore >= 0.7）
  // 2. 有充足证据支撑（evidenceStrength >= 3）
  // 3. 选题角度适合深度展开产品价值
  if (matchScore >= 0.7 && evidenceStrength >= 3) {
    return { strategy: 'hard', reason: '选题与核心能力高度匹配，有充分证据，适合深度展开' };
  }

  // 软性植入条件：
  // 1. 选题与能力有弱关联（0.3 <= matchScore < 0.7）
  // 2. 选题是当前热点，需要借势
  if (matchScore >= 0.3 && topicBrief.is_hot_topic) {
    return { strategy: 'soft', reason: '热点选题借势，能力自然融入不生硬' };
  }

  // 纯干货条件：
  // 选题与公司能力几乎无关，以知识价值为主
  return { strategy: 'minimal', reason: '选题与公司能力关联弱，以纯干货内容为主' };
}
```

### 3.5 Writing Layer（写作层）

| Skill | 来源 | 适用场景 | 渠道 | 风格 |
|-------|------|---------|------|------|
| khazix-writer | 现成 | 深度长文、个人 IP | 公众号/知乎 | 有见识普通人、英雄之旅 |
| huashu-wechat-creation | 现成 | 中文公众号全流程 | 公众号 | 实践导向，心路历程 |
| ljg-writes | 现成 | 知识框架型 | 通用 | 理性分析、结构化 |
| kai-write | kai-cmo 引入 | 营销内容 | 多渠道（blog/LinkedIn/邮件/广告）| 专业营销、Four U's 质量门 |
| ljg-think | 现成 | 深度追问钻探 | 通用 | 费曼式拆解 |
| hv-analysis | 现成改装 | 深度分析 | 通用 | 问题×时间双轴 |

**Skill Selector 策略**：

```javascript
function selectWritingSkills({ topicType, channel, goal, persona }) {
  // ── L1: Goal Filter（硬约束）──────────────────────
  if (goal === 'conversion') {
    const candidates = ['kai-write'];
    if (channel === 'wechat') candidates.push('huashu-wechat-creation');
    return arbitrate(candidates);
  }

  // ── L2: Channel Filter（硬约束）─────────────────
  if (channel === 'wechat') {
    const candidates = ['khazix-writer', 'huashu-wechat-creation'];
    if (topicType === 'technical_deep_dive') {
      candidates.push('hv-analysis'); // 深度分析增强
    }
    return arbitrate(candidates);
  }

  if (channel === 'blog' || channel === 'zhihu') {
    if (topicType === 'technical_deep_dive') {
      return arbitrate(['ljg-think', 'hv-analysis']);
    }
    if (goal === 'thought_leadership') {
      return arbitrate(['ljg-writes']);
    }
  }

  // ── L3: Multi-tag fallback───────────────────────
  // 多个 type 混合时，取交集
  return arbitrate(getAllSkillsForType(topicType));
}
```

**主笔 + 辅笔模式**：
```
主笔（生成主体）：
  目标渠道的主要写作风格
  → khazix-writer（公众号深度）or kai-write（营销转化）

辅笔（增强特定维度）：
  数据/分析深度 → hv-analysis
  观点锐度 → ljg-think
  SEO 结构 → kai-topical-map（出框架）

最终合稿 + 风格统一：
  → huashu-proofreading（降 AI 味 + 风格统一）
  → kai-gate（质量门终审）
```

### 3.6 SEO/GEO Layer

| Skill | 来源 | 用途 |
|-------|------|------|
| kai-topical-map | kai-cmo 引入 P0 | AEO/GEO 主题地图（QDP/QDH/QDS 三层）|
| kai-seo-audit | kai-cmo 引入 P1 | 技术 SEO 全面审计 |
| kai-repurpose | kai-cmo 引入 P1 | 内容乘法（1 篇 → 15-25 渠道原生版本）|
| content-strategy | 现成改装 | 关键词战略，内容支柱 |

**Selector 策略**：
```
目标 == 占领 AI 搜索引用（GEO）→ kai-topical-map（AEO-first）
目标 == 关键词排名（SEO）→ kai-seo-audit × content-strategy 组合
目标 == 内容规模化分发 → kai-repurpose（1→25）
```

**kai-topical-map 的 QDP/QDH/QDS 框架**：
- **QDP**（Query Demand Page）：需要独立 URL 的高需求主题
- **QDH**（Query Demand Heading）：作为子章节嵌入父页面
- **QDS**（Query Demand Sentence）：一句话覆盖，不独立成文

### 3.7 Validation Layer（校验层）

| Skill | 来源 | 用途 |
|-------|------|------|
| kai-gate | kai-cmo 引入 P0 | Four U's 质量门（Unique/Useful/Ultra-specific/Urgent）|
| huashu-proofreading | 现成 | 六类 AI 腔识别 + 三遍审校 |
| huashu-article-edit | 现成 | 标准化编辑流程 |

**kai-gate 质量门评分标准**：

| 维度 | 问题 | 评分 |
|------|------|------|
| **Unique** | 只有我们能写？原创数据/视角/经历？ | 1-4 |
| **Useful** | 读者能立刻行动？ | 1-4 |
| **Ultra-specific** | 有数字/具体工具/具体案例？ | 1-4 |
| **Urgent** | 有今天行动的理由？ | 1-4 |

**阈值**：12/16（blog/SEO/articles）、10/16（email/ads），单项低于 2 分直接拒绝。

---

## 四、Skill Selector 架构（决策中枢）

### 4.1 三维决策逻辑

```
输入维度：
  - topic_type：技术解读 / 产品发布 / 行业分析 / 方法论 / 产业深度
  - channel：wechat / zhihu / blog / linkedin / multi_platform
  - goal：brand_building / lead_gen / thought_leadership / conversion / growth

优先级（硬约束）：
  1. goal（业务目标）最高
  2. channel（渠道硬约束）
  3. topic_type（创作灵活性）
```

### 4.2 仲裁机制（arbitrate 函数）

```javascript
async function arbitrate(candidates) {
  // 并发执行，所有 Skill 独立运行
  const results = await Promise.allSettled(
    candidates.map(skill => runSkillWithTimeout(skill, 30000))
  );

  // L1: 质量门过滤
  const passed = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(output => qualityGate(output) >= 12/16);

  if (passed.length === 0) {
    // L2: 降级路径
    const fallbacks = candidates
      .filter(s => s.fallback)
      .map(s => runSkillWithTimeout(s.fallback, 20000));
    return fallbacks;
  }

  if (passed.length > 1) {
    // L3: 多 Skill 输出全部保留，由后续评审选择
    return passed;
  }

  return passed; // 唯一胜者
}
```

### 4.3 降级路径

| 关键 Skill 失败 | 降级到 |
|--------------|-------|
| huashu-research | huashu-info-search |
| kai-gate | huashu-proofreading |
| khazix-writer | ljg-writes |
| kai-topical-map | content-strategy |
| hv-analysis | ljg-rank |

**致命失败定义**：
- 3 个以上 Skill 失败 → 人工介入（Human Action Task）
- 1 个关键 Skill 失败 → 最多重试 2 次，仍失败则降级

---

## 五、知识更新机制

### 5.1 触发条件（五类）

```
触发1: /workspace/risen-agent6/knowledge/ 目录文件发生变化（新增/修改）
触发2: Agent 2 的 Promotion Passport / Brand Policy / Claim List 更新
触发3: Agent 3 的 ICP / Persona / Customer Problem Map 更新
触发4: Agent 1 新建 Campaign 或改变目标
触发5: 用户在对话框中主动上传资料（★重点补充）
```

### 5.2 触发5：用户对话中上传资料（★新增）

**场景描述：**
用户在与 Agent 6 的对话中直接上传了文档或描述了新资料，Agent 6 需要主动判断是否应该更新知识库。

**Agent 6 必须做到的事情：**

**Step 1: 检测上传内容**
- 用户上传了新文档 → 立即解析，提取关键信息点
- 用户描述了新能力/产品变更 → 记录变更内容

**Step 2: 判断用户意图（三情况）**

**情况A：用户明确说了要更新什么**
```
用户："帮我把这个产品文档更新到知识库，关于JovaAI新发布的功能"
→ 直接按用户说的执行
→ 更新 capability-cards.json 中对应条目
→ 记录版本变更到 _index.json
→ 向用户确认："已更新产品能力，新增：JovaAI XX功能"
```

**情况B：用户没说清楚要更新什么（★关键）**
```
用户：[上传了一份文档]
或者：用户说了产品有了新变化，但没具体说是什么

→ Agent 6 主动分析文档内容
→ 提取：哪些能力点有变化？新增/修改/删除？
→ 向用户提问确认（必须）：
  "我看到这份文档涉及[具体内容]，请问：
  1. 这是要【新增】到知识库吗？
  2. 还是要【替换】现有的[XX]能力描述？
  3. 还是要【删除】[XX]？
  请告诉我您的意图，我来执行对应的操作。"

→ 用户确认前，不做任何写入操作
→ 用户确认后，执行对应操作并记录版本
```

**情况C：用户提到产品/公司发生变化，但没有上传文档**
```
用户："我们的产品最近更新了很多"
→ Agent 6 主动追问：
  "产品有更新太好了！能否提供最新的产品介绍文档？
  或者您可以直接描述一下主要的变化，
  我来帮您整理成能力卡片更新到知识库。"
```

**Step 3: 更新后通知**
- 知识库更新完成后，通知相关 Agent（Agent 7 知晓内容已更新）
- 影响评估：哪些现有内容可能受影响？

### 5.3 触发2/3：Agent 6 主动从底层架构抓取（★新增）

**Agent 6 不只是被动等待，还主动从底层架构抓取最新资料：**

```
Agent 6 启动时，或收到 Agent 2/3 事件通知时：

Step 1: 检查 Agent 2 最新输出
├── Promotion Passport → 更新 knowledge/company/promotion-passport.json
├── Brand Policy → 更新 knowledge/company/brand-policy.json
├── Claim List → 更新 knowledge/company/claim-list.json
├── Product Profile → 更新 knowledge/product/product-profile.json
└── Evidence Graph → 更新 knowledge/company/evidence-graph.json

Step 2: 检查 Agent 3 最新输出
├── ICP → 更新 knowledge/market/icp.json
├── Persona → 更新 knowledge/market/personas.json
└── Customer Problem Map → 更新 knowledge/market/customer-problem-map.json

Step 3: 对比 _index.json 版本
├── 如有变化 → 增量更新 capability-cards.json
└── 如无变化 → 记录 last_checked_at，跳过

Step 4: 分析可用增长亮点（★核心能力）
├── 从 Product Profile 提取：可用于植入的能力点
├── 从 Claim List 提取：已验证的对外能力声明
├── 从 Evidence Graph 提取：可引用的证据
└── 生成新的 capability-cards（如有新增亮点）
```

### 5.4 触发4：Agent 1 Campaign 变更

```
收到 campaign.updated 事件：
→ 更新 knowledge/campaign/current-campaign.json
→ 重新评估 capability cards 优先级
→ 通知 Skill Selector（高优先级能力优先匹配）
```

### 5.5 触发1：knowledge/ 目录文件变化

```
chokidar 监听目录：
├── 新增文件 → 立即解析，提取能力点
├── 文件修改 → 对比旧版本，判断 diff > 20% 则触发更新
└── 文件删除 → 从 capability-cards.json 移除对应条目
```

### 5.6 主动抓取流程图

```
Agent 6 启动
    │
    ▼
检查 Agent 2 最新输出 ──→ 有变化？ ──→ 是 ──→ 更新 company/
    │                                        │
    │ 否                                      ▼
    ▼                                   更新 capability-cards.json
检查 Agent 3 最新输出 ──→ 有变化？ ──→ 是 ──→ 更新 market/
    │                                        │
    │ 否                                      ▼
    ▼                                   重新评估能力优先级
检查 knowledge/docs/ ──→ 有新增/修改？ ──→ 是 ──→ 解析并更新
    │
    ▼
通知 Skill Selector（能力已更新）
```

### 5.7 目录结构

```
knowledge/
├── _index.json              # 知识索引（含版本、时间戳、摘要）
├── company/                  # 公司信息（来自 Agent 2）
│   ├── promotion-passport.json
│   ├── brand-policy.json
│   ├── claim-list.json
│   └── evidence-graph.json
├── product/                  # 产品信息（来自 Agent 2）
│   ├── product-profile.json
│   └── capability-cards.json   # 可用于植入的产品能力点
├── market/                   # 市场信息（来自 Agent 3）
│   ├── icp.json
│   ├── personas.json
│   └── customer-problem-map.json
├── campaign/                 # 当前 Campaign 上下文（来自 Agent 1）
│   └── current-campaign.json
└── docs/                    # 原始文档（人工上传）
    ├── 战略手册.md
    ├── 产品介绍.md
    └── ...
```

### 5.3 知识索引格式（_index.json）

```json
{
  "version": "20260618-v3",
  "last_updated": "2026-06-18T06:40:00Z",
  "sources": {
    "promotion-passport": { "version": "v2", "source": "agent2", "updated_at": "..." },
    "brand-policy": { "version": "v1", "source": "agent2", "updated_at": "..." },
    "product-profile": { "version": "v3", "source": "agent2", "updated_at": "..." },
    "knowledge-docs": { "version": "v1", "source": "workspace/knowledge/", "updated_at": "..." }
  },
  "capability_cards": [
    {
      "id": "ICB-6000-tools",
      "headline": "全球首个跨产业实时交易算法 ICB",
      "applicable_topics": ["企业AI落地", "产业智能化", "AI工具选型"],
      "insertion_type": "soft",
      "evidence_ref": "evidence-graph/ICB-001"
    },
    {
      "id": "五层架构-OS",
      "headline": "JovaAI OS 产业级 Agentic OS 底座",
      "applicable_topics": ["AI平台选型", "企业AI架构", "多智能体"],
      "insertion_type": "soft",
      "evidence_ref": "evidence-graph/OS-001"
    }
  ]
}
```

### 5.9 更新触发阈值

```
保守策略：
  新增文件 → 立即更新 capability cards
  文件修改 > 20% 内容差异 → 触发更新
  文件修改 < 20% → 仅记录版本号，跳过重新解析
```

---

## 六、输入与输出规格

### 6.1 输入（Agent 5 → Agent 6）

```json
{
  "topic_brief": {
    "topic_id": "TOPIC-001",
    "brief_id": "BRIEF-XXXXX",
    "direction_angle": "GPT-5 发布引发的企业 AI 应用趋势",
    "search_intent": { ... },
    "platform_recommendation": ["知乎", "公众号", "百家号"],
    "required_evidence": ["GPT-5 技术规格", "企业 AI 落地案例"],
    "core_claims": [
      { "statement": "...", "evidence_level": "high" }
    ]
  },
  "strategy_card": {
    "narrative": { "main_axis": "..." },
    "brand_policy": { ... },
    "channel_mix": [ ... ]
  }
}
```

### 6.2 输出（Agent 6 → Agent 7）

```json
{
  "master_article": {
    "article_id": "MA-XXXXX",
    "topic_id": "TOPIC-001",
    "title": "GPT-5 来了，企业 AI 落地怎么走？",
    "seo_framework": {
      "primary_keywords": ["GPT-5", "企业AI", "AI落地"],
      "secondary_keywords": ["产业智能化", "AI Agent"],
      "geo_keywords": ["AI平台选型", "企业AI架构"]
    },
    "content_structure": {
      "hook": "GPT-5 发布引发现状分析",
      "body": "企业AI落地路径 + JovaAI能力融入",
      "cta": "预约 JovaAI 演示"
    },
    "insertion_strategy": "soft | hard | minimal",
    "insertion_points": [
      { "position": "P2", "text": "提到JovaAI五层架构", "type": "soft" },
      { "position": "P5", "text": "ICB能力深度展开", "type": "hard" }
    ],
    "evidence_references": [...],
    "platform_hint": ["知乎", "公众号"]
  },
  "evidence_pack": { ... },
  "capability_cards_used": ["ICB-6000-tools", "五层架构-OS"]
}
```

---

## 七、与 Agent 4/5 的边界对比

| 边界点 | Agent 5 | Agent 6 | 说明 |
|-------|---------|---------|------|
| 资源采集 | 浅层（演示级）| 深层（含权威评分）| Agent 6 扩展 Agent 5 采集，增加来源评估层 |
| Topic Brief | 轻量证据版 | 强化版 Evidence Pack | 递进关系，非重复 |
| Narrative | 叙事框架 | 母文章生成 | 无重合，各司其职 |
| 选题-公司匹配 | 无 | 有 | Agent 6 独有 |
| 软/硬植入 | 无 | 有 | Agent 6 独有 |

**真正的风险点：数据流断连**
- Agent 5 产出的 `core_claims` 需要能流向 Agent 6
- Agent 6 的 Evidence Pack 需要能写回 Topic Brief（反馈回路）

---

## 八、潜在问题与缓解方案

| 问题 | 风险等级 | 缓解方案 |
|------|---------|---------|
| 多 Skill 并发生成风格不一致 | 中 | 主笔 + 辅笔模式，最终统一审校 |
| Skill 池膨胀失控 | 低 | 季度清理，未使用 6 个月标记 Deprecated |
| Knowledge 更新无边界 | 中 | 20% 阈值触发，面积化更新 |
| Skill 失败蔓延 | 中 | 每层独立降级路径，最多 2 次重试 |
| 多标签冲突 | 低 | 优先级硬编码：goal > channel > topic_type |
| Content 版本生命周期 | 低 | Agent 9 反馈触发更新评估 |
| 仲裁决策瘫痪 | 低 | 多 Skill 输出全部保留，human review 兜底 |

---

## 九、必须自研的 Skills（不可外采）

| 自研 Skill | 原因 |
|-----------|------|
| knowledge-base-reader | 必须理解公司私有文档结构，外采无法读内部资料 |
| capability-index-builder | 从公司文档自动构建能力索引，动态知识更新 |
| topic-capability-matcher | 匹配的是公司私有能力资产，核心差异竞争力 |
| insertion-strategy-decider | 软/硬植入判断，自主决策，核心差异竞争力 |

---

## 十、建议引入的外部 Skills（kai-cmo-harness）

| Skill | 优先级 | 用途 |
|-------|-------|------|
| kai-gate | P0 | Four U's 质量门，可复用进任何写作流程 |
| kai-topical-map | P0 | AEO/GEO 主题地图，QDP/QDH/QDS 框架 |
| kai-seo-audit | P1 | 技术 SEO 全面审计 |
| kai-repurpose | P1 | 内容乘法（1→25 渠道原生版本）|
| kai-growth-hacker | P2 | 增长渠道操作系统 |
| kai-email-system | P2 | 邮件序列生成 |

---

## 十一、完整 Skill 池总表

| 层级 | Skill | 来源 | 优先级 |
|------|-------|------|-------|
| Knowledge | knowledge-base-reader | **自研 P0** | 核心 |
| | capability-index-builder | **自研 P0** | 核心 |
| | knowledge-sync.js | **自研** | 核心 |
| Discovery | huashu-research | 现成 | P1 |
| | huashu-info-search | 现成 | P1 |
| | web-scraping | 现成 | 底层 |
| | ljg-paper / ljg-paper-river | 现成 | P2 |
| | aihot | 现成 | 快速信号 |
| | tech-news-digest | 现成 | 快速信号 |
| | follow-builders | 现成 | KOL |
| Matching | topic-capability-matcher | **自研 P0** | 核心 |
| Strategy | insertion-strategy-decider | **自研 P0** | 核心 |
| | hv-analysis | 现成改装 | P1 |
| | ljg-rank | 现成 | P2 |
| Writing | Skill Selector | **自研 P0** | 核心 |
| | khazix-writer | 现成 | 主笔 |
| | huashu-wechat-creation | 现成 | 主笔 |
| | kai-write | kai-cmo 引入 | 主笔 |
| | ljg-writes | 现成 | 辅笔 |
| | ljg-think | 现成 | 辅笔 |
| | hv-analysis | 现成 | 辅笔 |
| SEO/GEO | kai-topical-map | kai-cmo 引入 P0 | 核心 |
| | kai-seo-audit | kai-cmo 引入 P1 | P1 |
| | kai-repurpose | kai-cmo 引入 P1 | P1 |
| | content-strategy | 现成改装 | P2 |
| Validation | kai-gate | kai-cmo 引入 P0 | 核心 |
| | huashu-proofreading | 现成 | P1 |
| | huashu-article-edit | 现成 | P1 |

---

## 十二、版本记录

| 版本 | 日期 | 主要内容 |
|------|------|---------|
| V1.0 | 2026-06-18 | 初版归档。包含：核心设计原则、Skill 池全景图、Selector 架构、知识更新机制、输入输出规格、边界对比、风险分析、自研 Skills 清单 |

---

*本文档为 Agent 6 能力架构深度分析的完整归档版本。*
*看完本文档即可理解 Agent 6 的完整能力边界、Skill 池架构、决策逻辑，无需查阅其他文档。*
