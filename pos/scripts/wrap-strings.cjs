#!/usr/bin/env node

/**
 * Automatically wrap translatable strings with __() function
 * This script transforms hardcoded strings into translatable ones
 *
 * Usage: node wrap-strings.js [--dry-run] [--file=path/to/file.tsx]
 *
 * Examples:
 *   node wrap-strings.js --dry-run                    # Preview changes without writing
 *   node wrap-strings.js --file=src/components/Header.tsx  # Process specific file
 *   node wrap-strings.js                               # Process all files
 */

const fs = require('fs');
const path = require('path');

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const specificFile = args.find(arg => arg.startsWith('--file='))?.split('=')[1];

// Configuration
const SRC_DIR = path.join(__dirname, '../src');

// Files to exclude from transformation
const EXCLUDE_FILES = [
  'i18n.ts',
  'vite-env.d.ts',
];

// Patterns to transform
const TRANSFORMATIONS = [
  // JSX text content: <div>Text</div> => <div>{__('Text')}</div>
  {
    name: 'JSX Text Content',
    pattern: />([^<>{}\n]+)</g,
    check: (match, content, index) => {
      const text = match[1].trim();
      // Skip if already wrapped, is whitespace, or is a number
      if (!text || /^[\s\d.,:;!?()-]+$/.test(text) || text.includes('__('

)) {
        return null;
      }
      // Skip if text contains JSX expressions
      if (text.includes('{') || text.includes('}')) {
        return null;
      }
      return text;
    },
    replace: (match, text) => `>{__('${text.trim()}')}`,
  },

  // JSX attributes: placeholder="text" => placeholder={__('text')}
  {
    name: 'JSX Attributes',
    pattern: /(placeholder|title|aria-label|alt)=["']([^"']+)["']/g,
    check: (match) => {
      const text = match[2];
      // Skip if already wrapped or contains template syntax
      if (text.includes('__') || text.includes('${')) {
        return null;
      }
      return text;
    },
    replace: (match, attr, text) => `${attr}={__('${text}')}`,
  },

  // showToast calls: showToast.error('msg') => showToast.error(__('msg'))
  {
    name: 'Toast Messages',
    pattern: /(showToast\.(success|error|info|warning))\(['"]([\s\S]+?)['"]\)/g,
    check: (match) => {
      const text = match[3];
      if (text.includes('__')) return null;
      return text;
    },
    replace: (match, toastCall, type, text) => `${toastCall}(__('${text}'))`,
  },

  // Error throws: throw new Error('msg') => throw new Error(__('msg'))
  {
    name: 'Error Messages',
    pattern: /throw\s+new\s+Error\(['"]([\s\S]+?)['"]\)/g,
    check: (match) => {
      const text = match[1];
      if (text.includes('__')) return null;
      return text;
    },
    replace: (match, text) => `throw new Error(__('${text}'))`,
  },
];

/**
 * Add import statement for __ function if not already present
 */
function ensureImport(content) {
  // Check if __ is already imported from i18n
  if (content.includes("from '../lib/i18n'") || content.includes('from "@/lib/i18n"')) {
    // Check if __ is in the import
    const importMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"](\.\.\/lib\/i18n|@\/lib\/i18n)['"]/);
    if (importMatch) {
      const imports = importMatch[1].split(',').map(s => s.trim());
      if (!imports.includes('__')) {
        // Add __ to existing import
        const newImports = [...imports, '__'].join(', ');
        return content.replace(importMatch[0], `import { ${newImports} } from '${importMatch[2]}'`);
      }
      return content;
    }
  }

  // Determine correct import path based on file location
  const lines = content.split('\n');
  const lastImportIndex = lines.findIndex((line, idx) => {
    return idx > 0 && !line.startsWith('import') && lines[idx - 1].startsWith('import');
  });

  // Add import after last existing import
  if (lastImportIndex > 0) {
    lines.splice(lastImportIndex, 0, "import { __ } from '../lib/i18n';");
    return lines.join('\n');
  }

  // No imports found, add at the beginning
  return "import { __ } from '../lib/i18n';\n\n" + content;
}

/**
 * Transform a single file
 */
function transformFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let changeCount = 0;
  const changes = [];

  // Apply each transformation
  for (const transform of TRANSFORMATIONS) {
    let match;
    transform.pattern.lastIndex = 0;

    while ((match = transform.pattern.exec(originalContent)) !== null) {
      const checkedText = transform.check(match, originalContent, match.index);
      if (checkedText !== null) {
        const replacement = transform.replace(...match);
        content = content.replace(match[0], replacement);
        changeCount++;
        changes.push({
          type: transform.name,
          original: match[0],
          replacement,
          line: originalContent.substring(0, match.index).split('\n').length,
        });
      }
    }
  }

  // Add import if changes were made
  if (changeCount > 0) {
    content = ensureImport(content);
  }

  return {
    content,
    changeCount,
    changes,
    modified: content !== originalContent,
  };
}

/**
 * Process all files in directory
 */
function processDirectory(dir, stats = { processed: 0, modified: 0, totalChanges: 0 }) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules, dist, etc.
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
      continue;
    }

    // Skip excluded files
    if (EXCLUDE_FILES.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      processDirectory(fullPath, stats);
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      stats.processed++;
      const result = transformFile(fullPath);

      if (result.modified) {
        stats.modified++;
        stats.totalChanges += result.changeCount;

        const relativePath = path.relative(path.join(__dirname, '..'), fullPath);
        console.log(`\n${relativePath}:`);
        console.log(`  ✓ ${result.changeCount} changes`);

        if (!isDryRun) {
          fs.writeFileSync(fullPath, result.content, 'utf-8');
          console.log('  ✓ File updated');
        } else {
          console.log('  ⚠ DRY RUN - changes not saved');
          // Show first 3 changes as preview
          result.changes.slice(0, 3).forEach(change => {
            console.log(`    Line ${change.line} (${change.type}):`);
            console.log(`      - ${change.original}`);
            console.log(`      + ${change.replacement}`);
          });
          if (result.changes.length > 3) {
            console.log(`    ... and ${result.changes.length - 3} more changes`);
          }
        }
      }
    }
  }

  return stats;
}

/**
 * Main execution
 */
function main() {
  console.log('='.repeat(60));
  console.log('  Auto-wrapping translatable strings with __()');
  console.log('='.repeat(60));

  if (isDryRun) {
    console.log('\n⚠  DRY RUN MODE - No files will be modified\n');
  }

  let stats;

  if (specificFile) {
    // Process single file
    const fullPath = path.join(__dirname, '..', specificFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`Error: File not found: ${specificFile}`);
      process.exit(1);
    }

    console.log(`Processing: ${specificFile}\n`);
    const result = transformFile(fullPath);

    if (result.modified) {
      console.log(`✓ ${result.changeCount} changes made`);
      if (!isDryRun) {
        fs.writeFileSync(fullPath, result.content, 'utf-8');
        console.log('✓ File updated');
      }
    } else {
      console.log('✓ No changes needed');
    }

    stats = { processed: 1, modified: result.modified ? 1 : 0, totalChanges: result.changeCount };
  } else {
    // Process all files
    console.log(`Scanning directory: ${SRC_DIR}\n`);
    stats = processDirectory(SRC_DIR);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log('='.repeat(60));
  console.log(`Files processed: ${stats.processed}`);
  console.log(`Files modified: ${stats.modified}`);
  console.log(`Total changes: ${stats.totalChanges}`);

  if (isDryRun) {
    console.log('\n⚠  DRY RUN - Run without --dry-run to apply changes');
  } else {
    console.log('\n✓ All changes applied successfully');
    console.log('\nNext steps:');
    console.log('1. Review the changes with git diff');
    console.log('2. Test the application to ensure nothing broke');
    console.log('3. Extract strings with: node extract-strings.js');
    console.log('4. Add French translations to ury/locale/fr.po');
  }
}

main();
