import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ServerEmbedder,
  DEFAULT_MULTILINGUAL_ONNX_MODEL,
  resolveEmbeddingMode,
  resolveOnnxModelId,
} from '../../apps/api/src/services/embedder';
import { VectorStore, EmbeddingSpaceMismatchError } from '../../apps/api/src/services/vector-store';
import { buildServer } from '../../apps/api/src/server';
import { ApiQueryCache } from '../../apps/api/src/services/query-cache';
import { getSemanticCache } from '../../apps/api/src/services/cache';

describe('P0-3: Multilingual ONNX Model Default, Honest Lexical-Only Mode & Snapshot Model Verification', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    'EIDOS_EMBEDDER_MODE',
    'EIDOS_USE_ONNX_EMBEDDER',
    'EIDOS_USE_ONNX',
    'EIDOS_ONNX_MODEL',
    'EIDOS_EMBEDDING_MODEL',
    'EIDOS_EMBEDDING_SPACE_ID',
    'EIDOS_EMBEDDER_STRICT_ONNX',
  ];

  beforeEach(() => {
    for (const k of envKeys) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
    ServerEmbedder.resetForTests();
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = savedEnv[k];
      }
    }
    ServerEmbedder.resetForTests();
  });

  it('defaults ONNX model to multilingual Xenova/paraphrase-multilingual-MiniLM-L12-v2 and supports EIDOS_ONNX_MODEL override', () => {
    expect(DEFAULT_MULTILINGUAL_ONNX_MODEL).toBe('Xenova/paraphrase-multilingual-MiniLM-L12-v2');
    expect(resolveOnnxModelId()).toBe('Xenova/paraphrase-multilingual-MiniLM-L12-v2');

    process.env.EIDOS_EMBEDDER_MODE = 'onnx';
    const embedder = ServerEmbedder.getInstance();
    expect(embedder.getEmbeddingMode()).toBe('onnx');
    expect(embedder.getActiveModelName()).toBe('paraphrase-multilingual-MiniLM-L12-v2');
    expect(embedder.getEmbeddingSpaceId()).toBe('onnx:paraphrase-multilingual-MiniLM-L12-v2:384:v1');

    process.env.EIDOS_ONNX_MODEL = 'Xenova/multilingual-e5-small';
    expect(resolveOnnxModelId()).toBe('Xenova/multilingual-e5-small');
    expect(embedder.getActiveModelName()).toBe('multilingual-e5-small');
    expect(embedder.getEmbeddingSpaceId()).toBe('onnx:multilingual-e5-small:384:v1');
  });

  it('supports honest EIDOS_EMBEDDER_MODE=lexical-only without fake hash vectors and routes /v1/search to pure BM25+ lexical weights', async () => {
    process.env.EIDOS_EMBEDDER_MODE = 'lexical-only';
    const embedder = ServerEmbedder.getInstance();

    expect(resolveEmbeddingMode()).toBe('lexical-only');
    expect(embedder.getEmbeddingMode()).toBe('lexical-only');
    expect(embedder.getActiveModelName()).toBe('lexical-bm25-only');
    expect(embedder.getEmbeddingSpaceId()).toBe('lexical:bm25-only:v1');

    const singleVec = await embedder.embed('перфоратор makita sds-plus');
    expect(singleVec.length).toBe(384);
    expect(singleVec.every((v) => v === 0)).toBe(true);

    const batchVecs = await embedder.embedBatch(['перфоратор', 'шуруповерт']);
    expect(batchVecs.length).toBe(2);
    expect(batchVecs[0].every((v) => v === 0)).toBe(true);
    expect(batchVecs[1].every((v) => v === 0)).toBe(true);

    const app = await buildServer();
    try {
      await app.ready();

      const upsertRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': 'eidos_dev_key', 'x-tenant-id': 'lex-tenant' },
        payload: {
          items: [
            {
              id: 'lex-1',
              sku: 'MAK-HR2470',
              title: 'Перфоратор Makita HR2470 SDS-Plus 780Вт',
              description: 'Надежный трехрежимный перфоратор для бетона',
              category: 'Инструменты и ремонт',
              price: 14990,
              inStock: true,
            },
            {
              id: 'lex-2',
              sku: 'SHOKZ-RUN',
              title: 'Наушники Shokz OpenRun Pro',
              description: 'Беспроводные спортивные наушники с костной проводимостью',
              category: 'Наушники и аудио',
              price: 15990,
              inStock: true,
            },
          ],
        },
      });
      expect(upsertRes.statusCode).toBe(200);

      // Search 1: "перфоратор makita"
      const search1 = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_dev_key', 'x-tenant-id': 'lex-tenant' },
        payload: { query: 'перфоратор makita', limit: 5 },
      });
      expect(search1.statusCode).toBe(200);
      const body1 = search1.json();
      expect(body1.alpha).toBe(0);
      expect(body1.weights.lexical).toBe(1);
      expect(body1.weights.semantic).toBe(0);
      expect(body1.meta.embeddingMode).toBe('lexical-only');
      expect(body1.meta.embeddingSpaceId).toBe('lexical:bm25-only:v1');
      expect(body1.results.length).toBeGreaterThan(0);
      expect(body1.results[0].id).toBe('lex-1');

      // Search 2: distinct query "наушники shokz" must NOT hit semantic cache on zero vector
      const search2 = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_dev_key', 'x-tenant-id': 'lex-tenant' },
        payload: { query: 'наушники shokz', limit: 5 },
      });
      expect(search2.statusCode).toBe(200);
      expect(search2.headers['x-cache']).toBe('MISS');
      const body2 = search2.json();
      expect(body2.results.length).toBeGreaterThan(0);
      expect(body2.results[0].id).toBe('lex-2');
    } finally {
      await app.close();
    }
  });

  it('persists embeddingModel and embeddingMode in .meta.json, records snapshotMismatchError on model change, and reports degraded health when ONNX fallback occurs', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-p0-3-'));
    const snapPath = path.join(tmpDir, 'catalog.snapshot.json');

    try {
      const embedder = ServerEmbedder.getInstance();
      const store = new VectorStore({
        snapshotPath: snapPath,
        embeddingSpaceId: embedder.getEmbeddingSpaceId(),
      });

      const vec = await embedder.embed('беговые кроссовки asics');
      store.upsert({
        id: 'item-1',
        title: 'Беговые кроссовки Asics Gel-Nimbus',
        description: 'Кроссовки для бега по асфальту',
        category: 'Обувь и кроссовки',
        price: 12900,
        inStock: true,
        embedding: Array.from(vec),
      });

      await store.saveSnapshotAsync(snapPath);

      const metaRaw = JSON.parse(fs.readFileSync(`${snapPath}.meta.json`, 'utf8'));
      expect(metaRaw).toMatchObject({
        version: 2,
        dimension: 384,
        embeddingSpaceId: 'deterministic:eidos-384:v1',
        embeddingModel: 'eidos-deterministic-384-v1',
        embeddingMode: 'deterministic',
        itemCount: 1,
      });

      // Attempt to load snapshot into a store configured for multilingual ONNX
      const onnxStore = new VectorStore({
        snapshotPath: snapPath,
        embeddingSpaceId: 'onnx:paraphrase-multilingual-MiniLM-L12-v2:384:v1',
      });

      await expect(onnxStore.loadSnapshotFromDisk(snapPath)).rejects.toThrow(
        EmbeddingSpaceMismatchError
      );
      expect(onnxStore.getSnapshotMismatchError()).toContain(
        'Snapshot embeddingSpaceId "deterministic:eidos-384:v1" does not match active embedder space "onnx:paraphrase-multilingual-MiniLM-L12-v2:384:v1"'
      );

      // Reindexing clears the mismatch error
      await onnxStore.reindexAll(embedder);
      expect(onnxStore.getSnapshotMismatchError()).toBeNull();

      // Verify /v1/health reports 503 degraded when embedder is degraded
      const app = await buildServer();
      try {
        await app.ready();
        embedder.setDegradedForTest('ONNX model weights failed to download; fallback active');

        const healthRes = await app.inject({ method: 'GET', url: '/v1/health' });
        expect(healthRes.statusCode).toBe(503);
        const healthBody = healthRes.json();
        expect(healthBody.status).toBe('degraded');
        expect(healthBody.checks.embeddingModel.status).toBe('degraded');
        expect(healthBody.checks.embeddingModel.degradedReason).toContain(
          'ONNX model weights failed to download'
        );
      } finally {
        embedder.setDegradedForTest(null);
        await app.close();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
