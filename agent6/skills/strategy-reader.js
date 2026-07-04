/**
 * strategy-reader.js
 * P1: Strategy Card 读取 Skill（读 Agent4 输出）
 *
 * 功能：从 Agent4 的标准输出路径读取 Strategy Card，注入文章策略约束
 *
 * Agent4 定义的输出文件：
 *   - strategy-card.json     策略卡
 *   - value-proposition.json 价值主张
 *   - channel-mix.json       渠道组合
 *
 * 输入：{ force_refresh: boolean }
 * 输出：{ strategy_card, value_proposition, channel_mix, audience }
 */

const path = require('path');
const fs = require('fs');

const AGENT4_OUTPUT_BASE = process.env.AGENT4_OUTPUT_DIR
  || path.join(__dirname, '../../../agent4/output');

function run({ force_refresh = false } = {}) {
  const result = {
    strategy_card: null,
    value_proposition: '',
    channel_mix: [],
    audience: null,
    sources: [],
    _meta: { loaded_from: 'fallback', timestamp: new Date().toISOString() },
  };

  const agent4Paths = [
    { key: 'strategy_card', path: path.join(AGENT4_OUTPUT_BASE, 'strategy-card.json') },
    { key: 'value_proposition', path: path.join(AGENT4_OUTPUT_BASE, 'value-proposition.json') },
    { key: 'channel_mix', path: path.join(AGENT4_OUTPUT_BASE, 'channel-mix.json') },
  ];

  let loaded = false;
  for (const { key, path: p } of agent4Paths) {
    if (fs.existsSync(p)) {
      try {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (key === 'strategy_card') {
          result.strategy_card = data;
        } else if (key === 'value_proposition') {
          result.value_proposition = typeof data === 'string' ? data : (data.text || data.value || '');
        } else if (key === 'channel_mix') {
          result.channel_mix = Array.isArray(data) ? data : (data.channels || []);
        }
        result.sources.push(p);
        result._meta.loaded_from = 'agent4';
        loaded = true;
      } catch (e) {
        console.warn(`[strategy-reader] failed to load ${p}: ${e.message}`);
      }
    }
  }

  // Fallback：从 Agent5 的 editorial-calendar 推断策略
  if (!loaded || force_refresh) {
    const fallback = buildFromEditorialCalendar();
    if (fallback) {
      result.strategy_card = fallback.strategy_card;
      result.value_proposition = fallback.value_proposition;
      result.channel_mix = fallback.channel_mix;
      result._meta.loaded_from = 'editorial-calendar';
    }
  }

  if (!result.strategy_card) {
    result.strategy_card = getDefaultStrategy();
    result._meta.loaded_from = 'default';
  }

  return result;
}

/**
 * 从 Agent5 的 editorial-calendar 推断策略上下文
 */
function buildFromEditorialCalendar() {
  const calendarPath = path.join(__dirname, '../../../agent5/output/editorial-calendar.json');
  if (!fs.existsSync(calendarPath)) return null;

  try {
    const calendar = JSON.parse(fs.readFileSync(calendarPath, 'utf8'));
    const topics = Array.isArray(calendar.topics) ? calendar.topics : (calendar.items || []);

    if (topics.length === 0) return null;

    // 从选题中推断策略
    const channels = [...new Set(topics.map(t => t.platform || t.channel).filter(Boolean))];
    const directions = [...new Set(topics.map(t => t.direction_id || t.direction).filter(Boolean))];

    return {
      strategy_card: {
        goal: calendar.goal || 'brand_building',
        priority_topics: directions.slice(0, 3),
        constraints: [],
      },
      value_proposition: '帮助企业实现增长目标',
      channel_mix: channels.map(c => ({ channel: c, weight: 1 })),
    };
  } catch (e) {
    return null;
  }
}

function getDefaultStrategy() {
  return {
    goal: 'brand_building',
    priority_topics: [],
    constraints: [],
    success_metrics: [],
  };
}

if (require.main === module) {
  const result = run();
  console.log('\n📋 Strategy Reader 输出\n');
  console.log(`  来源: ${result._meta.loaded_from}`);
  console.log(`  策略目标: ${result.strategy_card?.goal || 'unknown'}`);
  console.log(`  价值主张: ${result.value_proposition || '(无)'}`);
  console.log(`  渠道: ${result.channel_mix.map(c => c.channel || c).join(', ') || '(无)'}`);
  console.log('');
}

module.exports = { run };
