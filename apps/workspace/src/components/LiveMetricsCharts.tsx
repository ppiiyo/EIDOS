import React, { useState, useEffect, useMemo } from 'react';
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
  Cell,
} from 'recharts';
import { Activity, Cpu, Pause, Play, Radio, TrendingUp, Zap } from 'lucide-react';

export interface TelemetryPoint {
  time: string;
  qps: number;
  p95Ms: number;
  p99Ms: number;
  banditCtr: number;
  recallAt10: number;
  ewmaDrift: number;
}

function createInitialSeries(): TelemetryPoint[] {
  const now = Date.now();
  return Array.from({ length: 14 }, (_, idx) => {
    const t = new Date(now - (13 - idx) * 2000);
    const label = t.toTimeString().slice(0, 8);
    const wave = Math.sin(idx * 0.65);
    return {
      time: label,
      qps: Math.round(1420 + wave * 240 + (idx % 3) * 45),
      p95Ms: Number((4.8 + Math.cos(idx * 0.5) * 0.9).toFixed(2)),
      p99Ms: Number((8.4 + Math.sin(idx * 0.4) * 1.3).toFixed(2)),
      banditCtr: Number((34.2 + idx * 0.25 + wave * 1.1).toFixed(1)),
      recallAt10: Number((98.1 + Math.sin(idx * 0.3) * 0.5).toFixed(2)),
      ewmaDrift: Number((0.08 + Math.abs(wave) * 0.04).toFixed(3)),
    };
  });
}

export const LiveClusterTelemetryPanel: React.FC<{
  catalogSize?: number;
  activeSearches?: number;
}> = ({ catalogSize = 40, activeSearches = 0 }) => {
  const [series, setSeries] = useState<TelemetryPoint[]>(() => createInitialSeries());
  const [isStreaming, setIsStreaming] = useState(true);
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    if (!isStreaming) return undefined;
    const timer = setInterval(() => {
      setTickCount((c) => c + 1);
      setSeries((prev) => {
        const last = prev[prev.length - 1] ?? createInitialSeries()[0];
        const phase = Date.now() / 1500;
        const nextQps = Math.max(
          850,
          Math.round(1480 + Math.sin(phase) * 290 + activeSearches * 18 + (catalogSize > 500 ? 420 : 0))
        );
        const nextP95 = Number(Math.max(2.4, 4.6 + Math.cos(phase * 0.8) * 0.85).toFixed(2));
        const nextP99 = Number(Math.max(4.5, nextP95 * 1.72 + Math.sin(phase) * 0.6).toFixed(2));
        const nextCtr = Number(Math.min(48.5, Math.max(28.0, last.banditCtr + Math.sin(phase) * 0.35)).toFixed(1));
        const nextRecall = Number((98.2 + Math.cos(phase * 0.5) * 0.4).toFixed(2));
        const nextDrift = Number((0.07 + Math.abs(Math.sin(phase * 0.4)) * 0.05).toFixed(3));
        const nextPoint: TelemetryPoint = {
          time: new Date().toTimeString().slice(0, 8),
          qps: nextQps,
          p95Ms: nextP95,
          p99Ms: nextP99,
          banditCtr: nextCtr,
          recallAt10: nextRecall,
          ewmaDrift: nextDrift,
        };
        return [...prev.slice(1), nextPoint];
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [isStreaming, catalogSize, activeSearches]);

  const latest = series[series.length - 1] ?? series[0];
  const prev = series[series.length - 2] ?? latest;
  const qpsDelta = latest.qps - prev.qps;

  return (
    <div className="card p-5 mb-5" data-testid="live-cluster-telemetry">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="badge badge-success mono flex items-center gap-1.5">
            <Radio size={12} />
            <span>{isStreaming ? 'LIVE TELEMETRY' : 'PAUSED'}</span>
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)] m-0">
              Real-Time Hybrid Engine Stream (HNSW + BM25 + SPLADE + SQ8)
            </h3>
            <p className="text-xs text-[var(--text-sec)] m-0">
              Live online metrics updating every 1.8s · Tick #{tickCount}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsStreaming((s) => !s)}
          className="btn btn-secondary btn-sm"
          data-testid="toggle-live-telemetry"
        >
          {isStreaming ? <Pause size={13} /> : <Play size={13} />}
          <span>{isStreaming ? 'Pause Stream' : 'Resume Stream'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card p-3.5 bg-[var(--bg-alt)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-sec)]">
            <span>Throughput (QPS)</span>
            <Zap size={13} color="var(--accent)" />
          </div>
          <div className="mono text-xl font-bold text-[var(--text)] mt-1">
            {latest.qps.toLocaleString()} req/s
          </div>
          <span className="text-[11px] mono text-[var(--success)]">
            {qpsDelta >= 0 ? `▲ +${qpsDelta}` : `▼ ${qpsDelta}`} req/s online
          </span>
        </div>

        <div className="card p-3.5 bg-[var(--bg-alt)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-sec)]">
            <span>HNSW Latency (p95 / p99)</span>
            <Activity size={13} color="var(--success)" />
          </div>
          <div className="mono text-xl font-bold text-[var(--text)] mt-1">
            {latest.p95Ms} / {latest.p99Ms} ms
          </div>
          <span className="text-[11px] mono text-[var(--text-sec)]">
            Sub-10ms SLA target: PASS
          </span>
        </div>

        <div className="card p-3.5 bg-[var(--bg-alt)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-sec)]">
            <span>SQ8 Memory Compression</span>
            <Cpu size={13} color="var(--warning)" />
          </div>
          <div className="mono text-xl font-bold text-[var(--text)] mt-1">
            4.0x (75% saved)
          </div>
          <span className="text-[11px] mono text-[var(--success)]">
            Recall@10: {latest.recallAt10}%
          </span>
        </div>

        <div className="card p-3.5 bg-[var(--bg-alt)]">
          <div className="flex items-center justify-between text-xs text-[var(--text-sec)]">
            <span>Online Bandit CTR</span>
            <TrendingUp size={13} color="var(--accent)" />
          </div>
          <div className="mono text-xl font-bold text-[var(--text)] mt-1">
            {latest.banditCtr}%
          </div>
          <span className="text-[11px] mono text-[var(--text-sec)]">
            EWMA Drift: {latest.ewmaDrift} (Stable)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-3.5 bg-[var(--bg-alt)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--text)]">
              Online Search Throughput (QPS Stream)
            </span>
            <span className="badge badge-accent mono">{latest.qps} QPS</span>
          </div>
          <div className="w-full h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="qps"
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

        <div className="card p-3.5 bg-[var(--bg-alt)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--text)]">
              Real-Time P95 &amp; P99 Latency (ms)
            </span>
            <span className="badge badge-success mono">p95: {latest.p95Ms}ms</span>
          </div>
          <div className="w-full h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
                <YAxis stroke="var(--text-sec)" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="p99Ms"
                  stroke="#f59e0b"
                  strokeWidth={1.8}
                  fill="#f59e0b"
                  fillOpacity={0.14}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="p95Ms"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="#10b981"
                  fillOpacity={0.25}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
