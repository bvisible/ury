const fs = require('fs');
const path = require('path');

const stringsToWrap = [
  "A default customer will be automatically selected.",
  "Add New Order",
  "Add comment",
  "Add to Order",
  "Cancelling order...",
  "Cancelling...",
  "Confirm Cancel",
  "Dine In is not available for your role",
  "Edit comment",
  "Loading aggregators...",
  "Loading...",
  "Order created successfully",
  "Order updated successfully",
  "Print",
  "Printing...",
  "Processing Order...",
  "Processing payment...",
  "Processing...",
  "Saving...",
  "Select an aggregator",
  "Select group",
  "Select territory",
  "TWINT",
  "Terminal",
  "Update Order",
  "Updating Order...",
  "You can select a table after starting the order."
];

function wrapString(content) {
  let modified = content;
  let changeCount = 0;

  stringsToWrap.forEach(str => {
    const escapedStr = str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: JSX text >Text< -> >{__('Text')}<
    const jsxRegex = new RegExp(`>\\s*${escapedStr}\\s*<`, 'g');
    if (jsxRegex.test(modified)) {
      modified = modified.replace(jsxRegex, `>{__('${str}')}<`);
      changeCount++;
    }

    // Pattern 2: Ternary 'Text' or "Text" -> __('Text')
    const ternaryRegex1 = new RegExp(`'${escapedStr}'`, 'g');
    const ternaryRegex2 = new RegExp(`"${escapedStr}"`, 'g');

    if (ternaryRegex1.test(modified) && !/__\(/.test(modified.match(ternaryRegex1)?.[0] || '')) {
      modified = modified.replace(ternaryRegex1, `__('${str}')`);
      changeCount++;
    }

    if (ternaryRegex2.test(modified) && !/__\(/.test(modified.match(ternaryRegex2)?.[0] || '')) {
      modified = modified.replace(ternaryRegex2, `__("${str}")`);
      changeCount++;
    }
  });

  return { modified, changeCount };
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { modified, changeCount } = wrapString(content);

  if (changeCount > 0) {
    fs.writeFileSync(filePath, modified, 'utf8');
    console.log(`✓ ${path.basename(filePath)}: ${changeCount} strings wrapped`);
    return changeCount;
  }
  return 0;
}

function processDirectory(dirPath) {
  let totalChanges = 0;
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        totalChanges += processDirectory(filePath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      totalChanges += processFile(filePath);
    }
  });

  return totalChanges;
}

const srcDir = path.join(__dirname, '..', 'src');
const totalChanges = processDirectory(srcDir);
console.log(`\nTotal: ${totalChanges} strings wrapped across all files`);
