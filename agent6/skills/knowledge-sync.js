// skills/knowledge-sync.js
// P2.3：目录实时监听（chokidar）+ diff 检测

const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const { scanKnowledgeDir } = require('./knowledge-base-reader');
const { buildCapabilityIndex } = require('./capability-index-builder');
const { checkFileShouldRefresh, compareFileDiff, shouldTriggerRefresh } = require('./diff-detector');

class KnowledgeSync {
  constructor({ watchDir = './knowledge', debounceMs = 2000 } = {}) {
    this.watchDir = watchDir;
    this.debounceMs = debounceMs;
    this.timer = null;
    this.pendingEvents = [];  // { filePath, event }
    this.watcher = null;
    this.lastHashes = new Map(); // filePath → last hash
  }

  start() {
    if (this.watcher) return;
    this.watcher = chokidar.watch(this.watchDir, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
    });

    this.watcher
      .on('add',    path => this._scheduleRefresh(path, 'add'))
      .on('change', path => this._scheduleRefresh(path, 'change'))
      .on('unlink', path => this._scheduleRefresh(path, 'unlink'))
      .on('error', err => console.error('[knowledge-sync] error:', err));

    console.log(`[knowledge-sync] watching ${this.watchDir}`);
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    if (this.watcher) { this.watcher.close(); this.watcher = null; }
  }

  _scheduleRefresh(filePath, event) {
    this.pendingEvents.push({ filePath, event, ts: Date.now() });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this._flush(), this.debounceMs);
  }

  async _flush() {
    if (this.pendingEvents.length === 0) return;
    const events = [...this.pendingEvents];
    this.pendingEvents = [];
    const filePaths = [...new Set(events.map(e => e.filePath))];

    console.log(`[knowledge-sync] ${events.length} event(s): ${filePaths.join(', ')}`);

    let refreshed = false;
    for (const { filePath } of filePaths) {
      const prevHash = this.lastHashes.get(filePath) || null;
      const { shouldRefresh, currentHash, reason } = checkFileShouldRefresh(filePath, { prevHash });

      if (!shouldRefresh) {
        console.log(`[knowledge-sync] ${filePath}: ${reason}, skipping`);
        continue;
      }

      // 检查 diff ratio（首次只看 hash 变化）
      const backupPath = filePath + '.bak';
      let diffRatio = 1.0;
      if (fs.existsSync(backupPath)) {
        diffRatio = compareFileDiff(backupPath, filePath);
      }

      if (!shouldTriggerRefresh(diffRatio)) {
        console.log(`[knowledge-sync] ${filePath}: diff=${(diffRatio*100).toFixed(1)}% < 20%, skipping`);
        this.lastHashes.set(filePath, currentHash);
        continue;
      }

      console.log(`[knowledge-sync] ${filePath}: diff=${(diffRatio*100).toFixed(1)}% >= 20%, triggering refresh`);
      fs.copyFileSync(filePath, backupPath);
      this.lastHashes.set(filePath, currentHash);

      try {
        await scanKnowledgeDir({ forceRefresh: true });
        await buildCapabilityIndex({ source: 'docs' });
        refreshed = true;
      } catch (err) {
        console.error(`[knowledge-sync] refresh failed: ${err.message}`);
      }
    }

    if (!refreshed) {
      console.log('[knowledge-sync] no files reached 20% threshold, skipping full refresh');
    } else {
      console.log('[knowledge-sync] refresh complete');
    }
  }
}

if (require.main === module) {
  const sync = new KnowledgeSync({ watchDir: process.argv[2] || './knowledge' });
  sync.start();
  process.on('SIGINT', () => { sync.stop(); process.exit(0); });
}

module.exports = { KnowledgeSync };
