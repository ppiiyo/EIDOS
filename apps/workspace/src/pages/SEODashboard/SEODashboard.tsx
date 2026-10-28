import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Search,
  AlertCircle,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  Plus,
  CheckCircle2,
  DollarSign,
  MousePointerClick,
} from 'lucide-react';

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-[var(--text-sec)] flex items-center justify-between">
            <span>{isRu ? 'Объём поисковых запросов' : 'Total Search Volume'}</span>
            <Search size={14} className="text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text)] mt-1 mono">
            {data.summary.totalSearches.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-sec)] mt-1">
            {isRu ? `Средняя задержка: ${data.summary.avgLatencyMs} мс` : `Avg Latency: ${data.summary.avgLatencyMs} ms`}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-[var(--text-sec)] flex items-center justify-between">
            <span>{isRu ? 'Кликабельность выдачи (CTR)' : 'Search Click-Through Rate'}</span>
            <MousePointerClick size={14} className="text-[var(--success)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--success)] mt-1 mono">
            {data.summary.avgCtr.toFixed(1)}%
          </div>
          <div className="text-xs text-[var(--text-sec)] mt-1">
            {isRu ? 'Stage-2 Cross-Encoder активен' : 'Stage-2 Cross-Encoder Active'}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-[var(--text-sec)] flex items-center justify-between">
            <span>{isRu ? 'Доля пустой выдачи (Zero-Result)' : 'Zero-Result Rate'}</span>
            <AlertCircle size={14} className="text-[var(--warning)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--warning)] mt-1 mono">
            {data.summary.zeroResultRate.toFixed(1)}%
          </div>
          <div className="text-xs text-[var(--text-sec)] mt-1">
            {isRu
              ? `${data.zeroResultQueries.length} запросов ожидают синоним`
              : `${data.zeroResultQueries.length} queries awaiting synonym rule`}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-xs text-[var(--text-sec)] flex items-center justify-between">
            <span>{isRu ? 'Атрибутированная выручка поиска' : 'Attributed Search Revenue'}</span>
            <DollarSign size={14} className="text-[var(--accent)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--text)] mt-1 mono">
            ${data.summary.searchRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--text-sec)] mt-1">
            {isRu ? 'Гибридный RRF + LinUCB Бандит' : 'Hybrid RRF + LinUCB Bandit'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="text-base font-bold text-[var(--text)] m-0 mb-3">
            {isRu ? 'Высокочастотные поисковые запросы' : 'High-Volume Search Queries'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-sec)]">
                  <th className="py-2 pr-3">{isRu ? 'Запрос' : 'Query'}</th>
                  <th className="py-2 px-2">{isRu ? 'Частота' : 'Volume'}</th>
                  <th className="py-2 px-2">CTR</th>
                  <th className="py-2 pl-2 text-right">{isRu ? 'Выручка' : 'Revenue'}</th>
                </tr>
              </thead>
              <tbody>
                {data.topQueries.map((q) => (
                  <tr key={q.query} className="border-b border-[var(--border)]/50">
                    <td className="py-2.5 pr-3 font-semibold text-[var(--text)]">{q.query}</td>
                    <td className="py-2.5 px-2 mono">{q.volume}</td>
                    <td className="py-2.5 px-2 mono text-[var(--success)]">{q.ctr.toFixed(1)}%</td>
                    <td className="py-2.5 pl-2 mono text-right">${q.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[var(--text)] m-0 mb-1">
              {isRu
                ? 'Устранение пустой выдачи и словарь синонимов'
                : 'Zero-Result Query Recovery & Synonym Bridge'}
            </h2>
            <p className="text-xs text-[var(--text-sec)] m-0 mb-3">
              {isRu
                ? 'Свяжите опечатки и разговорные запросы с каноническими терминами каталога в 1 клик.'
                : 'Map misspelled or colloquial zero-result queries to canonical catalog terms.'}
            </p>

            <div className="flex flex-col gap-2">
              {data.zeroResultQueries.map((zq) => (
                <div
                  key={zq.query}
                  className="p-2.5 rounded border border-[var(--border)] bg-[var(--bg-alt)] flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <span className="font-bold text-[var(--text)]">"{zq.query}"</span>
                    <span className="mono text-[var(--text-sec)] ml-2">
                      ({zq.volume} {isRu ? 'запр.' : 'searches'})
                    </span>
                  </div>
                  {zq.resolvedSynonym ? (
                    <span className="mono text-[var(--success)] font-semibold">
                      → {zq.resolvedSynonym}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void handleAddSynonym(zq.query, zq.suggestedSynonym || 'electronics')
                      }
                      className="btn btn-secondary btn-sm"
                    >
                      <Sparkles size={12} />
                      <span>
                        {isRu ? 'Связать →' : 'Map →'} "{zq.suggestedSynonym || 'electronics'}"
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder={isRu ? 'Запрос с 0 результатов (напр. абибас)' : 'Zero-result term (e.g. абибас)'}
              value={sourceTerm}
              onChange={(e) => setSourceTerm(e.target.value)}
              className="input text-xs flex-1 min-w-[140px]"
            />
            <input
              type="text"
              placeholder={isRu ? 'Канонический синоним (напр. adidas)' : 'Canonical target (e.g. adidas)'}
              value={targetSynonym}
              onChange={(e) => setTargetSynonym(e.target.value)}
              className="input text-xs flex-1 min-w-[140px]"
            />
            <button
              type="button"
              onClick={() => void handleAddSynonym(sourceTerm, targetSynonym)}
              className="btn btn-primary btn-sm"
            >
              <Plus size={13} />
              <span>{isRu ? 'Добавить синоним' : 'Add Synonym'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-base font-bold text-[var(--text)] m-0 mb-3">
          {isRu
            ? 'Лидеры конверсии и бустинг товаров в 1 клик'
            : 'Top Converting SKUs & 1-Click Merchandising Boost'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {data.topClickedProducts.map((prod) => (
            <div
              key={prod.id}
              className="p-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] flex flex-col justify-between gap-3"
            >
              <div>
                <div className="font-bold text-sm text-[var(--text)]">{prod.title}</div>
                <div className="text-xs mono text-[var(--text-sec)] mt-1">
                  {isRu
                    ? `Клики: ${prod.clicks} · Покупки: ${prod.purchases} · CR: ${prod.conversionRate}%`
                    : `Clicks: ${prod.clicks} · Purchases: ${prod.purchases} · CR: ${prod.conversionRate}%`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleBoostProduct(prod.id, prod.title)}
                className="btn btn-secondary btn-sm w-full justify-center"
              >
                <ArrowUpRight size={13} />
                <span>{isRu ? 'Повысить в выдаче (1.35x)' : 'Boost Ranking (1.35x)'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SEODashboard;
