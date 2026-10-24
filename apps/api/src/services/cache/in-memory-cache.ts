/**
 * In-memory cache with TTL and automatic cleanup.
 * Used as fallback when Redis is unavailable (local development).
 *
 * CRITICAL: Includes memory leak protection with:
 * - Automatic TTL expiration
 * - Maximum key limit
 * - Periodic cleanup
 */
export class InMemoryCache {
  private store = new Map<
    string,
    {
      value: any;
      expiresAt: number;
      createdAt: number;
    }
  >();

  private maxKeys: number;
  private defaultTTLSeconds: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    options: {
      maxKeys?: number;
      cleanupIntervalMs?: number;
      defaultTTLSeconds?: number;
    } = {}
  ) {
    this.maxKeys = options.maxKeys ?? 10_000;
    this.defaultTTLSeconds = options.defaultTTLSeconds ?? 300;
    const cleanupIntervalMs = options.cleanupIntervalMs ?? 60_000; // Every minute

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);

    // Allow process to exit even if interval is active
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);

    if (!entry) return null;

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const effectiveTtl = ttlSeconds ?? this.defaultTTLSeconds;

    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxKeys && !this.store.has(key)) {
      const evictCount = Math.min(
        100,
        Math.max(1, this.store.size - this.maxKeys + 1)
      );
      this.evictOldest(evictCount);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + effectiveTtl * 1000,
      createdAt: Date.now(),
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  keysMatching(pattern: string): string[] {
    this.cleanup();
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    const matched: string[] = [];
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        matched.push(key);
      }
    }
    return matched;
  }

  async invalidate(pattern: string): Promise<number> {
    const keysToDelete = this.keysMatching(pattern);
    keysToDelete.forEach((key) => this.store.delete(key));
    return keysToDelete.length;
  }

  clearSync(): void {
    this.store.clear();
  }

  async healthCheck(): Promise<boolean> {
    return true; // In-memory is always "healthy"
  }

  async getStats(): Promise<{
    type: string;
    keys: number;
    maxKeys: number;
    memoryUsageMB: number;
    memory: string;
  }> {
    this.cleanup();
    const memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    return {
      type: 'in-memory',
      keys: this.store.size,
      maxKeys: this.maxKeys,
      memoryUsageMB,
      memory: `${memoryUsageMB}M`,
    };
  }

  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.store) {
      if (entry.expiresAt < now) {
        this.store.delete(key);
        removed++;
      }
    }

    if (removed > 0 && process.env.NODE_ENV === 'development') {
      console.log(`InMemoryCache cleanup: removed ${removed} expired keys`);
    }
  }

  /**
   * Evict oldest entries when at capacity
   */
  private evictOldest(count: number): void {
    const entries = [...this.store.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt)
      .slice(0, count);

    for (const [key] of entries) {
      this.store.delete(key);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`InMemoryCache evicted ${count} oldest keys (capacity: ${this.maxKeys})`);
    }
  }
}
