# RISEN Growth OS

> 多 Agent 协作增长操作系统——让企业内容生产从"人工智造"进化到"智能协作"。

RISEN Growth OS 是一套由 9 个 Agent 组成的全链路内容增长系统，涵盖从战略制定、热点捕捉、选题生成、内容创作、多平台分发到效果归因的完整闭环。

---

## 架构概览

```
Agent 1 ── 增长总控（目标下发 / 预算分配）
    │
    ├── Agent 2 ── 品牌叙事（核心故事 / 品牌宪法）
    ├── Agent 3 ── 市场情报（竞品追踪 / 行业洞察）
    ├── Agent 4 ── 策略叙事（主轴生成 / 渠道路由） ◄──
    ├── Agent 5 ── 选题智能（热点采集 / 10维评分） ◄──
    ├── Agent 6 ── 母内容（匹配 · 植入 · 写作）   ◄── 当前实现
    ├── Agent 7 ── 多模态适配（平台格式转换）
    ├── Agent 8 ── 传播执行（发布 / 互动 / 线索）
    └── Agent 9 ── 效果归因（CTR · 闭环反馈）
```

---

## Agent 4 · 策略叙事智能体

**职责**：基于公司战略和品牌宪法，生成内容叙事主轴 + 渠道分发策略。

**核心能力**：
- 叙事关键词生成（narrative_keywords）
- 渠道组合权重计算（channel_mix）
- 三账号适配：艾氪智能OS（短视）/ 公众号（图文）/ JovaAI（转化）

**输入**：Agent1 增长目标 + Agent2 品牌宪法 + Agent3 市场情报
**输出**：`narrative_constraints.json` + `channel_mix.json`

```
agent4/
├── agent4-core.js          # Pipeline 主入口
├── skills/                  # 策略 Skills
├── document/                # 分析文档和 SPEC
├── mock-data/              # 测试数据
└── package.json
```

---

## Agent 5 · 选题智能体

**职责**：从多源热点中筛选高质量选题，生成 SearchIntentMap 和渠道路由。

**核心能力**：
- 三源热点融合：AIHOT + follow-builders + tech-news-digest
- 10维选题评分（新鲜度 / 热度 / 匹配度 / 证据强度 / 平台适合度…）
- SearchIntentMap 生成（informational / transactional / commercial / navigational）
- 12平台分发路由（P0/P1/P2 优先级）

**输入**：Agent3 市场情报 + Agent4 叙事主轴 + 实时热点信号
**输出**：
- `topic-pool.json` — 候选选题库
- `trend-briefs/` — 每题一份深度 brief
- `distribution-map.json` — 渠道路由表
- `signals.json` — 原始信号存档

```
agent5/
├── agent5-core.js          # Pipeline 主入口
├── skills/                  # 选题 Skills
├── document/                # 分析文档和 SPEC
├── mock-data/              # 测试数据
├── source/                 # 原始信号数据
├── output/                 # 产出物
└── package.json
```

---

## Agent 6 · 母内容智能体

**职责**：接收选题 brief，融合公司知识库，生成完整高质量母文章。

**核心能力**：
- **选题-能力匹配**：子串 + ngram 相似度，判断选题与公司知识的关联强度
- **软/硬植入决策**：hard（强品牌植入）/ soft（软植入）/ minimal（纯热点内容）三种策略
- **主笔+辅笔 Skill 路由**：khazix-writer / ljg-writes / hv-analysis 等按内容类型分发
- **Four U's 质量门**：Useful · User-focused · Clear · Actionable — 不达标打回重写
- **知识持续更新**：5种触发机制（目录变化 / Agent2 / Agent3 / Agent1 Campaign / 用户上传）
- **Agent 9 反馈闭环**：CTR 数据动态调整 capability confidence

**数据依赖**：
```
Agent 2/3  → knowledge/company/ + knowledge/market/
Agent 4     → StrategyContext（叙事约束）
Agent 5     → TopicBrief + SearchIntentMap
Agent 1     → knowledge/campaign/
Agent 9     → CTR 反馈 → confidence 调整
```

**输入**：`TopicBrief`（含选题信息 + SearchIntentMap + 策略上下文）
**输出**：`output/MA-{id}.json`（MasterArticle 完整母文章 + 匹配报告 + 质量门结果）

```
agent6/
├── agent6-core.js          # Pipeline 主入口
├── lib/                    # 6个核心工具模块
│   ├── id-generator.js
│   ├── file-utils.js
│   ├── llm-call.js
│   ├── token-budget.js
│   ├── pipeline-queue.js
│   └── skill-runner.js
├── skills/                  # 核心 Skills
│   ├── knowledge-base-reader.js     # P0.2 读知识库
│   ├── capability-index-builder.js   # P1.3 构建能力索引
│   ├── topic-capability-matcher.js  # P0.3 选题-能力匹配
│   ├── insertion-strategy-decider.js # P0.4 软/硬植入决策
│   ├── skill-selector.js           # P1.2 主笔+辅笔路由
│   ├── kai-gate.js                # P1.1 Four U's 质量门
│   ├── knowledge-sync.js          # P2.3 目录监听
│   ├── knowledge-update-handler.js  # P2.2 用户上传
│   ├── feedback-loop.js           # P2.4 Agent9 反馈
│   ├── diff-detector.js           # P2.5 20% Diff检测
│   ├── campaign-consumer.js       # P2.6 Agent1 Campaign
│   └── validate-skill.js          # CI 合规检查
├── knowledge/               # 知识库
├── mock-data/              # 测试数据
├── document/               # 分析文档
└── package.json
```

---

## 快速启动

```bash
# 安装依赖
cd agent4 && npm install && cd ..
cd agent5 && npm install && cd ..
cd agent6 && npm install && cd ..

# Agent 4
COMPANY_NAME=你的公司名 node agent4/agent4-core.js \
  --input agent4/mock-data/agent1-campaign.json

# Agent 5
node agent5/agent5-core.js

# Agent 6
COMPANY_NAME=你的公司名 node agent6/agent6-core.js \
  --input agent6/mock-data/sample-topic-brief.json
```

---

## 设计理念

**不套模板，真实协作。**

每个 Agent 都有明确的决策边界：Agent 4 管叙事方向，Agent 5 管选题质量，Agent 6 管内容创作。方向错了，Agent 5 会打回；内容不达标，Agent 6 的 Four U's 门会卡住。整个系统通过数据反馈持续进化，而不是一条流水线式的单向传递。

---

## License

MIT
