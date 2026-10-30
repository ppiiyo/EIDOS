import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Sliders, Columns, Globe, ShieldCheck, Cpu, RotateCcw } from 'lucide-react';
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
import { useSearchCognitiveState, getSampleQueriesForLang } from '../hooks/useSearchCognitiveState';

interface SearchViewProps {
  catalog: CatalogItem[];
  onHybridSearch: (query: string, alpha: number, limit?: number) => Promise<HybridSearchHit[]>;
  onSelectItem: (item: CatalogItem) => void;
  onInspectIn3D: (item: CatalogItem) => void;
  uiLang?: UiLanguage;
  embeddingState?: EmbeddingEngineState;
}

export const SearchView: React.FC<SearchViewProps> = ({
  catalog,
  onHybridSearch,
  onSelectItem,
  onInspectIn3D,
  uiLang = 'ru',
  embeddingState,
}) => {
  const t = UI_TRANSLATIONS[uiLang].search;
  const dominantLang = useMemo(() => {
    const sample = catalog.slice(0, 4).map((i) => `${i.title} ${i.description}`).join(' ');
    return detectTextLanguage(sample);
  }, [catalog]);
  const sampleQueries = useMemo(() => getSampleQueriesForLang(dominantLang, catalog), [dominantLang, catalog]);

  const [query, setQuery] = useState(sampleQueries[0]?.label || '');
  const [alpha, setAlpha] = useState<number>(0.7);
  const [compareMode, setCompareMode] = useState<boolean>(true);
  const [showXray, setShowXray] = useState<boolean>(true);
  const [complexityLevel, setComplexityLevel] = useState<SearchComplexityLevel>('expert');
  const [wowTourActive, setWowTourActive] = useState<boolean>(false);
  const [baseHybridHits, setBaseHybridHits] = useState<HybridSearchHit[]>([]);
  const [keywordHits, setKeywordHits] = useState<Array<{ item: CatalogItem; matchedWords: string[] }>>([]);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [cacheStatus, setCacheStatus] = useState<'HIT' | 'MISS'>('MISS');
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [wasSanitized, setWasSanitized] = useState(false);

  const requestSeqRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const clientCacheRef = useRef<Map<string, { hits: HybridSearchHit[]; kw: Array<{ item: CatalogItem; matchedWords: string[] }> }>>(new Map());

  const cog = useSearchCognitiveState(query, alpha, setAlpha, baseHybridHits);

  const runSearch = async (targetQuery?: string, targetAlpha?: number) => {
    if (catalog.length === 0) {
      setBaseHybridHits([]); setKeywordHits([]); setLatencyMs(0);
      return;
    }
    const raw = (targetQuery ?? query).trim();
    const a = targetAlpha ?? alpha;
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
  }, [dominantLang, catalog[0]?.id, catalog.length]);

  useEffect(() => {
    const timer = setTimeout(() => { void runSearch(query, alpha); }, 90);
    return () => clearTimeout(timer);
  }, [query, alpha]);

  const handleTriggerWowMoment = () => {
    const wowQuery = dominantLang === 'ru' ? 'недорогие наушники для бега' : 'wireless running headphones under $100';
    setShowXray(true);
    setWowTourActive(true);
    cog.setDisableIntentBoost(false);
    cog.setDisableMmrPenalty(false);
    const presetQ = cog.applyScenarioPreset('intent_budget') || wowQuery;
    void runSearch(presetQ, 0.65);
  };

  const modelStatusLabel =
    embeddingState?.status === 'ready'
      ? 'ONNX Neural Ready (384-d WASM)'
      : embeddingState?.status === 'loading-model'
      ? `ONNX Loading (${embeddingState.progress}%) · Hybrid Anchor + BM25 Active`
      : 'Local 384-d Anchor + BM25 Lexical Active';

  const serendipityActiveCount = cog.hybridHits.filter((h) => h.isSerendipityDiscovery).length;

  return (
    <div className="page">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-5">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-sub">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span data-testid="embedding-status-badge" className={`badge ${embeddingState?.status === 'ready' ? 'badge-success' : 'badge-warning'}`}>
            <Cpu size={12} />
            <span>{modelStatusLabel}</span>
          </span>
          <span className="badge badge-accent">
            <Globe size={12} />
            <span>{t.corpusScript} {dominantLang.toUpperCase()}</span>
          </span>
          <button type="button" data-testid="toggle-search-xray" onClick={() => setShowXray((v) => !v)} className={showXray ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
            <span>{showXray ? 'X-Ray Formula: ON' : 'X-Ray Formula: OFF'}</span>
          </button>
          <button type="button" onClick={() => setCompareMode((v) => !v)} className={compareMode ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
            <Columns size={14} />
            <span>{compareMode ? t.sideBySideOn : t.sideBySideOff}</span>
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

        {isLoading && (
          <div data-testid="search-loading-skeleton" className="text-xs text-[var(--accent)] mb-2 animate-pulse">
            {uiLang === 'ru' ? 'Выполняется гибридный поиск (384-d + BM25 + 3 вектора)...' : 'Running hybrid search (384-d + BM25 + 3 vectors)...'}
          </div>
        )}

        {searchError && (
          <div className="flex items-center justify-between gap-2 p-2.5 mb-3 rounded bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-xs text-[var(--danger)]">
            <span>{searchError}</span>
            <button type="button" data-testid="search-error-retry" onClick={() => void runSearch()} className="btn btn-secondary btn-sm">
              <RotateCcw size={12} />
              <span>{uiLang === 'ru' ? 'Повторить' : 'Retry'}</span>
            </button>
          </div>
        )}

        {wasSanitized && (
          <div className="badge badge-success mb-3">
            <ShieldCheck size={14} />
            <span>{t.securityFilteredBadge}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3.5 border-t border-[var(--border)]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--text-sec)]">{t.modePreset}</span>
            {[
              { label: 'Pure BM25 (α=0.0)', val: 0.0 },
              { label: 'Balanced Hybrid (α=0.5)', val: 0.5 },
              { label: 'Semantic Heavy (α=0.7)', val: 0.7 },
              { label: 'Pure 384-d Vector (α=1.0)', val: 1.0 },
            ].map((p) => (
              <button key={p.label} type="button" onClick={() => setAlpha(p.val)} className={Math.abs(alpha - p.val) < 0.02 ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}>
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 min-w-[260px]">
            <Sliders size={14} className="text-[var(--text-sec)]" />
            <span className="text-xs text-[var(--text-sec)]">{t.alphaWeight}</span>
            <input type="range" min={0} max={1} step={0.05} value={alpha} onChange={(e) => setAlpha(parseFloat(e.target.value))} className="flex-1 accent-[var(--accent)]" />
            <span className="mono text-xs font-bold text-[var(--accent)]">{alpha.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-sec)]">{t.testQueries}</span>
          {sampleQueries.map((sq) => (
            <button key={sq.label} type="button" onClick={() => void runSearch(sq.label)} className="btn btn-secondary btn-sm" title={sq.note}>
              {sq.label}
            </button>
          ))}
        </div>
      </div>

      <VectorScenarioAndExportBar
        query={query} alpha={alpha} effectiveAlpha={cog.effectiveAlpha}
        radarCoords={cog.radarCoords} simulatedHour={cog.simulatedHour}
        activeScenarioId={cog.activeScenarioId} stageTimingsMs={cog.stageTimingsMs}
        retrievalLatencyMs={latencyMs} uiLang={uiLang} cacheStatus={cacheStatus}
        complexityLevel={complexityLevel} onChangeComplexityLevel={setComplexityLevel}
        disableIntentBoost={cog.disableIntentBoost} onToggleDisableIntentBoost={() => cog.setDisableIntentBoost((v) => !v)}
        disableMmrPenalty={cog.disableMmrPenalty} onToggleDisableMmrPenalty={() => cog.setDisableMmrPenalty((v) => !v)}
        wowTourActive={wowTourActive} onTriggerWowMoment={handleTriggerWowMoment}
        onSelectScenario={(scId) => { const nextQ = cog.applyScenarioPreset(scId); if (nextQ) void runSearch(nextQ); }}
      />

      {showXray && (
        <QueryInspector
          query={query} results={cog.inspectorResults} latencyMs={latencyMs}
          extractedIntent={cog.extractedIntent} defaultMode={complexityLevel === 'simple' ? 'simple' : 'full'}
          highlightedResultId={wowTourActive ? '__first__' : null}
        />
      )}

      {complexityLevel !== 'simple' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
          <IntentVectorSynthesizer
            coordinates={cog.radarCoords} onChangeCoordinates={cog.setRadarCoords}
            serendipityActiveCount={serendipityActiveCount} effectiveAlpha={cog.effectiveAlpha} uiLang={uiLang}
          />
          {complexityLevel === 'expert' && (
            <KineticBiometricsHUD
              kineticProfile={cog.kineticProfile} chronoProfile={cog.chronoProfile}
              routeDecision={cog.routeDecision} paretoReport={cog.paretoReport}
              scrollVelocityPxPerSec={cog.scrollVelocityPxPerSec} comparisonAlternations={cog.comparisonAlternations}
              priceHoverCount={cog.priceHoverCount} simulatedHour={cog.simulatedHour}
              onChangeSimulatedHour={cog.setSimulatedHour} onSimulateArchetype={cog.handleSimulateArchetype}
              onApplyParetoSolution={cog.handleApplyParetoSolution} uiLang={uiLang}
            />
          )}
        </div>
      )}

      <SearchResultsColumns
        compareMode={compareMode} showXray={showXray}
        hybridHits={cog.hybridHits.slice(0, 8)} keywordHits={keywordHits}
        latencyMs={latencyMs} alpha={cog.effectiveAlpha} t={t}
        onSelectItem={onSelectItem} onInspectIn3D={onInspectIn3D}
        onCardHoverStart={cog.handleCardHoverStart} onCardHoverEnd={cog.handleCardHoverEnd} onPriceHover={cog.handlePriceHover}
      />
    </div>
  );
};
