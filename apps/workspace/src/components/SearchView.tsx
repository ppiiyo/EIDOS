import React, { useState, useEffect, useMemo } from 'react';
import { Search, Sliders, Columns, Globe, ShieldCheck, Cpu } from 'lucide-react';
import { SecurityGuardrails } from '@eidos/core';
import { CatalogItem } from '../types';
import { HybridSearchHit, simulateKeywordSearch, detectTextLanguage } from '../utils/recommenderEngine';
import { trackEvent } from '../lib/analytics/tracker';
import { EmbeddingEngineState } from '../lib/embeddings';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';
import { SearchResultsColumns } from './search/SearchResultsColumns';
import { IntentVectorSynthesizer } from './search/IntentVectorSynthesizer';
import { KineticBiometricsHUD } from './search/KineticBiometricsHUD';
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

  const sampleQueries = getSampleQueriesForLang(dominantLang);

  const [query, setQuery] = useState(sampleQueries[0].label);
  const [alpha, setAlpha] = useState<number>(0.7);
  const [compareMode, setCompareMode] = useState<boolean>(true);
  const [showXray, setShowXray] = useState<boolean>(true);
  const [baseHybridHits, setBaseHybridHits] = useState<HybridSearchHit[]>([]);
  const [keywordHits, setKeywordHits] = useState<Array<{ item: CatalogItem; matchedWords: string[] }>>([]);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [wasSanitized, setWasSanitized] = useState(false);

  const cog = useSearchCognitiveState(query, alpha, setAlpha, baseHybridHits);

  const runSearch = async (targetQuery?: string, targetAlpha?: number) => {
    const raw = (targetQuery ?? query).trim();
    const a = targetAlpha ?? alpha;
    if (!raw) return;

    cog.actionCountRef.current += 1;
    const scan = SecurityGuardrails.scanAndSanitize(raw);
    const q = scan.sanitizedInput || raw;
    setWasSanitized(!scan.isSafe);

    if (targetQuery !== undefined) setQuery(q);
    setIsLoading(true);
    trackEvent({ type: 'search', query: q });

    const t0 = performance.now();
    try {
      const hits = await onHybridSearch(q, a, 12);
      const kw = simulateKeywordSearch(q, catalog);
      setBaseHybridHits(hits);
      setKeywordHits(kw);
      setLatencyMs(Math.round((performance.now() - t0) * 100) / 100);
      hits.slice(0, 4).forEach((h) => {
        trackEvent({ type: 'item_view', itemId: h.item.id, category: h.item.category });
      });
    } catch {
      setBaseHybridHits([]);
      setKeywordHits([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const defaultQ = sampleQueries[0].label;
    setQuery(defaultQ);
    runSearch(defaultQ, alpha);
  }, [dominantLang, catalog[0]?.id]);

  useEffect(() => {
    runSearch(query, alpha);
  }, [alpha, catalog.length]);

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
          <span
            data-testid="embedding-status-badge"
            className={`badge ${embeddingState?.status === 'ready' ? 'badge-success' : 'badge-warning'}`}
          >
            <Cpu size={12} />
            <span>{modelStatusLabel}</span>
          </span>
          <span className="badge badge-accent">
            <Globe size={12} />
            <span>{t.corpusScript} {dominantLang.toUpperCase()}</span>
          </span>
          <button
            type="button"
            data-testid="toggle-search-xray"
            onClick={() => setShowXray((v) => !v)}
            className={showXray ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <span>{showXray ? 'X-Ray Formula: ON' : 'X-Ray Formula: OFF'}</span>
          </button>
          <button
            type="button"
            onClick={() => setCompareMode((v) => !v)}
            className={compareMode ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          >
            <Columns size={14} />
            <span>{compareMode ? t.sideBySideOn : t.sideBySideOff}</span>
          </button>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          className="flex gap-2.5 mb-4"
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-[var(--text-sec)]" />
            <input
              data-testid="search-input"
              className="input pl-10 h-[42px] text-[0.9375rem]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.placeholder}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary h-[42px]"
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? t.searchingBtn : t.executeBtn}
          </button>
        </form>

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
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setAlpha(preset.val)}
                className={Math.abs(alpha - preset.val) < 0.02 ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 min-w-[260px]">
            <Sliders size={14} className="text-[var(--text-sec)]" />
            <span className="text-xs text-[var(--text-sec)]">{t.alphaWeight}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="mono text-xs font-bold text-[var(--accent)]">{alpha.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-sec)]">{t.testQueries}</span>
          {sampleQueries.map((sq) => (
            <button
              key={sq.label}
              type="button"
              onClick={() => runSearch(sq.label)}
              className="btn btn-secondary btn-sm"
              title={sq.note}
            >
              {sq.label}
            </button>
          ))}
        </div>
      </div>

      {showXray && (
        <QueryInspector
          query={query}
          results={cog.inspectorResults}
          latencyMs={latencyMs}
          extractedIntent={cog.extractedIntent}
        />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <IntentVectorSynthesizer
          coordinates={cog.radarCoords}
          onChangeCoordinates={cog.setRadarCoords}
          serendipityActiveCount={serendipityActiveCount}
          effectiveAlpha={cog.effectiveAlpha}
          uiLang={uiLang}
        />

        <KineticBiometricsHUD
          kineticProfile={cog.kineticProfile}
          chronoProfile={cog.chronoProfile}
          routeDecision={cog.routeDecision}
          paretoReport={cog.paretoReport}
          scrollVelocityPxPerSec={cog.scrollVelocityPxPerSec}
          comparisonAlternations={cog.comparisonAlternations}
          priceHoverCount={cog.priceHoverCount}
          simulatedHour={cog.simulatedHour}
          onChangeSimulatedHour={cog.setSimulatedHour}
          onSimulateArchetype={cog.handleSimulateArchetype}
          onApplyParetoSolution={cog.handleApplyParetoSolution}
          uiLang={uiLang}
        />
      </div>

      <SearchResultsColumns
        compareMode={compareMode}
        showXray={showXray}
        hybridHits={cog.hybridHits.slice(0, 8)}
        keywordHits={keywordHits}
        latencyMs={latencyMs}
        alpha={cog.effectiveAlpha}
        t={t}
        onSelectItem={onSelectItem}
        onInspectIn3D={onInspectIn3D}
        onCardHoverStart={cog.handleCardHoverStart}
        onCardHoverEnd={cog.handleCardHoverEnd}
        onPriceHover={cog.handlePriceHover}
      />
    </div>
  );
};
