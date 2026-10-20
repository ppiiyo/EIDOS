import React, { useState, useMemo } from 'react';
import {
  Package,
  Search,
  Lightbulb,
  Split,
  MessageSquare,
  BarChart3,
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
  Globe,
} from 'lucide-react';
import { CatalogItem } from '../types';
import { ViewId } from './Sidebar';
import { getEvents } from '../lib/analytics/tracker';
import { listExperiments } from '../lib/ab-testing/engine';
import {
  getOrBuildCatalogHNSWIndex,
  benchmarkHnswVsLinear,
  computeCategoryEntropy,
  detectTextLanguage,
} from '../utils/recommenderEngine';
import {
  PLATFORM_DOMAIN_PRESETS,
  PlatformDomainId,
  PlatformDomainPreset,
} from '../data/domainDatabases';
import { UiLanguage, UI_TRANSLATIONS } from '../i18n/uiTranslations';

interface DashboardViewProps {
  catalog: CatalogItem[];
  embeddings: Map<string, Float32Array>;
  selectedItem: CatalogItem | null;
  isScaledCatalog: boolean;
  activeDomain?: PlatformDomainId;
  uiLang?: UiLanguage;
  onNavigate: (view: ViewId) => void;
  onSearch: (query: string) => Promise<CatalogItem[]>;
  onSelectItem: (item: CatalogItem) => void;
  onScaleCatalog: (targetCount: number) => void;
  onRestoreCatalog: () => void;
  onOpenApiConsole: () => void;
  onSelectDomainPreset?: (preset: PlatformDomainPreset) => void;
  onOpenDatabaseConnector?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  catalog,
  embeddings,
  selectedItem,
  isScaledCatalog,
  activeDomain = 'marketplace',
  uiLang = 'ru',
  onNavigate,
  onSearch,
  onSelectItem,
  onScaleCatalog,
  onRestoreCatalog,
  onOpenApiConsole,
  onSelectDomainPreset,
  onOpenDatabaseConnector,
}) => {
  const t = UI_TRANSLATIONS[uiLang].dashboard;

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

  const dominantLang = useMemo(() => {
    const sample = catalog
      .slice(0, 4)
      .map((i) => `${i.title} ${i.description}`)
      .join(' ');
    return detectTextLanguage(sample);
  }, [catalog]);

  const quickPresets = useMemo(() => {
    if (dominantLang === 'ja') {
      return [
        '宇宙とブラックホールの科学',
        'サイバーパンク2077 ゲーム実況',
        'Rust 高速データベース開発',
        '京都 カフェ エスプレッソ',
      ];
    }
    if (dominantLang === 'en') {
      return [
        'relativistic time and black holes',
        'cyberpunk neural simulation',
        'rust vector database',
      ];
    }
    return ['космос и черные дыры', 'киберпанк симуляция', 'быстрая база данных rust'];
  }, [dominantLang]);

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
          marginBottom: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0, fontSize: '1.375rem' }}>
            {t.title}
          </h1>
          <p className="page-sub" style={{ margin: '4px 0 0' }}>
            {t.subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {onOpenDatabaseConnector && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onOpenDatabaseConnector}
              data-testid="open-db-connector-btn"
            >
              <Globe size={14} />
              <span>{t.connectDbBtn}</span>
            </button>
          )}

          {!isScaledCatalog ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onScaleCatalog(1200)}
              title="Generate 1,200+ synthetic items with 384-d vectors to benchmark HNSW logarithmic scaling"
            >
              <Database size={14} />
              <span>{t.scaleBtn}</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRestoreCatalog}
            >
              <RotateCcw size={14} />
              <span>{t.restoreBtn}</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onOpenApiConsole}
          >
            <Terminal size={14} />
            <span>{t.openApiBtn}</span>
          </button>
        </div>
      </div>

      {/* 1-Click Industry Platform & Multilingual Database Switcher */}
      {onSelectDomainPreset && (
        <div
          className="card"
          style={{
            padding: '12px 18px',
            marginBottom: 20,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={15} color="var(--accent)" />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>
              {t.platformDomainLabel}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {PLATFORM_DOMAIN_PRESETS.map((preset) => {
              const active = activeDomain === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`switch-domain-${preset.id}`}
                  onClick={() => {
                    setQuickResults([]);
                    onSelectDomainPreset(preset);
                  }}
                  className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                >
                  <span>{preset.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
              {t.kpiCorpusTitle}
            </span>
            <Package size={15} color="var(--accent)" />
          </div>
          <div className="mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)' }}>
            {stats.itemsCount.toLocaleString()} SKU
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
            <span className="mono">{stats.embeddingsCount.toLocaleString()}</span> × 384-d L2 ({dominantLang.toUpperCase()})
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>
              {t.kpiEntropyTitle}
            </span>
            <Layers size={15} color="var(--success)" />
          </div>
          <div className="mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)' }}>
            H = {stats.entropyBits.toFixed(2)} bits
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
            {t.kpiEntropySub} <span className="mono">{stats.uniqueCategories}</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>
              {t.kpiOpsTitle}
            </span>
            <Search size={15} color="var(--warning)" />
          </div>
          <div className="mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)' }}>
            {stats.searches + stats.recs} ops
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
            <span className="mono">{stats.searches}</span> / <span className="mono">{stats.recs}</span> {t.kpiOpsSub}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', fontWeight: 500 }}>
              {t.kpiAbTitle}
            </span>
            <Split size={15} color="var(--accent)" />
          </div>
          <div className="mono" style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--text)' }}>
            {stats.activeExperiments} running
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginTop: 4 }}>
            {t.kpiAbSub}
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
                  {t.benchTitle}
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)', marginTop: 2 }}>
                  {t.benchSub}
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
                <div style={{ color: 'var(--text-sec)' }}>{t.benchTopology}</div>
                <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>M=16 · M0=32 · ef=48</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-sec)' }}>{t.benchStorage}</div>
                <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>Flat Int32Array</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-sec)' }}>{t.benchActiveCorpus}</div>
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
                    <span>
                      {t.benchVerified} {benchmarkMetrics.totalItems.toLocaleString()} SKU (150 queries)
                    </span>
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
                  <span>{t.benchRunningBtn}</span>
                </>
              ) : (
                <>
                  <Play size={14} />
                  <span>{t.benchRunBtn}</span>
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
                <span>{t.benchTest1200}</span>
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
                  {t.quickSearchTitle} ({dominantLang.toUpperCase()})
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-sec)' }}>
                  {t.quickSearchSub}
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
                {t.quickSearchLabLink}
              </button>
            </div>

            <form onSubmit={handleQuickSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                className="input"
                placeholder={t.quickSearchPlaceholder}
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
                      {t.inspectBtn}
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
                {t.quickSearchEmptyHint}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                  {quickPresets.map((preset) => (
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
          {t.modulesTitle}
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
              title: t.modules.vectorspace.title,
              desc: t.modules.vectorspace.desc,
              icon: Boxes,
            },
            {
              id: 'adaptive' as ViewId,
              title: t.modules.adaptive.title,
              desc: t.modules.adaptive.desc,
              icon: Sliders,
            },
            {
              id: 'search' as ViewId,
              title: t.modules.search.title,
              desc: t.modules.search.desc,
              icon: Search,
            },
            {
              id: 'recommendations' as ViewId,
              title: t.modules.recommendations.title,
              desc: t.modules.recommendations.desc,
              icon: Lightbulb,
            },
            {
              id: 'catalog' as ViewId,
              title: t.modules.catalog.title,
              desc: t.modules.catalog.desc,
              icon: Package,
            },
            {
              id: 'analytics' as ViewId,
              title: t.modules.analytics.title,
              desc: t.modules.analytics.desc,
              icon: BarChart3,
            },
            {
              id: 'abtest' as ViewId,
              title: t.modules.abtest.title,
              desc: t.modules.abtest.desc,
              icon: Split,
            },
            {
              id: 'conversational' as ViewId,
              title: t.modules.conversational.title,
              desc: t.modules.conversational.desc,
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
                <span>{t.openModule}</span>
                <ArrowRight size={12} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
