/**
 * source-discovery-skill.js
 * P1: 原始来源发现 Skill（接 RAGFlow）
 *
 * 用途：为文章发现权威原始来源
 *
 * 输入：
 *   { topic: string, keywords: string[], limit: number }
 *
 * 输出：
 *   [{
 *     title, url, snippet,
 *     authority: 'academic'|'report'|'expert'|'case',
 *     relevance: 0-1
 *   }]
 *
 * 接入说明：
 *   1. 部署 RAGFlow（Apache-2.0）https://github.com/infiniflow/ragflow
 *   2. 替换 MOCK_IMPLEMENTATION 为真实 API 调用
 */

const MOCK_IMPLEMENTATION = true; // TODO: 上线前改为 false

// ============ 主入口 ============

async function discoverSources({ topic, keywords = [], limit = 10 } = {}) {
  if (MOCK_IMPLEMENTATION) {
    return mockDiscover(topic, keywords, limit);
  }
  return realDiscover(topic, keywords, limit);
}

// ============ Mock 实现（开发/测试用）============

function mockDiscover(topic, keywords, limit) {
  // 返回模拟权威来源
  const mockSources = [
    {
      title: `${topic}深度研究报告（2024）`,
      url: 'https://example.com/research/' + encodeURIComponent(topic),
      snippet: `本文系统性地分析了${topic}的核心趋势、关键技术路径和商业化前景，数据来源于对全球200+企业的调研。`,
      authority: 'report',
      relevance: 0.95,
      source_name: '艾氪研究院',
    },
    {
      title: `斯坦福HAI《Generative Engines and Search》`,
      url: 'https://hai.stanford.edu/research/generative-engines',
      snippet: `大模型对结构化、引用丰富的内容引用率提升3-5倍，相关性系数r=0.345。`,
      authority: 'academic',
      relevance: 0.92,
      source_name: 'Stanford HAI',
    },
    {
      title: `HubSpot 2024内容营销状态报告`,
      url: 'https://hubspot.com/state-of-marketing',
      snippet: `68%的B2B企业已将GEO纳入内容策略，87%报告了可测量的效果提升。`,
      authority: 'report',
      relevance: 0.88,
      source_name: 'HubSpot',
    },
    {
      title: `如何系统性地优化内容以提升AI引用率`,
      url: 'https://example.com/gem-ai-content-optimization',
      snippet: `本文介绍了12维内容优化框架，通过结构化、证据增强和语义优化提升内容在AI搜索引擎中的可见度。`,
      authority: 'expert',
      relevance: 0.85,
      source_name: '行业专家博客',
    },
    {
      title: `${topic}最佳实践案例集`,
      url: 'https://example.com/case-studies/' + encodeURIComponent(topic),
      snippet: `汇集了20个行业头部企业的${topic}实施案例，涵盖制造、金融、零售等主要领域。`,
      authority: 'case',
      relevance: 0.80,
      source_name: '案例库',
    },
  ];

  // 按关键词过滤
  const kws = [topic, ...keywords].map(k => k.toLowerCase());
  const filtered = mockSources.filter(s =>
    kws.some(k => s.title.includes(k) || s.snippet.includes(k))
  );

  // 如果没有匹配，返回前limit条
  return (filtered.length >= limit ? filtered.slice(0, limit) : mockSources).slice(0, limit)
    .map(s => ({ ...s, topic }));
}

// ============ 真实接入（RAGFlow API）============

/**
 * RAGFlow API 调用
 *
 * 接入步骤：
 * 1. docker-compose up -d ragflow（自部署或用云服务）
 * 2. 获取 API_KEY
 * 3. 配置环境变量 RAGFLOW_API_KEY / RAGFLOW_BASE_URL
 * 4. 将 MOCK_IMPLEMENTATION 改为 false
 */
async function realDiscover(topic, keywords, limit) {
  const apiKey = process.env.RAGFLOW_API_KEY;
  const baseUrl = process.env.RAGFLOW_BASE_URL || 'http://localhost:9380';

  if (!apiKey) {
    console.warn('[source-discovery] RAGFLOW_API_KEY not set, falling back to mock');
    return mockDiscover(topic, keywords, limit);
  }

  const query = [topic, ...keywords].join(' ');
  const response = await fetch(`${baseUrl}/api/v1/retrieval`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: query,
      top_k: limit,
      dataset_ids: [], // 空=全库搜索
    }),
  });

  if (!response.ok) {
    throw new Error(`RAGFlow API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return (data.data || []).map(item => ({
    title: item.document_name || item.chunk_text,
    url: item.document_id ? `${baseUrl}/document/${item.document_id}` : null,
    snippet: item.chunk_text,
    authority: scoreAuthority(item.source || item.document_name),
    relevance: item.vector_distance ? 1 - item.vector_distance : 0.8,
    source_name: item.source || 'RAGFlow',
  }));
}

/**
 * 根据来源名称评估权威等级
 */
function scoreAuthority(source) {
  const s = source.toLowerCase();
  if (/stanford|mit|harvard|ieee|acm|nature|science/i.test(s)) return 'academic';
  if (/gartner|mckinsey|forrester|idc|hubspot|semrush/i.test(s)) return 'report';
  if (/博士|院士|专家|教授/i.test(s)) return 'expert';
  return 'case';
}

// ============ CLI ============

if (require.main === module) {
  const topic = process.argv[2] || 'AI数字化转型';
  const keywords = (process.argv[3] || '').split(',').filter(Boolean);

  discoverSources({ topic, keywords, limit: 5 }).then(results => {
    console.log(`\n🔍 来源发现结果（${results.length}条）\n`);
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.authority}] ${r.title}`);
      console.log(`     来源: ${r.source_name} | 相关度: ${(r.relevance * 100).toFixed(0)}%`);
      console.log(`     摘要: ${r.snippet.slice(0, 80)}...`);
      console.log('');
    });
  });
}

module.exports = { discoverSources };
