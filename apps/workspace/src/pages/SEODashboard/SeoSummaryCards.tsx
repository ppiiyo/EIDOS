import React from 'react';
import { Search, MousePointerClick, AlertCircle, DollarSign } from 'lucide-react';
import type { SEODashboardData } from './SEODashboard';

interface SeoSummaryCardsProps {
  summary: SEODashboardData['summary'];
  zeroResultCount: number;
  isRu: boolean;
}

export const SeoSummaryCards: React.FC<SeoSummaryCardsProps> = ({
  summary,
  zeroResultCount,
  isRu,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card p-4">
        <div className="text-xs text-[var(--text-sec)] flex items-center justify-between">
          <span>{isRu ? 'Объём поисковых запросов' : 'Total Search Volume'}</span>
          <Search size={14} className="text-[var(--accent)]" />
        </div>
        <div className="text-2xl font-bold text-[var(--text)] mt-1 mono">
          {summary.totalSearches.toLocaleString()}
        </div>
        <div className="text-xs text-[var(--text-sec)] mt-1">
          {isRu
            ? `Средняя задержка: ${summary.avgLatencyMs} мс`
            : `Avg Latency: ${summary.avgLatencyMs} ms`}
        </div>
      </div>

      <div className="card p-4">
        <div className="text-xs text-[var(--text-sec)] flex items-center justify-between">
          <span>{isRu ? 'Кликабельность выдачи (CTR)' : 'Search Click-Through Rate'}</span>
          <MousePointerClick size={14} className="text-[var(--success)]" />
        </div>
        <div className="text-2xl font-bold text-[var(--success)] mt-1 mono">
          {summary.avgCtr.toFixed(1)}%
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
          {summary.zeroResultRate.toFixed(1)}%
        </div>
        <div className="text-xs text-[var(--text-sec)] mt-1">
          {isRu
            ? `${zeroResultCount} запросов ожидают синоним`
            : `${zeroResultCount} queries awaiting synonym rule`}
        </div>
      </div>

      <div className="card p-4">
        <div className="text-xs text-[var(--text-sec)] flex items-center justify-between">
          <span>{isRu ? 'Атрибутированная выручка поиска' : 'Attributed Search Revenue'}</span>
          <DollarSign size={14} className="text-[var(--accent)]" />
        </div>
        <div className="text-2xl font-bold text-[var(--text)] mt-1 mono">
          ${summary.searchRevenue.toLocaleString()}
        </div>
        <div className="text-xs text-[var(--text-sec)] mt-1">
          {isRu ? 'Гибридный RRF + LinUCB Бандит' : 'Hybrid RRF + LinUCB Bandit'}
        </div>
      </div>
    </div>
  );
};
