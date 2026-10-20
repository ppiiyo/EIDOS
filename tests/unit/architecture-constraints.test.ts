import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

const ROOT_DIR = path.resolve(__dirname, '../..');
const WORKSPACE_SRC = path.resolve(ROOT_DIR, 'apps/workspace/src');
const CORE_SRC = path.resolve(ROOT_DIR, 'packages/core/src');
const WORKFLOWS_DIR = path.resolve(ROOT_DIR, '.github/workflows');

function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Phase 5: Architectural Constraints & Quality Invariants', () => {
  it('verifies legacy root /src directory is removed and frontend resides in apps/workspace/src', () => {
    expect(fs.existsSync(path.resolve(ROOT_DIR, 'src'))).toBe(false);
    expect(fs.existsSync(WORKSPACE_SRC)).toBe(true);
    expect(fs.existsSync(path.resolve(WORKSPACE_SRC, 'App.tsx'))).toBe(true);
  });

  it('enforces <= 300 lines limit across App.tsx and all components in apps/workspace/src/components', () => {
    const componentFiles = [
      path.resolve(WORKSPACE_SRC, 'App.tsx'),
      ...collectFiles(path.resolve(WORKSPACE_SRC, 'components'), ['.tsx', '.ts']),
    ];
    expect(componentFiles.length).toBeGreaterThan(15);

    const violations: Array<{ file: string; lines: number }> = [];
    for (const file of componentFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lineCount = content.split('\n').length;
      if (lineCount > 300) {
        violations.push({ file: path.relative(ROOT_DIR, file), lines: lineCount });
      }
    }
    expect(violations).toEqual([]);
  });

  it('forbids Math.min(a.length, b.length) dimension truncation across @eidos/core and apps/workspace', () => {
    const allSourceFiles = [
      ...collectFiles(CORE_SRC, ['.ts']).filter((f) => !f.includes('/tests/')),
      ...collectFiles(WORKSPACE_SRC, ['.ts', '.tsx']),
    ];

    const truncationPattern = /Math\.min\(\s*[a-zA-Z0-9_.]+\.length\s*,\s*[a-zA-Z0-9_.]+\.length\s*\)/;
    const violations: string[] = [];
    for (const file of allSourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (truncationPattern.test(content)) {
        violations.push(path.relative(ROOT_DIR, file));
      }
    }
    expect(violations).toEqual([]);
  });

  it('forbids RECOMMENDER_ANCHORS hardcoded dictionary and localStorage catalog persistence', () => {
    const workspaceFiles = collectFiles(WORKSPACE_SRC, ['.ts', '.tsx']);
    for (const file of workspaceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('RECOMMENDER_ANCHORS');
      expect(content).not.toMatch(/localStorage\.(setItem|getItem)\(['"`]eidos_catalog/);
    }
  });

  it('verifies GitHub Actions workflows and Dockerfile contain no || true stubs or stale paths', () => {
    const workflowFiles = collectFiles(WORKFLOWS_DIR, ['.yml', '.yaml']);
    expect(workflowFiles.length).toBe(5);

    for (const wf of workflowFiles) {
      const content = fs.readFileSync(wf, 'utf-8');
      expect(content).not.toContain('|| true');
      expect(content).not.toContain("'src/**'");
      expect(content).toContain('pnpm/action-setup@v4');
    }

    const dockerfile = fs.readFileSync(path.resolve(ROOT_DIR, 'apps/api/Dockerfile'), 'utf-8');
    expect(dockerfile).not.toContain('|| true');

    const pkgPaths = [
      'packages/core/package.json',
      'packages/sdk/package.json',
      'apps/api/package.json',
      'apps/workspace/package.json',
    ];
    for (const rel of pkgPaths) {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(ROOT_DIR, rel), 'utf-8'));
      expect(typeof pkg.scripts?.build).toBe('string');
      expect(typeof pkg.scripts?.lint).toBe('string');
      expect(typeof pkg.scripts?.test).toBe('string');
    }
  });
});
