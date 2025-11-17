#!/usr/bin/env node

/**
 * Extract translatable strings from React/TypeScript files
 * Scans all .tsx and .ts files and extracts user-facing strings
 *
 * Usage: node extract-strings.js
 * Output: extracted-strings.json
 */

const fs = require('fs');
const path = require('path');

// Patterns to match translatable strings
const PATTERNS = {
  // JSX text content: <div>Text here</div>
  jsxText: />([^<>{}\n]+)</g,

  // String literals in JSX attributes: placeholder="text"
  jsxAttribute: /(?:placeholder|title|aria-label|alt)=["']([^"']+)["']/g,

  // showToast calls: showToast.error('message')
  toast: /showToast\.(success|error|info|warning)\(['"]([\s\S]+?)['"]\)/g,

  // Error throws: throw new Error('message')
  errorThrow: /throw\s+new\s+Error\(['"]([\s\S]+?)['"]\)/g,

  // Console messages (for debugging messages)
  console: /console\.(log|error|warn|info)\(['"]([\s\S]+?)['"]/g,

  // String literals that look like user messages (heuristic)
  stringLiteral: /['"]([A-Z][^'"]{10,})['"]/g,
};

// Directories to scan
const SRC_DIR = path.join(__dirname, '../src');

// Strings to ignore (technical strings, not user-facing)
const IGNORE_PATTERNS = [
  /^https?:\/\//,  // URLs
  /^\/[a-z-/]+$/,  // Paths
  /^\d+$/,         // Pure numbers
  /^[a-z_]+$/,     // Snake case (likely variable names)
  /\${/,           // Template strings (need manual handling)
  /import\s+/,     // Import statements
  /from\s+['"]/, // From statements
  /className=/,    // Class names
  /^\s*$/,         // Empty or whitespace
];

// Files/directories to exclude
const EXCLUDE = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'vite.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
];

/**
 * Check if string should be ignored
 */
function shouldIgnore(str) {
  if (!str || str.trim().length === 0) return true;
  if (str.length < 2) return true;

  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(str)) return true;
  }

  return false;
}

/**
 * Clean and normalize extracted string
 */
function cleanString(str) {
  return str
    .trim()
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\/g, '');
}

/**
 * Extract strings from file content
 */
function extractFromFile(filePath, content) {
  const strings = new Map(); // Use Map to store string -> locations

  // Extract JSX text content
  let match;
  while ((match = PATTERNS.jsxText.exec(content)) !== null) {
    const str = cleanString(match[1]);
    if (!shouldIgnore(str) && !/^[\s\d.,:;!?()-]+$/.test(str)) {
      const line = content.substring(0, match.index).split('\n').length;
      const location = `${filePath}:${line}`;
      if (!strings.has(str)) {
        strings.set(str, []);
      }
      strings.get(str).push(location);
    }
  }

  // Extract JSX attributes
  PATTERNS.jsxAttribute.lastIndex = 0;
  while ((match = PATTERNS.jsxAttribute.exec(content)) !== null) {
    const str = cleanString(match[1]);
    if (!shouldIgnore(str)) {
      const line = content.substring(0, match.index).split('\n').length;
      const location = `${filePath}:${line}`;
      if (!strings.has(str)) {
        strings.set(str, []);
      }
      strings.get(str).push(location);
    }
  }

  // Extract toast messages
  PATTERNS.toast.lastIndex = 0;
  while ((match = PATTERNS.toast.exec(content)) !== null) {
    const str = cleanString(match[2]);
    if (!shouldIgnore(str)) {
      const line = content.substring(0, match.index).split('\n').length;
      const location = `${filePath}:${line}`;
      if (!strings.has(str)) {
        strings.set(str, []);
      }
      strings.get(str).push(location);
    }
  }

  // Extract error messages
  PATTERNS.errorThrow.lastIndex = 0;
  while ((match = PATTERNS.errorThrow.exec(content)) !== null) {
    const str = cleanString(match[1]);
    if (!shouldIgnore(str)) {
      const line = content.substring(0, match.index).split('\n').length;
      const location = `${filePath}:${line}`;
      if (!strings.has(str)) {
        strings.set(str, []);
      }
      strings.get(str).push(location);
    }
  }

  return strings;
}

/**
 * Recursively scan directory for .ts and .tsx files
 */
function scanDirectory(dir, allStrings = new Map()) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip excluded directories/files
    if (EXCLUDE.some(ex => entry.name.includes(ex))) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, allStrings);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const relativePath = path.relative(path.join(__dirname, '..'), fullPath);
      const fileStrings = extractFromFile(relativePath, content);

      // Merge strings from this file
      for (const [str, locations] of fileStrings) {
        if (!allStrings.has(str)) {
          allStrings.set(str, []);
        }
        allStrings.get(str).push(...locations);
      }
    }
  }

  return allStrings;
}

/**
 * Main execution
 */
function main() {
  console.log('Extracting translatable strings from React components...\n');

  const allStrings = scanDirectory(SRC_DIR);

  // Convert Map to array of objects for better JSON output
  const stringsArray = Array.from(allStrings.entries()).map(([text, locations]) => ({
    text,
    locations,
    count: locations.length,
  }));

  // Sort by usage count (most used first)
  stringsArray.sort((a, b) => b.count - a.count);

  // Write to JSON file
  const outputPath = path.join(__dirname, 'extracted-strings.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ strings: stringsArray, total: stringsArray.length }, null, 2)
  );

  console.log(`✓ Extracted ${stringsArray.length} unique strings`);
  console.log(`✓ Output written to: ${outputPath}\n`);

  // Show top 20 most used strings
  console.log('Top 20 most frequently used strings:');
  console.log('=====================================');
  stringsArray.slice(0, 20).forEach((item, index) => {
    console.log(`${index + 1}. "${item.text}" (${item.count} occurrences)`);
  });

  console.log('\nNext steps:');
  console.log('1. Review extracted-strings.json');
  console.log('2. Run wrap-strings.js to automatically wrap strings with __()');
  console.log('3. Add French translations to ury/locale/fr.po');
}

main();
