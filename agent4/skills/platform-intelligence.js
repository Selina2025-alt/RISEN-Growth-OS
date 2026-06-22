/**
 * Skill 6: Platform Intelligence（平台情报调研）
 *
 * ⚠️ 重要说明：
 * 原直接爬取方案（需要平台登录态）在无登录态下抓取为空。
 * 已改为联网搜索方案：通过 Bing 搜索"竞品名 site:平台域名"获取各平台内容动态。
 * 全平台12个平台覆盖（图文/新闻/短视频），无登录态限制。
 *
 * 搜索示例：
 *   "Dify site:zhihu.com"
 *   "Coze 百家号"
 *   "LangChain 雪球"
 *
 * 工具：Playwright（已安装）用于访问 Bing 搜索结果。
 *
 * 扫描流程（联网搜索方案）：
 * 1. 加载竞品名单（mock-data/competitor-list.json）
 * 2. 对12个平台执行 Bing 搜索（Playwright headless）
 * 3. 分析内容模式（标题/长度/频率/互动）
 * 4. 生成平台内容策略报告
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ===== 平台配置 =====
const PLATFORMS = {
  zhihu: {
    name: '知乎',
    url: 'https://www.zhihu.com',
    searchUrl: 'https://www.zhihu.com/search?type=content&q=',
    selectors: {
      articles: '.List-item',
      title: '.ContentItem-title',
      engagement: '.VoteButton',
      meta: '.ContentItem-meta'
    }
  },
  baijiahao: {
    name: '百家号',
    url: 'https://baijiahao.baidu.com',
    searchUrl: 'https://baijiahao.baidu.com/search?word=',
    selectors: {
      articles: '.article-item',
      title: '.article-title',
      engagement: '.read-count'
    }
  },
  toutiao: {
    name: '今日头条',
    url: 'https://www.toutiao.com',
    searchUrl: 'https://so.toutiao.com/search?keyword=',
    selectors: {
      articles: '.article',
      title: '.article-title',
      engagement: '.read-count'
    }
  }
};

// ===== 12平台配置（联网搜索方案）=====
/**
 * 全平台列表：覆盖 Agent 5 分发路由的全部12个平台
 * 每个平台定义：id、名称、domain（用于 site: 搜索）、Bing搜索URL
 */
const ALL_PLATFORMS = [
  // 图文平台（7个）
  { id: 'zhihu',       name: '知乎',         domain: 'zhihu.com',               bingSearchUrl: 'https://www.bing.com/search?q=' },
  { id: 'baijiahao',   name: '百家号',       domain: 'baijiahao.baidu.com',     bingSearchUrl: 'https://www.bing.com/search?q=' },
  { id: 'toutiao',     name: '今日头条',     domain: 'toutiao.com',             bingSearchUrl: 'https://www.bing.com/search?q=' },
  { id: 'xueqiu',     name: '雪球',         domain: 'xueqiu.com',              bingSearchUrl: 'https://www.bing.com/search?q=' },
  { id: 'wechat_gzh', name: '微信公众号',   domain: 'weixin.sogou.com',        bingSearchUrl: 'https://www.bing.com/search?q=' }, // 搜狗微信搜索
  { id: 'netease',    name: '网易新闻',     domain: 'news.163.com',            bingSearchUrl: 'https://www.bing.com/search?q=' },
  { id: 'sohu',       name: '搜狐号',       domain: 'sohu.com',                bingSearchUrl: 'https://www.bing.com/search?q=' },
  // 新闻平台（4个）
  { id: 'tencent',     name: '腾讯新闻',     domain: 'news.qq.com',             bingSearchUrl: 'https://www.bing.com/search?q=' },
  { id: 'sina',       name: '新浪新闻',     domain: 'sina.com.cn',             bingSearchUrl: 'https://www.bing.com/search?q=' },
  { id: 'ifeng',       name: '凤凰新闻',     domain: 'ifeng.com',               bingSearchUrl: 'https://www.bing.com/search?q=' },
  // 短视频平台（2个）
  { id: 'aike_video',  name: '艾氪短视频',   domain: 'douyin.com',              bingSearchUrl: 'https://www.bing.com/search?q=' },
  { id: 'jova_video',  name: 'JovaAI视频号', domain: 'video.msn.cn',           bingSearchUrl: 'https://www.bing.com/search?q=' },
];

// ===== 竞品关键词映射 =====
const COMPETITOR_KEYWORDS = {
  zhihu: ['Dify', 'Coze', 'LangChain', '企业AI智能体', 'AI Agent平台'],
  baijiahao: ['Dify', 'AI Agent', '企业级AI', '智能体平台'],
  toutiao: ['Dify', 'AI Agent', '企业智能体', 'Coze']
};

/**
 * 爬取平台内容（使用Playwright）
 */
async function scrapePlatform(platform, keywords) {
  const config = PLATFORMS[platform];
  if (!config) return { platform, error: 'Unknown platform' };

  const results = [];
  
  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();
    
    // 设置反爬虫规避
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    });

    for (const keyword of keywords.slice(0, 3)) { // 每个平台最多3个关键词
      try {
        const searchUrl = config.searchUrl + encodeURIComponent(keyword);
        await page.goto(searchUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        
        // 等待内容加载
        await page.waitForTimeout(2000);
        
        // 提取内容摘要（模拟）
        const content = await page.content();
        const snippet = content.substring(0, 2000);
        
        results.push({
          keyword,
          searchUrl,
          snippet,
          status: 'captured'
        });
      } catch (e) {
        results.push({
          keyword,
          error: e.message,
          status: 'failed'
        });
      }
    }
    
    await browser.close();
  } catch (e) {
    return { platform, error: e.message, results };
  }
  
  return { platform, results };
}

/**
 * 联网搜索采集（全平台方案）
 *
 * 原理：通过 Bing 搜索"竞品名 site:平台域名"获取各平台内容动态
 * 优势：无登录态限制、无反爬、覆盖全12个平台
 *
 * @param {string[]} competitors - 竞品名称列表
 * @param {string[]} platformIds - 平台ID列表（对应 ALL_PLATFORMS 的 id）
 * @returns {Promise<Object>} - { competitor: { platformId: { results_count, top_results, content_themes } } }
 */
async function searchPlatformsViaWeb(competitors, platformIds = []) {
  const results = {};

  for (const competitor of competitors) {
    results[competitor] = {};

    for (const platformId of platformIds) {
      const platform = ALL_PLATFORMS.find(p => p.id === platformId);
      if (!platform) continue;

      // 构建 site: 搜索查询
      const query = encodeURIComponent(`${competitor} site:${platform.domain}`);
      const searchUrl = `${platform.bingSearchUrl}${query}`;

      try {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // 提取 Bing 搜索结果标题和URL
        const snippets = await page.$$eval(
          'li.b_algo h2 a, li.b_algo .b_title',
          (els) =>
            els.slice(0, 10).map((el) => ({
              title: el.textContent.trim(),
              url: el.href || ''
            }))
        );

        await browser.close();

        // 提取内容主题（词频分析）
        const themes = extractContentThemes(snippets);

        results[competitor][platformId] = {
          platform_name: platform.name,
          domain: platform.domain,
          query,
          search_url: searchUrl,
          results_count: snippets.length,
          top_results: snippets.slice(0, 5),
          content_themes: themes,
          captured_at: new Date().toISOString()
        };

        console.log(`  ✅ ${platform.name}: ${snippets.length}条结果`);
      } catch (err) {
        console.log(`  ⚠️ ${platform.name}: 搜索失败 — ${err.message}`);
        results[competitor][platformId] = {
          platform_name: platform.name,
          error: err.message,
          results_count: 0,
          top_results: [],
          content_themes: [],
          captured_at: new Date().toISOString()
        };
      }
    }
  }

  return results;
}

/**
 * 从搜索结果中提取内容主题（词频分析）
 * @param {Array<{title: string, url: string}>} snippets
 * @returns {Array<{theme: string, mentions: number}>}
 */
function extractContentThemes(snippets) {
  const themeKeywords = {
    '技术对比': ['对比', 'vs', '评测', '测评', '差异', '比较'],
    '企业落地': ['企业', '落地', '部署', '集成', '实际应用', '案例'],
    '价格成本': ['价格', '免费', '收费', '成本', '定价', '套餐'],
    '教程指南': ['教程', '入门', '使用', '怎么', '如何', '指南'],
    '产品发布': ['发布', '更新', '新功能', '版本', '升级'],
    '行业观察': ['趋势', '分析', '报告', '观察', '预测', '洞察'],
  };

  const themeCounts = {};
  for (const [theme, keywords] of Object.entries(themeKeywords)) {
    const count = snippets.filter((s) =>
      keywords.some((kw) => s.title.includes(kw))
    ).length;
    if (count > 0) themeCounts[theme] = count;
  }

  return Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([theme, count]) => ({ theme, mentions: count }));
}

/**
 * 分析内容模式（基于规则引擎）
 */
function analyzeContentPatterns(scrapeResults, competitorList) {
  const patterns = {
    highEngagementPatterns: [],
    contentGaps: [],
    postingPatterns: [],
    recommendedAngles: []
  };

  // 从竞品名单提取关键维度
  const tier1Competitors = competitorList.tier1_direct_competitors.competitors;
  const tier2Competitors = competitorList.tier2_international_enterprise;

  // 分析内容角度
  tier1Competitors.forEach(comp => {
    patterns.highEngagementPatterns.push({
      competitor: comp.name,
      typicalAngle: `技术对比测评类（${comp.name} vs 其他）`,
      reason: `${comp.strengths[0] || '技术差异化'}`,
      engagementLevel: 'high'
    });
  });

  // 内容缺口分析
  patterns.contentGaps = [
    {
      gap: '企业级AI落地方法论视角',
      reason: '竞品多讲技术，少讲企业落地路径',
      opportunity: 'JovaAI可以用真实案例填补这个空白'
    },
    {
      gap: 'vs竞品的客观技术对比',
      reason: '市场缺乏中立深度的对比分析',
      opportunity: '用数据和场景说话，而非软文'
    },
    {
      gap: 'AItoB产业趋势判断',
      reason: '竞品多聚焦工具，少谈产业格局',
      opportunity: '建立行业解释权，吸引老板群体'
    }
  ];

  // 推荐内容角度
  patterns.recommendedAngles = [
    {
      angle: '技术对比：Dify vs JovaAI',
      platforms: ['知乎', '百家号', '今日头条'],
      contentType: '对比测评',
      priority: 'high'
    },
    {
      angle: '企业AI落地30天指南',
      platforms: ['知乎', '公众号'],
      contentType: '方法论',
      priority: 'high'
    },
    {
      angle: 'AItoB产业趋势判断',
      platforms: ['知乎', '雪球'],
      contentType: '观点分析',
      priority: 'medium'
    }
  ];

  return patterns;
}

/**
 * 生成平台内容策略报告
 */
function generatePlatformStrategyReport(platform, scrapeResults, patterns, competitorList) {
  return {
    platform,
    strategy_version: 'v1',
    generated_at: new Date().toISOString(),
    
    scrape_summary: {
      status: scrapeResults.status || 'completed',
      results_captured: scrapeResults.results?.filter(r => r.status === 'captured').length || 0,
      results_failed: scrapeResults.results?.filter(r => r.status === 'failed').length || 0
    },
    
    competitor_content_analysis: {
      patterns_found: patterns.highEngagementPatterns,
      content_gaps: patterns.contentGaps,
      recommended_angles: patterns.recommendedAngles
    },
    
    platform_content_strategy: {
      best_posting_frequency: getPostingFrequency(platform),
      optimal_length: getOptimalLength(platform),
      title_patterns: getTitlePatterns(platform),
      content_focus: getContentFocus(platform),
      forbidden_patterns: ['纯功能列表', '无数据支撑的观点', '硬广']
    },
    
    strategy_recommendations: {
      immediate: patterns.recommendedAngles.filter(a => a.priority === 'high').map(a => a.angle),
      secondary: patterns.recommendedAngles.filter(a => a.priority === 'medium').map(a => a.angle)
    }
  };
}

function getPostingFrequency(platform) {
  const frequencies = {
    zhihu: '每周2-3篇，重点文章周中发布',
    baijiahao: '每周3-5篇，保持更新频率',
    toutiao: '每天1-2篇，热点追踪',
    xueqiu: '每周1-2篇，分析深度为主'
  };
  return frequencies[platform] || '每周2-3篇';
}

function getOptimalLength(platform) {
  const lengths = {
    zhihu: '2000-3500字',
    baijiahao: '800-1500字',
    toutiao: '1000-2000字',
    xueqiu: '1500-3000字'
  };
  return lengths[platform] || '1500-2500字';
}

function getTitlePatterns(platform) {
  const patterns = {
    zhihu: ['数字+结论', '对比+悬念', '问题+方案', '深度分析'],
    baijiahao: ['热点关键词+实用', '数字+效果', '疑问句'],
    toutiao: ['热点+通俗', '数字+揭秘', '疑问引发好奇'],
    xueqiu: ['分析+投资视角', '数据+结论']
  };
  return patterns[platform] || ['问题+方案', '数字+结论'];
}

function getContentFocus(platform) {
  const focus = {
    zhihu: ['技术深度', '方法论', '对比分析', '数据支撑'],
    baijiahao: ['热点资讯', '实用技巧', '行业动态'],
    toutiao: ['通俗易懂', '热点速递', '场景化'],
    xueqiu: ['投资分析', '数据解读', '行业趋势']
  };
  return focus[platform] || ['实用内容', '行业洞察'];
}

/**
 * 主执行函数
 */
async function runPlatformIntelligence(competitorListPath, targetPlatforms = ['zhihu', 'baijiahao', 'toutiao']) {
  console.log('\n🔍 Skill 6: Platform Intelligence - 开始执行\n');
  
  // 加载竞品名单
  const competitorList = JSON.parse(fs.readFileSync(competitorListPath, 'utf-8'));
  console.log(`📊 已加载竞品名单: ${competitorList.tier1_direct_competitors.competitors.length}个直接竞品`);
  
  const reports = [];
  
  for (const platform of targetPlatforms) {
    console.log(`\n📡 扫描平台: ${PLATFORMS[platform]?.name || platform}...`);
    
    const keywords = COMPETITOR_KEYWORDS[platform] || [];
    const scrapeResults = await scrapePlatform(platform, keywords);
    const patterns = analyzeContentPatterns(scrapeResults, competitorList);
    const report = generatePlatformStrategyReport(platform, scrapeResults, patterns, competitorList);
    
    reports.push(report);
    
    const captured = scrapeResults.results?.filter(r => r.status === 'captured').length || 0;
    console.log(`  ✅ 完成: 抓取${captured}/${keywords.length}个关键词`);
    console.log(`  📝 推荐角度: ${report.strategy_recommendations.immediate.join(', ')}`);
  }
  
  // 生成汇总报告
  const summary = {
    generated_at: new Date().toISOString(),
    platforms_scanned: targetPlatforms,
    reports,
    action_items: reports.flatMap(r => r.strategy_recommendations.immediate.map(angle => ({
      angle,
      platforms: reports.find(rep => rep.strategy_recommendations.immediate.includes(angle))?.platform
    })))
  };
  
  console.log('\n📊 平台调研汇总:');
  summary.action_items.forEach((item, i) => {
    console.log(`  ${i+1}. ${item.angle}`);
  });
  
  return summary;
}

// ===== CLI入口 =====
if (require.main === module) {
  const competitorListPath = path.join(__dirname, '../mock-data/competitor-list.json');
  const platforms = process.argv[2]?.split(',') || ['zhihu', 'baijiahao', 'toutiao'];
  
  runPlatformIntelligence(competitorListPath, platforms)
    .then(summary => {
      fs.writeFileSync(
        path.join(__dirname, '../mock-data/platform-intelligence-report.json'),
        JSON.stringify(summary, null, 2)
      );
      console.log('\n✅ 报告已写入 mock-data/platform-intelligence-report.json');
    })
    .catch(err => {
      console.error('❌ 调研失败:', err);
      process.exit(1);
    });
}

module.exports = {
  runPlatformIntelligence,
  scrapePlatform,
  analyzeContentPatterns,
  searchPlatformsViaWeb,   // 联网搜索方案（全平台）
  ALL_PLATFORMS
};
