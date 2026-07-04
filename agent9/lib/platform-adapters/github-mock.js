/**
 * GitHub Mock 适配器
 * 不适用 CTR，使用 Star Rate
 */
const { PlatformAdapter } = require('./interface');
const { makeArticlePerformance } = require('../interfaces/ArticlePerformance');

class GithubMockAdapter extends PlatformAdapter {
  constructor() {
    super('github');
    this.benchStarRate = 0.005;  // 行业平均 ≈ 0.5%
    this.stdStarRate = 0.003;
  }

  async fetchPerformances(platformId, { startDate, endDate, topicIds } = {}) {
    const count = 2 + Math.floor(Math.random() * 4);
    return Array.from({ length: count }, (_, i) => {
      const starRate = Math.max(0.0001, gaussRandom(this.benchStarRate, this.stdStarRate));
      const impressions = 1000 + Math.floor(Math.random() * 5000);
      const stars = Math.round(impressions * starRate);
      return makeArticlePerformance({
        article_id: `ART-${Date.now()}-${random4()}`,
        topic_id: topicIds ? topicIds[i % topicIds.length] : `TOPIC-${random4()}`,
        platform: 'github',
        published_at: randomDate(startDate, endDate),
        __mock__: true, __source__: 'mock',
        metrics: {
          impressions,
          clicks: impressions,   // 进入页面=点击
          ctr: starRate,         // 用 star_rate 替代 CTR
          conversions: stars,     // Star 视为转化
          cvr: 1.0,
          shares: Math.floor(stars * 0.3),
          likes: stars,
          comments: Math.floor(stars * 0.1),
          avg_read_time: 30 + Math.floor(Math.random() * 120)
        },
        metadata: { content_form: '图文', topic_keywords: [] }
      });
    });
  }
}

function gaussRandom(mean, std) { const u = 1-Math.random(), v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*std+mean; }
function random4() { return Math.floor(1000+Math.random()*9000).toString(); }
function randomDate(start, end) { const s=new Date(start).getTime(), e=new Date(end).getTime(); return new Date(s+Math.random()*(e-s)).toISOString(); }
module.exports = GithubMockAdapter;
