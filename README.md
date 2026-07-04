# Agent 9 — 收入归因与增长学习智能体

> 定位：回答"什么真正有效、为什么有效、下一轮应该改哪里"。
> 所属：RISEN Growth OS

---

## 快速开始

```bash
# 设置共享输出目录
export AGENT9_OUTPUT_DIR=/path/to/RISEN-OS/shared/agent9-output

# 运行（dev 模式，Mock 数据）
node agent9-core.js

# 运行（生产模式，拒绝 Mock）
NODE_ENV=production node agent9-core.js

# 指定日期
node agent9-core.js --date 2026-07-04
```

---

## 架构

```
agent9-core.js
  ├── skills/
  │   ├── metric-collector.js      # 采集指标，持久化 performances
  │   ├── attribution-engine.js   # Z-Score 归因，含回溯
  │   ├── insight-generator.js      # 生成 Insight
  │   └── decision-dispenser.js    # 下发决策，含历史链
  ├── lib/
  │   ├── attribution-config.json  # 归因配置
  │   ├── platform-meta.json       # 27 个平台元数据
  │   ├── interfaces/            # 4 个接口定义
  │   └── platform-adapters/      # 6 个 Mock 适配器
  └── document/
      ├── AGENT9_PLAN_V5.0.md    # 完整实施计划
      ├── AGENT9_SPEC.md
      ├── FEEDBACK_CONTRACT.md
      ├── DECISION_INTERFACE.md
      ├── ATTRIBUTION_MODELS.md
      └── PLATFORM_BENCHMARKS.md
```

---

## 核心设计

### 归因模型

Z-Score 标准化：`Z = (avg_ctr - platform_avg) / platform_std`

| Z-Score | 决策 | boost_score |
|---------|------|-------------|
| Z ≥ 1.0 | SCALE | 1.2 |
| Z ≥ -0.5 | CONTINUE | 1.0 |
| Z ≥ -1.5 | REDUCE | 0.8 |
| Z < -1.5 | STOP | 0.0 |

### 最小样本

< 5 篇文章 → 强制 CONTINUE（不产生噪声信号）

### 回溯修正

达到 5 篇后，从 `performances/` 加载历史数据重新计算

---

## 与 Agent 5 的闭环

```bash
# Agent 5 读取 Agent 9 数据
AGENT9_OUTPUT_DIR=/path/to/shared node -e "
const { loadFeedbackFromAgent9 } = require('./agent5-core.js');
console.log(loadFeedbackFromAgent9());
"
```

---

## 与 Agent 8 的数据接口

Agent 9 从 Agent 8 读取发布记录：
```
${AGENT8_OUTPUT_DIR}/publications/{YYYY-MM}/PUB-{id}.json
```

接入真实 API 时，替换对应平台适配器即可，无需改动核心逻辑。

---

## 文档

| 文档 | 内容 |
|------|------|
| `AGENT9_PLAN_V5.0.md` | 完整实施计划（56KB，16章节） |
| `AGENT9_SPEC.md` | 规格文档 v5.0 |
| `FEEDBACK_CONTRACT.md` | Agent 间数据契约 |
| `DECISION_INTERFACE.md` | Decision 接口 v1.2 |
| `ATTRIBUTION_MODELS.md` | 归因方法论 |
| `PLATFORM_BENCHMARKS.md` | 27 平台基准数据 |
