// lib/file-utils.js
// 原子文件写入工具

const fs = require('fs');
const path = require('path');

/**
 * 原子写入 JSON 文件
 * 先写临时文件，再 rename（rename 在 POSIX 下是原子的）
 * @param {string} filePath
 * @param {any} data
 */
function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = filePath + '.tmp.' + Date.now() + '.' + process.pid;
  const json = JSON.stringify(data, null, 2);

  fs.writeFileSync(tmpPath, json, 'utf8');
  fs.renameSync(tmpPath, filePath); // atomic on POSIX
}

/**
 * 读取 JSON 文件（带容错）
 */
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

module.exports = { writeJsonAtomic, readJsonFile };
