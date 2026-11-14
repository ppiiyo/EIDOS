import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

describe('R1 — Green CI Pipeline, package.json Cleanup, PHPUnit Batch Upsert & Python SDK Integrity', () => {
  const rootDir = process.cwd();

  it('1. root package.json enforces npx only-allow pnpm, pnpm@9.15.4, removes verify:injects, and removes onnxruntime-node from ignoredBuiltDependencies', () => {
    const pkgRaw = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw);

    expect(pkg.scripts.preinstall).toBe('npx only-allow pnpm');
    expect(pkg.scripts['verify:injects']).toBeUndefined();
    expect(pkg.packageManager).toBe('pnpm@9.15.4');
    expect(pkg.pnpm.ignoredBuiltDependencies).toContain('sharp');
    expect(pkg.pnpm.ignoredBuiltDependencies).not.toContain('onnxruntime-node');
  });

  it('2. .github/workflows/ci.yml pins pnpm 9.15.4 matching packageManager and defines build-lint-test, php-connectors, python-sdk, and production-gate jobs', () => {
    const ciYml = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');

    expect(ciYml).toContain('name: EIDOS CI Pipeline');
    expect(ciYml).toContain('with: { version: 9.15.4 }');
    expect(ciYml).toContain('pnpm install --frozen-lockfile');
    expect(ciYml).toContain('build-lint-test:');
    expect(ciYml).toContain('php-connectors:');
    expect(ciYml).toContain('python-sdk:');
    expect(ciYml).toContain('production-gate:');
    expect(ciYml).toContain('pip install -e packages/sdk/python');
    expect(ciYml).toContain('pytest -q packages/sdk/python');
  });

  it('3. zero occurrences of inject_ or verify_injects in .github, scripts, package.json, and operational docs', () => {
    const checkPaths = [
      'package.json',
      'README.md',
      'docs/MONITORING.md',
      'docs/CI_STATUS.md',
      'docs/PILOT_READY.md',
    ];
    for (const rel of checkPaths) {
      const content = fs.readFileSync(path.join(rootDir, rel), 'utf8');
      expect(content).not.toMatch(/inject_|verify_injects|verify:injects/);
    }

    const wfDir = path.join(rootDir, '.github/workflows');
    for (const f of fs.readdirSync(wfDir)) {
      const content = fs.readFileSync(path.join(wfDir, f), 'utf8');
      expect(content).not.toMatch(/inject_|verify_injects|verify:injects/);
    }

    const scriptsDir = path.join(rootDir, 'scripts');
    for (const f of fs.readdirSync(scriptsDir)) {
      expect(f).not.toMatch(/^inject_|verify_injects/);
    }
  });

  it('4. Bitrix PHPUnit config exists and ConnectorTest.php mock server handles batch items array on /v1/catalog/upsert', () => {
    const phpunitXmlPath = path.join(rootDir, 'packages/connectors/bitrix/phpunit.xml');
    expect(fs.existsSync(phpunitXmlPath)).toBe(true);
    const phpunitXml = fs.readFileSync(phpunitXmlPath, 'utf8');
    expect(phpunitXml).toContain('<directory>tests</directory>');

    const connectorTestPhp = fs.readFileSync(
      path.join(rootDir, 'packages/connectors/bitrix/tests/ConnectorTest.php'),
      'utf8'
    );
    expect(connectorTestPhp).toContain("isset($body['items']) && is_array($body['items'])");
    expect(connectorTestPhp).toContain("'upserted' => count($body['items'])");
  });

  it('5. Python SDK packages/sdk/python has aligned pyproject.toml/setup.py and passes unit tests', () => {
    const pyproject = fs.readFileSync(
      path.join(rootDir, 'packages/sdk/python/pyproject.toml'),
      'utf8'
    );
    const setupPy = fs.readFileSync(path.join(rootDir, 'packages/sdk/python/setup.py'), 'utf8');

    expect(pyproject).toContain('[tool.setuptools.packages.find]');
    expect(setupPy).toContain('version="3.0.0"');

    const out = execSync(
      'PYTHONPATH=packages/sdk/python python3 -m unittest discover -s packages/sdk/python/tests -v',
      { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    expect(String(out)).toBeDefined();
  });
});
