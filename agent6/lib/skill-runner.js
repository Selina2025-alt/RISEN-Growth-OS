// lib/skill-runner.js
// Skill 运行器：超时控制 + 错误标准化

class SkillError extends Error {
  constructor(skillName, message, code = 'SKILL_ERROR') {
    super(`[${skillName}] ${message}`);
    this.skillName = skillName;
    this.code = code;
  }
}

class SkillTimeoutError extends SkillError {
  constructor(skillName, timeoutMs) {
    super(skillName, `执行超时（${timeoutMs}ms）`, 'TIMEOUT');
    this.timeoutMs = timeoutMs;
  }
}

/**
 * 运行单个 Skill（带超时控制）
 * @param {string} skillName
 * @param {Function} fn - 异步 Skill 函数
 * @param {Object} opts
 * @param {number} [opts.timeoutMs=30000]
 * @returns {Promise}
 */
async function runSkill(skillName, fn, { timeoutMs = 30000 } = {}) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new SkillTimeoutError(skillName, timeoutMs)), timeoutMs)
    )
  ]).catch(err => {
    // JovaSkillRequiredError：Skill 路由层抛出的真实 Skill 调用请求，不要包装
    if (err && err.code === 'JOVA_SKILL_REQUIRED') throw err;
    if (err instanceof SkillTimeoutError) throw err;
    throw new SkillError(skillName, err.message);
  });
}

/**
 * 并发运行多个 Skill
 * @param {Array<{name, fn}>} skills
 * @param {number} maxConcurrent
 * @returns {Promise<Array>}
 */
async function runSkillsParallel(skills, { maxConcurrent = 3, timeoutMs = 30000 } = {}) {
  const { PipelineQueue } = require('./pipeline-queue');
  const queue = new PipelineQueue({ maxConcurrent });
  const promises = skills.map(s => queue.add(() => runSkill(s.name, s.fn, { timeoutMs })));
  return Promise.allSettled(promises);
}

module.exports = { runSkill, runSkillsParallel, SkillError, SkillTimeoutError };
