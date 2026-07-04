/**
 * evidence-pack-skill.js
 * P0: Evidence Pack 生成 Skill（事实与观点分离）
 *
 * PRD 要求：Agent 6 必须输出 Evidence Pack
 *
 * 功能：
 *   1. 从文章中提取事实陈述（Fact List）
 *   2. 识别观点和立场（Viewpoint Map）
 *   3. 收集引用和来源（Citation List）
 *   4. 构建证据关系图（Evidence Graph）
 *   5. 记录内容血缘（Content Lineage，用于 Agent 9 归因）
 *
 * 输入：
 *   {
 *     article_content: string,
 *     topic_id: string,
 *     capability_cards_used: string[],   // 使用的 capability card IDs
 *     insertion_type: 'soft' | 'hard',
 *     platform: string,
 *     sources: [{ type, url, content_id, text }],  // 可选外部来源
 *   }
 *
 * 输出：
 *   {
 *     facts: [{ id, statement, source, confidence, traceability }],
 *     viewpoints: [{ id, claim, stance, supporting_facts, counter_arguments }],
 *     citations: [{ id, text, source, type, relevance_score }],
 *     evidence_graph: { nodes: [], edges: [] },
 *     content_lineage: { article_id, sources, capabilities_used, ... }
 *   }
 */

const STOPWORDS = new Set([
  '的', '了', '是', '在', '和', '有', '我', '你', '他', '这', '那', '就', '也', '都',
  '而', '及', '与', '把', '被', '一个', '没有', '什么', '怎么', '可以', '这个', '那个',
]);

let _idCounter = 0;
function genId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${(_idCounter++).toString(36)}`;
}

// ============ 主入口 ============

function run({ article_content, topic_id = '', capability_cards_used = [], insertion_type = 'soft', platform = 'unknown', sources = [] }) {
  // 1. 提取事实陈述
  const facts = extractFacts(article_content);

  // 2. 识别观点和立场
  const viewpoints = extractViewpoints(article_content, facts);

  // 3. 收集引用和来源
  const citations = extractCitations(article_content, sources);

  // 4. 构建证据关系图
  const evidence_graph = buildEvidenceGraph(facts, viewpoints, citations);

  // 5. 内容血缘记录
  const content_lineage = buildContentLineage({
    topic_id,
    article_content,
    capability_cards_used,
    insertion_type,
    platform,
    sources,
    facts,
  });

  return {
    facts,
    viewpoints,
    citations,
    evidence_graph,
    content_lineage,
    _meta: {
      topic_id,
      platform,
      insertion_type,
      facts_count: facts.length,
      viewpoints_count: viewpoints.length,
      citations_count: citations.length,
    },
  };
}

// ============ 1. 事实提取 ============

/**
 * 从文章中提取可验证的事实陈述
 */
function extractFacts(content) {
  const facts = [];
  const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 15);

  for (const para of paragraphs) {
    const sentences = para.match(/[^.!?。！？]+[.!?。！？]?/g) || [];
    for (const sentence of sentences) {
      const fact = analyzeSentenceForFact(sentence.trim());
      if (fact) {
        facts.push(fact);
      }
    }
  }

  // 去重
  const seen = new Set();
  return facts.filter(f => {
    const key = f.statement.slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 判断单个句子是否为可验证的事实
 */
function analyzeSentenceForFact(sentence) {
  if (sentence.length < 10 || sentence.length > 300) return null;

  // 事实句特征：
  // 1. 包含具体数据（数字+单位）
  // 2. 包含明确的时间/地点/人物
  // 3. 陈述客观状态（非评价性）
  // 4. 可被验证

  const hasData = /[0-9]+[%％倍万千百十]/.test(sentence);
  const hasTimePlace = /在[^\s]{2,15}[年月周日]|[2020-2029]年/.test(sentence);
  const isObjective = !/[认为|觉得|好像|似乎|大概|可能]/.test(sentence) &&
    !/好|坏|棒|差|赞|坑/.test(sentence);
  const isClaim = /[说|指出|表明|显示|证明|显示]/.test(sentence);  // 引述性句子
  const isAction = /[做|进行|实施|开展|推出|发布|上线]/.test(sentence);  // 行为句

  // 至少满足：数据 OR 时间地点 OR (引述 AND 客观)
  const isFact = (hasData || hasTimePlace || (isClaim && isObjective)) && isObjective;

  if (!isFact) return null;

  // 分类事实类型
  let fact_type = 'general';
  if (hasData) fact_type = 'statistical';
  else if (hasTimePlace) fact_type = 'temporal_spatial';
  else if (isAction) fact_type = 'action';

  // 评估可追溯性
  const hasSource = /[来源|根据|依据|数据显示|研究表明]/.test(sentence);
  const hasQuote = /["'""'].{5,}/.test(sentence);
  const traceability = hasSource ? 'high' : hasQuote ? 'medium' : 'low';

  return {
    id: genId('FACT'),
    statement: sentence,
    type: fact_type,
    confidence: hasData ? 0.8 : hasSource ? 0.7 : 0.5,
    traceability,
    has_data: hasData,
    has_source: hasSource,
    source_hint: hasSource ? '文中标注' : '待补充',
  };
}

// ============ 2. 观点提取 ============

/**
 * 识别文章中的观点和立场
 */
function extractViewpoints(content, facts) {
  const viewpoints = [];
  const paragraphs = content.split(/\n+/);

  for (const para of paragraphs) {
    const viewpoint = analyzeParagraphForViewpoint(para, facts);
    if (viewpoint) {
      viewpoints.push(viewpoint);
    }
  }

  return viewpoints.slice(0, 20); // 最多20个观点
}

/**
 * 判断段落是否包含观点
 */
function analyzeParagraphForViewpoint(paragraph, facts) {
  if (paragraph.length < 20) return null;

  // 观点句特征
  const hasOpinion = /[认为|觉得|相信|主张|建议|应该|必须|关键|重要]/.test(paragraph);
  const hasRecommendation = /[建议|推荐|可以|应该|最好|不妨]/.test(paragraph);
  const hasComparison = /[比|优于|劣于|相比|对比|差距]/.test(paragraph);

  if (!hasOpinion && !hasRecommendation && !hasComparison) return null;

  // 提取核心观点句
  const coreClaims = paragraph.match(/[^\n。！？]{10,80}[。！？]/g) || [];
  if (coreClaims.length === 0) return null;

  const coreClaim = coreClaims[0] || paragraph.slice(0, 100);

  // 判断立场（支持/反对/中立）
  const stance = detectStance(paragraph);

  // 寻找支撑的事实
  const supportingFacts = facts
    .filter(f => {
      const claimWords = coreClaim.match(/[\w\u4e00-\u9fa5]{2,}/g) || [];
      const factWords = f.statement.match(/[\w\u4e00-\u9fa5]{2,}/g) || [];
      return claimWords.some(w => factWords.some(fw => fw.includes(w) || w.includes(fw)));
    })
    .slice(0, 3)
    .map(f => f.id);

  // 寻找可能的反驳
  const counterIndicators = ['但是', '然而', '不过', '然而', '尽管', '虽然', '而非'];
  const hasCounters = counterIndicators.some(ind => paragraph.includes(ind));

  return {
    id: genId('VIEW'),
    claim: coreClaim.slice(0, 150),
    stance,  // 'supportive' | 'critical' | 'neutral'
    recommendation: hasRecommendation ? extractRecommendation(paragraph) : null,
    supporting_facts: supportingFacts,
    counter_arguments: hasCounters ? ['存在对立观点（见正文）'] : [],
  };
}

function detectStance(text) {
  const positive = /[好|棒|优秀|出色|关键|重要|必须|应该|推荐|值得]/.test(text);
  const negative = /[差|糟糕|问题|风险|挑战|困难|局限|不足|失败]/.test(text);
  if (positive && !negative) return 'supportive';
  if (negative && !positive) return 'critical';
  return 'neutral';
}

function extractRecommendation(text) {
  const recPatterns = [
    /建议[^\n。]{5,50}[。]/,
    /推荐[^\n。]{5,50}[。]/,
    /最好[^\n。]{5,50}[。]/,
    /应该[^\n。]{5,50}[。]/,
  ];
  for (const p of recPatterns) {
    const match = text.match(p);
    if (match) return match[0];
  }
  return null;
}

// ============ 3. 引用收集 ============

/**
 * 收集文章中的引用和来源
 */
function extractCitations(content, externalSources = []) {
  const citations = [];

  // 内部引用：文中已有的引用
  const quoteMatches = content.match(/"[^"]{10,}"|"[^"]{10,}"|《[^》]{3,30}》/g) || [];
  for (const quote of quoteMatches) {
    citations.push({
      id: genId('CITE'),
      text: quote,
      source: 'inline',
      type: 'inline_quote',
      relevance_score: 0.7,
    });
  }

  // 来源标注
  const sourceMatches = content.match(/[来源依据]:\s*[^\n]{3,50}/gi) || [];
  for (const src of sourceMatches) {
    citations.push({
      id: genId('CITE'),
      text: src.replace(/[来源依据]:\s*/i, ''),
      source: 'declared',
      type: 'declared_source',
      relevance_score: 0.8,
    });
  }

  // 外部来源
  for (const src of externalSources) {
    citations.push({
      id: genId('CITE'),
      text: src.text || src.title || '外部来源',
      source: src.url || src.source,
      type: src.type || 'external',
      relevance_score: src.relevance || 0.8,
    });
  }

  return citations;
}

// ============ 4. 证据关系图 ============

/**
 * 构建证据关系图
 * nodes: 事实节点 + 观点节点
 * edges: 支撑关系 + 反驳关系
 */
function buildEvidenceGraph(facts, viewpoints, citations) {
  const nodes = [];
  const edges = [];

  // 添加事实节点
  for (const fact of facts) {
    nodes.push({
      id: fact.id,
      type: 'fact',
      label: fact.statement.slice(0, 50),
      data: fact,
    });
  }

  // 添加观点节点
  for (const view of viewpoints) {
    nodes.push({
      id: view.id,
      type: 'viewpoint',
      label: view.claim.slice(0, 50),
      data: view,
    });

    // 添加支撑边
    for (const factId of view.supporting_facts) {
      edges.push({
        from: factId,
        to: view.id,
        relation: 'supports',
      });
    }

    // 添加反驳边
    for (const counter of view.counter_arguments) {
      edges.push({
        from: view.id,
        to: counter,
        relation: 'counters',
      });
    }
  }

  // 添加引用节点
  for (const cite of citations) {
    nodes.push({
      id: cite.id,
      type: 'citation',
      label: cite.text.slice(0, 40),
      data: cite,
    });
  }

  return { nodes, edges };
}

// ============ 5. 内容血缘 ============

/**
 * 构建内容血缘记录（用于 Agent 9 归因）
 */
function buildContentLineage({ topic_id, article_content, capability_cards_used, insertion_type, platform, sources, facts }) {
  return {
    article_id: genId('ART'),
    topic_id,
    platform,
    insertion_type,
    capabilities_used: capability_cards_used,
    sources: sources.map(s => ({
      type: s.type || 'unknown',
      url: s.url || null,
      content_id: s.content_id || null,
    })),
    facts_count: facts.length,
    paragraphs_count: article_content.split(/\n+/).length,
    words_count: article_content.length,
    created_at: new Date().toISOString(),
  };
}

// ============ CLI 测试入口 ============

if (require.main === module) {
  const sample = {
    article_content: `数字化转型已成为企业发展的必经之路。根据麦肯锡2023年报告，AI落地可帮助企业提升效率30%以上。

多Agent协作是当前AI领域的热门话题。在企业场景中，多Agent可以帮助实现自动化流程、智能客服、数据分析等功能。使用多Agent协作可以显著提升工作效率，降低人工成本。

我认为，企业应该优先考虑采用多Agent方案。因为它具有以下优势：1）效率提升明显；2）成本显著降低；3）扩展性强。建议企业从试点项目开始，逐步推广。

效果显著，企业反馈良好。多Agent的核心是协调机制，需要解决任务分配，信息共享、冲突处理等问题。相比传统方案，多Agent在复杂任务处理上表现更优。`,
    topic_id: 'TOPIC-001',
    capability_cards_used: ['KB-001', 'KB-002', 'KB-003'],
    insertion_type: 'hard',
    platform: 'zhihu',
    sources: [],
  };

  const result = run(sample);

  console.log('\n📊 Evidence Pack Skill 输入：');
  console.log(`  平台：${sample.platform}`);
  console.log(`  选题：${sample.topic_id}\n`);

  console.log('📝 Evidence Pack Skill 输出：\n');

  console.log(`  ✅ Facts（共${result.facts.length}条）：`);
  result.facts.forEach((f, i) => {
    const icon = f.has_data ? '📊' : f.has_source ? '📖' : '📝';
    console.log(`     ${icon} [${f.type}] ${f.statement.slice(0, 60)}...`);
    console.log(`        可追溯性: ${f.traceability} | 置信度: ${f.confidence}`);
  });

  console.log(`\n  ✅ Viewpoints（共${result.viewpoints.length}条）：`);
  result.viewpoints.forEach((v, i) => {
    console.log(`     [${v.stance}] ${v.claim.slice(0, 50)}...`);
    if (v.recommendation) console.log(`        建议: ${v.recommendation}`);
    console.log(`        支撑事实: ${v.supporting_facts.length}条`);
  });

  console.log(`\n  ✅ Citations（共${result.citations.length}条）：`);
  result.citations.forEach((c, i) => {
    console.log(`     ${c.type}: ${c.text.slice(0, 50)}...`);
  });

  console.log(`\n  ✅ Evidence Graph：`);
  console.log(`     节点：${result.evidence_graph.nodes.length}个`);
  console.log(`     边：${result.evidence_graph.edges.length}条`);
  const supportEdges = result.evidence_graph.edges.filter(e => e.relation === 'supports').length;
  console.log(`     支撑关系：${supportEdges}条`);

  console.log(`\n  ✅ Content Lineage：`);
  console.log(`     文章ID: ${result.content_lineage.article_id}`);
  console.log(`     平台: ${result.content_lineage.platform}`);
  console.log(`     字数: ${result.content_lineage.words_count}`);
  console.log(`     能力卡片: ${result.content_lineage.capabilities_used.join(', ')}`);

  console.log('\n✅ Evidence Pack Skill 执行完成\n');
}

module.exports = { run };
