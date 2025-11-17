const fs = require('fs');
const path = require('path');

const unwrappedStrings = new Set();

function findUnwrappedStrings(content, filePath) {
  // Pattern 1: JSX text between tags: >Text<
  const jsxTextRegex = />([A-Z][a-zA-Z\s.!?,'"-]+)</g;
  let match;

  while ((match = jsxTextRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text && !text.includes('__') && text.length > 2 && text.length < 100) {
      unwrappedStrings.add(text);
    }
  }

  // Pattern 2: Ternary with string literals: condition ? 'Text' : 'Other'
  const ternaryRegex = /\?\s*['"]([A-Z][a-zA-Z\s.!?,'"-]+)['"]\s*:\s*['"]([A-Z][a-zA-Z\s.!?,'"-]+)['"]/g;
  while ((match = ternaryRegex.exec(content)) !== null) {
    const text1 = match[1].trim();
    const text2 = match[2].trim();
    if (text1 && text1.length > 2) unwrappedStrings.add(text1);
    if (text2 && text2.length > 2) unwrappedStrings.add(text2);
  }

  // Pattern 3: Simple ternary: ? 'Text'
  const simpleTernaryRegex = /\?\s*['"]([A-Z][a-zA-Z\s.!?,'"-]+)['"]/g;
  while ((match = simpleTernaryRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text && text.length > 2 && text.length < 100) {
      unwrappedStrings.add(text);
    }
  }
}

function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        processDirectory(filePath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(filePath, 'utf8');
      findUnwrappedStrings(content, filePath);
    }
  });
}

const srcDir = path.join(__dirname, '..', 'src');
processDirectory(srcDir);

console.log('Found unwrapped strings:');
Array.from(unwrappedStrings).sort().forEach(str => {
  console.log(`  "${str}"`);
});

console.log(`\nTotal: ${unwrappedStrings.size} unwrapped strings`);
