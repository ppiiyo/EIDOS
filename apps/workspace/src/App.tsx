import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import { CatalogItem, CatalogRecommendation, HybridSearchHit, ToastItem, Project } from './types';
import { INITIAL_CATALOG } from './data/catalog';
import {
  PLATFORM_DOMAIN_PRESETS,
  PlatformDomainId,
  PlatformDomainPreset,
} from './data/domainDatabases';
import {
  computeTextEmbedding,
  cosineSimilarity,
  generateSemanticExplanation,
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
import { DatabaseConnectorModal } from './components/DatabaseConnectorModal';
import { ToastContainer } from './components/ToastContainer';
import { ConversationalAgent } from './lib/agent/conversational-agent';
import { trackEvent } from './lib/analytics/tracker';
import { Sun, Moon, Terminal, FileSpreadsheet, Database } from 'lucide-react';

const STORAGE_CATALOG_KEY = 'eidos_catalog_v3';
const STORAGE_DOMAIN_KEY = 'eidos_domain_v3';
const STORAGE_VIEW_KEY = 'eidos_active_view_v3';
const STORAGE_THEME_KEY = 'eidos_theme_v3';

let embedderPromise: Promise<FeatureExtractionPipeline> | null = null;
let embedderFailed = false;
function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (embedderFailed) {
    return Promise.reject(new Error('Embedder fallback active'));
  }
  if (!embedderPromise) {
    const loadPromise = pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true }
    );
    const timeoutPromise = new Promise<FeatureExtractionPipeline>((_, reject) =>
      setTimeout(() => {
        embedderFailed = true;
        reject(new Error('Model network timeout'));
      }, 2500)
    );
    embedderPromise = Promise.race([loadPromise, timeoutPromise]).catch((err) => {
      embedderFailed = true;
      throw err;
    });
  }
  return embedderPromise;
}

export async function computeRealEmbedding(text: string): Promise<Float32Array> {
  const multilingualVec = computeTextEmbedding(text);
  const hasNonAscii = /[^\u0000-\u007f]/.test(text);

  try {
    const embedder = await getEmbedder();
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    const modelVec = new Float32Array(output.data as ArrayLike<number>);

    if (!hasNonAscii) {
      return modelVec;
    }

    const fused = new Float32Array(384);
    let sumSq = 0;
    for (let i = 0; i < 384; i++) {
      fused[i] = 0.72 * multilingualVec[i] + 0.28 * (modelVec[i] || 0);
      sumSq += fused[i] * fused[i];
    }
    const norm = Math.sqrt(sumSq) || 1e-6;
    for (let i = 0; i < 384; i++) {
      fused[i] /= norm;
    }
    return fused;
  } catch {
    return multilingualVec;
  }
}

export default function App() {
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

  const [activeDomain, setActiveDomain] = useState<PlatformDomainId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DOMAIN_KEY) as PlatformDomainId;
      if (saved && ['marketplace', 'streaming', 'video_jp', 'global_multilingual'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'marketplace';
  });

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

  useEffect(() => {
    if (!isScaledCatalog) {
      try {
        localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(catalog));
      } catch {
        // ignore
      }
    }
  }, [catalog, isScaledCatalog]);

  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(() => catalog[0] || null);

  useEffect(() => {
    if (!selectedItem && catalog.length > 0) {
      setSelectedItem(catalog[0]);
    }
  }, [catalog, selectedItem]);

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

  const [isApiConsoleOpen, setIsApiConsoleOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isDbConnectorOpen, setIsDbConnectorOpen] = useState(false);

  const [embeddings, setEmbeddings] = useState<Map<string, Float32Array>>(() => {
    const map = new Map<string, Float32Array>();
    for (const item of catalog) {
      map.set(
        String(item.id),
        computeTextEmbedding(`passage: ${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`)
      );
    }
    return map;
  });
  const [embeddingStatus, setEmbeddingStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    if (isScaledCatalog) return;
    let cancelled = false;
    setEmbeddingStatus('loading');

    const immediateMap = new Map<string, Float32Array>();
    for (const item of catalog) {
      immediateMap.set(
        String(item.id),
        computeTextEmbedding(`passage: ${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`)
      );
    }
    setEmbeddings(immediateMap);

    (async () => {
      const map = new Map<string, Float32Array>(immediateMap);
      let usedModel = false;

      for (let i = 0; i < catalog.length; i++) {
        if (cancelled) return;
        const item = catalog[i];
        const fullText = `${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`;
        try {
          const vec = await computeRealEmbedding(fullText);
          map.set(String(item.id), vec);
          usedModel = true;
          if (i % 5 === 0) {
            if (!cancelled) {
              setEmbeddings(new Map(map));
            }
            await new Promise((r) => setTimeout(r, 0));
          }
        } catch {
          map.set(String(item.id), computeTextEmbedding(`passage: ${fullText}`));
        }
      }

      if (!cancelled) {
        setEmbeddings(map);
        setEmbeddingStatus(usedModel ? 'ready' : 'fallback');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalog, isScaledCatalog]);

  const computeQueryVector = useCallback(
    async (query: string): Promise<Float32Array> => {
      const trimmed = query.trim();
      if (embeddingStatus === 'ready') {
        try {
          return await computeRealEmbedding(`query: ${trimmed}`);
        } catch {
          return computeTextEmbedding(`query: ${trimmed}`);
        }
      }
      return computeTextEmbedding(`query: ${trimmed}`);
    },
    [embeddingStatus]
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
        embeddings,
        alpha,
        limit
      );
    },
    [catalog, embeddings, computeQueryVector]
  );

  const handleSearch = useCallback(
    async (query: string, limit = 8): Promise<CatalogItem[]> => {
      const hits = await handleHybridSearch(query, 0.7, limit);
      return hits.map((h) => h.item);
    },
    [handleHybridSearch]
  );

  const handleGetRecommendations = useCallback(
    async (
      targetItem: CatalogItem,
      diversity = 0.35,
      limit = 6
    ): Promise<CatalogRecommendation[]> => {
      const targetVec = embeddings.get(String(targetItem.id));
      if (!targetVec) return [];

      const candidates = catalog.filter((c) => String(c.id) !== String(targetItem.id));
      if (candidates.length === 0) return [];

      const candSims = new Map<string, number>();
      for (const c of candidates) {
        const cVec = embeddings.get(String(c.id));
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
            const candVec = embeddings.get(String(cand.id));
            if (candVec) {
              for (const sel of selected) {
                const selVec = embeddings.get(String(sel.id));
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
    [catalog, embeddings]
  );

  const conversationalAgent = useMemo(() => {
    return new ConversationalAgent(catalog, handleSearch);
  }, [catalog, handleSearch]);

  useEffect(() => {
    conversationalAgent.setCatalog(catalog);
  }, [catalog, conversationalAgent]);

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

  const handleSelectDomainPreset = useCallback(
    (preset: PlatformDomainPreset) => {
      const itemsWithStrIds = preset.items.map((item) => ({
        ...item,
        id: String(item.id),
      }));
      setIsScaledCatalog(false);
      setActiveDomain(preset.id);
      setCatalog(itemsWithStrIds);
      setSelectedItem(itemsWithStrIds[0] || null);
      try {
        localStorage.setItem(STORAGE_DOMAIN_KEY, preset.id);
      } catch {
        // ignore
      }
      addToast(
        `Подключена база «${preset.name}» (${itemsWithStrIds.length} объектов · ${preset.languageLabel})`,
        'success'
      );
    },
    [addToast]
  );

  const handleImportCustomDatabase = useCallback(
    (items: CatalogItem[], label = 'Custom Database') => {
      const itemsWithStrIds = items.map((item) => ({
        ...item,
        id: String(item.id),
      }));
      setIsScaledCatalog(false);
      setCatalog(itemsWithStrIds);
      setSelectedItem(itemsWithStrIds[0] || null);
      addToast(
        `Подключена база «${label}» (${itemsWithStrIds.length} объектов проиндексировано в 384-d HNSW)`,
        'success'
      );
    },
    [addToast]
  );

  const handleAddItem = (newItem: CatalogItem) => {
    const itemWithStrId: CatalogItem = { ...newItem, id: String(newItem.id) };
    setCatalog((prev) => [itemWithStrId, ...prev]);
    setSelectedItem(itemWithStrId);
    trackEvent({ type: 'item_view', itemId: itemWithStrId.id, category: itemWithStrId.category });
    addToast(`Added «${itemWithStrId.title}» (384-d vector indexed)`, 'success');
  };

  const handleDeleteItem = (id: string) => {
    setCatalog((c) => c.filter((item) => item.id !== id));
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
    setEmbeddings(combinedEmbeddings);
    addToast(`Scaled corpus to ${combinedCatalog.length.toLocaleString()} SKU with 384-d HNSW index`, 'success');
  };

  const handleRestoreCatalog = () => {
    const preset = PLATFORM_DOMAIN_PRESETS.find((p) => p.id === activeDomain) || PLATFORM_DOMAIN_PRESETS[0];
    const base = preset.items.map((item) => ({ ...item, id: String(item.id) }));
    setIsScaledCatalog(false);
    setCatalog(base);
    setSelectedItem(base[0]);
    addToast(`Restored ${preset.name} (${base.length} SKU)`, 'info');
  };

  const handleImportVectorBundle = (
    items: CatalogItem[],
    importedEmbeddings: Map<string, Float32Array>
  ) => {
    setIsScaledCatalog(false);
    setCatalog(items.map((item) => ({ ...item, id: String(item.id) })));
    if (importedEmbeddings.size > 0) {
      setEmbeddings(importedEmbeddings);
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
      name: 'Eidos Semantic Catalog',
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
        return 'Eidos Studio';
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-alt)', color: 'var(--text)' }}>
      <Sidebar active={activeView} onNavigate={handleNavigate} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>Eidos</span>
            <span style={{ color: 'var(--border-hi)' }}>/</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getViewTitle(activeView)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span className="badge badge-accent" data-testid="embedding-status-badge">
              {embeddingStatus === 'ready'
                ? '🧠 Model: MiniLM + E5-CJK'
                : embeddingStatus === 'loading'
                ? '⏳ Loading model...'
                : '⚡ Engine: E5-Multilingual 384d'}
            </span>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsDbConnectorOpen(true)}
              data-testid="header-connect-db-btn"
              title="Подключить базу маркетплейса, стриминга или видеохостинга (100+ языков, включая японский 日本語)"
            >
              <Database size={13} />
              <span>Подключить базу / Язык</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsCsvModalOpen(true)}
            >
              <FileSpreadsheet size={13} />
              <span>CSV Studio</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsApiConsoleOpen(true)}
            >
              <Terminal size={13} />
              <span>API Console</span>
            </button>

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

        <main style={{ flex: 1, overflowY: 'auto' }}>
          {activeView === 'dashboard' && (
            <DashboardView
              catalog={catalog}
              embeddings={embeddings}
              selectedItem={selectedItem}
              isScaledCatalog={isScaledCatalog}
              activeDomain={activeDomain}
              onNavigate={handleNavigate}
              onSearch={handleSearch}
              onSelectItem={(item) => {
                setSelectedItem(item);
                handleNavigate('recommendations');
              }}
              onScaleCatalog={handleScaleCatalog}
              onRestoreCatalog={handleRestoreCatalog}
              onOpenApiConsole={() => setIsApiConsoleOpen(true)}
              onSelectDomainPreset={handleSelectDomainPreset}
              onOpenDatabaseConnector={() => setIsDbConnectorOpen(true)}
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
              embeddings={embeddings}
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
                embeddings={embeddings}
                selectedItem={selectedItem || catalog[0]}
                onSelectItem={(item) => setSelectedItem(item)}
              />
            </div>
          )}

          {activeView === 'catalog' && (
            <CatalogView
              catalog={catalog}
              embeddings={embeddings}
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

      <ApiConsoleModal
        isOpen={isApiConsoleOpen}
        onClose={() => setIsApiConsoleOpen(false)}
        catalog={catalog}
        selectedItem={selectedItem}
        onHybridSearch={handleHybridSearch}
        onGetRecommendations={handleGetRecommendations}
      />

      <DatabaseConnectorModal
        isOpen={isDbConnectorOpen}
        activeDomain={activeDomain}
        catalogCount={catalog.length}
        onClose={() => setIsDbConnectorOpen(false)}
        onSelectDomainPreset={handleSelectDomainPreset}
        onImportCustomDatabase={handleImportCustomDatabase}
      />

      <CsvImporterModal
        isOpen={isCsvModalOpen}
        project={csvProjectAdapter}
        onClose={() => setIsCsvModalOpen(false)}
        onImportConcepts={handleImportCsvConcepts}
        onShowToast={addToast}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
