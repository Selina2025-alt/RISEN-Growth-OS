/**
 * icp-reader.js
 * P2: ICP/Persona 读取 Skill（读 Agent3 输出）
 *
 * 功能：从 Agent3 的标准输出路径读取 ICP 和 Persona，注入文章受众约束
 *
 * Agent3 定义的输出文件：
 *   - icp.json          理想客户画像
 *   - persona.json       角色定义
 *   - target-accounts.json 目标账户列表
 *
 * 输入：{ force_refresh: boolean }
 * 输出：{ icp, personas, target_accounts }
 */

const path = require('path');
const fs = require('fs');

const AGENT3_OUTPUT_BASE = process.env.AGENT3_OUTPUT_DIR
  || path.join(__dirname, '../../../agent3/output');

function run({ force_refresh = false } = {}) {
  const result = {
    icp: null,
    personas: [],
    target_accounts: [],
    sources: [],
    _meta: { loaded_from: 'fallback', timestamp: new Date().toISOString() },
  };

  const agent3Paths = [
    { key: 'icp', path: path.join(AGENT3_OUTPUT_BASE, 'icp.json') },
    { key: 'personas', path: path.join(AGENT3_OUTPUT_BASE, 'persona.json') },
    { key: 'accounts', path: path.join(AGENT3_OUTPUT_BASE, 'target-accounts.json') },
  ];

  let loaded = false;
  for (const { key, path: p } of agent3Paths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (key === 'icp') {
          result.icp = data;
        } else if (key === 'personas') {
          result.personas = Array.isArray(data) ? data : (data.personas || []);
        } else if (key === 'accounts') {
          result.target_accounts = Array.isArray(data) ? data : (data.accounts || data.list || []);
        }
        result.sources.push(p);
        result._meta.loaded_from = 'agent3';
        loaded = true;
      } catch (e) {
        console.warn(`[icp-reader] failed to load ${p}: ${e.message}`);
      }
    }
  }

  if (!loaded || force_refresh) {
    const fallback = buildFromMarketKnowledge();
    if (fallback) {
      result.icp = fallback.icp;
      result._meta.loaded_from = 'market-knowledge';
    }
  }

  if (!result.icp) {
    result.icp = getDefaultICP();
    result._meta.loaded_from = 'default';
  }

  return result;
}

/**
 * 从 knowledge/market/ 推断 ICP
 */
function buildFromMarketKnowledge() {
  const marketDir = path.join(__dirname, '../knowledge/market');
  if (!fs.existsSync(marketDir)) return null;

  const files = fs.readdirSync(marketDir).filter(f => /\.(md|json)$/i.test(f));
  if (files.length === 0) return null;

  const content = files
    .map(f => fs.readFileSync(path.join(marketDir, f), 'utf8'))
    .join('\n');

  // 提取行业关键词
  const industries = ['制造业', '金融', '零售', '医疗', '教育', '科技'].filter(i => content.includes(i));
  const companySizes = ['中小企业', '中型企业', '大型企业', '上市公司'].filter(s => content.includes(s));

  if (!industries.length && !companySizes.length) return null;

  return {
    icp: {
      industries: industries.slice(0, 3),
      company_sizes: companySizes.slice(0, 2),
      pain_points: extractPainPoints(content),
      goals: extractGoals(content),
    },
  };
}

function extractPainPoints(content) {
  const patterns = [
    '效率低', '成本高', '增长难', '获客贵', '转化低',
    '管理复杂', '数据孤岛', '人才缺乏', '竞争激烈',
  ];
  return patterns.filter(p => content.includes(p)).slice(0, 5);
}

function extractGoals(content) {
  const patterns = [
    '数字化转型', '降本增效', '提升效率', '扩大规模', '提升竞争力',
    '改善体验', '提高质量', '加速创新',
  ];
  return patterns.filter(p => content.includes(p)).slice(0, 5);
}

function getDefaultICP() {
  return {
    industries: [],
    company_sizes: ['中小企业', '中型企业'],
    pain_points: ['效率低', '成本高', '增长难'],
    goals: ['数字化转型', '降本增效', '提升效率'],
    decision_makers: ['CEO', 'CTO', '市场总监'],
    buying_stage: 'awareness',
  };
}

if (require.main === module) {
  const result = run();
  console.log('\n👥 ICP Reader 输出\n');
  console.log(`  来源: ${result._meta.loaded_from}`);
  console.log(`  行业: ${(result.icp?.industries || []).join(', ') || '(未定义)'}`);
  console.log(`  规模: ${(result.icp?.company_sizes || []).join(', ') || '(未定义)'}`);
  console.log(`  痛点: ${(result.icp?.pain_points || []).join(', ') || '(未定义)'}`);
  console.log(`  目标: ${(result.icp?.goals || []).join(', ') || '(未定义)'}`);
  console.log(`  Persona数: ${result.personas.length}`);
  console.log('');
}

module.exports = { run };
