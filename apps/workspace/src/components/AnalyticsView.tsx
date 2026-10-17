import React, { useState, useEffect } from 'react';
import { BarChart3, Search, Lightbulb, MousePointer, ShoppingCart, Trash2 } from 'lucide-react';
import { computeSummary, clearAnalytics, AnalyticsSummary } from '../lib/analytics/tracker';

const PERIODS = [
  { label: 'Last hour',  ms: 3600000 },
  { label: 'Today',      ms: 86400000 },
  { label: 'Last 7 days',ms: 604800000 },
  { label: 'All time',   ms: Infinity },
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

  const maxHourCount = Math.max(...summary.eventsByHour.map(h => h.count), 1);

  return (
    <div className="page">
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-sub">Real usage data collected from this session</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <select className="input" style={{ width:140 }}
            value={periodIdx} onChange={e => setPeriodIdx(Number(e.target.value))}>
            {PERIODS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
          </select>
          <button className="btn btn-danger btn-sm"
            onClick={() => { clearAnalytics(); refresh(); }}>
            <Trash2 size={13}/> Clear data
          </button>
        </div>
      </div>

      {/* Метрики */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'Searches',        value: summary.searches,        icon: Search },
          { label:'Recommendations', value: summary.recommendations, icon: Lightbulb },
          { label:'Item Views',      value: summary.itemViews,       icon: BarChart3 },
          { label:'Clicks',          value: summary.itemClicks,      icon: MousePointer },
          { label:'Purchases',       value: summary.purchases,       icon: ShoppingCart },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card" style={{ padding:'16px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ fontSize:'0.75rem', color:'var(--text-sec)' }}>{label}</span>
              <Icon size={15} color="var(--text-mut)"/>
            </div>
            <div style={{ fontSize:'1.5rem', fontWeight:700 }}>{value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* CTR и конверсия */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontSize:'0.75rem', color:'var(--text-sec)', marginBottom:4 }}>
            Click-through rate (CTR)
          </div>
          <div style={{ fontSize:'2rem', fontWeight:700 }}>
            {(summary.ctr * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-mut)', marginTop:4 }}>
            clicks / item views
          </div>
        </div>
        <div className="card" style={{ padding:20 }}>
          <div style={{ fontSize:'0.75rem', color:'var(--text-sec)', marginBottom:4 }}>
            Conversion rate
          </div>
          <div style={{ fontSize:'2rem', fontWeight:700 }}>
            {(summary.conversionRate * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-mut)', marginTop:4 }}>
            purchases / clicks
          </div>
        </div>
      </div>

      {/* Гистограмма по часам */}
      <div className="card" style={{ padding:20, marginBottom:24 }}>
        <h2 style={{ fontSize:'0.875rem', fontWeight:600, marginBottom:16 }}>
          Activity by hour
        </h2>
        <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:80 }}>
          {summary.eventsByHour.map(({ hour, count }) => (
            <div key={hour} title={`${hour}:00 — ${count} events`}
              style={{
                flex:1, borderRadius:'3px 3px 0 0',
                background: count > 0 ? 'var(--accent)' : 'var(--border)',
                height: `${Math.max((count / maxHourCount) * 100, 2)}%`,
                opacity: count > 0 ? 0.8 : 1,
                transition: 'height .2s',
              }}/>
          ))}
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
          <span style={{ fontSize:'0.6875rem', color:'var(--text-mut)' }}>00:00</span>
          <span style={{ fontSize:'0.6875rem', color:'var(--text-mut)' }}>23:00</span>
        </div>
      </div>

      {/* Топ запросов и категорий */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div className="card" style={{ padding:20 }}>
          <h2 style={{ fontSize:'0.875rem', fontWeight:600, marginBottom:12 }}>
            Top search queries
          </h2>
          {summary.topQueries.length === 0
            ? <p style={{ fontSize:'0.8125rem', color:'var(--text-mut)' }}>No searches yet</p>
            : summary.topQueries.map((q, i) => (
              <div key={q.query} style={{
                display:'flex', justifyContent:'space-between', padding:'6px 0',
                borderBottom: i < summary.topQueries.length-1 ? '1px solid var(--border)' : 'none',
                fontSize:'0.875rem',
              }}>
                <span>{q.query}</span>
                <span style={{ color:'var(--text-mut)' }}>{q.count}</span>
              </div>
            ))}
        </div>

        <div className="card" style={{ padding:20 }}>
          <h2 style={{ fontSize:'0.875rem', fontWeight:600, marginBottom:12 }}>
            Top categories
          </h2>
          {summary.topCategories.length === 0
            ? <p style={{ fontSize:'0.8125rem', color:'var(--text-mut)' }}>No data yet</p>
            : summary.topCategories.map((c, i) => (
              <div key={c.category} style={{
                display:'flex', justifyContent:'space-between', padding:'6px 0',
                borderBottom: i < summary.topCategories.length-1 ? '1px solid var(--border)' : 'none',
                fontSize:'0.875rem',
              }}>
                <span>{c.category}</span>
                <span style={{ color:'var(--text-mut)' }}>{c.count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
