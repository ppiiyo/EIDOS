import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Gauge, Database, TrendingUp } from 'lucide-react';

export interface AnalyticsApiMetrics {
  totalSearches24h: number;
  zeroResultRatePercent: number;
  ctrPercent: number;
  latencyPercentiles: {
    p50: number;
    p95: number;
    p99: number;
  };
  cacheHitRate: {
    hitRatePercent: number;
    exactCacheHits: number;
    semanticCacheHits: number;
    cacheMisses: number;
    avgSavedLatencyMs: number;
  };
  searchVolumeSeries: Array<{
    date: string;
    searches: number;
    zeroResults: number;
    ctrPercent: number;
  }>;
}

const DEFAULT_METRICS: AnalyticsApiMetrics = {
  totalSearches24h: 28481,
  zeroResultRatePercent: 1.2,
  ctrPercent: 34.8,
  latencyPercentiles: {
    p50: 3.8,
    p95: 8.2,
    p99: 12.9,
  },
  cacheHitRate: {
    hitRatePercent: 84.6,
    exactCacheHits: 14280,
    semanticCacheHits: 4920,
    cacheMisses: 3490,
    avgSavedLatencyMs: 9.8,
  },
  searchVolumeSeries: [
    { date: '10-21', searches: 4120, zeroResults: 62, ctrPercent: 32.4 },
    { date: '10-22', searches: 4480, zeroResults: 58, ctrPercent: 33.1 },
    { date: '10-23', searches: 4890, zeroResults: 51, ctrPercent: 34.0 },
    { date: '10-24', searches: 5210, zeroResults: 49, ctrPercent: 34.6 },
    { date: '10-25', searches: 5640, zeroResults: 44, ctrPercent: 35.2 },
    { date: '10-26', searches: 6180, zeroResults: 39, ctrPercent: 35.8 },
    { date: '10-27', searches: 6840, zeroResults: 34, ctrPercent: 36.4 },
  ],
};

export const LatencyAndCachePanel: React.FC = () => {
  const [metrics, setMetrics] = useState<AnalyticsApiMetrics>(DEFAULT_METRICS);

  useEffect(() => {
    if (typeof fetch !== 'function') return;
    fetch('/v1/analytics/metrics')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.latencyPercentiles && data.cacheHitRate) {
          setMetrics(data);
        }
      })
      .catch(() => {});
  }, []);

  const latencyBars = [
    { label: 'p50 (Median)', ms: metrics.latencyPercentiles.p50 },
    { label: 'p95 (SLA)', ms: metrics.latencyPercentiles.p95 },
    { label: 'p99 (Tail)', ms: metrics.latencyPercentiles.p99 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6" data-testid="latency-cache-panel">
      {/* Search Volume over time */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold m-0 flex items-center gap-2">
            <TrendingUp size={15} color="var(--accent)" /> Search Volume Over Time (7d)
          </h3>
          <span className="badge badge-accent mono">+16.4% WoW</span>
        </div>
        <div className="w-full h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.searchVolumeSeries} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="searches"
                stroke="#6366f1"
                strokeWidth={2}
                fill="#6366f1"
                fillOpacity={0.22}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Latency Percentiles (p50, p95, p99) */}
      <div className="card p-5" data-testid="latency-percentiles-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold m-0 flex items-center gap-2">
            <Gauge size={15} color="var(--success)" /> Latency Percentiles (p50 / p95 / p99)
          </h3>
          <span className="badge badge-success mono">SLA &lt; 15ms</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="p-2 rounded bg-[var(--bg-alt)]">
            <div className="text-[11px] text-[var(--text-sec)]">p50</div>
            <div className="mono font-bold text-sm text-[var(--success)]" data-testid="latency-p50">
              {metrics.latencyPercentiles.p50} ms
            </div>
          </div>
          <div className="p-2 rounded bg-[var(--bg-alt)]">
            <div className="text-[11px] text-[var(--text-sec)]">p95</div>
            <div className="mono font-bold text-sm text-[var(--accent)]" data-testid="latency-p95">
              {metrics.latencyPercentiles.p95} ms
            </div>
          </div>
          <div className="p-2 rounded bg-[var(--bg-alt)]">
            <div className="text-[11px] text-[var(--text-sec)]">p99</div>
            <div className="mono font-bold text-sm text-[var(--warning)]" data-testid="latency-p99">
              {metrics.latencyPercentiles.p99} ms
            </div>
          </div>
        </div>
        <div className="w-full h-[95px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={latencyBars} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
              <XAxis dataKey="label" stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
              <YAxis stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
              <Bar dataKey="ms" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cache Hit Rate */}
      <div className="card p-5" data-testid="cache-hit-rate-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold m-0 flex items-center gap-2">
            <Database size={15} color="var(--accent)" /> Cache Hit Rate (Exact + Semantic)
          </h3>
          <span className="badge badge-success mono" data-testid="cache-hit-rate-value">
            {metrics.cacheHitRate.hitRatePercent}% HIT
          </span>
        </div>
        <div className="text-3xl font-bold mono text-[var(--text)] mb-2">
          {metrics.cacheHitRate.hitRatePercent}%
        </div>
        <div className="w-full h-2.5 rounded-full bg-[var(--bg-alt)] overflow-hidden mb-3">
          <div
            className="h-full bg-[var(--success)]"
            style={{ width: `${Math.min(100, metrics.cacheHitRate.hitRatePercent)}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-[var(--bg-alt)]">
            <span className="text-[var(--text-sec)] block">Exact Redis Hits</span>
            <span className="mono font-semibold">{metrics.cacheHitRate.exactCacheHits.toLocaleString()}</span>
          </div>
          <div className="p-2 rounded bg-[var(--bg-alt)]">
            <span className="text-[var(--text-sec)] block">Semantic Hits (≥0.95)</span>
            <span className="mono font-semibold">{metrics.cacheHitRate.semanticCacheHits.toLocaleString()}</span>
          </div>
          <div className="p-2 rounded bg-[var(--bg-alt)]">
            <span className="text-[var(--text-sec)] block">Cache Misses</span>
            <span className="mono font-semibold">{metrics.cacheHitRate.cacheMisses.toLocaleString()}</span>
          </div>
          <div className="p-2 rounded bg-[var(--bg-alt)]">
            <span className="text-[var(--text-sec)] block">Saved Latency</span>
            <span className="mono font-semibold text-[var(--success)]">
              -{metrics.cacheHitRate.avgSavedLatencyMs} ms/req
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
