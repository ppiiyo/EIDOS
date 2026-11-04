import * as crypto from 'crypto';

export interface QueryLogTopHit {
  id: string;
  title: string;
  category: string;
  scorePercent: number;
  score: number;
}

export interface QueryLogFlags {
  empty: boolean;
  gated: boolean;
  rewritten: boolean;
  fallback_not_applicable: boolean;
}

export interface QueryLogRecord {
  id: string;
  timestamp: string;
  tenantId: string;
  indexName: string;
  query: string;
  normalizedQuery: string;
  resultCount: number;
  latencyMs: number;
  cacheHit: boolean;
  headCategoryIntent: string | null;
  simpleCategoryGate: 'hard' | 'soft' | 'off';
  alpha: number;
  top1: QueryLogTopHit | null;
  flags: QueryLogFlags;
  appliedDictionaryRules?: string[];
}

export interface SynonymRule {
  id: string;
  phrase: string;
  replacement: string;
  enabled: boolean;
}

export interface RewriteRule {
  id: string;
  from: string;
  to: string;
  enabled: boolean;
}

export interface TenantDictionaries {
  version: number;
  updatedAt: string;
  synonyms: SynonymRule[];
  rewrites: RewriteRule[];
  stopwords: string[];
}

export interface TenantRankingDefaults {
  simpleCategoryGate: 'hard' | 'soft' | 'off';
  defaultAlpha: number;
  minScore: number;
  minSimilarity: number;
  updatedAt: string;
}

export interface StorefrontEventRecord {
  id: string;
  timestamp: string;
  tenantId: string;
  type: 'click' | 'add_to_cart' | 'purchase';
  searchId?: string;
  query?: string;
  productId: string;
}

export interface CatalogUpsertSummary {
  timestamp: string;
  tenantId: string;
  indexName: string;
  upserted: number;
  failed: number;
  sampleRowErrors: Array<{ row: number; field: string; message: string }>;
}

export interface QueryPreprocessResult {
  processedQuery: string;
  rewritten: boolean;
  appliedRules: string[];
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class AdminConsoleStore {
  private static instance: AdminConsoleStore;
  private readonly maxLogs = 2500;
  private readonly maxEvents = 5000;
  private queryLogs: QueryLogRecord[] = [];
  private events: StorefrontEventRecord[] = [];
  private dictionariesByTenant = new Map<string, TenantDictionaries>();
  private rankingDefaultsByTenant = new Map<string, TenantRankingDefaults>();
  private lastUpsertByTenant = new Map<string, CatalogUpsertSummary>();
  private error5xxCountByTenant = new Map<string, number>();

  public static getInstance(): AdminConsoleStore {
    if (!AdminConsoleStore.instance) {
      AdminConsoleStore.instance = new AdminConsoleStore();
    }
    return AdminConsoleStore.instance;
  }

  public getDictionaries(tenantId = 'default'): TenantDictionaries {
    const existing = this.dictionariesByTenant.get(tenantId);
    if (existing) return existing;
    const initial: TenantDictionaries = {
      version: 1,
      updatedAt: new Date().toISOString(),
      synonyms: [],
      rewrites: [],
      stopwords: [],
    };
    this.dictionariesByTenant.set(tenantId, initial);
    return initial;
  }

  public updateDictionaries(
    tenantId = 'default',
    patch: {
      synonyms?: Array<{ id?: string; phrase: string; replacement: string; enabled?: boolean }>;
      rewrites?: Array<{ id?: string; from: string; to: string; enabled?: boolean }>;
      stopwords?: string[];
    }
  ): TenantDictionaries {
    const current = this.getDictionaries(tenantId);
    const synonyms: SynonymRule[] =
      patch.synonyms !== undefined
        ? patch.synonyms
            .map((s, idx) => ({
              id: s.id || `syn_${idx + 1}_${crypto.randomBytes(2).toString('hex')}`,
              phrase: String(s.phrase || '').trim(),
              replacement: String(s.replacement || '').trim(),
              enabled: s.enabled !== false,
            }))
            .filter((s) => s.phrase.length > 0 && s.replacement.length > 0)
        : current.synonyms;

    const rewrites: RewriteRule[] =
      patch.rewrites !== undefined
        ? patch.rewrites
            .map((r, idx) => ({
              id: r.id || `rw_${idx + 1}_${crypto.randomBytes(2).toString('hex')}`,
              from: String(r.from || '').trim(),
              to: String(r.to || '').trim(),
              enabled: r.enabled !== false,
            }))
            .filter((r) => r.from.length > 0 && r.to.length > 0)
        : current.rewrites;

    const stopwords: string[] =
      patch.stopwords !== undefined
        ? Array.from(
            new Set(
              patch.stopwords
                .map((w) => String(w || '').trim().toLowerCase())
                .filter((w) => w.length > 0)
            )
          )
        : current.stopwords;

    const updated: TenantDictionaries = {
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      synonyms,
      rewrites,
      stopwords,
    };
    this.dictionariesByTenant.set(tenantId, updated);
    return updated;
  }

  public preprocessQuery(rawQuery: string, tenantId = 'default'): QueryPreprocessResult {
    const dict = this.getDictionaries(tenantId);
    let working = rawQuery.trim();
    if (!working) {
      return { processedQuery: rawQuery, rewritten: false, appliedRules: [] };
    }

    const appliedRules: string[] = [];

    // 1. Apply exact or phrase rewrites
    for (const rw of dict.rewrites) {
      if (!rw.enabled || !rw.from || !rw.to) continue;
      const pattern = new RegExp(`(^|\\s|[.,!?;:()\\[\\]"'-])${escapeRegExp(rw.from)}(?=$|\\s|[.,!?;:()\\[\\]"'-])`, 'giu');
      if (pattern.test(working)) {
        working = working.replace(pattern, `$1${rw.to}`).replace(/\s+/g, ' ').trim();
        appliedRules.push(`rewrite:${rw.from}->${rw.to}`);
      }
    }

    // 2. Apply synonym replacements / expansions
    for (const syn of dict.synonyms) {
      if (!syn.enabled || !syn.phrase || !syn.replacement) continue;
      const pattern = new RegExp(`(^|\\s|[.,!?;:()\\[\\]"'-])${escapeRegExp(syn.phrase)}(?=$|\\s|[.,!?;:()\\[\\]"'-])`, 'giu');
      if (pattern.test(working)) {
        working = working.replace(pattern, `$1${syn.replacement}`).replace(/\s+/g, ' ').trim();
        appliedRules.push(`synonym:${syn.phrase}->${syn.replacement}`);
      }
    }

    // 3. Apply stopwords removal (never strip if it would leave 0 tokens)
    if (dict.stopwords.length > 0) {
      const stopSet = new Set(dict.stopwords.map((w) => w.toLowerCase()));
      const tokens = working.split(/\s+/);
      const filtered = tokens.filter((tok) => !stopSet.has(tok.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')));
      if (filtered.length > 0 && filtered.length < tokens.length) {
        working = filtered.join(' ').trim();
        appliedRules.push('stopwords');
      }
    }

    const rewritten = working.toLowerCase() !== rawQuery.trim().toLowerCase();
    return {
      processedQuery: working || rawQuery.trim(),
      rewritten,
      appliedRules,
    };
  }

  public getRankingDefaults(tenantId = 'default'): TenantRankingDefaults {
    const existing = this.rankingDefaultsByTenant.get(tenantId);
    if (existing) return existing;
    const defaults: TenantRankingDefaults = {
      simpleCategoryGate: 'hard',
      defaultAlpha: 0.5,
      minScore: 0.09,
      minSimilarity: 0.25,
      updatedAt: new Date().toISOString(),
    };
    this.rankingDefaultsByTenant.set(tenantId, defaults);
    return defaults;
  }

  public updateRankingDefaults(
    tenantId = 'default',
    patch: Partial<Omit<TenantRankingDefaults, 'updatedAt'>>
  ): TenantRankingDefaults {
    const current = this.getRankingDefaults(tenantId);
    const updated: TenantRankingDefaults = {
      simpleCategoryGate: patch.simpleCategoryGate ?? current.simpleCategoryGate,
      defaultAlpha:
        typeof patch.defaultAlpha === 'number'
          ? Math.min(1, Math.max(0, Number(patch.defaultAlpha.toFixed(4))))
          : current.defaultAlpha,
      minScore:
        typeof patch.minScore === 'number'
          ? Math.min(1, Math.max(0, Number(patch.minScore.toFixed(4))))
          : current.minScore,
      minSimilarity:
        typeof patch.minSimilarity === 'number'
          ? Math.min(1, Math.max(0, Number(patch.minSimilarity.toFixed(4))))
          : current.minSimilarity,
      updatedAt: new Date().toISOString(),
    };
    this.rankingDefaultsByTenant.set(tenantId, updated);
    return updated;
  }

  public recordQueryLog(
    input: Omit<QueryLogRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ): QueryLogRecord {
    const entry: QueryLogRecord = {
      id: input.id || `qlog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: input.timestamp || new Date().toISOString(),
      tenantId: input.tenantId || 'default',
      indexName: input.indexName || 'default',
      query: input.query,
      normalizedQuery: input.normalizedQuery || input.query,
      resultCount: input.resultCount,
      latencyMs: Math.round(input.latencyMs * 100) / 100,
      cacheHit: Boolean(input.cacheHit),
      headCategoryIntent: input.headCategoryIntent ?? null,
      simpleCategoryGate: input.simpleCategoryGate || 'hard',
      alpha: input.alpha ?? 0.5,
      top1: input.top1 ?? null,
      flags: input.flags,
      ...(input.appliedDictionaryRules?.length
        ? { appliedDictionaryRules: input.appliedDictionaryRules }
        : {}),
    };

    this.queryLogs.push(entry);
    if (this.queryLogs.length > this.maxLogs) {
      this.queryLogs.splice(0, this.queryLogs.length - this.maxLogs);
    }
    return entry;
  }

  public listQueryLogs(options?: {
    tenantId?: string;
    q?: string;
    emptyOnly?: boolean;
    gatedOnly?: boolean;
    rewrittenOnly?: boolean;
    period?: '24h' | '7d' | '30d';
    page?: number;
    limit?: number;
  }): {
    total: number;
    page: number;
    limit: number;
    items: QueryLogRecord[];
  } {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(200, Math.max(1, options?.limit || 50));
    const cutoffMs = this.resolvePeriodCutoffMs(options?.period || '30d');
    const qLower = options?.q ? options.q.trim().toLowerCase() : '';

    const filtered = this.queryLogs
      .filter((r) => {
        if (options?.tenantId && r.tenantId !== options.tenantId) return false;
        const ts = Date.parse(r.timestamp);
        if (!Number.isNaN(ts) && ts < cutoffMs) return false;
        if (options?.emptyOnly && !r.flags.empty) return false;
        if (options?.gatedOnly && !r.flags.gated) return false;
        if (options?.rewrittenOnly && !r.flags.rewritten) return false;
        if (qLower) {
          const hay = `${r.query} ${r.normalizedQuery} ${r.top1?.title || ''} ${r.top1?.category || ''} ${r.headCategoryIntent || ''}`.toLowerCase();
          if (!hay.includes(qLower)) return false;
        }
        return true;
      })
      .slice()
      .reverse();

    const start = (page - 1) * limit;
    return {
      total: filtered.length,
      page,
      limit,
      items: filtered.slice(start, start + limit),
    };
  }

  public recordStorefrontEvent(input: {
    tenantId?: string;
    type: 'click' | 'add_to_cart' | 'purchase';
    searchId?: string;
    query?: string;
    productId: string;
  }): StorefrontEventRecord {
    const ev: StorefrontEventRecord = {
      id: `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      tenantId: input.tenantId || 'default',
      type: input.type,
      searchId: input.searchId,
      query: input.query,
      productId: input.productId,
    };
    this.events.push(ev);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
    return ev;
  }

  public recordCatalogUpsert(summary: Omit<CatalogUpsertSummary, 'timestamp'> & { timestamp?: string }): void {
    this.lastUpsertByTenant.set(summary.tenantId || 'default', {
      timestamp: summary.timestamp || new Date().toISOString(),
      tenantId: summary.tenantId || 'default',
      indexName: summary.indexName || 'default',
      upserted: summary.upserted,
      failed: summary.failed,
      sampleRowErrors: (summary.sampleRowErrors || []).slice(0, 20),
    });
  }

  public getLastCatalogUpsert(tenantId = 'default'): CatalogUpsertSummary | null {
    return this.lastUpsertByTenant.get(tenantId) || null;
  }

  public recordSearch5xxError(tenantId = 'default'): void {
    this.error5xxCountByTenant.set(tenantId, (this.error5xxCountByTenant.get(tenantId) || 0) + 1);
  }

  public getAnalyticsSummary(options?: {
    tenantId?: string;
    period?: '24h' | '7d' | '30d';
  }) {
    const period = options?.period || '7d';
    const cutoffMs = this.resolvePeriodCutoffMs(period);
    const tenantId = options?.tenantId;

    const logs = this.queryLogs.filter((r) => {
      if (tenantId && r.tenantId !== tenantId) return false;
      const ts = Date.parse(r.timestamp);
      return Number.isNaN(ts) || ts >= cutoffMs;
    });

    const periodEvents = this.events.filter((e) => {
      if (tenantId && e.tenantId !== tenantId) return false;
      const ts = Date.parse(e.timestamp);
      return Number.isNaN(ts) || ts >= cutoffMs;
    });

    const totalSearches = logs.length;
    const emptySearches = logs.filter((l) => l.flags.empty).length;
    const categoryGateBlocks = logs.filter((l) => l.flags.gated).length;
    const rewrittenSearches = logs.filter((l) => l.flags.rewritten).length;
    const zeroResultRate =
      totalSearches > 0 ? Number(((emptySearches / totalSearches) * 100).toFixed(2)) : 0;

    const latencies = logs.map((l) => l.latencyMs).sort((a, b) => a - b);
    const avgLatencyMs =
      latencies.length > 0
        ? Number((latencies.reduce((s, v) => s + v, 0) / latencies.length).toFixed(2))
        : 0;
    const p50LatencyMs =
      latencies.length > 0 ? Number(latencies[Math.floor(latencies.length * 0.5)].toFixed(2)) : 0;
    const p95LatencyMs =
      latencies.length > 0
        ? Number(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))].toFixed(2))
        : 0;

    // Group by day
    const byDayMap = new Map<string, { searches: number; empty: number; latencies: number[] }>();
    for (const l of logs) {
      const dayKey = l.timestamp.slice(0, 10);
      const bucket = byDayMap.get(dayKey) || { searches: 0, empty: 0, latencies: [] };
      bucket.searches += 1;
      if (l.flags.empty) bucket.empty += 1;
      bucket.latencies.push(l.latencyMs);
      byDayMap.set(dayKey, bucket);
    }

    const searchesByDay = Array.from(byDayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => {
        const sortedLat = b.latencies.slice().sort((x, y) => x - y);
        const dayP95 =
          sortedLat.length > 0
            ? Number(sortedLat[Math.min(sortedLat.length - 1, Math.floor(sortedLat.length * 0.95))].toFixed(2))
            : 0;
        return {
          date,
          searches: b.searches,
          emptySearches: b.empty,
          zeroResultShare: b.searches > 0 ? Number(((b.empty / b.searches) * 100).toFixed(1)) : 0,
          p95LatencyMs: dayP95,
        };
      });

    // Top queries & Top zero-result queries
    const queryAgg = new Map<
      string,
      {
        query: string;
        count: number;
        emptyCount: number;
        totalLatency: number;
        top1Category: string | null;
        lastSeenAt: string;
        headCategoryIntent: string | null;
      }
    >();

    for (const l of logs) {
      const k = l.query.trim().toLowerCase();
      if (!k) continue;
      const existing = queryAgg.get(k);
      if (existing) {
        existing.count += 1;
        if (l.flags.empty) existing.emptyCount += 1;
        existing.totalLatency += l.latencyMs;
        if (l.top1?.category) existing.top1Category = l.top1.category;
        if (l.timestamp > existing.lastSeenAt) existing.lastSeenAt = l.timestamp;
      } else {
        queryAgg.set(k, {
          query: l.query.trim(),
          count: 1,
          emptyCount: l.flags.empty ? 1 : 0,
          totalLatency: l.latencyMs,
          top1Category: l.top1?.category ?? null,
          lastSeenAt: l.timestamp,
          headCategoryIntent: l.headCategoryIntent ?? null,
        });
      }
    }

    const topQueries = Array.from(queryAgg.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)
      .map((q) => ({
        query: q.query,
        count: q.count,
        emptyCount: q.emptyCount,
        avgLatencyMs: Number((q.totalLatency / q.count).toFixed(2)),
        top1Category: q.top1Category,
      }));

    const topZeroResultQueries = Array.from(queryAgg.values())
      .filter((q) => q.emptyCount > 0)
      .sort((a, b) => b.emptyCount - a.emptyCount)
      .slice(0, 15)
      .map((q) => ({
        query: q.query,
        count: q.emptyCount,
        lastSeenAt: q.lastSeenAt,
        headCategoryIntent: q.headCategoryIntent,
      }));

    const clicks = periodEvents.filter((e) => e.type === 'click').length;
    const addToCart = periodEvents.filter((e) => e.type === 'add_to_cart').length;
    const purchases = periodEvents.filter((e) => e.type === 'purchase').length;
    const ctrPercent =
      totalSearches > 0 ? Number(Math.min(100, (clicks / totalSearches) * 100).toFixed(2)) : 0;

    const error5xxCount = this.error5xxCountByTenant.get(tenantId || 'default') || 0;

    return {
      period,
      totalSearches,
      emptySearches,
      zeroResultRate,
      avgLatencyMs,
      p50LatencyMs,
      p95LatencyMs,
      categoryGateBlocks,
      rewrittenSearches,
      error5xxCount,
      searchesByDay,
      topQueries,
      topZeroResultQueries,
      honestFunnel: {
        searches: totalSearches,
        clicks,
        addToCart,
        purchases,
        ctrPercent,
        hasStorefrontOrderEvents: purchases > 0,
      },
      searchesWithClick: clicks,
    };
  }

  public resetForTests(): void {
    this.queryLogs = [];
    this.events = [];
    this.dictionariesByTenant.clear();
    this.rankingDefaultsByTenant.clear();
    this.lastUpsertByTenant.clear();
    this.error5xxCountByTenant.clear();
  }

  private resolvePeriodCutoffMs(period: '24h' | '7d' | '30d'): number {
    const now = Date.now();
    if (period === '24h') return now - 24 * 3600_000;
    if (period === '7d') return now - 7 * 24 * 3600_000;
    return now - 30 * 24 * 3600_000;
  }
}

export function getAdminConsoleStore(): AdminConsoleStore {
  return AdminConsoleStore.getInstance();
}

