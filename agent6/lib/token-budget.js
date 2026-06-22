// lib/token-budget.js
// Token 预算控制

class TokenBudget {
  /**
   * @param {Object} opts
   * @param {number} [opts.maxTokens=8000] - 最大 token 预算
   */
  constructor({ maxTokens = 8000 } = {}) {
    this.maxTokens = maxTokens;
    this.used = 0;
  }

  /**
   * 预留 token（不实际扣减，用于预算规划）
   * @param {number} count
   */
  reserve(count) {
    this.used += count;
    if (this.used > this.maxTokens) {
      throw new Error(`[TokenBudget] 预算超限: ${this.used} > ${this.maxTokens}`);
    }
  }

  /**
   * 检查剩余是否足够
   * @param {number} needed
   * @returns {boolean}
   */
  canAfford(needed) {
    return (this.used + needed) <= this.maxTokens;
  }

  /**
   * 获取当前使用量
   */
  getUsed() {
    return this.used;
  }

  /**
   * 重置
   */
  reset() {
    this.used = 0;
  }
}

module.exports = { TokenBudget };
