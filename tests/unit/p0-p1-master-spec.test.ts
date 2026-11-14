import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { layoutConvert } from '@eidos/core';
import { buildServer } from '../../apps/api/src/server';
import { DEMO_CATALOG_1000 } from '../../apps/api/src/demo/demo-catalog-1000';
import { ServerEmbedder } from '../../apps/api/src/services/embedder';

const ADMIN_KEY = 'eidos_admin_master_spec_key_2026_secure';
const SEARCH_KEY = 'eidos_search_public_spec_key_2026_pub';

const GOLDEN_20_QUERIES = [
  'беспроводные наушники с шумоподавлением',
  'кроссовки для бега мужские',
  'моторное масло 5w-40 синтетика',
  'смартфон 256 гб oled',
  'ноутбук для работы 16 гб',
  'робот пылесос с лидаром',
  'кофемашина автоматическая с капучинатором',
  'аккумуляторный шуруповерт 18в',
  'перфоратор sds-plus',
  'детская коляска прогулочная складная',
  'тормозные колодки передние керамические',
  'телевизор 55 дюймов 4k qled',
  'умные часы с gps для бега',
  'механическая клавиатура с подсветкой',
  'рюкзак городской для ноутбука',
  'видеорегистратор автомобильный 4k',
  'блендер погружной металлический',
  'куртка зимняя мембранная',
  'крем для лица увлажняющий с гиалуроновой кислотой',
  'конструктор детский развивающий',
];

describe('EIDOS Master Spec (P0 + P1) Automated Acceptance Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.EIDOS_ADMIN_KEY = ADMIN_KEY;
    process.env.EIDOS_MASTER_KEY = ADMIN_KEY;
    process.env.EIDOS_SEARCH_KEY = SEARCH_KEY;
    process.env.EIDOS_PUBLIC_DEMO_KEY = 'eidos_public_demo_key_2026';
    process.env.LOG_SUGGEST_RATE = '1.0';
    app = await buildServer();
    await app.ready();

    // Seed the 1,048 SKU catalog into demo and default stores via public HTTP API
    const loadRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
      payload: {},
    });
    expect(loadRes.statusCode).toBe(200);
    for (let i = 0; i < DEMO_CATALOG_1000.length; i += 500) {
      const batch = DEMO_CATALOG_1000.slice(i, i + 500);
      const upRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': ADMIN_KEY },
        payload: { items: batch },
      });
      expect(upRes.statusCode).toBe(200);
    }
  }, 60_000);

  afterAll(async () => {
    delete process.env.EIDOS_ADMIN_KEY;
    delete process.env.EIDOS_MASTER_KEY;
    delete process.env.EIDOS_SEARCH_KEY;
    delete process.env.EIDOS_PUBLIC_DEMO_KEY;
    delete process.env.LOG_SUGGEST_RATE;
    if (app) {
      await app.close();
    }
  });

  it('1. ready.pilot: GET /v1/ready returns ready=true, itemsIndexed>=1000, hnswIndexed, redis, version', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/ready',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ready).toBe(true);
    expect(body.itemsIndexed).toBeGreaterThanOrEqual(1000);
    expect(body.hnswIndexed).toBeGreaterThanOrEqual(1000);
    expect(typeof body.redis).toBe('string');
    expect(body.version).toBeDefined();
  });

  it('2. suggest.same_path: POST /v1/suggest returns identical top-5 IDs in identical order as POST /v1/search across 20 golden queries', async () => {
    // Also verify < 2 chars returns 200 with results: [] (never 400)
    const shortRes = await app.inject({
      method: 'POST',
      url: '/v1/suggest',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'а', limit: 5 },
    });
    expect(shortRes.statusCode).toBe(200);
    expect(shortRes.json().results).toEqual([]);

    for (const q of GOLDEN_20_QUERIES) {
      const [searchRes, suggestRes] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/v1/search',
          headers: { 'x-api-key': SEARCH_KEY },
          payload: { query: q, limit: 5 },
        }),
        app.inject({
          method: 'POST',
          url: '/v1/suggest',
          headers: { 'x-api-key': SEARCH_KEY },
          payload: { query: q, limit: 5 },
        }),
      ]);

      expect(searchRes.statusCode).toBe(200);
      expect(suggestRes.statusCode).toBe(200);

      const searchIds = searchRes.json().results.map((r: any) => r.id);
      const suggestBody = suggestRes.json();
      const suggestIds = suggestBody.results.map((r: any) => r.id);

      expect(searchIds.length).toBeGreaterThan(0);
      expect(suggestIds).toEqual(searchIds);
      expect(suggestBody.results[0].url).toBeTruthy();
    }
  });

  it('3. normalize.layout & light typo: layoutConvert(yfeiybrb)->наушники and перфоратр->перфоратор with humanExplanation prefix', async () => {
    expect(layoutConvert('yfeiybrb', 'en2ru')).toBe('наушники');
    expect(layoutConvert('rhjccjdrb', 'auto')).toBe('кроссовки');

    const layoutRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'yfeiybrb', limit: 5 },
    });
    expect(layoutRes.statusCode).toBe(200);
    const layoutBody = layoutRes.json();
    expect(layoutBody.normalizedQuery).toBe('наушники');
    expect(layoutBody.rewriteApplied).toBe(true);
    expect(layoutBody.meta.queryRaw).toBe('yfeiybrb');
    expect(layoutBody.meta.normalizedQuery).toBe('наушники');
    expect(layoutBody.meta.rewrites.some((r: any) => r.type === 'layout')).toBe(true);
    expect(layoutBody.results.length).toBeGreaterThan(0);
    expect(layoutBody.results[0].humanExplanation.ru).toContain(
      'Запрос исправлен: yfeiybrb → наушники'
    );

    // Light typo tolerance (edit distance 1 on token >= 4 chars: перфоратр -> перфоратор)
    const typoRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'перфоратр sds', limit: 5 },
    });
    expect(typoRes.statusCode).toBe(200);
    const typoBody = typoRes.json();
    expect(typoBody.results.length).toBeGreaterThan(0);
    expect(typoBody.results[0].title.toLowerCase()).toContain('перфоратор');
  });

  it('4. normalize.zero: garbage queries strictly return 0 results even with normalization & typo tolerance', async () => {
    for (const garbage of ['абракадабра999', 'фывапролджэ99999', 'zxqwertplmnbvc99']) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': SEARCH_KEY },
        payload: { query: garbage, limit: 5 },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().results).toHaveLength(0);
    }
  });

  it('5. gate.regression: "наушники для бега" returns only headphones in top-5 and zero running shoes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'наушники для бега', limit: 5, simpleCategoryGate: 'hard' },
    });
    expect(res.statusCode).toBe(200);
    const results = res.json().results;
    expect(results.length).toBeGreaterThan(0);
    for (const item of results) {
      const text = `${item.title} ${item.category}`.toLowerCase();
      expect(text).not.toContain('кроссовк');
      expect(
        text.includes('наушник') || text.includes('аудио') || text.includes('headphone')
      ).toBe(true);
    }
  });

  it('6. synonym.roundtrip: POST /v1/admin/dictionaries/synonyms + test preview + search rewrite', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/dictionaries/synonyms',
      headers: { 'x-api-key': ADMIN_KEY },
      payload: {
        terms: ['наушники', 'аудиогарнитура-тест', 'вкладыши-тест'],
        enabled: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createdGroup = createRes.json().group;
    expect(createdGroup.id).toBeTruthy();
    expect(createdGroup.terms).toEqual(['наушники', 'аудиогарнитура-тест', 'вкладыши-тест']);

    // Test preview endpoint
    const testRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/dictionaries/synonyms/test',
      headers: { 'x-api-key': ADMIN_KEY },
      payload: { query: 'аудиогарнитура-тест беспроводные' },
    });
    expect(testRes.statusCode).toBe(200);
    const testBody = testRes.json();
    expect(testBody.normalizedQuery).toContain('наушники');
    expect(testBody.previewResults.length).toBeGreaterThan(0);

    // Search with synonym term
    const searchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'вкладыши-тест с шумоподавлением', limit: 5 },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = searchRes.json();
    expect(searchBody.normalizedQuery).toContain('наушники');
    expect(searchBody.meta.rewrites.some((r: any) => r.type === 'synonym')).toBe(true);
    expect(searchBody.results.length).toBeGreaterThan(0);

    // Delete synonym group
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/dictionaries/synonyms/${createdGroup.id}`,
      headers: { 'x-api-key': ADMIN_KEY },
    });
    expect(delRes.statusCode).toBe(200);
  });

  it('7. analytics.summary & export.csv: records queries, clicks, zero-results, and exports UTF-8 BOM CSV', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: {
        type: 'click',
        query: 'наушники для бега',
        productId: 'sku-test-1',
      },
    });

    const summaryRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics/summary?period=7d',
      headers: { 'x-api-key': ADMIN_KEY },
    });
    expect(summaryRes.statusCode).toBe(200);
    const summary = summaryRes.json();
    expect(summary.totalQueries).toBeGreaterThan(0);
    expect(summary.zeroResultCount).toBeGreaterThan(0);
    expect(Array.isArray(summary.topQueries)).toBe(true);
    expect(Array.isArray(summary.topZeroQueries)).toBe(true);
    expect(summary.hasClickEvents).toBe(true);

    const queriesRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics/queries?period=7d&filter=zero&limit=20',
      headers: { 'x-api-key': ADMIN_KEY },
    });
    expect(queriesRes.statusCode).toBe(200);
    expect(queriesRes.json().filter).toBe('zero');
    expect(queriesRes.json().items.length).toBeGreaterThan(0);

    const csvRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics/export.csv?period=7d',
      headers: { 'x-api-key': ADMIN_KEY },
    });
    expect(csvRes.statusCode).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.body.startsWith('\uFEFF')).toBe(true);
    expect(csvRes.body).toContain('query,normalizedQuery,resultCount');
  });

  it('8. auth.public_admin: SEARCH_KEY gets 403 on /v1/admin/* while ADMIN_KEY succeeds', async () => {
    const forbiddenRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics/summary',
      headers: { 'x-api-key': SEARCH_KEY },
    });
    expect([401, 403]).toContain(forbiddenRes.statusCode);

    const forbiddenSyn = await app.inject({
      method: 'POST',
      url: '/v1/admin/dictionaries/synonyms',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { terms: ['тест1', 'тест2'] },
    });
    expect([401, 403]).toContain(forbiddenSyn.statusCode);
  });

  it('9. merch.rules & fallback.contract: pin rule moves product to position #1 and empty index returns 503 INDEX_EMPTY', async () => {
    // Get initial results for "моторное масло 5w-40 синтетика"
    const initialRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'моторное масло 5w-40 синтетика', limit: 5 },
    });
    const initialResults = initialRes.json().results;
    expect(initialResults.length).toBeGreaterThanOrEqual(3);
    const thirdProduct = initialResults[2];

    // Pin 3rd product to position 1
    const pinRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/merch/rules',
      headers: { 'x-api-key': ADMIN_KEY },
      payload: {
        queryPattern: 'моторное масло 5w-40 синтетика',
        type: 'pin',
        productId: thirdProduct.id,
        position: 1,
      },
    });
    expect(pinRes.statusCode).toBe(201);
    const ruleId = pinRes.json().rule.id;

    const afterPinRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'моторное масло 5w-40 синтетика', limit: 5 },
    });
    expect(afterPinRes.statusCode).toBe(200);
    const afterPinResults = afterPinRes.json().results;
    expect(afterPinResults[0].id).toBe(thirdProduct.id);
    expect(afterPinResults[0].explanation.businessBoost).toBeGreaterThan(0);

    // Clean up merch rule
    await app.inject({
      method: 'DELETE',
      url: `/v1/admin/merch/rules/${ruleId}`,
      headers: { 'x-api-key': ADMIN_KEY },
    });

    // Test E1 (Empty index cycle): clear -> ready (searchReady: false, code: INDEX_EMPTY) -> search/suggest (503 INDEX_EMPTY) -> demo/load (searchReady: true, itemsIndexed >= 1000)
    const clearRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/clear',
      headers: { 'x-api-key': ADMIN_KEY },
      payload: {},
    });
    expect(clearRes.statusCode).toBe(200);

    const emptyReadyRes = await app.inject({
      method: 'GET',
      url: '/v1/ready',
    });
    expect(emptyReadyRes.statusCode).toBe(200);
    const emptyReadyBody = emptyReadyRes.json();
    expect(emptyReadyBody.ready).toBe(true);
    expect(emptyReadyBody.processReady).toBe(true);
    expect(emptyReadyBody.searchReady).toBe(false);
    expect(emptyReadyBody.itemsIndexed).toBe(0);
    expect(emptyReadyBody.code).toBe('INDEX_EMPTY');

    const emptyIndexRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'наушники', limit: 5 },
    });
    expect(emptyIndexRes.statusCode).toBe(503);
    expect(emptyIndexRes.json().code).toBe('INDEX_EMPTY');
    expect(emptyIndexRes.json().itemsIndexed).toBe(0);

    const emptySuggestRes = await app.inject({
      method: 'POST',
      url: '/v1/suggest',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'наушники', limit: 5 },
    });
    expect(emptySuggestRes.statusCode).toBe(503);
    expect(emptySuggestRes.json().code).toBe('INDEX_EMPTY');

    const reloadRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
      payload: {},
    });
    expect(reloadRes.statusCode).toBe(200);
    for (let i = 0; i < DEMO_CATALOG_1000.length; i += 500) {
      const batch = DEMO_CATALOG_1000.slice(i, i + 500);
      const upRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': ADMIN_KEY },
        payload: { items: batch },
      });
      expect(upRes.statusCode).toBe(200);
    }

    const readyAfterLoadRes = await app.inject({
      method: 'GET',
      url: '/v1/ready',
    });
    expect(readyAfterLoadRes.statusCode).toBe(200);
    expect(readyAfterLoadRes.json().searchReady).toBe(true);
    expect(readyAfterLoadRes.json().itemsIndexed).toBeGreaterThanOrEqual(1000);
  }, 60_000);

  it('10. Fix-PR Audit Suite (G1-G6, S1, A1, PR1-PR6): suggest parity, non-null sku/imageUrl/url, and typo meta.rewrites completeness', async () => {
    // PR4 / G5: перфоратр -> meta.rewrites includes { type: 'typo', from: 'перфоратр', to: 'перфоратор' }
    const typoSingleRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'перфоратр', limit: 5 },
    });
    expect(typoSingleRes.statusCode).toBe(200);
    const typoSingleBody = typoSingleRes.json();
    expect(typoSingleBody.rewriteApplied).toBe(true);
    expect(typoSingleBody.normalizedQuery).toBe('перфоратор');
    expect(typoSingleBody.meta.rewrites.length).toBeGreaterThan(0);
    expect(typoSingleBody.meta.rewrites).toContainEqual({
      type: 'typo',
      from: 'перфоратр',
      to: 'перфоратор',
    });
    expect(typoSingleBody.rewriteApplied).toBe(typoSingleBody.meta.rewrites.length > 0);
    expect(typoSingleBody.results.length).toBeGreaterThan(0);

    // G2: детский смартфон до 15000 -> smartphones with price <= 15000
    const g2Res = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': SEARCH_KEY },
      payload: { query: 'детский смартфон до 15000', limit: 5 },
    });
    expect(g2Res.statusCode).toBe(200);
    const g2Results = g2Res.json().results;
    expect(g2Results.length).toBeGreaterThan(0);
    for (const hit of g2Results.slice(0, 3)) {
      expect(hit.category.toLowerCase()).toContain('смартфон');
      expect(hit.price).toBeLessThanOrEqual(15000);
      expect(hit.sku).toBeTruthy();
      expect(hit.url).toBeTruthy();
      expect(hit.imageUrl).toBeTruthy();
    }

    // G6: xyzabcqqq999 -> count === 0 on both /v1/search and /v1/suggest
    const [g6Search, g6Suggest] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': SEARCH_KEY },
        payload: { query: 'xyzabcqqq999', limit: 5 },
      }),
      app.inject({
        method: 'POST',
        url: '/v1/suggest',
        headers: { 'x-api-key': SEARCH_KEY },
        payload: { query: 'xyzabcqqq999', limit: 5 },
      }),
    ]);
    expect(g6Search.json().count).toBe(0);
    expect(g6Suggest.json().count).toBe(0);

    // PR1 / S1: Public demo key works on POST /v1/suggest and supports includeXRay, returning non-null sku, url, imageUrl
    const demoKeySuggestRes = await app.inject({
      method: 'POST',
      url: '/v1/suggest',
      headers: { 'x-api-key': 'eidos_public_demo_key_2026' },
      payload: { query: 'наушники для бега', limit: 6, includeXRay: true },
    });
    expect(demoKeySuggestRes.statusCode).toBe(200);
    const demoSuggestBody = demoKeySuggestRes.json();
    expect(demoSuggestBody.results.length).toBeGreaterThan(0);
    for (const hit of demoSuggestBody.results) {
      expect(typeof hit.sku).toBe('string');
      expect(hit.sku.length).toBeGreaterThan(0);
      expect(typeof hit.url).toBe('string');
      expect(typeof hit.imageUrl).toBe('string');
      expect(hit.humanExplanation).toBeDefined();
      expect(hit.xray).toBeDefined();
    }

    // A1: Public demo key on /v1/admin/overview -> 401
    const demoAdminRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/overview',
      headers: { 'x-api-key': 'eidos_public_demo_key_2026' },
    });
    expect(demoAdminRes.statusCode).toBe(401);
  });
});
