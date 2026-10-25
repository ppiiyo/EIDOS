export { RedisCache, getCache } from './cache/redis-cache';
export { CacheKeys } from './cache/cache-keys';
export { SingleFlight, getSingleFlight } from './cache/singleflight';
export { InMemoryCache } from './cache/in-memory-cache';
export { SemanticQueryCache, getSemanticCache } from './cache/semantic-cache';
export type { SemanticCacheEntry, SemanticLookupResult } from './cache/semantic-cache';
export {
  isCacheKeySafe,
  isResponseCacheable,
  sanitizeHeadersForCache,
  generateSafeCacheKey,
} from './cache/cache-validator';
export {
  cacheMetrics,
  recordCacheHit,
  recordSemanticCacheHit,
  recordCacheMiss,
  recordCacheOperation,
  recordCacheError,
  recordCacheKeysTotal,
} from './cache/cache-metrics';

export class CacheService<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlSeconds = 300) {
    this.defaultTtlMs = defaultTtlSeconds * 1000;
  }

  public get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  public set(key: string, value: T, ttlSeconds?: number): void {
    const ttlMs = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  public clear(): void {
    this.cache.clear();
  }
}
