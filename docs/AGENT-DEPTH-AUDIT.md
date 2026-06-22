# RISEN Growth OS · Agent 4/5/6 深度审计报告

> 审计时间：2026-06-22
> 数据来源：PRD 文档 + 三个 agent 真实代码 + Skills 实现

---

## 一、PRD 对三个 agent 的要求 vs 真实实现

### Agent 4 · 策略与实验智能体（PRD Section 12）

| PRD 要求 | 真实实现 | 状态 |
|---------|---------|------|
| 8个 Skills（目标→策略/价值主张/叙事架构/渠道组合/实验设计/停止放大/策略版本/预算分配） | ✅ 8个 skills 全实现 | 完成 |
| Strategy Card（含14个PRD必填字段） | ✅ buildStrategyCard() 覆盖全部字段 | 完成 |
| Agent 9 反馈闭环（Section 22.8） | ✅ feedback-router + stop-scale-decision 已对接 | 完成 |
| 事件驱动交接（Section 24，event-driven） | ❌ 无事件系统，纯函数调用 | 缺失 |
| 人工审批闸门（Section 25） | ❌ 无审批流程 | 缺失 |
| 策略版本回滚（Section 12.4） | ✅ strategy-version-manager 已实现 | 完成 |
| LangGraph/Temporal 集成 | ❌ 无工作流编排 | 缺失 |

### Agent 5 · 趋势与选题智能体（PRD Section 13）

| PRD 要求 | 真实实现 | 状态 |
|---------|---------|------|
| 7个 Skills（趋势监测/搜索意图/社交监听/竞品缺口/主题聚类/平台适配/内容日历） | ✅ 7个 skills 全实现 | 完成 |
| 真实热点信号采集（AIHOT/follow-builders/tech-news） | ⚠️ REST API 有 fallback，但信号是 mock | 部分完成 |
| SearchIntentMap | ✅ 已实现（informational/navigational/transactional/commercial） | 完成 |
| 10维选题评分 | ✅ platform-scorer 实现 | 完成 |
| 12平台分发路由 | ✅ distribution-router 实现 | 完成 |
| 事件驱动交接（Section 24） | ❌ 无事件系统 | 缺失 |
| 人工审批闸门 | ❌ 无审批流程 | 缺失 |

### Agent 6 · 研究与母内容智能体（PRD Section 14）

| PRD 要求 | 真实实现 | 状态 |
|---------|---------|------|
| 8个 Skills（来源发现/权威评分/交叉核验/Evidence Pack/观点综合/母文章/视频脚本/CTA） | ⚠️ 12个 skills，但核心写作 skill 是 stub | 部分完成 |
| 知识库融合（Capability Index） | ✅ capability-index-builder + topic-capability-matcher | 完成 |
| 软/硬/minimal 植入策略 | ✅ insertion-strategy-decider | 完成 |
| Four U's 质量门 | ✅ kai-gate | 完成 |
| Agent 9 反馈闭环（CTR → confidence） | ✅ feedback-loop | 完成 |
| 知识持续更新（chokidar 监听） | ✅ knowledge-sync | 完成 |
| **khazix-writer 真实写作** | ❌ writing-stub 仍是占位符 | **关键缺失** |
| 真实研究/Evidence Pack（PRD Section 14.4 研究闸门） | ❌ 无真实来源发现 | 缺失 |

---

## 二、三个 agent 的真实能力评估

```
Agent 4  ████████████░░░░░░░░░░  72%  — 策略逻辑强，但依赖 mock 数据
Agent 5  ██████████░░░░░░░░░░░░  60%  — 选题框架全，热点采集不真实
Agent 6  █████████░░░░░░░░░░░░░  52%  — 基础设施完备，内容产出是 stub
─────────────────────────────────────────────────────
整体    █████████░░░░░░░░░░░░░░  61%  — 框架到位，核心内容生产未打通
```

---

## 三、PRD 要求但完全不存在的模块

### 3.1 缺失的 Agents

| Agent | 编号 | 状态 | 影响 |
|-------|------|------|------|
| Agent 1 · 增长总控 | 增长总控 | ❌ 未实现 | 整个系统无法自动调度 |
| Agent 2 · 企业身份与证据 | 企业护照 | ❌ 未实现 | Agent 6 知识库无真实来源 |
| Agent 3 · 市场与客户情报 | 市场情报 | ❌ 未实现 | 选题缺乏真实市场信号 |
| Agent 7 · 多模态与本地化 | 多模态 | ❌ 未实现 | 无法生成图片/视频/多语言版本 |
| Agent 8 · 传播与客户激活 | 传播执行 | ❌ 未实现 | 无法发布到任何平台 |
| Agent 9 · 收入归因与增长学习 | 归因学习 | ❌ 未实现 | 无法验证效果，只能 mock |

### 3.2 缺失的平台能力

| 平台 | API 状态 | 内容发布 | 数据采集 | 互动处理 |
|------|---------|---------|---------|---------|
| 微信公众号 | ❌ 无凭证 | ❌ | ❌ | ❌ |
| 抖音/视频号 | ❌ 无凭证 | ❌ | ❌ | ❌ |
| 知乎 | ❌ 无凭证 | ❌ | ❌ | ❌ |
| 小红书 | ❌ 无凭证 | ❌ | ❌ | ❌ |
| 微博 | ❌ 无凭证 | ❌ | ❌ | ❌ |
| LinkedIn | ❌ 无凭证 | ❌ | ❌ | ❌ |
| YouTube | ❌ 无凭证 | ❌ | ❌ | ❌ |
| X/Twitter | ❌ 无凭证 | ❌ | ❌ | ❌ |

### 3.3 缺失的基础设施

| 能力 | 状态 | 说明 |
|------|------|------|
| **事件驱动总线** | ❌ | Agent 间无 event-driven 协同（PRD Section 24） |
| **工作流引擎**（LangGraph/Temporal） | ❌ | 无长周期任务编排 |
| **知识库**（真实内容） | ⚠️ 目录存在，内容空 | Agent 6 的 knowledge/ 基本无真实数据 |
| **CRM 连接** | ❌ | 无线索管理 |
| **OAuth 连接器**（Nango） | ❌ | 无法管理平台授权 |
| **内容血缘**（C2PA） | ❌ | 无法溯源 |
| **Human Action Center** | ❌ | 无法处理需要人工介入的任务 |

---

## 四、使用三个 agent 所需的补充清单

### 4.1 必须补充（阻断性问题）

```
□ 1. khazix-writer 真实集成
     → Agent 6 的 writing-stub 替换为真实 khazix-writer Skill 调用
     → 这是内容质量的瓶颈

□ 2. Agent 5 真实热点信号源
     → 接入真实 AIHOT API（已有 REST endpoint）
     → 或接入 follow-builders / tech-news-digest Skill
     → 当前 mock 信号无法支撑真实选题决策

□ 3. Agent 6 知识库内容
     → 在 knowledge/company/ 放入真实企业介绍
     → 在 knowledge/product/ 放入真实产品文档
     → 在 knowledge/market/ 放入市场/竞品资料
     → 否则 capability matching 全是 0

□ 4. 媒体平台 API 凭证
     → 至少一个平台（建议微信公众号）完成 OAuth 连接
     → 才能打通 Agent 7/8 的发布能力
```

### 4.2 重要但非阻断

```
□ 5. Agent 1 增长总控
     → 当前 4/5/6 靠手动触发，无自动调度
     → 需要 Campaign + Task Graph 编排能力

□ 6. Agent 2 企业护照
     → 为 Agent 6 提供真实企业背景
     → 建议优先于 Agent 3/7/8/9

□ 7. Agent 9 归因数据
     → 当前 Agent 6 的 feedback-loop 是 mock CTR
     → 建议接入平台数据 API 或 PostHog

□ 8. Agent 3 市场情报
     → 为 Agent 5 提供真实市场背景
```

### 4.3 平台连接优先级建议

```
第一优先级（建议立即接入）：
  → 微信公众号（内容主阵地，有完整 API）
  → 知乎（高质量内容渠道，API 开放）

第二优先级（中期接入）：
  → LinkedIn（海外 B2B，API 稳定）
  → 小红书（种草渠道，草稿模式已够用）

第三优先级（长期）：
  → 抖音/视频号（强传播，但审核严格）
  → YouTube（视频母内容）
  → X/Twitter（海外传播）
```

---

## 五、三个 agent 之间的真实数据依赖

```
Agent 4 输入：
  ← Agent 1（增长目标）         ❌ 缺失，mock
  ← Agent 2（品牌护照）         ❌ 缺失，mock
  ← Agent 3（市场情报）         ❌ 缺失，mock

Agent 4 输出 → Agent 5：
  → narrative_constraints.json    ✅ 已实现
  → channel_mix.json            ✅ 已实现
  → Strategy Card               ✅ 已实现

Agent 5 输入：
  ← Agent 3 市场情报             ❌ 缺失，mock
  ← Agent 4 叙事约束             ✅ 已有
  ← 热点信号（AIHOT/follow-builders）⚠️ fallback

Agent 5 输出 → Agent 6：
  → topic-pool.json             ✅ 已有
  → trend-briefs/               ✅ 已有（真实 AIHOT 数据）
  → distribution-map.json         ✅ 已有
  → signals.json                 ✅ 已有

Agent 6 输入：
  ← Agent 5 TopicBrief            ✅ 已有
  ← Agent 4 StrategyContext       ✅ 已有
  ← 知识库（company/product/market）❌ 空目录
  ← Agent 2/3 能力卡片           ❌ 无数据

Agent 6 输出 → Agent 7：
  → MasterArticle JSON           ✅ 框架完成（stub 内容）
  → Match Report                 ✅ 已有
  → Quality Gate                 ✅ 已有

Agent 7 输出 → Agent 8：
  → Channel Package              ❌ 未实现

Agent 8 输出 → Agent 9：
  → Publication + Interaction + Lead ❌ 未实现
```

---

## 六、第一阶段建议（可行动的最小集合）

要让三个 agent 跑出真实价值，按优先级做这几件事：

```
[优先级 A] khazix-writer 真实调用
  Agent 6 才能输出真实质量的文章

[优先级 B] 填充 Agent 6 知识库
  在 knowledge/company/、knowledge/product/ 放入真实资料
  否则软/硬植入策略永远是 minimal

[优先级 C] 微信公众号 API 接入
  有 API 就能打通 Agent 7/8
  至少能发布 + 采集基础数据

[优先级 D] Agent 5 信号源稳定化
  确认 AIHOT API 可以每日抓取
  或配置 follow-builders 真实 RSS
```

---

## 七、总结

三个 agent 的**架构设计是完整的**，Skills 覆盖了 PRD 规定的大部分职责，但：

1. **内容产出是 stub** — Agent 6 最大瓶颈，必须先解决
2. **知识库是空的** — 无法做真实融合判断
3. **热点信号不稳定** — Agent 5 的价值取决于信号质量
4. **平台全未接入** — 无法验证传播效果
5. **Agent 1/2/3/7/8/9 全缺失** — 只能跑单点，无法形成闭环

当前阶段：三个 agent 是"**可以演示但不能生产**"的状态。
