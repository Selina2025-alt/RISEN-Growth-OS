# Agent 4 — 策略叙事智能体

RISEN Growth OS 的策略层，负责叙事主轴生成和渠道路由。

## 目录结构

```
agent4/
├── agent4-core.js          # Pipeline 主入口
├── skills/                 # 策略 Skills
├── document/               # 分析文档和 SPEC
├── mock-data/             # 测试数据
└── package.json
```

## 快速启动

```bash
npm install
node agent4-core.js --input mock-data/sample-strategy.json
```

## 核心功能

- **叙事主轴生成**：基于公司战略，生成内容叙事关键词
- **渠道组合策略**：多平台分发权重计算
- **三账号适配**：艾氪智能OS(短视) / 公众号 / JovaAI(转化)
