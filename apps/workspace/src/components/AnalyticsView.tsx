import React, { useState, useEffect } from 'react';
import { BarChart3, Search, Lightbulb, MousePointer, ShoppingCart, Trash2 } from 'lucide-react';
import { computeSummary, clearAnalytics, AnalyticsSummary } from '../lib/analytics/tracker';
import { SemanticTrendsAnalytics } from './SemanticTrendsAnalytics';

const PERIODS = [
  { label: 'Last hour', ms: 3600000 },
  { label: 'Today', ms: 86400000 },
  { label: 'Last 7 days', ms: 604800000 },
  { label: 'All time', ms: Infinity },
];

export const AnalyticsView: React.FC = () => {
  const [periodIdx, setPeriodIdx] = useState(1);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  const refresh = () => {
    const p = PERIODS[periodIdx];
    setSummary(computeSummary(p.ms, p.label));
  };

  useEffect(refresh, [periodIdx]);

  if (!summary) return null;

  const maxHourCount = Math.max(...summary.eventsByHour.map((h) => h.count), 1);

  return (
    <div className="page">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div>
          <h1 className="page-title">Semantic Trends & Session Telemetry</h1>
          <p className="page-sub">
            Real-time session telemetry combined with temporal Recharts query clusters and conversion streams
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="input"
            style={{ width: 150 }}
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
            onClick={() => {
              clearAnalytics();
              refresh();
            }}
          >
            <Trash2 size={13} /> Clear session
          </button>
        </div>
      </div>

      {/* Live Session Counters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: 'Searches', value: summary.searches, icon: Search, testId: 'search-count' },
          { label: 'MMR Recommendations', value: summary.recommendations, icon: Lightbulb },
          { label: 'Item Impressions', value: summary.itemViews, icon: BarChart3 },
          { label: 'Item Clicks', value: summary.itemClicks, icon: MousePointer },
          { label: 'Session Conversions', value: summary.purchases, icon: ShoppingCart },
        ].map(({ label, value, icon: Icon, testId }) => (
          <div key={label} className="card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sec)', fontWeight: 500 }}>{label}</span>
              <Icon size={15} color="var(--accent)" />
            </div>
            <div
              className="mono"
              data-testid={testId}
              style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}
            >
              {value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* CTR, Conversion & Hourly Activity */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginBottom: 4 }}>
            Session Click-Through Rate (CTR)
          </div>
          <div className="mono" style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text)' }}>
            {(summary.ctr * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-mut)', marginTop: 4 }}>
            Ratio of item clicks to impressions in current session
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginBottom: 4 }}>
            Session Hourly Activity Distribution
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56, marginTop: 8 }}>
            {summary.eventsByHour.map(({ hour, count }) => (
              <div
                key={hour}
                title={`${hour}:00 — ${count} events`}
                style={{
                  flex: 1,
                  borderRadius: '2px 2px 0 0',
                  background: count > 0 ? 'var(--accent)' : 'var(--border)',
                  height: `${Math.max((count / maxHourCount) * 100, 6)}%`,
                }}
              />
            ))}
          </div>
          <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.6875rem', color: 'var(--text-mut)' }}>
            <span>00:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)', marginBottom: 8, fontWeight: 600 }}>
            Top Session Search Queries
          </div>
          {summary.topQueries.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-mut)', margin: 0 }}>
              Execute searches in the Hybrid Search tab to populate live queries
            </p>
          ) : (
            summary.topQueries.slice(0, 4).map((q, i) => (
              <div
                key={q.query}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: i < Math.min(3, summary.topQueries.length - 1) ? '1px solid var(--border)' : 'none',
                  fontSize: '0.8125rem',
                }}
              >
                <span style={{ color: 'var(--text)' }}>{q.query}</span>
                <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  {q.count}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Integrated Recharts Temporal & Cluster Analytics */}
      <SemanticTrendsAnalytics />
    </div>
  );
};
