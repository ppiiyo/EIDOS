import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

describe('R1 — Green CI Pipeline, package.json Cleanup, PHPUnit & Python SDK Packaging', () => {
  const rootDir = process.cwd();

  it('1. root package.json enforces npx only-allow pnpm, pins pnpm@9.15.4, removes verify:injects, and removes onnxruntime-node from ignoredBuiltDependencies', () => {
    const pkgRaw = fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgRaw);

    expect(pkg.scripts?.preinstall).toBe('npx only-allow pnpm');
    expect(pkg.scripts?.['verify:injects']).toBeUndefined();
    expect(pkg.packageManager).toBe('pnpm@9.15.4');

    const ignored = pkg.pnpm?.ignoredBuiltDependencies ?? [];
    expect(ignored).not.toContain('onnxruntime-node');
    expect(ignored).toContain('sharp');
  });

  it('2. .github/workflows/ci.yml pins pnpm 9.15.4, runs Node 20/22 matrix, PHPUnit loop, Python SDK tests, and production-gate', () => {
    const ciYml = fs.readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8');

    expect(ciYml).toContain('name: EIDOS CI Pipeline');
    expect(ciYml).toContain('version: 9.15.4');
    expect(ciYml).not.toContain('version: 9\n');
    expect(ciYml).toContain('node-version: [20, 22]');
    expect(ciYml).toContain('php-connectors:');
    expect(ciYml).toContain('python-sdk:');
    expect(ciYml).toContain('production-gate:');
    expect(ciYml).toContain('pip install -e packages/sdk/python');
    expect(ciYml).toContain('pytest -q packages/sdk/python');
  });

  it('3. zero inject_ or verify_injects references remain in .github, scripts, or package.json', () => {
    const grepOut = execSync(
      'grep -rnE "inject_|verify_injects" .github scripts package.json || true',
      { cwd: rootDir, encoding: 'utf8' }
    ).trim();
    expect(grepOut).toBe('');
  });

  it('4. Python SDK pyproject.toml configures setuptools package discovery and passes unit tests', () => {
    const pyproject = fs.readFileSync(
      path.join(rootDir, 'packages/sdk/python/pyproject.toml'),
      'utf8'
    );
    expect(pyproject).toContain('[tool.setuptools.packages.find]');
    expect(pyproject).toContain('include = ["eidos*"]');

    const pyTestOut = execSync('python3 packages/sdk/python/tests/test_client.py 2>&1', {
      cwd: rootDir,
      env: { ...process.env, PYTHONPATH: path.join(rootDir, 'packages/sdk/python') },
      encoding: 'utf8',
    });
    expect(pyTestOut).toContain('OK');
  });

  it('5. Bitrix PHPUnit config (phpunit.xml.dist) exists and ConnectorTest.php mock handles batch /v1/catalog/upsert payloads', () => {
    const phpunitXmlPath = path.join(rootDir, 'packages/connectors/bitrix/phpunit.xml.dist');
    expect(fs.existsSync(phpunitXmlPath)).toBe(true);
    const phpunitXml = fs.readFileSync(phpunitXmlPath, 'utf8');
    expect(phpunitXml).toContain('<directory>tests</directory>');

    const connectorTestPhp = fs.readFileSync(
      path.join(rootDir, 'packages/connectors/bitrix/tests/ConnectorTest.php'),
      'utf8'
    );
    expect(connectorTestPhp).toContain("isset($body['items']) && is_array($body['items'])");
  });
});
