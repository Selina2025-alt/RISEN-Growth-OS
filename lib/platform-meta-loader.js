/**
 * 平台元数据加载器
 */
const fs = require('fs');
const path = require('path');

let _cache = null;

function loadPlatformMeta() {
  if (_cache) return _cache;
  const metaPath = path.join(__dirname, 'platform-meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`[PlatformMetaLoader] ❌ platform-meta.json 不存在: ${metaPath}`);
  }
  try {
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    _cache = data.platforms;
    console.log(`[PlatformMetaLoader] ✅ 平台元数据加载: ${_cache.length} 个平台`);
    return _cache;
  } catch (e) {
    throw new Error(`[PlatformMetaLoader] ❌ JSON解析失败: ${e.message}`);
  }
}

function getPlatformMeta(platformId) {
  const meta = loadPlatformMeta();
  return meta.find(p => p.platformId === platformId) || null;
}

function reloadPlatformMeta() {
  _cache = null;
  return loadPlatformMeta();
}

module.exports = { loadPlatformMeta, getPlatformMeta, reloadPlatformMeta };
