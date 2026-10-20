import React, { useState, useMemo } from "react";
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

  const currentData = useMemo(() => TIMEFRAME_TRENDS[timeframe], [timeframe]);

  const summary = useMemo(() => {
    const totalVol = currentData.reduce((acc, d) => acc + d.volume, 0);
    const avgLat = (currentData.reduce((acc, d) => acc + d.avgLatencyMs, 0) / currentData.length).toFixed(1);
    const avgConv = (currentData.reduce((acc, d) => acc + d.conversionRate, 0) / currentData.length).toFixed(1);
    const semShare = (
      (currentData.reduce((acc, d) => acc + d.semanticVolume, 0) / Math.max(1, totalVol)) *
      100
    ).toFixed(0);

    return { totalVol, avgLat, avgConv, semShare };
  }, [currentData]);

  const metricKey =
    activeMetric === 'volume'
      ? 'semanticVolume'
      : activeMetric === 'latency'
      ? 'avgLatencyMs'
      : 'conversionRate';
  const metricColor =
    activeMetric === 'volume'
      ? '#00f0ff'
      : activeMetric === 'latency'
      ? '#10b981'
      : '#b478ff';

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-[#0c0d18] border border-[#1e1e35] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00f0ff]/15 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff]">
            <TrendingUp size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Семантические Тренды и Кластеры Запросов
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30">
                Recharts Analytics
              </span>
            </h2>
            <p className="text-xs text-[#8a8aa3]">
              Мониторинг объема поисковых намерений, временных рядов и тематических кластеров из истории запросов
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#141526] border border-[#23243f]">
          {(['24h', '7d', '30d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-all cursor-pointer ${
                timeframe === tf
                  ? 'bg-[#00f0ff] text-black font-bold'
                  : 'text-[#8a8aa3] hover:text-white'
              }`}
            >
              {tf === '24h' ? '24 часа' : tf === '7d' ? '7 дней' : '30 дней'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0f101d] border border-[#1e1e35] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[#8a8aa3]">
            <span>Объем запросов</span>
            <Search size={14} className="text-[#00f0ff]" />
          </div>
          <div className="text-2xl font-mono font-black text-white">
            {summary.totalVol.toLocaleString('ru-RU')}
          </div>
          <span className="text-[11px] text-[#00f0ff] font-mono">
            {summary.semShare}% семантический E5 поиск
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#0f101d] border border-[#1e1e35] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[#8a8aa3]">
            <span>Средний отклик (p50)</span>
            <Zap size={14} className="text-[#10b981]" />
          </div>
          <div className="text-2xl font-mono font-black text-white">{summary.avgLat} ms</div>
          <span className="text-[11px] text-[#10b981] font-mono">
            HNSW Sub-millisecond ANN
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#0f101d] border border-[#1e1e35] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[#8a8aa3]">
            <span>Конверсия (Click-Through)</span>
            <Activity size={14} className="text-[#b478ff]" />
          </div>
          <div className="text-2xl font-mono font-black text-white">{summary.avgConv}%</div>
          <span className="text-[11px] text-[#b478ff] font-mono">
            +14.8% выше обычного поиска
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[#0f101d] border border-[#1e1e35] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[#8a8aa3]">
            <span>Энтропия разнообразия</span>
            <ShieldCheck size={14} className="text-[#f59e0b]" />
          </div>
          <div className="text-2xl font-mono font-black text-white">H = 2.84</div>
          <span className="text-[11px] text-[#f59e0b] font-mono">
            Шенноновский баланс категорий
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#0c0d18] border border-[#1e1e35] flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart2 size={16} className="text-[#00f0ff]" />
                Временная динамика поисковых запросов
              </h3>
              <p className="text-xs text-[#8a8aa3]">
                Сравнение семантического E5 вектора и точного BM25 ключевого поиска
              </p>
            </div>

            <div className="flex items-center gap-1 bg-[#141526] p-1 rounded-lg border border-[#23243f]">
              {(['volume', 'latency', 'conversion'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveMetric(m)}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded cursor-pointer ${
                    activeMetric === m ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold' : 'text-[#8a8aa3]'
                  }`}
                >
                  {m === 'volume' ? 'Объем' : m === 'latency' ? 'Латентность' : 'Конверсия'}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1d30" vertical={false} />
                <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0c0d18',
                    borderColor: '#2a2b45',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={metricKey}
                  stroke={metricColor}
                  strokeWidth={2}
                  fillOpacity={0.25}
                  fill={metricColor}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0c0d18] border border-[#1e1e35] flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers size={16} className="text-[#b478ff]" />
              Популярные тематические кластеры
            </h3>
            <p className="text-xs text-[#8a8aa3]">
              Доля семантических кластеров в пуле запросов
            </p>
          </div>

          <div className="w-full h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={TOPIC_CLUSTERS} layout="vertical" margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1d30" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }} unit="%" />
                <YAxis dataKey="name" type="category" stroke="#8a8aa3" tick={{ fontSize: 9 }} width={110} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0c0d18', borderColor: '#2a2b45', borderRadius: '8px', fontSize: '11px' }}
                />
                <Bar dataKey="sharePercent" radius={[0, 4, 4, 0]}>
                  {TOPIC_CLUSTERS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-[#0c0d18] border border-[#1e1e35] flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-[#00f0ff]" />
            Примеры запросов по кластерам интересов
          </h3>
          {TOPIC_CLUSTERS.slice(0, 4).map((c) => (
            <div key={c.id} className="p-3 rounded-xl bg-[#111222] border border-[#1e1f38] flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs" style={{ color: c.color }}>{c.name}</span>
                <span className="text-[11px] font-mono text-[#8a8aa3]">
                  {c.queriesCount.toLocaleString('ru-RU')} запр. ({c.sharePercent}%)
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {c.exemplarQueries.map((ex, idx) => (
                  <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-[#181930] text-[#a0a0ba]">
                    «{ex}»
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 rounded-2xl bg-[#0c0d18] border border-[#1e1e35] flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock size={16} className="text-[#10b981]" />
            Поток реальных поисковых сессий
          </h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1e1f38] text-[#8a8aa3] text-[10px] font-mono">
                <th className="pb-2">Запрос</th>
                <th className="pb-2">Кластер</th>
                <th className="pb-2">Отклик</th>
                <th className="pb-2">Сходство</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18192e]">
              {RECENT_QUERY_LOG.map((q, idx) => (
                <tr key={idx}>
                  <td className="py-2 font-medium text-white truncate max-w-[150px]">«{q.query}»</td>
                  <td className="py-2 text-[#8a8aa3] text-[11px] truncate max-w-[140px]">{q.cluster}</td>
                  <td className="py-2 font-mono text-[#10b981] text-[11px]">{q.latency}</td>
                  <td className="py-2 font-mono text-[#00f0ff] font-bold text-[11px]">{q.match}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
