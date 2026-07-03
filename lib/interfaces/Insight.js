/**
 * Insight 接口
 * 洞察输出
 */

/**
 * @typedef {Object} Insight
 * @property {string} id                 INS-{timestamp}-{random4}
 * @property {string} type               'topic_efficiency'|'content_form_analysis'
 * @property {string} topic_id
 * @property {string} category           'topic'|'content'|'strategy'
 * @property {string} summary            一句话总结
 * @property {string} detail             详细分析
 * @property {string[]} platforms
 * @property {number} confidence         0.45 ~ 0.95
 * @property {string} recommended_action  'SCALE'|'REDUCE'|'REVIEW'|'PROMOTE_FORM'
 * @property {string} target_agent       'agent4'|'agent5'|'agent6'|'agent7'
 * @property {string} computed_at
 * @property {string} [best_form]       content_form_analysis 时有
 * @property {string} [worst_form]      content_form_analysis 时有
 */

module.exports = {};
