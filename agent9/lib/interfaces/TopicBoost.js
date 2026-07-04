/**
 * TopicBoost 接口
 * 归因计算输出
 */

/**
 * @typedef {Object} TopicBoost
 * @property {string} topic_id
 * @property {number} total_impressions
 * @property {number} total_clicks
 * @property {number} total_conversions
 * @property {number} avg_ctr
 * @property {number} avg_cvr
 * @property {number|null} z_score            Z-Score（多平台时为 null）
 * @property {number|null} platform_avg_ctr  平台平均 CTR（多平台时为 null）
 * @property {number|null} platform_std_ctr   平台 CTR 标准差（多平台时为 null）
 * @property {number|null} ratio_to_benchmark 仅用于无 stdCTR 的平台
 * @property {string} model_used              'linear'|'time_decay'|'position_based'
 * @property {string} decision               'SCALE'|'CONTINUE'|'REDUCE'|'STOP'
 * @property {number} boost_score           0.0 ~ 1.2
 * @property {number} confidence             0.45 ~ 0.95
 * @property {string[]} source_articles
 * @property {string[]} platforms
 * @property {string} computed_at
 * @property {boolean} __mock__
 * @property {boolean} __retrospective__    是否为回溯修正结果
 * @property {Object} __config__
 */

/**
 * 生成 Decision ID
 * 格式：DEC-{YYYYMMDD}-{HHmm}-{ssss}
 */
function makeDecisionId() {
  const d = new Date();
  const pad = (n, w) => String(n).padStart(w, '0');
  return [
    'DEC',
    `${d.getFullYear()}${pad(d.getMonth()+1,2)}${pad(d.getDate(),2)}`,
    `${pad(d.getHours(),2)}${pad(d.getMinutes(),2)}`,
    pad(Math.floor(Math.random() * 9999), 4)
  ].join('-');
}

module.exports = { makeDecisionId };
