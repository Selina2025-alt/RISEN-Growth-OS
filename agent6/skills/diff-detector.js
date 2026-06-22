// skills/diff-detector.js
// P2.5：20% Diff 阈值检测

const crypto = require('crypto');
const fs = require('fs');

const DIFF_THRESHOLD = 0.20;

/**
 * 计算文本快速 hash
 */
function computeQuickHash(text) {
  return crypto.createHash('md5').update(text.normalize('NFC')).digest('hex');
}

/**
 * 计算两个文本之间的字级别 diff 比例
 */
function computeDiffRatio(oldText, newText) {
  if (!oldText && !newText) return 0;
  if (!oldText || !newText) return 1.0;

  const stopwords = new Set(['的','了','是','在','和','有','我','你','他','这','那','就','也','都']);
  const oldWords = oldText.split(/\s+/).filter(w => w.length >= 2 && !stopwords.has(w));
  const newWords = newText.split(/\s+/).filter(w => w.length >= 2 && !stopwords.has(w));

  const oldSet = new Set(oldWords);
  const newSet = new Set(newWords);
  const allWords = new Set([...oldSet, ...newSet]);

  let changed = 0;
  for (const word of allWords) {
    if (oldSet.has(word) !== newSet.has(word)) changed++;
  }

  return allWords.size > 0 ? changed / allWords.size : 0;
}

/**
 * 检查文件是否需要触发刷新（hash 预检）
 */
function checkFileShouldRefresh(filePath, options = {}) {
  const { prevHash } = options;
  if (!fs.existsSync(filePath)) return { shouldRefresh: false, reason: 'file_not_found' };

  const content = fs.readFileSync(filePath, 'utf8');
  const currentHash = computeQuickHash(content);

  if (prevHash && currentHash === prevHash) {
    return { shouldRefresh: false, reason: 'hash_unchanged', diffRatio: 0 };
  }
  if (!prevHash) {
    return { shouldRefresh: true, reason: 'first_seen', currentHash };
  }
  return { shouldRefresh: true, reason: 'hash_changed', currentHash };
}

/**
 * 对比两个版本文件的 diff ratio
 */
function compareFileDiff(oldPath, newPath) {
  const oldContent = fs.existsSync(oldPath) ? fs.readFileSync(oldPath, 'utf8') : '';
  const newContent = fs.readFileSync(newPath, 'utf8');
  return computeDiffRatio(oldContent, newContent);
}

/**
 * 判断是否达到刷新阈值
 */
function shouldTriggerRefresh(diffRatio) {
  return diffRatio >= DIFF_THRESHOLD;
}

module.exports = {
  computeQuickHash,
  computeDiffRatio,
  checkFileShouldRefresh,
  compareFileDiff,
  shouldTriggerRefresh,
  DIFF_THRESHOLD
};
