/**
 * seo-keyword-research.js
 * P1: SEO 关键词研究 Skill
 *
 * 功能：
 *   1. 基于选题和行业生成关键词簇（keyword clusters）
 *   2. 分析关键词竞争度和搜索意图
 *   3. 为不同平台生成关键词分组
 *   4. 输出关键词策略建议
 *
 * 输入：
 *   {
 *     topic_title: string,
 *     content_type: string,
 *     platform: string,
 *     existing_keywords: string[],
 *     competitor_keywords: string[],
 *     topic_description: string,
 *   }
 *
 * 输出：
 *   {
 *     clusters: [{ cluster_id, head_term, keywords: [], difficulty, intent }],
 *     primary_keywords: string[],
 *     secondary_keywords: string[],
 *     long_tail_keywords: string[],
 *     platform_keywords: { [platform]: { keywords: [], focus: string } },
 *     recommendations: string[],
 *   }
 */

const STOPWORDS = new Set([
  '的', '了', '是', '在', '和', '有', '这', '那', '就', '也', '都', '而', '及',
  '与', '一个', '没有', '什么', '怎么', '可以', '这个', '那个', '如何',
]);

const INTENT_MAP = {
  informational: ['是什么', '如何', '怎么', '教程', '指南', '方法', '原理', '区别'],
  transactional: ['多少钱', '价格', '购买', '咨询', '试用', '预约'],
  commercial: ['推荐', '最好', '对比', '评测', '排行榜', '哪个'],
  navigational: ['官网', '入口', '登录', '下载'],
};

// ============ 主入口 ============

function run(opts = {}) {
  const { topic_title, content_type = 'analysis', platform, existing_keywords = [], competitor_keywords = [], topic_description = '' } = opts;

  // 1. 提取种子词
  const seedTerms = extractSeedTerms(topic_title, topic_description);

  // 2. 生成关键词簇
  const clusters = buildClusters(seedTerms, content_type);

  // 3. 合并已有+竞品词
  const allKw = mergeAllKeywords(seedTerms, existing_keywords, competitor_keywords);

  // 4. 分级
  const { primary, secondary, long_tail } = rankKeywords(allKw, clusters);

  // 5. 平台分组
  const platformKeywords = groupByPlatform(primary, secondary, platform);

  // 6. 策略建议
  const recommendations = generateRecommendations(clusters, primary, secondary, platform);

  return {
    clusters,
    primary_keywords: primary,
    secondary_keywords: secondary,
    long_tail_keywords: long_tail,
    platform_keywords: platformKeywords,
    recommendations,
    _meta: { topic_title, content_type, cluster_count: clusters.length },
  };
}

// ============ 词典（不依赖外部库）============

/**
 * 行业词典（覆盖常见商业/技术词，不限于当前项目）
 * 规模约200词，可按需扩充
 */
const DICT = new Set([
  // 核心商业词
  '企业', '公司', '业务', '市场', '客户', '品牌', '产品', '服务', '运营', '管理',
  '数字化', '转型', '智能化', '自动化', '数智化', '信息化', '数据化',
  'AI', '人工智能', '大模型', 'LLM', 'AGI', '机器学习', '深度学习', '神经网络',
  'Agent', '智能体', '多Agent', '协作', '工作流', '自动化流程',
  '知识库', '知识图谱', '向量数据库', 'RAG', '检索增强生成',
  '平台', '系统', '工具', '软件', '解决方案', '产品矩阵',
  '效率', '成本', '增长', '营收', '利润', '规模', '增速', '渗透率',
  '营销', '获客', '转化', '留存', '复购', '裂变',
  '运营', '流程', '供应链', '库存', '仓储', '物流',
  // 技术词
  '技术', '架构', '研发', '开发', '测试', '部署', '运维', '监控',
  'API', 'SDK', '接口', '协议', '模块', '组件', '服务', '微服务',
  '云', '云计算', '私有云', '公有云', '混合云', 'SaaS', 'PaaS', 'IaaS',
  '大数据', '数据分析', '数据中台', '数据仓库', '数据湖', '实时数据',
  '安全', '隐私', '合规', '加密', '权限', '审计',
  '选型', '实施', '路径', '策略', '方案', '规划', '落地', '推行',
  // 行业词
  '制造', '制造业', '零售', '金融', '医疗', '教育', '政务', '电商', '餐饮', '旅游',
  '案例', '分析', '研究', '报告', '白皮书', '论文', '数据', '统计',
  '方法', '指南', '教程', '技巧', '攻略', '经验', '心得', '分享',
  '趋势', '现状', '发展', '前景', '未来', '机会', '挑战', '问题',
  '传统', '新兴', '新兴技术', '创新', '颠覆', '变革', '升级', '演进',
  '用户', '消费者', '受众', '人群', '画像', '需求', '痛点', '场景',
  '体验', '感知', '满意', '口碑', '评价', '反馈', '建议',
  '团队', '组织', '个人', '员工', '管理层', '领导', '老板', '创业者',
  '决策', '战略', '战术', '执行', '落地', '复盘', '总结',
  '开始', '结束', '结果', '效果', '价值', '意义', '作用', '功能', '特性', '优势', '劣势',
]);

// 正向最大匹配（FMM）分词器
function segmentChinese(text) {
  const result = [];
  let i = 0;
  while (i < text.length) {
    let matched = false;
    // 优先匹配最长词（8字→2字）
    const maxLen = Math.min(8, text.length - i);
    for (let len = maxLen; len >= 2; len--) {
      const word = text.slice(i, i + len);
      if (DICT.has(word)) {
        result.push(word);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1; // OOV词跳过
  }
  return result;
}

// ============ 种子词提取 ============

function extractSeedTerms(title, description) {
  const allText = `${title || ''} ${description || ''}`;
  // 英文词（3+字符）
  const english = (allText.match(/[a-zA-Z]{3,15}/g) || []).map(w => w.toLowerCase());
  // 中文词典分词
  const chinese = segmentChinese(allText);
  const combined = [...chinese, ...english];
  // 停用词和过短词过滤
  const filtered = combined.filter(w => !STOPWORDS.has(w) && w.length >= 2);
  // 取前12个唯一词
  return [...new Set(filtered)].slice(0, 12);
}

// ============ 关键词簇 ============

function buildClusters(seedTerms, contentType) {
  return seedTerms.slice(0, 6).map((term, i) => ({
    cluster_id: `C-${i + 1}`,
    head_term: term,
    keywords: buildVariants(term),
    difficulty: estimateDifficulty(term),
    intent: inferIntent(term, contentType),
  }));
}

function buildVariants(term) {
  // 基础变体
  const list = [term];
  // 加前缀
  ['如何', '怎么', '什么', '为什么'].forEach(p => {
    if (!term.startsWith(p)) list.push(p + term);
  });
  // 加后缀
  ['方法', '指南', '教程', '技巧', '方案'].forEach(s => {
    if (!term.endsWith(s)) list.push(term + s);
  });
  // 特殊组合
  list.push(`${term}是什么`, `${term}和${term}的区别`);
  return [...new Set(list)].slice(0, 10);
}

function estimateDifficulty(term) {
  if (['如何', '什么', '怎么'].some(p => term.includes(p))) return 'low';
  if (['平台', '系统', '工具', '软件'].some(w => term.includes(w))) return 'medium';
  if (term.length <= 3) return 'high';
  return 'medium';
}

function inferIntent(term, contentType) {
  for (const [intent, patterns] of Object.entries(INTENT_MAP)) {
    if (patterns.some(p => term.includes(p))) return intent;
  }
  const map = { tutorial: 'informational', case_study: 'informational', analysis: 'commercial' };
  return map[contentType] || 'informational';
}

// ============ 关键词合并 ============

function mergeAllKeywords(seedTerms, existing, competitor) {
  const set = new Set(seedTerms);
  [...existing, ...competitor].forEach(k => {
    const terms = (k.match(/[\u4e00-\u9fa5]{2,8}|[a-zA-Z]{3,}/g) || []);
    terms.forEach(t => { if (!STOPWORDS.has(t)) set.add(t.toLowerCase()); });
  });
  return [...set];
}

// ============ 关键词分级 ============

function rankKeywords(allKeywords, clusters) {
  const heads = new Set(clusters.map(c => c.head_term));
  const primary = allKeywords.filter(k => heads.has(k) || k.length <= 6).slice(0, 8);
  const secondary = allKeywords.filter(k => !primary.includes(k) && k.length <= 10).slice(0, 15);
  const long_tail = allKeywords.filter(k => !primary.includes(k) && !secondary.includes(k)).slice(0, 20);
  return { primary, secondary, long_tail };
}

// ============ 平台分组 ============

function groupByPlatform(primary, secondary, targetPlatform) {
  const all = [...primary, ...secondary];
  const groups = {
    zhihu:     { keywords: all.slice(0, 5), focus: '问题导向、深度分析' },
    wechat_gzh: { keywords: primary.slice(0, 3), focus: '品牌词、核心价值词' },
    csdn:      { keywords: all.filter(k => /[方法|教程|技术|原理]/.test(k)).slice(0, 5), focus: '技术词、实操词' },
    xiaohongshu: { keywords: [...primary.slice(0, 2), ...all.filter(k => /[攻略|体验|测评]/.test(k)).slice(0, 3)], focus: '种草词、体验词' },
    baidu:     { keywords: all.slice(0, 8), focus: '核心词+长尾词混合' },
  };
  return targetPlatform && groups[targetPlatform] ? { [targetPlatform]: groups[targetPlatform] } : groups;
}

// ============ 策略建议 ============

function generateRecommendations(clusters, primary, secondary, platform) {
  const recs = [];
  recs.push(`标题包含主关键词"${primary[0] || clusters[0]?.head_term}"，长度≤30字`);
  recs.push('H1与H2使用不同变体，避免关键词堆砌');

  const hard = clusters.find(c => c.difficulty === 'high');
  if (hard) {
    const alt = hard.keywords.find(k => k !== hard.head_term) || hard.head_term;
    recs.push(`"${hard.head_term}"竞争度高，建议用长尾变体"${alt}"切入`);
  }

  const tips = { zhihu: '标题加"深度"或"解析"，正文加FAQ结构', wechat_gzh: '标题≤20字，突出悬念或数字', csdn: '标题加技术标签词如"实战"', xiaohongshu: '标题emoji+关键词，结尾加标签' };
  if (platform && tips[platform]) recs.push(`【${platform}技巧】${tips[platform]}`);

  recs.push('长尾关键词处添加内链，每500字≥1个');
  return recs;
}

// ============ CLI ============

if (require.main === module) {
  const result = run({
    topic_title: '企业如何通过AI实现数字化转型',
    content_type: 'analysis',
    platform: 'zhihu',
    existing_keywords: ['AI转型', '企业数字化'],
    competitor_keywords: ['数字化转型方案', 'AI落地工具'],
    topic_description: '探讨企业如何利用AI技术实现数字化转型，包括技术选型、实施路径和案例分析',
  });

  console.log('\nSEO Keyword Research 输出\n');
  console.log('主关键词簇：');
  result.clusters.forEach(c => console.log(`  [${c.cluster_id}] ${c.head_term} (${c.difficulty}) - ${c.intent}`));
  console.log(`\nPrimary: ${result.primary_keywords.join(', ')}`);
  console.log(`Secondary: ${result.secondary_keywords.slice(0, 8).join(', ')}...`);
  console.log(`\n平台分组(zhihu): ${result.platform_keywords.zhihu?.keywords.join(', ')}`);
  console.log('\n策略建议：');
  result.recommendations.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  console.log('\n');
}

module.exports = { run };
