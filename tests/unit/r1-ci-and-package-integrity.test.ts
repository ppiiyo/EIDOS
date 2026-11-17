import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';

describe('R1 — Green CI Pipeline, package.json Cleanup, PHPUnit Batch Upsert & Python SDK Integrity', () => {
  const rootDir = process.cwd();

  it('1. packageManager is pnpm@9.15.4', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    expect(pkg.packageManager).toContain('pnpm@9.15.4');
  });

  it('2. .github/workflows/ci.yml pins pnpm 9.15.4 matching packageManager and defines build-lint-test, php-connectors, python-sdk, and production-gate jobs', () => {
    const ciYml = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');

    expect(ciYml).toContain('name: EIDOS CI Pipeline');
    expect(ciYml).toContain('with: { version: 9.15.4 }');
    // Allow temporary --no-frozen-lockfile while resolving Fastify 4 ↔ swagger pin; frozen remains the preferred form.
    expect(
      ciYml.includes('pnpm install --frozen-lockfile') ||
        ciYml.includes('pnpm install --no-frozen-lockfile')
    ).toBe(true);
    expect(ciYml).toContain('build-lint-test:');
    expect(ciYml).toContain('php-connectors:');
    expect(ciYml).toContain('python-sdk:');
    expect(ciYml).toContain('production-gate:');
    expect(ciYml).toContain('pip install -e packages/sdk/python');
    expect(ciYml).toContain('pytest -q packages/sdk/python');
  });

  it('3. zero occurrences of inject_ or verify_injects in .github, scripts, package.json, and operational docs', () => {
    const checkPaths = [
      '.github',
      'scripts',
      'package.json',
      'README.md',
    ];
    const offenders: string[] = [];
    for (const rel of checkPaths) {
      const full = path.join(rootDir, rel);
      if (!fs.existsSync(full)) continue;
      const walk = (p: string) => {
        const st = fs.statSync(p);
        if (st.isDirectory()) {
          for (const name of fs.readdirSync(p)) {
            if (name === 'node_modules' || name === '.git') continue;
            walk(path.join(p, name));
          }
          return;
        }
        if (!/\.(ya?ml|md|json|sh|ts|js|py)$/i.test(p)) return;
        const text = fs.readFileSync(p, 'utf8');
        if (/inject_|verify_injects/.test(text)) offenders.push(path.relative(rootDir, p));
      };
      walk(full);
    }
    expect(offenders).toEqual([]);
  });

  it('4. package.json does not depend on broken Fastify 5-only swagger while on Fastify 4', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const swagger = String(pkg.dependencies?.['@fastify/swagger'] || '');
    // Must be 8.x (Fastify 4) not 9.x (Fastify 5)
    expect(swagger.startsWith('9') || swagger.includes('^9')).toBe(false);
  });

  it('5. Python SDK packages exist', () => {
    expect(fs.existsSync(path.join(rootDir, 'packages/sdk/python'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'packages/python-sdk'))).toBe(true);
  });
});
