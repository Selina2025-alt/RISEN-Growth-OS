#!/usr/bin/env node
/**
 * scripts/schema-validator.js
 * Phase 0: Schema validator for RISEN Agent 4/5/6 output files
 * 
 * Usage:
 *   node schema-validator.js <file>              # validate one file
 *   node schema-validator.js --all               # validate all known files
 *   node schema-validator.js --all --fix         # fix in place (backup .bak first)
 *   node schema-validator.js --all --dry-run     # report only, no changes
 */

const fs = require('fs');
const path = require('path');

// ─── Schemas (define what we expect) ───────────────────────────────────────

const SCHEMAS = {
  'narrative-constraints.json': {
    description: 'Agent 4 output: narrative constraints (hyphenated filename)',
    detect: (j) => j && j.narrative_constraints && typeof j.narrative_constraints === 'object',
    validate: (j) => {
      const nc = j.narrative_constraints;
      if (!nc) return [{ field: 'narrative_constraints', message: 'missing top-level key' }];
      const errors = [];
      if (!nc.main_axis) errors.push({ field: 'narrative_constraints.main_axis', message: 'missing' });
      if (!Array.isArray(nc.forbidden_directions)) errors.push({ field: 'narrative_constraints.forbidden_directions', message: 'must be array' });
      if (!Array.isArray(nc.encouraged_directions)) errors.push({ field: 'narrative_constraints.encouraged_directions', message: 'must be array' });
      return errors;
    }
  },

  'channel_mix.json': {
    description: 'Agent 4 output: channel mix',
    detect: (j) => j && Array.isArray(j.channels),
    validate: (j) => {
      if (!Array.isArray(j.channels)) return [{ field: 'channels', message: 'must be array' }];
      const errors = [];
      j.channels.forEach((ch, i) => {
        if (!ch.name) errors.push({ field: `channels[${i}].name`, message: 'missing' });
        if (typeof ch.weight !== 'number') errors.push({ field: `channels[${i}].weight`, message: 'must be number' });
      });
      return errors;
    }
  },

  'MA-*.json|ART-*.json': {
    description: 'Agent 6 output: MasterArticle (all formats: ART-*, MA-*)',
    detect: (j) => j && j.article_id && j.content,
    validate: (j) => {
      const errors = [];
      if (!j.article_id) errors.push({ field: 'article_id', message: 'missing' });
      if (!j.content) errors.push({ field: 'content', message: 'missing' });
      else if (j.content.length < 200) errors.push({ field: 'content', message: `too short (${j.content.length} chars, min 200)` });
      // quality_gate OR quality_check (两种格式兼容)
      // MA-*.json: {pass, reasons}  |  ART-*.json: {passed, score, reasons}
      const qg = j.quality_gate || j.quality_check;
      if (!qg) errors.push({ field: 'quality_gate/quality_check', message: 'missing' });
      else {
        const passed = qg.passed !== undefined ? qg.passed : (qg.pass !== undefined ? qg.pass : undefined);
        if (typeof passed !== 'boolean') errors.push({ field: 'quality_gate.pass/passed', message: 'must be boolean' });
        // score 只在 ART-*.json 中有，MA-*.json 没有，所以不强制
      }
      // content_type is optional, defaults to analysis
      if (j.content_type && !['news','analysis','case_study','tutorial','marketing'].includes(j.content_type)) {
        errors.push({ field: 'content_type', message: `invalid value "${j.content_type}"` });
      }
      return errors;
    }
  },

  'trend-briefs/*.json': {
    description: 'Agent 5 output: topic brief (in trend-briefs/)',
    detect: (j) => j && (j.topic_id || j.brief_id),
    validate: (j) => {
      const errors = [];
      const hasTopicId = j.topic_id || j.brief_id;
      const titleField = j.topic_title || j.title || '';
      if (!hasTopicId) errors.push({ field: 'topic_id/brief_id', message: 'missing' });
      if (!titleField) errors.push({ field: 'topic_title/title', message: 'missing' });
      // content_type validation - use actual field or agent6_guidance
      const ct = j.content_type || (j.agent6_guidance && j.agent6_guidance.content_type) || null;
      if (!ct) {
        errors.push({ field: 'content_type', message: 'missing (will default to analysis)' });
      } else if (!['news','analysis','case_study','tutorial','marketing'].includes(ct)) {
        errors.push({ field: 'content_type', message: `invalid value "${ct}"` });
      }
      if (!j.keywords) errors.push({ field: 'keywords', message: 'missing' });
      else if (!Array.isArray(j.keywords)) errors.push({ field: 'keywords', message: 'must be array' });
      return errors;
    }
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function findSchemaType(filename) {
  const base = path.basename(filename);
  for (const [key, schema] of Object.entries(SCHEMAS)) {
    if (key === base) return { key, schema };
    if (key.includes('*')) {
      // Support pipe-separated glob keys like "MA-*.json|ART-*.json"
      const parts = key.split('|');
      for (const part of parts) {
        const pattern = part.trim().replace(/\*/g, '[^/]+');
        if (new RegExp(`^${pattern}$`).test(base)) return { key, schema };
      }
    }
  }
  return null;
}

function validateFile(filePath, fix = false) {
  const filename = path.basename(filePath);
  const schemaInfo = findSchemaType(filePath);
  
  if (!schemaInfo) return { file: filePath, status: 'SKIP', reason: 'no schema for this file type' };

  let data;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    return { file: filePath, status: 'ERROR', reason: `JSON parse failed: ${e.message}` };
  }

  if (!schemaInfo.schema.detect(data)) {
    return { file: filePath, status: 'SKIP', reason: `file does not match schema pattern (${schemaInfo.key})` };
  }

  const errors = schemaInfo.schema.validate(data);
  
  if (errors.length === 0) return { file: filePath, status: 'PASS', schema: schemaInfo.key };

  // Auto-fix for content_type defaulting
  if (fix && schemaInfo.key === 'trend-briefs/*.json' && !data.content_type) {
    data.content_type = 'analysis';
    fs.writeFileSync(filePath + '.bak', JSON.stringify(JSON.parse(fs.readFileSync(filePath)), null, 2));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return { file: filePath, status: 'FIXED', errors };
  }

  return { file: filePath, status: 'FAIL', schema: schemaInfo.key, errors };
}

function scanDirectory(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...scanDirectory(full, pattern));
    } else if (pattern.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const fix = args.includes('--fix');

const root = path.resolve(__dirname, '..');

const targets = args.filter(a => !a.startsWith('--'));
const mode = targets[0];

const results = [];

if (mode === '--all' || !mode) {
  // Scan all known locations
  const dirs = [
    { dir: path.join(root, 'agent4', 'mock-data'), pattern: /^narrative_constraints\.json$/ },
  // channel_mix.json: 暂不存在（Agent 4 Skill 6 的运行时输出），Schema 预定义，待实现后启用
  // 'channel_mix.json': { ... },
    { dir: path.join(root, 'agent5', 'output'), pattern: /^topic-pool\.json$/ },
    { dir: path.join(root, 'agent5', 'output', 'trend-briefs'), pattern: /\.json$/ },
    { dir: path.join(root, 'agent6', 'output'), pattern: /^(ART-|MA-).+\.json$/ },
  ];

  for (const { dir, pattern } of dirs) {
    for (const file of scanDirectory(dir, pattern)) {
      const result = validateFile(file, fix && !dryRun);
      results.push(result);
    }
  }
} else {
  const result = validateFile(path.resolve(mode), fix && !dryRun);
  results.push(result);
}

// ─── Report ──────────────────────────────────────────────────────────────────

let pass = 0, fail = 0, skip = 0, fixed = 0;

for (const r of results) {
  if (r.status === 'PASS') pass++;
  else if (r.status === 'FIXED') fixed++;
  else if (r.status === 'SKIP') skip++;
  else fail++;

  const icon = r.status === 'PASS' ? '✅' : r.status === 'FIXED' ? '🔧' : r.status === 'SKIP' ? '⏭️' : '❌';
  console.log(`${icon} [${r.status}] ${r.file}`);
  if (r.errors) {
    r.errors.forEach(e => console.log(`   └─ ${e.field}: ${e.message}`));
  }
  if (r.reason) console.log(`   └─ ${r.reason}`);
}

console.log(`\n📊 Total: ${results.length} | ✅ PASS: ${pass} | 🔧 FIXED: ${fixed} | ⏭️ SKIP: ${skip} | ❌ FAIL: ${fail}`);
if (dryRun) console.log('(dry-run: no files were modified)');
process.exit(fail > 0 ? 1 : 0);
