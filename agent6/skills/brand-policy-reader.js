/**
 * brand-policy-reader.js
 * P1: Brand Policy 读取 Skill（读 Agent2 输出）
 *
 * 功能：从 Agent2 的标准输出路径读取品牌策略，注入文章生成约束
 *
 * Agent2 定义的输出文件：
 *   - brand-policy.json       品牌声音规范
 *   - promotion-passport.json  宣发护照
 *   - claim-list.json         能力声明列表
 *   - evidence-graph.json      证据关系图
 *
 * 输入：{ force_refresh: boolean }
 * 输出：{ brand_voice, claims, evidence_graph, sources }
 */

const path = require('path');
const fs = require('fs');

// 标准输出路径（Agent2 开发完成后配置）
const AGENT2_OUTPUT_BASE = process.env.AGENT2_OUTPUT_DIR
  || path.join(__dirname, '../../../agent2/output');

// Fallback：当 Agent2 不存在时使用 knowledge/company/ 动态构建
const KNOWLEDGE_COMPANY_DIR = path.join(__dirname, '../knowledge/company');

function run({ force_refresh = false } = {}) {
  const results = {
    brand_voice: null,
    claims: [],
    evidence_graph: { nodes: [], edges: [] },
    sources: [],
    _meta: { loaded_from: 'fallback', timestamp: new Date().toISOString() },
  };

  // 尝试读取 Agent2 正式输出
  const agent2Paths = [
    { key: 'brand_policy', path: path.join(AGENT2_OUTPUT_BASE, 'brand-policy.json') },
    { key: 'passport', path: path.join(AGENT2_OUTPUT_BASE, 'promotion-passport.json') },
    { key: 'claims', path: path.join(AGENT2_OUTPUT_BASE, 'claim-list.json') },
    { key: 'evidence_graph', path: path.join(AGENT2_OUTPUT_BASE, 'evidence-graph.json') },
  ];

  let agent2Loaded = false;
  for (const { key, path: p } of agent2Paths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (key === 'brand_policy') {
          results.brand_voice = data;
          results._meta.loaded_from = 'agent2';
        } else if (key === 'claims') {
          results.claims = Array.isArray(data) ? data : (data.claims || []);
        } else if (key === 'evidence_graph') {
          results.evidence_graph = data;
        }
        results.sources.push(p);
        agent2Loaded = true;
      } catch (e) {
        console.warn(`[brand-policy-reader] failed to load ${p}: ${e.message}`);
      }
    }
  }

  // Fallback：从 knowledge/company/ 动态构建
  if (!agent2Loaded || force_refresh) {
    const fallback = buildFromKnowledge(KNOWLEDGE_COMPANY_DIR);
    if (fallback) {
      results.brand_voice = fallback.brand_voice;
      results.claims = fallback.claims;
      results._meta.loaded_from = 'knowledge/company';
    }
  }

  // 如果什么都没有，返回空壳（不阻塞流程）
  if (!results.brand_voice) {
    results.brand_voice = getDefaultBrandVoice();
    results._meta.loaded_from = 'default';
  }

  return results;
}

/**
 * 从 knowledge/company/ 目录动态构建 Brand Policy
 */
function buildFromKnowledge(companyDir) {
  if (!fs.existsSync(companyDir)) return null;

  const files = fs.readdirSync(companyDir).filter(f => /\.(md|json|txt)$/i.test(f));
  if (files.length === 0) return null;

  // 收集所有文件内容
  const allContent = [];
  const claims = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(companyDir, file), 'utf8');
    allContent.push({ file, content });

    // 从文件名和内容中提取能力声明
    const claimMatches = content.match(/[^\n。！？]{5,50}(?:平台|系统|工具|能力|功能|支持|实现)/g) || [];
    for (const claim of claimMatches.slice(0, 5)) {
      claims.push({
        text: claim.trim(),
        source: file,
        confidence: 0.6,
      });
    }
  }

  // 提取品牌声音关键词
  const voiceKeywords = extractBrandVoiceKeywords(allContent.map(c => c.content).join('\n'));

  return {
    brand_voice: {
      keywords: voiceKeywords,
      tone: inferTone(allContent.map(c => c.content).join('\n')),
      prohibited: [],
    },
    claims,
  };
}

function extractBrandVoiceKeywords(content) {
  // 提取高频正面词汇作为品牌关键词
  const positiveWords = [
    '智能', '自动化', '高效', '专业', '创新', '领先',
    '可靠', '安全', '简单', '易用', '快速', '灵活',
  ];
  const found = positiveWords.filter(w => content.includes(w));
  return found.slice(0, 10);
}

function inferTone(content) {
  if (/专业|企业|机构/.test(content)) return 'professional';
  if (/简单|易用|快速|轻松/.test(content)) return 'friendly';
  if (/创新|领先|前沿/.test(content)) return 'innovative';
  return 'balanced';
}

function getDefaultBrandVoice() {
  return {
    keywords: ['智能', '自动化', '高效'],
    tone: 'professional',
    prohibited: ['最差', '唯一', '无敌'],
  };
}

if (require.main === module) {
  const result = run();
  console.log('\n🏢 Brand Policy Reader 输出\n');
  console.log(`  来源: ${result._meta.loaded_from}`);
  console.log(`  品牌关键词: ${(result.brand_voice?.keywords || []).join(', ')}`);
  console.log(`  品牌语调: ${result.brand_voice?.tone || 'unknown'}`);
  console.log(`  能力声明: ${result.claims.length}条`);
  console.log(`  证据图谱: ${result.evidence_graph.nodes.length}节点\n`);
}

module.exports = { run };
