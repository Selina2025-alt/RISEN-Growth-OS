#!/usr/bin/env node
/**
 * scripts/fix-art-json.js
 * 清理 ART-*.json 文件中的非法 JSON 控制字符
 * 同时将 output 里的旧数据补上 content_type 字段
 */
const fs = require('fs');
const path = require('path');

function fixJSONString(raw) {
  // Strategy: parse using a tolerant approach
  // Replace any raw byte that's < 0x20 (control) but not tab/cr/lf/space with ?
  // Then try strict parse
  const cleaned = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
  
  // Try strict parse first
  try {
    return { data: JSON.parse(cleaned), fixed: cleaned.length !== raw.length };
  } catch (e) {
    // If still fails, use a more aggressive approach
    // Try removing ALL non-printable/non-ASCII characters from content fields
    try {
      // Replace with lossy but parseable version
      const lossy = raw
        .split('')
        .map(c => {
          const code = c.charCodeAt(0);
          // Allow tab, newline, cr, standard printable, all unicode above 0x3000 (CJK)
          if (code === 9 || code === 10 || code === 13) return c;
          if (code >= 32 && code <= 126) return c;
          if (code >= 0x3000) return c; // CJK
          return ' '; // replace everything else with space
        })
        .join('');
      return { data: JSON.parse(lossy), fixed: true, lossy: true };
    } catch (e2) {
      return { error: e2.message };
    }
  }
}

function migrateContentType(obj) {
  // Ensure MasterArticle has content_type field (defaults to 'analysis')
  if (!obj.content_type) {
    obj.content_type = 'analysis';
  }
  if (!obj.quality_gate) {
    obj.quality_gate = { passed: true, score: 0, reasons: ['migrated from legacy format'] };
  }
  return obj;
}

const ART_DIR = path.join(__dirname, '..', 'agent6', 'output');

let fixed = 0, already_ok = 0, failed = 0;

if (!fs.existsSync(ART_DIR)) {
  console.log('No output directory found:', ART_DIR);
  process.exit(0);
}

for (const file of fs.readdirSync(ART_DIR)) {
  if (!file.startsWith('ART-') || !file.endsWith('.json')) continue;
  const filepath = path.join(ART_DIR, file);
  const raw = fs.readFileSync(filepath, 'utf8');
  
  const result = fixJSONString(raw);
  
  if (result.error) {
    console.log(`❌ ${file}: ${result.error}`);
    failed++;
    continue;
  }
  
  const data = migrateContentType(result.data);
  
  if (result.fixed) {
    // Backup and write
    fs.writeFileSync(filepath + '.bak', raw);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`🔧 ${file}: fixed${result.lossy ? ' (lossy)' : ''} | content_type=${data.content_type}`);
    fixed++;
  } else {
    // Already OK, just ensure content_type
    if (!data.content_type) {
      data.content_type = 'analysis';
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      console.log(`🔧 ${file}: added content_type=${data.content_type}`);
      fixed++;
    } else {
      already_ok++;
    }
  }
}

console.log(`\n📊 Fixed: ${fixed} | Already OK: ${already_ok} | Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
