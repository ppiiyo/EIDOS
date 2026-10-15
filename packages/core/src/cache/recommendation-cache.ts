export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface RecommendationCacheOptions {
  ttlMs?: number;
  personalized?: boolean;
}

/**
 * Three-Tier Recommendation Cache Architecture:
 * - L1: High-speed In-Memory LRU/TTL Cache (sub-millisecond hit)
 * - L2: External Distributed Key-Value Store adapter (Redis/Memcached compatible)
 * - L3: Edge / Static Cache Key generation
 */
export class RecommendationCache {
  private l1Cache = new Map<string, CacheEntry<unknown>>();
  private readonly defaultTTL: number;
  private l2Storage?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttlSeconds: number) => Promise<void>;
    del: (key: string) => Promise<void>;
  };

  constructor(
    defaultTTLMs: number = 5 * 60 * 1000,
    l2Storage?: {
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string, ttlSeconds: number) => Promise<void>;
      del: (key: string) => Promise<void>;
    }
  ) {
    this.defaultTTL = defaultTTLMs;
    this.l2Storage = l2Storage;
  }

  /**
   * Retrieves result from L1/L2 cache or computes it via supplier function.
   */
  public async getOrCompute<T>(
    cacheKey: string,
    computeFn: () => Promise<T> | T,
    options?: RecommendationCacheOptions
  ): Promise<T> {
    const ttl = options?.ttlMs ?? this.defaultTTL;
    const now = Date.now();

    // 1. Check L1 In-Memory Cache
    const l1Entry = this.l1Cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (l1Entry && now - l1Entry.timestamp < ttl) {
      return l1Entry.data;
    }

    // 2. Check L2 External Storage if connected
    if (this.l2Storage) {
      try {
        const l2Raw = await this.l2Storage.get(cacheKey);
        if (l2Raw) {
          const parsed = JSON.parse(l2Raw) as T;
          this.l1Cache.set(cacheKey, { data: parsed, timestamp: now });
          return parsed;
        }
      } catch {
        // Fallback gracefully on L2 connection glitches
      }
    }

    // 3. Compute value
    const freshData = await computeFn();

    // 4. Populate L1
    this.l1Cache.set(cacheKey, { data: freshData, timestamp: now });

    // 5. Populate L2
    if (this.l2Storage) {
      const ttlSec = Math.floor(ttl / 1000);
      try {
        await this.l2Storage.set(cacheKey, JSON.stringify(freshData), ttlSec);
      } catch {
        // non-blocking
      }
    }

    // Periodic sweep of expired L1 entries (10% chance per write)
    if (Math.random() < 0.1) {
      this.cleanup();
    }

    return freshData;
  }

  /**
   * Invalidate cached keys matching a specific substring or pattern.
   */
  public async invalidate(pattern: string): Promise<void> {
    for (const key of Array.from(this.l1Cache.keys())) {
      if (key.includes(pattern)) {
        this.l1Cache.delete(key);
        if (this.l2Storage) {
          try {
            await this.l2Storage.del(key);
          } catch {
            // ignore
          }
        }
      }
    }
  }

  /**
   * Evicts expired records from L1 in-memory cache.
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.l1Cache.entries()) {
      if (now - entry.timestamp > this.defaultTTL) {
        this.l1Cache.delete(key);
      }
    }
  }

  /**
   * Returns current size of L1 cache.
   */
  public size(): number {
    return this.l1Cache.size;
  }

  /**
   * Clears entire cache.
   */
  public clear(): void {
    this.l1Cache.clear();
  }
}
