# Agent 4 · 策略与实验智能体
## 技术规格文档 V2.0

> **更新说明 V2.0：**
> - 基于完整测试验证，更新实际 Pipeline 输出
> - 补充 Feedback Loop 到 Agent5 的回流接口
> - 更新 Strategy Card 字段结构（content 内嵌套）

---

## 一、系统定位

### 1.1 在 RISEN OS 中的角色

```
Agent 1（增长目标） ─┐
Agent 2（品牌护照） ─┼─→ Agent 4 ──→ Agent 5 ──→ Agent 6（内容创作）
Agent 3（市场情报） ─┘    ↓
                    Strategy Card + Narrative约束
```

**核心职责：** Agent4 是瑞森智能体团队的"策略大脑"，将公司战略目标翻译为可执行的内容营销策略，输出给 Agent5 用于选题生成。

---

## 二、输入与输出

### 2.1 输入

| 输入 | 来源 | 必需 | 说明 |
|------|------|------|------|
| 竞品情报 | Agent4 内置 | ✅ | 4个直接竞品（Dify/Coze/LangChain/自研）|
| 平台数据 | 各平台公开数据 | ✅ | 知乎、公众号、头条等 |
| 反馈数据 | Agent5 历史表现 | 🔶 | 可选，影响策略微调 |

### 2.2 输出

| 输出 | 文件路径 | 接收方 |
|------|---------|--------|
| Strategy Card | `mock-data/output-strategy-card.json` | Agent5 |
| Narrative Constraint | `mock-data/narrative-constraints-extended.json` | Agent5 |
| 平台情报报告 | `mock-data/platform-intelligence-report.json` | Agent5 |

---

## 三、Pipeline 结构

### 3.1 入口文件

| 文件 | 用途 |
|------|------|
| `agent4-full-pipeline.js` | **主入口**，执行完整 Pipeline（含 Skills 1-9）|
| `agent4-core.js` | 核心逻辑（独立运行）|

### 3.2 执行步骤

```
Step 1: Agent4 Core（Skills 1-5）
        → Strategy Card v2 生成

Step 2: Platform Intelligence（Skill 6）
        → 竞品扫描 + 平台情报报告

Step 3: Feedback Router（Skill 7）
        → 深化选题路由 + 策略调整路由

Step 4: Strategy Evolver（Skill 8）
        → 版本升级（v1 → v2）

Step 5: Narrative Constraint（Skill 9）
        → Narrative 生成
```

---

## 四、Strategy Card 规格

### 4.1 文件结构

```json
{
  "id": "stg_1783301440184",
  "version": "v2",
  "status": "active",
  "content": {
    "strategic_bet": {
      "hypothesis": "如果我们在知乎和微信公众号持续输出'企业级AI智能体落地方法论'内容...",
      "bet_on": "内容营销建立技术领导力，带来高质量线索",
      "against": "纯功能宣传无法建立信任，线索质量差",
      "expected_outcome": "在6个月内获取200个SQL",
      "confidence": 0.7
    },
    "value_proposition": {
      "tagline": "Jova AI：让企业 AI 落地不再困难",
      "who": { "segment": "企业服务, SaaS, 软件开发", "company_size": "50-2000人" },
      "why": { "primary_problem": "企业对AI智能体落地有疑虑，担心投入大、效果差" },
      "how": { "solution": "Jova AI 企业级 AI 智能体平台", "key_capabilities": [...] },
      "proof_points": [...]
    }
  },
  "last_evolved_at": "2026-07-06T01:30:00.000Z",
  "changes": []
}
```

### 4.2 核心字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `strategic_bet.hypothesis` | string | 战略赌注的完整描述 |
| `strategic_bet.bet_on` | string | 押注方向（一句话） |
| `strategic_bet.confidence` | float | 置信度（0-1） |
| `value_proposition.tagline` | string | 核心标语 |
| `proof_points` | array | 可引用证据列表 |

---

## 五、Narrative Constraint 规格

### 5.1 文件结构

```json
{
  "core_narrative": "Jova AI：让企业AI落地不再困难",
  "account_differentiation": [
    { "platform": "知乎", "voice": "专业分析师", "topics": ["技术对比", "深度拆解"] },
    { "platform": "公众号", "voice": "企业顾问", "topics": ["案例分享", "实操指南"] }
  ],
  "key_messages": ["多Agent编排", "企业级安全", "全链路可观测"],
  "taboos": ["不能说"最便宜"", "不能攻击竞品"]
}
```

---

## 六、Skills 清单

| Skill | 文件 | 职责 |
|-------|------|------|
| Strategy Card Generator | 内置 | 生成策略卡 |
| Platform Intelligence | `skills/platform-intelligence.js` | 竞品扫描 |
| Feedback Router | `skills/feedback-router.js` | 反馈路由 |
| Strategy Evolver | `skills/strategy-version-manager.js` | 版本管理 |
| Budget Allocator | `skills/budget-allocator.js` | 预算分配 |
| Stop/Scale Decision | `skills/stop-scale-decision.js` | 停投/加投 |

---

## 七、测试验证

### 7.1 验证命令

```bash
cd agent4 && node agent4-full-pipeline.js
```

### 7.2 验证清单

- [x] Strategy Card v2 生成
- [x] 平台情报报告生成
- [x] 反馈路由决策（深化选题/策略调整）
- [x] Narrative Constraint 生成
- [x] Strategy Evolver 版本升级

### 7.3 实际输出

```
Pipeline 执行完成

最终产物:
  1. Strategy Card vv1（含策略+叙事+渠道+实验）
  2. 平台策略报告（3个平台）
  3. 反馈路由决策（3条深化+0条调整）
  4. 策略进化 vv2
  5. Narrative约束（供Agent 5使用）
```

---

## 八、接口规格

### 8.1 Strategy Card 输出接口

```
文件: mock-data/output-strategy-card.json
格式: JSON
编码: UTF-8
更新: 每次 Pipeline 执行覆盖
```

### 8.2 Narrative Constraint 输出接口

```
文件: mock-data/narrative-constraints-extended.json
格式: JSON
编码: UTF-8
更新: 每次 Pipeline 执行覆盖
```

---

## 九、技术约束

- Node.js >= 18
- 无外部 npm 依赖（纯内置模块）
- 执行时间：< 30s
- 内存占用：< 128MB

---

*本文档版本：V2.0 | 更新日期：2026-07-06*
