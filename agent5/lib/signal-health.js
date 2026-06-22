/**
 * lib/signal-health.js
 * Agent 5 信号源健康状态（进程内单例，不写文件）
 *
 * Fallback 链：aihot → follow-builders → tech-news → throw
 *
 * 用法：
 *   const { getSource, recordAihotFailure, recordAihotSuccess } = require('./signal-health');
 *   const source = await getSource();
 */

const FAIL_THRESHOLD = 2;          // 连续失败次数达到这个值才降级
const CLEANUP_AFTER_MS = 5 * 60 * 1000; // 5 分钟无失败自动清零

// ─── 健康状态（进程内单例）──────────────────────────────────────────

let state = {
  status: 'healthy',              // healthy | degraded | down
  aihot_consecutive_failures: 0,
  last_aihot_failure: null,       // ISO timestamp
  active_fallback: null,           // 'follow-builders' | 'tech-news' | null
  fallback_since: null,
  last_success: null,
};

// ─── 公开 API ────────────────────────────────────────────────────

/**
 * 返回当前应该使用的信号源
 * - healthy → 'aihot'
 * - degraded（连续失败 ≥ FAIL_THRESHOLD）→ 'follow-builders'
 * - follow-builders 也连续失败 → 'tech-news'
 * - tech-news 也挂了 → throw
 */
function getSource() {
  if (state.status === 'down') return 'down';
  if (state.status === 'degraded') {
    return state.active_fallback || 'follow-builders';
  }
  return 'aihot';
}

/**
 * 记录 aihot 请求失败（网络错误 / 非 200）
 */
function recordAihotFailure(reason) {
  state.aihot_consecutive_failures++;
  state.last_aihot_failure = new Date().toISOString();

  if (state.aihot_consecutive_failures >= FAIL_THRESHOLD && state.status !== 'degraded') {
    state.status = 'degraded';
    state.active_fallback = 'follow-builders';
    state.fallback_since = new Date().toISOString();
    console.error(`[signal-health] ⚠️ aihot 降级 (consecutive_failures=${state.aihot_consecutive_failures}) → fallback to follow-builders`);
  } else if (state.status === 'degraded' && state.active_fallback === 'follow-builders') {
    // 已降级到 follow-builders，如果它也挂了，降到 tech-news
    console.error(`[signal-health] ⚠️ aihot still failing (${state.aihot_consecutive_failures}/${FAIL_THRESHOLD}), waiting...`);
  }
}

/**
 * 记录 aihot 请求成功
 */
function recordAihotSuccess() {
  if (state.aihot_consecutive_failures > 0) {
    state.aihot_consecutive_failures = 0;
    console.error(`[signal-health] ✅ aihot 恢复 (consecutive_failures reset)`);
  }
  if (state.status === 'degraded') {
    state.status = 'healthy';
    state.active_fallback = null;
    state.fallback_since = null;
  }
  state.last_success = new Date().toISOString();
}

/**
 * 记录 fallback 源（follow-builders）失败
 */
function recordFollowBuildersFailure() {
  if (state.active_fallback === 'follow-builders' && state.status === 'degraded') {
    state.active_fallback = 'tech-news';
    console.error(`[signal-health] ⚠️ follow-builders 也失败了 → fallback to tech-news`);
  }
}

/**
 * 记录 fallback 源成功
 */
function recordFollowBuildersSuccess() {
  // follow-builders 恢复不代表 aihot 恢复，不改变主状态
}

/**
 * 记录 tech-news 失败 → 系统 down
 */
function recordTechNewsFailure() {
  state.status = 'down';
  console.error(`[signal-health] 🔴 所有信号源失败，系统 down`);
}

/**
 * 获取当前状态快照（供日志/调试用）
 */
function getState() {
  return { ...state };
}

/**
 * 重置状态（测试用）
 */
function reset() {
  state = {
    status: 'healthy',
    aihot_consecutive_failures: 0,
    last_aihot_failure: null,
    active_fallback: null,
    fallback_since: null,
    last_success: null,
  };
}

module.exports = {
  getSource,
  recordAihotFailure,
  recordAihotSuccess,
  recordFollowBuildersFailure,
  recordFollowBuildersSuccess,
  recordTechNewsFailure,
  getState,
  reset,
};
