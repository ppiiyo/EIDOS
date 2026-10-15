import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CatalogItem, CatalogRecommendation, ToastItem } from './types';
import { INITIAL_CATALOG } from './data/catalog';
import {
  computeTextEmbedding,
  cosineSimilarity,
  generateSemanticExplanation,
} from './utils/recommenderEngine';
import { Sidebar, ViewId } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { CatalogView } from './components/CatalogView';
import { SearchView } from './components/SearchView';
import { RecommendationsView } from './components/RecommendationsView';
import { ABTestView } from './components/ABTestView';
import { ConversationalView } from './components/ConversationalView';
import { AnalyticsView } from './components/AnalyticsView';
import { LaunchKitView } from './components/LaunchKitView';
import { MemoryMonitor } from './components/MemoryMonitor';
import { ToastContainer } from './components/ToastContainer';
import { ConversationalAgent } from './lib/agent/conversational-agent';
import { trackEvent } from './lib/analytics/tracker';

const STORAGE_CATALOG_KEY = 'eidos_catalog_v3';
const STORAGE_VIEW_KEY = 'eidos_active_view_v3';

export default function App() {
  // 1. Catalog State
  const [catalog, setCatalog] = useState<CatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CATALOG_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_CATALOG;
  });

  // Persist catalog changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CATALOG_KEY, JSON.stringify(catalog));
    } catch {
      // ignore
    }
  }, [catalog]);

  // 2. Active View Navigation
  const [activeView, setActiveView] = useState<ViewId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_VIEW_KEY) as ViewId;
      if (
        saved &&
        [
          'dashboard',
          'catalog',
          'search',
          'recommendations',
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

  // 3. Dense 384-dimensional Embeddings Map
  const catalogEmbeddings = useMemo(() => {
    const map = new Map<number, Float32Array>();
    for (const item of catalog) {
      const textToEmbed = `passage: ${item.title} ${item.description} ${item.category} ${item.tags?.join(' ') || ''}`;
      map.set(item.id, computeTextEmbedding(textToEmbed));
    }
    return map;
  }, [catalog]);

  // 4. Real Semantic Search Implementation
  const handleSearch = useCallback(
    async (query: string, limit = 8): Promise<CatalogItem[]> => {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const queryVec = computeTextEmbedding(`query: ${trimmed}`);
      const scored: { item: CatalogItem; sim: number }[] = [];

      for (const item of catalog) {
        const itemVec = catalogEmbeddings.get(item.id);
        if (itemVec) {
          const sim = cosineSimilarity(queryVec, itemVec);
          scored.push({ item, sim });
        }
      }

      scored.sort((a, b) => b.sim - a.sim);
      return scored.slice(0, limit).map((s) => s.item);
    },
    [catalog, catalogEmbeddings]
  );

  // 5. Real MMR (Maximal Marginal Relevance) Recommendation Implementation
  const handleGetRecommendations = useCallback(
    async (
      targetItem: CatalogItem,
      diversity = 0.3,
      limit = 6
    ): Promise<CatalogRecommendation[]> => {
      const targetVec = catalogEmbeddings.get(targetItem.id);
      if (!targetVec) return [];

      // Candidates (all except target item)
      const candidates = catalog.filter((c) => c.id !== targetItem.id);
      if (candidates.length === 0) return [];

      // Compute similarity of all candidates to target item
      const candSims = new Map<number, number>();
      for (const c of candidates) {
        const cVec = catalogEmbeddings.get(c.id);
        if (cVec) {
          candSims.set(c.id, cosineSimilarity(targetVec, cVec));
        }
      }

      // Greedy MMR selection
      const selected: CatalogItem[] = [];
      const remaining = [...candidates];

      while (selected.length < limit && remaining.length > 0) {
        let bestScore = -Infinity;
        let bestIndex = -1;

        for (let i = 0; i < remaining.length; i++) {
          const cand = remaining[i];
          const simToTarget = candSims.get(cand.id) ?? 0;

          // Max similarity to already selected items
          let maxSimToSelected = 0;
          if (selected.length > 0) {
            const candVec = catalogEmbeddings.get(cand.id);
            if (candVec) {
              for (const sel of selected) {
                const selVec = catalogEmbeddings.get(sel.id);
                if (selVec) {
                  const s = cosineSimilarity(candVec, selVec);
                  if (s > maxSimToSelected) maxSimToSelected = s;
                }
              }
            }
          }

          // MMR formula: (1 - λ) * simToTarget - λ * maxSimToSelected
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
        sim: candSims.get(item.id) ?? 0,
        whyRecommended: generateSemanticExplanation(targetItem, item),
      }));
    },
    [catalog, catalogEmbeddings]
  );

  // 6. Conversational Agent Instance
  const conversationalAgent = useMemo(() => {
    return new ConversationalAgent(catalog, handleSearch);
  }, [catalog, handleSearch]);

  // Keep agent catalog in sync
  useEffect(() => {
    conversationalAgent.setCatalog(catalog);
  }, [catalog, conversationalAgent]);

  // 7. Catalog Management Actions
  const handleAddItem = (newItem: CatalogItem) => {
    setCatalog((prev) => [newItem, ...prev]);
    trackEvent({ type: 'item_view', itemId: newItem.id, category: newItem.category });
    addToast(`Added «${newItem.title}» to catalog`, 'success');
  };

  const handleDeleteItem = (id: number) => {
    setCatalog((prev) => prev.filter((item) => item.id !== id));
    addToast('Item removed from catalog', 'info');
  };

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

  const getViewTitle = (view: ViewId): string => {
    switch (view) {
      case 'dashboard':
        return 'System Overview';
      case 'catalog':
        return 'Catalog Management';
      case 'search':
        return 'Semantic Search';
      case 'recommendations':
        return 'Recommendations Engine';
      case 'abtest':
        return 'A/B Testing Experiments';
      case 'conversational':
        return 'Conversational Assistant';
      case 'analytics':
        return 'Session Analytics';
      case 'launchkit':
        return 'Launch Kit';
      default:
        return 'EIDOS RecSys';
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-alt)' }}>
      {/* 1. Left Sidebar Navigation */}
      <Sidebar active={activeView} onNavigate={handleNavigate} />

      {/* 2. Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Top Header Bar with Real-time Memory Monitor and System State */}
        <header
          style={{
            height: 56,
            background: '#fff',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          {/* Breadcrumb / Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)' }}>EIDOS</span>
            <span style={{ color: 'var(--border-hi)' }}>/</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)' }}>
              {getViewTitle(activeView)}
            </span>
          </div>

          {/* Right Header Status: Memory Monitor & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                background: 'var(--bg-alt)',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              <MemoryMonitor />
            </div>

            <span
              className="badge badge-neutral"
              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            >
              {catalog.length} items
            </span>
          </div>
        </header>

        {/* Dynamic View Canvas */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {activeView === 'dashboard' && (
            <DashboardView
              catalog={catalog}
              embeddings={catalogEmbeddings}
              onNavigate={handleNavigate}
              onSearch={handleSearch}
              onSelectItem={() => handleNavigate('recommendations')}
            />
          )}

          {activeView === 'catalog' && (
            <CatalogView
              catalog={catalog}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onSelectItem={() => handleNavigate('recommendations')}
            />
          )}

          {activeView === 'search' && (
            <SearchView
              onSearch={handleSearch}
              onSelectItem={() => handleNavigate('recommendations')}
            />
          )}

          {activeView === 'recommendations' && (
            <RecommendationsView
              catalog={catalog}
              onGetRecommendations={handleGetRecommendations}
              onSelectItem={() => handleNavigate('recommendations')}
            />
          )}

          {activeView === 'abtest' && <ABTestView />}

          {activeView === 'conversational' && (
            <ConversationalView
              agent={conversationalAgent}
              onSelectItem={() => handleNavigate('recommendations')}
            />
          )}

          {activeView === 'analytics' && <AnalyticsView />}

          {activeView === 'launchkit' && <LaunchKitView />}
        </main>
      </div>

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
