// skills/topic-capability-matcher.js
// P0.3：选题-能力匹配引擎

const { ruleBasedJudge } = require('../lib/llm-call');

/**
 * 判断是否为 Hot Topic（高商业价值选题）
 * 来源：intent_type === 'transactional' 或 'commercial'
 */
function isHotTopic(intentType) {
  return intentType === 'transactional' || intentType === 'commercial';
}

/**
 * 计算关键词集合相似度（支持子串匹配）
 * @param {string[]} topicKeywords
 * @param {string[]} cardTopics
 * @returns {number} 0.0 ~ 1.0
 */
function computeSimilarity(topicKeywords, cardTopics) {
  if (!topicKeywords?.length || !cardTopics?.length) return 0;
  // 展平：每个 topicKeyword 拆成单字符+双字符+三字符 ngram
  function ngrams(text, n) {
    const t = text.toLowerCase();
    const result = new Set();
    for (let i = 0; i <= t.length - n; i++) {
      result.add(t.slice(i, i + n));
    }
    return result;
  }

  let totalOverlap = 0;
  for (const kw of topicKeywords) {
    // 检查 kw 是否是 cardTopic 的子串
    const contains = cardTopics.some(ct => ct.toLowerCase().includes(kw.toLowerCase()));
    if (contains) totalOverlap++;
    // 同时检查 ngram 重叠（双向）
    else {
      const kwNgrams = new Set([...ngrams(kw, 2), ...ngrams(kw, 3)]);
      for (const ct of cardTopics) {
        const ctNgrams = new Set([...ngrams(ct, 2), ...ngrams(ct, 3)]);
        let ngOverlap = 0;
        for (const ng of kwNgrams) { if (ctNgrams.has(ng)) ngOverlap++; }
        if (ngOverlap >= 2) { totalOverlap++; break; }
      }
    }
  }

  return cardTopics.length > 0 ? totalOverlap / cardTopics.length : 0;
}

/**
 * 匹配选题与能力卡片
 * @param {Object} topicBrief - Agent5 提供的选题
 * @param {Array} cards - CapabilityCard 数组
 * @returns {Object} MatchReport
 */
function matchTopicToCapabilities(topicBrief, cards) {
  const primaryKw = topicBrief.search_intent?.primary || [];
  const secondaryKw = topicBrief.search_intent?.secondary || [];
  const intentType = topicBrief.search_intent?.intent_type || 'informational';
  const hot = isHotTopic(intentType);

  const scored = cards.map(card => {
    const keywords = [...primaryKw, ...secondaryKw];
    const kwText = keywords.join(' ');
    const cardText = [
      card.headline,
      ...(card.applicable_topics || [])
    ].join(' ');

    // Stage1：规则快速过滤（用于降噪，不作为唯一依据）
    const stage1Score = computeSimilarity(primaryKw, card.applicable_topics || []);

    // Stage2：基于关键词重叠的语义打分
    const overlapScore = computeSimilarity(keywords, card.applicable_topics || []);

    // 最终分数 = 重叠分（主要依据）
    const finalScore = overlapScore;

    // 统计 evidence 来源数
    const evidenceCount = card.evidence ? 1 : 0;

    return {
      id: card.id,
      headline: card.headline,
      match_score: Math.round(finalScore * 100) / 100,
      insertion_type: card.insertion_type || 'soft',
      evidence_count: evidenceCount,
      stage1_signal_count: stage1Score > 0 ? 1 : 0
    };
  });

  // 按 match_score 降序排列，取前5
  scored.sort((a, b) => b.match_score - a.match_score);
  const topMatches = scored.slice(0, 5);

  // 判断插入类型
  const best = topMatches[0] || {};
  let insertionType = 'minimal';

  if (best.match_score >= 0.5 && best.evidence_count >= 3) {
    insertionType = 'hard';
  } else if (best.match_score >= 0.3 && hot) {
    insertionType = 'soft';
  } else if (best.match_score >= 0.2 && hot) {
    insertionType = 'soft';
  } else {
    insertionType = 'minimal';
  }

  // 合并 reasoning
  const reasoning = `primary关键词[${primaryKw.join(', ')}]，intent_type=${intentType}，hot=${hot}，` +
    `最优匹配 "${best.headline || '无'}" score=${best.match_score}，判断为${insertionType}`;

  return {
    insertion_type: insertionType,
    keywords: {
      primary: primaryKw,
      secondary: secondaryKw,
      geo: topicBrief.search_intent?.geo || []
    },
    stage1_signal_count: scored.reduce((sum, c) => sum + c.stage1_signal_count, 0),
    stage2_result_count: topMatches.filter(c => c.match_score > 0).length,
    used_stage2: true,
    top_matches: topMatches,
    reasoning
  };
}

module.exports = { matchTopicToCapabilities, isHotTopic, computeSimilarity };
