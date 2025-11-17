const fs = require('fs');
const path = require('path');

function fixTypeScriptTypes(content) {
  let fixed = content;

  // Fix Promise<T> that was wrongly wrapped: {__('Promise')}T> -> Promise<T>
  fixed = fixed.replace(/\{__\(['"]Promise['"]\)\}([^>]+)>/g, 'Promise<$1>');

  // Fix other common generic types if they were wrapped
  const types = ['Array', 'Set', 'Map', 'Record', 'Partial', 'Required', 'Pick', 'Omit', 'Readonly'];
  types.forEach(type => {
    const regex = new RegExp(`\\{__\\(['"]${type}['"']\\)\\}([^>]+)>`, 'g');
    fixed = fixed.replace(regex, `${type}<$1>`);
  });

  return fixed;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fixed = fixTypeScriptTypes(content);

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
