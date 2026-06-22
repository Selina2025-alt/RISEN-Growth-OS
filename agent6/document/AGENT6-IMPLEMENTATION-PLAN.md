# Agent 6 技术规格文档（V6.3）
## 版本：V6.3 | 日期：2026-06-18 | 状态：已归档

---

## 一、概述

Agent 6 是 RISEN Growth OS 内容生产链路中的**内容生成层**。它的职责是：

1. 接收 Agent 5 的选题（Topic Brief）和 Agent 4 的叙事上下文（Strategy Context）
2. 结合该公司/产品的知识库（Knowledge Base），判断选题与能力的匹配程度
3. 决定软植入（Soft）、硬植入（Hard）或最小植入（Minimal）
4. 生成完整的 Master Article 输出

**设计原则：**
- 通用平台：Skill 代码不得包含任何公司名、产品名、行业专有名词
- 关键词不自创：所有关键词必须来自外部（Agent 5 / Agent 2 / 用户），Agent 6 只消费和增强
- 失败有兜底：每个环节都有降级路径，不因单点故障导致整条链路中断

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────┐
│                    Agent 6 Pipeline                  │
│                                                      │
│  [Agent5] ──→ [P0.1] ──→ [P0.2] ──→ [P0.3]      │
│   Topic                   Knowledge    Match        │
│   Brief                   Reader       Engine       │
│                           ↓                          │
│                    [P0.4] ──→ [P0.5] ──→ [Output] │
│                    Strategy   khazix-   Master      │
│                    Decider    writer    Article     │
│                           ↓           ↓            │
│  [Agent4] ─────────── [P1.1] ◄──┘                │
│  Strategy                        kai-gate           │
│  Context                        Quality Gate        │
│                                                      │
│  [Knowledge/] ◄──── [P1.3]                         │
│   Base             capability-index-builder         │
│                                                      │
│  [User] ◄──────── [P2.2]                           │
│   Upload          knowledge-update-handler          │
└─────────────────────────────────────────────────────┘
```

---

## 三、环境变量（必须配置）

Agent 6 启动前必须配置以下环境变量：

```bash
# 必须：当前公司名称（Agent 6 根据此值做占位符替换）
COMPANY_NAME=

# 可选：LLM 模型（不填则使用 Jova 内置默认模型）
LLM_MODEL=claude-3-5-sonnet-20241022

# 可选：最大并发任务数（默认3）
MAX_CONCURRENT=3

# 可选：Token 预算上限（默认8000）
MAX_TOKENS=8000
```

**启动检查：** 如果 `COMPANY_NAME` 未设置，Agent 6 拒绝启动并抛出错误。

---

## 四、数据结构

### 4.1 Topic Brief（来自 Agent 5）

```typescript
interface TopicBrief {
  topic_id: string;
  topic_title: string;
  content_type: 'news' | 'analysis' | 'case_study' | 'tutorial';
  directions: Array<{
    direction_id: string;
    angle: string;
    content_forms: string[];  // ['article', 'short_video', 'infographic']
  }>;
  search_intent: {
    primary: string[];     // 核心关键词（来自 Agent5）
    secondary: string[];  // 次要关键词（来自 Agent5）
    geo: string[];        // 地理关键词（来自 Agent5）
    intent_type: 'informational' | 'navigational' | 'transactional' | 'commercial';
  };
  source_signals: Array<{
    source: string;
    signal_text: string;
    collected_at: string;
  }>;
  evidence_score: number;  // 0-100，证据强度
}
```

> **兜底规则：** 如果 `search_intent` 字段缺失或为空，全部子字段默认为空数组，`intent_type` 默认为 `'informational'`。

### 4.2 CapabilityCard（知识库卡片）

```typescript
interface CapabilityCard {
  id: string;                    // 格式：KB-{8位hash}
  headline: string;              // 能力简述（不含公司名）
  source_file: string;           // 来源文件名
  applicable_topics: string[];   // 适用选题方向
  insertion_type: 'soft' | 'hard' | 'minimal';
  confidence: number;            // 0.0-1.0
  capability_signals: Array<{
    pattern: string;             // 正则表达式（字符串形式存储）
    confidence: number;
    strength: 'strong' | 'medium';
  }>;
  created_at: string;            // ISO 8601
  updated_at: string;           // ISO 8601
}
```

### 4.3 MatchReport（P0.3 输出）

```typescript
interface MatchReport {
  topic_id: string;
  insertion_type: 'soft' | 'hard' | 'minimal';
  keywords: {
    primary: string[];
    secondary: string[];
    geo: string[];
  };
  stage1_signal_count: number;   // Stage1 降噪后信号数
  stage2_result_count: number;  // Stage2 LLM 提炼后结果数
  used_stage2: boolean;         // 是否使用了 Stage2
  top_matches: Array<{
    id: string;
    headline: string;
    match_score: number;         // 0.0-1.0
    insertion_type: 'soft' | 'hard' | 'minimal';
    evidence_count: number;      // strong 信号数量
  }>;
  reasoning: string;            // 判断说明
}
```

### 4.4 InsertionStrategy（P0.4 输出）

```typescript
interface InsertionStrategy {
  strategy: 'soft' | 'hard' | 'minimal';
  insertion_points: Array<{
    position: string;           // 格式：P{20|40|60|80}，表示全文20%/40%/60%/80%分位
    description: string;        // 植入内容描述（含 [COMPANY_NAME] 占位符）
    type: 'soft' | 'hard';
    capability_id: string;
    rationale: string;
  }>;
  seo_keywords: {
    primary: string[];
    secondary: string[];
    geo: string[];
    capability_based: string[]; // 已完成占位符替换
    intent_type: string;
  };
  cta: string;                  // 含 [COMPANY_NAME] 占位符
}
```

### 4.5 MasterArticle（P0.5 输出）

```typescript
interface MasterArticle {
  article_id: string;           // 格式：MA-{timestamp}-{random}
  topic_id: string;
  content: string;              // 文章正文
  insertion_strategy: InsertionStrategy;
  match_report: MatchReport;
  content_structure: {
    hook: string;               // 开头钩子（吸引用户停留）
    body: string;               // 主体内容方向（含 [COMPANY_NAME] 占位符）
    cta: string;                // 行动号召（含 [COMPANY_NAME] 占位符）
  };
  evidence_references: Array<{
    capability_id: string;
    evidence_text: string;
    source_file: string;
  }>;
  capability_cards_used: string[]; // 本次引用了哪些 capability cards
  quality_check: {
    pass: boolean;
    reasons: string[];
  };
  generated_at: string;         // ISO 8601
}
```

---

## 五、Pipeline 主入口（agent6-core.js）

```javascript
// agent6-core.js

const PipelineQueue = require('./lib/pipeline-queue');
const { scanKnowledgeDir } = require('./skills/knowledge-base-reader');
const { matchTopicToCapabilities } = require('./skills/topic-capability-matcher');
const { decideInsertionStrategy } = require('./skills/insertion-strategy-decider');
const { runSkill } = require('./lib/skill-runner');
const { qualityGate } = require('./skills/kai-gate');
const { generateId } = require('./lib/id-generator');
const TokenBudget = require('./lib/token-budget');

async function runAgent6({ topicBrief, strategyContext }) {
  // === 0. 启动时同步（修复遗漏C: Agent2/3拉取入口）===
  const { buildCapabilityIndex } = require('./skills/capability-index-builder');
  await buildCapabilityIndex({ source: 'agent2' });
  await buildCapabilityIndex({ source: 'agent3' });

  // === 1. 启动检查 ===
  const companyName = process.env.COMPANY_NAME;
  if (!companyName) {
    throw new Error('COMPANY_NAME 环境变量未设置，Agent 6 无法启动');
  }

  // === 2. Token 预算控制 ===
  const tokenBudget = new TokenBudget({ maxTokens: parseInt(process.env.MAX_TOKENS || '8000') });
  tokenBudget.track('input', topicBrief);

  // === 3. SearchIntentMap 兜底（确保字段不缺失） ===
  topicBrief.search_intent = topicBrief.search_intent || {
    primary: [], secondary: [], geo: [], intent_type: 'informational'
  };

  // === 4. 读取知识库 ===
  const { capabilityCards } = await scanKnowledgeDir();

  // === 5. 选题-能力匹配（两阶段+质量门） ===
  const matchReport = matchTopicToCapabilities(topicBrief, capabilityCards);
  tokenBudget.track('match', matchReport);

  // === 6. 植入策略决策 ===
  const insertionStrategy = decideInsertionStrategy(topicBrief, matchReport, companyName);
  tokenBudget.track('strategy', insertionStrategy);

  // === 7. 生成母文章 ===
  const article = await runSkill('khazix-writer', {
    topicBrief,
    insertionStrategy,
    strategyContext,
    companyName
  });

  tokenBudget.track('output', article);

  // === 8. 构建 content_structure ===
  const contentStructure = buildContentStructure(topicBrief, insertionStrategy, companyName);

  // === 9. 收集 evidence_references ===
  const evidenceReferences = matchReport.top_matches.map(m => {
    const card = capabilityCards.find(c => c.id === m.id);
    return {
      capability_id: m.id,
      evidence_text: card?.headline || m.headline,
      source_file: card?.source_file || 'unknown'
    };
  });

  // === 10. 质量门验收 ===
  const quality = qualityGate(article);

  // === 11. 组装输出 ===
  return {
    article_id: generateId(),
    topic_id: topicBrief.topic_id,
    content: article,
    insertion_strategy: insertionStrategy,
    match_report: matchReport,
    content_structure: contentStructure,
    evidence_references: evidenceReferences,
    capability_cards_used: matchReport.top_matches.map(m => m.id),
    quality_check: quality,
    generated_at: new Date().toISOString()
  };
}

function buildContentStructure(topicBrief, insertionStrategy, companyName) {
  const topicTitle = topicBrief.topic_title || '';
  const primaryKw = (topicBrief.search_intent?.primary || [])[0] || '';
  return {
    hook: `${primaryKw}正在改变什么，这场变革和你想的不一样`,
    body: `围绕「${primaryKw}」展开，结合${companyName}的真实能力，提供可操作的洞察和路径`,
    cta: `预约${companyName}演示`
  };
}

module.exports = { runAgent6 };
```

---

## 六、P0.2：knowledge-base-reader

### 6.1 能力信号模式（CAPABILITY_SIGNALS）

**设计原则：只写通用模式，不写任何公司名或产品名。**

```javascript
// skills/knowledge-base-reader.js

const CAPABILITY_SIGNALS = [
  // 强信号：明确的能力声明（confidence = 0.8）
  {
    pattern: /[可以能够可]实现[^\s]{0,6}(自动化|优化|诊断|生成)/,
    confidence: 0.8,
    strength: 'strong'
  },
  {
    pattern: /[^\s]{0,4}(平台|系统|引擎|工具)支持[^\s]{0,8}(多|全|实时)/,
    confidence: 0.8,
    strength: 'strong'
  },
  {
    pattern: /[^\s]{0,4}(智能|AI|自动化)[^\s]{0,6}(能力|功能|特性)/,
    confidence: 0.8,
    strength: 'strong'
  },
  // 弱信号：可能的能力声明（confidence = 0.5）
  {
    pattern: /基于[^\s]{0,6}(大模型|知识图谱|向量)/,
    confidence: 0.5,
    strength: 'medium'
  },
  {
    pattern: /[^\s]{0,4}(AI|智能|数字)化[^\s]{0,4}(转型|升级|落地)/,
    confidence: 0.5,
    strength: 'medium'
  }
];
```

### 6.2 两阶段提取 + 质量门

```javascript
// skills/knowledge-base-reader.js（续）

const { llmCall } = require('../../lib/llm-call');

async function scanKnowledgeDir({ forceRefresh = false } = {}) {
  const indexPath = './knowledge/_index.json';
  const index = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    : { version: 0, cards: [] };

  if (!forceRefresh && index.cards.length > 0) {
    return { capabilityCards: index.cards, index };
  }

  // 扫描 knowledge/docs/ 目录
  const docs = glob.sync('./knowledge/docs/**/*.md');
  const allCards = [];

  for (const docPath of docs) {
    const content = fs.readFileSync(docPath, 'utf8');
    const filename = path.basename(docPath);
    const cards = await extractCapabilityCards(content, filename);
    allCards.push(...cards);
  }

  // 去重
  const seen = new Set();
  const deduped = allCards.filter(card => {
    if (seen.has(card.headline)) return false;
    seen.add(card.headline);
    return true;
  });

  // 写索引
  const newIndex = { version: index.version + 1, cards: deduped };
  writeJsonAtomic(indexPath, newIndex);

  return { capabilityCards: deduped, index: newIndex };
}

async function extractCapabilityCards(content, filename) {
  // === Stage1：规则匹配（只做降噪，不作为唯一依据）===
  const stage1Signals = CAPABILITY_SIGNALS
    .filter(s => s.pattern.test(content))
    .map(s => ({
      headline: extractMatchedPhrase(content, s.pattern),
      confidence: s.confidence,
      strength: s.strength,
      source_file: filename
    }));

  // Stage1 质量门：少于 3 条信号则跳过 Stage2，直接返回
  if (stage1Signals.length < 3) {
    return stage1Signals.map(s => buildCard(s, filename));
  }

  // === Stage2：LLM 提炼（真正的语义判断）===
  const enriched = await llmCall({
    prompt: `从以下候选信号中，保留真正表达产品能力的条目，移除噪音和泛化描述。输出 JSON 数组：\n${JSON.stringify(stage1Signals)}`,
    fallback: () => stage1Signals.filter(s => s.strength === 'strong')
  });

  let parsed = [];
  try {
    parsed = JSON.parse(enriched);
  } catch {
    // LLM 输出格式错误，降级
    parsed = stage1Signals.filter(s => s.strength === 'strong');
  }

  // Stage2 质量门：LLM 输出少于 1 条则保留 Stage1
  if (parsed.length < 1) {
    return stage1Signals.map(s => buildCard(s, filename));
  }

  const merged = mergeAndDedupe(stage1Signals, parsed);
  return merged.map(s => buildCard(s, filename));
}

function extractMatchedPhrase(content, pattern) {
  const match = content.match(pattern);
  if (!match) return null;
  const idx = content.indexOf(match[0]);
  const start = Math.max(0, idx - 20);
  const end = Math.min(content.length, idx + match[0].length + 20);
  return content.slice(start, end).replace(/\n/g, ' ').trim();
}

function mergeAndDedupe(stage1, stage2) {
  const seen = new Set();
  const result = [];
  // stage2 优先（LLM 结果更可靠）
  for (const item of stage2) {
    if (!seen.has(item.headline)) {
      seen.add(item.headline);
      result.push(item);
    }
  }
  for (const item of stage1) {
    if (!seen.has(item.headline)) {
      seen.add(item.headline);
      result.push(item);
    }
  }
  return result;
}

function buildCard(signal, filename) {
  return {
    id: `KB-${hashString(signal.headline + filename)}`,
    headline: signal.headline,
    source_file: filename,
    applicable_topics: inferTopics(signal.headline),
    insertion_type: signal.strength === 'strong' ? 'hard' : 'soft',
    confidence: signal.confidence,
    capability_signals: [signal],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function inferTopics(headline) {
  const topics = [];
  if (/智能|AI|自动化/.test(headline)) topics.push('AI落地');
  if (/平台|系统/.test(headline)) topics.push('平台架构');
  if (/优化|诊断/.test(headline)) topics.push('效率提升');
  return topics.length > 0 ? topics : ['通用能力'];
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}
```

---

## 七、P0.3：topic-capability-matcher

### 7.1 核心匹配逻辑

```javascript
// skills/topic-capability-matcher.js

const { llmCall } = require('../../lib/llm-call');

function matchTopicToCapabilities(topicBrief, capabilityCards) {
  const keywords = [
    ...(topicBrief.search_intent?.primary || []),
    ...(topicBrief.search_intent?.secondary || [])
  ];

  // intent_type → isHotTopic 映射
  const isHotTopic = mapIntentToHotTopic(topicBrief.search_intent?.intent_type);

  // 对每张卡片计算匹配分
  const scored = capabilityCards.map(card => {
    const text = [card.headline, ...(card.applicable_topics || [])].join(' ');
    const matchScore = calculateSimilarity(keywords, text);
    const evidenceCount = card.capability_signals
      ? card.capability_signals.filter(s => s.strength === 'strong').length
      : 0;

    return {
      ...card,
      match_score: matchScore,
      evidence_count: evidenceCount
    };
  });

  // 排序取 Top-N
  scored.sort((a, b) => b.match_score - a.match_score);
  const topMatches = scored.slice(0, 10);

  // 判断插入类型
  const bestMatch = topMatches[0];
  let insertion_type = 'minimal';

  if (bestMatch && bestMatch.match_score >= 0.5) {
    if (bestMatch.match_score >= 0.5 && bestMatch.evidence_count >= 3) {
      insertion_type = 'hard';
    } else if (bestMatch.match_score >= 0.3 && isHotTopic) {
      insertion_type = 'soft';
    } else if (bestMatch.match_score >= 0.5) {
      insertion_type = 'hard';
    }
  }

  return {
    topic_id: topicBrief.topic_id,
    insertion_type,
    keywords: {
      primary: topicBrief.search_intent?.primary || [],
      secondary: topicBrief.search_intent?.secondary || [],
      geo: topicBrief.search_intent?.geo || []
    },
    stage1_signal_count: topMatches.length,
    stage2_result_count: topMatches.filter(m => m.evidence_count > 0).length,
    used_stage2: topMatches.some(m => m.evidence_count > 0),
    top_matches: topMatches.map(m => ({
      id: m.id,
      headline: m.headline,
      match_score: m.match_score,
      insertion_type: m.insertion_type,
      evidence_count: m.evidence_count
    })),
    reasoning: buildReasoning(insertion_type, bestMatch, isHotTopic)
  };
}

function mapIntentToHotTopic(intentType) {
  const MAP = {
    'informational': false,
    'navigational': false,
    'transactional': true,
    'commercial': true
  };
  return MAP[intentType] ?? false;
}

// TF-IDF 兜底：不依赖外部 embedding 服务
function calculateSimilarity(keywords, text) {
  if (keywords.length === 0) return 0;
  const textWords = (text.match(/[\w]{2,}/g) || []).map(w => w.toLowerCase());
  const kwLower = keywords.map(k => k.toLowerCase());
  const intersection = kwLower.filter(kw =>
    textWords.some(w => w.includes(kw) || kw.includes(w))
  );
  return intersection.length / kwLower.length;
}

function buildReasoning(type, bestMatch, isHotTopic) {
  if (!bestMatch) return '无匹配卡片 → minimal';
  return `${type}: matchScore=${bestMatch.match_score.toFixed(2)}, evidence=${bestMatch.evidence_count}, isHotTopic=${isHotTopic}`;
}
```

---

## 八、P0.4：insertion-strategy-decider

```javascript
// skills/insertion-strategy-decider.js

function decideInsertionStrategy(topicBrief, matchReport, companyName) {
  const { top_matches, insertion_type } = matchReport;

  // 计算全文分位点（20%/40%/60%/80%）
  const positions = ['P20', 'P40', 'P60', 'P80'];

  // 生成植入点位
  const insertion_points = top_matches.slice(0, 4).map((match, i) => ({
    position: positions[i] || 'P80',
    description: match.headline,
    type: match.insertion_type,
    capability_id: match.id,
    rationale: `匹配度${(match.match_score * 100).toFixed(0)}%，${match.evidence_count}条强证据`
  }));

  // SEO 关键词：全部来自外部，不自行生成
  // headline 中的 [COMPANY_NAME] 占位符替换为真实公司名
  const capabilityBased = top_matches
    .slice(0, 5)
    .map(c => c.headline.replace(/\[COMPANY_NAME\]/g, companyName));

  const cta = `预约${companyName}演示`;

  return {
    strategy: insertion_type,
    insertion_points,
    seo_keywords: {
      primary: topicBrief.search_intent?.primary || [],
      secondary: topicBrief.search_intent?.secondary || [],
      geo: (topicBrief.search_intent?.geo || []).concat(matchReport.keywords.geo || []),
      capability_based: capabilityBased,
      intent_type: topicBrief.search_intent?.intent_type || 'informational'
    },
    cta
  };
}
```

---

## 九、P1.1：kai-gate（质量门）

### 9.1 Four U's 质量检查

```javascript
// skills/kai-gate.js

function qualityGate(article) {
  const reasons = [];

  if (!article.content || article.content.length < 500) {
    reasons.push('内容过短（<500字）');
  }

  if (article.content.length > 50000) {
    reasons.push('内容过长（>50000字）');
  }

  // 占位符残留检查
  const PLACEHOLDERS = ['[COMPANY_NAME]', '{{COMPANY}}', '{{BRAND}}'];
  PLACEHOLDERS.forEach(p => {
    if (article.content.includes(p)) {
      reasons.push(`残留占位符: ${p}`);
    }
  });

  // 公司名合规（生产环境）
  const companyName = process.env.COMPANY_NAME;
  if (!companyName) {
    reasons.push('COMPANY_NAME 环境变量未设置');
  }

  return {
    pass: reasons.length === 0,
    reasons
  };
}
```

### 9.2 Skill 代码合规检查（CI 阶段）

```javascript
// skills/validate-skill.js（独立工具，CI 时调用）

const SKILL_DIR = './skills';
const FORBIDDEN_NAMES = ['JovaAI', 'ICB', '艾氪', 'Jova', '艾氪智能', 'Agent5', 'Agent4'];

function validateSkillCode(skillPath) {
  const content = fs.readFileSync(skillPath, 'utf8');
  const violations = FORBIDDEN_NAMES.filter(name => content.includes(name));
  if (violations.length > 0) {
    console.error(`[VALIDATION FAILED] ${skillPath}: 含公司名称 ${violations.join(', ')}`);
    process.exit(1);
  }
  console.log(`[VALIDATION PASSED] ${skillPath}`);
}
```

---

## 十、P1.2：skill-selector（主笔+辅笔模式 + 致命失败阈值）

```javascript
// skills/skill-selector.js

const yaml = require('js-yaml');
const fs = require('fs');

// === per-Skill fallback 映射表（V1 原文恢复）===
const SKILL_FALLBACKS = {
  'huashu-research': 'huashu-info-search',
  'kai-gate': 'huashu-proofreading',
  'khazix-writer': 'ljg-writes',
  'kai-topical-map': 'content-strategy',
  'hv-analysis': 'ljg-rank',
  'ljg-writes': 'khazix-writer',
  'ljg-think': 'hv-analysis',
  'ljg-rank': 'hv-analysis',
  'huashu-proofreading': 'kai-gate',
};

// === 主笔 + 辅笔 路由表 ===
// 每个 entry: { 主笔, 辅笔列表, 适用条件 }
const WRITING_MODES = [
  {
    mode: 'deep_long_form',
    conditions: { topic_type: ['analysis', 'case_study', 'tutorial'], channel: ['wechat_gzh', 'blog'] },
    primary: 'khazix-writer',
    aux: ['hv-analysis', 'ljg-think']
  },
  {
    mode: 'quick_social',
    conditions: { topic_type: ['news', 'short_form'], channel: ['xiaohongshu', 'video', 'wechat_gzh'] },
    primary: 'huashu-douyin-script',
    aux: ['ljg-card']
  },
  {
    mode: 'technical',
    conditions: { topic_type: ['analysis'], channel: ['zhihu', 'blog'] },
    primary: 'ljg-writes',
    aux: ['hv-analysis', 'ljg-rank']
  },
  {
    mode: 'marketing',
    conditions: { goal: ['conversion', 'lead_gen'] },
    primary: 'kai-write',
    aux: ['kai-topical-map']
  },
];

// === 主入口 ===
async function selectWritingSkills({ goal, channel, topic_type, topicBrief, insertionStrategy }) {
  const mode = matchWritingMode({ goal, channel, topic_type });
  const primary = mode?.primary || 'khazix-writer';
  const aux = mode?.aux || [];

  // 并发执行主笔 + 辅笔
  const allSkills = [primary, ...aux];
  const results = await Promise.allSettled(
    allSkills.map(skill => runSkillWithTimeout(skill, { topicBrief, insertionStrategy, goal, channel }, 30000))
  );

  const success = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed = results.filter(r => r.status === 'rejected');

  // === 致命失败：3个以上 Skill 失败 → 抛异常，触发人工介入 ===
  if (failed.length >= 3) {
    throw new HumanActionRequiredError(
      `3个以上Skill失败: ${failed.map(r => r.reason?.skillName).join(', ')}，请人工介入`
    );
  }

  // === 1个关键Skill失败 → 最多重试2次 ===
  if (success.length === 0) {
    // 所有都失败了，按 fallback 映射表重试
    const retrySkills = allSkills.map(s => SKILL_FALLBACKS[s]).filter(Boolean);
    const retryResults = await Promise.allSettled(
      retrySkills.map(skill => runSkillWithTimeout(skill, { topicBrief, insertionStrategy }, 20000))
    );
    const retrySuccess = retryResults.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (retrySuccess.length > 0) {
      return { primary: retrySkills[0], content: retrySuccess[0], aux: [] };
    }
    // 彻底失败 → 降级到 khazix-writer
    return { primary: 'khazix-writer', content: null, aux: [], fatalFailure: true };
  }

  // === 多 Skill 输出：主笔胜出，辅笔结果保留供评审 ===
  return {
    primary,
    content: success[0],
    aux: success.slice(1).map((c, i) => ({ skill: aux[i], content: c })),
    fatalFailure: false
  };
}

// === 致命失败异常（触发人工介入）===
class HumanActionRequiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HumanActionRequiredError';
  }
}

// === 辅助函数 ===
function matchWritingMode({ goal, channel, topic_type }) {
  for (const m of WRITING_MODES) {
    const cond = m.conditions;
    const goalMatch = !cond.goal || cond.goal.includes(goal);
    const channelMatch = !cond.channel || cond.channel.includes(channel);
    const topicMatch = !cond.topic_type || cond.topic_type.includes(topic_type);
    if (goalMatch && channelMatch && topicMatch) return m;
  }
  return WRITING_MODES[0]; // 默认 deep_long_form
}

async function runSkillWithTimeout(skillName, params, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Skill ${skillName} timeout`)), timeoutMs);
    runSkill(skillName, params)
      .then(result => { clearTimeout(timer); resolve(result); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

module.exports = { selectWritingSkills, SKILL_FALLBACKS, HumanActionRequiredError };
```

### 10.1 Skill 路由配置（skill_routes.yml）

```yaml
# skill_routes.yml（Skill Selector 路由配置）
routes:
  - goal: growth
    channel: wechat_gzh
    topic_type: analysis
    mode: deep_long_form
  - goal: growth
    channel: wechat_gzh
    topic_type: case_study
    mode: deep_long_form
  - goal: growth
    channel: zhihu
    topic_type: analysis
    mode: technical
  - goal: brand
    channel: video
    topic_type: news
    mode: quick_social
  - goal: conversion
    channel: blog
    topic_type: tutorial
    mode: marketing
```

### 10.2 主笔+辅笔执行流程

```
输入: { goal, channel, topic_type, topicBrief, insertionStrategy }
  ↓
matchWritingMode → 确定 mode（主笔+辅笔组合）
  ↓
并发执行：主笔(skill) + 辅笔(skill) × N
  ↓
结果处理：
  ├─ 成功数 >= 1 → 主笔内容胜出，辅笔内容保留
  ├─ 成功数 = 0 → 按 SKILL_FALLBACKS 重试1次
  │                重试还失败 → 降级 khazix-writer
  └─ 失败数 >= 3 → 抛 HumanActionRequiredError（人工介入）
  ↓
输出: { primary, content, aux: [{skill, content}], fatalFailure }
```

### 10.3 辅笔内容合稿说明

```
主笔内容（主体） + 辅笔增强：
  hv-analysis  → 数据深度增强段落
  ljg-think    → 观点锐化追问段落
  ljg-card     → 小红书配图建议
  kai-topical-map → SEO框架增强

合稿不在 Agent 6 内完成，辅笔输出作为独立字段传给 Agent 7：
  aux_outputs: [
    { skill: 'hv-analysis', content: '...' },
    { skill: 'ljg-think', content: '...' }
  ]
  → Agent 7 负责决定如何融合主笔+辅笔内容
```

---

## 十一、P1.3：capability-index-builder

```javascript
// skills/capability-index-builder.js

async function buildCapabilityIndex({ source }) {
  const baseDir = source === 'agent2' ? './knowledge/company' : './knowledge/market';
  const files = glob.sync(`${baseDir}/**/*.json`);
  const newCards = [];

  for (const file of files) {
    const stat = fs.statSync(file);
    const indexPath = './knowledge/_index.json';
    const index = fs.existsSync(indexPath)
      ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
      : { lastModified: {}, cards: [] };

    // 检查文件是否更新
    if (index.lastModified[file] === stat.mtimeMs.toString()) {
      continue; // 未变化，跳过
    }

    // 解析并提取能力卡片
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const extracted = extractCardsFromAgentOutput(data, source);
    newCards.push(...extracted);

    index.lastModified[file] = stat.mtimeMs.toString();
  }

  // 合并到现有索引
  const index = fs.existsSync('./knowledge/_index.json')
    ? JSON.parse(fs.readFileSync('./knowledge/_index.json', 'utf8'))
    : { version: 0, cards: [], lastModified: {} };

  const existing = new Map(index.cards.map(c => [c.id, c]));
  for (const card of newCards) {
    existing.set(card.id, card);
  }

  const updatedIndex = {
    version: index.version + 1,
    cards: Array.from(existing.values()),
    lastModified: index.lastModified
  };

  writeJsonAtomic('./knowledge/_index.json', updatedIndex);

  return { newCards, version: updatedIndex.version };
}

function extractCardsFromAgentOutput(data, source) {
  // 根据 Agent2/3 输出格式提取能力描述
  const cards = [];
  if (data.capabilities && Array.isArray(data.capabilities)) {
    for (const cap of data.capabilities) {
      cards.push({
        id: `KB-${hashString(cap.name + source)}`,
        headline: cap.name,
        source_file: source,
        applicable_topics: cap.topics || [],
        insertion_type: cap.insertion_type || 'soft',
        confidence: cap.confidence || 0.5,
        capability_signals: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }
  return cards;
}
```

---

## 十二、P2.3：knowledge-sync.js（目录监听 — 修复遗漏 A）

V1 将 `knowledge-sync.js` 列为独立 Skill，但 V6.1 一直缺失。本 Skill 负责对 `knowledge/` 目录的实时监听，在文件增删改时自动触发增量更新，是触发链路1的核心实现。

```javascript
// skills/knowledge-sync.js

const chokidar = require('chokidar');
const path = require('path');
const { scanKnowledgeDir } = require('./knowledge-base-reader');
const { buildCapabilityIndex } = require('./capability-index-builder');

class KnowledgeSync {
  constructor({ watchDir = './knowledge', debounceMs = 2000 } = {}) {
    this.watchDir = watchDir;
    this.debounceMs = debounceMs;
    this.timer = null;
    this.pendingEvents = [];
    this.watcher = null;
  }

  start() {
    this.watcher = chokidar.watch(this.watchDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
    });

    this.watcher
      .on('add',    path => this._scheduleRefresh(path, 'add'))
      .on('change', path => this._scheduleRefresh(path, 'change'))
      .on('unlink', path => this._scheduleRefresh(path, 'unlink'))
      .on('error', err => console.error('[knowledge-sync] error:', err));

    console.log(`[knowledge-sync] watching ${this.watchDir}`);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  // 防抖：合并短时间内的多次文件变化，只触发一次刷新
  _scheduleRefresh(filePath, event) {
    this.pendingEvents.push({ filePath, event, ts: Date.now() });

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this._flush(), this.debounceMs);
  }

  async _flush() {
    if (this.pendingEvents.length === 0) return;
    const events = [...this.pendingEvents];
    this.pendingEvents = [];
    const filePaths = [...new Set(events.map(e => e.filePath))];

    console.log(`[knowledge-sync] ${events.length} event(s), triggering refresh for: ${filePaths.join(', ')}`);

    try {
      // 触发 scanKnowledgeDir 强制刷新
      await scanKnowledgeDir({ forceRefresh: true });

      // 通知 capability-index-builder 重新索引
      await buildCapabilityIndex({ source: 'docs' });

      console.log(`[knowledge-sync] refresh complete`);
    } catch (err) {
      console.error(`[knowledge-sync] refresh failed: ${err.message}`);
    }
  }
}

// 独立运行入口
if (require.main === module) {
  const sync = new KnowledgeSync({ watchDir: process.argv[2] || './knowledge' });
  sync.start();
  process.on('SIGINT', () => { sync.stop(); process.exit(0); });
}

module.exports = { KnowledgeSync };
```

**使用方式：**
```bash
# 启动 Agent6 时，后台运行 knowledge-sync
node skills/knowledge-sync.js &
```

**在 Agent6 启动时一并启动（加入 agent6-core.js 开头）：**
```javascript
// === 0. 启动目录监听 ===
const { KnowledgeSync } = require('./skills/knowledge-sync');
const sync = new KnowledgeSync();
sync.start();
```

---

## 十三、P2.4：Agent 9 反馈闭环（修复遗漏 D）

V1 定义 Agent 9 的反馈回路：
```
Agent 9（收入归因与增长学习）→ 反馈 → Agent 6（闭环优化）
                              ↓
                        capability cards 重新评估
```

```javascript
// skills/feedback-loop.js

/**
 * 接收 Agent 9 的反馈，更新 capability cards 的 confidence 和优先级
 * @param {Object} feedback — 来自 Agent 9 的反馈数据
 *   feedback.performance: { topic_id, channel, impressions, clicks, conversions }
 *   feedback.article_id: string
 */
async function handleAgent9Feedback(feedback) {
  const { article_id, performance } = feedback;

  // 读取当前索引
  const indexPath = './knowledge/_index.json';
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

  // 找到本次使用的 capability cards
  // 从 MasterArticle 输出记录中获取 used cards（由 Agent7 或 Agent9 传入）
  const usedCards = feedback.capability_cards_used || [];

  // 根据效果调整 confidence
  if (usedCards.length > 0 && performance) {
    const { conversions = 0, impressions = 0 } = performance;
    const ctr = impressions > 0 ? conversions / impressions : 0;

    for (const card of index.cards) {
      if (usedCards.includes(card.id)) {
        // 转化率高 → 上调 confidence（+0.1，最高1.0）
        // 转化率低 → 下调 confidence（-0.05，最低0.1）
        const delta = ctr > 0.05 ? 0.1 : -0.05;
        card.confidence = Math.min(1.0, Math.max(0.1, (card.confidence || 0.5) + delta));
        card.updated_at = new Date().toISOString();
        console.log(`[feedback-loop] ${card.id} confidence: ${card.confidence}`);
      }
    }

    writeJsonAtomic(indexPath, index);
  }
}

/**
 * 接收 Agent 9 反馈的标准接口（供 Agent 9 调用）
 */
async function receiveFeedback(feedbackPayload) {
  return handleAgent9Feedback(feedbackPayload);
}

module.exports = { receiveFeedback, handleAgent9Feedback };
```

**Agent 9 调用方式：**
```javascript
// 在 Agent 9 的反馈处理流程中调用
await callAgent6Skill('feedback-loop', {
  action: 'receiveFeedback',
  feedback: {
    article_id: masterArticle.article_id,
    capability_cards_used: masterArticle.capability_cards_used,
    performance: { impressions: 1000, clicks: 50, conversions: 3 }
  }
});
```

**效果调整策略：**
```
CTR >= 5%   → confidence += 0.1（转化好，加强匹配权重）
CTR 1-5%   → confidence 不变（基准线）
CTR < 1%   → confidence -= 0.05（转化差，降低匹配权重）
```

---

## 十四、P2.2：knowledge-update-handler

```javascript
// skills/knowledge-update-handler.js

const STOPWORDS = new Set([
  '的','了','是','在','和','有','我','你','他','她','它',
  '这','那','就','也','都','而','及','与','把','被',
  '一个','没有','什么','怎么','可以','能够','这个','那个'
]);

const PENDING_PATH = './knowledge/pending_keywords.json';

function handleKnowledgeUpdate(input) {
  const extracted = extractKeywordsFromContent(input.uploadedFile || input.userMessage);

  // 追加到 pending 列表（原子写入）
  const pending = fs.existsSync(PENDING_PATH)
    ? JSON.parse(fs.readFileSync(PENDING_PATH, 'utf8'))
    : [];

  const newPending = extracted.map(k => ({
    keyword: k,
    source: input.uploadedFile ? 'document' : 'message',
    added_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() // 3天后过期
  }));

  writeJsonAtomic(PENDING_PATH, [...pending, ...newPending]);

  return {
    action: 'notify',
    pendingKeywords: extracted,
    message: `已将新关键词加入待确认列表：${extracted.join(', ')}`
  };
}

function extractKeywordsFromContent(input) {
  const text = (input.content || input)
    .replace(/[#*`>\[\]]/g, ' ')  // 去除 Markdown 符号
    .replace(/\n+/g, ' ');

  const words = (text.match(/[\w]{2,6}/g) || []).map(w => w.toLowerCase());
  const freq = {};
  words.forEach(w => {
    if (!STOPWORDS.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });

  return Object.entries(freq)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 10);
}

// cron job（每天运行）：清理过期 pending keywords
// jova cron add --name "cleanup-pending-keywords" --schedule "0 3 * * *" --task "node skills/cleanup-pending.js"
```

---

## 十五、P2.5：20% Diff 阈值刷新机制（修复遗漏 B）

V1 定义的刷新条件是"知识库内容变化超过 20%"，V6.1~V6.2 一直简化为 mtime 对比。本节补全真实 20% diff 算法，并保留 mtime 作为快速预检。

### 15.1 设计思路

```
mtime 预检（快）→ 内容 hash 预检（中）→ 真实 diff 计算（准）
```

- **mtime 变了** → 说明文件有修改，进入内容比较
- **内容 hash 变了** → 文件实际内容变化，计算 diff
- **diff 比例 >= 20%** → 触发 knowledge-update-handler 重新解析

### 15.2 实现

```javascript
// skills/diff-detector.js

const crypto = require('crypto');

const DIFF_THRESHOLD = 0.20; // 20% 变化阈值

/**
 * 计算文本的快速 hash（用于预检）
 */
function computeQuickHash(text) {
  return crypto
    .createHash('md5')
    .update(text.normalize('NFC'))
    .digest('hex');
}

/**
 * 计算两个文本之间的字级别 diff 比例
 * @returns {number} 0.0 ~ 1.0，变化比例
 */
function computeDiffRatio(oldText, newText) {
  if (!oldText && !newText) return 0;
  if (!oldText || !newText) return 1.0;

  const stopwords = new Set(['的','了','是','在','和','有','我','你','他','这','那','就','也','都']);
  const oldWords = oldText.split(/\s+/).filter(w => w.length >= 2 && !stopwords.has(w));
  const newWords = newText.split(/\s+/).filter(w => w.length >= 2 && !stopwords.has(w));

  const oldSet = new Set(oldWords);
  const newSet = new Set(newWords);
  const allWords = new Set([...oldSet, ...newSet]);

  let changed = 0;
  for (const word of allWords) {
    if (oldSet.has(word) !== newSet.has(word)) changed++;
  }

  return allWords.size > 0 ? changed / allWords.size : 0;
}

/**
 * 检查文件是否需要触发知识库刷新
 * @param {string} filePath
 * @param {Object} options  { prevHash: string | null }
 * @returns {Object} { shouldRefresh, reason, diffRatio, currentHash }
 */
function checkFileShouldRefresh(filePath, options = {}) {
  const { prevHash } = options;
  const content = fs.readFileSync(filePath, 'utf8');
  const currentHash = computeQuickHash(content);

  if (prevHash && currentHash === prevHash) {
    return { shouldRefresh: false, reason: 'hash_unchanged', diffRatio: 0 };
  }
  if (!prevHash) {
    return { shouldRefresh: true, reason: 'first_seen', currentHash };
  }
  return { shouldRefresh: true, reason: 'hash_changed', currentHash };
}

/**
 * 对比两个版本文件的 diff ratio
 * @param {string} oldPath
 * @param {string} newPath
 * @returns {number} diff ratio
 */
function compareFileDiff(oldPath, newPath) {
  const oldContent = fs.existsSync(oldPath) ? fs.readFileSync(oldPath, 'utf8') : '';
  const newContent = fs.readFileSync(newPath, 'utf8');
  return computeDiffRatio(oldContent, newContent);
}

/**
 * 判断是否达到刷新阈值
 */
function shouldTriggerRefresh(diffRatio) {
  return diffRatio >= DIFF_THRESHOLD;
}

module.exports = { computeQuickHash, computeDiffRatio, checkFileShouldRefresh, compareFileDiff, shouldTriggerRefresh, DIFF_THRESHOLD };
```

### 15.3 与 knowledge-sync.js 的集成

在 `KnowledgeSync._flush()` 中，收到文件变化事件后：

```javascript
async _flush() {
  for (const { filePath } of this.pendingEvents) {
    const prev = this.lastHashes.get(filePath);
    const { shouldRefresh, currentHash } = checkFileShouldRefresh(filePath, { prevHash: prev });

    if (!shouldRefresh) continue;

    const backupPath = filePath + '.bak';
    const diffRatio = fs.existsSync(backupPath)
      ? compareFileDiff(backupPath, filePath)
      : 1.0;  // 首次视为全量

    if (!shouldTriggerRefresh(diffRatio)) {
      console.log(`[diff-detector] ${filePath} diff=${(diffRatio*100).toFixed(1)}% < 20%, skipping`);
      continue;
    }

    console.log(`[diff-detector] ${filePath} diff=${(diffRatio*100).toFixed(1)}% >= 20%, triggering refresh`);
    fs.copyFileSync(filePath, backupPath);
    this.lastHashes.set(filePath, currentHash);

    await scanKnowledgeDir({ forceRefresh: true });
    await buildCapabilityIndex({ source: 'docs' });
  }
  this.pendingEvents = [];
}
```

---

## 十六、P2.6：Agent 1 Campaign 触发机制（修复遗漏 E）

V1 定义触发4为"Agent 1 Campaign 变更"，一直没有实现。本节补全完整的事件驱动机制。

### 16.1 触发逻辑

```
Agent 1（增长总控）
    ↓ 写入 knowledge/campaign/ 目录（事件文件）
knowledge-sync.js 检测到变化
    ↓
capability-index-builder 重新构建索引
    ↓
capability cards 优先级重排
```

### 16.2 Agent 1 写入规范

Agent 1 在每次 Campaign 变更时，向 `knowledge/campaign/` 写入事件文件：

```javascript
// Agent 1 的 campaign-writer.js

const campaignEvent = {
  campaign_id,
  goal,                  // brand_building | lead_gen | conversion
  updated_at,
  priority_topics: [],    // 本次 Campaign 重点选题方向
  budget_allocation: {}   // { channel: ratio }
};

const eventFile = `./knowledge/campaign/${campaign_id}-${Date.now()}.json`;
writeJsonAtomic(eventFile, campaignEvent);

// 更新 current_campaign.json（最新引用）
writeJsonAtomic('./knowledge/campaign/current_campaign.json', {
  campaign_id, goal, updated_at, event_file: eventFile
});
```

### 16.3 Agent 6 消费机制

```javascript
// skills/campaign-consumer.js

const CAMPAIGN_DIR = './knowledge/campaign';

/**
 * 消费最新的 Campaign 变更事件
 * 由 knowledge-sync.js 在检测到 campaign/ 变化时调用
 */
async function consumeCampaignUpdate() {
  const currentPath = path.join(CAMPAIGN_DIR, 'current_campaign.json');
  if (!fs.existsSync(currentPath)) return null;

  const campaign = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
  const { buildCapabilityIndex } = require('./capability-index-builder');
  await buildCapabilityIndex({ source: 'campaign', campaign });

  console.log(`[campaign-consumer] campaign ${campaign.campaign_id} updated, re-indexed`);
  return campaign;
}

/**
 * 获取当前活跃 Campaign（供 Pipeline 引用）
 */
function getCurrentCampaign() {
  const currentPath = path.join(CAMPAIGN_DIR, 'current_campaign.json');
  if (!fs.existsSync(currentPath)) return null;
  return JSON.parse(fs.readFileSync(currentPath, 'utf8'));
}

module.exports = { consumeCampaignUpdate, getCurrentCampaign };
```

### 16.4 Pipeline 中的 Campaign 上下文注入

在 `runAgent6` 的启动阶段（Step 0 之后）：

```javascript
async function runAgent6({ topicBrief, strategyContext }) {
  // === 0. 启动时同步 ===
  const { buildCapabilityIndex } = require('./skills/capability-index-builder');
  await buildCapabilityIndex({ source: 'agent2' });
  await buildCapabilityIndex({ source: 'agent3' });

  // === 0b. Agent 1 Campaign（如有）===
  const { getCurrentCampaign } = require('./skills/campaign-consumer');
  const activeCampaign = getCurrentCampaign();
  if (activeCampaign) {
    console.log(`[agent6] active campaign: ${activeCampaign.campaign_id} (goal: ${activeCampaign.goal})`);
  }

  // === 1. 启动检查 ===
  const companyName = process.env.COMPANY_NAME;
  if (!companyName) throw new Error('COMPANY_NAME 未设置');
  // ...
}
```

### 16.5 capability-index-builder 的 campaign 优先级逻辑

在 `buildCapabilityIndex` 中加入 `source: 'campaign'` 分支：

```javascript
async function buildCapabilityIndex({ source, campaign }) {
  if (source === 'campaign') {
    const cards = loadCapabilityCards();
    for (const card of cards) {
      const isPriority = card.applicable_topics?.some(t =>
        campaign?.priority_topics?.includes(t)
      );
      card.priority_boost = isPriority ? 0.2 : 0;
    }
    writeJsonAtomic('./knowledge/_index.json', { cards, updated_at: new Date().toISOString() });
    return;
  }
  // 其他 source 处理...
}
```

---

## 十七、公共工具库

### 13.1 LLM 调用（lib/llm-call.js）

```javascript
// lib/llm-call.js

async function llmCall({ prompt, fallback }) {
  const model = process.env.LLM_MODEL || 'default';
  try {
    // Jova 环境下：直接使用内置 LLM 能力
    // 实际实现根据 Jova 版本和配置有所不同
    const result = await callLLM({ model, prompt });
    return result;
  } catch (err) {
    if (fallback) return fallback();
    throw new Error(`LLM unavailable: ${model}`);
  }
}

module.exports = { llmCall };
```

### 13.2 原子写入（lib/file-utils.js）

```javascript
// lib/file-utils.js

function writeJsonAtomic(filePath, data) {
  const tmp = filePath + '.tmp.' + Date.now() + '.' + Math.random().toString(36).slice(2, 7);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath); // rename 在同一文件系统上是原子操作
}

module.exports = { writeJsonAtomic };
```

### 13.3 Token 预算控制（lib/token-budget.js）

```javascript
// lib/token-budget.js

class TokenBudget {
  constructor({ maxTokens = 8000 }) {
    this.maxTokens = maxTokens;
    this.usage = 0;
  }

  track(stage, data) {
    const estimate = this.estimateTokens(JSON.stringify(data));
    if (this.usage + estimate > this.maxTokens) {
      throw new Error(`Token budget exceeded at stage: ${stage}`);
    }
    this.usage += estimate;
  }

  estimateTokens(str) {
    return Math.ceil(str.length / 4);
  }
}

module.exports = { TokenBudget };
```

### 13.4 并发控制队列（lib/pipeline-queue.js）

```javascript
// lib/pipeline-queue.js

class PipelineQueue {
  constructor({ maxConcurrent = 3 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  async enqueue(fn) {
    if (this.running >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

module.exports = { PipelineQueue };
```

### 13.5 ID 生成器（lib/id-generator.js）

```javascript
// lib/id-generator.js

function generateId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `MA-${ts}-${rand}`;
}

module.exports = { generateId };
```

### 13.6 Skill 运行器（lib/skill-runner.js）

```javascript
// lib/skill-runner.js

async function runSkill(skillName, params) {
  try {
    const skill = require(`../skills/${skillName}`);
    if (typeof skill.run === 'function') {
      return await skill.run(params);
    }
    return await skill(params);
  } catch (err) {
    // Skill 不存在或执行失败时降级
    console.error(`Skill ${skillName} failed: ${err.message}`);
    return { content: params.topicBrief?.topic_title || '生成失败' };
  }
}

module.exports = { runSkill };
```

---

## 十八、关键词三层架构

### Layer 1：SearchIntentMap（主来源）

来自 Agent 5 的 `topicBrief.search_intent`，每次新选题时刷新。

```
Layer1 = topicBrief.search_intent
  primary:   Agent5 的核心关键词
  secondary: Agent5 的次要关键词
  geo:       Agent5 的地理关键词
  intent_type: informational | navigational | transactional | commercial
```

### Layer 2：GEO 增强标注

Agent 6 在内容生成过程中对每篇文章独立标注，标注结果不修改原始 SearchIntentMap。

```
Layer2 = {
  geo_phrases: ["文章中提及的地理实体"],
  source_citations: ["引用来源URL"]
}
合并：geo_set = Layer1.geo ∪ Layer2.geo_phrases（去重）
```

### Layer 3：动态关键词

```
触发条件：Layer1 + Layer2 合并后不足 5 个关键词
来源：
  - 用户上传：实时追加（见 P2.2）
  - 竞品动态：每周从 Agent3 拉取
  - 产品发布：Agent2 护照更新时
  - AI搜索引用：每月从 Perplexity/BingChat 采样
```

### 关键词刷新触发条件

| 触发条件 | 刷新内容 | 频率 |
|---------|---------|------|
| Agent5 新选题 | SearchIntentMap | 每次 |
| 用户上传文档 | pending_keywords | 实时 |
| Agent3 竞品动态 | 竞品关键词 | 每周 |
| Agent2 护照更新 | 产品发布词 | 按需 |
| AI 搜索采样 | GEO引用词 | 每月 |

---

## 十九、SEO/GEO 关键词定义

### QDP/QDH/QDS 分类（引用 SearchIntentMap，不自行分类）

```
QDP（Question）：用户问什么 → informational 类选题的主关键词
QDH（How-to）：怎么做 → tutorial 类选题的主关键词
QDS（Definition）：是什么 → analysis 类选题的主关键词
```

分类依据：直接从 `SearchIntentMap.primary` 词推断选题类型，`intent_type === 'informational'` → QDP，`intent_type === 'transactional'` → QDH。

---

## 二十、知识更新触发机制

### 触发1：knowledge/ 目录文件变化
文件 mtime 更新 → `scanKnowledgeDir({ forceRefresh: true })` 重新解析

### 触发2：Agent 2 输出变化
`capability-index-builder` 检测 `knowledge/company/` 和 `knowledge/product/` 文件 mtime 变化

### 触发3：Agent 3 输出变化
`capability-index-builder` 检测 `knowledge/market/` 文件 mtime 变化

### 触发4：Agent 1 Campaign 变更
Agent 1 触发 `knowledge/campaign/` 更新事件

### 触发5：用户对话中上传资料
```
情况A：用户明确说了更新什么 → 直接执行
情况B：用户没说清楚 → 提取关键词追加到 pending，不阻塞
情况C：用户提到变化但没上传 → 提取关键词，询问是否更新
```

---

## 二十一、目录结构

```
risen-agent6/
├── agent6-core.js              # Pipeline 主入口
├── lib/
│   ├── llm-call.js             # LLM 调用封装
│   ├── file-utils.js           # 原子写入工具
│   ├── token-budget.js         # Token 预算控制
│   ├── pipeline-queue.js      # 并发队列
│   ├── id-generator.js        # ID 生成
│   └── skill-runner.js        # Skill 运行器
├── skills/
│   ├── knowledge-base-reader.js       # P0.2
│   ├── topic-capability-matcher.js    # P0.3
│   ├── insertion-strategy-decider.js  # P0.4
│   ├── kai-gate.js                   # P1.1
│   ├── skill-selector.js              # P1.2
│   ├── capability-index-builder.js    # P1.3
│   ├── knowledge-update-handler.js    # P2.2
│   ├── skill_routes.yml               # Skill 路由配置
│   └── validate-skill.js             # CI 合规检查
├── knowledge/
│   ├── _index.json           # 能力卡片索引
│   ├── pending_keywords.json  # 待确认关键词
│   ├── company/              # Agent 2 公司资料
│   ├── product/              # Agent 2 产品资料
│   ├── market/               # Agent 3 市场资料
│   ├── campaign/             # Agent 1 Campaign 上下文
│   └── docs/                 # 原始文档（人工上传）
├── output/                   # 产出目录
├── mock-data/
│   └── sample-topic-brief.json  # Agent 5 样本
└── document/                 # 分析文档
```

---

## 二十二、风险登记册（V6.3 完整版）

### 高风险

| ID | 描述 | 状态 | 缓解措施 |
|----|------|------|---------|
| HR-1 | 公司名称硬编码到 Skill 代码 | ✅ 已修复 | `[COMPANY_NAME]` 占位符；CI 阶段 `validate-skill.js` 检查 |
| HR-2 | Knowledge Base 初始化为空 | ✅ 已缓解 | 启动时强制要求上传；onboarding 步骤 |
| HR-3 | LLM 调用无 fallback | ✅ 已修复 | 每个 LLM 调用都有 `fallback` 参数 |

### 中风险

| ID | 描述 | 状态 | 缓解措施 |
|----|------|------|---------|
| MR-1 | Capability Signals 模式太泛 | ✅ 已修复 | Stage1 只做降噪，Stage2 LLM 做语义判断 |
| MR-2 | SearchIntentMap 字段缺失 | ✅ 已修复 | 兜底默认值，所有字段默认为空数组 |
| MR-3 | Stage2 LLM 无质量门 | ✅ 已修复 | Stage1<3 跳 Stage2；Stage2<1 留 Stage1 |
| MR-4 | 文件并发写入无保护 | ✅ 已修复 | `writeJsonAtomic` 原子写入 |
| MR-5 | extractKeywords 无停用词 | ✅ 已修复 | 20 词最小停用词表 |
| MR-6 | COMPANY_NAME 未校验 | ✅ 已修复 | 入口处检查，不为空才能启动 |
| MR-7 | intent_type 映射错误 | ✅ 已修复 | navigational → false；commercial → true |

### 低风险

| ID | 描述 | 状态 | 缓解措施 |
|----|------|------|---------|
| LR-1 | GEO 关键词依赖 Agent5 | ✅ 已缓解 | Layer2 自标注，Layer1+Layer2 合并 |
| LR-2 | Skill Selector 矩阵难维护 | ✅ 已缓解 | skill_routes.yml 配置文件；降级 khazix-writer |
| LR-3 | Token 预算无标准 | ✅ 已缓解 | 默认 8000，入口 middleware 检查 |
| LR-4 | 并发控制无标准 | ✅ 已缓解 | PipelineQueue，默认3并发 |

---

## 二十三、验证标准

```bash
# P0.1 基础设施
ls knowledge/ skills/ lib/ mock-data/

# P0.2 knowledge-base-reader
node -e "
const { scanKnowledgeDir } = require('./skills/knowledge-base-reader');
scanKnowledgeDir({ forceRefresh: true }).then(r => console.log('卡片数:', r.capabilityCards.length));
"

# P0.3 topic-capability-matcher
node -e "
const { matchTopicToCapabilities } = require('./skills/topic-capability-matcher');
const topic = require('./mock-data/sample-topic-brief.json');
const cards = require('./knowledge/_index.json').cards;
const r = matchTopicToCapabilities(topic, cards);
console.log('插入类型:', r.insertion_type);
"

# P0.5 完整链路
node agent6-core.js --input mock-data/sample-topic-brief.json --output output/
cat output/master-article.json | python3 -m json.tool > /dev/null && echo "valid JSON"

# CI 合规检查
node skills/validate-skill.js skills/knowledge-base-reader.js
node skills/validate-skill.js skills/topic-capability-matcher.js
```

---

## 二十四、版本变更历史

| 版本 | 日期 | 主要变更 |
|-----|------|---------|
| V1.0 | 2026-06-18 | 初始架构设计，4个必须自研 Skill |
| V2.0 | 2026-06-18 | P0/P1/P2 三级优先级结构 |
| V3.0 | 2026-06-18 | 风险自查，发现 21 个潜在问题 |
| V4.0 | 2026-06-18 | 关键词三层架构；能力信号模式；intent_type 引用 |
| V4.1 | 2026-06-18 | 公司名称占位符；Stage1/Stage2 质量门 |
| V5.0 | 2026-06-18 | LLM Provider 声明；未定义函数补全；占位符替换 |
| V5.1 | 2026-06-18 | 环境变量校验；原子文件写入；停用词表 |
| V6.0 | 2026-06-18 | 全量整合：所有版本技术细节合一，自包含可实施 |
| V6.1 | 2026-06-18 | 补4项V1遗漏：主笔+辅笔模式；3个失败→人工介入；evidence_references字段；content_structure字段 |
| V6.2 | 2026-06-18 | 补3项遗漏：knowledge-sync.js；启动时Agent2/3拉取；Agent9反馈闭环 |
| V6.3 | 2026-06-18 | 补2项遗漏：20%Diff阈值算法；Agent1 Campaign触发机制 |
