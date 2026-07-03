/**
 * ArticlePerformance 接口
 * 文章表现数据格式（Skill间传递的最小单元）
 */

/**
 * @typedef {Object} ArticleMetrics
 * @property {number} impressions   曝光量
 * @property {number} clicks       点击量
 * @property {number} ctr         clicks / impressions
 * @property {number} conversions  转化数
 * @property {number} cvr         conversions / clicks
 * @property {number} shares      转发数
 * @property {number} likes       点赞数
 * @property {number} comments    评论数
 * @property {number} avg_read_time 平均阅读时长（秒）
 */

/**
 * @typedef {Object} ArticlePerformance
 * @property {string} article_id       ART-{timestamp}-{random4}
 * @property {string} topic_id        选题 ID
 * @property {string|null} direction_id 方向 ID（可选）
 * @property {string} platform         平台 ID
 * @property {string} published_at    ISO 8601
 * @property {boolean} __mock__        true=模拟/false=真实
 * @property {string} __source__      'mock' | 'platform_api' | 'agent8'
 * @property {ArticleMetrics} metrics
 * @property {Object} metadata
 * @property {string} metadata.content_form    '图文'|'视频'|'短视频'|'问答'
 * @property {string[]} metadata.topic_keywords
 */

/**
 * 构建合规的 ArticlePerformance
 * @param {Object} data
 * @returns {ArticlePerformance}
 */
function makeArticlePerformance(data) {
  if (!data.article_id || !data.topic_id || !data.platform) {
    throw new Error('article_id, topic_id, platform 为必填字段');
  }
  const m = data.metrics || {};
  return {
    article_id: data.article_id,
    topic_id: data.topic_id,
    direction_id: data.direction_id || null,
    platform: data.platform,
    published_at: data.published_at || new Date().toISOString(),
    __mock__: data.__mock__ !== false,
    __source__: data.__source__ || 'unknown',
    metrics: {
      impressions:   m.impressions  || 0,
      clicks:        m.clicks       || 0,
      ctr:         m.ctr          || (m.impressions > 0 ? m.clicks / m.impressions : 0),
      conversions:   m.conversions  || 0,
      cvr:          m.cvr          || (m.clicks > 0 ? m.conversions / m.clicks : 0),
      shares:        m.shares       || 0,
      likes:         m.likes        || 0,
      comments:       m.comments     || 0,
      avg_read_time:  m.avg_read_time || 0,
    },
    metadata: data.metadata || {}
  };
}

module.exports = { makeArticlePerformance };
