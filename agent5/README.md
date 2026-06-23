# Agent 5 — 趋势与选题智能体

RISEN Growth OS 的选题层，负责热点情报采集和选题输出。

## 目录结构

```
agent5/
├── agent5-core.js              # Pipeline 主入口
├── agent5-report.py           # Terminal 彩色报告（推荐）
├── lib/
│   └── signal-health.js       # 信号源健康检查
├── skills/                     # 9个 Skills
│   ├── topic-cluster.js       # Skill 5 聚类
│   ├── platform-scorer.js     # Skill 6 评分
│   ├── distribution-router.js  # Skill 10 分发
│   ├── content-calendar.js    # Skill 7 日历
│   ├── resource-collector.js  # Skill 8 资源
│   ├── topic-brief-builder.js # Skill 9 TrendBrief
│   ├── collect-signals.js     # 信号采集（JS）
│   └── collect-signals.py     # 信号采集（Python）
├── mock-data/                 # 兼容索引
├── output/                    # 分模块输出
├── source/                    # 源码资源
├── document/                  # 分析文档和 SPEC
└── package.json
```

## 快速启动

```bash
npm install
node agent5-core.js        # 完整 pipeline
python3 agent5-report.py   # Terminal 彩色报告
```

## 核心功能

- **信号采集**：AIHOT + follow-builders + tech-news-digest，三源动态融合 + 健康检查 Fallback
- **10维选题评分**：策略匹配度/客户需求强度/搜索机会/社交热度/差异化/证据充足度/平台适配度/商业价值/风险/生产成本
- **SearchIntentMap**：搜索意图关键词（信息型/商业型/交易型/导航型）
- **12平台分发路由**：P0/P1/P2 优先级排序 + 三账号 Repurposing Chain
- **TrendBrief**：结构化选题简报，含核心论点/证据充分度/内容大纲/钩子/风险

## Signal Health Fallback 链

```
aihot（连续失败≥2）→ follow-builders → tech-news → throw
```

## Skill 清单

| # | Skill | 功能 |
|---|-------|------|
| 5 | TopicCluster | 聚类 + 方向 + FeedbackBoost |
| 6 | PlatformScorer | 10维评分 + 12平台适配 |
| 10 | DistributionRouter | 三账号路由 + Repurposing Chain |
| 7 | ContentCalendar | 7天×12平台内容日历 |
| 8 | ResourceCollector | YouTube/arXiv/网页资源采集 |
| 9 | TopicBrief | TrendBrief 结构化输出 |

详细技术规格见 [document/AGENT5_SPEC_V2.md](./document/AGENT5_SPEC_V2.md)
