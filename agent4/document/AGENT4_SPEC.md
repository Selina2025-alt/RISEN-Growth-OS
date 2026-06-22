# Agent 4 · 策略与实验智能体
## 技术规格文档 V1.0

> 本文档是 Agent 4 的唯一权威技术规格。
> 无需查阅其他文档，按本文档可直接理解或实施 Agent 4 系统。

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
cd /workspace/risen-agent4
node agent4-full-pipeline.js      # 完整 Pipeline（Skill 1-9）
python3 agent4-report.py           # Terminal 报告（推荐）
```

---

## 二、Pipeline Step 1-9

```
Step 1: Agent 4 Core（Skill 1-5）
       goal-to-strategy.js         → Strategic Bet
       value-proposition.js        → JTBD Value Proposition
       narrative-arch.js          → 30s/2min/完整版 Narrative
       channel-mix.js             → 10个平台渠道分配
       design-experiment.js        → A/B Test + 多臂老虎机

Step 2: Skill 6: Platform Intelligence（联网搜索方案）
       platform-intelligence.js     → 12平台竞品内容扫描

Step 3: Skill 7: Feedback Router（Pipeline内轻量版）
       strategy-feedback-router.js  → 内容表现路由

Step 4: Skill 8: Strategy Evolver（Pipeline内版本更新）
       strategy-evolver.js         → Strategy Card 版本更新

Step 5: Skill 9: Narrative Constraint
       narrative-constraint-generator.js → 三账号约束（扩展版）
```

---

## 三、Skill 清单与边界

### 3.1 Skill 1-5（Core）

| # | Skill | 文件 | 功能 | PRD来源 |
|---|-------|------|------|---------|
| 1 | Goal → Strategy | goal-to-strategy.js | Campaign Goal → Strategic Bet | Section 12 |
| 2 | Value Proposition | value-proposition.js | JTBD + 证据 → VP | Section 12 |
| 3 | Narrative Architecture | narrative-arch.js | 30s/2min/完整版 | Section 12 |
| 4 | Channel Mix | channel-mix.js | 10平台渠道分配 | Section 12 |
| 5 | Experiment Design | experiment-design.js | A/B + 多臂老虎机 | Section 12 |

### 3.2 Skill 6（预算与Stop/Scale）

| # | Skill | 文件 | 功能 | PRD来源 |
|---|-------|------|------|---------|
| 6 | Budget Allocator | budget-allocator.js | 三级预算分配 + 实验周期 | Section 12 |
| 7 | Stop/Scale Decision | stop-scale-decision.js | ROI/置信度/样本量 → SCALE/CONTINUE/STOP/PIVOT | Section 12 |
| 8 | Strategy Version Manager | strategy-version-manager.js | 版本历史 + Diff + 回滚 | Section 12 |

### 3.3 Skill 7B（PRD合规，完整路由）

| # | Skill | 文件 | 功能 | PRD来源 |
|---|-------|------|------|---------|
| 7B | Feedback Router（PRD版）| feedback-router.js | Agent 9 → Agent 3/4/5/6 路由 | Section 17.4 |

### 3.4 Skill 9（Narrative约束）

| # | Skill | 文件 | 功能 | PRD来源 |
|---|-------|------|------|---------|
| 9 | Narrative Constraint | narrative-constraint-generator.js | Strategy Card → Agent 5 三账号约束 | Section 12 |

### 3.5 Pipeline内 Skill 7/8（非PRD编号）

| 文件 | Pipeline角色 | 说明 |
|------|------------|------|
| strategy-feedback-router.js | Skill 7（Pipeline内）| 轻量内容表现路由 |
| strategy-evolver.js | Skill 8（Pipeline内）| 策略版本更新 |

---

## 四、Feedback Router 双链路（现状）

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

## 五、PRD Section 12 合规清单

| 项目 | 实现 | 状态 |
|------|------|------|
| 8个 Skills | goal-to-strategy → strategy-version-manager | ✅ |
| Strategy Card（16字段）| `buildStrategyCard()` 含所有必需字段 | ✅ |
| Stop/Scale/Pivot 决策 | stop-scale-decision.js | ✅ |
| 预算分配 | budget-allocator.js | ✅ |
| 策略版本管理 | strategy-version-manager.js | ✅ |
| 三账号 Narrative 约束 | narrative-constraint-generator.js（扩展版）| ✅ V5合并后生效 |
| Agent 9 反馈路由 | feedback-router.js（PRD合规） | ⚠️ 未被引用 |

### Strategy Card 必需字段（PRD Section 12）

```
id, version, status, promoted_object, business_objective,
target_market, target_accounts, target_roles,
current_perception, target_perception,
value_proposition, narrative,
experiment_plan, channel_mix,
success_threshold, stop_conditions, scale_conditions,
risks, experiment_duration_weeks, budget_ceiling
```

---

## 六、平台情报（联网搜索方案）

### 6.1 方案说明

原方案（直接爬取）需要平台登录态，知乎/头条/百家号在无登录态下抓取为空。
新方案：通过 Bing 搜索"竞品名 site:平台域名"，获取各平台内容动态，无登录态限制。

### 6.2 12平台列表

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

### 6.3 搜索格式示例

```
"Dify site:zhihu.com"
"Coze 百家号"
"LangChain 雪球"
"Manus 今日头条"
```

### 6.4 搜索函数签名

```javascript
async function searchPlatformsViaWeb(competitors, platformIds): Promise<Object>
```

---

## 七、文件索引

| 文件 | 用途 |
|------|------|
| `agent4-core.js` | Skill 1-8 核心（programmatic调用）|
| `agent4-full-pipeline.js` | **主执行入口**，串联全Pipeline |
| `agent4-dashboard.js` | ⚠️ 废弃（chalk v5 ESM问题）|
| `agent4-report.py` | **推荐报告工具**（Python）|
| `skills/goal-to-strategy.js` | Skill 1 |
| `skills/value-proposition.js` | Skill 2 |
| `skills/narrative-arch.js` | Skill 3 |
| `skills/channel-mix.js` | Skill 4 |
| `skills/experiment-design.js` | Skill 5 |
| `skills/budget-allocator.js` | Skill 6 |
| `skills/stop-scale-decision.js` | Skill 7 |
| `skills/strategy-version-manager.js` | Skill 8 |
| `skills/narrative-constraint-generator.js` | Skill 9（**扩展版**，含三账号）|
| `skills/narrative-constraint-generator-extended.js` | Skill 9 扩展源码（覆盖后与上方相同）|
| `skills/platform-intelligence.js` | 平台情报（联网搜索）|
| `skills/feedback-router.js` | Skill 7B（PRD合规，未被引用）|
| `skills/strategy-feedback-router.js` | Pipeline内 Skill 7 |
| `skills/strategy-evolver.js` | Pipeline内 Skill 8 |
| `skills/legacy/` | 废弃文件保留目录 |
| `mock-data/agent1-campaign.json` | Agent 1 输入 |
| `mock-data/agent2-passport.json` | Agent 2 输入 |
| `mock-data/agent3-market.json` | Agent 3 输入 |
| `mock-data/agent4-full-output.json` | **完整Pipeline输出** |
| `mock-data/competitor-list.json` | 竞品名单 |
| `mock-data/strategy-card-viewer.html` | Strategy Card HTML查看器 |
| `document/AGENT4_SPEC.md` | 本文档 |

---

## 八、运行与验证

### 完整执行
```bash
cd /workspace/risen-agent4
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

---

*本文档与 /workspace/document/AGENT45-OPTIMIZATION-V5.md 配套使用。*
*V5文档包含完整的实施细节、问题根因、验证方法。*
