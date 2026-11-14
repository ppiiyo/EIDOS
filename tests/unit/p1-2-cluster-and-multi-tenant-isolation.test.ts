import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildServer } from '../../apps/api/src/server';
import { CacheKeys } from '../../apps/api/src/services/cache';
import { ApiQueryCache } from '../../apps/api/src/services/query-cache';
import { StoreRegistry } from '../../apps/api/src/services/store-registry';

describe('P1-2: Multi-Tenant Cache & Index Isolation, Honest Cluster Mode & Pilot/Smoke Hardening', () => {
  beforeEach(() => {
    StoreRegistry.resetInstance();
    ApiQueryCache.invalidateAll();
  });

  it('1. CacheKeys isolates userRecommend, recommend, and catalogStats across tenant:index namespaces while preserving default backward compatibility', () => {
    expect(CacheKeys.userRecommend('user-42', 5)).toBe('recommend:user:user-42:5');
    expect(CacheKeys.userRecommend('user-42', 5, 'default:default')).toBe(
      'recommend:user:user-42:5'
    );
    expect(CacheKeys.userRecommend('user-42', 5, 'tenant_a:catalog_1')).toBe(
      'recommend:tenant_a:catalog_1:user:user-42:5'
    );

    expect(CacheKeys.catalogStats()).toBe('catalog:stats');
    expect(CacheKeys.catalogStats('tenant_a:catalog_1')).toBe(
      'catalog:stats:tenant_a:catalog_1'
    );

    const recKeyA = CacheKeys.recommend('item-1', 'simple', 5, undefined, 'tenant_a:default');
    const recKeyB = CacheKeys.recommend('item-1', 'simple', 5, undefined, 'tenant_b:default');
    expect(recKeyA).toContain('recommend:tenant_a:default:');
    expect(recKeyB).toContain('recommend:tenant_b:default:');
    expect(recKeyA).not.toBe(recKeyB);
  });

  it('2. Indexing documents into one tenant custom index invalidates only that namespace without wiping other tenants L1 caches', async () => {
    const app = await buildServer();
    try {
      await app.ready();

      // Seed tenant_beta and warm its search cache
      await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': 'eidos_dev_key', 'x-tenant-id': 'tenant_beta' },
        payload: {
          items: [
            {
              id: 'beta-1',
              title: 'Beta Exclusive Running Shoes',
              description: 'Lightweight marathon shoes',
              category: 'Footwear',
              price: 8900,
              inStock: true,
              tags: ['running'],
            },
          ],
        },
      });

      const betaSearch1 = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_dev_key', 'x-tenant-id': 'tenant_beta' },
        payload: { query: 'Beta Exclusive Running Shoes', limit: 5 },
      });
      expect(betaSearch1.statusCode).toBe(200);
      expect(betaSearch1.headers['x-cache']).toBe('MISS');

      const betaSearch2 = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_dev_key', 'x-tenant-id': 'tenant_beta' },
        payload: { query: 'Beta Exclusive Running Shoes', limit: 5 },
      });
      expect(betaSearch2.statusCode).toBe(200);
      expect(betaSearch2.headers['x-cache']).toBe('HIT');

      // Create index in tenant_alpha and index documents -> should NOT wipe tenant_beta's cache
      const createIdx = await app.inject({
        method: 'POST',
        url: '/v1/indexes',
        headers: { 'x-api-key': 'eidos_dev_key', 'x-tenant-id': 'tenant_alpha' },
        payload: { name: 'alpha_idx', dimension: 384, quantization: 'int8' },
      });
      expect(createIdx.statusCode).toBe(201);

      const addDocs = await app.inject({
        method: 'POST',
        url: '/v1/indexes/alpha_idx/documents',
        headers: { 'x-api-key': 'eidos_dev_key', 'x-tenant-id': 'tenant_alpha' },
        payload: {
          documents: [
            {
              id: 'alpha-1',
              title: 'Alpha Mechanical Keyboard',
              description: 'Hot-swap tactile keyboard',
              category: 'Peripherals',
              price: 12000,
              tags: ['keyboard'],
            },
          ],
        },
      });
      expect(addDocs.statusCode).toBe(200);

      // tenant_beta's search cache remains a HIT
      const betaSearch3 = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_dev_key', 'x-tenant-id': 'tenant_beta' },
        payload: { query: 'Beta Exclusive Running Shoes', limit: 5 },
      });
      expect(betaSearch3.statusCode).toBe(200);
      expect(betaSearch3.headers['x-cache']).toBe('HIT');
    } finally {
      await app.close();
    }
  });

  it('3. GET /v1/cluster/status reports honest deploymentMode ("single-node" by default, "clustered" when CLUSTER_MODE=true)', async () => {
    delete process.env.CLUSTER_MODE;
    const appSingle = await buildServer();
    try {
      await appSingle.ready();
      const res = await appSingle.inject({ method: 'GET', url: '/v1/cluster/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json().clusterMode).toBe(false);
      expect(res.json().deploymentMode).toBe('single-node');
    } finally {
      await appSingle.close();
    }

    process.env.CLUSTER_MODE = 'true';
    const appCluster = await buildServer();
    try {
      await appCluster.ready();
      const res = await appCluster.inject({ method: 'GET', url: '/v1/cluster/status' });
      expect(res.statusCode).toBe(200);
      expect(res.json().clusterMode).toBe(true);
      expect(res.json().deploymentMode).toBe('clustered');
    } finally {
      delete process.env.CLUSTER_MODE;
      await appCluster.close();
    }
  });

  it('4. deploy/pilot/install.sh --dry-run creates .env.pilot with 0600 permissions, JWT_SECRET, EIDOS_PUBLIC_DEMO_KEY, and scripts/smoke.sh --dry-run passes', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-deploy-pilot-'));
    try {
      const installScript = path.resolve(process.cwd(), 'deploy/pilot/install.sh');
      const stdout = execFileSync('bash', [installScript, '--dry-run', tmpDir], {
        encoding: 'utf8',
      });

      const envFile = path.join(tmpDir, '.env.pilot');
      expect(fs.existsSync(envFile)).toBe(true);
      const mode = fs.statSync(envFile).mode & 0o777;
      expect(mode).toBe(0o600);

      const content = fs.readFileSync(envFile, 'utf8');
      expect(content).toContain('EIDOS_MASTER_KEY=eidos_ak_');
      expect(content).toContain('EIDOS_SEARCH_KEY=eidos_pk_');
      expect(content).toContain('EIDOS_PUBLIC_DEMO_KEY=eidos_demo_');
      expect(content).toContain('JWT_SECRET=eidos_jwt_');
      expect(content).toContain('EIDOS_ENABLE_DEMO_MUTATIONS=true');
      expect(content).not.toContain('CORS_ORIGIN=*');

      // Stdout must not print generated secret keys
      expect(stdout).not.toContain('eidos_ak_');
      expect(stdout).not.toContain('eidos_jwt_');

      const smokeScript = path.resolve(process.cwd(), 'scripts/smoke.sh');
      const smokeOut = execFileSync('bash', [smokeScript, '--dry-run'], { encoding: 'utf8' });
      expect(smokeOut).toContain('--dry-run passed');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
