import React, { useState, useMemo, useEffect } from "react";
import { Search, Database, RotateCcw, Terminal, Globe, HelpCircle } from 'lucide-react';
import { CatalogItem } from '../types';
import { ViewId } from './Sidebar';
import { getEvents, subscribeAnalytics } from '../lib/analytics/tracker';
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
import { HnswBenchmarkCard } from './dashboard/HnswBenchmarkCard';
import { DashboardKpiGrid, DashboardModulesGrid } from './dashboard/DashboardKpiGrid';

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
  catalog, embeddings, selectedItem, isScaledCatalog, activeDomain = 'marketplace',
  uiLang = 'ru', onNavigate, onSearch, onSelectItem, onScaleCatalog,
  onRestoreCatalog, onOpenApiConsole, onSelectDomainPreset, onOpenDatabaseConnector,
}) => {
  const t = UI_TRANSLATIONS[uiLang].dashboard;
  const [quickQuery, setQuickQuery] = useState('');
  const [quickResults, setQuickResults] = useState<CatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [telemetryTick, setTelemetryTick] = useState(0);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkMetrics, setBenchmarkMetrics] = useState<{
    hnswLatencyMs: number; linearLatencyMs: number; speedup: string;
    totalItems: number; recallTopK: number; qpsHnsw: number;
  } | null>(null);

  useEffect(() => subscribeAnalytics(() => setTelemetryTick((n) => n + 1)), []);

  const dominantLang = useMemo(() => {
    const sample = catalog.slice(0, 4).map((i) => `${i.title} ${i.description}`).join(' ');
    return detectTextLanguage(sample);
  }, [catalog]);

  const quickPresets = useMemo(() => {
    if (dominantLang === 'ja') return ['宇宙とブラックホールの科学', 'サイバーパンク2077 ゲーム実況', 'Rust 高速データベース開発'];
    if (dominantLang === 'en') return ['relativistic time and black holes', 'cyberpunk neural simulation', 'rust vector database'];
    return ['космос и черные дыры', 'киберпанк симуляция', 'быстрая база данных rust'];
  }, [dominantLang]);

  const stats = useMemo(() => {
    const events = getEvents();
    const experiments = listExperiments();
    const entropy = computeCategoryEntropy(catalog);
    return {
      itemsCount: catalog.length,
      embeddingsCount: embeddings.size,
      searches: events.filter((e) => e.type === 'search').length,
      recs: events.filter((e) => e.type === 'recommendation').length,
      entropyBits: entropy.entropyBits,
      uniqueCategories: entropy.uniqueCategories,
      activeExperiments: experiments.filter((e) => e.status === 'running').length,
    };
  }, [catalog, embeddings.size, telemetryTick]);

  const runAuthenticHnswBenchmark = () => {
    setIsBenchmarking(true);
    const hnsw = getOrBuildCatalogHNSWIndex(catalog, embeddings);
    const firstVec = embeddings.get(String(selectedItem?.id || catalog[0]?.id || '1')) || new Float32Array(384).fill(0.05);
    setBenchmarkMetrics(benchmarkHnswVsLinear(hnsw, catalog, embeddings, firstVec, 10, 150));
    setIsBenchmarking(false);
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
      <div className="card px-6 py-5 mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title m-0 text-[1.375rem]">{t.title}</h1>
          <p className="page-sub mt-1">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('faq')}
            data-testid="open-faq-guide-btn"
          >
            <HelpCircle size={14} />
            <span>{uiLang === 'ru' ? 'FAQ и Гид по функциям' : 'FAQ & Feature Guide'}</span>
          </button>
          {onOpenDatabaseConnector && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenDatabaseConnector} data-testid="open-db-connector-btn">
              <Globe size={14} />
              <span>{t.connectDbBtn}</span>
            </button>
          )}
          {!isScaledCatalog ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onScaleCatalog(1200)}>
              <Database size={14} />
              <span>{t.scaleBtn}</span>
            </button>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRestoreCatalog}>
              <RotateCcw size={14} />
              <span>{t.restoreBtn}</span>
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenApiConsole}>
            <Terminal size={14} />
            <span>{t.openApiBtn}</span>
          </button>
        </div>
      </div>

      {catalog.length === 0 ? (
        <div className="card px-5 py-4 mb-5 flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-[var(--accent)]">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">
              {uiLang === 'ru'
                ? 'Пользовательская база пуста (0 SKU) — загрузите свой каталог или откройте Демо-стенд'
                : 'User database is empty (0 SKU) — upload your catalog or open the Demo Catalog'}
            </div>
            <p className="text-xs text-[var(--text-sec)] mt-0.5">
              {uiLang === 'ru'
                ? 'В основном рабочем пространстве нет предзагруженных демо-товаров. Импортируйте CSV/JSON или протестируйте все 48 SKU во вкладке «Демо-каталог».'
                : 'No preloaded demo items in the main workspace. Import CSV/JSON or test all 48 SKU in the Demo Catalog tab.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => onNavigate('search')} className="btn btn-primary btn-sm">
              <span>{uiLang === 'ru' ? '📤 Загрузить свою базу (CSV/JSON)' : '📤 Upload Own Catalog'}</span>
            </button>
            <button type="button" onClick={() => onNavigate('demo')} className="btn btn-secondary btn-sm">
              <span>{uiLang === 'ru' ? '🧪 Открыть Демо-каталог (48 SKU)' : '🧪 Open Demo Catalog (48 SKU)'}</span>
            </button>
          </div>
        </div>
      ) : (
        onSelectDomainPreset && (
          <div className="card px-4 py-3 mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Globe size={15} color="var(--accent)" />
              <span className="text-[0.8125rem] font-semibold text-[var(--text)]">{t.platformDomainLabel}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {PLATFORM_DOMAIN_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`switch-domain-${preset.id}`}
                  onClick={() => { setQuickResults([]); onSelectDomainPreset(preset); }}
                  className={activeDomain === preset.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                >
                  <span>{preset.shortLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )
      )}

      <DashboardKpiGrid stats={stats} dominantLang={dominantLang} onNavigate={onNavigate} t={t} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <HnswBenchmarkCard
          catalogLength={catalog.length}
          isScaledCatalog={isScaledCatalog}
          isBenchmarking={isBenchmarking}
          benchmarkMetrics={benchmarkMetrics}
          onRunBenchmark={runAuthenticHnswBenchmark}
          onScaleCatalog={onScaleCatalog}
          t={t}
        />

        <div className="card p-5 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--text)] mb-0.5">
                  {t.quickSearchTitle} ({dominantLang.toUpperCase()})
                </h2>
                <p className="text-[0.8125rem] text-[var(--text-sec)]">{t.quickSearchSub}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('search')}
                className="text-xs font-semibold text-[var(--accent)] cursor-pointer bg-transparent border-0"
              >
                {t.quickSearchLabLink}
              </button>
            </div>

            <form onSubmit={handleQuickSearch} className="flex gap-2 mb-3">
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
              <div className="flex flex-col gap-2">
                {quickResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      onSelectItem(item);
                      onNavigate('recommendations');
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] cursor-pointer"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-[0.8125rem] font-semibold text-[var(--text)]">
                        {item.icon} {item.title}
                      </div>
                      <div className="text-xs text-[var(--text-sec)] truncate">
                        {item.category} · {item.price || '—'}
                      </div>
                    </div>
                    <span className="text-xs text-[var(--accent)] font-semibold shrink-0">
                      {t.inspectBtn}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-5 px-3 text-center text-[var(--text-mut)] text-[0.8125rem] border border-dashed border-[var(--border)] rounded-md">
                {t.quickSearchEmptyHint}
                <div className="flex gap-1.5 justify-center flex-wrap mt-2.5">
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

      <DashboardModulesGrid onNavigate={onNavigate} t={t} />
    </div>
  );
};
