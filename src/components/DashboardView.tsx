import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Lightbulb,
  Split,
  MessageSquare,
  BarChart3,
  Rocket,
  Activity,
  ArrowRight,
  Play,
  CheckCircle2,
  Boxes,
  Sliders,
  Layers,
  Database,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import { CatalogItem, HybridSearchHit } from '../types';
import { ViewId } from './Sidebar';
import { getEvents } from '../lib/analytics/tracker';
import { listExperiments } from '../lib/ab-testing/engine';
import {
  getOrBuildCatalogHNSWIndex,
  benchmarkHnswVsLinear,
  computeCategoryEntropy,
} from '../utils/recommenderEngine';

interface DashboardViewProps {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  selectedItem: CatalogItem | null;
  isScaledCatalog: boolean;
  onNavigate: (view: ViewId) => void;
  onSearch: (query: string) => Promise<CatalogItem[]>;
  onSelectItem: (item: CatalogItem) => void;
  onScaleCatalog: (targetCount: number) => void;
  onRestoreCatalog: () => void;
  onOpenApiConsole: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  catalog,
  embeddings,
  selectedItem,
  isScaledCatalog,
  onNavigate,
  onSearch,
  onSelectItem,
  onScaleCatalog,
  onRestoreCatalog,
  onOpenApiConsole,
}) => {
  const [quickQuery, setQuickQuery] = useState('');
  const [quickResults, setQuickResults] = useState<CatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Real HNSW Phase 2 vs Linear Brute-Force Benchmark state
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkMetrics, setBenchmarkMetrics] = useState<{
    hnswLatencyMs: number;
    linearLatencyMs: number;
    speedup: string;
    totalItems: number;
    recallTopK: number;
    qpsHnsw: number;
  } | null>(null);

  const stats = useMemo(() => {
    const events = getEvents();
    const experiments = listExperiments();
    const searches = events.filter((e) => e.type === 'search').length;
    const recs = events.filter((e) => e.type === 'recommendation').length;
    const entropy = computeCategoryEntropy(catalog);

    return {
      itemsCount: catalog.length,
      embeddingsCount: embeddings.size,
      searches,
      recs,
      entropyBits: entropy.entropyBits,
      uniqueCategories: entropy.uniqueCategories,
      activeExperiments: experiments.filter((e) => e.status === 'running').length,
    };
  }, [catalog, embeddings.size]);

  // Execute authentic HNSW Phase 2 graph search vs Linear scan benchmark
  const runAuthenticHnswBenchmark = () => {
    setIsBenchmarking(true);
    setTimeout(() => {
      const hnsw = getOrBuildCatalogHNSWIndex(catalog, embeddings);
      const firstVec =
        embeddings.get(String(selectedItem?.id || catalog[0]?.id || '1')) ||
        new Float32Array(384).fill(0.05);
      const result = benchmarkHnswVsLinear(hnsw, catalog, embeddings, firstVec, 10, 150);
      setBenchmarkMetrics(result);
      setIsBenchmarking(false);
    }, 40);
  };

  const handleQuickSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await onSearch(quickQuery.trim());
      setQuickResults(res.slice(0, 4));
    } catch {
      setQuickResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="page">
      {/* Top Executive Overview Header */}
      <div
        className="card"
        style={{
          padding: '22px 24px',
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.375rem' }}>
            Eidos Semantic Vector Workbench
          </h1>
          <p className="page-sub" style={{ margin: '4px 0 0' }}>
            384-dimensional dense embeddings · HNSW Phase 2 (Int32 + BinaryHeap) · BM25 Hybrid RRF · Adaptive Intelligence Layer
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!isScaledCatalog ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onScaleCatalog(1200)}
              title="Generate 1,200+ synthetic items with 384-d vectors to benchmark HNSW logarithmic scaling"
            >
              <Database size={14} />
              <span>Scale Catalog to 1,200 SKU (0ms)</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRestoreCatalog}
            >
              <RotateCcw size={14} />
              <span>Restore Curated Catalog (25 SKU)</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenApiConsole}
          >
            <Terminal size={14} />
            <span>Open Live REST API Console</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row (4 columns with tabular numerals) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>
              Indexed Corpus & Vectors
            </span>
            <Package size={15} color="var(--accent)" />
          </div>
          <div className="mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)' }}>
            {stats.itemsCount.toLocaleString()} SKU
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
            <span className="mono">{stats.embeddingsCount.toLocaleString()}</span> × 384-d L2 vectors active
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>
              Catalog Taxonomy Entropy
            </span>
            <Layers size={15} color="var(--success)" />
          </div>
          <div className="mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)' }}>
            H = {stats.entropyBits.toFixed(2)} bits
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
            Across <span className="mono">{stats.uniqueCategories}</span> semantic categories
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>
              Session Search & Recs
            </span>
            <Search size={15} color="var(--warning)" />
          </div>
          <div className="mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)' }}>
            {stats.searches + stats.recs} ops
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
            <span className="mono">{stats.searches}</span> hybrid queries · <span className="mono">{stats.recs}</span> MMR runs
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>
              Active A/B Experiments
            </span>
            <Split size={15} color="var(--accent)" />
          </div>
          <div className="mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)' }}>
            {stats.activeExperiments} running
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
            Deterministic FNV-1a bucket routing
          </div>
        </div>
      </div>

      {/* Main Split: Authentic HNSW Phase 2 vs Linear Benchmark & Instant Hybrid Search */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Left: Real HNSW Phase 2 vs Linear Scan Benchmark */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                  HNSW Phase 2 vs. Linear Brute-Force Benchmark
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', marginTop: 2 }}>
                  Executes 150 real 384-d queries against both the Int32 HNSW graph and full linear cosine scan
                </p>
              </div>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                O(log N) ANN
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                padding: 12,
                background: 'var(--bg-alt)',
                borderRadius: 6,
                border: '1px solid var(--border)',
                marginBottom: 14,
                fontSize: '0.75rem',
              }}
            >
              <div>
                <div style={{ color: 'var(--text-sec)' }}>Graph Topology</div>
                <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>M=16 · M0=32 · ef=48</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-sec)' }}>Neighbor Storage</div>
                <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>Flat Int32Array</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-sec)' }}>Active Corpus</div>
                <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>{catalog.length} items (384d)</div>
              </div>
            </div>

            {benchmarkMetrics && (
              <div
                style={{
                  padding: '12px 14px',
                  background: 'var(--success-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  marginBottom: 14,
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--success)' }}>
                    <CheckCircle2 size={15} />
                    <span>Verified on {benchmarkMetrics.totalItems.toLocaleString()} items (150 queries)</span>
                  </div>
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--success)' }}>
                    {benchmarkMetrics.speedup} Speedup
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-sec)' }}>HNSW p50</div>
                    <div className="mono" style={{ fontWeight: 700 }}>{benchmarkMetrics.hnswLatencyMs} ms</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-sec)' }}>Linear Scan</div>
                    <div className="mono" style={{ fontWeight: 700 }}>{benchmarkMetrics.linearLatencyMs} ms</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-sec)' }}>Recall@10</div>
                    <div className="mono" style={{ fontWeight: 700 }}>{benchmarkMetrics.recallTopK}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-sec)' }}>Throughput</div>
                    <div className="mono" style={{ fontWeight: 700 }}>{benchmarkMetrics.qpsHnsw.toLocaleString()} QPS</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={runAuthenticHnswBenchmark}
              disabled={isBenchmarking}
              style={{ flex: 1 }}
            >
              {isBenchmarking ? (
                <>
                  <Activity size={14} className="animate-spin" />
                  <span>Benchmarking HNSW vs Linear...</span>
                </>
              ) : (
                <>
                  <Play size={14} />
                  <span>Run HNSW vs Linear Benchmark</span>
                </>
              )}
            </button>
            {!isScaledCatalog && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onScaleCatalog(1200);
                }}
              >
                <span>Test on 1,200 SKU</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Instant Hybrid Vector Search Test-Drive */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                  Instant Hybrid Vector Search Preview
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)' }}>
                  Click any result to set it as the active seed anchor across 3D Space and Recommendations
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('search')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Full Search Lab →
              </button>
            </div>

            <form onSubmit={handleQuickSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                className="input"
                placeholder="Try 'интерстеллар космос', 'векторная база rust', 'кофе эспрессо'..."
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={isSearching || !quickQuery.trim()}>
                {isSearching ? '...' : <Search size={15} />}
              </button>
            </form>

            {quickResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {quickResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectItem(item);
                      onNavigate('recommendations');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
                        {item.icon} {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-sec)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.category} · {item.price || '—'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>
                      Inspect →
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: '20px 12px',
                  textAlign: 'center',
                  color: 'var(--text-mut)',
                  fontSize: '0.8125rem',
                  border: '1px dashed var(--border)',
                  borderRadius: 6,
                }}
              >
                Enter a conceptual query above or test one of the quick presets below:
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                  {['космос и черные дыры', 'киберпанк симуляция', 'быстрая база данных rust'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={async () => {
                        setQuickQuery(preset);
                        setIsSearching(true);
                        const res = await onSearch(preset);
                        setQuickResults(res.slice(0, 4));
                        setIsSearching(false);
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Studio Architecture Modules Grid */}
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
          Studio Workbench Modules
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {[
            {
              id: 'vectorspace' as ViewId,
              title: '3D Vector Space & 2D Graph',
              desc: 'WebGL 384-d hypersphere, HNSW L0–L2 layers, INT8 lattice, and 2D force topology',
              icon: Boxes,
            },
            {
              id: 'adaptive' as ViewId,
              title: 'Adaptive Intelligence Lab (AIL)',
              desc: '7-factor ranker, MIND multi-interest capsules, LinUCB bandits, and vector steering',
              icon: Sliders,
            },
            {
              id: 'search' as ViewId,
              title: 'Hybrid Search & Side-by-Side',
              desc: 'BM25 + Dense HNSW fusion with convex α control vs. legacy keyword search',
              icon: Search,
            },
            {
              id: 'recommendations' as ViewId,
              title: 'MMR Recommendations & X-Ray',
              desc: 'Maximal Marginal Relevance diversity re-ranking with Shannon entropy and factor bars',
              icon: Lightbulb,
            },
            {
              id: 'catalog' as ViewId,
              title: 'Catalog & 0ms Vector Bundles',
              desc: 'Manage SKU inventory, export 384-d JSON bundles, and batch-ingest CSV/JSON',
              icon: Package,
            },
            {
              id: 'analytics' as ViewId,
              title: 'Recharts Trends & Telemetry',
              desc: 'Temporal query volume streams, semantic topic clusters, and live CTR conversion',
              icon: BarChart3,
            },
            {
              id: 'abtest' as ViewId,
              title: 'Statistical A/B Engine',
              desc: 'Two-tailed Z-test significance evaluation across ranking strategies',
              icon: Split,
            },
            {
              id: 'conversational' as ViewId,
              title: 'Conversational Vector Agent',
              desc: 'Natural language shopping assistant with intent extraction and latent space shifts',
              icon: MessageSquare,
            },
          ].map(({ id, title, desc, icon: Icon }) => (
            <div
              key={id}
              className="card"
              onClick={() => onNavigate(id)}
              style={{
                padding: 16,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Icon size={16} color="var(--accent)" />
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{title}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-sec)', margin: 0, lineHeight: 1.45 }}>
                  {desc}
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.75rem',
                  color: 'var(--accent)',
                  fontWeight: 600,
                  marginTop: 12,
                }}
              >
                <span>Open module</span>
                <ArrowRight size={12} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
