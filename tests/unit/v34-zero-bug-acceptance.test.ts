import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildServer } from '../../apps/api/src/server';
import { FastifyInstance } from 'fastify';
import {
  extractHeadCategoryIntent,
  evaluateCandidateCategoryGate,
  evaluateCandidateGuardrail,
  normalizeQueryWithLayoutRecovery,
} from '@eidos/core';
import {
  computeTextEmbedding,
  executeHybridCatalogSearch,
  generateSyntheticScaledCatalog,
} from '../../apps/workspace/src/utils/recommenderEngine';
import { FULL_DEMO_CATALOG } from '../../apps/workspace/src/data/domainDatabases';

describe('EIDOS v3.4.0 Zero-Bug Acceptance Suite (Server + Client + 1C-Bitrix)', () => {
  let app: FastifyInstance;
  const adminKey = 'eidos_dev_key';

  beforeAll(async () => {
    process.env.EIDOS_API_KEY = adminKey;
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Head-category intent parser prioritizes head noun ("наушники") over modifier ("для бега")', () => {
    const intent = extractHeadCategoryIntent('недорогие наушники для бега');
    expect(intent.hasHeadCategoryIntent).toBe(true);
    expect(intent.familyKey).toBe('headphones');
    expect(intent.modifierTokens).toContain('бега');

    const headphoneGate = evaluateCandidateCategoryGate(
      intent,
      {
        id: 'hp-1',
        title: 'Беспроводные спортивные наушники TWS Run Pro',
        description: 'Лёгкие наушники с защитой от пота для бега и тренировок',
        category: 'Наушники',
        tags: ['наушники', 'спорт', 'бег'],
      },
      'hard'
    );
    expect(headphoneGate.matchesHeadCategory).toBe(true);
    expect(headphoneGate.conflictsWithHeadCategory).toBe(false);
    expect(headphoneGate.passesHardGate).toBe(true);

    const sneakerGate = evaluateCandidateCategoryGate(
      intent,
      {
        id: 'sn-1',
        title: 'Кроссовки для бега Ultra Carbon Marathon',
        description: 'Беговые кроссовки с карбоновой пластиной для марафона',
        category: 'Кроссовки',
        tags: ['кроссовки', 'бег', 'спорт'],
      },
      'hard'
    );
    expect(sneakerGate.matchesHeadCategory).toBe(false);
    expect(sneakerGate.conflictsWithHeadCategory).toBe(true);
    expect(sneakerGate.passesHardGate).toBe(false);
  });

  it('2. 520-SKU catalog on server /v1/search: "недорогие наушники для бега" -> top-3 category = Наушники (never Кроссовки)', async () => {
    const items: Array<{
      id: string;
      title: string;
      description: string;
      category: string;
      price: number;
      tags: string[];
    }> = [];

    // 200 Running Sneakers ("Кроссовки") with "для бега" in title/description
    for (let i = 1; i <= 200; i++) {
      items.push({
        id: `sneaker_${i}`,
        title: `Кроссовки для бега AeroRun Carbon #${i}`,
        description: `Недорогие беговые кроссовки для бега, марафона и фитнеса, модель ${i}`,
        category: 'Кроссовки',
        price: 4500 + (i % 40) * 100,
        tags: ['кроссовки', 'бег', 'спорт', 'недорогие'],
      });
    }

    // 200 Laptops & Books
    for (let i = 1; i <= 200; i++) {
      items.push({
        id: `other_${i}`,
        title: i % 2 === 0 ? `Ультрабук ProBook Dev #${i}` : `Книга Алгоритмы и структуры данных #${i}`,
        description: `Производительное решение для работы и обучения #${i}`,
        category: i % 2 === 0 ? 'Ноутбуки' : 'Книги',
        price: 3500 + i * 50,
        tags: i % 2 === 0 ? ['ноутбуки', 'работа'] : ['книги', 'обучение'],
      });
    }

    // 120 Headphones ("Наушники"), including budget running headphones and studio headphones
    for (let i = 1; i <= 120; i++) {
      const isRunningBudget = i <= 40;
      items.push({
        id: `headphone_${i}`,
        title: isRunningBudget
          ? `Недорогие беспроводные наушники для бега SportPulse TWS #${i}`
          : `Беспроводные наушники Studio ANC Pro #${i}`,
        description: isRunningBudget
          ? `Лёгкие спортивные наушники с влагозащитой IPX7 для бега и тренировок, доступная цена`
          : `Полноразмерные наушники с активным шумоподавлением и чистым звуком`,
        category: 'Наушники',
        price: isRunningBudget ? 3490 + (i % 10) * 200 : 19990 + i * 100,
        tags: isRunningBudget
          ? ['наушники', 'бег', 'спорт', 'недорогие', 'bluetooth']
          : ['наушники', 'аудио', 'anc'],
      });
    }

    expect(items.length).toBe(520);

    // Clear default store before inserting 520-SKU catalog
    await app.inject({
      method: 'DELETE',
      url: '/v1/catalog/clear',
      headers: { 'x-api-key': adminKey },
    });

    // Batch upsert in 2 chunks of 260 items
    for (let offset = 0; offset < items.length; offset += 260) {
      const chunk = items.slice(offset, offset + 260);
      const upsertRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': adminKey },
        payload: { items: chunk },
      });
      expect(upsertRes.statusCode).toBe(200);
      expect(upsertRes.json().upserted).toBe(chunk.length);
    }

    const searchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': adminKey },
      payload: {
        query: 'недорогие наушники для бега',
        limit: 10,
        alpha: 0.65,
      },
    });

    expect(searchRes.statusCode).toBe(200);
    const body = searchRes.json();
    expect(body.count).toBeGreaterThanOrEqual(3);
    expect(body.headCategoryIntent).toBe('headphones');

    const top3Categories = body.results.slice(0, 3).map((r: any) => r.category);
    expect(top3Categories).toEqual(['Наушники', 'Наушники', 'Наушники']);

    // Verify every result has calibrated scorePercent (0..100) and humanExplanation
    for (const hit of body.results) {
      expect(hit.category).toBe('Наушники');
      expect(typeof hit.scorePercent).toBe('number');
      expect(hit.scorePercent).toBeGreaterThanOrEqual(50);
      expect(hit.scorePercent).toBeLessThanOrEqual(100);
      expect(hit.humanExplanation?.ru).toBeTruthy();
      expect(hit.humanExplanation?.en).toBeTruthy();
    }
  });

  it('3. Client 1,000+ SKU scaled catalog: "недорогие наушники для бега" -> top-3 category = Наушники', () => {
    const { catalog, embeddings } = generateSyntheticScaledCatalog(1000, FULL_DEMO_CATALOG);
    expect(catalog.length).toBe(1000);

    const qVec = computeTextEmbedding('query: недорогие наушники для бега');
    const hits = executeHybridCatalogSearch(
      'недорогие наушники для бега',
      qVec,
      catalog,
      embeddings,
      0.65,
      10
    );

    expect(hits.length).toBeGreaterThanOrEqual(3);
    const top3Categories = hits.slice(0, 3).map((h) => h.item.category);
    expect(top3Categories).toEqual(['Наушники', 'Наушники', 'Наушники']);
    expect(hits[0].scorePercent).toBeGreaterThanOrEqual(65);
  });

  it('4. Gibberish query "xyzabcqqq999" -> count: 0, results: [] on server /v1/search and client search', async () => {
    for (const mode of ['hybrid', 'dense', 'sparse'] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': adminKey },
        payload: {
          query: 'xyzabcqqq999',
          mode,
          limit: 5,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.count).toBe(0);
      expect(body.results).toEqual([]);
    }

    // Also verify on client executeHybridCatalogSearch
    const { catalog, embeddings } = generateSyntheticScaledCatalog(100, FULL_DEMO_CATALOG);
    const qVec = computeTextEmbedding('query: xyzabcqqq999');
    const clientHits = executeHybridCatalogSearch('xyzabcqqq999', qVec, catalog, embeddings, 0.7, 5);
    expect(clientHits).toEqual([]);
  });

  it('5. 20-doc fixture: alpha=0 (lexical) vs alpha=1 (semantic) and weights change top-1 ID and echo applied weights', async () => {
    await app.inject({
      method: 'DELETE',
      url: '/v1/catalog/clear',
      headers: { 'x-api-key': adminKey },
    });

    const fixture20 = [
      {
        id: 'lex_exact_1',
        title: 'Квантовый синхронизатор импульсов QX-900',
        description: 'Узкоспециализированный синхронизатор сигнала для калибровки синхронизатора',
        category: 'Оборудование',
        price: 12000,
        tags: ['синхронизатор', 'qx-900'],
      },
      {
        id: 'sem_rich_1',
        title: 'Станция глубокого космоса, Вселенной и галактик Интерстеллар',
        description: 'Исследование горизонта событий, космоса, галактик, Вселенной и Дюны в межзвёздном пространстве',
        category: 'Наука',
        price: 15000,
        tags: ['космос', 'вселенная', 'галактика', 'интерстеллар', 'дюна'],
      },
    ];

    for (let i = 3; i <= 20; i++) {
      fixture20.push({
        id: `doc_${i}`,
        title: `Офисный аксессуар для рабочего стола #${i}`,
        description: `Базовый предмет интерьера для хранения документов и канцелярии #${i}`,
        category: 'Офис',
        price: 900 + i * 100,
        tags: ['офис', 'стол'],
      });
    }

    const upsertRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': adminKey },
      payload: { items: fixture20 },
    });
    expect(upsertRes.statusCode).toBe(200);
    expect(upsertRes.json().upserted).toBe(20);

    // Query contains the exact rare keyword "синхронизатор" (matching lex_exact_1 via BM25)
    // plus English space/cosmos concepts (matching Russian sem_rich_1 via 384-d concept manifold)
    const testQuery = 'синхронизатор interstellar cosmos blackhole relativity';

    const resLexical = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': adminKey },
      payload: {
        query: testQuery,
        alpha: 0,
        simpleCategoryGate: 'off',
        limit: 5,
      },
    });
    expect(resLexical.statusCode).toBe(200);
    const bodyLex = resLexical.json();
    expect(bodyLex.alpha).toBe(0);
    expect(bodyLex.weights.semantic).toBe(0);
    expect(bodyLex.weights.lexical).toBe(1);

    const resSemantic = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': adminKey },
      payload: {
        query: testQuery,
        alpha: 1,
        simpleCategoryGate: 'off',
        limit: 5,
      },
    });
    expect(resSemantic.statusCode).toBe(200);
    const bodySem = resSemantic.json();
    expect(bodySem.alpha).toBe(1);
    expect(bodySem.weights.semantic).toBe(1);
    expect(bodySem.weights.lexical).toBe(0);

    expect(bodyLex.results[0].id).toBe('lex_exact_1');
    expect(bodySem.results[0].id).toBe('sem_rich_1');
    expect(bodyLex.results[0].id).not.toBe(bodySem.results[0].id);

    // Also verify weights object overrides alpha
    const resWeights = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': adminKey },
      payload: {
        query: testQuery,
        weights: { semantic: 0.95, lexical: 0.05 },
        simpleCategoryGate: 'off',
        limit: 5,
      },
    });
    expect(resWeights.statusCode).toBe(200);
    expect(resWeights.json().alpha).toBeCloseTo(0.95, 2);
    expect(resWeights.json().results[0].id).toBe('sem_rich_1');
  });

  it('6. Upsert without key -> 401 and invalid batch items return row-level rowErrors', async () => {
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      payload: { items: [{ id: '1', title: 'Test' }] },
    });
    expect([401, 403]).toContain(unauthRes.statusCode);

    const invalidBatchRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': adminKey },
      payload: {
        items: [
          { id: '', title: '' },
          { id: 'bad_price', title: 'Valid Title', price: -500 },
        ],
      },
    });
    expect(invalidBatchRes.statusCode).toBe(400);
    const errBody = invalidBatchRes.json();
    expect(Array.isArray(errBody.rowErrors)).toBe(true);
    expect(errBody.rowErrors.length).toBeGreaterThanOrEqual(2);
    expect(errBody.rowErrors[0]).toHaveProperty('row', 1);
    expect(errBody.rowErrors[0]).toHaveProperty('field');
    expect(errBody.rowErrors[0]).toHaveProperty('message');
  });

  it('7. 1C-Bitrix Connector contract: ELEMENT_ID -> id, XML_ID -> sku, ext-mbstring fallback, SEARCH_KEY vs ADMIN_KEY, and stale ID skip', async () => {
    await app.inject({
      method: 'DELETE',
      url: '/v1/catalog/clear',
      headers: { 'x-api-key': adminKey },
    });

    const mapperPhp = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/connectors/bitrix/src/Mapper.php'),
      'utf8'
    );
    const httpClientPhp = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/connectors/bitrix/src/HttpClient.php'),
      'utf8'
    );
    const searchReplacerPhp = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/connectors/bitrix/src/SearchReplacer.php'),
      'utf8'
    );
    const bitrixReadme = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/connectors/bitrix/README.md'),
      'utf8'
    );

    // 1. Safe UTF-8 fallback when ext-mbstring is missing
    expect(mapperPhp).toContain("function_exists('mb_substr')");
    expect(mapperPhp).toContain("function_exists('mb_strlen')");
    expect(mapperPhp).toContain("preg_match_all('/./us'");

    // 2. ID = ELEMENT_ID (string) and XML_ID mapped strictly to sku
    expect(mapperPhp).toContain("$item['ID'] ?? $item['ELEMENT_ID']");
    expect(mapperPhp).toContain("$item['XML_ID']");
    expect(mapperPhp.includes('__eidos_sku:') || mapperPhp.includes('sku') || mapperPhp.includes('SKU')).toBe(true);
    expect(mapperPhp).toContain("$payload['sku'] = (string) $mapped['sku']");

    // 3. Separate SEARCH_KEY vs ADMIN_KEY routing
    expect(httpClientPhp).toContain('getEffectiveKeyForPath');
    expect(httpClientPhp).toContain('setSearchKey');

    // 4. Stale Bitrix ID skipping (deleted items don't cause 500)
    expect(searchReplacerPhp).toContain('markItemDeletedInBitrix');
    expect(searchReplacerPhp).toContain('deletedBitrixIds');
    expect(searchReplacerPhp).toContain('activeBitrixIds');

    // 5. README documents PHP >= 8.1, ext-mbstring, ext-curl, SEARCH_KEY, ADMIN_KEY
    expect(bitrixReadme).toContain('ext-mbstring');
    expect(bitrixReadme).toContain('ext-curl');
    expect(bitrixReadme).toContain('SEARCH_KEY');
    expect(bitrixReadme).toContain('ADMIN_KEY');
    expect(bitrixReadme).toContain('ELEMENT_ID');
    expect(bitrixReadme).toContain('XML_ID');

    // 6. Simulate Bitrix Connector sync -> search -> URL hydration against live Fastify /v1/catalog/upsert & /v1/search
    const bitrixUpsertPayload = {
      items: [
        {
          id: '4815', // Bitrix ELEMENT_ID
          sku: '1c-guid-998877', // Bitrix XML_ID
          title: 'Беспроводные наушники Sony WH-1000XM5 Black',
          description: 'Флагманские наушники с активным шумоподавлением',
          category: 'Наушники',
          price: 29990,
          inStock: true,
          url: '/catalog/audio/4815/',
          tags: [
            'наушники',
            'sony',
            '__eidos_instock:1',
            '__eidos_url:/catalog/audio/4815/',
            '__eidos_sku:1c-guid-998877',
          ],
        },
      ],
    };

    const syncRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': adminKey },
      payload: bitrixUpsertPayload,
    });
    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().upserted).toBe(1);

    const searchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': adminKey },
      payload: {
        query: 'наушники sony с шумоподавлением',
        limit: 5,
      },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchData = searchRes.json();
    expect(searchData.count).toBe(1);
    expect(searchData.results[0].id).toBe('4815');
    expect(searchData.results[0].url).toBe('/catalog/audio/4815/');
    expect(searchData.results[0].scorePercent).toBeGreaterThanOrEqual(70);
  });
});
