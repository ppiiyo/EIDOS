import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Search,
  Lightbulb,
  Boxes,
  Package,
  ShoppingCart,
  CheckCircle2,
  Cpu,
} from 'lucide-react';
import { CatalogItem, CatalogRecommendation, MerchandisingRules } from '../../../types';
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
import { RecommendationsView } from '../../../components/RecommendationsView';
import { VectorSpaceView } from '../../../components/VectorSpaceView';
import { CatalogTable } from '../../../components/catalog/CatalogTable';

export type DemoPresetScope =
  | 'all'
  | 'marketplace'
  | 'streaming'
  | 'video_jp'
  | 'global_multilingual'
  | 'scaled_1200';

export type DemoEngineSubView = 'search' | 'recommendations' | 'vectorspace' | 'catalog';

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
  const [subView, setSubView] = useState<DemoEngineSubView>('search');
  const [inspectedDemoItem, setInspectedDemoItem] = useState<CatalogItem | null>(
    FULL_DEMO_CATALOG[0] || DEFAULT_CATALOG[0] || null
  );

  // Живые метрики воронки и производительности в демо-режиме
  const [demoSearchesCount, setDemoSearchesCount] = useState(18);
  const [demoClicksCount, setDemoClicksCount] = useState(11);
  const [demoCartCount, setDemoCartCount] = useState(5);
  const [demoPurchasesCount, setDemoPurchasesCount] = useState(3);
  const [lastQueryLatencyMs, setLastQueryLatencyMs] = useState(1.4);

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
        // Автономная работа на полном клиентском HNSW + BM25 индексе
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

  useEffect(() => {
    if (activeCatalog.length > 0) {
      setInspectedDemoItem((prev) =>
        prev && activeCatalog.some((i) => String(i.id) === String(prev.id))
          ? prev
          : activeCatalog[0]
      );
    }
  }, [activeCatalog]);

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

  const computeDemoRecommendations = useCallback(
    (
      itemId: string,
      diversityLambda = 0.35,
      limit = 6,
      rules?: MerchandisingRules
    ): CatalogRecommendation[] => {
      const target =
        activeCatalog.find((c) => String(c.id) === String(itemId)) || activeCatalog[0];
      if (!target) return [];
      const targetVec = activeEmbeddings.get(String(target.id));
      if (!targetVec) return [];

      const excludedSet = new Set((rules?.excludedIds || []).map(String));
      const pinnedSet = new Set((rules?.pinnedIds || []).map(String));
      const boostCat =
        rules?.boostCategory && rules.boostCategory !== 'none' ? rules.boostCategory : null;
      const boostFactor = rules?.boostFactor ?? 1.0;
      const crossCatOnly = Boolean(rules?.crossCategoryOnly);
      const minRating = rules?.minRating ?? 0;

      const wSem = rules?.semanticWeight ?? 0.55;
      const wPop = rules?.popularityWeight ?? 0.2;
      const wFresh = rules?.freshnessWeight ?? 0.15;
      const wMargin = rules?.marginWeight ?? 0.1;
      const totalW = Math.max(0.01, wSem + wPop + wFresh + wMargin);

      return activeCatalog
        .filter((item) => {
          const idStr = String(item.id);
          if (idStr === String(target.id) || excludedSet.has(idStr)) return false;
          if (crossCatOnly && item.category === target.category) return false;
          if (minRating > 0 && (item.rating ?? 5.0) < minRating) return false;
          return activeEmbeddings.has(idStr);
        })
        .map((item, idx) => {
          const vec = activeEmbeddings.get(String(item.id))!;
          const sim = Math.max(0, cosineSimilarity(targetVec, vec));
          const isPinned = pinnedSet.has(String(item.id));
          const isBoosted = Boolean(boostCat && item.category === boostCat);
          const crossBonus = item.category !== target.category ? diversityLambda * 0.18 : 0;

          const semC = (wSem / totalW) * sim;
          const popC = (wPop / totalW) * 0.82;
          const freshC = (wFresh / totalW) * 0.76;
          const margC = (wMargin / totalW) * 0.72;
          const rawScore = semC + popC + freshC + margC + crossBonus;
          const mmrScore = isPinned
            ? 0.999
            : Math.min(0.99, isBoosted ? rawScore * boostFactor : rawScore);

          return {
            item,
            sim: Number(sim.toFixed(4)),
            mmrScore: Number(mmrScore.toFixed(4)),
            noveltyBonus: Number((item.category !== target.category ? 0.85 : 0.45).toFixed(2)),
            rank: idx + 1,
            isPinned,
            isBoosted,
            whyRecommended: generateSemanticExplanation(target, item),
            featureBreakdown: {
              semanticContribution: Number(semC.toFixed(4)),
              popularityContribution: Number(popC.toFixed(4)),
              freshnessContribution: Number(freshC.toFixed(4)),
              marginContribution: Number(margC.toFixed(4)),
              noveltyContribution: Number(crossBonus.toFixed(4)),
              compositeScore: Number(mmrScore.toFixed(4)),
            },
          };
        })
        .sort((a, b) => b.mmrScore - a.mmrScore)
        .slice(0, limit)
        .map((r, i) => ({ ...r, rank: i + 1 }));
    },
    [activeCatalog, activeEmbeddings]
  );

  const demoRecommendations = useMemo(() => {
    const target = inspectedDemoItem || activeCatalog[0];
    if (!target) return [];
    return computeDemoRecommendations(String(target.id), 0.35, 4);
  }, [inspectedDemoItem, activeCatalog, computeDemoRecommendations]);

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
      setSubView('recommendations');
    },
    [apiBaseUrl]
  );

  const handleInspectDemo3D = useCallback(
    (item: CatalogItem) => {
      setInspectedDemoItem(item);
      setSubView('vectorspace');
    },
    []
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
      <div className="page">
        <div
          data-testid="demo-mode-loading"
          className="card p-8 text-center text-sm text-[var(--text-sec)]"
        >
          Загрузка полного демо-каталога EIDOS (48 SKU) и инициализация HNSW + BM25...
        </div>
      </div>
    );
  }

  const ctrPct = Math.min(100, Math.round((demoClicksCount / Math.max(1, demoSearchesCount)) * 100));
  const crPct = Math.min(100, Math.round((demoPurchasesCount / Math.max(1, demoSearchesCount)) * 100));

  return (
    <div data-testid="isolated-demo-mode">
      <div className="max-w-[1280px] mx-auto px-6 pt-4 space-y-4">
        {loadError && (
          <div className="card px-4 py-2.5 text-xs text-[var(--warning)] border-[var(--warning)]/40 bg-[var(--warning-bg)]">
            {loadError}
          </div>
        )}

        {/* Главная панель управления демо-каталогом и живой телеметрии движка */}
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[var(--border)]">
            <div>
              <div className="flex items-center gap-2">
                <span className="badge badge-accent mono">
                  <Cpu size={12} />
                  <span>DEMO SHOWCASE · 48 SKU</span>
                </span>
                <span className="text-xs text-[var(--text-sec)]">
                  Все функции, метрики и векторы на полном демо-корпусе
                </span>
              </div>
              <h2 className="text-base font-bold text-[var(--text)] mt-1">
                Полный демонстрационный каталог EIDOS ({engineTelemetry.totalSku.toLocaleString()} SKU в активном 384-d HNSW индексе)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all' as const, label: `Весь каталог (${FULL_DEMO_CATALOG.length} SKU)` },
                { id: 'marketplace' as const, label: '🛍️ Маркетплейс (18)' },
                { id: 'streaming' as const, label: '🎬 Стриминг EN (12)' },
                { id: 'video_jp' as const, label: '🇯🇵 Видео JP (14)' },
                { id: 'global_multilingual' as const, label: '🌐 6 языков (12)' },
                { id: 'scaled_1200' as const, label: '🚀 HNSW 1 200 SKU' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveScope(tab.id)}
                  data-testid={`demo-scope-${tab.id}`}
                  className={
                    activeScope === tab.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6 карточек живой телеметрии движка и поисковой воронки */}
          <div
            className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3"
            data-testid="demo-live-metrics-grid"
          >
            <div className="card p-3 bg-[var(--bg-alt)]">
              <div className="text-[11px] font-medium text-[var(--text-sec)]">Индекс HNSW + BM25</div>
              <div className="text-lg font-bold mono text-[var(--text)] mt-0.5">
                {engineTelemetry.totalSku.toLocaleString()} SKU
              </div>
              <div className="text-[11px] text-[var(--success)] mt-0.5">
                384-d L2 · {engineTelemetry.uniqueCategories} категорий
              </div>
            </div>

            <div className="card p-3 bg-[var(--bg-alt)]">
              <div className="text-[11px] font-medium text-[var(--text-sec)]">Латентность поиска</div>
              <div className="text-lg font-bold mono text-[var(--success)] mt-0.5">
                {lastQueryLatencyMs} ms
              </div>
              <div className="text-[11px] text-[var(--text-sec)] mt-0.5">
                HNSW ANN: {engineTelemetry.hnswLatencyMs} ms
              </div>
            </div>

            <div className="card p-3 bg-[var(--bg-alt)]">
              <div className="text-[11px] font-medium text-[var(--text-sec)]">HNSW vs Linear Scan</div>
              <div className="text-lg font-bold mono text-[var(--accent)] mt-0.5">
                {engineTelemetry.speedup}
              </div>
              <div className="text-[11px] text-[var(--text-sec)] mt-0.5">
                Recall@10: {engineTelemetry.recallTopK}% · {engineTelemetry.qpsHnsw.toLocaleString()} QPS
              </div>
            </div>

            <div className="card p-3 bg-[var(--bg-alt)]">
              <div className="text-[11px] font-medium text-[var(--text-sec)]">Энтропия Шеннона H(X)</div>
              <div className="text-lg font-bold mono text-[var(--warning)] mt-0.5">
                {engineTelemetry.entropyBits} бит
              </div>
              <div className="text-[11px] text-[var(--text-sec)] mt-0.5">
                Разнообразие: {engineTelemetry.normalizedDiversityPct}%
              </div>
            </div>

            <div className="card p-3 bg-[var(--bg-alt)]">
              <div className="text-[11px] font-medium text-[var(--text-sec)]">Воронка (Поиски → Клики)</div>
              <div className="text-lg font-bold mono text-[var(--text)] mt-0.5">
                {demoSearchesCount} → {demoClicksCount}
              </div>
              <div className="text-[11px] text-[var(--accent)] mt-0.5">Search CTR: {ctrPct}%</div>
            </div>

            <div className="card p-3 bg-[var(--bg-alt)]">
              <div className="text-[11px] font-medium text-[var(--text-sec)]">Конверсия (Корзина → Заказ)</div>
              <div className="text-lg font-bold mono text-[var(--success)] mt-0.5">
                {demoCartCount} → {demoPurchasesCount}
              </div>
              <div className="text-[11px] text-[var(--success)] mt-0.5">Conversion CR: {crPct}%</div>
            </div>
          </div>

          {/* Быстрый блок персональных рекомендаций (384-d + MMR) и теста воронки */}
          {inspectedDemoItem && demoRecommendations.length > 0 && (
            <div className="card p-3.5 bg-[var(--bg-alt)]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="text-xs text-[var(--text-sec)]">
                  <strong className="text-[var(--accent)]">
                    Живые рекомендации 384-d Cosine + MMR:
                  </strong>{' '}
                  якорь «{inspectedDemoItem.title}» ({inspectedDemoItem.category})
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSimulateConversion('add_to_cart', inspectedDemoItem)}
                    className="btn btn-secondary btn-sm"
                  >
                    <ShoppingCart size={12} />
                    <span>+ В корзину (тест воронки)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSimulateConversion('purchase', inspectedDemoItem)}
                    className="btn btn-primary btn-sm"
                  >
                    <CheckCircle2 size={12} />
                    <span>Оформить заказ (тест CR)</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {demoRecommendations.map((rec) => (
                  <div
                    key={rec.item.id}
                    onClick={() => {
                      setInspectedDemoItem(rec.item);
                      setDemoClicksCount((c) => c + 1);
                    }}
                    className="card p-2.5 cursor-pointer hover:border-[var(--accent)] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1 text-xs font-semibold text-[var(--text)] truncate">
                      <span className="truncate">
                        {rec.item.icon || '📦'} {rec.item.title}
                      </span>
                      <span className="mono text-[11px] text-[var(--success)] shrink-0">
                        {(rec.mmrScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-sec)] mt-0.5 truncate">
                      {rec.item.category} · {rec.item.price || '—'}
                    </div>
                    <div className="text-[10px] text-[var(--text-mut)] mt-1 line-clamp-1">
                      {rec.whyRecommended}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Переключатель режимов исследования демо-каталога */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
            <span className="text-xs font-semibold text-[var(--text-sec)]">
              Инструменты движка на демо-каталоге:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'search' as const, label: '🔍 Поиск + X-Ray + 3 Вектора', icon: Search },
                { id: 'recommendations' as const, label: '✨ Рекомендации MMR', icon: Lightbulb },
                { id: 'vectorspace' as const, label: '🌌 3D Векторы и Граф', icon: Boxes },
                {
                  id: 'catalog' as const,
                  label: `📦 Все товары демо (${activeCatalog.length} SKU)`,
                  icon: Package,
                },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`demo-subview-${m.id}`}
                    onClick={() => setSubView(m.id)}
                    className={
                      subView === m.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'
                    }
                  >
                    <Icon size={13} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Активный инструмент внутри вкладки Демо-каталога */}
      {subView === 'search' && (
        <SearchView
          catalog={activeCatalog}
          onHybridSearch={handleDemoHybridSearch}
          onSelectItem={handleSelectDemoCard}
          onInspectIn3D={handleInspectDemo3D}
          uiLang={uiLang}
          embeddingState={embeddingState}
        />
      )}

      {subView === 'recommendations' && (
        <RecommendationsView
          catalog={activeCatalog}
          embeddings={activeEmbeddings}
          selectedItem={inspectedDemoItem}
          onSelectItem={setInspectedDemoItem}
          onRecommend={computeDemoRecommendations}
          onInspectIn3D={handleInspectDemo3D}
          uiLang={uiLang}
        />
      )}

      {subView === 'vectorspace' && (
        <VectorSpaceView
          catalog={activeCatalog}
          embeddings={activeEmbeddings}
          selectedItem={inspectedDemoItem}
          onSelectItem={setInspectedDemoItem}
          onInspectRecommendations={handleSelectDemoCard}
          uiLang={uiLang}
        />
      )}

      {subView === 'catalog' && (
        <div className="page">
          <div className="mb-4">
            <h2 className="page-title">
              Полный список товаров демо-каталога ({activeCatalog.length} SKU)
            </h2>
            <p className="page-sub">
              Нажмите на любой товар, чтобы протестировать его в MMR-рекомендациях или 3D векторном пространстве
            </p>
          </div>
          <CatalogTable
            items={activeCatalog}
            embeddings={activeEmbeddings}
            onSelectItem={handleSelectDemoCard}
            onInspectIn3D={handleInspectDemo3D}
            onDeleteItem={() => {}}
          />
        </div>
      )}
    </div>
  );
};
