/**
 * Реальный трекер событий. Хранит в localStorage.
 * Без фейковых данных — только реальные действия пользователя.
 */

export type EventType = 'search' | 'recommendation' | 'item_view' | 'item_click' | 'purchase';

export interface AnalyticsEvent {
  type: EventType;
  query?: string;
  itemId?: string | number;
  category?: string;
  timestamp: number;
}

const STORAGE_KEY = 'eidos_analytics_events';
const MAX_EVENTS = 5000;

function load(): AnalyticsEvent[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}
function save(events: AnalyticsEvent[]) {
  // Ограничиваем размер хранилища
  const trimmed = events.slice(-MAX_EVENTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): void {
  const all = load();
  all.push({ ...event, timestamp: Date.now() });
  save(all);
}

export function getEvents(sinceMs?: number): AnalyticsEvent[] {
  const all = load();
  if (!sinceMs || sinceMs === Infinity) return all;
  const cutoff = Date.now() - sinceMs;
  return all.filter(e => e.timestamp >= cutoff);
}

export interface AnalyticsSummary {
  period: string;
  totalEvents: number;
  searches: number;
  recommendations: number;
  itemViews: number;
  itemClicks: number;
  purchases: number;
  ctr: number;            // clicks / views
  conversionRate: number; // purchases / clicks
  topQueries: Array<{ query: string; count: number }>;
  topCategories: Array<{ category: string; count: number }>;
  eventsByHour: Array<{ hour: number; count: number }>;
}

export function computeSummary(periodMs: number, label: string): AnalyticsSummary {
  const events = getEvents(periodMs);

  const searches       = events.filter(e => e.type === 'search').length;
  const recommendations= events.filter(e => e.type === 'recommendation').length;
  const itemViews      = events.filter(e => e.type === 'item_view').length;
  const itemClicks     = events.filter(e => e.type === 'item_click').length;
  const purchases      = events.filter(e => e.type === 'purchase').length;

  // Топ запросов
  const queryCounts = new Map<string, number>();
  events.filter(e => e.type === 'search' && e.query).forEach(e => {
    queryCounts.set(e.query!, (queryCounts.get(e.query!) ?? 0) + 1);
  });
  const topQueries = Array.from(queryCounts.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Топ категорий
  const catCounts = new Map<string, number>();
  events.filter(e => e.category).forEach(e => {
    catCounts.set(e.category!, (catCounts.get(e.category!) ?? 0) + 1);
  });
  const topCategories = Array.from(catCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Распределение по часам
  const hourCounts = new Array(24).fill(0);
  events.forEach(e => {
    const h = new Date(e.timestamp).getHours();
    hourCounts[h]++;
  });
  const eventsByHour = hourCounts.map((count, hour) => ({ hour, count }));

  return {
    period: label,
    totalEvents: events.length,
    searches, recommendations, itemViews, itemClicks, purchases,
    ctr: itemViews > 0 ? itemClicks / itemViews : 0,
    conversionRate: itemClicks > 0 ? purchases / itemClicks : 0,
    topQueries, topCategories, eventsByHour,
  };
}

export function clearAnalytics(): void {
  localStorage.removeItem(STORAGE_KEY);
}
