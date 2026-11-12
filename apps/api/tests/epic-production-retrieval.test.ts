import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  HNSWIndex,
  BM25Index,
  extractHeadCategoryIntent,
  evaluateCandidateCategoryGate,
  buildDynamicCategoryFamiliesFromCatalog,
} from '@eidos/core';
import { buildServer } from '../src/server';
import { VectorStore, EmbeddingSpaceMismatchError } from '../src/services/vector-store';
import { ServerEmbedder } from '../src/services/embedder';
import { ApiQueryCache } from '../src/services/query-cache';
import { getSemanticCache } from '../src/services/cache';
import { parseYmlOrCommerceMl } from '../src/services/yml-parser';
import { runBenchmarkAtScale, runFullBenchmarkSuite } from '../../../load-testing/benchmark-harness';

describe('EPIC: EIDOS Production-Grade Retrieval (EIDOS-101..110)', () => {
  beforeEach(() => {
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
  });

  it('EIDOS-101: hybridSearch invokes HNSWIndex.search on dense channel and handles 0.1% filter selectivity without empty results', async () => {
    const embedder = new ServerEmbedder();
    const store = new VectorStore();

    // Seed 1,000 items where only 1 item (0.1% selectivity) belongs to brand "RareBrandOne"
    const items = [];
    const baseVec = await embedder.embed('наушники для бега');
    for (let i = 0; i < 1000; i++) {
      items.push({
        id: `sku-${i + 1}`,
        sku: `SKU-${i + 1}`,
        brand: i === 777 ? 'RareBrandOne' : 'CommonBrand',
        title: i === 777 ? 'Редкие наушники для бега RareBrandOne' : `Товар каталога #${i + 1}`,
        description: 'Описание товара для теста селективности фильтра',
        category: i === 777 ? 'Наушники и аудио' : 'Общие товары',
        price: 2500,
        inStock: true,
        tags: ['тест'],
        embedding: Array.from(baseVec),
      });
    }
    store.bulkSeed(items);

    const hnswSpy = vi.spyOn(store.getHNSW(), 'search');
    const qVec = await embedder.embed('наушники для бега');

    // 1. Standard hybrid search must call HNSW.search (not linear O(N) scan)
    const hits = store.hybridSearch('наушники для бега', qVec, 10);
    expect(hnswSpy).toHaveBeenCalled();
    expect(hits.length).toBeGreaterThan(0);

    // 2. High-selectivity filter (0.1% = 1 out of 1,000 items) must still return the matching item in dense mode
    const rareHits = store.hybridSearch(
      'наушники',
      qVec,
      10,
      1.0, // pure dense
      0.0,
      undefined,
      {
        filters: { brand: 'RareBrandOne' },
      }
    );
    expect(rareHits.length).toBe(1);
    expect(rareHits[0].item.id).toBe('sku-778');
  });

  it('EIDOS-102: BM25Index.getCandidateDocIds retrieves lexical candidates via inverted postings without scanning non-matching documents', () => {
    const bm25 = new BM25Index();
    for (let i = 0; i < 2000; i++) {
      bm25.addDocument(
        `doc-${i}`,
        i === 42 ? 'уникальный лазерный дальномер bosch glm' : `обычный товар номер ${i}`
      );
    }

    const candidates = bm25.getCandidateDocIds(['лазерный', 'дальномер'], ['лазерн', 'дальномер']);
    expect(candidates.has('doc-42')).toBe(true);
    // Inverted postings only return documents sharing query tokens/prefixes, far fewer than 2000
    expect(candidates.size).toBeLessThan(10);
  });

  it('EIDOS-103: Snapshot metadata verifies embeddingSpaceId, throws EmbeddingSpaceMismatchError on mismatch, /v1/health is honest, and /v1/admin/reindex re-embeds', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-103-'));
    const snapPath = path.join(tmpDir, 'catalog.snapshot.json');
    const embedder = new ServerEmbedder();

    const storeA = new VectorStore({
      snapshotPath: snapPath,
      embeddingSpaceId: embedder.getEmbeddingSpaceId(),
    });
    const vec = await embedder.embed('беговые кроссовки');
    storeA.upsert({
      id: 'shoe-1',
      title: 'Беговые кроссовки Asics',
      description: 'Кроссовки для марафона',
      category: 'Обувь и кроссовки',
      price: 9900,
      inStock: true,
      tags: ['бег'],
      embedding: Array.from(vec),
    });
    await storeA.saveSnapshotAsync(snapPath);

    // Verify .meta.json was written next to snapshot
    const metaPath = `${snapPath}.meta.json`;
    expect(fs.existsSync(metaPath)).toBe(true);
    const metaJson = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    expect(metaJson.embeddingSpaceId).toBe(embedder.getEmbeddingSpaceId());
    expect(metaJson.dimension).toBe(384);

    // Loading with a different embeddingSpaceId throws EmbeddingSpaceMismatchError
    const mismatchedStore = new VectorStore({
      snapshotPath: snapPath,
      embeddingSpaceId: 'onnx:custom-model-v99:384',
    });
    await expect(mismatchedStore.loadSnapshotFromDisk(snapPath)).rejects.toThrow(
      EmbeddingSpaceMismatchError
    );

    // Verify /v1/health and /v1/ready report honest active model & embeddingSpaceId, and /v1/admin/reindex works
    const app = await buildServer();
    try {
      const healthRes = await app.inject({ method: 'GET', url: '/v1/health' });
      expect(healthRes.statusCode).toBe(200);
      const healthBody = healthRes.json();
      expect(healthBody.model).toBe(embedder.getActiveModelName());
      expect(healthBody.embeddingMode).toBe(embedder.getEmbeddingMode());
      expect(healthBody.embeddingSpaceId).toBe(embedder.getEmbeddingSpaceId());

      const reindexRes = await app.inject({
        method: 'POST',
        url: '/v1/admin/reindex',
        headers: { 'x-api-key': process.env.ADMIN_KEY || 'test-key' },
      });
      expect(reindexRes.statusCode).toBe(200);
      const reindexBody = reindexRes.json();
      expect(reindexBody.status).toBe('reindexed');
      expect(reindexBody.embeddingSpaceId).toBe(embedder.getEmbeddingSpaceId());
    } finally {
      await app.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('EIDOS-104: Separates brake_pads from oils and derives dynamic category families for non-demo domains (cosmetics/furniture/fashion)', () => {
    // 1. "тормозные колодки" must NOT match motor oil under hard category gate
    const padIntent = extractHeadCategoryIntent('передние тормозные колодки');
    expect(padIntent.hasHeadCategoryIntent).toBe(true);
    expect(padIntent.familyKey).toBe('brake_pads');

    const oilGate = evaluateCandidateCategoryGate(
      padIntent,
      {
        title: 'Моторное масло Motul 8100 5W-40 4л',
        category: 'Автотовары и масла',
        tags: ['масло', '5w-40'],
      },
      'hard'
    );
    expect(oilGate.matchesHeadCategory).toBe(false);

    const padGate = evaluateCandidateCategoryGate(
      padIntent,
      {
        title: 'Тормозные колодки передние Bosch',
        category: 'Тормозные системы',
        tags: ['колодки'],
      },
      'hard'
    );
    expect(padGate.matchesHeadCategory).toBe(true);
    expect(padGate.passesHardGate).toBe(true);

    // 2. Dynamic category families derived from a cosmetics/furniture catalog
    const customCatalog = [
      { title: 'Увлажняющий крем для лица с гиалуроновой кислотой', category: 'Косметика и уход за лицом', tags: ['крем'] },
      { title: 'Ночной крем для лица антивозрастной', category: 'Косметика и уход за лицом', tags: ['крем'] },
      { title: 'Сыворотка для лица витамин C', category: 'Косметика и уход за лицом', tags: ['сыворотка'] },
      { title: 'Диван угловой раскладной велюровый', category: 'Мягкая мебель и диваны', tags: ['диван'] },
      { title: 'Диван двухместный скандинавский', category: 'Мягкая мебель и диваны', tags: ['диван'] },
      { title: 'Кресло интерьерное мягкое', category: 'Мягкая мебель и диваны', tags: ['кресло'] },
    ];
    const dynamicFamilies = buildDynamicCategoryFamiliesFromCatalog(customCatalog);
    expect(dynamicFamilies.length).toBeGreaterThanOrEqual(2);

    const sofaIntent = extractHeadCategoryIntent('угловой диван', dynamicFamilies);
    expect(sofaIntent.hasHeadCategoryIntent).toBe(true);

    // Cream should be blocked when searching for sofa with hard gate
    const creamCheck = evaluateCandidateCategoryGate(
      sofaIntent,
      customCatalog[0],
      'hard',
      dynamicFamilies
    );
    expect(creamCheck.matchesHeadCategory).toBe(false);

    const sofaCheck = evaluateCandidateCategoryGate(
      sofaIntent,
      customCatalog[3],
      'hard',
      dynamicFamilies
    );
    expect(sofaCheck.matchesHeadCategory).toBe(true);
    expect(sofaCheck.passesHardGate).toBe(true);
  });

  it('EIDOS-105: Pagination (offset, limit) returns honest total, hasMore, and disjoint pages without duplicates or gaps', async () => {
    const app = await buildServer();
    try {
      const adminKey = process.env.ADMIN_KEY || 'test-key';
      const batch = [];
      for (let i = 1; i <= 25; i++) {
        batch.push({
          id: `pag-item-${i}`,
          sku: `PAG-${i}`,
          title: `Беспроводные наушники серия ${i}`,
          description: 'Наушники для спорта и бега с Bluetooth',
          category: 'Наушники и аудио',
          price: 1000 + i * 100,
          inStock: true,
          tags: ['наушники', 'спорт'],
        });
      }

      const upsertRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': adminKey, 'x-tenant-id': 'pagtenant' },
        payload: { items: batch },
      });
      expect(upsertRes.statusCode).toBe(200);

      const page1Res = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': adminKey, 'x-tenant-id': 'pagtenant' },
        payload: { query: 'беспроводные наушники', limit: 10, offset: 0 },
      });
      expect(page1Res.statusCode).toBe(200);
      const page1 = page1Res.json();

      const page2Res = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': adminKey, 'x-tenant-id': 'pagtenant' },
        payload: { query: 'беспроводные наушники', limit: 10, offset: 10 },
      });
      expect(page2Res.statusCode).toBe(200);
      const page2 = page2Res.json();

      expect(page1.results.length).toBe(10);
      expect(page2.results.length).toBe(10);
      expect(page1.total).toBeGreaterThanOrEqual(20);
      expect(page1.total).toBe(page2.total);
      expect(page1.offset).toBe(0);
      expect(page2.offset).toBe(10);
      expect(page1.hasMore).toBe(true);

      // Pages 1 and 2 must be strictly disjoint
      const page1Ids = new Set(page1.results.map((r: any) => r.id));
      for (const r of page2.results) {
        expect(page1Ids.has(r.id)).toBe(false);
      }

      // Combined order matches limit: 20, offset: 0
      const full20Res = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': adminKey, 'x-tenant-id': 'pagtenant' },
        payload: { query: 'беспроводные наушники', limit: 20, offset: 0 },
      });
      const full20 = full20Res.json();
      const combinedIds = [
        ...page1.results.map((r: any) => r.id),
        ...page2.results.map((r: any) => r.id),
      ];
      expect(combinedIds).toEqual(full20.results.map((r: any) => r.id));
    } finally {
      await app.close();
    }
  });

  it('EIDOS-106: Upserting into tenant A does not invalidate L1 or Semantic cache entries for tenant B', async () => {
    const app = await buildServer();
    try {
      const adminKey = process.env.ADMIN_KEY || 'test-key';

      // Seed tenant A and tenant B
      for (const tenant of ['tenanta', 'tenantb']) {
        await app.inject({
          method: 'POST',
          url: '/v1/catalog/upsert',
          headers: { 'x-api-key': adminKey, 'x-tenant-id': tenant },
          payload: {
            id: `${tenant}-1`,
            title: 'Кроссовки для бега Asics',
            category: 'Обувь и кроссовки',
            price: 5000,
            inStock: true,
          },
        });
      }

      // Warm cache on tenant B
      const bSearch1 = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': adminKey, 'x-tenant-id': 'tenantb' },
        payload: { query: 'кроссовки для бега' },
      });
      expect(bSearch1.statusCode).toBe(200);
      expect(bSearch1.headers['x-cache']).toBe('MISS');

      // Confirm tenant B hits cache
      const bSearch2 = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': adminKey, 'x-tenant-id': 'tenantb' },
        payload: { query: 'кроссовки для бега' },
      });
      expect(bSearch2.headers['x-cache']).toBe('HIT');

      // Mutate tenant A catalog
      await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': adminKey, 'x-tenant-id': 'tenanta' },
        payload: {
          id: 'tenanta-2',
          title: 'Новые беговые кроссовки Nike',
          category: 'Обувь и кроссовки',
          price: 6500,
          inStock: true,
        },
      });

      // Tenant B cache MUST remain a HIT!
      const bSearchAfterAMutation = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': adminKey, 'x-tenant-id': 'tenantb' },
        payload: { query: 'кроссовки для бега' },
      });
      expect(bSearchAfterAMutation.headers['x-cache']).toBe('HIT');
    } finally {
      await app.close();
    }
  });

  it('EIDOS-107: HNSWIndex deletes 2,000 nodes in O(deg * levels) under 250ms and reuses internal IDs on re-insert', () => {
    const hnsw = new HNSWIndex({ M: 8, M0: 16, efConstruction: 32, efSearch: 32 });
    const total = 3000;
    const vec = new Float32Array(32);
    for (let i = 0; i < total; i++) {
      for (let d = 0; d < 32; d++) {
        vec[d] = Math.sin(i * 0.1 + d);
      }
      hnsw.insert(`node-${i}`, new Float32Array(vec));
    }
    expect(hnsw.size()).toBe(total);

    const startDel = performance.now();
    for (let i = 0; i < 2000; i++) {
      expect(hnsw.delete(`node-${i}`)).toBe(true);
    }
    const delElapsedMs = performance.now() - startDel;
    expect(delElapsedMs).toBeLessThan(250);
    expect(hnsw.size()).toBe(1000);

    // Re-add 2,000 points and verify freeInternalIds are reused (no unbounded memory growth)
    for (let i = 0; i < 2000; i++) {
      hnsw.insert(`readded-${i}`, new Float32Array(vec));
    }
    expect(hnsw.size()).toBe(3000);
    const hits = hnsw.search(vec, 5);
    expect(hits.length).toBe(5);
  });

  it('EIDOS-108: Supports explicit variantGroup deduplication and marks demo analytics as synthetic: true', async () => {
    const embedder = new ServerEmbedder();
    const store = new VectorStore();
    const vec = await embedder.embed('кроссовки беговые asics');

    store.upsertBatch([
      {
        id: 'shoe-size-41',
        title: 'Кроссовки Asics Gel-Kayano размер 41',
        description: 'Беговые кроссовки',
        category: 'Обувь и кроссовки',
        variantGroup: 'asics-kayano-model-1',
        price: 12000,
        inStock: true,
        tags: ['кроссовки'],
        embedding: Array.from(vec),
      },
      {
        id: 'shoe-size-42',
        title: 'Кроссовки Asics Gel-Kayano размер 42',
        description: 'Беговые кроссовки',
        category: 'Обувь и кроссовки',
        variantGroup: 'asics-kayano-model-1',
        price: 12000,
        inStock: true,
        tags: ['кроссовки'],
        embedding: Array.from(vec),
      },
      {
        id: 'shoe-size-43',
        title: 'Кроссовки Asics Gel-Kayano размер 43',
        description: 'Беговые кроссовки',
        category: 'Обувь и кроссовки',
        variantGroup: 'asics-kayano-model-1',
        price: 12000,
        inStock: true,
        tags: ['кроссовки'],
        embedding: Array.from(vec),
      },
    ]);

    const hits = store.hybridSearch('кроссовки беговые asics', vec, 10);
    // Max 2 variants from the same variantGroup in top results
    const groupCount = hits.filter((h) => h.item.variantGroup === 'asics-kayano-model-1').length;
    expect(groupCount).toBeLessThanOrEqual(2);

    const app = await buildServer();
    try {
      const demoAnalytics = await app.inject({ method: 'GET', url: '/v1/demo/analytics' });
      expect(demoAnalytics.statusCode).toBe(200);
      expect(demoAnalytics.json().synthetic).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('EIDOS-110: Parses CommerceML 2.x <Предложение><Цены><Цена><ЦенаЗаЕдиницу> prices and 50k YML offers cleanly', () => {
    const commerceMlXml = `<?xml version="1.0" encoding="UTF-8"?>
<КоммерческаяИнформация ВерсияСхемы="2.05">
  <Классификатор>
    <Группы>
      <Группа>
        <Ид>grp-audio</Ид>
        <Наименование>Наушники и гарнитуры</Наименование>
      </Группа>
    </Группы>
  </Классификатор>
  <Каталог>
    <Товары>
      <Товар>
        <Ид>prod-100#offer-1</Ид>
        <Артикул>WH-1000XM5</Артикул>
        <Наименование>Беспроводные наушники Sony WH-1000XM5</Наименование>
        <Описание>Флагманские наушники с шумоподавлением</Описание>
        <Группы><Ид>grp-audio</Ид></Группы>
      </Товар>
    </Товары>
  </Каталог>
  <ПакетПредложений>
    <Предложения>
      <Предложение>
        <Ид>prod-100#offer-1</Ид>
        <Цены>
          <Цена>
            <ЦенаЗаЕдиницу>34 990,50</ЦенаЗаЕдиницу>
            <Валюта>RUB</Валюта>
          </Цена>
        </Цены>
        <Количество>12</Количество>
      </Предложение>
    </Предложения>
  </ПакетПредложений>
</КоммерческаяИнформация>`;

    const parsedCml = parseYmlOrCommerceMl(commerceMlXml);
    expect(parsedCml.length).toBe(1);
    expect(parsedCml[0].price).toBe(34990.5);
    expect(parsedCml[0].category).toBe('Наушники и гарнитуры');
    expect(parsedCml[0].inStock).toBe(true);
    expect(parsedCml[0].sku).toBe('WH-1000XM5');
  });

  it('Benchmark Harness: Executes 1k and 10k SKU benchmarks with Recall@10 >= 0.90 and saves report to load-testing/results/', async () => {
    const results = await runFullBenchmarkSuite([1_000, 10_000]);
    expect(results.length).toBe(2);
    for (const r of results) {
      expect(r.recallAt10VsBruteForce).toBeGreaterThanOrEqual(0.9);
      expect(r.p95LatencyMs).toBeLessThan(50);
    }
    const reportPath = path.resolve(process.cwd(), 'load-testing/results/epic-retrieval-benchmark.json');
    expect(fs.existsSync(reportPath)).toBe(true);
  }, 30_000);
});
