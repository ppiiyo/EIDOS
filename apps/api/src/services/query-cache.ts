import { LRUQueryCache, Metrics } from '@eidos/core';
import { getCache } from './cache';

/**
 * Singleton API-level L1 Query Cache for /v1/search and /v1/recommend.
 * Automatically updates Prometheus eidos_cache_hit_rate gauge.
 */
export class ApiQueryCache {
  private static instance: LRUQueryCache<unknown> | null = null;

  public static getInstance(): LRUQueryCache<unknown> {
    if (!ApiQueryCache.instance) {
      ApiQueryCache.instance = new LRUQueryCache<unknown>(1000, 60_000);
    }
    return ApiQueryCache.instance;
  }

  public static syncMetrics(): void {
    const stats = ApiQueryCache.getInstance().stats();
    Metrics.cacheHitRate.set(stats.hitRate);
  }

  public static invalidateAll(): void {
    ApiQueryCache.getInstance().clear();
    getCache().clearMemorySync();
    ApiQueryCache.syncMetrics();
  }
}

