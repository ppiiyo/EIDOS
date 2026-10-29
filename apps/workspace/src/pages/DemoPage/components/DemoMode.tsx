import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { CatalogItem } from '../../../types';
import {
  DEFAULT_CATALOG,
  HybridSearchHit,
  computeTextEmbedding,
  executeHybridCatalogSearch,
  computeCategoryEntropy,
  getOrBuildCatalogHNSWIndex,
  benchmarkHnswVsLinear,
  generateSyntheticScaledCatalog,
  cosineSimilarity,
  generateSemanticExplanation,
} from '../../../utils/recommenderEngine';
import {
  FULL_DEMO_CATALOG,
  PLATFORM_DOMAIN_PRESETS,
} from '../../../data/domainDatabases';
import { EmbeddingEngineState } from '../../../lib/embeddings';
import { UiLanguage } from '../../../i18n/uiTranslations';
import { SearchView } from '../../../components/SearchView';

export type DemoPresetScope = 'all' | 'marketplace' | 'streaming' | 'video_jp' | 'global_multilingual' | 'scaled_1200';

export interface DemoModeProps {
  onSelectItem?: (item: CatalogItem) => void;
  onInspectIn3D?: (item: CatalogItem) => void;
  uiLang?: UiLanguage;
  embeddingState?: EmbeddingEngineState;
  apiBaseUrl?: string;
}

export const DemoMode: React.FC<DemoModeProps> = ({
  onSelectItem = () => {},
  onInspectIn3D = () => {},
  uiLang = 'ru',
  embeddingState,
  apiBaseUrl = '',
}) => {
  const [isLoadingDemo, setIsLoadingDemo] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeScope, setActiveScope] = useState<DemoPresetScope>('all');
  const [inspectedDemoItem, setInspectedDemoItem] = useState<CatalogItem | null>(
    FULL_DEMO_CATALOG[0] || DEFAULT_CATALOG[0] || null
  );

  // Живые метрики воронки и производительности в демо-режиме
  const [demoSearchesCount, setDemoSearchesCount] = useState(14);
  const [demoClicksCount, setDemoClicksCount] = useState(9);
  const [demoCartCount, setDemoCartCount] = useState(4);
  const [demoPurchasesCount, setDemoPurchasesCount] = useState(2);
  const [lastQueryLatencyMs, setLastQueryLatencyMs] = useState(1.8);

  useEffect(() => {
    let active = true;

    async function initDemoOnServer() {
      setIsLoadingDemo(true);
      setLoadError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/v1/demo/load`, {
          method: 'POST',
        });
        if (!res.ok && active) {
          setLoadError(`Серверный демо-индекс: HTTP ${res.status} (активен локальный HNSW + BM25)`);
        }
      } catch {
        // Работает автономно на полном клиентском HNSW + BM25 индексе
      } finally {
        if (active) {
          setIsLoadingDemo(false);
        }
      }
    }

    void initDemoOnServer();

    return () => {
      active = false;
      void fetch(`${apiBaseUrl}/v1/demo/reset`, {
        method: 'POST',
      }).catch(() => {});
    };
  }, [apiBaseUrl]);

  const baseEmbeddings = useMemo(() => {
    const map = new Map<string, Float32Array>();
    for (const item of FULL_DEMO_CATALOG) {
      map.set(
        String(item.id),
        computeTextEmbedding(
          `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`
        )
      );
    }
    return map;
  }, []);

  const { activeCatalog, activeEmbeddings } = useMemo(() => {
    if (activeScope === 'all') {
      return { activeCatalog: FULL_DEMO_CATALOG, activeEmbeddings: baseEmbeddings };
    }
    if (activeScope === 'scaled_1200') {
      const scaled = generateSyntheticScaledCatalog(1200, FULL_DEMO_CATALOG, baseEmbeddings);
      return { activeCatalog: scaled.catalog, activeEmbeddings: scaled.embeddings };
    }
    const preset = PLATFORM_DOMAIN_PRESETS.find((p) => p.id === activeScope);
    const items = preset ? preset.items : DEFAULT_CATALOG;
    const map = new Map<string, Float32Array>();
    for (const item of items) {
      const existing = baseEmbeddings.get(String(item.id));
      map.set(
        String(item.id),
        existing ||
          computeTextEmbedding(
            `passage: ${item.title}. ${item.category}. ${item.description}. ${(item.tags || []).join(' ')}`
          )
      );
    }
    return { activeCatalog: items, activeEmbeddings: map };
  }, [activeScope, baseEmbeddings]);

  const engineTelemetry = useMemo(() => {
    const entropy = computeCategoryEntropy(activeCatalog);
    const hnsw = getOrBuildCatalogHNSWIndex(activeCatalog, activeEmbeddings);
    const probeVec =
      activeEmbeddings.get(String(activeCatalog[0]?.id || '1')) ||
      new Float32Array(384).fill(0.05);
    const bench = benchmarkHnswVsLinear(hnsw, activeCatalog, activeEmbeddings, probeVec, 10, 80);
    return {
      totalSku: activeCatalog.length,
      uniqueCategories: entropy.uniqueCategories,
      entropyBits: entropy.entropyBits,
      normalizedDiversityPct: entropy.normalizedPercent,
      hnswLatencyMs: bench.hnswLatencyMs,
      linearLatencyMs: bench.linearLatencyMs,
      speedup: bench.speedup,
      recallTopK: bench.recallTopK,
      qpsHnsw: bench.qpsHnsw,
    };
  }, [activeCatalog, activeEmbeddings]);

  const demoRecommendations = useMemo(() => {
    const target = inspectedDemoItem || activeCatalog[0];
    if (!target) return [];
    const targetVec = activeEmbeddings.get(String(target.id));
    if (!targetVec) return [];

    return activeCatalog
      .filter((item) => String(item.id) !== String(target.id))
      .map((item) => {
        const vec = activeEmbeddings.get(String(item.id));
        const sim = vec ? cosineSimilarity(targetVec, vec) : 0;
        const crossCatBonus = item.category !== target.category ? 0.08 : 0;
        const mmrScore = Math.min(0.99, sim * 0.88 + crossCatBonus);
        return {
          item,
          sim: Number(sim.toFixed(3)),
          mmrScore: Number(mmrScore.toFixed(3)),
          reason: generateSemanticExplanation(target, item),
        };
      })
      .sort((a, b) => b.mmrScore - a.mmrScore)
      .slice(0, 4);
  }, [inspectedDemoItem, activeCatalog, activeEmbeddings]);

  const handleDemoHybridSearch = useCallback(
    async (query: string, alpha: number, limit = 12): Promise<HybridSearchHit[]> => {
      const t0 = performance.now();
      const queryVec = computeTextEmbedding(`query: ${query}`);
      const hits = executeHybridCatalogSearch(
        query,
        queryVec,
        activeCatalog,
        activeEmbeddings,
        alpha,
        limit
      );
      const elapsed = Math.max(0.4, Math.round((performance.now() - t0) * 100) / 100);
      setLastQueryLatencyMs(elapsed);
      setDemoSearchesCount((c) => c + 1);
      if (hits[0]?.item) {
        setInspectedDemoItem(hits[0].item);
      }
      return hits;
    },
    [activeCatalog, activeEmbeddings]
  );

  const handleSelectDemoCard = useCallback(
    (item: CatalogItem) => {
      setInspectedDemoItem(item);
      setDemoClicksCount((c) => c + 1);
      void fetch(`${apiBaseUrl}/v1/analytics/funnel/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'click', itemId: String(item.id), sessionId: 'demo-session' }),
      }).catch(() => {});
      onSelectItem(item);
    },
    [apiBaseUrl, onSelectItem]
  );

  const handleSimulateConversion = useCallback(
    (type: 'add_to_cart' | 'purchase', item: CatalogItem) => {
      if (type === 'add_to_cart') setDemoCartCount((c) => c + 1);
      if (type === 'purchase') setDemoPurchasesCount((c) => c + 1);
      void fetch(`${apiBaseUrl}/v1/analytics/funnel/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, itemId: String(item.id), sessionId: 'demo-session' }),
      }).catch(() => {});
    },
    [apiBaseUrl]
  );

  if (isLoadingDemo) {
    return (
      <div
        data-testid="demo-mode-loading"
        className="rounded-xl bg-[#1e293b] border border-slate-700 p-8 text-center text-sm text-[#f1f5f9]"
      >
        Загрузка полного демо-каталога EIDOS и инициализация HNSW + BM25...
      </div>
    );
  }

  const ctrPct = Math.min(100, Math.round((demoClicksCount / Math.max(1, demoSearchesCount)) * 100));
  const crPct = Math.min(100, Math.round((demoPurchasesCount / Math.max(1, demoSearchesCount)) * 100));

  return (
    <div data-testid="isolated-demo-mode" className="space-y-5">
      {loadError && (
        <div className="rounded-lg bg-amber-950/50 border border-amber-700/60 px-4 py-2 text-xs text-amber-200">
          {loadError}
        </div>
      )}

      {/* Панель переключения сегментов полного демо-каталога и живых метрик движка */}
      <div className="rounded-xl bg-[#1e293b] border border-slate-700 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/80 pb-3.5">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-indigo-400">
              EIDOS Live Demo Telemetry · Все функции и метрики движка
            </div>
            <h2 className="text-base font-bold text-[#f1f5f9] mt-0.5">
              Полный демонстрационный каталог ({engineTelemetry.totalSku.toLocaleString()} SKU в активном индексе)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all' as const, label: `Весь каталог (${FULL_DEMO_CATALOG.length} SKU)` },
              { id: 'marketplace' as const, label: '🛍️ Маркетплейс (18)' },
              { id: 'streaming' as const, label: '🎬 Стриминг EN (12)' },
              { id: 'video_jp' as const, label: '🇯🇵 Видео JP (14)' },
              { id: 'global_multilingual' as const, label: '🌐 6 языков (12)' },
              { id: 'scaled_1200' as const, label: '🚀 HNSW Стресс-тест (1 200 SKU)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveScope(tab.id)}
                data-testid={`demo-scope-${tab.id}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeScope === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#0f172a] text-slate-300 border border-slate-700 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Сетка ключевых метрик работы движка */}
        <div
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3"
          data-testid="demo-live-metrics-grid"
        >
          <div className="rounded-lg bg-[#0f172a] border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">Индекс HNSW + BM25</div>
            <div className="text-lg font-bold font-mono text-[#f1f5f9] mt-0.5">
              {engineTelemetry.totalSku.toLocaleString()} SKU
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5">
              384-d L2 · {engineTelemetry.uniqueCategories} категорий
            </div>
          </div>

          <div className="rounded-lg bg-[#0f172a] border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">Латентность поиска</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {lastQueryLatencyMs} ms
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              HNSW ANN: {engineTelemetry.hnswLatencyMs} ms
            </div>
          </div>

          <div className="rounded-lg bg-[#0f172a] border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">Ускорение HNSW vs Scan</div>
            <div className="text-lg font-bold font-mono text-indigo-400 mt-0.5">
              {engineTelemetry.speedup}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Recall@10: {engineTelemetry.recallTopK}% · {engineTelemetry.qpsHnsw.toLocaleString()} QPS
            </div>
          </div>

          <div className="rounded-lg bg-[#0f172a] border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">Энтропия Шеннона H(X)</div>
            <div className="text-lg font-bold font-mono text-amber-300 mt-0.5">
              {engineTelemetry.entropyBits} бит
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Разнообразие: {engineTelemetry.normalizedDiversityPct}%
            </div>
          </div>

          <div className="rounded-lg bg-[#0f172a] border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">Воронка (Поиски → Клики)</div>
            <div className="text-lg font-bold font-mono text-[#f1f5f9] mt-0.5">
              {demoSearchesCount} → {demoClicksCount}
            </div>
            <div className="text-[11px] text-indigo-300 mt-0.5">Search CTR: {ctrPct}%</div>
          </div>

          <div className="rounded-lg bg-[#0f172a] border border-slate-800 p-3">
            <div className="text-[11px] text-slate-400">Конверсия (Корзина → Заказ)</div>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
              {demoCartCount} → {demoPurchasesCount}
            </div>
            <div className="text-[11px] text-emerald-300 mt-0.5">Conversion CR: {crPct}%</div>
          </div>
        </div>

        {/* Живая панель персональных рекомендаций (MMR + 384-d) для выбранного демо-товара */}
        {inspectedDemoItem && demoRecommendations.length > 0 && (
          <div className="rounded-lg bg-[#0f172a] border border-slate-800 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="text-xs text-slate-300">
                <span className="font-semibold text-indigo-300">
                  Живые рекомендации движка (384-d Cosine + MMR):
                </span>{' '}
                для «{inspectedDemoItem.title}» ({inspectedDemoItem.category})
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSimulateConversion('add_to_cart', inspectedDemoItem)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 cursor-pointer"
                >
                  + В корзину (тест воронки)
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateConversion('purchase', inspectedDemoItem)}
                  className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-[11px] text-white cursor-pointer"
                >
                  ✓ Оформить покупку (тест CR)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {demoRecommendations.map((rec) => (
                <div
                  key={rec.item.id}
                  onClick={() => handleSelectDemoCard(rec.item)}
                  className="rounded-lg bg-[#1e293b] border border-slate-700/80 hover:border-indigo-500/60 p-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-1 text-xs font-semibold text-[#f1f5f9] truncate">
                    <span className="truncate">
                      {rec.item.icon || '📦'} {rec.item.title}
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400 shrink-0">
                      {(rec.mmrScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {rec.item.category} · {rec.item.price || '—'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">{rec.reason}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Полный поисковый интерфейс с X-Ray Query Inspector, 2D-радаром и биометрией */}
      <SearchView
        catalog={activeCatalog}
        onHybridSearch={handleDemoHybridSearch}
        onSelectItem={handleSelectDemoCard}
        onInspectIn3D={onInspectIn3D}
        uiLang={uiLang}
        embeddingState={embeddingState}
      />
    </div>
  );
};
