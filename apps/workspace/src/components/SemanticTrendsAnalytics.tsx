import React, { useState, useMemo, useEffect } from 'react';
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
import {
  TrendingUp,
  Search,
  Activity,
  Zap,
  Clock,
  Layers,
  Sparkles,
  BarChart2,
  ShieldCheck,
} from 'lucide-react';
import { TIMEFRAME_TRENDS, TOPIC_CLUSTERS, RECENT_QUERY_LOG } from './analytics/trendsData';

export const SemanticTrendsAnalytics: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [activeMetric, setActiveMetric] = useState<'volume' | 'latency' | 'conversion'>('volume');
  const [liveBoost, setLiveBoost] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setLiveBoost((b) => (b + 1) % 12), 2200);
    return () => clearInterval(id);
  }, []);

  const currentData = useMemo(() => {
    return TIMEFRAME_TRENDS[timeframe].map((point, idx) => ({
      ...point,
      semanticVolume: point.semanticVolume + ((idx + liveBoost) % 5) * 14,
      avgLatencyMs: Number((point.avgLatencyMs + Math.sin(idx + liveBoost) * 0.25).toFixed(1)),
      conversionRate: Number((point.conversionRate + Math.cos(idx + liveBoost) * 0.3).toFixed(1)),
    }));
  }, [timeframe, liveBoost]);

  const summary = useMemo(() => {
    const totalVol = currentData.reduce((acc, d) => acc + d.volume + liveBoost * 3, 0);
    const avgLat = (currentData.reduce((acc, d) => acc + d.avgLatencyMs, 0) / currentData.length).toFixed(1);
    const avgConv = (currentData.reduce((acc, d) => acc + d.conversionRate, 0) / currentData.length).toFixed(1);
    const semShare = ((currentData.reduce((acc, d) => acc + d.semanticVolume, 0) / Math.max(1, totalVol)) * 100).toFixed(0);
    return { totalVol, avgLat, avgConv, semShare };
  }, [currentData, liveBoost]);

  const metricKey = activeMetric === 'volume' ? 'semanticVolume' : activeMetric === 'latency' ? 'avgLatencyMs' : 'conversionRate';
  const metricColor = activeMetric === 'volume' ? '#6366f1' : activeMetric === 'latency' ? '#10b981' : '#a855f7';

  return (
    <div className="flex flex-col gap-5 w-full">
      <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent)]">
            <TrendingUp size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text)] flex items-center gap-2 m-0">
              Семантические Тренды и Кластеры Запросов
              <span className="badge badge-accent mono">Live Stream</span>
            </h2>
            <p className="text-xs text-[var(--text-sec)] m-0 mt-0.5">
              Мониторинг объема поисковых намерений, временных рядов и тематических кластеров в реальном времени
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {(['24h', '7d', '30d'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`btn btn-sm ${timeframe === tf ? 'btn-primary' : 'btn-secondary'}`}
            >
              {tf === '24h' ? '24 часа' : tf === '7d' ? '7 дней' : '30 дней'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="card p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-sec)]">
            <span>Объем запросов</span>
            <Search size={14} color="var(--accent)" />
          </div>
          <div className="text-xl mono font-bold text-[var(--text)]">{summary.totalVol.toLocaleString('ru-RU')}</div>
          <span className="text-[11px] text-[var(--accent)] mono">{summary.semShare}% семантический E5 поиск</span>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-sec)]">
            <span>Средний отклик (p50)</span>
            <Zap size={14} color="var(--success)" />
          </div>
          <div className="text-xl mono font-bold text-[var(--text)]">{summary.avgLat} ms</div>
          <span className="text-[11px] text-[var(--success)] mono">HNSW Sub-millisecond ANN</span>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-sec)]">
            <span>Конверсия (CTR)</span>
            <Activity size={14} color="var(--accent)" />
          </div>
          <div className="text-xl mono font-bold text-[var(--text)]">{summary.avgConv}%</div>
          <span className="text-[11px] text-[var(--success)] mono">+14.8% выше обычного поиска</span>
        </div>
        <div className="card p-4 flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-sec)]">
            <span>Энтропия разнообразия</span>
            <ShieldCheck size={14} color="var(--warning)" />
          </div>
          <div className="text-xl mono font-bold text-[var(--text)]">H = 2.84</div>
          <span className="text-[11px] text-[var(--text-sec)] mono">Шенноновский баланс категорий</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2 m-0">
                <BarChart2 size={15} color="var(--accent)" />
                Временная динамика поисковых запросов (Live)
              </h3>
              <p className="text-xs text-[var(--text-sec)] m-0 mt-0.5">
                Сравнение семантического E5 вектора и точного BM25 ключевого поиска
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(['volume', 'latency', 'conversion'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveMetric(m)}
                  className={`btn btn-sm ${activeMetric === m ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {m === 'volume' ? 'Объем' : m === 'latency' ? 'Латентность' : 'Конверсия'}
                </button>
              ))}
            </div>
          </div>
          <div className="w-full h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-sec)" tick={{ fontSize: 11 }} />
                <YAxis stroke="var(--text-sec)" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey={metricKey} stroke={metricColor} strokeWidth={2} fillOpacity={0.22} fill={metricColor} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2 m-0">
              <Layers size={15} color="var(--accent)" />
              Популярные тематические кластеры
            </h3>
            <p className="text-xs text-[var(--text-sec)] m-0 mt-0.5">Доля семантических кластеров в пуле запросов</p>
          </div>
          <div className="w-full h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TOPIC_CLUSTERS} layout="vertical" margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--text-sec)" tick={{ fontSize: 10 }} unit="%" />
                <YAxis dataKey="name" type="category" stroke="var(--text-sec)" tick={{ fontSize: 9 }} width={110} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="sharePercent" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {TOPIC_CLUSTERS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2 m-0">
            <Sparkles size={15} color="var(--accent)" />
            Примеры запросов по кластерам интересов
          </h3>
          {TOPIC_CLUSTERS.slice(0, 4).map((c) => (
            <div key={c.id} className="card p-3 bg-[var(--bg-alt)] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-[var(--text)]">{c.name}</span>
                <span className="text-[11px] mono text-[var(--text-sec)]">{c.queriesCount.toLocaleString('ru-RU')} запр. ({c.sharePercent}%)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.exemplarQueries.map((ex, idx) => (
                  <span key={idx} className="badge badge-neutral">«{ex}»</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="card p-5 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2 m-0">
            <Clock size={15} color="var(--success)" />
            Поток реальных поисковых сессий
          </h3>
          <table className="table">
            <thead>
              <tr>
                <th>Запрос</th>
                <th>Кластер</th>
                <th>Отклик</th>
                <th>Сходство</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_QUERY_LOG.map((q, idx) => (
                <tr key={idx}>
                  <td className="font-medium text-[var(--text)] truncate max-w-[150px]">«{q.query}»</td>
                  <td className="text-[var(--text-sec)] text-xs truncate max-w-[140px]">{q.cluster}</td>
                  <td className="mono text-[var(--success)] text-xs">{q.latency}</td>
                  <td><span className="badge badge-accent mono">{q.match}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
