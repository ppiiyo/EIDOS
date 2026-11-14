import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { HNSWIndex } from '../../packages/core/src/hnsw';
import { runRecallAndLatencyBenchmark } from '../../scripts/benchmark';
import { buildServer } from '../../apps/api/src/server';
import { signJwtToken, clearRevokedJwtsForTests } from '../../apps/api/src/middleware/auth';
import { parseYmlOrCommerceMl } from '../../apps/api/src/services/yml-parser';

describe('P1-1: Honest HNSW Recall@K Benchmark, JWT Revocation, Streaming Admin Snapshots & Hardened YML Parser', () => {
  beforeEach(() => {
    clearRevokedJwtsForTests();
  });

  it('1. HNSWIndex.searchExact & evaluateRecallAtK and runRecallAndLatencyBenchmark compute real ground-truth Recall@10 >= 0.90 with compact Int32Array reverseLinks', async () => {
    const report = await runRecallAndLatencyBenchmark({
      corpusSize: 400,
      queryCount: 25,
      dimension: 384,
      k: 10,
      efSearch: 64,
    });

    expect(report.corpusSize).toBe(400);
    expect(report.dimension).toBe(384);
    expect(report.recallAtK).toBeGreaterThanOrEqual(0.9);
    expect(report.hnswLatency.queriesEvaluated).toBe(25);
    expect(report.hnswLatency.p95Ms).toBeGreaterThanOrEqual(0);
    expect(report.memoryStats.nodeCount).toBe(400);

    // Verify Int32Array reverseLinks and exact search consistency
    const hnsw = new HNSWIndex({ M: 8, M0: 16, efConstruction: 32, efSearch: 32 });
    const dim = 32;
    for (let i = 0; i < 40; i++) {
      const v = new Float32Array(dim);
      for (let d = 0; d < dim; d++) v[d] = Math.sin((i + 1) * 0.2 + d * 0.1);
      hnsw.insert(`node-${i}`, v);
    }

    const revLinks = hnsw.getReverseLinksForId('node-0');
    expect(revLinks.length).toBeGreaterThan(0);
    expect(revLinks[0]).toBeInstanceOf(Int32Array);

    const q = new Float32Array(dim);
    for (let d = 0; d < dim; d++) q[d] = Math.sin(0.2 + d * 0.1);
    const exactTop = hnsw.searchExact(q, 5);
    expect(exactTop[0].id).toBe('node-0');
    expect(exactTop[0].distance).toBeLessThan(1e-5);
  });

  it('2. Signed JWT tokens carry jti and are immediately rejected with 401 after revocation via POST /v1/admin/jwt/revoke', async () => {
    const secret = 'eidos_test_jwt_secret_key_for_p1_1_revocation';
    process.env.JWT_SECRET = secret;
    const app = await buildServer();
    try {
      await app.ready();

      const nowSec = Math.floor(Date.now() / 1000);
      const token = signJwtToken(
        {
          jti: 'test-jwt-jti-001',
          role: 'search',
          tenantId: 'default',
          exp: nowSec + 3600,
        },
        secret
      );

      // Token works before revocation
      const searchBefore = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'наушники', limit: 5 },
      });
      expect(searchBefore.statusCode).toBe(200);

      // Revoke via POST /v1/admin/jwt/revoke using admin key
      const revokeRes = await app.inject({
        method: 'POST',
        url: '/v1/admin/jwt/revoke',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { token },
      });
      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.json().success).toBe(true);
      expect(revokeRes.json().revokedId).toBe('test-jwt-jti-001');

      // Token is rejected with 401 immediately after revocation
      const searchAfter = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { authorization: `Bearer ${token}` },
        payload: { query: 'наушники', limit: 5 },
      });
      expect(searchAfter.statusCode).toBe(401);
      expect(searchAfter.json().message).toContain('revoked');
    } finally {
      delete process.env.JWT_SECRET;
      await app.close();
    }
  });

  it('3. POST /v1/snapshots uses streaming snapshot write and creates .meta.json & .hnsw.bin sidecars', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-p1-1-snap-'));
    const snapPath = path.join(tmpDir, 'admin-snap.json');
    const app = await buildServer();
    try {
      await app.ready();

      await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: {
          items: [
            {
              id: 'snap-sku-1',
              title: 'Беспроводные наушники Sony WH-1000XM5',
              description: 'Флагманские наушники с шумоподавлением',
              category: 'Наушники и аудио',
              price: 29990,
              inStock: true,
              tags: ['sony', 'anc'],
            },
          ],
        },
      });

      const snapRes = await app.inject({
        method: 'POST',
        url: '/v1/snapshots',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { path: snapPath },
      });
      expect(snapRes.statusCode).toBe(201);
      const body = snapRes.json();
      expect(body.success).toBe(true);
      expect(body.snapshot.itemsCount).toBe(1);
      expect(body.snapshot.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(fs.existsSync(snapPath)).toBe(true);
      expect(fs.existsSync(`${snapPath}.meta.json`)).toBe(true);
      expect(fs.existsSync(`${snapPath}.hnsw.bin`)).toBe(true);
    } finally {
      await app.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('4. parseYmlOrCommerceMl and POST /v1/catalog/import-yml block XXE/ENTITY attacks and extract <param> attributes & numeric XML entities without regex backtracking', async () => {
    const xxeXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE yml_catalog [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<yml_catalog><shop><offers><offer id="1"><name>&xxe;</name><price>100</price></offer></offers></shop></yml_catalog>`;

    expect(() => parseYmlOrCommerceMl(xxeXml)).toThrow(/XML_ENTITY_FORBIDDEN/);

    const richYml = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2026-11-13 12:00">
  <shop>
    <categories>
      <category id="10">&#1040;&#1074;&#1090;&#1086;&#1090;&#1086;&#1074;&#1072;&#1088;&#1099;</category>
    </categories>
    <offers>
      <offer id="oil-5w40" available="true">
        <name>Моторное масло Synth</name>
        <vendor>Mobil</vendor>
        <vendorCode>MOB-5W40-4L</vendorCode>
        <categoryId>10</categoryId>
        <price>4290</price>
        <param name="Вязкость">5W-40</param>
        <param name="Объем">4 л</param>
      </offer>
    </offers>
  </shop>
</yml_catalog>`;

    const parsed = parseYmlOrCommerceMl(richYml);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].category).toBe('Автотовары');
    expect(parsed[0].tags).toContain('5W-40');
    expect(parsed[0].description).toContain('Вязкость: 5W-40');

    // Verify HTTP endpoint returns 400 XML_ENTITY_FORBIDDEN on XXE payload
    const app = await buildServer();
    try {
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/catalog/import-yml',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { xml: xxeXml },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('XML_ENTITY_FORBIDDEN');
    } finally {
      await app.close();
    }
  });
});
