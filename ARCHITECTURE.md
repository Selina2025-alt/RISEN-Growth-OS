# RISEN Growth OS · Agent 4/5/6 架构总览

> 更新时间：2026-06-22

---

## 全局共享工具

```
scripts/                                    # 跨 Agent 共享工具（Phase 0 新增）
├── schema-validator.js                   # Schema 校验器（Phase 0）
│   # 支持 glob key + pipe 分隔多模式匹配
│   # 覆盖：narrative-constraints.json / MA-*.json / ART-*.json
└── fix-art-json.py                      # ART 文件 JSON 修复脚本（Phase 0）
    # 处理嵌入中文引号导致的多行字符串误识别
```

---

## Agent 4 · 策略设计智能体

```
agent4/                                    # 策略设计智能体
├── agent4-core.js                         # Pipeline 主入口（8 Skills 并行编排）
├── agent4-dashboard.js                    # Dashboard 可视化
├── agent4-full-pipeline.js                # 全流程运行脚本
├── agent4-report.py                      # 报告生成脚本
├── package.json                          # 依赖配置
│
├── skills/                               # 8 个并行 Skills
│   ├── budget-allocator.js              # Skill 8：预算分配（渠道预算切分）
│   ├── channel-mix.js                   # Skill 4：渠道组合规划 → 输出 channel_mix.json
│   ├── experiment-design.js               # Skill 6：实验设计（预算分配逻辑）
│   ├── feedback-router.js               # Skill 8：反馈路由（对接 Agent 9）
│   ├── goal-to-strategy.js              # Skill 1：目标市场分析（客户画像）
│   ├── narrative-arch.js                 # Skill 3：叙事架构构建（NARRATIVE ARC）
│   ├── narrative-constraint-generator.js  # Skill 3：叙事约束生成 → 输出 narrative_constraints.json
│   ├── narrative-constraint-generator-extended.js  # Skill 3 扩展版
│   ├── platform-intelligence.js          # Skill 5：竞品对比分析（竞争缺口）
│   ├── stop-scale-decision.js           # Skill 6：停止放大决策
│   ├── strategy-evolver.js              # Skill 7：策略版本演进
│   ├── strategy-feedback-router.js        # Skill 7：策略反馈路由
│   ├── strategy-version-manager.js       # Skill 7：策略版本管理器（可回滚）
│   ├── value-proposition.js             # Skill 2：价值主张设计（差异化定位）
│   └── ui/
│       ├── manifest.json               # UI 组件清单
│       └── assets/
│           └── StrategyCardUI.js       # Strategy Card 可视化组件
│
├── mock-data/                            # 测试数据（模拟 Agent 1/2/3 输出）
│   ├── agent1-campaign.json            # Agent 1 Campaign Brief Mock
│   ├── agent2-passport.json           # Agent 2 企业护照 Mock
│   ├── agent3-market.json            # Agent 3 市场情报 Mock
│   ├── narrative-constraints.json       # 叙事约束输出样例
│   ├── channel_mix.json              # 渠道配比输出样例
│   ├── output-strategy-card.json      # Strategy Card 输出样例
│   ├── budget-allocation.json         # 预算分配输出样例
│   ├── strategy-version-store.json    # 策略版本存储 Mock
│   └── strategy-card-viewer.html       # Strategy Card 可视化 HTML
│
└── document/
    └── AGENT4_SPEC.md                  # Agent 4 需求规格文档
```

**输入：** PRD / Agent 1 Campaign Brief
**输出：** narrative_constraints.json · channel_mix.json · Strategy Card

---

## Agent 5 · 趋势选题智能体

```
agent5/                                    # 趋势选题智能体
├── agent5-core.js                        # Pipeline 主入口
├── agent5-dashboard.js                  # Dashboard 可视化
├── agent5-report.js / agent5-report.py  # 报告生成
├── agent5-report.html                    # 报告输出
├── package.json                          # 依赖配置
│
├── lib/                                 # 公共库
│   └── signal-health.js                  # 信号源健康状态管理（三级 Fallback）
│
├── skills/                              # 7 个并行 Skills
│   ├── collect-signals.js               # Skill 1：趋势监测（信号采集）
│   ├── content-calendar.js              # Skill 7：内容日历（editorial-calendar 输出）
│   ├── distribution-router.js            # Skill 6：12平台分发路由（distribution-map 输出）
│   ├── platform-scorer.js              # Skill 5：平台适配评分（10维评分 × 12平台）
│   ├── resource-collector.js            # Skill 4：素材采集（resources.json 输出）
│   ├── topic-brief-builder.js          # Skill 9：Topic Brief 构建 → 输出 trend-briefs/
│   └── topic-cluster.js                # Skill 4：主题聚类（topic-pool.json 输出）
│
├── source/
│   └── topic-agent-source/             # 外部 topic-agent 子模块（RSS 采集源）
│       ├── _topic_agent/
│       │   └── config/
│       │       ├── agent.yml          # Agent 配置
│       │       ├── column_rules.yml   # 栏目规则
│       │       ├── external_tools.yml # 外部工具配置
│       │       ├── scoring.yml        # 评分规则
│       │       ├── skill_routes.yml  # Skill 路由配置
│       │       └── skills.yml        # Skills 定义
│       └── _knowledge_base/            # 知识库
│
├── output/                              # 产出物
│   ├── topic-pool.json                 # 选题池（所有候选选题，含评分）
│   ├── topic-scores.json              # 平台评分结果
│   ├── signals.json                  # 采集到的原始信号
│   ├── resources.json                # 素材采集结果
│   ├── distribution-map.json          # 分发路由图
│   ├── editorial-calendar.json        # 内容日历
│   └── trend-briefs/               # 每个重点选题的结构化简报
│       └── BRIEF-BRIEF-MQIYNA7D.json  # 示例 Brief
│
└── document/
    ├── AGENT5_SPEC_V2.md                    # Agent 5 规格文档
    └── AGENT5_TECHNICAL_SPEC_V2.md          # Agent 5 技术规格文档
```

**输入：** Agent 4 输出（narrative_constraints + channel_mix）+ 外部热点信号
**输出：** topic-pool.json · trend-briefs/*.json · signals.json · distribution-map.json

---

## Agent 6 · 内容生产智能体

```
agent6/                                    # 内容生产智能体
├── agent6-core.js                        # Pipeline 主入口
├── package.json                          # 依赖配置
├── .env                                  # 环境变量（COMPANY_NAME 等）
├── .env.example                         # 环境变量示例
│
├── lib/                                 # 公共库
│   ├── file-utils.js                    # 文件操作工具（原子写入）
│   ├── id-generator.js                 # ID 生成器
│   ├── jova-skill-invoker.js           # Jova Skill 调用器（sessions_spawn）
│   ├── llm-call.js                     # LLM 调用封装
│   ├── pipeline-queue.js               # Pipeline 队列管理
│   ├── skill-runner.js                 # Skill 执行器（超时控制）
│   └── token-budget.js                # Token 预算管理
│
├── skills/                              # 12 个 Skills（部分已集成 Jova Skill）
│   ├── capability-index-builder.js      # 能力索引构建（Capability Index）
│   ├── campaign-consumer.js            # Agent 1 Campaign 消费者
│   ├── diff-detector.js               # 差异检测（知识库更新对比）
│   ├── feedback-loop.js               # 反馈闭环（CTR → confidence）
│   ├── insertion-strategy-decider.js   # 软/硬/minimal 植入策略决策
│   ├── kai-gate.js                   # Four U's 质量门（pass/fail）
│   ├── knowledge-base-reader.js        # 知识库读取器
│   ├── knowledge-sync.js              # 知识持续同步（chokidar 监听）
│   ├── knowledge-update-handler.js     # 知识更新处理器
│   ├── skill-selector.js             # Skill 路由选择器（content_type → mode → skill）
│   ├── skill_routes.yml               # Skill 路由配置
│   └── topic-capability-matcher.js   # 选题 ↔ 能力匹配
│
├── knowledge/                           # 知识库（Evidence Base）
│   ├── _index.json                    # Capability Index（能力索引，10 张卡片）
│   ├── pending_keywords.json          # 战略关键词（8条，已初始化）
│   ├── company/                      # 公司文档
│   │   ├── 01_艾氪智能集团战略手册 V7.0.md
│   │   ├── 02_艾氪介绍-中文版.md
│   │   ├── 03_1_521创始人演讲-前面TOC和toB赛道论证.md
│   │   ├── 03_2_521创始人演讲.md
│   │   └── 05_内部培训-用户路径.md
│   ├── product/                      # 产品文档
│   │   ├── 产品介绍.md
│   │   └── 功能列表.md
│   ├── market/                       # 市场文档（待填充）
│   └── campaign/                     # 活动素材（待填充）
│
├── mock-data/                          # 测试数据
│   └── sample-topic-brief.json        # 示例 Topic Brief
│
├── output/                             # 产出物（母文章）
│   ├── ART-20260622-001.json        # 母文章（已修复 JSON）
│   ├── ART-20260622-002.json        # 母文章（已修复 JSON）
│   └── MA-*.json                    # 历史母文章格式
│
└── document/
    ├── AGENT6-SPEC.md               # Agent 6 需求规格文档
    ├── AGENT6-IMPLEMENTATION-PLAN.md # Agent 6 实施计划
    └── AGENT6-ANALYSIS-V1.md         # Agent 6 分析文档
```

**输入：** Agent 5 输出（trend-briefs/*.json）+ 知识库 + pending_keywords.json
**输出：** ART-*.json（母文章，质量门通过后交 Agent 8 发布）

---

## 三 Agent 输入输出关系

```
┌─────────────────────────────────────────────────────────────────────┐
│  Agent 4  输出                                                        │
│                                                                      │
│  narrative_constraints.json   →  Agent 5 输入                         │
│  channel_mix.json           ↗                                        │
│  Strategy Card              ↗                                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Agent 5  输出                                                        │
│                                                                      │
│  topic-pool.json          →  人工/Agent 1 筛选 → 重点选题              │
│  trend-briefs/*.json     →  Agent 6 输入                           │
│  signals.json             →  运营观察（117条/次实测）                 │
│  distribution-map.json    →  分发路由参考                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Agent 6  输入（真实结构）                                            │
│                                                                      │
│  BRIEF 文件字段（Agent 5 输出）：                                     │
│    brief_id / brief_type / content_type（Phase 2.3 新增）           │
│    meta: { topic_id / topic_title / search_intent / ... }           │
│    core_claims / evidence_support / agent6_guidance / risk_warnings │
│                                                                      │
│  知识库：                                                              │
│    knowledge/_index.json（Capability Index，10张卡片）               │
│    knowledge/company/（公司文档）                                     │
│    knowledge/product/（产品文档）                                      │
│    knowledge/pending_keywords.json（8条战略关键词）                    │
│                                                                      │
│  Skills（jova-skill-invoker 调用）：                                 │
│    khazix-writer / ljg-writes / kai-write / huashu-douyin-script   │
│    hv-analysis / ljg-think / ljg-rank / ljg-card                   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Agent 6  输出                                                        │
│                                                                      │
│  ART-*.json（MasterArticle 母文章）                                  │
│    article_id / title / content（1500-2500字）                       │
│    content_type / insertion_strategy                                 │
│    match_report / evidence_references / capability_cards_used        │
│    quality_check: { pass, score, reasons }                           │
│                                                                      │
│  → Agent 8（待建设）→ 平台发布                                       │
└─────────────────────────────────────────────────────────────────────┘
```
