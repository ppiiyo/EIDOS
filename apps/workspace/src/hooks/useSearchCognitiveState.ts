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
import { CatalogItem } from '../types';
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
    { label: 'недорогие наушники для бега', note: 'Intent-Aware Search (категория + сценарий + бюджет)' },
    { label: 'релятивистское время и космос', note: 'Семантический поиск без совпадения слов (Интерстеллар, Дюна)' },
    { label: 'симуляция реальности и нейросети', note: 'Концептуальный поиск (Матрица, Cyberpunk 2077)' },
    { label: 'утренний эспрессо и уют в офисе', note: 'Кросс-категорийное намерение (Кофемашина, Кресло, Lo-Fi)' },
  ],
};

export function getSampleQueriesForLang(
  lang: string,
  catalog?: CatalogItem[]
): Array<{ label: string; note: string }> {
  if (catalog && catalog.length > 0) {
    const isDemoCatalog = catalog.some(
      (i) => i.id === '1' || i.id === 'str_1' || i.id === 'jp_1' || i.id === 'zh_1'
    );
    if (!isDemoCatalog) {
      const customQueries: Array<{ label: string; note: string }> = [];
      const seen = new Set<string>();
      for (const item of catalog.slice(0, 6)) {
        const label = item.title.trim();
        if (label && !seen.has(label.toLowerCase())) {
          seen.add(label.toLowerCase());
          customQueries.push({
            label,
            note: `${item.category || 'Каталог'} · Поиск по вашей базе`,
          });
        }
        if (customQueries.length >= 4) break;
      }
      if (customQueries.length > 0) {
        return customQueries;
      }
    }
  }
  return SAMPLE_QUERIES_BY_LANG[lang] || SAMPLE_QUERIES_BY_LANG.ru;
}

const CLIENT_CATEGORY_MAP: Record<string, string> = {
  наушник: 'наушники',
  гарнитур: 'наушники',
  уши: 'наушники',
  ноутбук: 'ноутбуки',
  ультрабук: 'ноутбуки',
  макбук: 'ноутбуки',
  смартфон: 'смартфоны',
  телефон: 'смартфоны',
  кроссовк: 'кроссовки',
  обув: 'кроссовки',
  часы: 'умные часы',
  браслет: 'фитнес-браслеты',
  клавиатур: 'клавиатуры',
  монитор: 'мониторы',
  кофемашин: 'кофемашины',
  эспрессо: 'кофе и техника',
  книг: 'книги',
  роман: 'книги',
  игр: 'игры',
  фильм: 'фильмы',
  кино: 'фильмы',
  кресл: 'мебель и офис',
  камер: 'камеры',
  headphones: 'headphones',
  earbuds: 'headphones',
  laptop: 'laptops',
  smartphone: 'smartphones',
  sneakers: 'sneakers',
  coffee: 'coffee machines',
  book: 'books',
  movie: 'movies',
  game: 'games',
};

const CLIENT_USECASE_MAP: Record<string, string> = {
  бега: 'бег',
  бег: 'бег',
  марафон: 'бег',
  спорта: 'спорт',
  спорт: 'спорт',
  тренировок: 'тренировки',
  фитнеса: 'спорт',
  игр: 'игры',
  игры: 'игры',
  гейминга: 'игры',
  работы: 'работа',
  офиса: 'офис',
  офис: 'офис',
  кодинга: 'программирование',
  программирования: 'программирование',
  разработки: 'программирование',
  учебы: 'обучение',
  обучения: 'обучение',
  дома: 'дом',
  семьи: 'семья',
  музыки: 'музыка',
  путешествий: 'путешествия',
  running: 'running',
  gaming: 'gaming',
  work: 'work',
  coding: 'coding',
  office: 'office',
  study: 'study',
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
  const forMatch = /(?:для|под|в|на|for|in)\s+([a-zа-яё-]+)/i.exec(q);
  if (forMatch && forMatch[1]) {
    const rawUc = forMatch[1].toLowerCase();
    useCase = CLIENT_USECASE_MAP[rawUc] || rawUc;
  } else {
    for (const [token, canon] of Object.entries(CLIENT_USECASE_MAP)) {
      if (q.includes(token)) {
        useCase = canon;
        break;
      }
    }
  }

  let priceRange: { min?: number; max?: number } | undefined;
  const rangeMatch = /от\s*(\d{2,7})\s*до\s*(\d{2,7})/i.exec(q);
  const maxMatch = /(?:до|under|max|дешевле)\s*\$?(\d{2,7})/i.exec(q);
  const minMatch = /(?:от|over|min|дороже)\s*\$?(\d{2,7})/i.exec(q);
  if (rangeMatch) {
    priceRange = { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
  } else if (maxMatch) {
    priceRange = { max: Number(maxMatch[1]) };
  } else if (minMatch) {
    priceRange = { min: Number(minMatch[1]) };
  } else if (/(недорог|дешев|дешёв|бюджетн|эконом|доступн|cheap|budget|affordable)/i.test(q)) {
    priceRange = { max: 15000 };
  } else if (/(премиум|флагман|дорог|профи|люкс|premium|flagship|pro)/i.test(q)) {
    priceRange = { min: 25000 };
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
    confidence: Math.min(1, Number(confidence.toFixed(2))),
  };
}

export type VectorScenarioPresetId =
  | 'baseline'
  | 'kinetic_compare'
  | 'night_serendipity'
  | 'intent_budget';

export interface CognitiveStageTimings {
  vectorizeMs: number;
  cognitiveMs: number;
  paretoMs: number;
  totalCognitiveMs: number;
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
  const [activeScenarioId, setActiveScenarioId] = useState<VectorScenarioPresetId>('baseline');
  const [disableIntentBoost, setDisableIntentBoost] = useState<boolean>(false);
  const [disableMmrPenalty, setDisableMmrPenalty] = useState<boolean>(false);

  const hoverStartTimestampRef = useRef<Record<string, number>>({});
  const recentHoveredIdsRef = useRef<string[]>([]);
  const sessionStartRef = useRef<number>(Date.now());
  const actionCountRef = useRef<number>(1);

  useEffect(() => {
    let lastY = 0;
    let lastTime = performance.now();

    const onScroll = (e: Event) => {
      const now = performance.now();
      const dt = Math.max(16, now - lastTime);
      const target = e.target as HTMLElement | Document | null;
      const currentY =
        target && 'scrollTop' in target && typeof target.scrollTop === 'number'
          ? target.scrollTop
          : window.scrollY;
      const dy = Math.abs(currentY - lastY);
      const vel = Math.round((dy / dt) * 1000);
      setScrollVelocityPxPerSec((prev) => Math.round(prev * 0.6 + vel * 0.4));
      lastY = currentY;
      lastTime = now;
    };

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true });
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
        setPriceHoverCount(6);
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

  const applyScenarioPreset = useCallback(
    (scenarioId: VectorScenarioPresetId): string | undefined => {
      setActiveScenarioId(scenarioId);
      if (scenarioId === 'baseline') {
        setAlpha(0.7);
        setRadarCoords({ axisDiscovery: 0, axisTier: 0 });
        setSimulatedHour(10);
        setScrollVelocityPxPerSec(85);
        setComparisonAlternations(0);
        setPriceHoverCount(0);
        setHoverDwellByItemId({ '1': 1800 });
        return undefined;
      }
      if (scenarioId === 'kinetic_compare') {
        setAlpha(0.65);
        setRadarCoords({ axisDiscovery: 0.15, axisTier: -0.55 });
        setSimulatedHour(14);
        setScrollVelocityPxPerSec(115);
        setComparisonAlternations(5);
        setPriceHoverCount(6);
        setHoverDwellByItemId({ '1': 3100, '2': 2700 });
        return undefined;
      }
      if (scenarioId === 'night_serendipity') {
        setAlpha(0.8);
        setRadarCoords({ axisDiscovery: 0.85, axisTier: 0.25 });
        setSimulatedHour(23);
        setScrollVelocityPxPerSec(980);
        setComparisonAlternations(0);
        setPriceHoverCount(0);
        setHoverDwellByItemId({});
        return undefined;
      }
      // intent_budget
      setAlpha(0.6);
      setRadarCoords({ axisDiscovery: -0.35, axisTier: -0.7 });
      setSimulatedHour(11);
      setScrollVelocityPxPerSec(90);
      setComparisonAlternations(2);
      setPriceHoverCount(5);
      setHoverDwellByItemId({ '1': 2400 });
      return 'недорогие наушники для бега';
    },
    [setAlpha]
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

  const extractedIntent = useMemo(() => extractClientIntentPreview(query), [query]);

  // Pre-compute candidate item vectors, echo chamber centroid, and median price only when baseHybridHits change
  const candidatePrep = useMemo(() => {
    const t0 = performance.now();
    if (baseHybridHits.length === 0) {
      return {
        itemVecs: [] as Float32Array[],
        echoCentroid: new Float32Array(384),
        dominantCategory: '',
        medianPrice: 0,
        parsedPrices: [] as Array<number | undefined>,
        prepMs: 0,
      };
    }

    const itemVecs = baseHybridHits.map((h) =>
      computeTextEmbedding(`passage: ${h.item.title} ${h.item.description} ${h.item.category}`)
    );
    const echoCentroid = SerendipityOrthogonalEngine.computeEchoChamberCentroid(
      itemVecs.slice(0, 3)
    );
    const dominantCategory = baseHybridHits[0]?.item.category || '';

    const parsedPrices = baseHybridHits.map((h) => {
      const rawPrice =
        typeof h.item.price === 'number'
          ? h.item.price
          : parseFloat(String(h.item.price || '').replace(/[^\d.]/g, ''));
      return Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : undefined;
    });

    const numericPrices = parsedPrices
      .filter((p): p is number => p !== undefined && p > 0)
      .sort((a, b) => a - b);
    const medianPrice =
      numericPrices.length > 0 ? numericPrices[Math.floor(numericPrices.length / 2)] : 0;

    return {
      itemVecs,
      echoCentroid,
      dominantCategory,
      medianPrice,
      parsedPrices,
      prepMs: Math.round((performance.now() - t0) * 100) / 100,
    };
  }, [baseHybridHits]);

  const { hybridHits, cognitiveMs, vectorizeMs } = useMemo(() => {
    if (baseHybridHits.length === 0) {
      return { hybridHits: [] as HybridSearchHit[], cognitiveMs: 0, vectorizeMs: 0 };
    }

    const tVec0 = performance.now();
    const queryVec = computeTextEmbedding(`query: ${query}`);
    const vecElapsed = Math.round((performance.now() - tVec0 + candidatePrep.prepMs) * 100) / 100;

    const tCog0 = performance.now();
    const { itemVecs, echoCentroid, dominantCategory, medianPrice, parsedPrices } = candidatePrep;

    const steeredQueryVec = SerendipityOrthogonalEngine.synthesizeSteeredQueryVector(
      queryVec,
      radarCoords,
      echoCentroid
    );

    const discoveryWeight = Math.max(
      0,
      radarCoords.axisDiscovery * 0.55 +
        kineticProfile.serendipityBoost * 0.3 +
        (chronoProfile.mode === 'dopamine_discovery' ? 0.22 : 0)
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

      const itemPrice = parsedPrices[idx];

      // Dynamic base score using effectiveAlpha so 2D Radar, Chrono, and Kinetic shifts re-rank live
      const dynamicHybridBase =
        effectiveAlpha * hit.denseScore + (1 - effectiveAlpha) * hit.bm25Score;

      const kineticMod = KineticAttentionEngine.modulateCandidateScore(
        dynamicHybridBase,
        itemPrice,
        medianPrice,
        kineticProfile
      );

      // Intent-Aware boost when query intent matches item category, use-case, or price budget
      let intentBoost = 0;
      if (extractedIntent && !disableIntentBoost) {
        const hay = `${hit.item.title} ${hit.item.category} ${hit.item.description} ${(hit.item.tags || []).join(' ')}`.toLowerCase();
        if (extractedIntent.category && hay.includes(extractedIntent.category.slice(0, 5))) {
          intentBoost += 0.06;
        }
        if (extractedIntent.useCase && hay.includes(extractedIntent.useCase.slice(0, 4))) {
          intentBoost += 0.05;
        }
        if (extractedIntent.priceRange && itemPrice !== undefined) {
          const { min, max } = extractedIntent.priceRange;
          const okMin = min === undefined || itemPrice >= min;
          const okMax = max === undefined || itemPrice <= max;
          if (okMin && okMax) {
            intentBoost += 0.05;
          }
        }
      }

      let tierBonus = 0;
      if (itemPrice && medianPrice > 0 && Math.abs(radarCoords.axisTier) > 0.08) {
        const isPremium = itemPrice >= medianPrice;
        tierBonus =
          radarCoords.axisTier > 0
            ? isPremium
              ? radarCoords.axisTier * 0.09
              : -radarCoords.axisTier * 0.04
            : !isPremium
            ? Math.abs(radarCoords.axisTier) * 0.1
            : -Math.abs(radarCoords.axisTier) * 0.04;
      }

      const sniperPenalty =
        radarCoords.axisDiscovery < -0.15 && hit.item.category !== dominantCategory
          ? radarCoords.axisDiscovery * 0.12
          : 0;

      const serendipityContribution = serendipityEval.isSerendipityDiscovery
        ? serendipityEval.serendipityScore * discoveryWeight * 0.32
        : 0;

      const mmrPenaltyVal =
        !disableMmrPenalty && idx > 0 && !serendipityEval.isSerendipityDiscovery
          ? -Number((idx * 0.015).toFixed(4))
          : 0;

      const totalBoost =
        kineticMod.kineticBonus + intentBoost + Math.max(0, tierBonus) + serendipityContribution;

      const newFusedScore = Math.min(
        0.999,
        Math.max(
          0.05,
          kineticMod.adjustedScore +
            intentBoost +
            tierBonus +
            sniperPenalty +
            serendipityContribution +
            mmrPenaltyVal
        )
      );

      return {
        ...hit,
        fusedScore: Math.round(newFusedScore * 10000) / 10000,
        isSerendipityDiscovery:
          serendipityEval.isSerendipityDiscovery &&
          (radarCoords.axisDiscovery >= 0 || discoveryWeight > 0.08),
        serendipityScore: serendipityEval.serendipityScore,
        discoveryReason: serendipityEval.discoveryReason,
        kineticBonus: Math.round(totalBoost * 10000) / 10000,
      };
    });

    const sorted = enriched.sort((a, b) => b.fusedScore - a.fusedScore);
    const cogElapsed = Math.round((performance.now() - tCog0) * 100) / 100;

    return {
      hybridHits: sorted,
      cognitiveMs: Math.max(0.08, cogElapsed),
      vectorizeMs: Math.max(0.05, vecElapsed),
    };
  }, [
    baseHybridHits,
    candidatePrep,
    query,
    radarCoords,
    kineticProfile,
    chronoProfile,
    effectiveAlpha,
    extractedIntent,
    disableIntentBoost,
    disableMmrPenalty,
  ]);

  const { paretoReport, paretoMs } = useMemo(() => {
    const tPar0 = performance.now();
    const avgDense =
      hybridHits.length > 0
        ? hybridHits.reduce((s, h) => s + h.denseScore, 0) / hybridHits.length
        : 0.72;
    const avgBm25 =
      hybridHits.length > 0
        ? hybridHits.reduce((s, h) => s + h.bm25Score, 0) / hybridHits.length
        : 0.54;
    const entropy = computeCategoryEntropy(hybridHits.map((h) => h.item));
    const report = ParetoWeightOptimizer.optimize({
      avgDenseScore: avgDense,
      avgBm25Score: avgBm25,
      categoryEntropyNormalized: entropy.normalizedPercent / 100,
      explorationTemperature: chronoProfile.explorationTemperature,
      priceSensitivity: Math.min(1, priceHoverCount / 5),
    });
    const parElapsed = Math.round((performance.now() - tPar0) * 100) / 100;
    return {
      paretoReport: report,
      paretoMs: Math.max(0.04, parElapsed),
    };
  }, [hybridHits, chronoProfile.explorationTemperature, priceHoverCount]);

  const stageTimingsMs: CognitiveStageTimings = useMemo(
    () => ({
      vectorizeMs,
      cognitiveMs,
      paretoMs,
      totalCognitiveMs: Math.round((vectorizeMs + cognitiveMs + paretoMs) * 100) / 100,
    }),
    [vectorizeMs, cognitiveMs, paretoMs]
  );

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
          denseComponent: Number((effectiveAlpha * h.denseScore).toFixed(4)),
          sparseBm25Component: Number(((1 - effectiveAlpha) * h.bm25Score).toFixed(4)),
          rrfScore: h.rrfScore ?? Number((h.fusedScore * 0.016).toFixed(4)),
          businessBoost: Math.max(0, Number((h.kineticBonus ?? 0).toFixed(4))),
          mmrPenalty:
            !disableMmrPenalty && i > 0 && !h.isSerendipityDiscovery
              ? -Number((i * 0.025).toFixed(3))
              : 0,
          kineticBonus: Number(Math.max(0, h.kineticBonus ?? 0).toFixed(4)),
          serendipityScore: Number(
            (h.isSerendipityDiscovery ? (h.serendipityScore ?? 0) : 0).toFixed(4)
          ),
        },
      })),
    [hybridHits, effectiveAlpha, disableMmrPenalty]
  );

  return {
    radarCoords,
    setRadarCoords,
    scrollVelocityPxPerSec,
    comparisonAlternations,
    priceHoverCount,
    simulatedHour,
    setSimulatedHour,
    activeScenarioId,
    applyScenarioPreset,
    disableIntentBoost,
    setDisableIntentBoost,
    disableMmrPenalty,
    setDisableMmrPenalty,
    stageTimingsMs,
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
