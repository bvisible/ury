const fs = require('fs');
const path = require('path');

// HTML tags to fix
const tags = [
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'button', 'a', 'li', 'ul', 'ol', 'label', 'td', 'th', 'tr',
  'table', 'nav', 'section', 'article', 'header', 'footer',
  'main', 'aside', 'form', 'input', 'select', 'option'
];

function fixClosingTags(content) {
  let fixed = content;

  // Fix pattern 1: {__('text')}/tag> to {__('text')}</tag>
  const generalRegex = /(\{__\(['"][^'"]*['"]\)\})\/([\w]+)>/g;
  fixed = fixed.replace(generalRegex, '$1</$2>');

  // Fix pattern 2: {__('text')}tag to {__('text')}</label><tag or similar
  // This is trickier - we need to find where a closing tag is missing
  // Pattern: {__('...')}span when it should be {__('...')}</label><span
  // We'll look for {__(...)}[a-z] pattern
  const missingCloseRegex = /(\{__\(['"][^'"]*['"]\)\})([a-z][\w]*)/g;
  fixed = fixed.replace(missingCloseRegex, (match, translation, tagName) => {
    // Check if tagName looks like an HTML tag start
    if (['span', 'div', 'p', 'a', 'button', 'input', 'select', 'textarea', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      // This is likely a missing closing tag - but we can't know which one
      // Return as-is for manual fix
      return match;
    }
    return match;
  });

  return fixed;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fixed = fixClosingTags(content);

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
