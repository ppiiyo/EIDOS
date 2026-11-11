import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'apps/workspace/src');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(ROOT);
let changedCount = 0;

for (const file of files) {
  if (file.endsWith('lib/apiClient.ts')) continue;
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes('eidos_dev_key')) continue;

  let updated = original;

  // Replace header assignments `'x-api-key': 'eidos_dev_key'` or `"x-api-key": "eidos_dev_key"`
  updated = updated.replace(
    /(['"]x-api-key['"]\s*:\s*)(['"])eidos_dev_key\2/g,
    "$1getActiveApiKey({ allowPublicDemoKey: true })"
  );

  // Replace fallback expressions `|| 'eidos_dev_key'` or `?? 'eidos_dev_key'`
  updated = updated.replace(
    /(\|\||\?\?)\s*(['"])eidos_dev_key\2/g,
    "$1 getActiveApiKey({ allowPublicDemoKey: true })"
  );

  // Replace any remaining literal `'eidos_dev_key'` (e.g. default state / curl snippet placeholder)
  updated = updated.replace(
    /(['"])eidos_dev_key\1/g,
    "'<YOUR_EIDOS_API_KEY>'"
  );

  if (updated !== original) {
    if (updated.includes('getActiveApiKey(') && !updated.includes('from \'@/lib/apiClient\'') && !updated.includes('apiClient')) {
      const rel = path
        .relative(path.dirname(file), path.join(ROOT, 'lib/apiClient'))
        .replace(/\\/g, '/');
      const importPath = rel.startsWith('.') ? rel : `./${rel}`;
      updated = `import { getActiveApiKey } from '${importPath}';\n` + updated;
    }
    fs.writeFileSync(file, updated, 'utf8');
    changedCount++;
    console.log(`[codemod-ui-keys] Updated ${path.relative(process.cwd(), file)}`);
  }
}

console.log(`[codemod-ui-keys] Done. Updated ${changedCount} files.`);
