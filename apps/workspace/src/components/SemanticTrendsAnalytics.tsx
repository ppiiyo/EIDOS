import React, { useState, useMemo } from 'react';
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
  Calendar,
  ShieldCheck,
} from 'lucide-react';

interface TrendDataPoint {
  time: string;
  volume: number;
  semanticVolume: number;
  keywordVolume: number;
  avgLatencyMs: number;
  conversionRate: number;
}

interface TopicCluster {
  id: string;
  name: string;
  queriesCount: number;
  sharePercent: number;
  color: string;
  exemplarQueries: string[];
  topItemTitle: string;
}

const TIMEFRAME_TRENDS: Record<'24h' | '7d' | '30d', TrendDataPoint[]> = {
  '24h': [
    { time: '00:00', volume: 18, semanticVolume: 14, keywordVolume: 4, avgLatencyMs: 1.4, conversionRate: 18.2 },
    { time: '03:00', volume: 8, semanticVolume: 7, keywordVolume: 1, avgLatencyMs: 1.2, conversionRate: 15.0 },
    { time: '06:00', volume: 24, semanticVolume: 20, keywordVolume: 4, avgLatencyMs: 1.5, conversionRate: 21.4 },
    { time: '09:00', volume: 85, semanticVolume: 71, keywordVolume: 14, avgLatencyMs: 1.8, conversionRate: 29.5 },
    { time: '12:00', volume: 142, semanticVolume: 121, keywordVolume: 21, avgLatencyMs: 2.1, conversionRate: 34.2 },
    { time: '15:00', volume: 168, semanticVolume: 146, keywordVolume: 22, avgLatencyMs: 2.3, conversionRate: 36.8 },
    { time: '18:00', volume: 195, semanticVolume: 172, keywordVolume: 23, avgLatencyMs: 1.9, conversionRate: 38.1 },
    { time: '21:00', volume: 130, semanticVolume: 112, keywordVolume: 18, avgLatencyMs: 1.6, conversionRate: 31.0 },
  ],
  '7d': [
    { time: 'Пн', volume: 820, semanticVolume: 710, keywordVolume: 110, avgLatencyMs: 1.8, conversionRate: 32.4 },
    { time: 'Вт', volume: 960, semanticVolume: 840, keywordVolume: 120, avgLatencyMs: 1.9, conversionRate: 34.1 },
    { time: 'Ср', volume: 1140, semanticVolume: 995, keywordVolume: 145, avgLatencyMs: 2.1, conversionRate: 36.5 },
    { time: 'Чт', volume: 1210, semanticVolume: 1060, keywordVolume: 150, avgLatencyMs: 2.0, conversionRate: 35.8 },
    { time: 'Пт', volume: 1380, semanticVolume: 1220, keywordVolume: 160, avgLatencyMs: 2.4, conversionRate: 39.2 },
    { time: 'Сб', volume: 1050, semanticVolume: 920, keywordVolume: 130, avgLatencyMs: 1.7, conversionRate: 37.4 },
    { time: 'Вс', volume: 890, semanticVolume: 790, keywordVolume: 100, avgLatencyMs: 1.6, conversionRate: 35.0 },
  ],
  '30d': [
    { time: 'Неделя 1', volume: 5400, semanticVolume: 4650, keywordVolume: 750, avgLatencyMs: 2.2, conversionRate: 31.2 },
    { time: 'Неделя 2', volume: 6800, semanticVolume: 5950, keywordVolume: 850, avgLatencyMs: 2.0, conversionRate: 34.6 },
    { time: 'Неделя 3', volume: 7900, semanticVolume: 7020, keywordVolume: 880, avgLatencyMs: 1.9, conversionRate: 36.8 },
    { time: 'Неделя 4', volume: 9200, semanticVolume: 8250, keywordVolume: 950, avgLatencyMs: 1.8, conversionRate: 38.5 },
  ],
};

const TOPIC_CLUSTERS: TopicCluster[] = [
  {
    id: 'dev_cloud',
    name: 'DevTools, Vector DB & Cloud',
    queriesCount: 2840,
    sharePercent: 32.5,
    color: '#00f0ff',
    exemplarQueries: ['быстрая векторная база данных', 'аналитический кластер clickhouse', 'rust rag embeddings'],
    topItemTitle: 'ClickHouse Managed Cloud Cluster',
  },
  {
    id: 'scifi_cinema',
    name: 'Sci-Fi, Сингулярность & Кино',
    queriesCount: 2190,
    sharePercent: 25.1,
    color: '#b478ff',
    exemplarQueries: ['релятивистское время черные дыры', 'фильмы о симуляции матрицы', 'космическая одиссея'],
    topItemTitle: 'Фильм "Интерстеллар"',
  },
  {
    id: 'ergonomics_office',
    name: 'Эргономика & Офис будущего',
    queriesCount: 1640,
    sharePercent: 18.8,
    color: '#10b981',
    exemplarQueries: ['кресло с поддержкой поясницы', 'механическая бесшумная клавиатура', 'rgb подсветка рабочего места'],
    topItemTitle: 'Кресло Herman Miller Aeron',
  },
  {
    id: 'fashion_luxury',
    name: 'Fashion, Шелк & Luxury',
    queriesCount: 1210,
    sharePercent: 13.9,
    color: '#ec4899',
    exemplarQueries: ['кашемир пальто оверсайз беж', 'шелк малбери рубашка', 'кожаный тоут для ноутбука'],
    topItemTitle: 'Кашемировое пальто оверсайз Camel',
  },
  {
    id: 'coffee_comfort',
    name: 'Кофе, Уют & Бариста',
    queriesCount: 840,
    sharePercent: 9.7,
    color: '#f59e0b',
    exemplarQueries: ['рожковая кофеварка 15 бар', 'зерновой кофе свежая обжарка', 'капучинатор для матчи'],
    topItemTitle: 'Кофемашина Barista Pro',
  },
];

const RECENT_QUERY_LOG = [
  { query: 'релятивистское замедление времени нолан', cluster: 'Sci-Fi, Сингулярность & Кино', latency: '1.4ms', match: '96%', time: '2 мин назад' },
  { query: 'высокоскоростной векторный поиск rust', cluster: 'DevTools, Vector DB & Cloud', latency: '1.2ms', match: '98%', time: '4 мин назад' },
  { query: 'кашемировое пальто оверсайз итальянское', cluster: 'Fashion, Шелк & Luxury', latency: '1.7ms', match: '93%', time: '7 мин назад' },
  { query: 'ортопедическое кресло сетка aeron', cluster: 'Эргономика & Офис будущего', latency: '1.3ms', match: '95%', time: '11 мин назад' },
  { query: 'зерновой эспрессо темная обжарка', cluster: 'Кофе, Уют & Бариста', latency: '1.5ms', match: '91%', time: '14 мин назад' },
];

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

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-[#0c0d18] border border-[#1e1e35] shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00f0ff]/20 to-[#b478ff]/20 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff]">
            <TrendingUp size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Семантические Тренды и Кластеры Запросов
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30">
                Recharts Analytics
              </span>
            </h2>
            <p className="text-xs text-[#8a8aa3]">
              Мониторинг объема поисковых намерений, временных рядов и тематических кластеров из истории запросов
            </p>
          </div>
        </div>

        {/* Timeframe Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#141526] border border-[#23243f]">
          {(['24h', '7d', '30d'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-lg transition-all cursor-pointer ${
                timeframe === tf
                  ? 'bg-[#00f0ff] text-black font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'text-[#8a8aa3] hover:text-white'
              }`}
            >
              {tf === '24h' ? '24 часа' : tf === '7d' ? '7 дней' : '30 дней'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI METRIC CARDS */}
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

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TEMPORAL TREND (AreaChart) */}
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
              <button
                onClick={() => setActiveMetric('volume')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded cursor-pointer ${
                  activeMetric === 'volume' ? 'bg-[#00f0ff]/20 text-[#00f0ff] font-bold' : 'text-[#8a8aa3]'
                }`}
              >
                Объем
              </button>
              <button
                onClick={() => setActiveMetric('latency')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded cursor-pointer ${
                  activeMetric === 'latency' ? 'bg-[#10b981]/20 text-[#10b981] font-bold' : 'text-[#8a8aa3]'
                }`}
              >
                Латентность
              </button>
              <button
                onClick={() => setActiveMetric('conversion')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded cursor-pointer ${
                  activeMetric === 'conversion' ? 'bg-[#b478ff]/20 text-[#b478ff] font-bold' : 'text-[#8a8aa3]'
                }`}
              >
                Конверсия
              </button>
            </div>
          </div>

          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {activeMetric === 'volume' ? (
                <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="semanticGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="keywordGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8a8aa3" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8a8aa3" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
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
                    dataKey="semanticVolume"
                    name="Семантический E5"
                    stroke="#00f0ff"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#semanticGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="keywordVolume"
                    name="Ключевые слова"
                    stroke="#8a8aa3"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#keywordGrad)"
                  />
                </AreaChart>
              ) : activeMetric === 'latency' ? (
                <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c1d30" vertical={false} />
                  <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} unit="ms" />
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
                    dataKey="avgLatencyMs"
                    name="Латентность (ms)"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#latGrad)"
                  />
                </AreaChart>
              ) : (
                <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#b478ff" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#b478ff" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1c1d30" vertical={false} />
                  <XAxis dataKey="time" stroke="#6b7280" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} unit="%" />
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
                    dataKey="conversionRate"
                    name="CTR Конверсия (%)"
                    stroke="#b478ff"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#convGrad)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* POPULAR TOPIC CLUSTERS (BarChart) */}
        <div className="p-5 rounded-2xl bg-[#0c0d18] border border-[#1e1e35] flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers size={16} className="text-[#b478ff]" />
              Популярные тематические кластеры
            </h3>
            <p className="text-xs text-[#8a8aa3]">
              Доля семантических кластеров в общем пуле пользовательских запросов
            </p>
          </div>

          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={TOPIC_CLUSTERS}
                layout="vertical"
                margin={{ top: 5, right: 15, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1d30" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 10 }} unit="%" />
                <YAxis dataKey="name" type="category" stroke="#8a8aa3" tick={{ fontSize: 9 }} width={110} />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, 'Доля кластера']}
                  contentStyle={{
                    backgroundColor: '#0c0d18',
                    borderColor: '#2a2b45',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="sharePercent" radius={[0, 4, 4, 0]}>
                  {TOPIC_CLUSTERS.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[#1e1e35]">
            <span className="text-[11px] font-mono text-[#8a8aa3]">Топ-1 драйвер кластера:</span>
            <div className="p-2.5 rounded-lg bg-[#141526] border border-[#23243f] text-xs flex items-center justify-between">
              <span className="font-bold text-[#e8e8f0] line-clamp-1">
                {TOPIC_CLUSTERS[0].topItemTitle}
              </span>
              <span className="text-[10px] font-mono text-[#00f0ff] font-bold">
                {TOPIC_CLUSTERS[0].sharePercent}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CLUSTERS DEEP DIVE & RECENT QUERY LOG */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detailed Cluster Cards */}
        <div className="p-5 rounded-2xl bg-[#0c0d18] border border-[#1e1e35] flex flex-col gap-3.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-[#00f0ff]" />
            Примеры запросов по кластерам интересов
          </h3>
          <div className="flex flex-col gap-2.5">
            {TOPIC_CLUSTERS.slice(0, 4).map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-[#111222] border border-[#1e1f38] flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs" style={{ color: c.color }}>
                    {c.name}
                  </span>
                  <span className="text-[11px] font-mono text-[#8a8aa3]">
                    {c.queriesCount.toLocaleString('ru-RU')} запр. ({c.sharePercent}%)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.exemplarQueries.map((ex, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#181930] text-[#a0a0ba] border border-[#232545]"
                    >
                      «{ex}»
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Query Stream */}
        <div className="p-5 rounded-2xl bg-[#0c0d18] border border-[#1e1e35] flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-[#10b981]" />
              Поток реальных поисковых сессий
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30">
              Live Stream
            </span>
          </div>

          <div className="overflow-x-auto">
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
                  <tr key={idx} className="hover:bg-[#131426] transition-colors">
                    <td className="py-2.5 font-medium text-white line-clamp-1 max-w-[150px]">
                      «{q.query}»
                    </td>
                    <td className="py-2.5 text-[#8a8aa3] text-[11px] max-w-[140px] truncate">
                      {q.cluster}
                    </td>
                    <td className="py-2.5 font-mono text-[#10b981] text-[11px]">{q.latency}</td>
                    <td className="py-2.5 font-mono text-[#00f0ff] font-bold text-[11px]">{q.match}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-xl bg-[#0a0b14] border border-[#1c1d33] text-[11px] text-[#8a8aa3] flex items-center gap-2">
            <Zap size={14} className="text-[#00f0ff] shrink-0" />
            <span>
              Полнотекстовый поиск автоматически маршрутизируется через <strong>HNSW ANN</strong> (индекс 1000+ элементов) и <strong>BM25 Okapi</strong> с объединением рангов RRF.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
