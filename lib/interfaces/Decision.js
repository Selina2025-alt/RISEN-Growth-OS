/**
 * Decision 接口 v1.2
 * 决策下发格式
 * @typedef {Object} Decision
 * @property {string} id
 * @property {string} type              'topic_boost'|'content_adjust'|'strategy_shift'
 * @property {string} source            固定：'agent9'
 * @property {string} target           'agent4'|'agent5'|'agent6'|'agent7'
 * @property {string} topic_id
 * @property {string} decision          'SCALE'|'CONTINUE'|'REDUCE'|'STOP'
 * @property {number} boost_score
 * @property {string} reason
 * @property {number} confidence
 * @property {string} recommended_action
 * @property {string} created_at        ISO 8601
 * @property {string} deduplication_key  topic_id:decision（TopicBoost）
 *                                           topic_id:agent:action（Insight）
 * @property {boolean} __retrospective__
 * @property {string[]} history         该 topic 的历史决策链（最近5条）
 */

module.exports = {};
