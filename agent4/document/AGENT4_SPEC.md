# Agent 4 · 策略与实验智能体
## 技术规格文档 V1.1

> 本文档是 Agent 4 的唯一权威技术规格。
> 无需查阅其他文档，按本文档可直接理解或实施 Agent 4 系统。
>
> **更新说明 (V1.1):**
> - 明确 Pipeline 入口区分（agent4-core.js vs agent4-full-pipeline.js）
> - Skill 6/7/8 PRD 来源标注为 Section 12
> - 更正 Feedback Router 双链路描述
> - 补充 Strategy Card 16 字段详细展开
> - 补充完整文件索引

---

## 一、系统定位

### 1.1 在 RISEN OS 中的角色

```
Agent 1（增长目标） ─┐
Agent 2（品牌护照） ─┼─→ Agent 4 ──→ Agent 5 ──→ Agent 6（内容创作）
Agent 3（市场情报） ─┘    ↓
                    Strategy Card + Narrative约束
```

### 1.2 输入与输出

| 输入 | 来源 | 必需 |
|------|------|------|
| Campaign Goal + Budget | Agent 1 | 是 |
| Promotion Passport + Claims + Evidence | Agent 2 | 是 |
| ICP + Target Accounts + Market Brief | Agent 3 | 是 |
| Experiment Results（反馈） | Agent 9 | 否 |

| 输出 | 位置 | 给谁 |
|------|------|------|
| Strategy Card | mock-data/agent4-full-output.json | Agent 5 / 人工审批 |
| Narrative Constraints | mock-data/narrative-constraints-extended.json | Agent 5 |
| Platform Intelligence Report | mock-data/platform-intelligence-report.json | Agent 5 / Agent 4 |

### 1.3 运行命令

```bash
cd /workspace/RISEN-OS/agent4

# 推荐：完整 Pipeline（含 Skills 6-9 自动串联）
node agent4-full-pipeline.js

# 备选：Core Pipeline（Skills 1-8，返回结构化对象）
node agent4-core.js

# Terminal 报告工具（推荐）
python3 agent4-report.py
```

---

## 二、Pipeline 入口区分

Agent 4 存在 **两套入口**，职责不同：

| 入口文件 | 职责 | 调用方式 |
|---------|------|---------|
| `agent4-core.js` | Skills 1-8 核心，返回结构化 JS 对象 | `require()` 引入，或直接 `node` 运行 |
| `agent4-full-pipeline.js` | 完整 Pipeline 串联，含 Skills 6-9 自动执行 | 独立运行，生成完整输出文件 |
| `agent4-dashboard.js` | ⚠️ 废弃（chalk v5 ESM 问题） | — |

**推荐流程：**
- **快速验证 / Programmatic 调用** → `agent4-core.js`
- **完整执行 / 人工审批** → `agent4-full-pipeline.js`

---

## 三、Pipeline Step 1-9

```
Step 1: Agent 4 Core（Skill 1-5）
       goal-to-strategy.js         → Strategic Bet
       value-proposition.js        → JTBD Value Proposition
       narrative-arch.js          → 30s/2min/完整版 Narrative
       channel-mix.js             → 10个平台渠道分配
       experiment-design.js        → A/B Test + 多臂老虎机

Step 2: Skill 6: Platform Intelligence
       platform-intelligence.js     → 12平台竞品内容扫描（Bing搜索方案）

Step 3: Skill 7: Feedback Router（Pipeline内轻量版）
       strategy-feedback-router.js  → 内容表现路由

Step 4: Skill 8: Strategy Evolver（Pipeline内版本更新）
       strategy-evolver.js         → Strategy Card 版本更新

Step 5: Skill 9: Narrative Constraint
       narrative-constraint-generator.js → 三账号约束（扩展版）
```

---

## 四、Skill 清单与边界

### 4.1 Skill 1-5（Core）

| # | Skill | 文件 | 功能 | PRD来源 |
|---|-------|------|------|---------|
| 1 | Goal → Strategy | goal-to-strategy.js | Campaign Goal → Strategic Bet | Section 12 |
| 2 | Value Proposition | value-proposition.js | JTBD + 证据 → VP | Section 12 |
| 3 | Narrative Architecture | narrative-arch.js | 30s/2min/完整版 | Section 12 |
| 4 | Channel Mix | channel-mix.js | 10平台渠道分配 | Section 12 |
| 5 | Experiment Design | experiment-design.js | A/B + 多臂老虎机 | Section 12 |

### 4.2 Skill 6（预算与Stop/Scale）

| # | Skill | 文件 | 功能 | PRD来源 |
|---|-------|------|------|---------|
| 6 | Budget Allocator | budget-allocator.js | 三级预算分配 + 实验周期 | Section 12 |
| 7 | Stop/Scale Decision | stop-scale-decision.js | ROI/置信度/样本量 → SCALE/CONTINUE/STOP/PIVOT | Section 12 |
| 8 | Strategy Version Manager | strategy-version-manager.js | 版本历史 + Diff + 回滚 | Section 12 |

### 4.3 Skill 7B（PRD合规，完整路由）

| # | Skill | 文件 | 功能 | PRD来源 |
|---|-------|------|------|---------|
| 7B | Feedback Router（PRD版）| feedback-router.js | Agent 9 → Agent 3/4/5/6 路由 | Section 17.4 |

### 4.4 Skill 9（Narrative约束）

| # | Skill | 文件 | 功能 | PRD来源 |
|---|-------|------|------|---------|
| 9 | Narrative Constraint | narrative-constraint-generator.js | Strategy Card → Agent 5 三账号约束 | Section 12 |

### 4.5 Pipeline内 Skill 7/8（非PRD编号）

| 文件 | Pipeline角色 | 说明 |
|------|------------|------|
| strategy-feedback-router.js | Skill 7（Pipeline内）| 内容表现路由（轻量） |
| strategy-evolver.js | Skill 8（Pipeline内）| 策略版本更新 |

---

## 五、Feedback Router 双链路（现状）

Agent 4 内存在两套独立的 Feedback 处理逻辑，职责不同：

| 实现 | 文件 | Pipeline引用 | 功能 |
|------|------|------------|------|
| Pipeline内路由 | strategy-feedback-router.js | ✅ 直接引用 | 内容表现路由（轻量） |
| PRD合规路由 | feedback-router.js | ❌ 未被引用 | 完整Agent9对接（含版本管理） |
| 策略进化 | strategy-evolver.js | ✅ 直接引用 | Strategy Card版本更新 |

**说明：**
- `strategy-feedback-router.js` + `strategy-evolver.js` 共同构成 Pipeline 内置的 Skill 7/8
- `feedback-router.js`（PRD Section 17.4 合规版）有完整的 Agent 9 对接逻辑，但从未被 Pipeline 引用
- 两套并存是历史设计，暂不删除；后续打通完整链路时可启用 PRD 合规版

---

## 六、Strategy Card 16字段详解

完整的 Strategy Card 包含以下字段（PRD Section 12 要求）：

```javascript
{
  id,                    // 策略ID，格式: stg_{timestamp}
  version,               // 版本号，格式: v1, v2, ...
  status,                // approved/draft/superseded

  // ===== 基础信息 =====
  promoted_object,        // 推广对象（如：JovaAI）
  business_objective,     // 商业目标（如：品牌增长+商机获取）
  target_market,          // 目标市场（如：中国）
  target_accounts,        // 目标账户列表
  target_roles,          // 目标角色/persona列表

  // ===== 认知差距 =====
  current_perception,     // 当前市场认知
  target_perception,      // 目标市场认知

  // ===== 核心内容 =====
  value_proposition,      // 价值主张（Skill 2输出）
  narrative,              // 叙事架构（Skill 3输出）

  // ===== 实验配置 =====
  experiment_plan,        // 实验计划（Skill 5输出）
  channel_mix,            // 渠道组合（Skill 4输出）

  // ===== 决策条件 =====
  success_threshold,      // 成功阈值 { roi, min_sample_size, confidence, ... }
  stop_conditions,        // 停止条件 { roi_threshold, min_sample_size, ... }
  scale_conditions,       // 放大条件 { roi_multiplier, confidence, ... }

  // ===== 风险与周期 =====
  risks,                  // 风险列表
  experiment_duration_weeks,  // 实验周期（周）
  budget_ceiling,         // 预算上限

  // ===== 版本管理 =====
  version_history,         // 版本历史（Skill 8输出）
  content: {              // 内部内容快照
    strategic_approach,
    strategic_bet,
    value_proposition,
    narrative,
    channel_mix,
    experiment_plan,
    success_threshold,
    stop_conditions,
    scale_conditions
  }
}
```

### 默认决策阈值

| 决策 | ROI 倍数 | 置信度 | 最小样本量 |
|------|---------|--------|-----------|
| **SCALE**（放大） | > 1.5x | > 80% | 500 |
| **CONTINUE**（继续） | > 1.2x | > 60% | 200 |
| **STOP**（停止） | < 0.6x | > 70% | 300 |
| **PIVOT**（转向） | 核心假设被证伪 | — | — |

---

## 七、平台情报（Skill 6 — 联网搜索方案）

### 7.1 方案说明

原方案（直接爬取）需要平台登录态，知乎/头条/百家号在无登录态下抓取为空。
新方案：通过 Bing 搜索"竞品名 site:平台域名"，获取各平台内容动态，无登录态限制。

### 7.2 12平台列表

```javascript
const ALL_PLATFORMS = [
  // 图文平台
  { id: 'zhihu',       name: '知乎',       domain: 'zhihu.com' },
  { id: 'baijiahao',   name: '百家号',     domain: 'baijiahao.baidu.com' },
  { id: 'toutiao',     name: '今日头条',   domain: 'toutiao.com' },
  { id: 'xueqiu',    name: '雪球',       domain: 'xueqiu.com' },
  { id: 'wechat_gzh', name: '微信公众号',  domain: 'weixin.sogou.com' },
  // 新闻平台
  { id: 'netease',     name: '网易新闻',   domain: 'news.163.com' },
  { id: 'sohu',        name: '搜狐号',     domain: 'sohu.com' },
  { id: 'tencent',     name: '腾讯新闻',   domain: 'news.qq.com' },
  { id: 'sina',        name: '新浪新闻',   domain: 'sina.com.cn' },
  { id: 'ifeng',       name: '凤凰新闻',   domain: 'ifeng.com' },
  // 短视频平台
  { id: 'aike_video',   name: '艾氪短视频', domain: 'douyin.com' },
  { id: 'jova_video',  name: 'JovaAI视频号', domain: 'video.msn.cn' },
];
```

### 7.3 搜索格式示例

```
"Dify site:zhihu.com"
"Coze 百家号"
"LangChain 雪球"
"Manus 今日头条"
```

### 7.4 搜索函数签名

```javascript
async function runPlatformIntelligence(competitorFile, platformIds): Promise<Object>
```

---

## 八、PRD Section 12 合规清单

| 项目 | 实现 | 状态 |
|------|------|------|
| 8个 Skills | goal-to-strategy → strategy-version-manager | ✅ |
| Strategy Card（16字段）| `buildStrategyCard()` 含所有必需字段 | ✅ |
| Stop/Scale/Pivot 决策 | stop-scale-decision.js | ✅ |
| 预算分配 | budget-allocator.js | ✅ |
| 策略版本管理 | strategy-version-manager.js | ✅ |
| 三账号 Narrative 约束 | narrative-constraint-generator.js（扩展版）| ✅ V5合并后生效 |
| Agent 9 反馈路由 | feedback-router.js（PRD合规） | ⚠️ 未被引用 |

---

## 九、文件索引

### 9.1 入口文件

| 文件 | 用途 |
|------|------|
| `agent4-core.js` | Skills 1-8 核心（programmatic调用） |
| `agent4-full-pipeline.js` | **主执行入口**，串联全Pipeline |
| `agent4-dashboard.js` | ⚠️ 废弃（chalk v5 ESM问题） |
| `agent4-report.py` | **推荐报告工具**（Python） |

### 9.2 Skills（按Pipeline顺序）

| Skill | 文件 | 功能 |
|-------|------|------|
| 1 | skills/goal-to-strategy.js | Campaign Goal → Strategic Bet |
| 2 | skills/value-proposition.js | JTBD + 证据 → VP |
| 3 | skills/narrative-arch.js | 30s/2min/完整版 |
| 4 | skills/channel-mix.js | 10平台渠道分配 |
| 5 | skills/experiment-design.js | A/B + 多臂老虎机 |
| 6 | skills/budget-allocator.js | 三级预算分配 + 实验周期 |
| 7 | skills/stop-scale-decision.js | ROI/置信度/样本量 → SCALE/CONTINUE/STOP/PIVOT |
| 8 | skills/strategy-version-manager.js | 版本历史 + Diff + 回滚 |
| 9 | skills/narrative-constraint-generator.js | 三账号约束（扩展版） |
| 6B | skills/platform-intelligence.js | 12平台竞品内容扫描 |
| 7B | skills/feedback-router.js | PRD合规完整路由（未被引用） |
| 7（Pipeline内）| skills/strategy-feedback-router.js | Pipeline内 Skill 7 |
| 8（Pipeline内）| skills/strategy-evolver.js | Pipeline内 Skill 8 |

### 9.3 Mock Data

| 文件 | 用途 |
|------|------|
| mock-data/agent1-campaign.json | Agent 1 输入 |
| mock-data/agent2-passport.json | Agent 2 输入 |
| mock-data/agent3-market.json | Agent 3 输入 |
| mock-data/competitor-list.json | 竞品名单 |
| mock-data/agent4-full-output.json | **完整Pipeline输出** |
| mock-data/agent4-complete-output.json | 简化输出 |
| mock-data/budget-allocation.json | 预算分配结果 |
| mock-data/output-strategy-card.json | Strategy Card 输出 |
| mock-data/narrative-constraints.json | Narrative 约束 |
| mock-data/narrative-constraints-extended.json | **扩展版 Narrative 约束** |
| mock-data/platform-intelligence-report.json | 平台情报报告 |
| mock-data/stop-scale-decision.json | Stop/Scale 决策 |
| mock-data/strategy-version-store.json | 版本历史存储 |
| mock-data/feedback-router-output.json | 反馈路由输出 |
| mock-data/strategy-card-html.json | Strategy Card HTML |
| mock-data/strategy-card-viewer.html | **Strategy Card HTML查看器** |
| mock-data/strategy-card.png | Strategy Card 可视化 |

### 9.4 目录结构

```
agent4/
├── agent4-core.js                  # Skills 1-8 核心入口
├── agent4-full-pipeline.js        # 完整 Pipeline 主入口
├── agent4-dashboard.js            # ⚠️ 废弃
├── agent4-report.py               # Python 报告工具
├── package.json
├── README.md
├── skills/                        # 9个 Skills 实现
│   ├── goal-to-strategy.js        # Skill 1
│   ├── value-proposition.js       # Skill 2
│   ├── narrative-arch.js          # Skill 3
│   ├── channel-mix.js             # Skill 4
│   ├── experiment-design.js       # Skill 5
│   ├── budget-allocator.js       # Skill 6
│   ├── stop-scale-decision.js     # Skill 7
│   ├── strategy-version-manager.js # Skill 8
│   ├── narrative-constraint-generator.js       # Skill 9
│   ├── narrative-constraint-generator-extended.js # Skill 9 扩展源码
│   ├── platform-intelligence.js   # Skill 6B（平台情报）
│   ├── feedback-router.js         # Skill 7B（PRD合规，未被引用）
│   ├── strategy-feedback-router.js # Pipeline内 Skill 7
│   ├── strategy-evolver.js        # Pipeline内 Skill 8
│   ├── ui/                       # UI 组件
│   └── legacy/                    # 废弃文件保留目录
├── mock-data/                     # 测试数据 & 输出
│   ├── agent1-campaign.json
│   ├── agent2-passport.json
│   ├── agent3-market.json
│   ├── competitor-list.json
│   ├── agent4-full-output.json
│   ├── ...
│   └── strategy-card-viewer.html  # Strategy Card 查看器
├── document/
│   └── AGENT4_SPEC.md             # 本文档
└── node_modules/
```

---

## 十、运行与验证

### 完整执行
```bash
cd /workspace/RISEN-OS/agent4
node agent4-full-pipeline.js
```

### 查看报告
```bash
python3 agent4-report.py
```

### 单独测试 Skill
```bash
node skills/narrative-constraint-generator.js
node skills/stop-scale-decision.js
```

### 查看 Strategy Card
```bash
# 打开 HTML 查看器
open mock-data/strategy-card-viewer.html
```

---

## 十一、版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| V1.0 | 2026-06-18 | 初始版本 |
| V1.1 | 2026-06-23 | 明确Pipeline入口区分，标注PRD来源，更正Feedback Router描述，补充Strategy Card字段详解 |

---

*本文档与 /workspace/RISEN-OS/document/AGENT45-OPTIMIZATION-V5.md 配套使用。*
