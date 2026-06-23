# Agent 6 — 研究与母内容智能体

RISEN Growth OS 的内容生成层，负责接收选题与公司知识，输出完整母文章。

## 目录结构

```
agent6/
├── agent6-core.js              # Pipeline 主入口
├── lib/                        # 7个核心工具模块
│   ├── id-generator.js        # ID生成器
│   ├── file-utils.js         # 原子文件写入
│   ├── llm-call.js          # LLM调用封装
│   ├── token-budget.js       # Token预算控制
│   ├── pipeline-queue.js     # 并发队列
│   ├── skill-runner.js       # Skill运行器
│   └── jova-skill-invoker.js # Jova Skill调用器
├── skills/                    # 12个核心 Skills
│   ├── knowledge-base-reader.js      # 扫描知识库
│   ├── capability-index-builder.js    # 构建能力索引
│   ├── topic-capability-matcher.js   # 选题-能力匹配
│   ├── insertion-strategy-decider.js # 植入策略决策
│   ├── skill-selector.js            # 写作模式路由
│   ├── kai-gate.js                  # Four U's 质量门
│   ├── knowledge-sync.js           # 目录实时监听
│   ├── knowledge-update-handler.js   # 用户上传处理
│   ├── diff-detector.js            # 20%Diff阈值检测
│   ├── feedback-loop.js            # Agent9反馈闭环
│   ├── campaign-consumer.js        # Agent1 Campaign消费
│   └── validate-skill.js          # CI合规检查
├── knowledge/                   # 知识库
│   ├── company/                # 公司介绍/战略手册
│   ├── product/                # 产品介绍/功能列表
│   ├── market/                 # 市场/竞品/ICP
│   ├── scene_01_urgent_order/  # 场景1：加急单
│   ├── scene_02_quotation/      # 场景2：报价
│   ├── scene_03_customs/        # 场景3：海关
│   ├── scene_04_website/        # 场景4：官网
│   ├── campaign/              # Campaign上下文
│   ├── _index.json           # CapabilityCard索引
│   └── pending_keywords.json  # 待处理关键词
├── mock-data/                  # 测试用TopicBrief
├── document/                   # 分析文档和SPEC
└── package.json
```

## 快速启动

```bash
npm install
COMPANY_NAME=艾氪智能 node agent6-core.js --input mock-data/sample-topic-brief.json
```

**注意：** `COMPANY_NAME` 环境变量必须设置，否则 Agent 6 拒绝启动。

## 核心功能

- **选题-能力匹配**：TF-IDF子串匹配 + ngram相似度（不依赖外部embedding）
- **软/硬植入决策**：hard（4分位点）/ soft（1-2分位点）/ minimal（无植入）
- **主笔+辅笔并发**：4种写作模式 × khazix-writer/ljg-writes/hv-analysis等 Skill 路由
- **Four U's 质量门**：Useful / User-focused / Clear / Actionable 四维评估
- **知识持续更新**：5种触发机制（目录变化/Agent2/3/1/用户上传）
- **Agent 9 反馈闭环**：CTR动态调整 capability confidence
- **Jova Skill 调用**：通过 sessions_spawn 启动 sub-agent 执行真实写作 Skill

## 写作模式

| 模式 | 主笔 | 辅笔 | 适用场景 |
|-----|------|------|---------|
| deep_long_form | khazix-writer | hv-analysis + ljg-think | 公众号深度长文 |
| quick_social | huashu-douyin-script | ljg-card | 短视频/小红书 |
| technical | ljg-writes | hv-analysis + ljg-rank | 知乎/技术博客 |
| marketing | kai-write | kai-topical-map | 转化类内容 |

## 4大场景知识库

| 场景 | 目录 | 说明 |
|------|------|------|
| 场景1 | scene_01_urgent_order/ | 加急单 |
| 场景2 | scene_02_quotation/ | 报价 |
| 场景3 | scene_03_customs/ | 海关 |
| 场景4 | scene_04_website/ | 官网 |

详细技术规格见 [document/AGENT6-SPEC.md](./document/AGENT6-SPEC.md)
