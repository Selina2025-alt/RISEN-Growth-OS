# Agent 5 — 选题智能体

RISEN Growth OS 的选题层，负责热点情报采集和选题输出。

## 目录结构

```
agent5/
├── agent5-core.js          # Pipeline 主入口
├── skills/                 # 选题 Skills
├── document/               # 分析文档和 SPEC
├── mock-data/             # 测试数据
├── source/                # 原始信号数据
├── output/                # 产出（topic-pool.json / trend-briefs / distribution-map）
└── package.json
```

## 快速启动

```bash
npm install
node agent5-core.js
```

## 核心功能

- **信号采集**：AIHOT + follow-builders + tech-news-digest，三源动态融合
- **10维选题评分**：新鲜度/热度/匹配度/证据强度/平台适合度等
- **SearchIntentMap**：搜索意图关键词（informational/navigational/transactional/commercial）
- **12平台分发路由**：P0/P1/P2 优先级排序
