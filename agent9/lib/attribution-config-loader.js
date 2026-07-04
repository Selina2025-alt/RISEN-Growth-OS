/**
 * 归因配置加载器
 */
const fs = require('fs');
const path = require('path');

let _cache = null;

function loadAttributionConfig() {
  if (_cache) return _cache;
  const configPath = path.join(__dirname, 'attribution-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`[ConfigLoader] ❌ attribution-config.json 不存在: ${configPath}`);
  }
  try {
    _cache = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`[ConfigLoader] ✅ 归因配置加载: v${_cache._version}`);
    return _cache;
  } catch (e) {
    throw new Error(`[ConfigLoader] ❌ JSON解析失败: ${e.message}`);
  }
}

function reloadAttributionConfig() {
  _cache = null;
  return loadAttributionConfig();
}

module.exports = { loadAttributionConfig, reloadAttributionConfig };
