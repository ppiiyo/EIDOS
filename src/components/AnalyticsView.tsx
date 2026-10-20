import React, { useState, useEffect } from 'react';
import { BarChart3, Search, Lightbulb, MousePointer, ShoppingCart, Trash2 } from 'lucide-react';
import {
  computeSummary,
  clearAnalytics,
  subscribeAnalytics,
  AnalyticsSummary,
} from '../lib/analytics/tracker';
import { SemanticTrendsAnalytics } from './SemanticTrendsAnalytics';

const PERIODS = [
  { label: 'Last hour', ms: 3600000 },
  { label: 'Today', ms: 86400000 },
  { label: 'Last 7 days', ms: 604800000 },
  { label: 'All time', ms: Infinity },
];

export const AnalyticsView: React.FC = () => {
  const [periodIdx, setPeriodIdx] = useState(1);
  const [summary, setSummary] = useState<AnalyticsSummary>(() =>
    computeSummary(PERIODS[1].ms, PERIODS[1].label)
  );

  useEffect(() => {
    const refresh = () => {
      const p = PERIODS[periodIdx];
      setSummary(computeSummary(p.ms, p.label));
    };
    refresh();
    return subscribeAnalytics(refresh);
  }, [periodIdx]);

  const maxHourCount = Math.max(...summary.eventsByHour.map((h) => h.count), 1);

  return (
    <div className="page">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
        <div>
          <h1 className="page-title">Semantic Trends & Session Telemetry</h1>
          <p className="page-sub">
            Real-time session telemetry combined with temporal Recharts query clusters and conversion streams
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="input w-[150px]"
            value={periodIdx}
            onChange={(e) => setPeriodIdx(Number(e.target.value))}
          >
            {PERIODS.map((p, i) => (
              <option key={i} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => clearAnalytics()}
          >
            <Trash2 size={13} /> Clear session
          </button>
        </div>
      </div>

      {/* Live Session Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Searches', value: summary.searches, icon: Search, testId: 'search-count' },
          { label: 'MMR Recommendations', value: summary.recommendations, icon: Lightbulb },
          { label: 'Item Impressions', value: summary.itemViews, icon: BarChart3 },
          { label: 'Item Clicks', value: summary.itemClicks, icon: MousePointer },
          { label: 'Session Conversions', value: summary.purchases, icon: ShoppingCart },
        ].map(({ label, value, icon: Icon, testId }) => (
          <div key={label} className="card px-5 py-4">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-[var(--text-sec)] font-medium">{label}</span>
              <Icon size={15} color="var(--accent)" />
            </div>
            <div
              className="mono text-2xl font-bold text-[var(--text)]"
              data-testid={testId}
            >
              {value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* CTR, Conversion & Hourly Activity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs text-[var(--text-sec)] mb-1">
            Session Click-Through Rate (CTR)
          </div>
          <div className="mono text-3xl font-bold text-[var(--text)]">
            {(summary.ctr * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-[var(--text-mut)] mt-1">
            Ratio of item clicks to impressions in current session
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs text-[var(--text-sec)] mb-1">
            Session Hourly Activity Distribution
          </div>
          <div className="flex items-end gap-1 h-14 mt-2">
            {summary.eventsByHour.map(({ hour, count }) => (
              <div
                key={hour}
                title={`${hour}:00 — ${count} events`}
                className="flex-1 rounded-t-xs"
                style={{
                  background: count > 0 ? 'var(--accent)' : 'var(--border)',
                  height: `${Math.max((count / maxHourCount) * 100, 6)}%`,
                }}
              />
            ))}
          </div>
          <div className="mono flex justify-between mt-1 text-[0.6875rem] text-[var(--text-mut)]">
            <span>00:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs text-[var(--text-sec)] mb-2 font-semibold">
            Top Session Search Queries
          </div>
          {summary.topQueries.length === 0 ? (
            <p className="text-[0.8125rem] text-[var(--text-mut)] m-0">
              Execute searches in the Hybrid Search tab to populate live queries
            </p>
          ) : (
            summary.topQueries.slice(0, 4).map((q, i) => (
              <div
                key={q.query}
                className={`flex justify-between py-1 text-[0.8125rem] ${
                  i < Math.min(3, summary.topQueries.length - 1)
                    ? 'border-b border-[var(--border)]'
                    : ''
                }`}
              >
                <span className="text-[var(--text)]">{q.query}</span>
                <span className="mono text-[var(--accent)] font-semibold">
                  {q.count}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <SemanticTrendsAnalytics />
    </div>
  );
};
