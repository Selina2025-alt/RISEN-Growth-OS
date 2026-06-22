// lib/pipeline-queue.js
// 并发队列：控制 Skill 最大并发数

class PipelineQueue {
  /**
   * @param {number} [maxConcurrent=3] - 最大并发数
   */
  constructor({ maxConcurrent = 3 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  /**
   * 添加任务（自动控制并发）
   * @param {Function} task - 异步任务函数
   * @returns {Promise}
   */
  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this._process();
    });
  }

  _process() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const { task, resolve, reject } = this.queue.shift();
      this.running++;
      task()
        .then(res => { resolve(res); this.running--; this._process(); })
        .catch(err => { reject(err); this.running--; this._process(); });
    }
  }

  /**
   * 等待所有任务完成
   * @returns {Promise}
   */
  async drain() {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise(r => setTimeout(r, 50));
    }
  }
}

module.exports = { PipelineQueue };
