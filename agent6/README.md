# Agent 6 — 研究与母内容智能体

RISEN Growth OS 的内容生成层，负责接收选题与公司知识，输出完整母文章。

## 目录结构

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
│   ├── knowledge-sync.js          # P2.3 目录实时监听
│   ├── knowledge-update-handler.js  # P2.2 用户上传处理
│   ├── feedback-loop.js           # P2.4 Agent9 反馈闭环
│   ├── diff-detector.js           # P2.5 20%阈值Diff检测
│   ├── campaign-consumer.js       # P2.6 Agent1 Campaign消费
│   └── validate-skill.js          # CI 合规检查
├── knowledge/               # 知识库（含公司/产品/市场资料）
├── mock-data/              # 测试用 TopicBrief
├── document/               # 分析文档和 SPEC
└── package.json
```

## 快速启动

```bash
npm install
COMPANY_NAME=你的公司名 node agent6-core.js --input mock-data/sample-topic-brief.json
```

## 核心功能

- **选题-能力匹配**：TF-IDF 子串匹配 + ngram 相似度
- **软/硬植入决策**：hard / soft / minimal 三种策略
- **主笔+辅笔并发**：khazix-writer / ljg-writes 等 Skill 路由
- **Four U's 质量门**：Useful / User-focused / Clear / Actionable
- **知识持续更新**：5种触发机制（目录变化 / Agent2/3/1 / 用户上传）
- **Agent 9 反馈闭环**：CTR 动态调整 capability confidence

## 数据依赖

```
Agent 2 → knowledge/company/ + product/
Agent 3 → knowledge/market/
Agent 5 → TopicBrief + SearchIntentMap
Agent 4 → StrategyContext
Agent 1 → knowledge/campaign/
```
