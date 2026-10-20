import { get, set } from 'idb-keyval';
import { getEidosIdbStore } from '../storage';

export interface AnalyticsEvent {
  type: 'search' | 'recommendation' | 'item_view' | 'item_click' | 'purchase' | 'ab_impression' | 'ab_conversion';
  timestamp: number;
  userId?: string;
  itemId?: string;
  query?: string;
  category?: string;
  experimentId?: string;
  variant?: string;
  value?: number;
}

export interface AnalyticsSummary {
  period: string;
  totalEvents: number;
  searches: number;
  recommendations: number;
  itemViews: number;
  itemClicks: number;
  purchases: number;
  ctr: number;
  conversionRate: number;
  topQueries: { query: string; count: number }[];
  topItems: { itemId: string; views: number; clicks: number }[];
  topCategories: { category: string; count: number }[];
  eventsByHour: { hour: number; count: number }[];
}

const IDB_ANALYTICS_KEY = 'eidos_analytics_events_v2';
const MAX_EVENTS = 5000;

let memoryEvents: AnalyticsEvent[] = [];
const analyticsListeners = new Set<() => void>();

function notifyAnalyticsListeners(): void {
  for (const listener of analyticsListeners) {
    listener();
  }
}

export function subscribeAnalytics(listener: () => void): () => void {
  analyticsListeners.add(listener);
  return () => {
    analyticsListeners.delete(listener);
  };
}

export async function flushAnalyticsToIdb(): Promise<void> {
  await set(IDB_ANALYTICS_KEY, memoryEvents, getEidosIdbStore());
}

export async function hydrateAnalyticsFromIdb(): Promise<AnalyticsEvent[]> {
  try {
    const stored = await get<AnalyticsEvent[]>(IDB_ANALYTICS_KEY, getEidosIdbStore());
    if (Array.isArray(stored)) {
      memoryEvents = stored;
      notifyAnalyticsListeners();
    }
  } catch {
    // ignore in restricted environments
  }
  return memoryEvents;
}

export function trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): void {
  memoryEvents.push({ ...event, timestamp: Date.now() });
  if (memoryEvents.length > MAX_EVENTS) {
    memoryEvents.splice(0, memoryEvents.length - MAX_EVENTS);
  }
  notifyAnalyticsListeners();
  void flushAnalyticsToIdb().catch(() => {});
}

export function getEvents(sinceMs = 86400000): AnalyticsEvent[] {
  const cutoff = Date.now() - sinceMs;
  return memoryEvents.filter((e) => e.timestamp >= cutoff);
}

export function computeSummary(sinceMs = 86400000, periodLabel = 'Last 24 hours'): AnalyticsSummary {
  const events = getEvents(sinceMs);
  const searches = events.filter((e) => e.type === 'search').length;
  const recommendations = events.filter((e) => e.type === 'recommendation').length;
  const itemViews = events.filter((e) => e.type === 'item_view').length;
  const itemClicks = events.filter((e) => e.type === 'item_click').length;
  const purchases = events.filter((e) => e.type === 'purchase').length;
  const ctr = itemViews > 0 ? itemClicks / itemViews : 0;
  const conversionRate = itemClicks > 0 ? purchases / itemClicks : 0;

  const queryCounts = new Map<string, number>();
  events
    .filter((e) => e.type === 'search' && e.query)
    .forEach((e) => {
      const q = e.query!.toLowerCase().trim();
      queryCounts.set(q, (queryCounts.get(q) || 0) + 1);
    });
  const topQueries = [...queryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  const itemStats = new Map<string, { views: number; clicks: number }>();
  events.forEach((e) => {
    if (!e.itemId) return;
    const s = itemStats.get(e.itemId) || { views: 0, clicks: 0 };
    if (e.type === 'item_view') s.views++;
    if (e.type === 'item_click') s.clicks++;
    itemStats.set(e.itemId, s);
  });
  const topItems = [...itemStats.entries()]
    .sort((a, b) => b[1].views + b[1].clicks - (a[1].views + a[1].clicks))
    .slice(0, 10)
    .map(([itemId, s]) => ({ itemId, ...s }));

  const catCounts = new Map<string, number>();
  events
    .filter((e) => e.category)
    .forEach((e) => {
      catCounts.set(e.category!, (catCounts.get(e.category!) || 0) + 1);
    });
  const topCategories = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([category, count]) => ({ category, count }));

  const hourCounts = new Array(24).fill(0);
  events.forEach((e) => {
    const h = new Date(e.timestamp).getHours();
    hourCounts[h]++;
  });
  const eventsByHour = hourCounts.map((count, hour) => ({ hour, count }));

  return {
    period: periodLabel,
    totalEvents: events.length,
    searches,
    recommendations,
    itemViews,
    itemClicks,
    purchases,
    ctr,
    conversionRate,
    topQueries,
    topItems,
    topCategories,
    eventsByHour,
  };
}

export function clearAnalytics(): void {
  memoryEvents = [];
  notifyAnalyticsListeners();
  void flushAnalyticsToIdb().catch(() => {});
}
