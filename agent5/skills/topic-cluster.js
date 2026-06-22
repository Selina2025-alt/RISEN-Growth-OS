/**
 * Agent 5 · Skill 5 · topic-cluster.js
 * 选题聚类：信号 → 母选题 → D1-D5 方向
 *
 * 输入：RawSignal[] + ContentGap[] + Narrative约束
 * 输出：TopicPool
 */

const crypto = require('crypto');

const DEFAULT_DIRECTION_COUNT = 5;

const CONTENT_FORMS = ['图文', '短视频', '长文', '播客', '社交短帖'];
const AUDIENCES = ['企业老板', 'AI从业者', '开发者', '销售', '创业者'];
const EVIDENCE_TYPES = ['案例', '数据', '视频', '论文', '人物观点'];
const PRIORITIES = ['high', 'medium', 'low'];

/**
 * 主函数
 * @param {Object} opts
 * @param {Array} opts.signals - RawSignal[]
 * @param {Array} opts.contentGaps - ContentGap[]（可选，来自Agent4竞品分析）
 * @param {Object} opts.narrativeConstraint - Narrative约束（来自Agent4）
 * @param {number} opts.directionCount - 每个母选题生成几个方向，默认5
 */
function generateTopicCluster(opts = {}) {
  const {
    signals = [],
    contentGaps = [],
    narrativeConstraint = {},
    directionCount = DEFAULT_DIRECTION_COUNT,
    feedbackSignals = []   // Agent4回传的高反馈内容 → 提升同类选题权重
  } = opts;

  // 0. 基于反馈信号构建 topic → weight boost 映射
  // feedbackSignals: [{topic_keyword, engagement_score, content_type}]
  const topicBoostMap = buildTopicBoostMap(feedbackSignals);

  // 1. 信号聚类 → 母选题
  const clusters = clusterSignals(signals, contentGaps, narrativeConstraint);

  // 2. 母选题 → D1-D5 方向（应用反馈 boost）
  const topics = clusters.map((cluster, i) => {
    const directions = generateDirections(cluster, directionCount, narrativeConstraint);
    const boost = topicBoostMap.get(cluster.title) || 0;
    const totalScore = computeTopicScore(directions) + boost;
    return {
      topic_id: `TOPIC-${String(i + 1).padStart(3, '0')}`,
      title: cluster.title,
      source_signals: cluster.signalIds,
      source_type: cluster.primaryType,
      content_type: cluster.contentType,
      core_viewpoint: cluster.coreViewpoint,
      narrative_fit: cluster.narrativeFit,
      feedback_boost: boost > 0 ? boost : 0,
      directions,
      total_score: Math.round(Math.min(5, totalScore) * 100) / 100,
      created_at: new Date().toISOString()
    };
  });

  return {
    topics,
    summary: {
      total: topics.length,
      high_priority: topics.filter(t => t.total_score >= 3.5).length,
      medium_priority: topics.filter(t => t.total_score >= 2.5 && t.total_score < 3.5).length,
      low_priority: topics.filter(t => t.total_score < 2.5).length
    }
  };
}

/**
 * 基于反馈信号构建 topic → weight boost 映射
 * feedbackSignals: [{topic_keyword, engagement_score, content_type}]
 * engagement_score: 0-5（0=无反馈，5=极高反馈）
 * boost范围：+0.1 ~ +0.8
 */
function buildTopicBoostMap(feedbackSignals) {
  const map = new Map();
  for (const f of feedbackSignals) {
    if (!f.topic_keyword || !f.engagement_score) continue;
    const boost = Math.min(0.8, f.engagement_score * 0.15);
    const existing = map.get(f.topic_keyword) || 0;
    map.set(f.topic_keyword, Math.max(existing, boost));
  }
  return map;
}

function clusterSignals(signals, contentGaps, narrative) {
  const clusters = [];
  const used = new Set();

  // 先按contentType分组
  const byType = {};
  for (const sig of signals) {
    const type = sig.content_type || sig.type || 'other';
    if (!byType[type]) byType[type] = [];
    byType[type].push(sig);
  }

  for (const sig of signals) {
    if (used.has(sig.id)) continue;

    // 找相似信号
    const similar = [sig];
    used.add(sig.id);

    for (const other of signals) {
      if (used.has(other.id)) continue;
      if (other.id === sig.id) continue;
      if (similarScore(sig, other) >= 0.6) {
        similar.push(other);
        used.add(other.id);
      }
    }

    // 合并同类信号
    const allTexts = similar.map(s => s.title || s.text || '').join(' ');
    const viewpoint = extractCoreViewpoint(allTexts, narrative.main_axis || '');
    const contentType = detectContentType(similar);
    const narrativeFit = checkNarrativeFit(viewpoint, narrative);

    clusters.push({
      title: generateTopicTitle(similar, viewpoint),
      signalIds: similar.map(s => s.id),
      signals: similar,
      primaryType: similar[0].type || 'manual',
      contentType,
      coreViewpoint: viewpoint,
      narrativeFit,
      weights: similar.map(s => s.weight || 1)
    });
  }

  // 加入内容缺口作为补充选题
  if (contentGaps && contentGaps.length > 0) {
    for (const gap of contentGaps.slice(0, 3)) {
      clusters.push({
        title: `【缺口】${gap.topic}`,
        signalIds: [],
        signals: [],
        primaryType: 'content_gap',
        contentType: gap.content_form || '图文',
        coreViewpoint: gap.gap_reason || '',
        narrativeFit: true,
        weights: [1]
      });
    }
  }

  return clusters;
}

/**
 * 生成方向 D1-D5
 */
function generateDirections(cluster, count, narrative) {
  const directions = [];
  const baseViewpoint = cluster.coreViewpoint || '';
  const contentType = cluster.contentType || '图文';

  // 不同角度类型
  const angleTypes = [
    { label: '深度拆解型', desc: '深入分析底层逻辑和实现路径', forms: ['长文', '图文'] },
    { label: '实战教程型', desc: '手把手教学，可复制实操', forms: ['图文', '短视频'] },
    { label: '对比评测型', desc: '多维度对比，客观呈现差异', forms: ['图文', '长文'] },
    { label: '案例复盘型', desc: '真实案例全流程复盘', forms: ['图文', '长文'] },
    { label: '观点洞察型', desc: '独特视角，深度思考', forms: ['图文', '社交短帖'] },
    { label: '趋势解读型', desc: '行业趋势解读和预判', forms: ['图文', '长文'] },
    { label: '老板视角型', desc: '站在企业决策者角度看问题', forms: ['图文', '长文'] }
  ];

  // 叙事约束过滤角度
  const forbidden = narrative.forbidden_directions || [];
  const preferred = narrative.preferred_directions || [];

  let available = angleTypes;
  if (preferred.length > 0) {
    // 把偏好角度放前面
    const preferredAngles = angleTypes.filter(a => preferred.some(p => a.label.includes(p)));
    const rest = angleTypes.filter(a => !preferred.some(p => a.label.includes(p)));
    available = [...preferredAngles, ...rest];
  }

  const selected = available.slice(0, count);

  for (let i = 0; i < selected.length; i++) {
    const angle = selected[i];
    const dirId = `D${i + 1}`;

    directions.push({
      direction_id: dirId,
      title: `${angle.label}：${truncate(baseViewpoint, 30)}`,
      angle_type: angle.label,
      core_viewpoint: buildDirectionViewpoint(baseViewpoint, angle.desc, narrative),
      content_forms: angle.forms,
      audience: selectAudience(baseViewpoint, narrative),
      required_evidence: selectEvidenceTypes(baseViewpoint),
      hooks: generateHooks(baseViewpoint, angle.label),
      risks: generateRisks(baseViewpoint, angle.label),
      priority: i === 0 ? 'high' : i <= 2 ? 'medium' : 'low',
      account_fit: estimateAccountFit(angle, narrative)
    });
  }

  return directions;
}

function computeTopicScore(directions) {
  if (!directions || directions.length === 0) return 0;
  const priorityScore = { high: 3, medium: 2, low: 1 };
  const avgPriority = directions.reduce((sum, d) => sum + (priorityScore[d.priority] || 2), 0) / directions.length;
  return avgPriority;
}

function similarScore(a, b) {
  const wordsA = new Set((a.title || a.text || '').split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set((b.title || b.text || '').split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
  return (2 * intersection) / (wordsA.size + wordsB.size);
}

function extractCoreViewpoint(text, mainAxis) {
  // 简单：从文本提取核心观点，优先用主轴词
  const axisWords = (mainAxis || '').split(/[，,、]/).filter(w => w.trim());
  for (const word of axisWords) {
    if (text.includes(word)) return `${word}的核心逻辑和真实落地情况`;
  }
  return text.substring(0, 60);
}

function generateTopicTitle(signals, viewpoint) {
  const first = signals[0];
  const raw = first.title || first.text || viewpoint || '新选题';
  return truncate(raw.replace(/[#*「」『』]/g, ''), 50);
}

function detectContentType(signals) {
  const types = signals.map(s => s.content_type || s.type || '');
  if (types.some(t => t.includes('视频') || t.includes('YouTube'))) return '视频相关';
  if (types.some(t => t.includes('论文') || t.includes('arXiv'))) return '论文研究';
  if (types.some(t => t.includes('教程') || t.includes('方法'))) return '利他（教程）';
  if (types.some(t => t.includes('案例') || t.includes('客户'))) return '企业案例';
  return '行业洞察';
}

function checkNarrativeFit(viewpoint, narrative) {
  if (!narrative || !narrative.main_axis) return true;
  const axis = narrative.main_axis;
  const avoid = narrative.forbidden_directions || [];
  const hasAxis = viewpoint.includes(axis.split(/[，,]/)[0]);
  const hasAvoid = avoid.some(a => viewpoint.includes(a));
  return hasAxis && !hasAvoid;
}

function buildDirectionViewpoint(base, angleDesc, narrative) {
  const axis = narrative.main_axis || '';
  return `${axis}，具体来说是${angleDesc}。${base.substring(0, 40)}`;
}

function selectAudience(viewpoint, narrative) {
  const role = narrative.target_role || '企业老板';
  if (viewpoint.includes('技术') || viewpoint.includes('实现')) return 'AI从业者,开发者';
  if (viewpoint.includes('老板') || viewpoint.includes('决策')) return '企业老板';
  return role;
}

function selectEvidenceTypes(viewpoint) {
  const types = [];
  if (viewpoint.includes('案例') || viewpoint.includes('客户')) types.push('案例', '数据');
  else if (viewpoint.includes('方法') || viewpoint.includes('教程')) types.push('视频', '案例');
  else if (viewpoint.includes('论文') || viewpoint.includes('研究')) types.push('论文', '人物观点');
  else types.push('案例', '数据', '视频');
  return types.slice(0, 3);
}

function generateHooks(viewpoint, angleLabel) {
  return [
    `${viewpoint.substring(0, 20)}，其实有个关键点被忽略了`,
    `为什么${viewpoint.substring(0, 15)}，大多数人做错了`,
    `${angleLabel}：从这个问题开始说起`
  ];
}

function generateRisks(viewpoint, angleLabel) {
  const risks = [];
  if (viewpoint.includes('对比')) risks.push('对比维度选取可能引发争议');
  if (angleLabel.includes('老板视角')) risks.push('过于抽象，老板可能觉得不够落地');
  if (!risks.length) risks.push('证据获取难度可能较高');
  return risks;
}

function estimateAccountFit(angle, narrative) {
  const fits = {};
  const accounts = narrative.account_roles || {};
  for (const [account, role] of Object.entries(accounts)) {
    if (role === 'awareness' && angle.forms.includes('短视频')) fits[account] = 0.9;
    else if (role === 'trust' && angle.forms.includes('长文')) fits[account] = 0.85;
    else if (role === 'conversion' && angle.forms.includes('图文')) fits[account] = 0.7;
    else fits[account] = 0.5;
  }
  return fits;
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length <= maxLen ? str : str.substring(0, maxLen) + '…';
}

module.exports = { generateTopicCluster };
