import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../src/server';
import { VectorStore } from '../src/services/vector-store';
import { StoreRegistry } from '../src/services/store-registry';
import { RBACManager } from '../src/services/multi-tenancy';
import { signJwtToken } from '../src/middleware/auth';

const REPO_ROOT = path.resolve(__dirname, '../../..');

describe('P0 (1–12) & P1 Final Audit Regression Suite', () => {
  beforeEach(() => {
    StoreRegistry.resetInstance();
  });

  it('P0-1: Bitrix include.php has no conditional namespace block and ConnectorInterface.php is separated', () => {
    const includePhp = fs.readFileSync(
      path.join(REPO_ROOT, 'packages/connectors/bitrix/include.php'),
      'utf8'
    );
    const connectorInterfacePhp = fs.readFileSync(
      path.join(REPO_ROOT, 'packages/connectors/bitrix/lib/Core/ConnectorInterface.php'),
      'utf8'
    );

    expect(includePhp).not.toMatch(/\bnamespace\s+/);
    expect(includePhp).toContain("require_once __DIR__ . '/lib/Core/ConnectorInterface.php'");
    expect(connectorInterfacePhp).toContain('namespace Eidos\\Connectors\\Core;');
    expect(connectorInterfacePhp).toContain('interface ConnectorInterface');
  });

  it('P0-2: Bitrix SearchReplacer payload shape without diversityFactor in filters returns 200 on live /v1/search', async () => {
    const searchReplacerPhp = fs.readFileSync(
      path.join(REPO_ROOT, 'packages/connectors/bitrix/src/SearchReplacer.php'),
      'utf8'
    );
    expect(searchReplacerPhp).toContain("'filters' => (object) $eidosFilters");
    expect(searchReplacerPhp).not.toContain("'diversityFactor' => $diversityFactor");

    const app = await buildServer();
    try {
      // Exact payload shape produced by SearchReplacer::replaceSearch()
      const res = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: {
          query: 'наушники',
          limit: 20,
          mode: 'hybrid',
          alpha: 0.65,
          filters: {
            category: 'Audio',
            min_price: 1000,
            max_price: 50000,
          },
          filterCategory: 'Audio',
        },
      });
      expect(res.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('P0-3: /v1/health checkVectorStore returns status ok even when initialItemsIndexed > 0', async () => {
    const healthTs = fs.readFileSync(
      path.join(REPO_ROOT, 'apps/api/src/routes/health.ts'),
      'utf8'
    );
    expect(healthTs).not.toContain("initializedEmpty ? 'ok' : 'warning'");

    const app = await buildServer();
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body.checks.vectorStore.status).toBe('ok');
    } finally {
      await app.close();
    }
  });

  it('P0-4 & P0-5: /v1/demo/load and /v1/demo/reset never touch default store, reject 409 if production items exist, and demo key stays in demo tenant', async () => {
    const prevDemoKey = process.env.EIDOS_PUBLIC_DEMO_KEY;
    process.env.EIDOS_PUBLIC_DEMO_KEY = 'eidos_pk_live_demo_key_test_1234567890';
    const app = await buildServer();
    try {
      // Upsert a production item into default:default
      const upsertRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: {
          id: 'prod-only-item-1',
          title: 'Secret Enterprise Hardware',
          category: 'Enterprise',
          price: 9999,
        },
      });
      expect(upsertRes.statusCode).toBe(200);

      // Querying with EIDOS_PUBLIC_DEMO_KEY when demo:demo is empty MUST NOT leak default:default
      const demoSearchEmpty = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_pk_live_demo_key_test_1234567890' },
        payload: { query: 'Secret Enterprise Hardware', limit: 5 },
      });
      expect(demoSearchEmpty.statusCode).toBe(200);
      expect(demoSearchEmpty.json().results).toHaveLength(0);

      // Loading 48 items into demo:demo must NOT overwrite default:default
      const loadRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/load',
        payload: { scale: '48' },
      });
      expect(loadRes.statusCode).toBe(200);
      expect(app.storeRegistry.getOrCreateStore('default', 'default').count()).toBe(1);
      expect(app.storeRegistry.getOrCreateStore('demo', 'demo').count()).toBe(48);

      // Resetting demo:demo must NOT clear default:default
      const resetRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/reset',
      });
      expect(resetRes.statusCode).toBe(200);
      expect(app.storeRegistry.getOrCreateStore('default', 'default').count()).toBe(1);
      expect(app.storeRegistry.getOrCreateStore('demo', 'demo').count()).toBe(0);

      // If production items are upserted into demo:demo, /v1/demo/load and /v1/demo/reset return 409
      const demoStore = app.storeRegistry.getOrCreateStore('demo', 'demo');
      demoStore.upsert({
        id: 'prod-in-demo',
        title: 'Production item in demo store',
        description: '',
        category: 'General',
        price: 100,
        inStock: true,
        tags: [],
        url: '/product/prod-in-demo',
        embedding: new Array(384).fill(0.01),
      });
      expect(demoStore.hasProductionCatalogItems()).toBe(true);

      const conflictLoad = await app.inject({
        method: 'POST',
        url: '/v1/demo/load',
      });
      expect(conflictLoad.statusCode).toBe(409);
      expect(conflictLoad.json().error).toBe('DEMO_DISABLED_FOR_PRODUCTION_CATALOG');

      const conflictReset = await app.inject({
        method: 'POST',
        url: '/v1/demo/reset',
      });
      expect(conflictReset.statusCode).toBe(409);
      expect(conflictReset.json().error).toBe('DEMO_DISABLED_FOR_PRODUCTION_CATALOG');
    } finally {
      process.env.EIDOS_PUBLIC_DEMO_KEY = prevDemoKey;
      await app.close();
    }
  });

  it('P0-6: VectorStore marks hasProductionCatalogItems() = true after snapshot/WAL restore', async () => {
    const tmpDir = fs.mkdtempSync(path.join(REPO_ROOT, 'data/test-snap-'));
    const snapPath = path.join(tmpDir, 'catalog.snapshot.json');
    try {
      const store1 = new VectorStore({ snapshotPath: snapPath });
      store1.upsert({
        id: 'snap-1',
        title: 'Snapshot Product',
        description: 'Restored item',
        category: 'Tech',
        price: 500,
        inStock: true,
        tags: [],
        url: '/product/snap-1',
        embedding: new Array(384).fill(0.05),
      });
      store1.saveSnapshotSync(snapPath);

      const store2 = new VectorStore({ snapshotPath: snapPath });
      const count = await store2.loadSnapshotFromDisk(
        {
          embed: async () => new Float32Array(384).fill(0.05),
          embedBatch: async (texts) => texts.map(() => new Float32Array(384).fill(0.05)),
        },
        snapPath
      );
      expect(count).toBe(1);
      expect(store2.hasProductionCatalogItems()).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('P0-8: widget.js accepts eidos_pk_, eidos_search_, eidos_sk_ and supports legacy data-key/data-api attributes', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const widget = require(path.join(REPO_ROOT, 'public/widget.js'));
    expect(widget.isSafeStorefrontKey('eidos_pk_123456')).toBe(true);
    expect(widget.isSafeStorefrontKey('eidos_search_123456')).toBe(true);
    expect(widget.isSafeStorefrontKey('eidos_sk_123456')).toBe(true);
    expect(widget.isSafeStorefrontKey('eidos_ak_123456')).toBe(false);
    expect(widget.isSafeStorefrontKey('eidos_mk_123456')).toBe(false);

    const widgetSource = fs.readFileSync(path.join(REPO_ROOT, 'public/widget.js'), 'utf8');
    expect(widgetSource).toContain("s.getAttribute('data-api-key') || s.getAttribute('data-key')");
    expect(widgetSource).toContain("s.getAttribute('data-api-url') ||\n        s.getAttribute('data-api')");
  });

  it('P0-10 & P0-11 & P0-12: Bitrix template escapes onclick JSON, Python SDK chunks by 500 to /v1/catalog, and pack.sh packages eidos.connector', () => {
    const bitrixTpl = fs.readFileSync(
      path.join(
        REPO_ROOT,
        'packages/connectors/bitrix/components/eidos/search.page/templates/.default/template.php'
      ),
      'utf8'
    );
    expect(bitrixTpl).toContain('htmlspecialchars((string) json_encode');

    const pySdk1 = fs.readFileSync(
      path.join(REPO_ROOT, 'packages/sdk/python/eidos/__init__.py'),
      'utf8'
    );
    expect(pySdk1).toContain('range(0, len(items), 500)');
    expect(pySdk1).toContain('"/v1/catalog"');
    expect(pySdk1).not.toContain('"/v1/catalog/batch"');

    const packSh = fs.readFileSync(path.join(REPO_ROOT, 'connectors/bitrix/pack.sh'), 'utf8');
    expect(packSh).toContain('packages/connectors/bitrix');
    expect(packSh).toContain('eidos.connector.tar.gz');
  });

  it('P1: RBACManager ignores X-Eidos-Role header, /v1/catalog/upsert rejects > 500 items, JWT role is respected, and /docs has Swagger CSP', async () => {
    // RBACManager ignores spoofed X-Eidos-Role header when apiKeyContext is missing or search
    expect(
      RBACManager.resolveRole({
        headers: { 'x-eidos-role': 'admin', 'x-api-key': 'random-key' },
      })
    ).toBe('readonly');
    expect(
      RBACManager.resolveRole({
        headers: { 'x-eidos-role': 'admin' },
        apiKeyContext: { role: 'search' },
      })
    ).toBe('readonly');
    expect(
      RBACManager.resolveRole({
        headers: {},
        apiKeyContext: { role: 'admin' },
      })
    ).toBe('admin');

    const app = await buildServer();
    try {
      // > 500 items rejected with 400
      const oversizedItems = Array.from({ length: 501 }, (_, i) => ({
        id: `item-${i}`,
        title: `Item ${i}`,
      }));
      const batchRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { items: oversizedItems },
      });
      expect(batchRes.statusCode).toBe(400);

      // JWT with default/search role cannot write catalog
      const searchJwt = signJwtToken(
        { sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 },
        'eidos_jwt_secret'
      );
      const jwtWriteRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { authorization: `Bearer ${searchJwt}` },
        payload: { id: 'jwt-item', title: 'Blocked Write' },
      });
      expect(jwtWriteRes.statusCode).toBe(403);

      // /docs route relaxes script-src for Swagger UI
      const docsRes = await app.inject({
        method: 'GET',
        url: '/docs/json',
      });
      expect(docsRes.headers['content-security-policy']).toContain(
        "script-src 'self' 'unsafe-inline'"
      );
    } finally {
      await app.close();
    }
  });
});
