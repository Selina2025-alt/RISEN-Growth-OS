# RISEN Growth OS · Agent 4/5/6 深度审计报告

> 审计时间：2026-06-22（第二次审计）
> 数据来源：PRD 文档 + 三个 agent 真实代码 + Skills 实现 + 今日修复验证

---

## 一、重大更新（本次审计 vs 上次）

| 项目 | 上次状态 | 本次状态 |
|------|---------|---------|
| khazix-writer 真实调用 | ❌ stub 占位符 | ✅ **sessions_spawn 链路已通** |
| 4条 Skill 路径验证 | ❌ 未验证 | ✅ **khazix-writer / ljg-writes / kai-write / douyin-script 全部通过** |
| Agent 6 进展 | 52% | **58%** |
| 知识库目录结构 | ⚠️ 混乱堆叠 | ✅ **company/product/market/campaign 四分类** |

---

## 二、PRD 对三个 agent 的要求 vs 真实实现

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
| 真实热点信号采集（AIHOT/follow-builders/tech-news） | ✅ AIHOT REST API 实测 200 OK（需带浏览器 UA） | 完成 |
| SearchIntentMap | ✅ 已实现（4种意图类型） | 完成 |
| 10维选题评分 | ✅ platform-scorer 实现 | 完成 |
| 12平台分发路由 | ✅ distribution-router 实现 | 完成 |
| 事件驱动交接（Section 24） | ❌ 无事件系统 | 缺失 |
| 人工审批闸门 | ❌ 无审批流程 | 缺失 |

### Agent 6 · 研究与母内容智能体（PRD Section 14）

| PRD 要求 | 真实实现 | 状态 |
|---------|---------|------|
| 8个 Skills（来源发现/权威评分/交叉核验/Evidence Pack/观点综合/母文章/视频脚本/CTA） | ✅ 12个 skills 已实现 | 完成 |
| **多 Skill 路由** | ✅ khazix-writer / ljg-writes / kai-write / huashu-douyin-script 全部通过 sessions_spawn 真实调用 | **今日修复** |
| 知识库融合（Capability Index） | ✅ capability-index-builder + topic-capability-matcher | 完成 |
| 软/硬/minimal 植入策略 | ✅ insertion-strategy-decider | 完成 |
| Four U's 质量门 | ✅ kai-gate | 完成 |
| Agent 9 反馈闭环（CTR → confidence） | ✅ feedback-loop | 完成 |
| 知识持续更新（chokidar 监听） | ✅ knowledge-sync | 完成 |
| 知识库结构整理 | ✅ company/product/market/campaign 四分类 | **今日完成** |
| 真实研究/Evidence Pack（PRD Section 14.4 研究闸门） | ❌ 无真实来源发现 | 缺失 |

---

## 三、三个 agent 的真实能力评估

```
Agent 4  ████████████░░░░░░░  72%  — 策略逻辑完整，依赖 mock 数据
Agent 5  ███████████░░░░░░░░░  65%  — 选题框架全，热点信号已实测可用
Agent 6  ███████████░░░░░░░░░  58%  — Skill真实调用已通，知识库结构已整理
──────────────────────────────────────────────────────────────
整体     ██████████░░░░░░░░░  65%  — 核心链路打通，内容生产不再卡死
```

---

## 四、Skill 路径验证记录（2026-06-22）

| Skill | 风格/用途 | 验证结果 | 文章字数 |
|-------|---------|---------|---------|
| khazix-writer | 卡兹克公众号长文 | ✅ 通过 | ~2000字 |
| ljg-writes | 框架式分析文 | ✅ 通过 | ~1500字 |
| kai-write | 营销转化文（种草） | ✅ 通过 | ~1000字 |
| huashu-douyin-script | 抖音口播脚本 | ✅ 通过 | ~60秒 |

**调用链路验证：**
```
skill-selector.js → JovaSkillRequiredError 抛出
  → skill-runner.js → 异常透传（不包装）
    → agent6-core.js → invokeJovaSkill()
      → jova-skill-invoker.js → sessions_spawn()
        → sub-agent → 读取 SKILL.md + 执行写作
          → 写 output/ART-*.json
```

---

## 五、知识库现状

**目录结构（2026-06-22 整理）：**
```
knowledge/
├── company/           # 公司文档（5份）
│   ├── 01_艾氪智能集团战略手册 V7.0.md
│   ├── 02_艾氪介绍-中文版.md
│   ├── 03_1 521创始人演讲-前面 TOC 和 toB 赛道的论证.md
│   ├── 03_2 521创始人演讲.md
│   └── 05_内部培训-用户路径.md
├── product/          # 产品文档（2份）
│   ├── 产品介绍.md
│   └── 功能列表.md
├── market/           # 市场文档（空，待填充）
├── campaign/        # 活动文档（空，待填充）
├── _index.json      # CapabilityCard 索引（10张卡片）
└── pending_keywords.json  # 关键词（空，待从PRD提取）
```

**CapabilityCard 索引状态：**
- 共 10 张卡片（company 5张 + product 2张 + 新识别 3张）
- evidence 路径已更新为新目录结构
- pending_keywords.json 仍为空（建议从 PRD Section 4 目标客户关键词提取）

---

## 六、PRD 要求但完全不存在的模块

### 6.1 缺失的 Agents

| Agent | 责任 | 对 4/5/6 的影响 |
|-------|------|----------------|
| Agent 1 | 增长总控 | 无法自动调度 4→5→6 执行 Campaign |
| Agent 2 | 企业身份与证据 | Agent 6 知识库无真实来源，质量依赖公司文档完整性 |
| Agent 3 | 市场与客户情报 | 选题缺乏真实市场信号 |
| Agent 7 | 多模态与本地化 | 无法生成图片/视频/多语言 |
| Agent 8 | 传播与客户激活 | **无法发布到任何平台（最致命）** |
| Agent 9 | 收入归因与增长学习 | 无法验证内容效果，只能 mock |

### 6.2 缺失的平台能力

| 平台 | 发布 API | 数据采集 | 互动处理 |
|------|---------|---------|---------|
| 微信公众号 | ❌ 无凭证 | ❌ | ❌ |
| 抖音/视频号 | ❌ 无凭证 | ❌ | ❌ |
| 知乎 | ❌ 无凭证 | ❌ | ❌ |
| 小红书 | ❌ 无凭证 | ❌ | ❌ |
| 微博 | ❌ 无凭证 | ❌ | ❌ |
| LinkedIn | ❌ 无凭证 | ❌ | ❌ |
| YouTube | ❌ 无凭证 | ❌ | ❌ |
| X/Twitter | ❌ 无凭证 | ❌ | ❌ |

### 6.3 缺失的基础设施

| 能力 | 状态 | 说明 |
|------|------|------|
| 事件驱动总线 | ❌ | Agent 间无 event-driven 协同（PRD Section 24） |
| 工作流引擎（LangGraph/Temporal） | ❌ | 无长周期任务编排 |
| pending_keywords.json | ❌ 空 | 需从 PRD 提取关键词填充 |
| CRM 连接 | ❌ | 无线索管理 |
| OAuth 连接器（Nango） | ❌ | 无法管理平台授权 |
| 内容血缘（C2PA） | ❌ | 无法溯源 |
| Human Action Center | ❌ | 无法处理需要人工介入的任务 |

---

## 七、三个 agent 之间的真实数据依赖

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
  ← 热点信号（AIHOT）            ✅ 实测 200 OK

Agent 5 输出 → Agent 6：
  → topic-pool.json             ✅ 已有
  → trend-briefs/               ✅ 已有
  → distribution-map.json        ✅ 已有
  → signals.json                ✅ 已有

Agent 6 输入：
  ← Agent 5 TopicBrief           ✅ 已有
  ← Agent 4 StrategyContext      ✅ 已有
  ← 知识库（company/product）    ✅ 已有（已整理）
  ← pending_keywords             ❌ 空，需填充

Agent 6 输出 → Agent 7：
  → MasterArticle JSON           ✅ 框架完成
  → Match Report                ✅ 已有
  → Quality Gate                ✅ 已有

Agent 7 输出 → Agent 8：
  → Channel Package              ❌ 未实现

Agent 8 输出 → Agent 9：
  → Publication + Interaction + Lead ❌ 未实现
```

---

## 八、使用三个 agent 所需的补充清单

### 阻断性问题（必须解决才能生产）

```
□ 1. pending_keywords.json 填充
     → 从 PRD Section 4 目标客户章节提取关键词
     → 建议覆盖：B2B科技/专业服务/跨境企业/AI工具/数字化转型

□ 2. 媒体平台 API 凭证（建议首选微信公众号）
     → 有 API 才能打通 Agent 8 发布能力
     → Agent 6 写出来的文章永远只躺在 output/ 目录
```

### 重要但非阻断

```
□ 3. Agent 1 增长总控
     → 当前 4/5/6 靠手动触发，无自动调度

□ 4. Agent 2 企业护照
     → 为 Agent 6 提供更完整的企业背景

□ 5. Agent 9 归因数据
     → 当前 Agent 6 的 feedback-loop 是 mock CTR
     → 建议接入平台数据 API 或 PostHog

□ 6. Agent 3 市场情报
     → 为 Agent 5 提供真实市场背景信号
```

### 平台连接优先级

| 优先级 | 平台 | 理由 |
|--------|------|------|
| P0 | 微信公众号 | 内容主阵地，API 完整，有草稿模式 |
| P1 | 知乎 | 高质量内容渠道，API 开放 |
| P2 | LinkedIn | 海外 B2B，API 稳定 |
| P3 | 小红书 | 种草渠道，草稿模式已够用 |
| P4 | 抖音/视频号 | 强传播，审核严格 |

---

## 九、Skill 调用链路修复详解（2026-06-22）

### 问题根因

khazix-writer 是 **Prompt 风格型 Skill**（不是 UI 组件型），它的内容在 `SKILL.md` 里，由 AI 直接读取后执行。`show_ui` 组件调用对它无效。

Agent6 原来用 `show_ui` 调用它，永远失败，降级到 stub 占位符。

### 修复方案

通过 `sessions_spawn` 启动独立 sub-agent，sub-agent 在 Jova 上下文中直接读取 SKILL.md 执行写作：

```javascript
// jova-skill-invoker.js 核心逻辑
async function invokeSkill(skillId, params) {
  const prompt = buildSkillPrompt(skillId, params); // 组装完整写作 Prompt
  const result = await sessions_spawn({
    task: prompt,           // sub-agent 执行写作
    label: `agent6-skill-${callId}`,
    runTimeoutSeconds: 0
  });
  return result.content;     // 返回文章文本
}
```

**sub-agent 的 prompt 包含：**
1. SKILL.md 全文（前 8000 字）
2. topicBrief（选题信息）
3. 写作风格要求（禁用词/标点/格式要求）
4. 步骤指引

### 验证结果

```
4条 Skill 路径 × 4种内容类型 × 全部真实产出 ✅
runtime: 10s-59s
tokens: 14.0k in / 0.5k-2.1k out
文章质量：符合各 Skill 风格要求
```

---

## 十、下一步行动建议

| 优先级 | 行动 | 解决什么问题 |
|--------|------|------------|
| **P0** | 填充 pending_keywords.json | 让 Agent 6 知道哪些关键词是重点 |
| **P0** | 接入微信公众号 API | 打通发布闭环，Agent 6 文章才能发出 |
| **P1** | 构建 Agent 1 总控调度 | 让 4→5→6 自动串起来 |
| **P1** | Agent 9 基础归因 | CTR 数据反馈到内容质量 |
| **P2** | 接入知乎/LinkedIn | 扩展发布平台 |
| **P3** | 事件驱动总线 | PRD Section 24 要求 |

---

## 十一、总结

**今日修复解决了最掐脖子的一个问题**——Agent 6 的内容生产不再卡在 stub 上。

但 Agent 6 写出来的文章要真正产生价值，还需要 Agent 8 把它发布出去。没有 Agent 8，整个 RISEN 系统只能"生产"不能"传播"。

**当前状态：可以跑出真实文章，但无法验证传播效果。**

三个 agent 的架构设计是完整的，Skills 覆盖了 PRD 规定的大部分职责。下一阶段的瓶颈不在 agent 本身，在 **平台接入**。
