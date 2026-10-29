import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  KineticAttentionEngine,
  SerendipityOrthogonalEngine,
  ChronoCognitiveEngine,
  AdaptiveQueryRouter,
  ParetoWeightOptimizer,
  IntentRadarCoordinates,
  ParetoCandidateSolution,
} from '@eidos/core';
import {
  HybridSearchHit,
  computeTextEmbedding,
  computeCategoryEntropy,
} from '../utils/recommenderEngine';
import { InspectorExtractedIntent, InspectorResultItem } from '../components/QueryInspector';

const SAMPLE_QUERIES_BY_LANG: Record<string, Array<{ label: string; note: string }>> = {
  ja: [
    { label: '宇宙とブラックホールの科学と相対性理論', note: '日本語 4K科学ドキュメンタリー＆インターステラー考察を検索' },
    { label: 'サイバーパンクと人工知能のゲーム実況', note: 'サイバーパンク2077＆猫の冒険Stray実況を検索' },
    { label: 'RustとPythonによる高速データベース開発', note: 'Rust/WASMベクトルDB講座＆Python AI解説を検索' },
    { label: '京都の朝カフェと深夜の作業用BGM音楽', note: '京都エスプレッソVLOG＆東京Lo-Fi BGM配信を検索' },
  ],
  en: [
    { label: 'relativistic time dilation and black holes in space', note: 'Finds Interstellar, Dune & Cosmos Documentary' },
    { label: 'neon cyberpunk artificial intelligence and simulated reality', note: 'Finds Edgerunners, The Matrix & Synthwave Stream' },
    { label: 'subconscious dreams and psychological mind thriller', note: 'Finds Inception & 1984' },
    { label: 'rust vector databases and deep coding focus', note: 'Finds Silicon & Rust Doc + Coding Synthwave Audio' },
  ],
  ru: [
    { label: 'недорогие наушники для бега', note: 'Intent-Aware Search test (category + useCase + priceRange)' },
    { label: 'релятивистское время и космос', note: 'Vocabulary mismatch test (finds Interstellar & Dune)' },
    { label: 'симуляция реальности и нейросети', note: 'Conceptual match (finds Matrix & Cyberpunk)' },
    { label: 'утренний эспрессо и уют в офисе', note: 'Cross-category lifestyle intent' },
  ],
};

export function getSampleQueriesForLang(lang: string): Array<{ label: string; note: string }> {
  return SAMPLE_QUERIES_BY_LANG[lang] || SAMPLE_QUERIES_BY_LANG.ru;
}

const CLIENT_CATEGORY_MAP: Record<string, string> = {
  наушники: 'наушники',
  гарнитура: 'наушники',
  уши: 'наушники',
  ноутбук: 'ноутбуки',
  ноутбуки: 'ноутбуки',
  смартфон: 'смартфоны',
  телефон: 'смартфоны',
  кроссовки: 'кроссовки',
  часы: 'умные часы',
  клавиатура: 'клавиатуры',
  headphones: 'headphones',
  earbuds: 'headphones',
  laptop: 'laptops',
  laptops: 'laptops',
  smartphone: 'smartphones',
  sneakers: 'sneakers',
};

const CLIENT_USECASE_MAP: Record<string, string> = {
  бега: 'бег',
  бег: 'бег',
  спорта: 'спорт',
  спорт: 'спорт',
  игр: 'игры',
  игры: 'игры',
  работы: 'работа',
  офиса: 'офис',
  кодинга: 'программирование',
  running: 'running',
  gaming: 'gaming',
  work: 'work',
  coding: 'coding',
};

export function extractClientIntentPreview(query: string): InspectorExtractedIntent | null {
  const q = (query || '').trim().toLowerCase();
  if (!q) return null;

  let category: string | undefined;
  for (const [token, canon] of Object.entries(CLIENT_CATEGORY_MAP)) {
    if (q.includes(token)) {
      category = canon;
      break;
    }
  }

  let useCase: string | undefined;
  const forMatch = /(?:для|под|for)\s+([a-zа-яё]+)/i.exec(q);
  if (forMatch && forMatch[1]) {
    const rawUc = forMatch[1].toLowerCase();
    useCase = CLIENT_USECASE_MAP[rawUc] || rawUc;
  }

  let priceRange: { min?: number; max?: number } | undefined;
  const maxMatch = /(?:до|under|max)\s*\$?(\d{2,7})/i.exec(q);
  if (maxMatch) {
    priceRange = { max: Number(maxMatch[1]) };
  } else if (/(недорог|дешев|дешёв|бюджетн|cheap|budget|affordable)/i.test(q)) {
    priceRange = { max: 5000 };
  } else if (/(премиум|флагман|дорог|premium|flagship)/i.test(q)) {
    priceRange = { min: 15000 };
  }

  let confidence = 0;
  if (category) confidence += 0.4;
  if (useCase) confidence += 0.35;
  if (priceRange) confidence += 0.25;

  if (confidence === 0) return null;

  return {
    category,
    categories: category ? [category] : undefined,
    useCase,
    useCases: useCase ? [useCase] : undefined,
    priceRange,
    confidence: Math.min(1, confidence),
  };
}

export function useSearchCognitiveState(
  query: string,
  alpha: number,
  setAlpha: (a: number) => void,
  baseHybridHits: HybridSearchHit[]
) {
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

  const handleApplyParetoSolution = useCallback(
    (sol: ParetoCandidateSolution) => {
      setAlpha(sol.weights.alpha);
      setRadarCoords({
        axisDiscovery: Math.round((sol.weights.serendipityWeight * 2 - 0.35) * 100) / 100,
        axisTier: Math.round((0.25 - sol.weights.priceValueWeight) * 100) / 100,
      });
    },
    [setAlpha]
  );

  const inspectorResults: InspectorResultItem[] = useMemo(
    () =>
      hybridHits.slice(0, 8).map((h, i) => ({
        id: String(h.item.id),
        title: h.item.title,
        category: h.item.category,
        price: h.item.price,
        score: h.fusedScore,
        explanation: {
          denseComponent: h.denseScore,
          sparseBm25Component: h.bm25Score,
          rrfScore: h.rrfScore ?? Number((h.fusedScore * 0.016).toFixed(4)),
          businessBoost: Math.max(0, Number((h.kineticBonus ?? 0).toFixed(4))),
          mmrPenalty: i > 0 && !h.isSerendipityDiscovery ? -Number((i * 0.025).toFixed(3)) : 0,
        },
      })),
    [hybridHits]
  );

  const extractedIntent = useMemo(() => extractClientIntentPreview(query), [query]);

  return {
    radarCoords,
    setRadarCoords,
    scrollVelocityPxPerSec,
    comparisonAlternations,
    priceHoverCount,
    simulatedHour,
    setSimulatedHour,
    actionCountRef,
    handleCardHoverStart,
    handleCardHoverEnd,
    handlePriceHover,
    handleSimulateArchetype,
    kineticProfile,
    chronoProfile,
    routeDecision,
    effectiveAlpha,
    hybridHits,
    paretoReport,
    handleApplyParetoSolution,
    inspectorResults,
    extractedIntent,
  };
}
