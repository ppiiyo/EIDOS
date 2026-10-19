import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CatalogItem, CatalogRecommendation, HybridSearchHit, ToastItem, Project } from './types';
import { INITIAL_CATALOG } from './data/catalog';
import {
  computeTextEmbedding,
  cosineSimilarity,
  generateSemanticExplanation,
  computeCatalogEmbeddingsWithModel,
  executeHybridCatalogSearch,
  generateSyntheticScaledCatalog,
} from './utils/recommenderEngine';
import { Sidebar, ViewId } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CatalogView } from './components/CatalogView';
import { SearchView } from './components/SearchView';
import { RecommendationsView } from './components/RecommendationsView';
import { VectorSpaceView } from './components/VectorSpaceView';
import { AdaptivePanel } from './components/AdaptivePanel';
import { ABTestView } from './components/ABTestView';
import { ConversationalView } from './components/ConversationalView';
import { AnalyticsView } from './components/AnalyticsView';
import { LaunchKitView } from './components/LaunchKitView';
import { ApiConsoleModal } from './components/ApiConsoleModal';
import { CsvImporterModal } from './components/CsvImporterModal';
import { ToastContainer } from './components/ToastContainer';
import { ConversationalAgent } from './lib/agent/conversational-agent';
import { trackEvent } from './lib/analytics/tracker';
import { Cpu, CheckCircle2, Sun, Moon, Terminal, FileSpreadsheet } from 'lucide-react';

const STORAGE_CATALOG_KEY = 'eidos_catalog_v3';
const STORAGE_VIEW_KEY = 'eidos_active_view_v3';
const STORAGE_THEME_KEY = 'eidos_theme_v3';

export default function App() {
  // 0. Dual Theme State (Light Clean Studio vs Dark Engineering Console)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // 1. Catalog State with unified string IDs
  const [catalog, setCatalog] = useState<CatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CATALOG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            ...item,
            id: String(item.id),
          }));
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_CATALOG.map((item) => ({
      ...item,
      id: String(item.id),
    }));
  });

  const [isScaledCatalog, setIsScaledCatalog] = useState(false);

  // Persist non-scaled catalog changes
  useEffect(() => {
    if (!isScaledCatalog) {
      try {
        localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(catalog));
      } catch {
        // ignore
      }
    }
  }, [catalog, isScaledCatalog]);

  // 2. Cross-Module Selected Item Anchor
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(() => catalog[0] || null);

  useEffect(() => {
    if (!selectedItem && catalog.length > 0) {
      setSelectedItem(catalog[0]);
    }
  }, [catalog, selectedItem]);

  // 3. Active View Navigation
  const [activeView, setActiveView] = useState<ViewId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_VIEW_KEY) as ViewId;
      if (
        saved &&
        [
          'dashboard',
          'search',
          'recommendations',
          'vectorspace',
          'adaptive',
          'catalog',
          'abtest',
          'conversational',
          'analytics',
          'launchkit',
        ].includes(saved)
      ) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'dashboard';
  });

  const handleNavigate = (view: ViewId) => {
    setActiveView(view);
    try {
      localStorage.setItem(STORAGE_VIEW_KEY, view);
    } catch {
      // ignore
    }
  };

  // Global Modals
  const [isApiConsoleOpen, setIsApiConsoleOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // 4. Dense 384-dimensional Embeddings Map
  const [customEmbedder, setCustomEmbedder] = useState<any>(null);
  const [embeddingMode, setEmbeddingMode] = useState<'model' | 'fallback'>('fallback');
  const [embeddingProgress, setEmbeddingProgress] = useState(1);
  const [isComputingEmbeddings, setIsComputingEmbeddings] = useState(false);
  const [catalogEmbeddings, setCatalogEmbeddings] = useState<Map<string, Float32Array>>(() => {
    const map = new Map<string, Float32Array>();
    for (const item of catalog) {
      const textToEmbed = `passage: ${item.title} ${item.description} ${item.category} ${item.tags?.join(' ') || ''}`;
      map.set(String(item.id), computeTextEmbedding(textToEmbed));
    }
    return map;
  });

  // Automatically load browser-based Transformers.js pipeline (multilingual-e5-small)
  useEffect(() => {
    let cancelled = false;
    async function loadEmbedder() {
      if (typeof window !== 'undefined' && (window as any).Transformers) {
        try {
          const pipeline = await (window as any).Transformers.pipeline(
            'feature-extraction',
            'Xenova/multilingual-e5-small'
          );
          if (!cancelled && pipeline) {
            setCustomEmbedder(() => pipeline);
            setEmbeddingMode('model');
          }
        } catch (err) {
          console.warn('Transformers.js network load fallback:', err);
        }
      }
    }
    loadEmbedder();
    return () => {
      cancelled = true;
    };
  }, []);

  // Recompute embeddings when catalog or customEmbedder changes (skip when synthetic 1,200 scale is active)
  useEffect(() => {
    if (isScaledCatalog) return;
    let isCancelled = false;
    setIsComputingEmbeddings(true);

    computeCatalogEmbeddingsWithModel(
      catalog,
      customEmbedder,
      customEmbedder ? 'e5-small' : 'built-in',
      (current, total) => {
        if (!isCancelled) {
          setEmbeddingProgress(current / total);
        }
      }
    )
      .then((newEmbeddings) => {
        if (!isCancelled) {
          setCatalogEmbeddings(newEmbeddings);
          setEmbeddingMode(customEmbedder ? 'model' : 'fallback');
          setIsComputingEmbeddings(false);
          setEmbeddingProgress(1);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setIsComputingEmbeddings(false);
          setEmbeddingProgress(1);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [catalog, customEmbedder, isScaledCatalog]);

  // 5. Real Hybrid Search (Dense HNSW + Sparse BM25)
  const computeQueryVector = useCallback(
    async (query: string): Promise<Float32Array> => {
      const trimmed = query.trim();
      if (customEmbedder) {
        try {
          const output = await customEmbedder(`query: ${trimmed}`, {
            pooling: 'mean',
            normalize: true,
          });
          return output.data instanceof Float32Array
            ? output.data
            : new Float32Array(output.data);
        } catch {
          return computeTextEmbedding(`query: ${trimmed}`);
        }
      }
      return computeTextEmbedding(`query: ${trimmed}`);
    },
    [customEmbedder]
  );

  const handleHybridSearch = useCallback(
    async (query: string, alpha = 0.7, limit = 8): Promise<HybridSearchHit[]> => {
      const trimmed = query.trim();
      if (!trimmed) return [];
      const queryVec = await computeQueryVector(trimmed);
      return executeHybridCatalogSearch(
        trimmed,
        queryVec,
        catalog,
        catalogEmbeddings,
        alpha,
        limit
      );
    },
    [catalog, catalogEmbeddings, computeQueryVector]
  );

  const handleSearch = useCallback(
    async (query: string, limit = 8): Promise<CatalogItem[]> => {
      const hits = await handleHybridSearch(query, 0.7, limit);
      return hits.map((h) => h.item);
    },
    [handleHybridSearch]
  );

  // 6. Real MMR (Maximal Marginal Relevance) Recommendation Implementation
  const handleGetRecommendations = useCallback(
    async (
      targetItem: CatalogItem,
      diversity = 0.35,
      limit = 6
    ): Promise<CatalogRecommendation[]> => {
      const targetVec = catalogEmbeddings.get(String(targetItem.id));
      if (!targetVec) return [];

      const candidates = catalog.filter((c) => String(c.id) !== String(targetItem.id));
      if (candidates.length === 0) return [];

      const candSims = new Map<string, number>();
      for (const c of candidates) {
        const cVec = catalogEmbeddings.get(String(c.id));
        if (cVec) {
          candSims.set(String(c.id), cosineSimilarity(targetVec, cVec));
        }
      }

      const selected: CatalogItem[] = [];
      const remaining = [...candidates];

      while (selected.length < limit && remaining.length > 0) {
        let bestScore = -Infinity;
        let bestIndex = -1;

        for (let i = 0; i < remaining.length; i++) {
          const cand = remaining[i];
          const simToTarget = candSims.get(String(cand.id)) ?? 0;

          let maxSimToSelected = 0;
          if (selected.length > 0) {
            const candVec = catalogEmbeddings.get(String(cand.id));
            if (candVec) {
              for (const sel of selected) {
                const selVec = catalogEmbeddings.get(String(sel.id));
                if (selVec) {
                  const s = cosineSimilarity(candVec, selVec);
                  if (s > maxSimToSelected) maxSimToSelected = s;
                }
              }
            }
          }

          const mmrScore = (1 - diversity) * simToTarget - diversity * maxSimToSelected;
          if (mmrScore > bestScore) {
            bestScore = mmrScore;
            bestIndex = i;
          }
        }

        if (bestIndex >= 0) {
          selected.push(remaining[bestIndex]);
          remaining.splice(bestIndex, 1);
        } else {
          break;
        }
      }

      return selected.map((item) => ({
        item,
        sim: candSims.get(String(item.id)) ?? 0,
        whyRecommended: generateSemanticExplanation(targetItem, item),
      }));
    },
    [catalog, catalogEmbeddings]
  );

  // 7. Conversational Agent Instance
  const conversationalAgent = useMemo(() => {
    return new ConversationalAgent(catalog, handleSearch);
  }, [catalog, handleSearch]);

  useEffect(() => {
    conversationalAgent.setCatalog(catalog);
  }, [catalog, conversationalAgent]);

  // 8. Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, type: 'info' | 'success' | 'error' = 'info') => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 9. Catalog & Scale Actions
  const handleAddItem = (newItem: CatalogItem) => {
    const itemWithStrId = { ...newItem, id: String(newItem.id) };
    setCatalog((prev) => [itemWithStrId, ...prev]);
    setSelectedItem(itemWithStrId);
    trackEvent({ type: 'item_view', itemId: itemWithStrId.id, category: itemWithStrId.category });
    addToast(`Added «${itemWithStrId.title}» (384-d vector indexed)`, 'success');
  };

  const handleDeleteItem = (id: string) => {
    setCatalog((prev) => prev.filter((item) => String(item.id) !== String(id)));
    addToast('SKU removed from catalog', 'info');
  };

  const handleScaleCatalog = (targetCount = 1200) => {
    const { catalog: scaledItems, embeddings: scaledVectors } =
      generateSyntheticScaledCatalog(targetCount);
    const combinedCatalog = [...INITIAL_CATALOG.map((c) => ({ ...c, id: String(c.id) })), ...scaledItems];
    const combinedEmbeddings = new Map<string, Float32Array>(scaledVectors);
    for (const baseItem of INITIAL_CATALOG) {
      const text = `passage: ${baseItem.title} ${baseItem.description} ${baseItem.category} ${baseItem.tags?.join(' ') || ''}`;
      combinedEmbeddings.set(String(baseItem.id), computeTextEmbedding(text));
    }
    setIsScaledCatalog(true);
    setCatalog(combinedCatalog);
    setCatalogEmbeddings(combinedEmbeddings);
    addToast(`Scaled corpus to ${combinedCatalog.length.toLocaleString()} SKU with 384-d HNSW index`, 'success');
  };

  const handleRestoreCatalog = () => {
    const base = INITIAL_CATALOG.map((item) => ({ ...item, id: String(item.id) }));
    setIsScaledCatalog(false);
    setCatalog(base);
    setSelectedItem(base[0]);
    addToast('Restored curated 25-SKU benchmark catalog', 'info');
  };

  const handleImportVectorBundle = (
    items: CatalogItem[],
    importedEmbeddings: Map<string, Float32Array>
  ) => {
    setIsScaledCatalog(false);
    setCatalog(items);
    if (importedEmbeddings.size > 0) {
      setCatalogEmbeddings(importedEmbeddings);
    }
    if (items[0]) setSelectedItem(items[0]);
    addToast(
      `Imported ${items.length} SKU (${importedEmbeddings.size} pre-computed 384-d vectors)`,
      'success'
    );
  };

  const csvProjectAdapter = useMemo<Project>(
    () => ({
      id: 'eidos-catalog-project',
      name: 'EIDOS Semantic Catalog',
      updatedAt: Date.now(),
      concepts: catalog.map((c) => ({
        id: String(c.id),
        name: c.title,
        category: c.category,
        notes: c.description,
      })),
    }),
    [catalog]
  );

  const handleImportCsvConcepts = (
    concepts: Array<{ name: string; category?: string; notes?: string }>,
    replace: boolean
  ) => {
    const importedItems: CatalogItem[] = concepts.map((c, idx) => ({
      id: `csv_${Date.now()}_${idx}`,
      title: c.name,
      category: c.category || 'Imported',
      description: c.notes || c.name,
      price: '4 990 ₽',
      icon: '📦',
      tags: c.category ? [c.category.toLowerCase()] : [],
    }));
    setIsScaledCatalog(false);
    setCatalog((prev) => (replace ? importedItems : [...importedItems, ...prev]));
    if (importedItems[0]) setSelectedItem(importedItems[0]);
    addToast(`Imported ${importedItems.length} items from CSV and vectorized to 384d`, 'success');
  };

  const getViewTitle = (view: ViewId): string => {
    switch (view) {
      case 'dashboard':
        return 'Overview & HNSW Benchmark';
      case 'search':
        return 'Hybrid Search Lab (BM25 + Dense HNSW)';
      case 'recommendations':
        return 'MMR Recommendations & Explainable X-Ray';
      case 'vectorspace':
        return '3D Vector Space & 2D Topology Graph';
      case 'adaptive':
        return 'Adaptive Intelligence Lab (AIL)';
      case 'catalog':
        return 'Catalog & 0ms Vector Bundles';
      case 'abtest':
        return 'Statistical A/B Experiments';
      case 'conversational':
        return 'Conversational Vector NLU Agent';
      case 'analytics':
        return 'Semantic Trends & Session Telemetry';
      case 'launchkit':
        return 'Deployment & Production Checklist';
      default:
        return 'EIDOS Studio';
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-alt)', color: 'var(--text)' }}>
      {/* 1. Left Sidebar Navigation */}
      <Sidebar active={activeView} onNavigate={handleNavigate} />

      {/* 2. Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: 56,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            gap: 16,
          }}
        >
          {/* Zone 1: Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>EIDOS</span>
            <span style={{ color: 'var(--border-hi)' }}>/</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getViewTitle(activeView)}
            </span>
          </div>

          {/* Zone 2: Global Tools, Embedder Switch & Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Embedder Mode Switch */}
            <button
              type="button"
              className="btn btn-sm"
              style={{
                border: '1px solid var(--border)',
                background: embeddingMode === 'model' ? 'var(--success-bg)' : 'var(--bg-alt)',
                color: embeddingMode === 'model' ? 'var(--success)' : 'var(--text-sec)',
              }}
              title={
                embeddingMode === 'model'
                  ? 'Transformers.js Xenova/multilingual-e5-small (384d) active'
                  : 'Deterministic 384-d semantic anchor + n-gram embedder active. Click to load ONNX E5 weights.'
              }
              onClick={() => {
                if (embeddingMode === 'model') {
                  setCustomEmbedder(null);
                  setEmbeddingMode('fallback');
                  addToast('Switched to Deterministic 384-d Embedder', 'info');
                } else if (typeof window !== 'undefined' && (window as any).Transformers) {
                  addToast('Loading Multilingual E5 Small (384d) weights...', 'info');
                  (window as any).Transformers.pipeline('feature-extraction', 'Xenova/multilingual-e5-small')
                    .then((pipe: any) => {
                      setCustomEmbedder(() => pipe);
                      setEmbeddingMode('model');
                      addToast('Loaded E5-Small (384d) ONNX Model', 'success');
                    })
                    .catch(() => {
                      addToast('Using Deterministic 384-d Embedder (offline mode)', 'info');
                    });
                } else {
                  addToast('Deterministic 384-d Embedder active', 'info');
                }
              }}
            >
              {isComputingEmbeddings ? (
                <span className="mono">Indexing {(embeddingProgress * 100).toFixed(0)}%</span>
              ) : embeddingMode === 'model' ? (
                <>
                  <CheckCircle2 size={13} />
                  <span className="mono">E5-Small · 384d</span>
                </>
              ) : (
                <>
                  <Cpu size={13} />
                  <span className="mono">Deterministic · 384d</span>
                </>
              )}
            </button>

            {/* CSV Import/Export Modal Button */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsCsvModalOpen(true)}
            >
              <FileSpreadsheet size={13} />
              <span>CSV Studio</span>
            </button>

            {/* Live API Console Button */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsApiConsoleOpen(true)}
            >
              <Terminal size={13} />
              <span>API Console</span>
            </button>

            {/* Light / Dark Theme Switcher */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title={`Switch to ${theme === 'dark' ? 'Light Studio' : 'Dark Engineering'} theme`}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        {/* Dynamic View Canvas */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {activeView === 'dashboard' && (
            <DashboardView
              catalog={catalog}
              embeddings={catalogEmbeddings}
              selectedItem={selectedItem}
              isScaledCatalog={isScaledCatalog}
              onNavigate={handleNavigate}
              onSearch={handleSearch}
              onSelectItem={(item) => {
                setSelectedItem(item);
                handleNavigate('recommendations');
              }}
              onScaleCatalog={handleScaleCatalog}
              onRestoreCatalog={handleRestoreCatalog}
              onOpenApiConsole={() => setIsApiConsoleOpen(true)}
            />
          )}

          {activeView === 'search' && (
            <SearchView
              catalog={catalog}
              onHybridSearch={handleHybridSearch}
              onSelectItem={(item) => {
                setSelectedItem(item);
                handleNavigate('recommendations');
              }}
              onInspectIn3D={(item) => {
                setSelectedItem(item);
                handleNavigate('vectorspace');
              }}
            />
          )}

          {activeView === 'recommendations' && (
            <RecommendationsView
              catalog={catalog}
              selectedItem={selectedItem}
              onSelectSeedItem={(item) => setSelectedItem(item)}
              onGetRecommendations={handleGetRecommendations}
              onInspectIn3D={(item) => {
                setSelectedItem(item);
                handleNavigate('vectorspace');
              }}
            />
          )}

          {activeView === 'vectorspace' && (
            <VectorSpaceView
              catalog={catalog}
              embeddings={catalogEmbeddings}
              selectedItem={selectedItem}
              onSelectItem={(item) => setSelectedItem(item)}
              onInspectRecommendations={(item) => {
                setSelectedItem(item);
                handleNavigate('recommendations');
              }}
            />
          )}

          {activeView === 'adaptive' && (
            <div className="page">
              <AdaptivePanel
                catalog={catalog.slice(0, 100)}
                embeddings={catalogEmbeddings}
                selectedItem={selectedItem || catalog[0]}
                onSelectItem={(item) => setSelectedItem(item)}
              />
            </div>
          )}

          {activeView === 'catalog' && (
            <CatalogView
              catalog={catalog}
              embeddings={catalogEmbeddings}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onSelectItem={(item) => {
                setSelectedItem(item);
                handleNavigate('recommendations');
              }}
              onInspectIn3D={(item) => {
                setSelectedItem(item);
                handleNavigate('vectorspace');
              }}
              onImportVectorBundle={handleImportVectorBundle}
              onOpenCsvModal={() => setIsCsvModalOpen(true)}
            />
          )}

          {activeView === 'abtest' && <ABTestView />}

          {activeView === 'conversational' && (
            <ConversationalView
              agent={conversationalAgent}
              onSelectItem={(item) => {
                setSelectedItem(item);
                handleNavigate('recommendations');
              }}
            />
          )}

          {activeView === 'analytics' && <AnalyticsView />}

          {activeView === 'launchkit' && <LaunchKitView />}
        </main>
      </div>

      {/* Live REST API Console Modal */}
      <ApiConsoleModal
        isOpen={isApiConsoleOpen}
        onClose={() => setIsApiConsoleOpen(false)}
        catalog={catalog}
        selectedItem={selectedItem}
        onHybridSearch={handleHybridSearch}
        onGetRecommendations={handleGetRecommendations}
      />

      {/* Bulk CSV Import / Export Studio Modal */}
      <CsvImporterModal
        isOpen={isCsvModalOpen}
        project={csvProjectAdapter}
        onClose={() => setIsCsvModalOpen(false)}
        onImportConcepts={handleImportCsvConcepts}
        onShowToast={addToast}
      />

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
