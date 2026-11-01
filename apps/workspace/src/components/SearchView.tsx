import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Sliders, Columns, Globe, ShieldCheck, Cpu, RotateCcw, Eye, Scale } from 'lucide-react';
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem } from '../types';
import { HybridSearchHit, simulateKeywordSearch, detectTextLanguage } from '../utils/recommenderEngine';
import { trackEvent } from '../lib/analytics/tracker';
import { EmbeddingEngineState } from '../lib/embeddings';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';
import { SearchResultsColumns } from './search/SearchResultsColumns';
import { IntentVectorSynthesizer } from './search/IntentVectorSynthesizer';
import { KineticBiometricsHUD } from './search/KineticBiometricsHUD';
import { VectorScenarioAndExportBar, SearchComplexityLevel } from './search/VectorScenarioAndExportBar';
import { QueryInspector } from './QueryInspector';
import { WidgetLivePreviewModal } from '../pages/DemoPage/components/WidgetLivePreviewModal';
import { StorefrontBenchmarkModal } from '../pages/DemoPage/components/StorefrontBenchmarkModal';
import { useSearchCognitiveState, getSampleQueriesForLang } from '../hooks/useSearchCognitiveState';
import { subscribeSynonyms } from '../data/industrySynonyms';

interface SearchViewProps {
  catalog: CatalogItem[];
  onHybridSearch: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onSelectItem: (item: CatalogItem) => void;
  onInspectIn3D: (item: CatalogItem) => void;
  uiLang?: UiLanguage;
  embeddingState?: EmbeddingEngineState;
  defaultComplexity?: SearchComplexityLevel;
}

export const SearchView: React.FC<SearchViewProps> = ({
  catalog,
  onHybridSearch,
  onSelectItem,
  onInspectIn3D,
  uiLang = 'ru',
  embeddingState,
  defaultComplexity = 'simple',
}) => {
  const t = UI_TRANSLATIONS[uiLang].search;
  const dominantLang = useMemo(() => {
    const sample = catalog.slice(0, 4).map((i) => `${i.title} ${i.description}`).join(' ');
    return detectTextLanguage(sample);
  }, [catalog]);
  const sampleQueries = useMemo(() => getSampleQueriesForLang(dominantLang, catalog, uiLang), [dominantLang, catalog, uiLang]);

  const [query, setQuery] = useState(sampleQueries[0]?.label || '');
  const [alpha, setAlpha] = useState<number>(0.7);
  const [compareMode, setCompareMode] = useState<boolean>(true);
  const [showXray, setShowXray] = useState<boolean>(true);
  const [complexityLevel, setComplexityLevel] = useState<SearchComplexityLevel>(defaultComplexity);
  const [wowTourActive, setWowTourActive] = useState<boolean>(false);
  const [baseHybridHits, setBaseHybridHits] = useState<HybridSearchHit[]>([]);
  const [keywordHits, setKeywordHits] = useState<Array<{ item: CatalogItem; matchedWords: string[] }>>([]);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [cacheStatus, setCacheStatus] = useState<'HIT' | 'MISS'>('MISS');
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [wasSanitized, setWasSanitized] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [showWidgetPreview, setShowWidgetPreview] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);

  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const clientCacheRef = useRef<Map<string, { hits: HybridSearchHit[]; kw: Array<{ item: CatalogItem; matchedWords: string[] }> }>>(new Map());

  const cog = useSearchCognitiveState(query, alpha, setAlpha, baseHybridHits, complexityLevel);

  const runSearch = async (targetQuery?: string, targetAlpha?: number) => {
    if (catalog.length === 0) {
      setBaseHybridHits([]); setKeywordHits([]); setLatencyMs(0);
      return;
    }
    const raw = (targetQuery ?? query).trim();
    const a = targetAlpha ?? alpha;
    if (targetAlpha !== undefined) setAlpha(targetAlpha);
    if (!raw) {
      setBaseHybridHits(catalog.slice(0, 8).map((item, idx) => ({
        item, fusedScore: Number((0.95 - idx * 0.03).toFixed(4)), denseScore: Number((0.95 - idx * 0.03).toFixed(4)),
        bm25Score: Number((0.9 - idx * 0.03).toFixed(4)), source: 'hybrid', retrievalMode: 'hybrid-384d',
        whyRecommended: 'Обзор загруженного каталога (введите запрос для ранжирования)',
      })));
      setKeywordHits(catalog.slice(0, 8).map((item) => ({ item, matchedWords: [] })));
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++requestSeqRef.current;

    cog.actionCountRef.current += 1;
    const scan = SecurityGuardrails.scanAndSanitize(raw);
    const q = scan.sanitizedInput || raw;
    setWasSanitized(!scan.isSafe);
    setSearchError(null);
    if (targetQuery !== undefined) setQuery(q);

    const cacheKey = `${catalog.length}:${catalog[0]?.id ?? ''}:${q.toLowerCase()}:${a.toFixed(2)}`;
    const cached = clientCacheRef.current.get(cacheKey);
    if (cached) {
      setBaseHybridHits(cached.hits); setKeywordHits(cached.kw);
      setLatencyMs(0.15); setCacheStatus('HIT'); setIsLoading(false);
      return;
    }

    setIsLoading(true); setCacheStatus('MISS');
    trackEvent({ type: 'search', query: q });

    const t0 = performance.now();
    try {
      const hits = await onHybridSearch(q, a, 12);
      if (controller.signal.aborted || seq !== requestSeqRef.current) return;
      const kw = simulateKeywordSearch(q, catalog);
      if (clientCacheRef.current.size > 64) {
        const firstKey = clientCacheRef.current.keys().next().value;
        if (firstKey) clientCacheRef.current.delete(firstKey);
      }
      clientCacheRef.current.set(cacheKey, { hits, kw });
      setBaseHybridHits(hits); setKeywordHits(kw);
      setLatencyMs(Math.round((performance.now() - t0) * 100) / 100);
      hits.slice(0, 4).forEach((h) => trackEvent({ type: 'item_view', itemId: h.item.id, category: h.item.category }));
    } catch {
      if (controller.signal.aborted || seq !== requestSeqRef.current) return;
      setSearchError(uiLang === 'ru' ? 'Не удалось выполнить поиск. Попробуйте ещё раз.' : 'Search request failed. Please retry.');
    } finally {
      if (seq === requestSeqRef.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    clientCacheRef.current.clear();
    const defaultQ = sampleQueries[0]?.label || '';
    setQuery(defaultQ);
    void runSearch(defaultQ, alpha);
  }, [dominantLang, catalog[0]?.id, catalog.length, sampleQueries[0]?.label]);

  useEffect(() => {
    const timer = setTimeout(() => { void runSearch(query, alpha); }, 250);
    return () => clearTimeout(timer);
  }, [query, alpha]);

  useEffect(() => subscribeSynonyms(() => {
    clientCacheRef.current.clear();
    void runSearch(query, alpha);
  }), [query, alpha]);

  const handlePinItem = (id: string) => setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));
  const handleHideItem = (id: string) => {
    setHiddenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setPinnedIds((prev) => prev.filter((x) => x !== id));
  };

  const merchandisedHits = useMemo(() => {
    const visible = cog.hybridHits.filter((h) => !hiddenIds.includes(String(h.item.id)));
    if (pinnedIds.length === 0) return visible.slice(0, 8);
    const pinned: HybridSearchHit[] = [];
    const rest: HybridSearchHit[] = [];
    for (const h of visible) {
      if (pinnedIds.includes(String(h.item.id))) {
        pinned.push({ ...h, fusedScore: 0.999, whyRecommended: `📌 Закреплён мерчандайзером в ТОП-1 · ${h.whyRecommended}` });
      } else {
        rest.push(h);
      }
    }
    return [...pinned, ...rest].slice(0, 8);
  }, [cog.hybridHits, pinnedIds, hiddenIds]);

  const handleTriggerWowMoment = () => {
    const wowQuery = sampleQueries[0]?.label || 'недорогие наушники для бега';
    setShowXray(true); setCompareMode(true); setWowTourActive(true);
    cog.setDisableIntentBoost(false); cog.setDisableMmrPenalty(false);
    cog.applyScenarioPreset('intent_budget'); void runSearch(wowQuery, 0.65);
  };

  const handleResetZeroResults = () => {
    cog.setDisableIntentBoost(false); cog.setDisableMmrPenalty(false);
    setPinnedIds([]); setHiddenIds([]);
    void runSearch(sampleQueries[0]?.label || 'недорогие наушники для бега', 0.7);
  };

  const modelStatusLabel =
    embeddingState?.status === 'ready'
      ? 'ONNX Neural Ready (384-d WASM)'
      : embeddingState?.status === 'loading-model'
      ? `ONNX Loading (${embeddingState.progress}%) · Hybrid Anchor + BM25 Active`
      : 'Local 384-d Anchor + BM25 Lexical Active';

  return (
    <div className="page">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-sub">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" data-testid="open-widget-preview-btn" onClick={() => setShowWidgetPreview(true)} className="btn btn-primary btn-sm">
            <Eye size={13} /><span>{uiLang === 'ru' ? '👁 Виджет на сайте' : '👁 Storefront Widget'}</span>
          </button>
          <button type="button" data-testid="open-benchmark-modal-btn" onClick={() => setShowBenchmarkModal(true)} className="btn btn-secondary btn-sm">
            <Scale size={13} /><span>{uiLang === 'ru' ? '⚖️ Было vs Стало + Синонимы' : '⚖️ Benchmark & Synonyms'}</span>
          </button>
          <span data-testid="embedding-status-badge" className={`badge ${embeddingState?.status === 'ready' ? 'badge-success' : 'badge-warning'}`}>
            <Cpu size={12} /><span>{modelStatusLabel}</span>
          </span>
          <span className="badge badge-accent">
            <Globe size={12} /><span>{t.corpusScript} {dominantLang.toUpperCase()}</span>
          </span>
          <button type="button" data-testid="toggle-search-xray" onClick={() => setShowXray((v) => !v)} className={showXray ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
            <span>{showXray ? 'X-Ray Formula: ON' : 'X-Ray Formula: OFF'}</span>
          </button>
          <button type="button" onClick={() => setCompareMode((v) => !v)} className={compareMode ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
            <Columns size={14} /><span>{compareMode ? t.sideBySideOn : t.sideBySideOff}</span>
          </button>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); void runSearch(); }} className="flex gap-2.5 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-[var(--text-sec)]" />
            <input data-testid="search-input" className="input pl-10 h-[42px] text-[0.9375rem]" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.placeholder} />
          </div>
          <button type="submit" data-testid="search-submit-btn" className="btn btn-primary h-[42px]" disabled={isLoading || !query.trim()}>
            {isLoading ? t.searchingBtn : t.executeBtn}
          </button>
        </form>

        {(pinnedIds.length > 0 || hiddenIds.length > 0) && (
          <div data-testid="active-merch-rules-bar" className="flex items-center justify-between gap-2 px-3 py-2 mb-3 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs">
            <span>📌 Активные правила мерчандайзинга: закреплено {pinnedIds.length}, скрыто {hiddenIds.length}</span>
            <button type="button" data-testid="reset-merch-rules-btn" onClick={() => { setPinnedIds([]); setHiddenIds([]); }} className="btn btn-secondary btn-sm">Сбросить правила</button>
          </div>
        )}

        {isLoading && <div data-testid="search-loading-skeleton" className="text-xs text-[var(--accent)] mb-2 animate-pulse">Выполняется гибридный поиск (384-d + BM25)...</div>}

        {searchError && (
          <div data-testid="search-error-banner" className="flex items-center justify-between gap-2 p-2.5 mb-3 rounded bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-xs text-[var(--danger)]">
            <span>{searchError}</span>
            <button type="button" data-testid="search-error-retry" onClick={() => void runSearch()} className="btn btn-secondary btn-sm"><RotateCcw size={12} /><span>Повторить</span></button>
          </div>
        )}

        {wasSanitized && <div className="badge badge-success mb-3"><ShieldCheck size={14} /><span>{t.securityFilteredBadge}</span></div>}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3.5 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--text-sec)]">{t.modePreset}</span>
            {[{ label: 'Pure BM25 (α=0.0)', val: 0.0 }, { label: 'Balanced Hybrid (α=0.5)', val: 0.5 }, { label: 'Semantic Heavy (α=0.7)', val: 0.7 }, { label: 'Pure 384-d Vector (α=1.0)', val: 1.0 }].map((p) => (
              <button key={p.label} type="button" onClick={() => setAlpha(p.val)} className={Math.abs(alpha - p.val) < 0.02 ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>{p.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-2.5 min-w-[260px]">
            <Sliders size={14} className="text-[var(--text-sec)]" /><span className="text-xs text-[var(--text-sec)]">{t.alphaWeight}</span>
            <input type="range" min={0} max={1} step={0.05} value={alpha} onChange={(e) => setAlpha(parseFloat(e.target.value))} className="flex-1 accent-[var(--accent)]" />
            <span className="mono text-xs font-bold text-[var(--accent)]">{alpha.toFixed(2)}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-sec)]">{t.testQueries}</span>
          {sampleQueries.map((sq) => <button key={sq.label} type="button" data-testid="sample-query-chip" onClick={() => void runSearch(sq.label)} className="btn btn-secondary btn-sm" title={sq.note}>{sq.label}</button>)}
        </div>
      </div>

      <VectorScenarioAndExportBar query={query} alpha={alpha} effectiveAlpha={cog.effectiveAlpha} radarCoords={cog.radarCoords} simulatedHour={cog.simulatedHour} activeScenarioId={cog.activeScenarioId} stageTimingsMs={cog.stageTimingsMs} retrievalLatencyMs={latencyMs} uiLang={uiLang} cacheStatus={cacheStatus} complexityLevel={complexityLevel} onChangeComplexityLevel={setComplexityLevel} disableIntentBoost={cog.disableIntentBoost} onToggleDisableIntentBoost={() => cog.setDisableIntentBoost((v) => !v)} disableMmrPenalty={cog.disableMmrPenalty} onToggleDisableMmrPenalty={() => cog.setDisableMmrPenalty((v) => !v)} wowTourActive={wowTourActive} onTriggerWowMoment={handleTriggerWowMoment} onSelectScenario={(scId) => { const nextQ = cog.applyScenarioPreset(scId); if (nextQ) void runSearch(nextQ); }} />

      {showXray && <QueryInspector query={query} results={cog.inspectorResults} latencyMs={latencyMs} extractedIntent={cog.extractedIntent} defaultMode={complexityLevel === 'simple' ? 'simple' : 'full'} highlightedResultId={wowTourActive ? '__first__' : null} />}

      {complexityLevel !== 'simple' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
          <IntentVectorSynthesizer coordinates={cog.radarCoords} onChangeCoordinates={cog.setRadarCoords} serendipityActiveCount={cog.hybridHits.filter((h) => h.isSerendipityDiscovery).length} effectiveAlpha={cog.effectiveAlpha} uiLang={uiLang} />
          {complexityLevel === 'expert' && <KineticBiometricsHUD kineticProfile={cog.kineticProfile} chronoProfile={cog.chronoProfile} routeDecision={cog.routeDecision} paretoReport={cog.paretoReport} scrollVelocityPxPerSec={cog.scrollVelocityPxPerSec} comparisonAlternations={cog.comparisonAlternations} priceHoverCount={cog.priceHoverCount} simulatedHour={cog.simulatedHour} onChangeSimulatedHour={cog.setSimulatedHour} onSimulateArchetype={cog.handleSimulateArchetype} onApplyParetoSolution={cog.handleApplyParetoSolution} uiLang={uiLang} />}
        </div>
      )}

      <SearchResultsColumns compareMode={compareMode} showXray={showXray} hybridHits={merchandisedHits} keywordHits={keywordHits} latencyMs={latencyMs} alpha={cog.effectiveAlpha} query={query} uiLang={uiLang} suggestedQueries={sampleQueries.map((s) => s.label)} onRetryQuery={(nextQ, nextA) => void runSearch(nextQ, nextA)} onResetFilters={handleResetZeroResults} t={t} onSelectItem={onSelectItem} onInspectIn3D={onInspectIn3D} onCardHoverStart={cog.handleCardHoverStart} onCardHoverEnd={cog.handleCardHoverEnd} onPriceHover={cog.handlePriceHover} pinnedIds={pinnedIds} onPinItem={handlePinItem} onHideItem={handleHideItem} />
      <WidgetLivePreviewModal isOpen={showWidgetPreview} onClose={() => setShowWidgetPreview(false)} catalog={catalog} onHybridSearch={onHybridSearch} onSelectItem={onSelectItem} initialQuery={query} uiLang={uiLang} />
      <StorefrontBenchmarkModal isOpen={showBenchmarkModal} onClose={() => setShowBenchmarkModal(false)} catalog={catalog} onHybridSearch={onHybridSearch} onRunQueryInStudio={(q) => void runSearch(q)} uiLang={uiLang} />
    </div>
  );
};
