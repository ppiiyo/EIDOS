import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Database, FileSpreadsheet, Terminal, RotateCcw, Globe } from 'lucide-react';
import { SecurityGuardrails } from '@eidos/core';
import {
  CatalogItem,
  CatalogRecommendation,
  MerchandisingRules,
  Project,
  ToastItem,
} from './types';
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
} from './utils/recommenderEngine';
import {
  PLATFORM_DOMAIN_PRESETS,
  PlatformDomainId,
  PlatformDomainPreset,
} from './data/domainDatabases';
import { Sidebar, ViewId } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CatalogView } from './components/CatalogView';
import { SearchView } from './components/SearchView';
import { RecommendationsView } from './components/RecommendationsView';
import { ABTestView } from './components/ABTestView';
import { ConversationalView } from './components/ConversationalView';
import { AnalyticsView } from './components/AnalyticsView';
import { VectorSpaceView } from './components/VectorSpaceView';
import { AdaptivePanel } from './components/AdaptivePanel';
import { ApiConsoleModal } from './components/ApiConsoleModal';
import { CsvImporterModal } from './components/CsvImporterModal';
import { DatabaseConnectorModal } from './components/DatabaseConnectorModal';
import { ToastContainer } from './components/ToastContainer';
import { ConversationalAgent } from './lib/agent/conversational-agent';
import { UiLanguage, UI_TRANSLATIONS } from './i18n/uiTranslations';

const INITIAL_CATALOG = DEFAULT_CATALOG;

export function App() {
  const [view, setView] = useState<ViewId>('dashboard');
  const [uiLang, setUiLang] = useState<UiLanguage>('ru');
  const [catalog, setCatalog] = useState<CatalogItem[]>(INITIAL_CATALOG);
  const [embeddings, setEmbeddings] = useState<Map<string, Float32Array>>(() => {
    const map = new Map<string, Float32Array>();
    for (const item of INITIAL_CATALOG) {
      map.set(
        String(item.id),
        computeTextEmbedding(`passage: ${item.title}. ${item.category}. ${item.description}`)
      );
    }
    return map;
  });

  // Global active seed item synchronized across 3D Vector Space, MMR Recommendations, and AIL
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(INITIAL_CATALOG[0] || null);
  const [isScaledCatalog, setIsScaledCatalog] = useState(false);
  const [activeDomain, setActiveDomain] = useState<PlatformDomainId>('marketplace');

  // Enterprise Modals & Toast notifications
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isDbConnectorOpen, setIsDbConnectorOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const tTop = UI_TRANSLATIONS[uiLang].topbar;

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Recompute or top-up embeddings asynchronously if needed
  useEffect(() => {
    let active = true;
    const missing = catalog.some((i) => !embeddings.has(String(i.id)));
    if (!missing) return;

    computeCatalogEmbeddingsWithModel(catalog, null).then((nextMap) => {
      if (active) {
        setEmbeddings(nextMap);
      }
    });
    return () => {
      active = false;
    };
  }, [catalog]);

  // Pre-warm HNSW index whenever catalog or embeddings change
  useEffect(() => {
    if (embeddings.size > 0 && catalog.length > 0) {
      getOrBuildCatalogHNSWIndex(catalog, embeddings);
    }
  }, [catalog, embeddings]);

  const handleAddItem = (item: CatalogItem) => {
    const safeTitle = SecurityGuardrails.scanAndSanitize(item.title).sanitizedInput || item.title;
    const safeDesc = SecurityGuardrails.scanAndSanitize(item.description).sanitizedInput || item.description;
    const safeCat = SecurityGuardrails.scanAndSanitize(item.category).sanitizedInput || item.category;
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
  };

  const handleDeleteItem = (id: string) => {
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
  };

  // Scale current domain catalog to 1,200+ items while preserving active domain & language
  const handleScaleCatalog = (targetCount: number = 1200) => {
    const t0 = performance.now();
    const currentPreset = PLATFORM_DOMAIN_PRESETS.find((p) => p.id === activeDomain);
    const baseItems = !isScaledCatalog
      ? catalog
      : currentPreset?.items || INITIAL_CATALOG;
    const { catalog: scaledCat, embeddings: scaledEmb } =
      generateSyntheticScaledCatalog(targetCount, baseItems, embeddings);
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
  };

  const handleRestoreCuratedCatalog = () => {
    const preset = PLATFORM_DOMAIN_PRESETS.find((p) => p.id === activeDomain);
    const baseItems = preset ? preset.items : INITIAL_CATALOG;
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
  };

  // Switch between Marketplace (RU), Streaming (EN), Video Hosting (JP), or Global Multilingual preset
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

      // Synchronize studio UI language with the chosen platform domain
      if (preset.id === 'video_jp') {
        setUiLang('ja');
      } else if (preset.id === 'streaming') {
        setUiLang('en');
      } else if (preset.id === 'marketplace') {
        setUiLang('ru');
      }

      showToast(
        `${preset.icon} ${preset.name} (${preset.languageLabel}) — ${preset.items.length} SKU indexed (${elapsed} ms)`,
        'success'
      );
    },
    [showToast]
  );

  // Import custom user JSON database in any language
  const handleImportCustomDatabase = useCallback(
    (items: CatalogItem[], label = 'Custom DB') => {
      if (items.length === 0) return;
      const t0 = performance.now();
      const map = new Map<string, Float32Array>();
      for (const item of items) {
        map.set(
          String(item.id),
          computeTextEmbedding(`passage: ${item.title}. ${item.category}. ${item.description}`)
        );
      }
      getOrBuildCatalogHNSWIndex(items, map);
      const elapsed = Math.round((performance.now() - t0) * 10) / 10;

      setEmbeddings(map);
      setCatalog(items);
      setSelectedItem(items[0] || null);
      setIsScaledCatalog(false);
      showToast(
        `${label}: ${items.length} items vectorized into 384-d HNSW index in ${elapsed} ms`,
        'success'
      );
    },
    [showToast]
  );

  const handleImportVectorBundle = (
    importedItems: CatalogItem[],
    importedEmbeddings: Map<string, Float32Array>
  ) => {
    if (importedItems.length === 0) return;
    setEmbeddings(importedEmbeddings);
    setCatalog(importedItems);
    setSelectedItem(importedItems[0] || null);
    setIsScaledCatalog(importedItems.length >= 500);
    showToast(
      `Imported ${importedItems.length} items with 0ms pre-computed 384-d vectors`,
      'success'
    );
  };

  // Convert CSV Concepts from CsvImporterModal into CatalogItems with SecurityGuardrails & 384-d embeddings
  const handleCsvImportConcepts = (
    concepts: Array<{ name: string; category?: string; notes?: string }>,
    replace: boolean
  ) => {
    const newItems: CatalogItem[] = concepts.map((c, idx) => {
      const safeTitle = SecurityGuardrails.scanAndSanitize(c.name).sanitizedInput || `Item ${idx + 1}`;
      const safeCat = SecurityGuardrails.scanAndSanitize(c.category || 'Imported CSV').sanitizedInput || 'Imported CSV';
      const safeDesc = SecurityGuardrails.scanAndSanitize(c.notes || c.name).sanitizedInput || safeTitle;
      return {
        id: `csv_${Date.now()}_${idx}`,
        title: safeTitle,
        description: safeDesc,
        category: safeCat,
        price: '—',
        rating: 4.8,
        reviews: 12,
        badge: 'CSV Import',
        icon: '📄',
        tags: [safeCat.toLowerCase()],
        custom: true,
      };
    });

    const nextCatalog = replace ? newItems : [...newItems, ...catalog];
    const nextEmbeddings = new Map(replace ? [] : embeddings);
    for (const item of newItems) {
      nextEmbeddings.set(
        String(item.id),
        computeTextEmbedding(`passage: ${item.title}. ${item.category}. ${item.description}`)
      );
    }

    setEmbeddings(nextEmbeddings);
    setCatalog(nextCatalog);
    if (nextCatalog.length > 0) {
      setSelectedItem(nextCatalog[0]);
    }
    showToast(`Imported ${newItems.length} records from CSV & vectorized to 384d`, 'success');
  };

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
      const queryVec = computeTextEmbedding(`query: ${safeQuery}`);
      return executeHybridCatalogSearch(safeQuery, queryVec, catalog, embeddings, alpha, limit);
    },
    [catalog, embeddings]
  );

  // Authentic MMR (Maximal Marginal Relevance) + Enterprise Merchandising Rules Engine
  const handleRecommend = useCallback(
    (
      itemId: string,
      diversityLambda: number = 0.3,
      limit: number = 6,
      rules?: MerchandisingRules
    ): CatalogRecommendation[] => {
      const target = catalog.find((c) => String(c.id) === String(itemId));
      const targetVec = embeddings.get(String(itemId));
      if (!target || !targetVec) return [];

      const excludedSet = new Set((rules?.excludedIds || []).map(String));
      const pinnedSet = new Set((rules?.pinnedIds || []).map(String));
      const boostCat = rules?.boostCategory && rules.boostCategory !== 'none' ? rules.boostCategory : null;
      const boostFactor = rules?.boostFactor ?? 1.0;
      const crossCatOnly = Boolean(rules?.crossCategoryOnly);
      const minRating = rules?.minRating ?? 0;

      // 1. Score all candidate items with cosine similarity + category boost & filter guardrails
      const candidates: Array<{
        item: CatalogItem;
        sim: number;
        boostedSim: number;
        vec: Float32Array;
        isBoosted: boolean;
      }> = [];

      for (const item of catalog) {
        const idStr = String(item.id);
        if (idStr === String(itemId)) continue;
        if (excludedSet.has(idStr)) continue;
        if (pinnedSet.has(idStr)) continue; // handled in pinned slot pass first
        if (crossCatOnly && item.category === target.category) continue;
        if (minRating > 0 && (item.rating ?? 5.0) < minRating) continue;

        const vec = embeddings.get(idStr);
        if (!vec) continue;

        const rawSim = cosineSimilarity(targetVec, vec);
        const isBoosted = Boolean(boostCat && item.category === boostCat);
        const boostedSim = isBoosted ? Math.min(0.999, rawSim * boostFactor) : rawSim;

        candidates.push({
          item,
          sim: rawSim,
          boostedSim,
          vec,
          isBoosted,
        });
      }

      candidates.sort((a, b) => b.boostedSim - a.boostedSim);
      const topPool = candidates.slice(0, Math.min(48, candidates.length));

      const selected: Array<{
        item: CatalogItem;
        sim: number;
        mmrScore: number;
        noveltyBonus: number;
        vec: Float32Array;
        isPinned?: boolean;
        isBoosted?: boolean;
      }> = [];

      // 2. First place any Pinned SKUs at the top of the recommendation slate
      if (rules?.pinnedIds && rules.pinnedIds.length > 0) {
        for (const pinId of rules.pinnedIds) {
          if (String(pinId) === String(itemId)) continue;
          if (excludedSet.has(String(pinId))) continue;
          const pinnedItem = catalog.find((c) => String(c.id) === String(pinId));
          const pinnedVec = embeddings.get(String(pinId));
          if (pinnedItem && pinnedVec && selected.length < limit) {
            const rawSim = cosineSimilarity(targetVec, pinnedVec);
            selected.push({
              item: pinnedItem,
              sim: rawSim,
              mmrScore: 1.0,
              noveltyBonus: 1.0,
              vec: pinnedVec,
              isPinned: true,
              isBoosted: Boolean(boostCat && pinnedItem.category === boostCat),
            });
          }
        }
      }

      // 3. Greedy MMR diversification loop with exact noveltyBonus & mmrScore tracking
      while (selected.length < limit && topPool.length > 0) {
        let bestIdx = 0;
        let bestMmrScore = -Infinity;
        let bestNovelty = 1.0;

        for (let i = 0; i < topPool.length; i++) {
          const cand = topPool[i];
          let maxSimToSelected = 0;
          for (const sel of selected) {
            const s = Math.max(0, cosineSimilarity(cand.vec, sel.vec));
            if (s > maxSimToSelected) maxSimToSelected = s;
          }

          const noveltyBonus =
            selected.length === 0 ? 1.0 : Math.max(0, 1 - maxSimToSelected);
          const mmrScore =
            (1 - diversityLambda) * cand.boostedSim +
            diversityLambda * noveltyBonus * 0.55;

          if (mmrScore > bestMmrScore) {
            bestMmrScore = mmrScore;
            bestIdx = i;
            bestNovelty = noveltyBonus;
          }
        }

        const chosen = topPool.splice(bestIdx, 1)[0];
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

  // Navigate to 3D Vector Space and highlight target item
  const handleInspectIn3D = useCallback((item: CatalogItem) => {
    setSelectedItem(item);
    setView('vectorspace');
  }, []);

  // Select item and inspect in Recommendations view
  const handleInspectRecommendations = useCallback((item: CatalogItem) => {
    setSelectedItem(item);
    setView('recommendations');
  }, []);

  const agent = useMemo(
    () => new ConversationalAgent(catalog, handleSearch),
    [catalog, handleSearch]
  );

  // Project representation for CSV Importer / Exporter modal
  const csvProject: Project = useMemo(
    () => ({
      id: 'eidos_catalog_proj',
      name: 'Eidos Production Catalog',
      updatedAt: Date.now(),
      concepts: catalog.map((item) => ({
        id: String(item.id),
        name: item.title,
        category: item.category,
        notes: item.description,
      })),
    }),
    [catalog]
  );

  return (
    <div className="app-shell">
      <Sidebar
        active={view}
        onSelect={setView}
        onOpenApiModal={() => setIsApiModalOpen(true)}
        uiLang={uiLang}
      />

      <main className="main-area">
        {/* Global Studio Status Bar */}
        <header
          style={{
            height: 52,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span
              className="mono"
              style={{
                fontSize: '0.75rem',
                padding: '3px 8px',
                borderRadius: 4,
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                color: 'var(--text-sec)',
                whiteSpace: 'nowrap',
              }}
            >
              {catalog.length.toLocaleString()} SKU · 384-d E5-Small
            </span>
            {selectedItem && (
              <div
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-sec)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {tTop.activeSeed}{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {selectedItem.icon} {selectedItem.title}
                </strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Global UI Language Switcher (RU | EN | JA) */}
            <div
              data-testid="ui-lang-switcher"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 2,
                gap: 2,
              }}
            >
              {(['ru', 'en', 'ja'] as UiLanguage[]).map((lang) => {
                const active = uiLang === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    data-testid={`ui-lang-${lang}`}
                    onClick={() => setUiLang(lang)}
                    style={{
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: active ? 'var(--accent)' : 'transparent',
                      color: active ? '#FFFFFF' : 'var(--text-sec)',
                      transition: 'all 0.12s ease',
                    }}
                    title={UI_TRANSLATIONS[lang].languageName}
                  >
                    {lang.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsDbConnectorOpen(true)}
              className="btn btn-secondary btn-sm"
              title="Switch platform database (Marketplace, Streaming, Video Hosting JP) or connect PostgreSQL / MongoDB / JSON"
            >
              <Globe size={13} />
              <span>{tTop.connectDb}</span>
            </button>

            {isScaledCatalog ? (
              <button
                type="button"
                onClick={handleRestoreCuratedCatalog}
                className="btn btn-secondary btn-sm"
                title={tTop.restoreCurated}
              >
                <RotateCcw size={13} />
                <span>{tTop.scaledBadge}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleScaleCatalog(1200)}
                className="btn btn-secondary btn-sm"
                title="Benchmark 1,200+ synthetic items with HNSW Phase 2"
              >
                <Database size={13} />
                <span>{tTop.scaleTo1200}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="btn btn-secondary btn-sm"
            >
              <FileSpreadsheet size={13} />
              <span>{tTop.csvModal}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className="btn btn-primary btn-sm"
            >
              <Terminal size={13} />
              <span>{tTop.apiSdk}</span>
            </button>
          </div>
        </header>

        {view === 'dashboard' && (
          <DashboardView
            catalog={catalog}
            embeddings={embeddings}
            selectedItem={selectedItem}
            isScaledCatalog={isScaledCatalog}
            activeDomain={activeDomain}
            uiLang={uiLang}
            onNavigate={setView}
            onSearch={handleSearch}
            onSelectItem={setSelectedItem}
            onScaleCatalog={handleScaleCatalog}
            onRestoreCatalog={handleRestoreCuratedCatalog}
            onOpenApiConsole={() => setIsApiModalOpen(true)}
            onSelectDomainPreset={handleSelectDomainPreset}
            onOpenDatabaseConnector={() => setIsDbConnectorOpen(true)}
          />
        )}

        {view === 'vectorspace' && (
          <VectorSpaceView
            catalog={catalog}
            embeddings={embeddings}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onInspectRecommendations={handleInspectRecommendations}
          />
        )}

        {view === 'adaptive' && (
          <AdaptivePanel
            catalog={catalog}
            embeddings={embeddings}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onShowToast={showToast}
          />
        )}

        {view === 'search' && (
          <SearchView
            catalog={catalog}
            onHybridSearch={handleHybridSearch}
            onSelectItem={handleInspectRecommendations}
            onInspectIn3D={handleInspectIn3D}
            uiLang={uiLang}
          />
        )}

        {view === 'recommendations' && (
          <RecommendationsView
            catalog={catalog}
            embeddings={embeddings}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            onRecommend={handleRecommend}
            onInspectIn3D={handleInspectIn3D}
            uiLang={uiLang}
          />
        )}

        {view === 'catalog' && (
          <CatalogView
            catalog={catalog}
            embeddings={embeddings}
            onAddItem={handleAddItem}
            onDeleteItem={handleDeleteItem}
            onSelectItem={handleInspectRecommendations}
            onInspectIn3D={handleInspectIn3D}
            onImportVectorBundle={handleImportVectorBundle}
            onOpenCsvModal={() => setIsCsvModalOpen(true)}
            uiLang={uiLang}
          />
        )}

        {view === 'analytics' && <AnalyticsView />}

        {view === 'abtest' && <ABTestView />}

        {view === 'conversational' && (
          <ConversationalView
            agent={agent}
            onSelectItem={handleInspectRecommendations}
          />
        )}
      </main>

      {/* Live Interactive API & SDK Playground Modal */}
      <ApiConsoleModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        catalog={catalog}
        selectedItem={selectedItem}
        onHybridSearch={handleHybridSearch}
        onGetRecommendations={async (item, diversity, limit) =>
          handleRecommend(String(item.id), diversity, limit)
        }
      />

      {/* Enterprise CSV Importer & Exporter Modal */}
      <CsvImporterModal
        isOpen={isCsvModalOpen}
        project={csvProject}
        onClose={() => setIsCsvModalOpen(false)}
        onImportConcepts={handleCsvImportConcepts}
        onShowToast={showToast}
      />

      {/* Universal Database & Multilingual Industry Platform Connector Modal */}
      <DatabaseConnectorModal
        isOpen={isDbConnectorOpen}
        activeDomain={activeDomain}
        catalogCount={catalog.length}
        onClose={() => setIsDbConnectorOpen(false)}
        onSelectDomainPreset={handleSelectDomainPreset}
        onImportCustomDatabase={handleImportCustomDatabase}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
export default App;
