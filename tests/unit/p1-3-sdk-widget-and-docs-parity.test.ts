import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { EidosClient } from '../../packages/sdk/src/client';

describe('P1-3 — Storefront Widget i18n/urlTemplate, SDK Parity, WooCommerce Packager & Honest Docs', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. public/widget.js supports locale (ru/en), currency formatting, urlTemplate resolution, and stays byte-identical with apps/workspace/public/widget.js', () => {
    const rootWidgetPath = path.resolve(process.cwd(), 'public/widget.js');
    const wsWidgetPath = path.resolve(process.cwd(), 'apps/workspace/public/widget.js');

    const rootBytes = fs.readFileSync(rootWidgetPath, 'utf8');
    const wsBytes = fs.readFileSync(wsWidgetPath, 'utf8');
    expect(rootBytes).toBe(wsBytes);

    // Ensure mountWidget wires resolveProductUrl(item, urlTemplate) and formatPrice(item.price, locale, currency)
    expect(rootBytes).toContain('resolveProductUrl(item, urlTemplate)');
    expect(rootBytes).toContain('resolveProductUrl(chosen, urlTemplate)');
    expect(rootBytes).toContain('formatPrice(item.price, locale, currency)');

    const req = createRequire(import.meta.url);
    const widget = req(rootWidgetPath) as {
      formatPrice: (price: number, locale?: string, currency?: string) => string;
      resolveProductUrl: (item: Record<string, unknown>, urlTemplate?: string) => string;
    };

    expect(typeof widget.formatPrice).toBe('function');
    const ruPrice = widget.formatPrice(14990, 'ru', 'RUB');
    expect(ruPrice).toContain('₽');
    expect(ruPrice).toMatch(/14[\s\u00a0.,]?990/);

    const enPrice = widget.formatPrice(299, 'en', 'USD');
    expect(enPrice).toContain('$');
    expect(enPrice).toContain('299');

    const eurPrice = widget.formatPrice(125, 'en', 'EUR');
    expect(eurPrice).toMatch(/€|EUR/);

    // Verify Bitrix / WooCommerce URL template resolution when item.url is missing
    expect(widget.resolveProductUrl({ id: '5501', sku: 'SKU-5501' }, '/catalog/#ID#/')).toBe(
      '/catalog/5501/'
    );
    expect(widget.resolveProductUrl({ id: '5501', sku: 'SKU-5501' }, '/product/{sku}/')).toBe(
      '/product/SKU-5501/'
    );
  });

  it('2. @eidos/sdk EidosClient sends x-tenant-id, x-index-name, x-api-key and supports suggest(), upsertBatch(), and ready()', async () => {
    const capturedRequests: Array<{
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: unknown;
    }> = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = String(init?.method || 'GET');
      const headers = (init?.headers || {}) as Record<string, string>;
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      capturedRequests.push({ url, method, headers, body });

      if (url.endsWith('/v1/ready')) {
        return new Response(
          JSON.stringify({ ready: true, status: 'ready', itemsIndexed: 12 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.endsWith('/v1/suggest')) {
        return new Response(
          JSON.stringify({
            query: 'sony',
            results: [
              {
                id: 'hp-1',
                title: 'Sony WH-1000XM5',
                description: 'ANC headphones',
                category: 'Audio',
                tags: ['anc'],
                score: 0.96,
              },
            ],
            total: 1,
            latencyMs: 1.4,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.endsWith('/v1/catalog/upsert')) {
        return new Response(
          JSON.stringify({ success: true, indexedCount: 2, upserted: 2, durationMs: 4.1 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = new EidosClient({
      baseUrl: 'https://api.eidos.local',
      apiKey: 'eidos_ak_test_key_1234567890',
      tenantId: 'tenant-acme',
      indexName: 'products-v1',
    });

    const readyRes = await client.ready();
    expect(readyRes.ready).toBe(true);

    const suggestRes = await client.suggest({ query: 'sony', limit: 5 });
    expect(suggestRes.results).toHaveLength(1);
    expect(suggestRes.results[0].id).toBe('hp-1');

    const batchRes = await client.upsertBatch([
      { id: '1', title: 'Item 1' },
      { id: '2', title: 'Item 2' },
    ]);
    expect(batchRes.success).toBe(true);
    expect(batchRes.upserted).toBe(2);

    expect(capturedRequests).toHaveLength(3);
    for (const req of capturedRequests) {
      expect(req.headers['x-api-key']).toBe('eidos_ak_test_key_1234567890');
      expect(req.headers['x-tenant-id']).toBe('tenant-acme');
      expect(req.headers['x-index-name']).toBe('products-v1');
    }
  });

  it('3. Python SDKs target /v1/catalog/upsert (never /v1/catalog/items), support suggest() and ready(), and pass tenant/index headers', () => {
    const pySdkMain = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/sdk/python/eidos/__init__.py'),
      'utf8'
    );
    const pySdkLegacy = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/python-sdk/eidos/__init__.py'),
      'utf8'
    );

    expect(pySdkMain).not.toContain('"/v1/catalog/items"');
    expect(pySdkMain).toContain('"/v1/catalog/upsert"');
    expect(pySdkMain).toContain('def suggest(');
    expect(pySdkMain).toContain('def ready(');
    expect(pySdkMain).toContain('headers["x-tenant-id"]');
    expect(pySdkMain).toContain('headers["x-index-name"]');

    expect(pySdkLegacy).toContain('"/v1/catalog/upsert"');
    expect(pySdkLegacy).toContain('def suggest(');
    expect(pySdkLegacy).toContain('def ready(');
    expect(pySdkLegacy).toContain('headers["x-tenant-id"]');
    expect(pySdkLegacy).toContain('headers["x-index-name"]');
  });

  it('4. connectors/woocommerce/pack.sh packages canonical packages/connectors/woocommerce, CI workflows are valid, and README.md/package.json have zero inject references', () => {
    const wooPackShPath = path.resolve(process.cwd(), 'connectors/woocommerce/pack.sh');
    const wooPackSh = fs.readFileSync(wooPackShPath, 'utf8');
    expect(wooPackSh).toContain('packages/connectors/woocommerce');

    execSync(`bash "${wooPackShPath}"`, { cwd: process.cwd(), stdio: 'pipe' });
    const outZip = path.resolve(process.cwd(), 'dist/eidos-woocommerce-plugin.zip');
    expect(fs.existsSync(outZip)).toBe(true);
    expect(fs.statSync(outZip).size).toBeGreaterThan(1000);

    const pkgJson = fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8');
    expect(pkgJson).not.toContain('verify_injects');
    expect(pkgJson).not.toContain('verify:injects');

    const ciYml = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    expect(ciYml).toContain('packages/connectors/bitrix');
    expect(ciYml).not.toContain('cd ../woocommerce && composer install');
    expect(ciYml).toContain('pnpm --filter @eidos/core build && pnpm --filter @eidos/sdk build');

    const pyToml = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/sdk/python/pyproject.toml'),
      'utf8'
    );
    expect(pyToml).toContain('[project.optional-dependencies]');
    expect(pyToml).toContain('pytest');

    const readme = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf8');
    expect(readme).not.toContain('verify:injects');
    expect(readme).not.toContain('auto-apply-p0.yml');
    expect(readme).not.toContain('verify-injects-daily.yml');
    expect(readme).not.toContain('some UI/SLA acceptance tests may still fail');
    expect(readme).toContain('scripts/smoke.sh');
  });
});
