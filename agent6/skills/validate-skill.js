// skills/validate-skill.js
// CI 合规检查：检查 Skill 代码中是否有硬编码公司名/占位符残留

const fs = require('fs');
const path = require('path');

const FORBIDDEN_PATTERNS = [
  { pattern: /艾氪|JovaAI|ICB|数字生命卡兹克/, reason: '硬编码公司/产品名称' },
  { pattern: /\[COMPANY_NAME\]/, reason: '占位符未替换（仅允许在测试用例中使用）' },
  { pattern: /\{\{COMPANY\}\}/, reason: '占位符未替换' },
  { pattern: /\{\{BRAND\}\}/, reason: '占位符未替换' },
];

const FORBIDDEN_IN_MAIN = [
  { pattern: /艾氪|JovaAI|ICB/, reason: '主模块不得硬编码公司名' }
];

function validateSkill(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      // 允许在测试用例、配置或验证器自身中
      if (filePath.includes('test') || filePath.includes('mock') || filePath.includes('validate-skill')) continue;
      errors.push(reason);
    }
  }

  // 主入口文件额外检查
  if (filePath === 'agent6-core.js' || filePath === 'agent6-core') {
    for (const { pattern, reason } of FORBIDDEN_IN_MAIN) {
      if (pattern.test(content)) {
        errors.push(reason);
      }
    }
  }

  return {
    file: path.basename(filePath),
    pass: errors.length === 0,
    errors
  };
}

function validateDir(dir) {
  const files = fs.readdirSync(dir).filter(f => /\.js$/.test(f));
  const results = files.map(f => validateSkill(path.join(dir, f)));
  const allPass = results.every(r => r.pass);
  return { allPass, results };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    // 验证指定文件
    const result = validateSkill(args[0]);
    console.log(`${result.pass ? '✅' : '❌'} ${result.file}`);
    if (!result.pass) result.errors.forEach(e => console.log(`   - ${e}`));
    process.exit(result.pass ? 0 : 1);
  } else {
    // 验证 skills/ 目录
    const { allPass, results } = validateDir(__dirname);
    results.forEach(r => {
      console.log(`${r.pass ? '✅' : '❌'} ${r.file}`);
      if (!r.pass) r.errors.forEach(e => console.log(`   - ${e}`));
    });
    console.log(`\n${allPass ? '✅ All skills passed' : '❌ Some skills failed'}`);
    process.exit(allPass ? 0 : 1);
  }
}

module.exports = { validateSkill, validateDir };
