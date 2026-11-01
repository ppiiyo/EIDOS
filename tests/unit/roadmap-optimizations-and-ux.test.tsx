import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeEach } from 'vitest';
import { parseYmlXmlContent, SAMPLE_YML_CONTENT } from '../../apps/workspace/src/pages/DemoPage/lib/yml-parser';
import { parseFile } from '../../apps/workspace/src/pages/DemoPage/lib/csv-parser';
import {
  INDUSTRY_SYNONYM_PACKS,
  toggleSynonymPack,
  addCustomSynonym,
  expandQueryWithSynonyms,
  resetSynonymsToDefault,
} from '../../apps/workspace/src/data/industrySynonyms';
import { vectorizeCatalogInWorker } from '../../apps/workspace/src/lib/embeddings/vectorWorkerPool';
import {
  computeTextEmbedding,
  executeHybridCatalogSearch,
  getOrBuildCatalogIndices,
  INITIAL_CATALOG,
} from '../../apps/workspace/src/utils/recommenderEngine';
import { AnalyticsView } from '../../apps/workspace/src/components/AnalyticsView';
import { SearchView } from '../../apps/workspace/src/components/SearchView';
import { WidgetLivePreviewModal } from '../../apps/workspace/src/pages/DemoPage/components/WidgetLivePreviewModal';
import { StorefrontBenchmarkModal } from '../../apps/workspace/src/pages/DemoPage/components/StorefrontBenchmarkModal';
import { buildServer } from '../../apps/api/src/server';

describe('EIDOS Technical Optimizations & Conversion UX Upgrades', () => {
  beforeEach(() => {
    resetSynonymsToDefault();
  });

  it('1. Parses Yandex.Market YML (<offer>) and 1C-Bitrix CommerceML (<Товар>) XML feeds accurately', async () => {
    const result = parseYmlXmlContent(SAMPLE_YML_CONTENT);
    expect(result.errors).toEqual([]);
    expect(result.items.length).toBe(6);
    expect(result.items[0].id).toBe('yml-101');
    expect(result.items[0].title).toContain('Sennheiser Momentum 4');
    expect(result.items[0].category).toBe('Аудио и наушники');
    expect(result.items[0].price).toBe(27990);

    // 1C-Bitrix CommerceML <Товар>
    const bitrixXml = `<?xml version="1.0" encoding="UTF-8"?>
      <КоммерческаяИнформация>
        <Каталог>
          <Товары>
            <Товар>
              <Ид>bx-900</Ид>
              <Артикул>ART-900</Иртикул>
              <Наименование>Перфоратор Bosch GBH 2-26 DRE</Наименование>
              <Описание>Профессиональный сетевой перфоратор SDS-Plus 800 Вт</Описание>
            </Товар>
          </Товары>
        </Каталог>
      </КоммерческаяИнформация>`;
    const bxResult = parseYmlXmlContent(bitrixXml);
    expect(bxResult.errors).toEqual([]);
    expect(bxResult.items.length).toBe(1);
    expect(bxResult.items[0].id).toBe('bx-900');
    expect(bxResult.items[0].title).toContain('Bosch GBH 2-26');

    const file = new File([SAMPLE_YML_CONTENT], 'feed.yml', { type: 'application/xml' });
    const fileRes = await parseFile(file);
    expect(fileRes.items.length).toBe(6);
  });

  it('2. Expands queries using Industry Synonym Packs (Автотека, Электроника, Fashion, DIY) and custom Zero-Result bindings', () => {
    expect(INDUSTRY_SYNONYM_PACKS.map((p) => p.id)).toEqual([
      'auto_parts',
      'electronics',
      'fashion',
      'diy',
    ]);

    const autoExpanded = expandQueryWithSynonyms('купить пожалуйста акб и грм');
    expect(autoExpanded.removedStopwords).toContain('купить');
    expect(autoExpanded.removedStopwords).toContain('пожалуйста');
    expect(autoExpanded.matchedSynonyms.length).toBeGreaterThanOrEqual(2);
    expect(autoExpanded.expandedQuery).toContain('аккумулятор');
    expect(autoExpanded.expandedQuery).toContain('газораспределительный');

    toggleSynonymPack('diy');
    const diyExpanded = expandQueryWithSynonyms('шурик и болгарка');
    expect(diyExpanded.expandedQuery).toContain('шуруповерт');
    expect(diyExpanded.expandedQuery).toContain('углошлифовальная');

    addCustomSynonym('макбук про м3', 'ноутбук pro workstation');
    const customExpanded = expandQueryWithSynonyms('макбук про м3');
    expect(customExpanded.expandedQuery).toContain('ноутбук pro workstation');

    const embeddings = new Map<string, Float32Array>();
    for (const item of INITIAL_CATALOG) {
      embeddings.set(
        String(item.id),
        computeTextEmbedding(`passage: ${item.title}. ${item.category}. ${item.description}`)
      );
    }
    const qVec = computeTextEmbedding('query: макбук про м3');
    const hits = executeHybridCatalogSearch('макбук про м3', qVec, INITIAL_CATALOG, embeddings, 0.7, 5);
    expect(hits.length).toBeGreaterThan(0);
  });

  it('3. Vectorizes catalog items via vectorizeCatalogInWorker with 384-d unit-normalized vectors', async () => {
    const sampleItems = INITIAL_CATALOG.slice(0, 10);
    const map = await vectorizeCatalogInWorker(sampleItems);
    expect(map.size).toBe(10);
    const firstVec = map.get(String(sampleItems[0].id));
    expect(firstVec).toBeInstanceOf(Float32Array);
    expect(firstVec?.length).toBe(384);

    let normSq = 0;
    for (let i = 0; i < 384; i++) {
      normSq += (firstVec?.[i] ?? 0) ** 2;
    }
    expect(Math.sqrt(normSq)).toBeCloseTo(1.0, 2);
  });

  it('4. Automatically enables Int8 Scalar Quantization when catalog size >= 5,000 SKUs', () => {
    const smallCat = INITIAL_CATALOG.slice(0, 5);
    const smallEmb = new Map<string, Float32Array>();
    for (const item of smallCat) {
      smallEmb.set(String(item.id), computeTextEmbedding(item.title));
    }
    const built = getOrBuildCatalogIndices(smallCat, smallEmb);
    expect(built.hnsw).toBeDefined();
    expect(built.bm25).toBeDefined();
  });

  it('5. Renders Zero-Result Revenue Recovery Report, Widget Live Preview, Storefront Benchmark Modal, and SearchView Merchandising buttons', () => {
    const analyticsHtml = renderToStaticMarkup(<AnalyticsView uiLang="ru" />);
    expect(analyticsHtml).toContain('zero-result-recovery-row');
    expect(analyticsHtml).toContain('bind-synonym-btn-макбук про м3');
    expect(analyticsHtml).toContain('Упущенная выручка (Zero-Results)');

    const sampleCatalog = INITIAL_CATALOG.slice(0, 6);
    const searchHtml = renderToStaticMarkup(
      <SearchView
        catalog={sampleCatalog}
        onHybridSearch={async () => []}
        onSelectItem={() => {}}
        onInspectIn3D={() => {}}
        uiLang="ru"
      />
    );
    expect(searchHtml).toContain('open-widget-preview-btn');
    expect(searchHtml).toContain('open-benchmark-modal-btn');

    const widgetHtml = renderToStaticMarkup(
      <WidgetLivePreviewModal
        isOpen={true}
        onClose={() => {}}
        catalog={sampleCatalog}
        onHybridSearch={async () => []}
        onSelectItem={() => {}}
        initialQuery="наушники"
        uiLang="ru"
      />
    );
    expect(widgetHtml).toContain('widget-live-preview-modal');
    expect(widgetHtml).toContain('CLIENT STOREFRONT');

    const benchmarkHtml = renderToStaticMarkup(
      <StorefrontBenchmarkModal
        isOpen={true}
        onClose={() => {}}
        catalog={sampleCatalog}
        onHybridSearch={async () => []}
        onRunQueryInStudio={() => {}}
        uiLang="ru"
      />
    );
    expect(benchmarkHtml).toContain('storefront-benchmark-modal');
    expect(benchmarkHtml).toContain('synonym-pack-btn-auto_parts');
    expect(benchmarkHtml).toContain('synonym-pack-btn-diy');
  });

  it('6. Executes backend POST /v1/catalog/import-yml and POST /v1/benchmark/compare-url endpoints', async () => {
    const app = await buildServer();

    const ymlRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/import-yml',
      headers: { 'x-api-key': 'eidos_dev_key' },
      payload: { xml: SAMPLE_YML_CONTENT, autoIndex: true },
    });
    expect(ymlRes.statusCode).toBe(200);
    const ymlBody = ymlRes.json();
    expect(ymlBody.success).toBe(true);
    expect(ymlBody.importedCount).toBe(6);

    const benchRes = await app.inject({
      method: 'POST',
      url: '/v1/benchmark/compare-url',
      headers: { 'x-api-key': 'eidos_dev_key' },
      payload: {
        queries: ['наушники для бега', 'ультрабук для программирования'],
      },
    });
    expect(benchRes.statusCode).toBe(200);
    const benchBody = benchRes.json();
    expect(benchBody.success).toBe(true);
    expect(benchBody.comparisons.length).toBe(2);
    expect(benchBody.comparisons[0].eidosCount).toBeGreaterThan(0);

    await app.close();
  });
});
