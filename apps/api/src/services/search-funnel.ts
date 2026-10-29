export type FunnelEventType = 'search' | 'click' | 'purchase';

export interface FunnelEventInput {
  type: FunnelEventType;
  sessionId?: string;
  query?: string;
  itemId?: string;
  userId?: string;
  timestamp?: number;
}

export interface StoredFunnelEvent {
  type: FunnelEventType;
  sessionId: string;
  query?: string;
  itemId?: string;
  userId?: string;
  timestamp: number;
}

export interface QueryConversionStat {
  query: string;
  searches: number;
  clicks: number;
  purchases: number;
  clickThroughRate: number;
  conversionRate: number;
}

export interface FunnelMetrics {
  totalSearches: number;
  totalClicks: number;
  totalPurchases: number;
  clickThroughRate: number;
  conversionRate: number;
  topConvertingQueries: QueryConversionStat[];
  worstConvertingQueries: QueryConversionStat[];
}

export class SearchFunnelService {
  public static readonly MAX_EVENTS = 10_000;

  private readonly maxEvents: number;
  private readonly events: StoredFunnelEvent[] = [];
  private readonly sessionLastQuery = new Map<string, string>();

  constructor(maxEvents: number = SearchFunnelService.MAX_EVENTS) {
    this.maxEvents = maxEvents;
  }

  public addEvent(event: FunnelEventInput): StoredFunnelEvent {
    const normalizedSessionId =
      (event.sessionId || event.userId || 'anonymous').trim() || 'anonymous';
    const normalizedQuery =
      typeof event.query === 'string' && event.query.trim().length > 0
        ? event.query.trim().toLowerCase()
        : undefined;
    const timestamp =
      typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)
        ? event.timestamp
        : Date.now();

    if (event.type === 'search' && normalizedQuery) {
      this.sessionLastQuery.set(normalizedSessionId, normalizedQuery);
    }

    const resolvedQuery =
      normalizedQuery ??
      (event.type !== 'search' ? this.sessionLastQuery.get(normalizedSessionId) : undefined);

    const stored: StoredFunnelEvent = {
      type: event.type,
      sessionId: normalizedSessionId,
      query: resolvedQuery,
      itemId: event.itemId?.trim() || undefined,
      userId: event.userId?.trim() || undefined,
      timestamp,
    };

    if (this.events.length >= this.maxEvents) {
      this.events.shift();
    }
    this.events.push(stored);

    return stored;
  }

  /**
   * Links `purchase` and `click` events back to their originating `query` via `sessionId -> lastQuery` map.
   * Fixes the bug where conversionRate per query was always 0 when purchase events lacked a `query` field.
   */
  public computeQueryConversions(eventsSlice: StoredFunnelEvent[]): {
    topConvertingQueries: QueryConversionStat[];
    worstConvertingQueries: QueryConversionStat[];
  } {
    const sessionToLastQuery = new Map<string, string>();
    const statsByQuery = new Map<
      string,
      { query: string; searches: number; clicks: number; purchases: number }
    >();

    const ensureStat = (q: string) => {
      let entry = statsByQuery.get(q);
      if (!entry) {
        entry = { query: q, searches: 0, clicks: 0, purchases: 0 };
        statsByQuery.set(q, entry);
      }
      return entry;
    };

    // Sort chronologically so sessionId -> lastQuery resolution is always causal
    const ordered = [...eventsSlice].sort((a, b) => a.timestamp - b.timestamp);

    for (const ev of ordered) {
      if (ev.type === 'search' && ev.query) {
        const q = ev.query.trim().toLowerCase();
        sessionToLastQuery.set(ev.sessionId, q);
        const stat = ensureStat(q);
        stat.searches += 1;
      } else if (ev.type === 'click') {
        const q =
          ev.query?.trim().toLowerCase() ||
          sessionToLastQuery.get(ev.sessionId) ||
          this.sessionLastQuery.get(ev.sessionId);
        if (q) {
          const stat = ensureStat(q);
          stat.clicks += 1;
        }
      } else if (ev.type === 'purchase') {
        const q =
          ev.query?.trim().toLowerCase() ||
          sessionToLastQuery.get(ev.sessionId) ||
          this.sessionLastQuery.get(ev.sessionId);
        if (q) {
          const stat = ensureStat(q);
          stat.purchases += 1;
        }
      }
    }

    const allStats: QueryConversionStat[] = Array.from(statsByQuery.values()).map((s) => {
      const denom = Math.max(1, s.searches);
      return {
        query: s.query,
        searches: s.searches,
        clicks: s.clicks,
        purchases: s.purchases,
        clickThroughRate: s.searches > 0 ? Number((s.clicks / denom).toFixed(4)) : 0,
        conversionRate: s.searches > 0 ? Number((s.purchases / denom).toFixed(4)) : 0,
      };
    });

    const topConvertingQueries = allStats
      .filter((s) => s.conversionRate > 0)
      .sort((a, b) => b.conversionRate - a.conversionRate || b.purchases - a.purchases)
      .slice(0, 10);

    const worstConvertingQueries = allStats
      .filter((s) => s.searches > 0 && s.conversionRate === 0)
      .sort((a, b) => b.searches - a.searches || a.clickThroughRate - b.clickThroughRate)
      .slice(0, 10);

    return {
      topConvertingQueries,
      worstConvertingQueries,
    };
  }

  public getMetrics(periodMs: number = 24 * 60 * 60 * 1000): FunnelMetrics {
    const now = Date.now();
    const cutoff = now - Math.max(1, periodMs);
    const windowEvents = this.events.filter((ev) => ev.timestamp >= cutoff);

    let totalSearches = 0;
    let totalClicks = 0;
    let totalPurchases = 0;

    for (const ev of windowEvents) {
      if (ev.type === 'search') totalSearches += 1;
      else if (ev.type === 'click') totalClicks += 1;
      else if (ev.type === 'purchase') totalPurchases += 1;
    }

    const clickThroughRate =
      totalSearches > 0 ? Number((totalClicks / totalSearches).toFixed(4)) : 0;
    const conversionRate =
      totalSearches > 0 ? Number((totalPurchases / totalSearches).toFixed(4)) : 0;

    const { topConvertingQueries, worstConvertingQueries } =
      this.computeQueryConversions(windowEvents);

    return {
      totalSearches,
      totalClicks,
      totalPurchases,
      clickThroughRate,
      conversionRate,
      topConvertingQueries,
      worstConvertingQueries,
    };
  }

  public getEventCount(): number {
    return this.events.length;
  }

  public clear(): void {
    this.events.length = 0;
    this.sessionLastQuery.clear();
  }
}

export const searchFunnelService = new SearchFunnelService();
