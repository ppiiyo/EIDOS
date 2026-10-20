import { useState, useEffect, useCallback } from 'react';
import { SecurityGuardrails } from '@eidos/core';
import {
  CatalogItem,
  CatalogRecommendation,
  MerchandisingRules,
  ToastItem,
} from '../types';
import {
  DEFAULT_CATALOG,
  computeCatalogEmbeddingsWithModel,
  computeTextEmbedding,
  cosineSimilarity,
  searchCatalogWithModel,
  executeHybridCatalogSearch,
  generateSemanticExplanation,
  generateSyntheticScaledCatalog,
  getOrBuildCatalogHNSWIndex,
  HybridSearchHit,
} from '../utils/recommenderEngine';
import {
  PLATFORM_DOMAIN_PRESETS,
  PlatformDomainId,
  PlatformDomainPreset,
} from '../data/domainDatabases';
import { UiLanguage } from '../i18n/uiTranslations';
import {
  getEmbeddingEngineState,
  subscribeEmbeddingEngine,
  initEmbeddingModel,
  generateEmbedding,
  EmbeddingEngineState,
} from '../lib/embeddings';
import { saveBinaryEmbeddingsToIdb, loadBinaryEmbeddingsFromIdb } from '../lib/storage';

export function useStudioWorkspace() {
  const [uiLang, setUiLang] = useState<UiLanguage>('ru');
  const [catalog, setCatalog] = useState<CatalogItem[]>(DEFAULT_CATALOG);
  const [embeddings, setEmbeddings] = useState<Map<string, Float32Array>>(() => {
    const map = new Map<string, Float32Array>();
    for (const item of DEFAULT_CATALOG) {
      map.set(
        String(item.id),
        computeTextEmbedding(`passage: ${item.title}. ${item.category}. ${item.description}`)
      );
    }
    return map;
  });

  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(DEFAULT_CATALOG[0] || null);
  const [isScaledCatalog, setIsScaledCatalog] = useState(false);
  const [activeDomain, setActiveDomain] = useState<PlatformDomainId>('marketplace');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [engineState, setEngineState] = useState<EmbeddingEngineState>(getEmbeddingEngineState);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `toast_${Date.now()}_${Math.floor(performance.now() * 1000)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const unsub = subscribeEmbeddingEngine(setEngineState);
    void initEmbeddingModel().catch(() => {
      // Honest fallback: remains in BM25 / deterministic index mode if offline
    });
    void loadBinaryEmbeddingsFromIdb().then((stored) => {
      if (stored.size > 0) {
        setEmbeddings((prev) => {
          const merged = new Map(prev);
          for (const [k, v] of stored.entries()) merged.set(k, v);
          return merged;
        });
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    let active = true;
    const missing = catalog.some((i) => !embeddings.has(String(i.id)));
    if (!missing) return;
    computeCatalogEmbeddingsWithModel(catalog, null).then((nextMap) => {
      if (active) {
        setEmbeddings(nextMap);
        void saveBinaryEmbeddingsToIdb(nextMap);
      }
    });
    return () => {
      active = false;
    };
  }, [catalog]);

  useEffect(() => {
    if (embeddings.size > 0 && catalog.length > 0) {
      getOrBuildCatalogHNSWIndex(catalog, embeddings);
      void saveBinaryEmbeddingsToIdb(embeddings);
    }
  }, [catalog, embeddings]);

  const handleAddItem = useCallback(
    (item: CatalogItem) => {
      const safeTitle = SecurityGuardrails.scanAndSanitize(item.title).sanitizedInput || item.title;
      const safeDesc =
        SecurityGuardrails.scanAndSanitize(item.description).sanitizedInput || item.description;
      const safeCat =
        SecurityGuardrails.scanAndSanitize(item.category).sanitizedInput || item.category;
      const sanitizedItem: CatalogItem = {
        ...item,
        title: safeTitle,
        description: safeDesc,
        category: safeCat,
      };
      const vec = computeTextEmbedding(
        `passage: ${sanitizedItem.title}. ${sanitizedItem.category}. ${sanitizedItem.description}`
      );
      setEmbeddings((prev) => {
        const next = new Map(prev);
        next.set(String(sanitizedItem.id), vec);
        return next;
      });
      setCatalog((prev) => [sanitizedItem, ...prev]);
      setSelectedItem(sanitizedItem);
      showToast(`Added "${sanitizedItem.title}" & computed 384-d L2 vector`, 'success');
    },
    [showToast]
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      setCatalog((prev) => {
        const next = prev.filter((i) => String(i.id) !== String(id));
        setSelectedItem((curr) =>
          curr && String(curr.id) === String(id) ? next[0] || null : curr
        );
        return next;
      });
      setEmbeddings((prev) => {
        const next = new Map(prev);
        next.delete(String(id));
        return next;
      });
      showToast(`Removed SKU #${id} from index`, 'info');
    },
    [showToast]
  );

  const handleScaleCatalog = useCallback(
    (targetCount = 1200) => {
      const t0 = performance.now();
      const currentPreset = PLATFORM_DOMAIN_PRESETS.find((p) => p.id === activeDomain);
      const baseItems = !isScaledCatalog ? catalog : currentPreset?.items || DEFAULT_CATALOG;
      const { catalog: scaledCat, embeddings: scaledEmb } = generateSyntheticScaledCatalog(
        targetCount,
        baseItems,
        embeddings
      );
      getOrBuildCatalogHNSWIndex(scaledCat, scaledEmb);
      const elapsed = Math.round(performance.now() - t0);
      setEmbeddings(scaledEmb);
      setCatalog(scaledCat);
      setSelectedItem(scaledCat[0] || null);
      setIsScaledCatalog(true);
      showToast(
        `Scaled active corpus (${activeDomain}) to ${scaledCat.length.toLocaleString()} SKU in ${elapsed} ms`,
        'success'
      );
    },
    [activeDomain, isScaledCatalog, catalog, embeddings, showToast]
  );

  const handleRestoreCuratedCatalog = useCallback(() => {
    const preset = PLATFORM_DOMAIN_PRESETS.find((p) => p.id === activeDomain);
    const baseItems = preset ? preset.items : DEFAULT_CATALOG;
    const map = new Map<string, Float32Array>();
    for (const item of baseItems) {
      map.set(
        String(item.id),
        computeTextEmbedding(`passage: ${item.title}. ${item.category}. ${item.description}`)
      );
    }
    setEmbeddings(map);
    setCatalog(baseItems);
    setSelectedItem(baseItems[0] || null);
    setIsScaledCatalog(false);
    showToast(`Restored curated ${preset?.name || 'Eidos'} catalog (${baseItems.length} items)`, 'info');
  }, [activeDomain, showToast]);

  const handleSelectDomainPreset = useCallback(
    (preset: PlatformDomainPreset) => {
      const t0 = performance.now();
      const map = new Map<string, Float32Array>();
      for (const item of preset.items) {
        map.set(
          String(item.id),
          computeTextEmbedding(`passage: ${item.title}. ${item.category}. ${item.description}`)
        );
      }
      getOrBuildCatalogHNSWIndex(preset.items, map);
      const elapsed = Math.round((performance.now() - t0) * 10) / 10;
      setEmbeddings(map);
      setCatalog(preset.items);
      setSelectedItem(preset.items[0] || null);
      setIsScaledCatalog(false);
      setActiveDomain(preset.id);
      if (preset.id === 'video_jp') setUiLang('ja');
      else if (preset.id === 'streaming') setUiLang('en');
      else if (preset.id === 'marketplace') setUiLang('ru');
      showToast(
        `${preset.icon} ${preset.name} (${preset.languageLabel}) — ${preset.items.length} SKU indexed (${elapsed} ms)`,
        'success'
      );
    },
    [showToast]
  );

  const handleImportCustomDatabase = useCallback(
    (items: CatalogItem[], label = 'Custom DB') => {
      if (items.length === 0) return;
      const map = new Map<string, Float32Array>();
      for (const item of items) {
        map.set(
          String(item.id),
          computeTextEmbedding(`passage: ${item.title}. ${item.category}. ${item.description}`)
        );
      }
      getOrBuildCatalogHNSWIndex(items, map);
      setEmbeddings(map);
      setCatalog(items);
      setSelectedItem(items[0] || null);
      setIsScaledCatalog(false);
      showToast(`${label}: ${items.length} items vectorized into 384-d HNSW index`, 'success');
    },
    [showToast]
  );

  const handleSearch = useCallback(
    async (query: string): Promise<CatalogItem[]> => {
      const safeQuery = SecurityGuardrails.scanAndSanitize(query).sanitizedInput || query;
      const recs = await searchCatalogWithModel(safeQuery, catalog, embeddings, null, 'e5-small', 10);
      return recs.map((r) => r.item);
    },
    [catalog, embeddings]
  );

  const handleHybridSearch = useCallback(
    async (query: string, alpha: number, limit = 8): Promise<HybridSearchHit[]> => {
      const safeQuery = SecurityGuardrails.scanAndSanitize(query).sanitizedInput || query;
      let queryVec: Float32Array;
      if (getEmbeddingEngineState().status === 'ready') {
        queryVec = await generateEmbedding(safeQuery);
      } else {
        queryVec = computeTextEmbedding(`query: ${safeQuery}`);
      }
      return executeHybridCatalogSearch(safeQuery, queryVec, catalog, embeddings, alpha, limit);
    },
    [catalog, embeddings]
  );

  const handleRecommend = useCallback(
    (
      itemId: string,
      diversityLambda = 0.3,
      limit = 6,
      rules?: MerchandisingRules
    ): CatalogRecommendation[] => {
      const target = catalog.find((c) => String(c.id) === String(itemId));
      const targetVec = embeddings.get(String(itemId));
      if (!target || !targetVec) return [];

      const excludedSet = new Set((rules?.excludedIds || []).map(String));
      const pinnedSet = new Set((rules?.pinnedIds || []).map(String));
      const boostCat =
        rules?.boostCategory && rules.boostCategory !== 'none' ? rules.boostCategory : null;
      const boostFactor = rules?.boostFactor ?? 1.0;
      const crossCatOnly = Boolean(rules?.crossCategoryOnly);
      const minRating = rules?.minRating ?? 0;

      const candidates = catalog
        .filter((item) => {
          const idStr = String(item.id);
          if (idStr === String(itemId) || excludedSet.has(idStr) || pinnedSet.has(idStr))
            return false;
          if (crossCatOnly && item.category === target.category) return false;
          if (minRating > 0 && (item.rating ?? 5.0) < minRating) return false;
          return embeddings.has(idStr);
        })
        .map((item) => {
          const vec = embeddings.get(String(item.id))!;
          const rawSim = cosineSimilarity(targetVec, vec);
          const isBoosted = Boolean(boostCat && item.category === boostCat);
          const boostedSim = isBoosted ? Math.min(0.999, rawSim * boostFactor) : rawSim;
          return { item, sim: rawSim, boostedSim, vec, isBoosted };
        })
        .sort((a, b) => b.boostedSim - a.boostedSim)
        .slice(0, 48);

      const selected: Array<{
        item: CatalogItem;
        sim: number;
        mmrScore: number;
        noveltyBonus: number;
        vec: Float32Array;
        isPinned?: boolean;
        isBoosted?: boolean;
      }> = [];

      for (const pinId of rules?.pinnedIds || []) {
        if (String(pinId) === String(itemId) || excludedSet.has(String(pinId))) continue;
        const pinnedItem = catalog.find((c) => String(c.id) === String(pinId));
        const pinnedVec = embeddings.get(String(pinId));
        if (pinnedItem && pinnedVec && selected.length < limit) {
          selected.push({
            item: pinnedItem,
            sim: cosineSimilarity(targetVec, pinnedVec),
            mmrScore: 1.0,
            noveltyBonus: 1.0,
            vec: pinnedVec,
            isPinned: true,
            isBoosted: Boolean(boostCat && pinnedItem.category === boostCat),
          });
        }
      }

      while (selected.length < limit && candidates.length > 0) {
        let bestIdx = 0;
        let bestMmrScore = -Infinity;
        let bestNovelty = 1.0;

        for (let i = 0; i < candidates.length; i++) {
          const cand = candidates[i];
          let maxSimToSelected = 0;
          for (const sel of selected) {
            const s = Math.max(0, cosineSimilarity(cand.vec, sel.vec));
            if (s > maxSimToSelected) maxSimToSelected = s;
          }
          const noveltyBonus = selected.length === 0 ? 1.0 : Math.max(0, 1 - maxSimToSelected);
          const mmrScore =
            (1 - diversityLambda) * cand.boostedSim + diversityLambda * noveltyBonus * 0.55;
          if (mmrScore > bestMmrScore) {
            bestMmrScore = mmrScore;
            bestIdx = i;
            bestNovelty = noveltyBonus;
          }
        }

        const chosen = candidates.splice(bestIdx, 1)[0];
        selected.push({
          item: chosen.item,
          sim: chosen.sim,
          mmrScore: Number(Math.max(0.05, bestMmrScore).toFixed(4)),
          noveltyBonus: Number(bestNovelty.toFixed(4)),
          vec: chosen.vec,
          isPinned: false,
          isBoosted: chosen.isBoosted,
        });
      }

      return selected.map((s, idx) => ({
        item: s.item,
        sim: s.sim,
        mmrScore: s.mmrScore,
        noveltyBonus: s.noveltyBonus,
        rank: idx + 1,
        isPinned: s.isPinned,
        isBoosted: s.isBoosted,
        whyRecommended: generateSemanticExplanation(target, s.item),
      }));
    },
    [catalog, embeddings]
  );

  return {
    uiLang,
    setUiLang,
    catalog,
    setCatalog,
    embeddings,
    setEmbeddings,
    selectedItem,
    setSelectedItem,
    isScaledCatalog,
    setIsScaledCatalog,
    activeDomain,
    toasts,
    engineState,
    showToast,
    dismissToast,
    handleAddItem,
    handleDeleteItem,
    handleScaleCatalog,
    handleRestoreCuratedCatalog,
    handleSelectDomainPreset,
    handleImportCustomDatabase,
    handleSearch,
    handleHybridSearch,
    handleRecommend,
  };
}
