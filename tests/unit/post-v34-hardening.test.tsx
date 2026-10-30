import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server';
import { SearchResultsColumns } from '../../apps/workspace/src/components/search/SearchResultsColumns';
import { DEMO_CATALOG as DEMO_CATALOG_ITEMS } from '../../apps/api/src/demo/demo-catalog';
import {
  computeTextEmbedding,
  executeHybridCatalogSearch,
  simulateKeywordSearch,
} from '../../apps/workspace/src/utils/recommenderEngine';
import { UI_TRANSLATIONS } from '../../apps/workspace/src/i18n/uiTranslations';
import { parseCsv } from '../../apps/workspace/src/pages/DemoPage/lib/csv-parser';

describe('Post-v3.4 Hardening Acceptance Suite (P0 & P1)', () => {
  let app: FastifyInstance;
  let demoEmbeddings: Map<string, Float32Array>;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    demoEmbeddings = new Map();
    for (const item of DEMO_CATALOG_ITEMS) {
      demoEmbeddings.set(
        String(item.id),
        computeTextEmbedding(
          `passage: ${item.title} ${item.description} ${item.category} ${item.tags?.join(' ') || ''}`
        )
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('P0.1: enforces unified semver 3.4.0 across all package.json manifests, UI badges, README, CHANGELOG, and /v1/health', async () => {
    const manifests = [
      'package.json',
      'apps/api/package.json',
      'apps/workspace/package.json',
      'packages/core/package.json',
      'packages/sdk/package.json',
    ];

    for (const rel of manifests) {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), rel), 'utf-8'));
      expect(pkg.version, `Manifest ${rel} should have version 3.4.0`).toBe('3.4.0');
    }

    expect(UI_TRANSLATIONS.ru.nav.engineFooterTitle).toContain('EIDOS v3.4.0');
    expect(UI_TRANSLATIONS.en.nav.engineFooterTitle).toContain('EIDOS v3.4.0');
    expect(UI_TRANSLATIONS.ja.nav.engineFooterTitle).toContain('EIDOS v3.4.0');

    const readme = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf-8');
    expect(readme).toContain('# ⚡ EIDOS v3.4.0 GA');
    expect(readme).not.toContain('Delivers +35.3% relative CVR lift');

    const changelog = fs.readFileSync(path.resolve(process.cwd(), 'CHANGELOG.md'), 'utf-8');
    expect(changelog).toContain('## [3.4.0]');

    const healthRes = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.json().version).toBe('3.4.0');
  });

  it('P0.2 & P0.3: executes 10/10 reliable demo searches on "недорогие наушники для бега" (API + UI) with side-by-side comparison, X-Ray breakdown, and human-readable explanation', async () => {
    const loadRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
      payload: { scale: '48' },
    });
    expect(loadRes.statusCode).toBe(200);

    const query = 'недорогие наушники для бега';
    const queryVec = computeTextEmbedding(`query: ${query}`);

    for (let i = 0; i < 10; i++) {
      const searchRes = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: {
          'x-api-key': 'eidos_demo_key',
        },
        payload: {
          query,
          limit: 8,
          alpha: 0.65,
          enableIntentDetection: true,
        },
      });
      expect(searchRes.statusCode).toBe(200);
      const body = searchRes.json();
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results.length).toBeGreaterThan(0);

      // Also verify client-side hybrid engine 10/10 times
      const uiHits = executeHybridCatalogSearch(
        query,
        queryVec,
        DEMO_CATALOG_ITEMS,
        demoEmbeddings,
        0.65,
        8
      );
      expect(uiHits.length).toBeGreaterThan(0);
    }

    // Verify UI SearchResultsColumns renders >= 1 result card, side-by-side comparison, X-Ray panel, and human explanation on hit #1
    const hybridHits = executeHybridCatalogSearch(
      query,
      queryVec,
      DEMO_CATALOG_ITEMS,
      demoEmbeddings,
      0.65,
      8
    );
    const keywordHits = simulateKeywordSearch(query, DEMO_CATALOG_ITEMS);

    const html = renderToStaticMarkup(
      React.createElement(SearchResultsColumns, {
        compareMode: true,
        showXray: true,
        hybridHits,
        keywordHits,
        latencyMs: 1.4,
        alpha: 0.65,
        query,
        uiLang: 'ru',
        suggestedQueries: ['недорогие наушники для бега', 'кроссовки для марафона'],
        onRetryQuery: () => {},
        onResetFilters: () => {},
        t: UI_TRANSLATIONS.ru.search,
        onSelectItem: () => {},
        onInspectIn3D: () => {},
      })
    );

    expect(html).toContain('data-testid="search-result"');
    expect(html).toContain('data-testid="search-xray-panel"');
    expect(html).toContain('data-testid="first-hit-human-explanation"');
    expect(html).toContain('Товар на #1 месте');
    expect(html).toContain('data-testid="copy-first-hit-explanation"');
  });

  it('P1.8: renders Zero-Results UX card with reformulation hints and filter reset when query matches 0 items', () => {
    const nonsenseQuery = 'zzzz_nonexistent_product_999';
    const nonsenseVec = computeTextEmbedding(`query: ${nonsenseQuery}`);
    const hybridHits = executeHybridCatalogSearch(
      nonsenseQuery,
      nonsenseVec,
      DEMO_CATALOG_ITEMS,
      demoEmbeddings,
      0.65,
      8
    );
    expect(hybridHits.length).toBe(0);

    const html = renderToStaticMarkup(
      React.createElement(SearchResultsColumns, {
        compareMode: true,
        showXray: true,
        hybridHits: [],
        keywordHits: [],
        latencyMs: 0.9,
        alpha: 0.65,
        query: nonsenseQuery,
        uiLang: 'ru',
        suggestedQueries: ['недорогие наушники для бега', 'механическая клавиатура'],
        onRetryQuery: () => {},
        onResetFilters: () => {},
        t: UI_TRANSLATIONS.ru.search,
        onSelectItem: () => {},
        onInspectIn3D: () => {},
      })
    );

    expect(html).toContain('data-testid="zero-results-card"');
    expect(html).toContain('По запросу «zzzz_nonexistent_product_999» не найдено релевантных позиций');
    expect(html).toContain('data-testid="zero-results-hint"');
    expect(html).toContain('data-testid="zero-results-reset-btn"');
  });

  it('P0.5 & P1.6: provides docs/PRODUCTION.md, docs/CSV_CONTRACT.md, examples/sample-catalog.csv, and row/field validation on CSV & API upsert', async () => {
    const prodDoc = path.resolve(process.cwd(), 'docs/PRODUCTION.md');
    const csvDoc = path.resolve(process.cwd(), 'docs/CSV_CONTRACT.md');
    const sampleCsv = path.resolve(process.cwd(), 'examples/sample-catalog.csv');

    expect(fs.existsSync(prodDoc)).toBe(true);
    expect(fs.existsSync(csvDoc)).toBe(true);
    expect(fs.existsSync(sampleCsv)).toBe(true);

    // Parse sample-catalog.csv via parseCsv
    const sampleCsvContent = fs.readFileSync(sampleCsv, 'utf-8');
    const parsedSample = parseCsv(sampleCsvContent);
    expect(parsedSample.errors).toEqual([]);
    expect(parsedSample.items.length).toBeGreaterThanOrEqual(8);
    expect(parsedSample.items[0].sku).toBeDefined();
    expect(parsedSample.items[0].brand).toBeDefined();

    // Verify invalid CSV row reports exact line & field warning/error
    const brokenCsv = `id,title,description,category,price\nsku-1,"",Описание,Аудио,-50`;
    const brokenParsed = parseCsv(brokenCsv);
    expect(brokenParsed.warnings.length).toBeGreaterThan(0);
    expect(brokenParsed.warnings[0]).toContain('Строка 2');

    // Verify POST /v1/catalog/upsert returns 400 Bad Request with row & field details when batch items are invalid
    const badUpsertRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: {
        'x-api-key': process.env.EIDOS_API_KEY || 'eidos_dev_key',
      },
      payload: {
        items: [
          {
            id: 'bad-row-1',
            title: '',
            description: 'Missing title and negative price',
            category: 'Audio',
            price: -100,
          },
        ],
      },
    });
    expect(badUpsertRes.statusCode).toBe(400);
    const errJson = badUpsertRes.json();
    expect(errJson.error).toBe('Validation Error');
    expect(Array.isArray(errJson.details)).toBe(true);
    expect(errJson.details[0]).toContain('row 1 (items[0])');
  });
});
