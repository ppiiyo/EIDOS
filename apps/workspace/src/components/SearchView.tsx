import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  Sliders,
  Columns,
  Globe,
  ShieldCheck,
  Cpu,
} from 'lucide-react';
import {
  SecurityGuardrails,
  KineticAttentionEngine,
  SerendipityOrthogonalEngine,
  ChronoCognitiveEngine,
  AdaptiveQueryRouter,
  ParetoWeightOptimizer,
  IntentRadarCoordinates,
  ParetoCandidateSolution,
} from '@eidos/core';
import { CatalogItem } from '../types';
import {
  HybridSearchHit,
  simulateKeywordSearch,
  detectTextLanguage,
  computeTextEmbedding,
  computeCategoryEntropy,
} from '../utils/recommenderEngine';
import { trackEvent } from '../lib/analytics/tracker';
import { EmbeddingEngineState } from '../lib/embeddings';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';
import { SearchResultsColumns } from './search/SearchResultsColumns';
import { IntentVectorSynthesizer } from './search/IntentVectorSynthesizer';
import { KineticBiometricsHUD } from './search/KineticBiometricsHUD';

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
    const sample = catalog
      .slice(0, 4)
      .map((i) => `${i.title} ${i.description}`)
      .join(' ');
    return detectTextLanguage(sample);
  }, [catalog]);

  const sampleQueries = useMemo(() => {
    if (dominantLang === 'ja') {
      return [
        { label: '宇宙とブラックホールの科学と相対性理論', note: '日本語 4K科学ドキュメンタリー＆インターステラー考察を検索' },
        { label: 'サイバーパンクと人工知能のゲーム実況', note: 'サイバーパンク2077＆猫の冒険Stray実況を検索' },
        { label: 'RustとPythonによる高速データベース開発', note: 'Rust/WASMベクトルDB講座＆Python AI解説を検索' },
        { label: '京都の朝カフェと深夜の作業用BGM音楽', note: '京都エスプレッソVLOG＆東京Lo-Fi BGM配信を検索' },
      ];
    }
    if (dominantLang === 'en') {
      return [
        { label: 'relativistic time dilation and black holes in space', note: 'Finds Interstellar, Dune & Cosmos Documentary' },
        { label: 'neon cyberpunk artificial intelligence and simulated reality', note: 'Finds Edgerunners, The Matrix & Synthwave Stream' },
        { label: 'subconscious dreams and psychological mind thriller', note: 'Finds Inception & 1984' },
        { label: 'rust vector databases and deep coding focus', note: 'Finds Silicon & Rust Doc + Coding Synthwave Audio' },
      ];
    }
    return [
      { label: 'релятивистское время и космос', note: 'Vocabulary mismatch test (finds Interstellar & Dune)' },
      { label: 'симуляция реальности и нейросети', note: 'Conceptual match (finds Matrix & Cyberpunk)' },
      { label: '宇宙とブラックホールの科学 (JP Query)', note: 'Multilingual Japanese CJK vector + BM25 test' },
      { label: 'утренний эспрессо и уют в офисе', note: 'Cross-category lifestyle intent' },
    ];
  }, [dominantLang]);

  const [query, setQuery] = useState(sampleQueries[0].label);
  const [alpha, setAlpha] = useState<number>(0.7);
  const [compareMode, setCompareMode] = useState<boolean>(true);
  const [showXray, setShowXray] = useState<boolean>(true);
  const [baseHybridHits, setBaseHybridHits] = useState<HybridSearchHit[]>([]);
  const [keywordHits, setKeywordHits] = useState<Array<{ item: CatalogItem; matchedWords: string[] }>>([]);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [wasSanitized, setWasSanitized] = useState(false);

  // Next-Gen Cognitive Vector States
  const [radarCoords, setRadarCoords] = useState<IntentRadarCoordinates>({
    axisDiscovery: 0,
    axisTier: 0,
  });
  const [scrollVelocityPxPerSec, setScrollVelocityPxPerSec] = useState<number>(110);
  const [hoverDwellByItemId, setHoverDwellByItemId] = useState<Record<string, number>>({});
  const [comparisonAlternations, setComparisonAlternations] = useState<number>(0);
  const [priceHoverCount, setPriceHoverCount] = useState<number>(0);
  const [simulatedHour, setSimulatedHour] = useState<number | null>(null);

  const hoverStartTimestampRef = useRef<Record<string, number>>({});
  const recentHoveredIdsRef = useRef<string[]>([]);
  const sessionStartRef = useRef<number>(Date.now());
  const actionCountRef = useRef<number>(1);

  // Track window scroll velocity for Kinetic Attention physics
  useEffect(() => {
    let lastY = window.scrollY;
    let lastTime = performance.now();

    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(16, now - lastTime);
      const dy = Math.abs(window.scrollY - lastY);
      const vel = Math.round((dy / dt) * 1000);
      setScrollVelocityPxPerSec((prev) => Math.round(prev * 0.65 + vel * 0.35));
      lastY = window.scrollY;
      lastTime = now;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleCardHoverStart = useCallback((itemId: string) => {
    hoverStartTimestampRef.current[itemId] = performance.now();
    const recent = recentHoveredIdsRef.current;
    // Detect A -> B -> A oscillation
    if (
      recent.length >= 2 &&
      recent[recent.length - 1] !== itemId &&
      recent[recent.length - 2] === itemId
    ) {
      setComparisonAlternations((c) => c + 1);
    }
    recentHoveredIdsRef.current = [...recent.slice(-5), itemId];
  }, []);

  const handleCardHoverEnd = useCallback((itemId: string) => {
    const start = hoverStartTimestampRef.current[itemId];
    if (start) {
      const elapsed = Math.round(performance.now() - start);
      setHoverDwellByItemId((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] || 0) + elapsed,
      }));
      delete hoverStartTimestampRef.current[itemId];
    }
  }, []);

  const handlePriceHover = useCallback(() => {
    setPriceHoverCount((c) => c + 1);
  }, []);

  const handleSimulateArchetype = useCallback(
    (preset: 'comparer' | 'price_hesitant' | 'scanner' | 'sniper') => {
      if (preset === 'comparer') {
        setScrollVelocityPxPerSec(95);
        setComparisonAlternations(5);
        setPriceHoverCount(1);
        setHoverDwellByItemId({ '1': 2800, '2': 2400 });
      } else if (preset === 'price_hesitant') {
        setScrollVelocityPxPerSec(140);
        setComparisonAlternations(1);
        setPriceHoverCount(5);
        setHoverDwellByItemId({ '1': 3200 });
      } else if (preset === 'scanner') {
        setScrollVelocityPxPerSec(1150);
        setComparisonAlternations(0);
        setPriceHoverCount(0);
        setHoverDwellByItemId({});
      } else {
        setScrollVelocityPxPerSec(80);
        setComparisonAlternations(0);
        setPriceHoverCount(0);
        setHoverDwellByItemId({ '1': 1900 });
      }
    },
    []
  );

  // Evaluate cognitive profiles
  const kineticProfile = useMemo(
    () =>
      KineticAttentionEngine.analyze({
        scrollVelocityPxPerSec,
        hoverDwellByItemId,
        comparisonAlternations,
        priceHoverCount,
      }),
    [scrollVelocityPxPerSec, hoverDwellByItemId, comparisonAlternations, priceHoverCount]
  );

  const chronoProfile = useMemo(() => {
    const sessionSec = Math.max(15, Math.round((Date.now() - sessionStartRef.current) / 1000));
    const apm = Math.max(1, (actionCountRef.current / Math.max(1, sessionSec)) * 60);
    return ChronoCognitiveEngine.evaluate({
      localHour: simulatedHour ?? undefined,
      sessionDurationSec: sessionSec,
      actionsPerMinute: apm,
    });
  }, [simulatedHour, query, alpha, radarCoords]);

  const routeDecision = useMemo(
    () =>
      AdaptiveQueryRouter.routeQuery(query, {
        radarDiscoveryAxis: radarCoords.axisDiscovery,
        explorationTemperature: chronoProfile.explorationTemperature,
      }),
    [query, radarCoords.axisDiscovery, chronoProfile.explorationTemperature]
  );

  const effectiveAlpha = useMemo(() => {
    const raw =
      alpha +
      kineticProfile.alphaAdjustment * 0.4 +
      chronoProfile.recommendedAlphaShift * 0.35 +
      radarCoords.axisDiscovery * 0.12;
    return Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100;
  }, [alpha, kineticProfile.alphaAdjustment, chronoProfile.recommendedAlphaShift, radarCoords.axisDiscovery]);

  // Apply Counterfactual Anti-Echo-Chamber Serendipity & Kinetic/2D-Radar steering to hits
  const hybridHits = useMemo(() => {
    if (baseHybridHits.length === 0) return [];

    const queryVec = computeTextEmbedding(`query: ${query}`);
    const itemVecs = baseHybridHits.map((h) =>
      computeTextEmbedding(`passage: ${h.item.title} ${h.item.description} ${h.item.category}`)
    );
    const echoCentroid = SerendipityOrthogonalEngine.computeEchoChamberCentroid(
      itemVecs.slice(0, 3)
    );
    const steeredQueryVec = SerendipityOrthogonalEngine.synthesizeSteeredQueryVector(
      queryVec,
      radarCoords,
      echoCentroid
    );
    const dominantCategory = baseHybridHits[0]?.item.category || '';

    const numericPrices = baseHybridHits
      .map((h) => {
        if (typeof h.item.price === 'number') return h.item.price;
        const parsed = parseFloat(String(h.item.price || '').replace(/[^\d.]/g, ''));
        return Number.isFinite(parsed) ? parsed : 0;
      })
      .filter((p) => p > 0)
      .sort((a, b) => a - b);
    const medianPrice =
      numericPrices.length > 0 ? numericPrices[Math.floor(numericPrices.length / 2)] : 0;

    const discoveryWeight = Math.max(
      0,
      radarCoords.axisDiscovery * 0.45 +
        kineticProfile.serendipityBoost * 0.25 +
        (chronoProfile.mode === 'dopamine_discovery' ? 0.2 : 0)
    );

    const enriched = baseHybridHits.map((hit, idx) => {
      const candVec = itemVecs[idx];
      const serendipityEval = SerendipityOrthogonalEngine.evaluateCandidate({
        id: String(hit.item.id),
        category: hit.item.category,
        dominantCategory,
        candidateVec: candVec,
        queryVec: steeredQueryVec,
        echoCentroidVec: echoCentroid,
      });

      const rawPrice =
        typeof hit.item.price === 'number'
          ? hit.item.price
          : parseFloat(String(hit.item.price || '').replace(/[^\d.]/g, ''));
      const itemPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : undefined;

      const kineticMod = KineticAttentionEngine.modulateCandidateScore(
        hit.fusedScore,
        itemPrice,
        medianPrice,
        kineticProfile
      );

      // Tier axis modulation (Y-axis on 2D radar: -1 pragmatic budget, +1 flagship)
      let tierBonus = 0;
      if (itemPrice && medianPrice > 0 && Math.abs(radarCoords.axisTier) > 0.08) {
        const isPremium = itemPrice >= medianPrice;
        tierBonus =
          radarCoords.axisTier > 0
            ? isPremium
              ? radarCoords.axisTier * 0.08
              : -radarCoords.axisTier * 0.04
            : !isPremium
            ? Math.abs(radarCoords.axisTier) * 0.09
            : -Math.abs(radarCoords.axisTier) * 0.04;
      }

      const serendipityContribution = serendipityEval.isSerendipityDiscovery
        ? serendipityEval.serendipityScore * discoveryWeight * 0.28
        : 0;

      const newFusedScore = Math.min(
        0.999,
        Math.max(0.05, kineticMod.adjustedScore + serendipityContribution + tierBonus)
      );

      return {
        ...hit,
        fusedScore: Math.round(newFusedScore * 10000) / 10000,
        isSerendipityDiscovery: serendipityEval.isSerendipityDiscovery,
        serendipityScore: serendipityEval.serendipityScore,
        discoveryReason: serendipityEval.discoveryReason,
        kineticBonus: kineticMod.kineticBonus,
      };
    });

    return enriched.sort((a, b) => b.fusedScore - a.fusedScore);
  }, [baseHybridHits, query, radarCoords, kineticProfile, chronoProfile]);

  const paretoReport = useMemo(() => {
    const avgDense =
      hybridHits.length > 0
        ? hybridHits.reduce((s, h) => s + h.denseScore, 0) / hybridHits.length
        : 0.72;
    const avgBm25 =
      hybridHits.length > 0
        ? hybridHits.reduce((s, h) => s + h.bm25Score, 0) / hybridHits.length
        : 0.54;
    const entropy = computeCategoryEntropy(hybridHits.map((h) => h.item));
    return ParetoWeightOptimizer.optimize({
      avgDenseScore: avgDense,
      avgBm25Score: avgBm25,
      categoryEntropyNormalized: entropy.normalizedPercent / 100,
      explorationTemperature: chronoProfile.explorationTemperature,
      priceSensitivity: Math.min(1, priceHoverCount / 5),
    });
  }, [hybridHits, chronoProfile.explorationTemperature, priceHoverCount]);

  const handleApplyParetoSolution = useCallback((sol: ParetoCandidateSolution) => {
    setAlpha(sol.weights.alpha);
    setRadarCoords({
      axisDiscovery: Math.round((sol.weights.serendipityWeight * 2 - 0.35) * 100) / 100,
      axisTier: Math.round((0.25 - sol.weights.priceValueWeight) * 100) / 100,
    });
  }, []);

  const runSearch = async (targetQuery?: string, targetAlpha?: number) => {
    const raw = (targetQuery ?? query).trim();
    const a = targetAlpha ?? alpha;
    if (!raw) return;

    actionCountRef.current += 1;
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

  const serendipityActiveCount = hybridHits.filter((h) => h.isSerendipityDiscovery).length;

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
            className={`badge ${
              embeddingState?.status === 'ready' ? 'badge-success' : 'badge-warning'
            }`}
          >
            <Cpu size={12} />
            <span>{modelStatusLabel}</span>
          </span>
          <span className="badge badge-accent">
            <Globe size={12} />
            <span>
              {t.corpusScript} {dominantLang.toUpperCase()}
            </span>
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
            <span className="text-xs font-semibold text-[var(--text-sec)]">
              {t.modePreset}
            </span>
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
                className={
                  Math.abs(alpha - preset.val) < 0.02
                    ? 'btn btn-primary btn-sm'
                    : 'btn btn-secondary btn-sm'
                }
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
            <span className="mono text-xs font-bold text-[var(--accent)]">
              {alpha.toFixed(2)}
            </span>
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

      {/* Next-Gen Cognitive Instruments: 2D Intent Vector Synthesizer & Live Kinetic Biometrics HUD */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <IntentVectorSynthesizer
          coordinates={radarCoords}
          onChangeCoordinates={setRadarCoords}
          serendipityActiveCount={serendipityActiveCount}
          effectiveAlpha={effectiveAlpha}
          uiLang={uiLang}
        />

        <KineticBiometricsHUD
          kineticProfile={kineticProfile}
          chronoProfile={chronoProfile}
          routeDecision={routeDecision}
          paretoReport={paretoReport}
          scrollVelocityPxPerSec={scrollVelocityPxPerSec}
          comparisonAlternations={comparisonAlternations}
          priceHoverCount={priceHoverCount}
          simulatedHour={simulatedHour}
          onChangeSimulatedHour={setSimulatedHour}
          onSimulateArchetype={handleSimulateArchetype}
          onApplyParetoSolution={handleApplyParetoSolution}
          uiLang={uiLang}
        />
      </div>

      <SearchResultsColumns
        compareMode={compareMode}
        showXray={showXray}
        hybridHits={hybridHits.slice(0, 8)}
        keywordHits={keywordHits}
        latencyMs={latencyMs}
        alpha={effectiveAlpha}
        t={t}
        onSelectItem={onSelectItem}
        onInspectIn3D={onInspectIn3D}
        onCardHoverStart={handleCardHoverStart}
        onCardHoverEnd={handleCardHoverEnd}
        onPriceHover={handlePriceHover}
      />
    </div>
  );
};

