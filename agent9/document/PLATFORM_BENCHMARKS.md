# 平台基准数据

> 版本：v1.0
> 状态：v2.1 实施计划支撑文档
> 数据来源：行业公开报告 + 工程经验值

---

## 1. 基准数据说明

### 1.1 数据来源分级

| 级别 | 说明 | 可信度 |
|------|------|--------|
| A | 平台官方公开数据 | 高 |
| B | 行业研究报告 | 中 |
| C | 工程经验值（Mock 统计） | 低，需验证 |

### 1.2 为什么要区分 avgCTR 和 stdCTR

- **avgCTR（平均 CTR）**：该平台所有文章 CTR 的平均值，用于计算 Z-Score 的分子
- **stdCTR（标准差）**：该平台所有文章 CTR 的标准差，用于计算 Z-Score 的分母

stdCTR 反映了该平台文章表现的离散程度：
- std/mean 比例大（>50%）：平台文章表现差异大，需要更大的 CTR 差异才能判断有效
- std/mean 比例小（<30%）：平台文章表现相对一致，较小的 CTR 差异就有意义

---

## 2. 平台基准数据表

### 2.1 P0 国内平台

#### 微信公众号

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 2.5% | 行业公开报告 | B |
| 标准差 | 1.5% | Mock 统计 | C |
| Good CTR | 5.0% | avgCTR + 2×stdCTR | C |
| Excellent CTR | 8.0% | avgCTR + 3.7×stdCTR | C |

**说明**：微信公众号的 CTR 通常指"图文页阅读率"（打开率约 2-5%，阅读全文率更低）。本文档使用"点击图文链接的比率"，作为统一口径。

#### 知乎

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 3.5% | 知乎创作者公开数据 | B |
| 标准差 | 2.0% | Mock 统计 | C |
| Good CTR | 6.0% | avgCTR + 1.25×stdCTR | C |
| Excellent CTR | 10.0% | avgCTR + 3.25×stdCTR | C |

#### CSDN

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 3.0% | 技术社区统计 | B |
| 标准差 | 1.8% | Mock 统计 | C |
| Good CTR | 6.0% | avgCTR + 1.67×stdCTR | C |
| Excellent CTR | 10.0% | avgCTR + 3.9×stdCTR | C |

#### 掘金

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 3.0% | 技术社区统计 | B |
| 标准差 | 1.8% | Mock 统计 | C |
| Good CTR | 6.0% | avgCTR + 1.67×stdCTR | C |
| Excellent CTR | 10.0% | avgCTR + 3.9×stdCTR | C |

#### 百家号

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 3.0% | 工程经验值 | C |
| 标准差 | 2.0% | Mock 统计 | C |
| Good CTR | 6.0% | avgCTR + 1.5×stdCTR | C |
| Excellent CTR | 10.0% | avgCTR + 3.5×stdCTR | C |

#### 今日头条

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 4.0% | 行业公开报告 | B |
| 标准差 | 2.5% | Mock 统计 | C |
| Good CTR | 7.0% | avgCTR + 1.2×stdCTR | C |
| Excellent CTR | 12.0% | avgCTR + 3.2×stdCTR | C |

### 2.2 P0 海外平台

#### Dev.to

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 2.0% | Dev.to 官方博客 | A |
| 标准差 | 1.2% | Mock 统计 | C |
| Good CTR | 4.0% | avgCTR + 1.67×stdCTR | C |
| Excellent CTR | 8.0% | avgCTR + 5×stdCTR | C |

#### GitHub

| 指标 | 值 | 说明 | 来源 |
|------|-----|------|------|
| Star Rate | 0.5% | stars / impressions | 行业统计 |
| 标准差 | 0.3% | Mock 统计 | C |
| Good Star Rate | 1.5% | avg + 3.3×std | C |

**注意**：GitHub 不适用 CTR，用 Star Rate 替代：
- **impressions** = README 页面浏览量（views）
- **转化** = GitHub Stars
- **Star Rate** = Stars / Views

#### Medium

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 2.5% | 工程经验值 | C |
| 标准差 | 1.5% | Mock 统计 | C |
| Good CTR | 5.0% | avgCTR + 1.67×stdCTR | C |
| Excellent CTR | 8.0% | avgCTR + 3.67×stdCTR | C |

#### LinkedIn

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 2.0% | LinkedIn 营销博客 | A |
| 标准差 | 1.0% | Mock 统计 | C |
| Good CTR | 4.0% | avgCTR + 2×stdCTR | C |
| Excellent CTR | 6.0% | avgCTR + 4×stdCTR | C |

#### Hashnode

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 2.5% | 工程经验值 | C |
| 标准差 | 1.5% | Mock 统计 | C |
| Good CTR | 5.0% | avgCTR + 1.67×stdCTR | C |

#### Quora

| 指标 | 值 | 来源 | 级别 |
|------|-----|------|------|
| 平均 CTR | 2.0% | 工程经验值 | C |
| 标准差 | 1.2% | Mock 统计 | C |
| Good CTR | 4.0% | avgCTR + 1.67×stdCTR | C |

### 2.3 P1 国内平台

| 平台 | 平均 CTR | 标准差 | Good CTR | 来源级别 |
|------|---------|--------|---------|---------|
| 百度知道 | 3.0% | 2.0% | 6.0% | C |
| 百度经验 | 2.5% | 1.5% | 5.0% | C |
| 百度文库 | 2.0% | 1.0% | 4.0% | C |
| 语雀 | 2.5% | 1.5% | 5.0% | C |
| InfoQ | 3.0% | 1.8% | 6.0% | C |
| 36氪 | 3.5% | 2.0% | 7.0% | C |
| 虎嗅 | 3.0% | 2.0% | 6.0% | C |
| 钛媒体 | 3.0% | 2.0% | 6.0% | C |
| 博客园 | 2.5% | 1.5% | 5.0% | C |
| 开源中国 | 2.5% | 1.5% | 5.0% | C |
| SegmentFault | 3.0% | 1.8% | 6.0% | C |
| Gitee | Star Rate | 0.4% | 1.2% | C |

### 2.4 P1 海外平台

| 平台 | 平均 CTR | 标准差 | Good CTR | 来源级别 |
|------|---------|--------|---------|---------|
| Zenn | 2.0% | 1.2% | 4.0% | C |
| Qiita | 2.5% | 1.5% | 5.0% | C |
| note.com | 2.0% | 1.2% | 4.0% | C |

---

## 3. 数据更新机制

### 3.1 何时更新基准数据

当 Agent 9 积累了一定量的真实数据后（建议每季度）：

1. **计算真实 avgCTR**：对该平台所有真实数据（`__mock__: false`）的 CTR 做平均
2. **计算真实 stdCTR**：对该平台所有真实数据的 CTR 做标准差
3. **比较真实值 vs 当前配置值**：
   - 如果差异 > 20%，更新 `attribution-config.json`
   - 如果差异 ≤ 20%，记录观察，继续积累数据

### 3.2 如何验证基准数据质量

```javascript
// 示例：验证某平台基准数据质量
function validateBenchmark(platformId, realPerformances, configBenchmarks) {
  const realAvg = realPerformances.reduce((s, p) => s + p.metrics.ctr, 0) / realPerformances.length;
  const configAvg = configBenchmarks[platformId]?.avgCTR;

  if (!configAvg) return { status: 'missing', real: realAvg };

  const diff = Math.abs(realAvg - configAvg) / configAvg;
  return {
    status: diff > 0.2 ? 'needs_update' : 'ok',
    real: realAvg,
    config: configAvg,
    diff_pct: (diff * 100).toFixed(1) + '%'
  };
}
```

---

## 4. 免责说明

本文件中的基准数据：
- **A级数据**：来自平台官方，可直接使用
- **B级数据**：来自行业报告，可信度中等，可能存在口径差异
- **C级数据（工程经验值）**：来自 Mock 数据统计，**不作为真实依据**，仅用于开发阶段

当真实数据积累后，A/B/C 级数据都应以真实统计值替换。

---

*本基准数据表跟随 attribution-config.json 更新。*
