import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server';
import { getAdminConsoleStore } from '../../apps/api/src/services/admin-console-store';
import { getApiKeyManager } from '../../apps/api/src/services/api-key-manager';
import { EidosAdminConsole } from '../../apps/workspace/src/pages/AdminConsolePage/EidosAdminConsole';
import { App } from '../../apps/workspace/src/App';

describe('EIDOS Admin Console + Public Demo Acceptance Suite (v3.4.0)', () => {
  let app: FastifyInstance;
  const adminKey = process.env.EIDOS_API_KEY || 'eidos_dev_key';

  beforeAll(async () => {
    getAdminConsoleStore().resetForTests();
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Upserts pilot catalog, records catalog summary, and serves Live Search with X-Ray & scorePercent', async () => {
    const upsertRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': adminKey },
      payload: {
        items: [
          {
            id: 'hp-run-1',
            title: 'Спортивные беспроводные наушники Shokz OpenRun Pro',
            description: 'Водостойкие наушники с костной проводимостью для бега и тренировок',
            category: 'Аудио и наушники',
            price: 14990,
            inStock: true,
            tags: ['наушники', 'бег', 'спорт'],
          },
          {
            id: 'hp-anc-2',
            title: 'Беспроводные наушники Sony WH-1000XM5 ANC',
            description: 'Полноразмерные наушники с активным шумоподавлением Bluetooth',
            category: 'Аудио и наушники',
            price: 32990,
            inStock: true,
            tags: ['наушники', 'bluetooth', 'anc'],
          },
          {
            id: 'book-arch-1',
            title: 'Книга Чистая Архитектура Роберт Мартин',
            description: 'Руководство по проектированию программного обеспечения',
            category: 'Книги',
            price: 1400,
            inStock: true,
            tags: ['книга', 'разработка'],
          },
        ],
      },
    });
    expect(upsertRes.statusCode).toBe(200);

    const catSummaryRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/catalog/summary',
      headers: { 'x-api-key': adminKey },
    });
    expect(catSummaryRes.statusCode).toBe(200);
    const catSummary = catSummaryRes.json();
    expect(catSummary.itemsIndexed).toBeGreaterThanOrEqual(3);
    expect(catSummary.lastUpsert.upserted).toBe(3);

    const searchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'eidos_demo_key' },
      payload: {
        query: 'наушники для бега',
        mode: 'hybrid',
        alpha: 0.55,
        limit: 5,
      },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = searchRes.json();
    expect(searchBody.count).toBeGreaterThan(0);
    expect(searchBody.results[0].id).toBe('hp-run-1');
    expect(typeof searchBody.results[0].scorePercent).toBe('number');
    expect(searchBody.results[0].scorePercent).toBeGreaterThanOrEqual(50);
    expect(searchBody.results[0].explanation).toBeDefined();
  });

  it('2. Records zero-result queries in Query Log (/v1/admin/queries) and Analytics Summary (/v1/admin/analytics/summary)', async () => {
    const garbageQuery = 'zzzz_nonexistent_product_999';
    const zeroRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'eidos_demo_key' },
      payload: {
        query: garbageQuery,
        mode: 'hybrid',
        limit: 5,
      },
    });
    expect(zeroRes.statusCode).toBe(200);
    expect(zeroRes.json().count).toBe(0);

    const logRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/queries?emptyOnly=true',
      headers: { 'x-api-key': adminKey },
    });
    expect(logRes.statusCode).toBe(200);
    const logBody = logRes.json();
    expect(logBody.items.length).toBeGreaterThanOrEqual(1);
    const foundZero = logBody.items.find((r: { query: string }) => r.query === garbageQuery);
    expect(foundZero).toBeDefined();
    expect(foundZero.flags.empty).toBe(true);

    const analyticsRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics/summary?period=7d',
      headers: { 'x-api-key': adminKey },
    });
    expect(analyticsRes.statusCode).toBe(200);
    const analyticsBody = analyticsRes.json();
    expect(analyticsBody.totalSearches).toBeGreaterThanOrEqual(2);
    expect(analyticsBody.zeroResultRate).toBeGreaterThan(0);
    expect(
      analyticsBody.topZeroResultQueries.some((q: { query: string }) => q.query === garbageQuery)
    ).toBe(true);
  });

  it('3. Applies Dictionaries (synonyms, rewrites, stopwords) in /v1/search and exposes normalizedQuery', async () => {
    const putDictRes = await app.inject({
      method: 'PUT',
      url: '/v1/admin/dictionaries',
      headers: { 'x-api-key': adminKey },
      payload: {
        synonyms: [
          { phrase: 'уши', replacement: 'наушники', enabled: true },
          { phrase: 'хэдфоны', replacement: 'наушники', enabled: true },
        ],
        rewrites: [{ from: 'шoкз', to: 'shokz наушники', enabled: true }],
        stopwords: ['пожалуйста', 'купить'],
      },
    });
    expect(putDictRes.statusCode).toBe(200);

    const synSearchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'eidos_demo_key' },
      payload: {
        query: 'купить пожалуйста уши для бега',
        mode: 'hybrid',
        limit: 5,
      },
    });
    expect(synSearchRes.statusCode).toBe(200);
    const synBody = synSearchRes.json();
    expect(synBody.rewritten).toBe(true);
    expect(synBody.normalizedQuery).toContain('наушники');
    expect(synBody.normalizedQuery).not.toContain('пожалуйста');
    expect(synBody.count).toBeGreaterThan(0);
    expect(synBody.results[0].id).toBe('hp-run-1');
  });

  it('4. Persists Ranking Defaults (PUT /v1/admin/ranking-defaults) and applies them to storefront /v1/search', async () => {
    const putRankRes = await app.inject({
      method: 'PUT',
      url: '/v1/admin/ranking-defaults',
      headers: { 'x-api-key': adminKey },
      payload: {
        simpleCategoryGate: 'hard',
        defaultAlpha: 0.62,
        minScore: 0.015,
        minSimilarity: 0.25,
      },
    });
    expect(putRankRes.statusCode).toBe(200);
    const savedDefaults = putRankRes.json();
    expect(savedDefaults.simpleCategoryGate).toBe('hard');
    expect(savedDefaults.defaultAlpha).toBe(0.62);

    const searchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'eidos_demo_key' },
      payload: {
        query: 'наушники',
        limit: 5,
      },
    });
    expect(searchRes.statusCode).toBe(200);
    const body = searchRes.json();
    expect(body.count).toBeGreaterThan(0);
    const ids = body.results.map((r: { id: string }) => r.id);
    expect(ids).not.toContain('book-arch-1');
  });

  it('5. Tracks Storefront Click Events (POST /v1/events) for honest funnel metrics', async () => {
    const evRes = await app.inject({
      method: 'POST',
      url: '/v1/events',
      headers: { 'x-api-key': 'eidos_demo_key' },
      payload: {
        type: 'click',
        query: 'наушники для бега',
        productId: 'hp-run-1',
      },
    });
    expect(evRes.statusCode).toBe(201);
    expect(evRes.json().success).toBe(true);

    const analyticsRes = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics/summary?period=7d',
      headers: { 'x-api-key': adminKey },
    });
    expect(analyticsRes.statusCode).toBe(200);
    expect(analyticsRes.json().honestFunnel.clicks).toBeGreaterThanOrEqual(1);
    expect(analyticsRes.json().searchesWithClick).toBeGreaterThanOrEqual(1);
  });

  it('6. Enforces strict RBAC: Public Demo / SEARCH_KEY cannot mutate catalog or admin dictionaries', async () => {
    const keyManager = getApiKeyManager();
    const createdSearchKey = keyManager.generateKey({
      role: 'search',
      description: 'Storefront Widget Key',
    });

    const forbiddenUpsert = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': createdSearchKey.key },
      payload: {
        items: [
          {
            id: 'hack-1',
            title: 'Unauthorized Item',
            description: 'Should fail',
            category: 'Test',
            price: 100,
          },
        ],
      },
    });
    expect(forbiddenUpsert.statusCode).toBe(403);

    const forbiddenAdminDict = await app.inject({
      method: 'PUT',
      url: '/v1/admin/dictionaries',
      headers: { 'x-api-key': createdSearchKey.key },
      payload: {
        synonyms: [],
        rewrites: [],
        stopwords: [],
      },
    });
    expect(forbiddenAdminDict.statusCode).toBe(403);

    const unauthQueries = await app.inject({
      method: 'GET',
      url: '/v1/admin/queries',
    });
    expect(unauthQueries.statusCode).toBe(401);

    const unauthAnalytics = await app.inject({
      method: 'GET',
      url: '/v1/admin/analytics/summary',
    });
    expect(unauthAnalytics.statusCode).toBe(401);

    // Public Demo isolated endpoint works cleanly in read-only mode
    const demoLoadRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
      payload: { scale: '48' },
    });
    expect(demoLoadRes.statusCode).toBe(200);

    const demoSearchRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/search',
      payload: { query: 'наушники для бега', alpha: 0.55, limit: 5 },
    });
    expect(demoSearchRes.statusCode).toBe(200);
    expect(demoSearchRes.json().results.length).toBeGreaterThan(0);
  });

  it('7. Renders EidosAdminConsole in both "admin" and "public-demo" surface modes with exact RU copy and recent empty queries block', () => {
    const adminHtml = renderToStaticMarkup(<EidosAdminConsole mode="admin" uiLang="ru" />);
    expect(adminHtml).toContain('data-testid="eidos-admin-console"');
    expect(adminHtml).toContain('Журнал запросов');
    expect(adminHtml).toContain('Проверка поиска');
    expect(adminHtml).toContain('Словари и синонимы');
    expect(adminHtml).toContain('Настройки ранжирования');
    expect(adminHtml).toContain('Проверка системы');
    expect(adminHtml).toContain('Доля пустых выдач');
    expect(adminHtml).toContain('data-testid="dashboard-recent-empty-queries"');
    expect(adminHtml).toContain('data-testid="dashboard-seed-pilot-btn"');

    const publicDemoHtml = renderToStaticMarkup(
      <EidosAdminConsole mode="public-demo" uiLang="ru" />
    );
    expect(publicDemoHtml).toContain('data-testid="public-demo-banner"');
    expect(publicDemoHtml).toContain(
      'Демо-контур · Только чтение · Для пилота на вашем каталоге — self-hosted EIDOS'
    );
    // Write tabs must not appear in public-demo surface
    expect(publicDemoHtml).not.toContain('data-testid="admin-tab-dictionaries"');
    expect(publicDemoHtml).not.toContain('data-testid="admin-tab-api-keys"');
    expect(publicDemoHtml).not.toContain('data-testid="admin-tab-system"');
  });

  it('8. App routing (/admin and /public-demo) mounts standalone EidosAdminConsole WITHOUT Studio Sidebar', () => {
    const prevWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = {
        location: { pathname: '/admin', search: '' },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      const adminRouteHtml = renderToStaticMarkup(<App />);
      expect(adminRouteHtml).toContain('data-testid="eidos-admin-console"');
      expect(adminRouteHtml).not.toContain('data-testid="studio-sidebar"');

      (globalThis as any).window = {
        location: { pathname: '/public-demo', search: '' },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      const demoRouteHtml = renderToStaticMarkup(<App />);
      expect(demoRouteHtml).toContain('data-testid="eidos-admin-console"');
      expect(demoRouteHtml).toContain('data-testid="public-demo-banner"');
      expect(demoRouteHtml).not.toContain('data-testid="studio-sidebar"');
    } finally {
      (globalThis as any).window = prevWindow;
    }
  });

  it('9. POST /v1/demo/load indexes 1000+ SKU, serves GET /v1/demo/analytics without auth, and tests WOW Golden Queries', async () => {
    // 1. Load 1000+ SKU demo catalog
    const loadRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
      payload: { scale: '1000' },
    });
    expect(loadRes.statusCode).toBe(200);
    const loadBody = loadRes.json();
    expect(loadBody.ok).toBe(true);
    expect(loadBody.itemsLoaded).toBeGreaterThanOrEqual(1000);

    // 2. GET /v1/demo/analytics without x-api-key returns non-zero metrics
    const analyticsRes = await app.inject({
      method: 'GET',
      url: '/v1/demo/analytics?period=7d',
    });
    expect(analyticsRes.statusCode).toBe(200);
    const aBody = analyticsRes.json();
    expect(aBody.totalSearches).toBeGreaterThanOrEqual(10);
    expect(aBody.zeroResultRate).toBeGreaterThan(0);
    expect(aBody.avgLatencyMs).toBeGreaterThan(0);
    expect(Array.isArray(aBody.topZeroResultQueries)).toBe(true);
    expect(aBody.topZeroResultQueries.length).toBeGreaterThan(0);

    // 3. Golden query: "недорогие наушники для бега" -> top results are Headphones, never Shoes
    const runHeadphonesRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/search',
      payload: { query: 'недорогие наушники для бега', alpha: 0.55, limit: 5 },
    });
    expect(runHeadphonesRes.statusCode).toBe(200);
    const hpBody = runHeadphonesRes.json();
    expect(hpBody.count).toBeGreaterThan(0);
    const topCategory = hpBody.results[0].category.toLowerCase();
    expect(
      topCategory.includes('наушник') || topCategory.includes('аудио'),
      `Top category should be Headphones/Audio but got "${hpBody.results[0].category}"`
    ).toBe(true);
    expect(topCategory.includes('обувь') || topCategory.includes('кроссовк')).toBe(false);

    // 4. Golden query: "детский смартфон до 15000" -> smartphones with price <= 15000
    const kidsPhoneRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/search',
      payload: { query: 'детский смартфон до 15000', alpha: 0.55, limit: 5 },
    });
    expect(kidsPhoneRes.statusCode).toBe(200);
    const phoneBody = kidsPhoneRes.json();
    expect(phoneBody.count).toBeGreaterThan(0);
    const topPhone = phoneBody.results[0];
    expect(topPhone.price).toBeLessThanOrEqual(15000);

    // 5. Golden query: "5W-40" -> motor oils
    const oilRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/search',
      payload: { query: '5W-40', alpha: 0.55, limit: 5 },
    });
    expect(oilRes.statusCode).toBe(200);
    const oilBody = oilRes.json();
    expect(oilBody.count).toBeGreaterThan(0);
    const topOil = oilBody.results[0];
    expect(
      topOil.title.includes('5W-40') ||
        topOil.description.includes('5W-40') ||
        topOil.category.includes('Авто') ||
        topOil.category.includes('масла')
    ).toBe(true);

    // 6. Golden query: "yfeiybrb" (keyboard layout mistype) -> recovered to наушники
    const layoutRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/search',
      payload: { query: 'yfeiybrb', alpha: 0.55, limit: 5 },
    });
    expect(layoutRes.statusCode).toBe(200);
    const layoutBody = layoutRes.json();
    expect(layoutBody.count).toBeGreaterThan(0);
    expect(layoutBody.normalizedQuery).toBe('наушники');

    // 7. Golden query: "zzzz_garbage_999" and "Абракадабра" -> honest count 0
    const garbageRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/search',
      payload: { query: 'zzzz_garbage_999', alpha: 0.55, limit: 5 },
    });
    expect(garbageRes.statusCode).toBe(200);
    expect(garbageRes.json().count).toBe(0);

    const abracadabraRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/search',
      payload: { query: 'Абракадабра', alpha: 0.55, limit: 5 },
    });
    expect(abracadabraRes.statusCode).toBe(200);
    expect(abracadabraRes.json().count).toBe(0);
  });

  it('10. Renders Story-Mode Public Demo UX, Golden Query Presets, collapsed Specialist Levers, and Demo Reload controls', () => {
    const publicDemoHtml = renderToStaticMarkup(
      <EidosAdminConsole mode="public-demo" uiLang="ru" />
    );
    expect(publicDemoHtml).toContain('Поиск, который понимает покупателя');
    expect(publicDemoHtml).toContain('1000+ товаров · без OpenAI · explainable');
    expect(publicDemoHtml).toContain('Каталог демо: 1048 товаров');
    expect(publicDemoHtml).toContain('Почему в топе');
    expect(publicDemoHtml).toContain('Для специалиста');
    expect(publicDemoHtml).toContain('Ничего не найдено — так и должно быть для бессмысленного запроса');
    expect(publicDemoHtml).toContain('data-testid="admin-live-sample-недорогие наушники для бега"');
    expect(publicDemoHtml).toContain('data-testid="admin-live-sample-детский смартфон до 15000"');
    expect(publicDemoHtml).toContain('data-testid="admin-live-sample-5W-40"');
    expect(publicDemoHtml).toContain('data-testid="admin-live-sample-yfeiybrb"');
    expect(publicDemoHtml).toContain('data-testid="admin-live-sample-Абракадабра"');
    expect(publicDemoHtml).toContain('data-testid="admin-live-sample-zzzz_garbage_999"');
    expect(publicDemoHtml).toContain('data-testid="reload-demo-catalog-btn"');
  });

  it('11. Validates DEMO_CATALOG_1000 store-grade quality: 1048 unique titles, no duplicate word spam, and clean Russian categories', async () => {
    const { DEMO_CATALOG_1000 } = await import('../../apps/api/src/demo/demo-catalog-1000');
    expect(DEMO_CATALOG_1000.length).toBeGreaterThanOrEqual(1000);

    const uniqueTitles = new Set(DEMO_CATALOG_1000.map((item) => item.title));
    expect(uniqueTitles.size).toBe(DEMO_CATALOG_1000.length);

    for (const item of DEMO_CATALOG_1000) {
      expect(item.title.toLowerCase()).not.toContain('детский детский');
      expect(item.category).not.toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(typeof item.price).toBe('number');
      expect(item.price).toBeGreaterThan(0);
    }
  });
});
