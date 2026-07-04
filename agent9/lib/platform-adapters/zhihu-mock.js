/**
 * 知乎 Mock 适配器
 */
const { PlatformAdapter } = require('./interface');
const { makeArticlePerformance } = require('../interfaces/ArticlePerformance');

class ZhihuMockAdapter extends PlatformAdapter {
  constructor() {
    super('zhihu');
    this.avgCTR = 0.035;
    this.stdCTR = 0.020;
    this.contentForms = ['图文', '视频', '问答'];
  }

  async fetchPerformances(platformId, { startDate, endDate, topicIds } = {}) {
    const count = 3 + Math.floor(Math.random() * 6);
    return Array.from({ length: count }, (_, i) => {
      const ctr = Math.max(0.001, gaussRandom(this.avgCTR, this.stdCTR));
      const impressions = 3000 + Math.floor(Math.random() * 30000);
      const clicks = Math.round(impressions * ctr);
      return makeArticlePerformance({
        article_id: `ART-${Date.now()}-${random4()}`,
        topic_id: topicIds ? topicIds[i % topicIds.length] : `TOPIC-${random4()}`,
        platform: 'zhihu',
        published_at: randomDate(startDate, endDate),
        __mock__: true, __source__: 'mock',
        metrics: {
          impressions, clicks, ctr,
          conversions: Math.round(clicks * (0.005 + Math.random() * 0.02)),
          cvr: 0.005 + Math.random() * 0.02,
          shares: Math.floor(clicks * 0.08), likes: Math.floor(clicks * 0.15),
          comments: Math.floor(clicks * 0.05), avg_read_time: 90 + Math.floor(Math.random() * 300)
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
module.exports = ZhihuMockAdapter;
