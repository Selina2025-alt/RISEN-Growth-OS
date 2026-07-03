/**
 * Dev.to Mock 适配器
 */
const { PlatformAdapter } = require('./interface');
const { makeArticlePerformance } = require('../interfaces/ArticlePerformance');

class DevToMockAdapter extends PlatformAdapter {
  constructor() {
    super('dev-to');
    this.avgCTR = 0.020;
    this.stdCTR = 0.012;
    this.contentForms = ['图文', '视频'];
  }

  async fetchPerformances(platformId, { startDate, endDate, topicIds } = {}) {
    const count = 3 + Math.floor(Math.random() * 6);
    return Array.from({ length: count }, (_, i) => {
      const ctr = Math.max(0.001, gaussRandom(this.avgCTR, this.stdCTR));
      const impressions = 1000 + Math.floor(Math.random() * 10000);
      const clicks = Math.round(impressions * ctr);
      return makeArticlePerformance({
        article_id: `ART-${Date.now()}-${random4()}`,
        topic_id: topicIds ? topicIds[i % topicIds.length] : `TOPIC-${random4()}`,
        platform: 'dev-to',
        published_at: randomDate(startDate, endDate),
        __mock__: true, __source__: 'mock',
        metrics: {
          impressions, clicks, ctr,
          conversions: Math.round(clicks * (0.005 + Math.random() * 0.015)),
          cvr: 0.005 + Math.random() * 0.015,
          shares: Math.floor(clicks * 0.1), likes: Math.floor(clicks * 0.2),
          comments: Math.floor(clicks * 0.03), avg_read_time: 120 + Math.floor(Math.random() * 300)
        },
        metadata: { content_form: pickOne(this.contentForms), topic_keywords: [] }
      });
    });
  }
}

function gaussRandom(mean, std) { const u = 1-Math.random(), v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)*std+mean; }
function random4() { return Math.floor(1000+Math.random()*9000).toString(); }
function randomDate(start, end) { const s=new Date(start).getTime(), e=new Date(end).getTime(); return new Date(s+Math.random()*(e-s)).toISOString(); }
function pickOne(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
module.exports = DevToMockAdapter;
