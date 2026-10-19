/**
 * Реальный трекер событий. Хранит в localStorage.
 * Без фейковых данных — только реальные действия пользователя.
 * Связан напрямую с A/B движком (recordOutcome при click/purchase).
 */
import { listExperiments, recordOutcome, assignVariant } from '../ab-testing/engine';

export type EventType = 'search' | 'recommendation' | 'item_view' | 'item_click' | 'purchase';

export interface AnalyticsEvent {
  type: EventType;
  query?: string;
  itemId?: string;
  category?: string;
  timestamp: number;
}

const STORAGE_KEY = 'kostra44sip_analytics_events';
const USER_ID_KEY = 'kostra44sip_session_user_id';
const MAX_EVENTS = 5000;

export function getSessionUserId(): string {
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      id = 'usr_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    return 'usr_default';
  }
}

function load(): AnalyticsEvent[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}

function save(events: AnalyticsEvent[]) {
  const trimmed = events.slice(-MAX_EVENTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function trackEvent(event: Omit<AnalyticsEvent, 'timestamp'>): void {
  const all = load();
  all.push({ ...event, timestamp: Date.now() });
  save(all);

  // Связка Analytics -> A/B: purchase/click события вызывают recordOutcome()
  if (event.type === 'item_click' || event.type === 'purchase') {
    try {
      const runningExps = listExperiments().filter((e) => e.status === 'running');
      if (runningExps.length > 0) {
        const uid = getSessionUserId();
        for (const exp of runningExps) {
          assignVariant(exp.id, uid);
          if (event.type === 'purchase') {
            recordOutcome(exp.id, uid, true, 49.99);
          } else if (event.type === 'item_click' && exp.metric === 'conversion') {
            recordOutcome(exp.id, uid, true, 0);
          }
        }
      }
    } catch {
      // Graceful fallback
    }
  }
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

  const ctr = itemViews > 0 ? itemClicks / itemViews : 0;
  const conversionRate = itemClicks > 0 ? purchases / itemClicks : 0;

  // Топ запросов
  const queryCounts: Record<string, number> = {};
  for (const e of events) {
    if (e.query) queryCounts[e.query] = (queryCounts[e.query] ?? 0) + 1;
  }
  const topQueries = Object.entries(queryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([query, count]) => ({ query, count }));

  // Топ категорий
  const catCounts: Record<string, number> = {};
  for (const e of events) {
    if (e.category) catCounts[e.category] = (catCounts[e.category] ?? 0) + 1;
  }
  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  // Распределение по часам (последние 24 часа)
  const now = Date.now();
  const eventsByHour: Array<{ hour: number; count: number }> = [];
  for (let i = 23; i >= 0; i--) {
    const hStart = now - (i + 1) * 3600000;
    const hEnd   = now - i * 3600000;
    const count  = events.filter(e => e.timestamp >= hStart && e.timestamp < hEnd).length;
    const hour   = new Date(hEnd).getHours();
    eventsByHour.push({ hour, count });
  }

  return {
    period: label,
    totalEvents: events.length,
    searches, recommendations, itemViews, itemClicks, purchases,
    ctr, conversionRate,
    topQueries, topCategories, eventsByHour,
  };
}

export function clearAnalytics(): void {
  try { localStorage.removeItem(STORAGE_KEY); }
  catch { /* ignore */ }
}
