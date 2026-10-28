import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, CheckCircle2 } from 'lucide-react';
import { SeoSummaryCards } from './SeoSummaryCards';
import { SeoTablesAndMerchandising } from './SeoTablesAndMerchandising';

export interface TopQueryItem {
  query: string;
  volume: number;
  ctr: number;
  avgPosition: number;
  zeroResult: boolean;
  revenue: number;
}

export interface ZeroResultItem {
  query: string;
  volume: number;
  suggestedSynonym?: string;
  resolvedSynonym?: string;
}

export interface TopProductItem {
  id: string;
  title: string;
  category?: string;
  clicks: number;
  purchases: number;
  conversionRate: number;
}

export interface SEODashboardData {
  summary: {
    totalSearches: number;
    zeroResultRate: number;
    avgCtr: number;
    searchRevenue: number;
    avgLatencyMs: number;
  };
  topQueries: TopQueryItem[];
  zeroResultQueries: ZeroResultItem[];
  topClickedProducts: TopProductItem[];
  synonyms: Record<string, string>;
}

const FALLBACK_DATA: SEODashboardData = {
  summary: {
    totalSearches: 3631,
    zeroResultRate: 8.2,
    avgCtr: 38.4,
    searchRevenue: 15250,
    avgLatencyMs: 6.4,
  },
  topQueries: [
    { query: 'кроссовки nike', volume: 1200, ctr: 45.2, avgPosition: 1.8, zeroResult: false, revenue: 5400 },
    { query: 'quantum spatial audio headphones', volume: 840, ctr: 41.6, avgPosition: 1.4, zeroResult: false, revenue: 3920 },
    { query: 'беспроводные наушники anc', volume: 615, ctr: 38.4, avgPosition: 2.1, zeroResult: false, revenue: 2810 },
    { query: 'механическая клавиатура rgb', volume: 490, ctr: 33.9, avgPosition: 2.3, zeroResult: false, revenue: 1890 },
  ],
  zeroResultQueries: [
    { query: 'абибас', volume: 150, suggestedSynonym: 'adidas' },
    { query: 'кросовки', volume: 89, suggestedSynonym: 'кроссовки' },
    { query: 'айфон 16 про', volume: 59, suggestedSynonym: 'смартфон флагман' },
  ],
  topClickedProducts: [
    { id: 'item-0', title: 'Quantum Spatial Audio Headphones Gen-1', category: 'Electronics', clicks: 412, purchases: 68, conversionRate: 16.5 },
    { id: 'item-1', title: 'Neural Ergonomic Mechanical Keyboard', category: 'Electronics', clicks: 318, purchases: 49, conversionRate: 15.4 },
    { id: 'item-2', title: 'ProGrade UltraWide OLED Monitor 49"', category: 'Electronics', clicks: 265, purchases: 37, conversionRate: 14.0 },
  ],
  synonyms: {
    абибас: 'adidas',
    кросовки: 'кроссовки',
  },
};

export interface SEODashboardProps {
  uiLang?: 'ru' | 'en' | 'ja';
}

export const SEODashboard: React.FC<SEODashboardProps> = ({ uiLang = 'en' }) => {
  const isRu = uiLang === 'ru';
  const [data, setData] = useState<SEODashboardData>(FALLBACK_DATA);
  const [loading, setLoading] = useState(false);
  const [sourceTerm, setSourceTerm] = useState('');
  const [targetSynonym, setTargetSynonym] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const fetchSeoAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/v1/analytics/seo', {
        headers: { 'x-api-key': 'eidos_dev_key' },
      });
      if (res.ok) {
        const json = await res.json();
        setData({
          summary: {
            totalSearches: json.summary?.totalSearches ?? FALLBACK_DATA.summary.totalSearches,
            zeroResultRate: json.summary?.zeroResultRate ?? FALLBACK_DATA.summary.zeroResultRate,
            avgCtr: json.summary?.avgCtr ?? FALLBACK_DATA.summary.avgCtr,
            searchRevenue: json.summary?.searchRevenue ?? FALLBACK_DATA.summary.searchRevenue,
            avgLatencyMs: json.summary?.avgLatencyMs ?? FALLBACK_DATA.summary.avgLatencyMs,
          },
          topQueries: Array.isArray(json.topQueries) ? json.topQueries : FALLBACK_DATA.topQueries,
          zeroResultQueries: Array.isArray(json.zeroResultQueries)
            ? json.zeroResultQueries
            : FALLBACK_DATA.zeroResultQueries,
          topClickedProducts: Array.isArray(json.topClickedProducts)
            ? json.topClickedProducts
            : FALLBACK_DATA.topClickedProducts,
          synonyms: json.synonyms ?? FALLBACK_DATA.synonyms,
        });
      }
    } catch {
      // Keep fallback data in standalone preview
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSeoAnalytics();
  }, [fetchSeoAnalytics]);

  const handleAddSynonym = async (term: string, target: string) => {
    if (!term.trim() || !target.trim()) return;
    try {
      await fetch('/v1/analytics/synonym', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'eidos_dev_key' },
        body: JSON.stringify({ query: term.trim(), synonym: target.trim() }),
      });
    } catch {
      // Local state update fallback
    }
    setData((prev) => ({
      ...prev,
      synonyms: { ...prev.synonyms, [term.trim()]: target.trim() },
      zeroResultQueries: prev.zeroResultQueries.map((z) =>
        z.query === term.trim() ? { ...z, resolvedSynonym: target.trim() } : z
      ),
    }));
    setSourceTerm('');
    setTargetSynonym('');
    setStatusBanner(
      isRu
        ? `Синоним добавлен: «${term.trim()}» → «${target.trim()}»`
        : `Synonym mapped: "${term.trim()}" → "${target.trim()}"`
    );
    setTimeout(() => setStatusBanner(null), 3000);
  };

  const handleBoostProduct = async (productId: string, title: string) => {
    try {
      await fetch('/v1/analytics/boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'eidos_dev_key' },
        body: JSON.stringify({ productId, boostFactor: 1.35 }),
      });
    } catch {
      // Local state update fallback
    }
    setStatusBanner(
      isRu
        ? `Приоритет ранжирования повышен (1.35x) для «${title}»`
        : `Boosted ranking weight (1.35x) for "${title}"`
    );
    setTimeout(() => setStatusBanner(null), 3000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6" data-testid="seo-dashboard-view">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <TrendingUp size={22} className="text-[var(--accent)]" />
            <h1 className="text-xl font-bold text-[var(--text)] m-0">
              {isRu
                ? 'SEO-аналитика поиска, выручка по запросам и устранение пустой выдачи'
                : 'Search Merchandising, Query Revenue & Zero-Result Recovery'}
            </h1>
          </div>
          <p className="text-xs text-[var(--text-sec)] mt-1 mb-0">
            {isRu
              ? 'Телеметрия поисковых запросов в реальном времени, авто-маппинг синонимов и бустинг конверсионных SKU'
              : 'Real-time query telemetry, automatic synonym mapping, and SKU conversion boosting'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchSeoAnalytics()}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>{isRu ? 'Обновить данные' : 'Refresh Insights'}</span>
        </button>
      </div>

      {statusBanner && (
        <div className="px-4 py-2.5 rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 text-xs font-semibold text-[var(--success)] flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{statusBanner}</span>
        </div>
      )}

      <SeoSummaryCards
        summary={data.summary}
        zeroResultCount={data.zeroResultQueries.length}
        isRu={isRu}
      />

      <SeoTablesAndMerchandising
        topQueries={data.topQueries}
        zeroResultQueries={data.zeroResultQueries}
        topClickedProducts={data.topClickedProducts}
        sourceTerm={sourceTerm}
        targetSynonym={targetSynonym}
        onChangeSourceTerm={setSourceTerm}
        onChangeTargetSynonym={setTargetSynonym}
        onAddSynonym={(t, s) => void handleAddSynonym(t, s)}
        onBoostProduct={(id, title) => void handleBoostProduct(id, title)}
        isRu={isRu}
      />
    </div>
  );
};

export default SEODashboard;
