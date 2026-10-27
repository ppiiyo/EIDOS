import React, { useState, useEffect } from 'react';
import {
  Activity,
  RefreshCw,
  Compass,
  CheckCircle2,
  MousePointerClick,
  ShoppingCart,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  X,
  Database,
  AlertTriangle,
} from 'lucide-react';
import { useSEOMetrics } from './hooks/useSEOMetrics';
import { KPICard } from './components/KPICard';
import { TopQueriesTable } from './components/TopQueriesTable';
import { ZeroResultQueries } from './components/ZeroResultQueries';
import { QueryInspector } from './components/QueryInspector';
import { HowToReadPanel } from './components/HowToReadPanel';
import { GuidedTourStep } from './types';

const TOUR_STORAGE_KEY = 'eidos_seo_guided_tour_completed_v1';

const GUIDED_TOUR_STEPS: GuidedTourStep[] = [
  {
    id: 'step-kpi',
    targetId: 'seo-block-kpi',
    badge: 'Шаг 1 из 4 · Search Health',
    title: 'KPI-карточки здоровья поиска (Rankis / SEOPress стиль)',
    description:
      'Отслеживайте Search Usage Rate, Zero-Result Rate, CTR и Revenue per Search с 7-дневными спарклайнами. Если Zero-Result Rate превышает 10%, карточка загорается критическим красным индикатором (#ef4444).',
  },
  {
    id: 'step-queries',
    targetId: 'seo-block-dataviews',
    badge: 'Шаг 2 из 4 · Search Behavior',
    title: 'Таблица Top Queries (DataViews) и фильтрация',
    description:
      'Сортируйте поисковые запросы по любому столбцу (Volume, CTR, Avg Position, Revenue), включайте фильтр «Zero-Result only» и выбирайте диапазон дат.',
  },
  {
    id: 'step-zero',
    targetId: 'seo-block-zero-results',
    badge: 'Шаг 3 из 4 · Actionable SEO Insights',
    title: 'Устранение пустых выдач (Add Synonym & Boost Product)',
    description:
      'Запросы с 0 результатами («абибас», «кросовки») можно закрыть в 1 клик: добавьте синоним в индекс BM25+HNSW или привяжите буст маржинального товара.',
  },
  {
    id: 'step-xray',
    targetId: 'seo-block-xray',
    badge: 'Шаг 4 из 4 · Explainable X-Ray',
    title: 'Рентген формулы ранжирования Топ-5 товаров',
    description:
      'Вводите любой запрос и смотрите Stacked Bar декомпозицию: почему товар занял 1-е место за счёт Dense Score (смысл) + Sparse BM25 (точное совпадение) + Business Boost − MMR Penalty.',
  },
];

export const SEODashboard: React.FC = () => {
  const {
    dateRange,
    setDateRange,
    analytics,
    catalogStats,
    health,
    xrayQuery,
    setXrayQuery,
    xrayMode,
    setXrayMode,
    xrayAlpha,
    setXrayAlpha,
    xrayData,
    isLoading,
    isXrayLoading,
    error,
    actionBanner,
    setActionBanner,
    refreshMetrics,
    runXRaySearch,
    addSynonymForZeroQuery,
    boostProductForQuery,
    sendProductFeedback,
  } = useSEOMetrics();

  const [tourStepIdx, setTourStepIdx] = useState<number | null>(null);
  const [simulateCriticalZeroRate, setSimulateCriticalZeroRate] = useState<boolean>(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!seen) {
        setTourStepIdx(0);
      }
    } catch {
      // Ignore storage access errors in restricted iframes
    }
  }, []);

  const closeTour = () => {
    setTourStepIdx(null);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    } catch {
      // Ignore
    }
  };

  const handleInspectQueryFromTable = (q: string) => {
    setXrayQuery(q);
    void runXRaySearch(q, xrayMode, xrayAlpha);
    const el = document.getElementById('seo-block-xray');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const zeroResultRateValue = simulateCriticalZeroRate
    ? 12.4
    : analytics?.zeroResultRate.value ?? 8.2;

  const zeroResultSparkline = simulateCriticalZeroRate
    ? [9.8, 10.2, 10.9, 11.4, 11.8, 12.1, 12.4]
    : analytics?.zeroResultRate.sparkline ?? [10, 9.5, 9, 8.8, 8.5, 8.3, 8.2];

  const zeroResultTrend = simulateCriticalZeroRate
    ? 2.6
    : analytics?.zeroResultRate.trend ?? -1.5;

  const activeTourStep =
    tourStepIdx !== null ? GUIDED_TOUR_STEPS[tourStepIdx] : null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f1f5f9] p-4 lg:p-6 space-y-4 font-sans">
      {/* Top Bar: Title, Live EIDOS Telemetry Status, Guided Tour Trigger */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[#f1f5f9]">
              EIDOS SEO &amp; Search Intelligence Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30">
              <Activity size={12} />
              {health?.ok !== false ? 'EIDOS ENGINE ONLINE' : 'DEGRADED'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono bg-[#1e293b] text-slate-300 border border-slate-700">
              <Database size={11} className="text-[#3b82f6]" />
              {(
                catalogStats?.itemsIndexed ??
                analytics?.engineStats?.itemsIndexed ??
                health?.itemsIndexed ??
                5005
              ).toLocaleString()}{' '}
              SKU indexed (384-d)
            </span>
          </div>
          <p className="text-[12px] text-slate-400 mt-1">
            Данные в реальном времени из <code className="text-slate-300">/v1/analytics/seo</code>,{' '}
            <code className="text-slate-300">/v1/search</code>,{' '}
            <code className="text-slate-300">/v1/catalog/stats</code> и{' '}
            <code className="text-slate-300">/v1/feedback</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle to preview >10% Critical Zero-Result Rate state */}
          <button
            type="button"
            onClick={() => setSimulateCriticalZeroRate((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-medium border transition-colors cursor-pointer ${
              simulateCriticalZeroRate
                ? 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/50'
                : 'bg-[#1e293b] text-slate-300 border-slate-700 hover:border-slate-600'
            }`}
            title="Переключить демонстрацию критического порога Zero-Result Rate > 10%"
          >
            <AlertTriangle size={13} />
            <span>{simulateCriticalZeroRate ? 'Zero-Result > 10% (Active)' : 'Тест Zero-Result > 10%'}</span>
          </button>

          {/* Guided Tour Button */}
          <button
            type="button"
            onClick={() => setTourStepIdx(0)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold bg-[#1e293b] hover:bg-slate-800 text-[#3b82f6] border border-[#3b82f6]/40 cursor-pointer"
          >
            <Compass size={13} />
            <span>Guided Tour</span>
          </button>

          {/* Refresh Live API Data */}
          <button
            type="button"
            onClick={() => void refreshMetrics()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold bg-[#3b82f6] hover:bg-[#3b82f6]/90 text-white cursor-pointer"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Обновить</span>
          </button>
        </div>
      </header>

      {/* Interactive Guided Tour Callout Banner (SEOPress Insights style) */}
      {activeTourStep && (
        <div className="rounded-lg bg-[#1e293b] border-2 border-[#3b82f6] p-4 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#3b82f6] text-white">
                {activeTourStep.badge}
              </span>
              <h3 className="text-sm font-bold text-[#f1f5f9]">
                {activeTourStep.title}
              </h3>
            </div>
            <p className="text-[12px] text-slate-300 max-w-3xl leading-relaxed">
              {activeTourStep.description}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={tourStepIdx === 0}
              onClick={() =>
                setTourStepIdx((prev) => (prev !== null && prev > 0 ? prev - 1 : 0))
              }
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-[12px] font-medium bg-[#0f172a] text-slate-300 border border-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft size={13} />
              <span>Назад</span>
            </button>

            {tourStepIdx !== null && tourStepIdx < GUIDED_TOUR_STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  const nextIdx = tourStepIdx + 1;
                  setTourStepIdx(nextIdx);
                  const nextEl = document.getElementById(GUIDED_TOUR_STEPS[nextIdx].targetId);
                  if (nextEl) {
                    nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-semibold bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 cursor-pointer"
              >
                <span>Далее</span>
                <ChevronRight size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={closeTour}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded text-[12px] font-semibold bg-[#22c55e] text-slate-950 hover:bg-[#22c55e]/90 cursor-pointer"
              >
                <CheckCircle2 size={13} />
                <span>Понятно, начать работу</span>
              </button>
            )}

            <button
              type="button"
              onClick={closeTour}
              className="p-1.5 text-slate-400 hover:text-slate-200 cursor-pointer"
              aria-label="Закрыть тур"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Action Confirmation Toast Banner */}
      {actionBanner && (
        <div className="rounded-lg bg-[#22c55e]/15 border border-[#22c55e]/40 px-4 py-2.5 flex items-center justify-between text-[12px] text-[#22c55e]">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={15} />
            <span>{actionBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionBanner(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-[#ef4444]/15 border border-[#ef4444]/40 px-4 py-2.5 text-[12px] text-[#ef4444]">
          {error}
        </div>
      )}

      {/* =====================================================================
          БЛОК 1: Search Health (4 KPI Cards)
         ===================================================================== */}
      <section
        id="seo-block-kpi"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5"
      >
        <KPICard
          title="Search Usage Rate"
          subtitle="% визитов с использованием поиска"
          value={analytics?.searchUsageRate.value ?? 24.5}
          unit="%"
          trend={analytics?.searchUsageRate.trend ?? 3.2}
          sparkline={
            analytics?.searchUsageRate.sparkline ?? [20, 21, 22, 23, 24, 24.5, 25]
          }
          accentColor="blue"
        />

        <KPICard
          title="Zero-Result Rate"
          subtitle="% запросов с 0 результатами (порог 10%)"
          value={zeroResultRateValue}
          unit="%"
          trend={zeroResultTrend}
          sparkline={zeroResultSparkline}
          isInverseMetric={true}
          criticalThreshold={10}
          accentColor={zeroResultRateValue > 10 ? 'red' : 'green'}
        />

        <KPICard
          title="CTR (Click-Through Rate)"
          subtitle="% кликов по результатам выдачи EIDOS"
          value={analytics?.ctr.value ?? 34.1}
          unit="%"
          trend={analytics?.ctr.trend ?? 5.0}
          sparkline={
            analytics?.ctr.sparkline ?? [30, 31, 32, 33, 33.5, 34, 34.1]
          }
          accentColor="green"
        />

        <KPICard
          title="Revenue per Search"
          subtitle="Выручка с поиска / кол-во поисковых сессий"
          value={analytics?.revenuePerSearch.value ?? 4.2}
          unit="$"
          prefix="$"
          trend={analytics?.revenuePerSearch.trend ?? 0.5}
          sparkline={
            analytics?.revenuePerSearch.sparkline ?? [
              3.8, 3.9, 4.0, 4.1, 4.15, 4.2, 4.2,
            ]
          }
          accentColor="green"
        />
      </section>

      {/* =====================================================================
          БЛОК 2: Search Behavior (Top Queries Table + Zero-Result + Top Clicked Products)
         ===================================================================== */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left 7 Cols: Top Queries Table (WordPress DataViews style) */}
        <div id="seo-block-dataviews" className="xl:col-span-7">
          <TopQueriesTable
            queries={analytics?.topQueries || []}
            dateRange={dateRange}
            onChangeDateRange={setDateRange}
            onInspectQuery={handleInspectQueryFromTable}
            onQuickFixZeroResult={(q) => {
              const zEl = document.getElementById('seo-block-zero-results');
              if (zEl) zEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              void addSynonymForZeroQuery(q, 'кроссовки nike');
            }}
          />
        </div>

        {/* Right 5 Cols: Actionable Zero-Result Queries + Top Clicked Products */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <div id="seo-block-zero-results">
            <ZeroResultQueries
              zeroQueries={analytics?.zeroResultQueries || []}
              availableProducts={analytics?.topClickedProducts || []}
              activeSynonyms={analytics?.synonyms}
              onAddSynonym={addSynonymForZeroQuery}
              onBoostProduct={boostProductForQuery}
              onInspectQuery={handleInspectQueryFromTable}
            />
          </div>

          {/* Top Clicked Products Table */}
          <div className="rounded-lg bg-[#1e293b] border border-slate-700/80 overflow-hidden">
            <div className="p-4 border-b border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-[#22c55e]" />
                  <h2 className="text-sm font-semibold text-[#f1f5f9] uppercase tracking-wider">
                    Top Clicked Products
                  </h2>
                </div>
                <p className="text-[12px] text-slate-400 mt-0.5">
                  Товары-лидеры поискового трафика и конверсии (POST /v1/feedback)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0f172a]/70 border-b border-slate-700/80 text-[12px] font-semibold text-slate-400">
                    <th className="py-2 px-3">ID</th>
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3 text-right">Click Count</th>
                    <th className="py-2 px-3 text-right">Conversion Rate</th>
                    <th className="py-2 px-3 text-right">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-[12px]">
                  {(analytics?.topClickedProducts || []).map((prod) => (
                    <tr
                      key={prod.id}
                      className="h-9 hover:bg-slate-800/70 transition-colors"
                    >
                      <td className="py-1.5 px-3 font-mono text-slate-400">
                        {prod.id}
                      </td>
                      <td className="py-1.5 px-3 font-medium text-[#f1f5f9] truncate max-w-[180px]">
                        {prod.title}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-200">
                        {prod.clicks.toLocaleString()}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold text-[#22c55e]">
                        {prod.conversionRate.toFixed(1)}%
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void sendProductFeedback(prod.id, 'click')}
                            className="p-1 rounded bg-[#0f172a] hover:bg-slate-800 text-slate-300 border border-slate-700 cursor-pointer"
                            title="Записать клик (POST /v1/feedback)"
                          >
                            <MousePointerClick size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void sendProductFeedback(prod.id, 'purchase')}
                            className="p-1 rounded bg-[#22c55e]/15 hover:bg-[#22c55e]/25 text-[#22c55e] border border-[#22c55e]/30 cursor-pointer"
                            title="Записать покупку (POST /v1/feedback)"
                          >
                            <ShoppingCart size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          БЛОК 3: Explainable X-Ray (Query Inspector + How To Read Panel)
         ===================================================================== */}
      <section id="seo-block-xray" className="space-y-4">
        <QueryInspector
          query={xrayQuery}
          mode={xrayMode}
          alpha={xrayAlpha}
          xrayData={xrayData}
          isLoading={isXrayLoading}
          onChangeQuery={setXrayQuery}
          onChangeMode={setXrayMode}
          onChangeAlpha={setXrayAlpha}
          onExecuteSearch={(q, m, a) => {
            void runXRaySearch(q, m, a);
          }}
          onBoostItem={(itemId, boostWeight, q) => {
            void boostProductForQuery(itemId, boostWeight, q);
          }}
          onSendFeedback={(itemId, eventType, q) => {
            void sendProductFeedback(itemId, eventType, q);
          }}
        />

        <HowToReadPanel defaultOpen={true} />
      </section>
    </div>
  );
};

export default SEODashboard;
