const fs = require('fs');
const path = require('path');

function fixCodeExpressions(content) {
  let fixed = content;

  // Fix wrapped comparison operators and logical expressions
  // Pattern: >{__('= MIN_QUANTITY && quantity')}= MAX_QUANTITY
  // Should be: >= MIN_QUANTITY && quantity <= MAX_QUANTITY

  // Fix: >{__('= MIN_QUANTITY && quantity')}=
  fixed = fixed.replace(/>\{__\(['"]= MIN_QUANTITY && quantity['"]\)\}=/g, '>= MIN_QUANTITY && quantity <=');

  // Fix other wrapped operators/expressions that shouldn't be translated
  // Pattern: {__('0 && remainingBalance')}
  fixed = fixed.replace(/\{__\(['"]0 && remainingBalance['"]\)\}/g, '0 && remainingBalance');

  // Pattern: {__('= 0 && num')}
  fixed = fixed.replace(/\{__\(['"]= 0 && num['"]\)\}/g, '= 0 && num');

  // Pattern: {__('0')} in numeric contexts
  // This is trickier - we need to avoid unwrapping legitimate string '0'

  // Pattern: {__('*')} for wildcard imports
  fixed = fixed.replace(/\{__\(['"]\*['"]\)\}/g, '*');

  // Pattern: {__(', VariantProps')}
  fixed = fixed.replace(/\{__\(['"'], VariantProps['"]\)\}/g, ', VariantProps');

  return fixed;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fixed = fixCodeExpressions(content);

  if (content !== fixed) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`Fixed: ${filePath}`);
    return 1;
  }
  return 0;
}

function processDirectory(dirPath) {
  let totalFixed = 0;

  function walk(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules') {
          walk(filePath);
        }
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        totalFixed += processFile(filePath);
      }
    });
  }

  walk(dirPath);
  return totalFixed;
}

const srcDir = path.join(__dirname, '..', 'src');
const fixed = processDirectory(srcDir);
console.log(`\nTotal files fixed: ${fixed}`);
