export interface LRUQueryCacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface LRUQueryCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  maxEntries: number;
  hitRate: number;
}

/**
 * O(1) In-Memory Least Recently Used (LRU) Query Cache with TTL expiration.
 * Uses V8 Map insertion-order semantics to achieve strict O(1) get/set/evict complexity.
 */
export class LRUQueryCache<T = unknown> {
  private readonly store = new Map<string, LRUQueryCacheEntry<T>>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxEntries = 1000, defaultTtlMs = 60_000) {
    if (maxEntries <= 0) {
      throw new Error('LRUQueryCache: maxEntries must be > 0');
    }
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  public get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh recency in O(1) by re-inserting at tail of Map
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;
    return entry.value;
  }

  public set(key: string, value: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtlMs;
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      // Evict oldest (least recently used) key in O(1)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
        this.evictions++;
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  public invalidatePrefix(prefix: string): number {
    let removed = 0;
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  public clear(): void {
    this.store.clear();
  }

  public stats(): LRUQueryCacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.store.size,
      maxEntries: this.maxEntries,
      hitRate: total > 0 ? Math.round((this.hits / total) * 10000) / 10000 : 0,
    };
  }
}
