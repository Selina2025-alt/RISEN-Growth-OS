/**
 * 平台适配器基类
 * 所有平台适配器必须继承此类
 */
class PlatformAdapter {
  constructor(platformId) {
    this.platformId = platformId;
  }

  /**
   * 拉取指定时间范围内的文章表现数据
   * @param {string} platformId
   * @param {Object} options
   * @param {string} options.startDate  ISO 8601
   * @param {string} options.endDate    ISO 8601
   * @param {string[]} [options.topicIds]
   * @returns {Promise<ArticlePerformance[]>}
   */
  async fetchPerformances(platformId, options) {
    throw new Error('NOT_IMPLEMENTED');
  }

  async healthCheck() {
    return { ok: true, message: 'OK' };
  }
}

module.exports = { PlatformAdapter };
