/**
 * fact-grounding-skill.js
 * P1: 事实核验 Skill（接 llama_index）
 *
 * 用途：对文章中的声明进行事实核验，返回支撑/反驳证据
 *
 * 输入：
 *   {
 *     claims: string[],         // 待核验的声明
 *     knowledge_base_path: string, // 知识库路径
 *   }
 *
 * 输出：
 *   [{
 *     claim, verdict, evidence, confidence
 *   }]
 *
 * 接入说明：
 *   1. npm install llama-index（MIT）
 *   2. 构建知识库索引
 *   3. 将 MOCK_IMPLEMENTATION 改为 false
 */

const MOCK_IMPLEMENTATION = true; // TODO: 上线前改为 false

// ============ 主入口 ============

async function groundFacts({ claims = [], knowledge_base_path = '' } = {}) {
  if (!claims || claims.length === 0) return [];

  if (MOCK_IMPLEMENTATION) {
    return mockGround(claims);
  }
  return realGround(claims, knowledge_base_path);
}

// ============ Mock 实现 ============

function mockGround(claims) {
  return claims.map(claim => {
    // 简单规则判断
    const hasData = /[0-9]+[%％倍万千百十]/.test(claim);
    const hasQualifier = /可能|也许|似乎|大概/.test(claim);
    const isBroad = /所有|全部|必然|一定/.test(claim);

    let verdict = 'uncertain';
    let confidence = 0.5;
    let evidence = '无充分证据支撑此声明';

    if (hasData && !isBroad) {
      verdict = 'supported';
      confidence = 0.85;
      evidence = '声明中包含具体数据，数据来源需进一步核实';
    } else if (isBroad) {
      verdict = 'refuted';
      confidence = 0.6;
      evidence = '声明使用绝对化表述（所有/全部/必然），不符合实际情况';
    } else if (hasQualifier) {
      verdict = 'uncertain';
      confidence = 0.4;
      evidence = '声明带有推测性措辞，无法完全验证';
    }

    return {
      claim: claim.slice(0, 100),
      verdict,    // 'supported' | 'refuted' | 'uncertain'
      confidence,
      evidence,
      grounded: verdict !== 'uncertain',
    };
  });
}

// ============ 真实接入（llama_index）============

/**
 * LlamaIndex 接入
 *
 * 接入步骤：
 * 1. npm install llama-index
 * 2. 构建知识库索引：
 *    from llama_index import VectorStoreIndex
 *    index = VectorStoreIndex.from_documents(documents)
 *    index.save_to_disk('knowledge_index.json')
 * 3. 加载并查询：
 *    index = VectorStoreIndex.load_from_disk('knowledge_index.json')
 *    query_engine = index.as_query_engine()
 *    response = query_engine.query(claim)
 *
 * 示例：
 *   const { groundFacts } = require('./fact-grounding-skill');
 *   const results = await groundFacts({
 *     claims: ['多Agent协作可以提升效率30%'],
 *     knowledge_base_path: './knowledge_index.json'
 *   });
 */
async function realGround(claims, knowledge_base_path) {
  try {
    // eslint-disable-next-line global-require
    const { VectorStoreIndex } = require('llama-index');

    const index = await VectorStoreIndex.loadFromDisk(knowledge_base_path);
    const queryEngine = index.asQueryEngine({ similarityTopK: 3 });

    const results = [];
    for (const claim of claims) {
      try {
        const response = await queryEngine.query(
          `核实以下说法，给出支撑或反驳，并给出置信度：${claim}`
        );
        results.push({
          claim,
          verdict: response.verdict || 'uncertain',
          confidence: response.confidence || 0.5,
          evidence: response.response || response.evidence || '',
          grounded: response.verdict === 'supported',
        });
      } catch (err) {
        results.push({
          claim,
          verdict: 'uncertain',
          confidence: 0,
          evidence: `查询失败: ${err.message}`,
          grounded: false,
        });
      }
    }
    return results;
  } catch (err) {
    console.error('[fact-grounding] llama_index not available:', err.message);
    console.warn('[fact-grounding] falling back to mock implementation');
    return mockGround(claims);
  }
}

// ============ CLI ============

if (require.main === module) {
  const claims = [
    '多Agent协作可以提升企业效率30%以上',
    '所有企业都适合推进AI数字化转型',
    '斯坦福大学的研究表明AI内容引用率提升了40%',
    '使用多Agent系统可能存在数据安全风险',
  ];

  groundFacts({ claims }).then(results => {
    console.log('\n🔍 事实核验结果\n');
    results.forEach((r, i) => {
      const icon = r.verdict === 'supported' ? '✅' : r.verdict === 'refuted' ? '❌' : '❓';
      console.log(`  ${i + 1}. ${icon} [${r.verdict}] ${r.claim}`);
      console.log(`     置信度: ${(r.confidence * 100).toFixed(0)}%`);
      console.log(`     证据: ${r.evidence}`);
      console.log('');
    });
    console.log('✅ 核验完成\n');
  });
}

module.exports = { groundFacts };
