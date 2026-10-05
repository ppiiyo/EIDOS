import React, { useState, useMemo, useEffect } from 'react';
import { CatalogItem } from './types';
import { INITIAL_CATALOG } from './data/catalog';
import { Header, AppViewTab } from './components/Header';
import { VectorSpace3D } from './components/VectorSpace3D';
import { AdaptiveStudioView } from './components/AdaptiveStudioView';
import { MultiInterestView } from './components/MultiInterestView';
import { BanditsView } from './components/BanditsView';
import { HnswView } from './components/HnswView';
import { SteeringView } from './components/SteeringView';
import { BenchmarksView } from './components/BenchmarksView';
import {
  Globe2,
  Sliders,
  Layers,
  Zap,
  Network,
  Compass,
  Activity,
} from 'lucide-react';

const STORAGE_TAB_KEY = 'eidos.activeTab.v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppViewTab>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TAB_KEY);
      if (
        saved &&
        [
          'vector-space-3d',
          'workbench',
          'multi-interest',
          'bandits',
          'hnsw-quant',
          'steering',
          'benchmarks',
        ].includes(saved)
      ) {
        return saved as AppViewTab;
      }
    } catch {
      // ignore
    }
    return 'vector-space-3d';
  });

  const [catalog] = useState<CatalogItem[]>(INITIAL_CATALOG);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(1);
  const [seedItem, setSeedItem] = useState<CatalogItem | null>(() => INITIAL_CATALOG[0] || null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TAB_KEY, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab]);

  // Generate deterministic 384-dimensional unit embeddings for all items
  const embeddings = useMemo(() => {
    const map = new Map<number, Float32Array>();
    const dim = 384;

    catalog.forEach((item, idx) => {
      const vec = new Float32Array(dim);
      let sumSq = 0;

      // Base categorical cluster orientation in hyperspace
      const catHash = item.category.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const seed = item.id * 31 + catHash;

      for (let d = 0; d < dim; d++) {
        // Pseudo-random deterministic Gaussian projection
        const val =
          Math.sin(d * 0.17 + seed * 0.31) * 0.5 +
          Math.cos(d * 0.37 + (seed % 17) * 0.83) * 0.5 +
          (d % 6 === item.id % 6 ? 0.7 : 0.0);
        vec[d] = val;
        sumSq += val * val;
      }

      // L2 Normalization to unit hypersphere
      const norm = Math.sqrt(sumSq) || 1;
      for (let d = 0; d < dim; d++) {
        vec[d] /= norm;
      }

      map.set(item.id, vec);
    });

    return map;
  }, [catalog]);

  const handleSelectSeed = (item: CatalogItem) => {
    setSeedItem(item);
    setSelectedItemId(item.id);
    setActiveTab('workbench');
  };

  const mobileTabs = [
    { id: 'vector-space-3d' as const, label: '3D Space', icon: Globe2 },
    { id: 'workbench' as const, label: 'Studio', icon: Sliders },
    { id: 'multi-interest' as const, label: 'Capsules', icon: Layers },
    { id: 'bandits' as const, label: 'Bandits', icon: Zap },
    { id: 'hnsw-quant' as const, label: 'HNSW', icon: Network },
    { id: 'steering' as const, label: 'Steering', icon: Compass },
    { id: 'benchmarks' as const, label: 'Metrics', icon: Activity },
  ];

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#07070c] text-[#e8e8f0]">
      {/* Top Enterprise Navigation Header */}
      <Header
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        catalogCount={catalog.length}
      />

      {/* Main Interactive Stage */}
      <main className="flex-1 w-full h-full relative overflow-hidden">
        {activeTab === 'vector-space-3d' && (
          <VectorSpace3D
            catalog={catalog}
            embeddings={embeddings}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onSetAsSeed={handleSelectSeed}
          />
        )}

        {activeTab === 'workbench' && (
          <AdaptiveStudioView
            catalog={catalog}
            embeddings={embeddings}
            seedItem={seedItem}
            onSelectSeed={setSeedItem}
          />
        )}

        {activeTab === 'multi-interest' && (
          <MultiInterestView catalog={catalog} embeddings={embeddings} />
        )}

        {activeTab === 'bandits' && <BanditsView catalog={catalog} />}

        {activeTab === 'hnsw-quant' && (
          <HnswView catalog={catalog} embeddings={embeddings} />
        )}

        {activeTab === 'steering' && (
          <SteeringView catalog={catalog} embeddings={embeddings} />
        )}

        {activeTab === 'benchmarks' && <BenchmarksView />}
      </main>

      {/* Mobile Responsive Navigation Bar (< lg screens) */}
      <nav className="lg:hidden flex items-center justify-around h-14 bg-[#090912]/95 border-t border-[#1b1b2f] backdrop-blur-md px-2 z-30 shrink-0">
        {mobileTabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-mono transition-colors ${
                isActive ? 'text-cyan-400 font-semibold' : 'text-[#6c6c88]'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
