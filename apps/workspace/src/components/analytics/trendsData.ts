export interface TrendDataPoint { // Eidos telemetry point
  time: string;
  volume: number;
  semanticVolume: number;
  keywordVolume: number;
  avgLatencyMs: number;
  conversionRate: number;
}

export interface TopicCluster {
  id: string;
  name: string;
  queriesCount: number;
  sharePercent: number;
  color: string;
  exemplarQueries: string[];
  topItemTitle: string;
}

export const TIMEFRAME_TRENDS: Record<'24h' | '7d' | '30d', TrendDataPoint[]> = {
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

export const TOPIC_CLUSTERS: TopicCluster[] = [
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

export const RECENT_QUERY_LOG = [
  { query: 'релятивистское замедление времени нолан', cluster: 'Sci-Fi, Сингулярность & Кино', latency: '1.4ms', match: '96%', time: '2 мин назад' },
  { query: 'высокоскоростной векторный поиск rust', cluster: 'DevTools, Vector DB & Cloud', latency: '1.2ms', match: '98%', time: '4 мин назад' },
  { query: 'кашемировое пальто оверсайз итальянское', cluster: 'Fashion, Шелк & Luxury', latency: '1.7ms', match: '93%', time: '7 мин назад' },
  { query: 'ортопедическое кресло сетка aeron', cluster: 'Эргономика & Офис будущего', latency: '1.3ms', match: '95%', time: '11 мин назад' },
  { query: 'зерновой эспрессо темная обжарка', cluster: 'Кофе, Уют & Бариста', latency: '1.5ms', match: '91%', time: '14 мин назад' },
];
