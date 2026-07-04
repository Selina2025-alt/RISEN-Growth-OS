/**
 * multi-source-research-skill.js
 * P1: 多源调研 Skill（接 DATAGEN）
 *
 * 用途：对 case_study / comparison 类型文章进行系统性多智能体调研
 *
 * 输入：
 *   { topic: string, angles: string[], depth: 'quick'|'deep' }
 *
 * 输出：
 *   {
 *     hypotheses: string[],
 *     data_points: object[],
 *     analysis: string,
 *     conclusions: string[]
 *   }
 *
 * 接入说明：
 *   1. 部署 DATAGEN（MIT）https://github.com/starpig1129/DATAGEN
 *   2. 替换 MOCK_IMPLEMENTATION 为真实调用
 */

const MOCK_IMPLEMENTATION = true;

// ============ 主入口 ============

async function multiSourceResearch({ topic, angles = [], depth = 'deep' } = {}) {
  if (MOCK_IMPLEMENTATION) {
    return mockResearch(topic, angles, depth);
  }
  return realResearch(topic, angles, depth);
}

// ============ Mock 实现 ============

function mockResearch(topic, angles, depth) {
  const kws = [topic, ...angles].join('、');

  return {
    hypotheses: [
      `${topic}的核心价值在于效率提升`,
      `现有方案在${angles[0] || '特定场景'}下表现最优`,
      `企业采纳${topic}的主要障碍是组织变革阻力`,
    ],
    data_points: [
      { type: 'stat', value: '68%', label: '企业采纳率', source: '行业报告2024' },
      { type: 'stat', value: '30%', label: '平均效率提升', source: '客户案例均值' },
      { type: 'stat', value: '3-6月', label: '典型落地周期', source: '实施经验' },
    ],
    analysis: `基于对${kws}的系统性分析，我们发现：

1. **市场驱动力**：企业对${topic}的需求主要来自降本增效的刚性压力，尤其是${angles[0] || '头部企业'}场景。

2. **技术成熟度**：相关技术已进入商用临界点，但落地仍需专业的实施支持。

3. **关键成功因素**：成功的${topic}项目通常具备三个特征——高层支持、清晰目标、持续迭代。

4. **主要风险**：数据安全和组织变革阻力是两大主要障碍，需要提前规划应对方案。`,
    conclusions: [
      `${topic}是数字化转型的必经之路，建议尽早就试点验证`,
      `试点项目应选择痛点明确、支持度高的部门切入`,
      `建议组建包含业务、技术和管理的复合型团队推进`,
      `建立效果评估机制，确保项目可持续迭代优化`,
    ],
    meta: {
      topic,
      angles,
      depth,
      sources_count: depth === 'deep' ? 8 : 4,
      generated_at: new Date().toISOString(),
    },
  };
}

// ============ 真实接入（DATAGEN API）============

async function realResearch(topic, angles, depth) {
  const apiUrl = process.env.DATAGEN_API_URL || 'http://localhost:8080/api/research';
  const apiKey = process.env.DATAGEN_API_KEY;

  if (!apiKey) {
    console.warn('[multi-source-research] DATAGEN_API_KEY not set, using mock');
    return mockResearch(topic, angles, depth);
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      task: 'research',
      topic,
      angles,
      depth,
      models: ['default'],
    }),
  });

  if (!response.ok) {
    throw new Error(`DATAGEN API error: ${response.status}`);
  }

  return response.json();
}

// ============ CLI ============

if (require.main === module) {
  const topic = process.argv[2] || 'AI数字化转型';
  const angles = (process.argv[3] || '中小企业,制造业').split(',').filter(Boolean);
  const depth = process.argv[4] || 'deep';

  multiSourceResearch({ topic, angles, depth }).then(result => {
    console.log(`\n📊 多源调研结果（${topic} × ${angles.join(', ')}）\n`);
    console.log('─'.repeat(60));
    console.log(`\n💡 核心假设（${result.hypotheses.length}条）：`);
    result.hypotheses.forEach((h, i) => console.log(`   ${i + 1}. ${h}`));
    console.log(`\n📈 关键数据（${result.data_points.length}个）：`);
    result.data_points.forEach(d => console.log(`   • ${d.label}: ${d.value}（来源：${d.source}）`));
    console.log('\n📝 分析：');
    console.log('   ' + result.analysis.split('\n').join('\n   '));
    console.log('\n✅ 结论：');
    result.conclusions.forEach((c, i) => console.log(`   ${i + 1}. ${c}`));
    console.log('\n' + '─'.repeat(60));
    console.log(`\n✅ 调研完成（深度：${depth}，来源数：${result.meta?.sources_count || 'N/A'}）\n`);
  });
}

module.exports = { multiSourceResearch };
