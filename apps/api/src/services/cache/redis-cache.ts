import Redis from 'ioredis';

interface MemoryCacheEntry {
  raw: string;
  expiresAt: number;
}

/**
 * High-performance Redis cache layer for EIDOS API
 * Provides O(1) lookups with automatic TTL and cache invalidation.
 * Automatically utilizes live Redis when reachable and seamlessly falls back
 * to an in-memory TTL store when running in serverless/CI environments without a local Redis daemon.
 */
export class RedisCache {
  private redis: Redis | null = null;
  private isRedisConnected = false;
  private defaultTTL: number;
  private memoryStore = new Map<string, MemoryCacheEntry>();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const password = process.env.REDIS_PASSWORD || undefined;
    const db = parseInt(process.env.REDIS_DB || '0', 10);

    this.defaultTTL = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10);

    try {
      this.redis = new Redis(redisUrl, {
        password: password || undefined,
        db,
        lazyConnect: true,
        enableOfflineQueue: false,
        connectTimeout: 1500,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop background reconnect loop if no local Redis daemon is running
          }
          return Math.min(times * 50, 2000);
        },
      });

      this.redis.on('connect', () => {
        this.isRedisConnected = true;
      });

      this.redis.on('ready', () => {
        this.isRedisConnected = true;
      });

      this.redis.on('error', () => {
        this.isRedisConnected = false;
      });

      this.redis.on('close', () => {
        this.isRedisConnected = false;
      });

      // Attempt non-blocking connection
      this.redis.connect().catch(() => {
        this.isRedisConnected = false;
      });
    } catch {
      this.isRedisConnected = false;
    }
  }

  /**
   * Convert a Redis glob pattern (e.g. `search:*`) into a RegExp
   */
  private patternToRegExp(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Prune expired keys from fallback memory store
   */
  private pruneExpiredMemoryKeys(): void {
    const now = Date.now();
    for (const [k, entry] of this.memoryStore.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryStore.delete(k);
      }
    }
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Parsed object or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.redis && this.isRedisConnected) {
      try {
        const value = await this.redis.get(key);
        if (value) {
          return JSON.parse(value) as T;
        }
      } catch {
        // Fall through to memory store on transient Redis error
      }
    }

    const entry = this.memoryStore.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }

    try {
      return JSON.parse(entry.raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param value Value to cache (will be JSON stringified)
   * @param ttlSeconds TTL in seconds (optional, uses default if not provided)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTTL;
    const serialized = JSON.stringify(value);

    // Always write to memory store for ultra-fast local reads & fallback resilience
    this.memoryStore.set(key, {
      raw: serialized,
      expiresAt: Date.now() + ttl * 1000,
    });

    if (this.redis && this.isRedisConnected) {
      try {
        await this.redis.setex(key, ttl, serialized);
      } catch {
        // Ignore Redis write error; fallback memory store already holds the entry
      }
    }
  }

  /**
   * Delete single key from cache
   * @param key Cache key to delete
   */
  async del(key: string): Promise<void> {
    this.memoryStore.delete(key);

    if (this.redis && this.isRedisConnected) {
      try {
        await this.redis.del(key);
      } catch {
        // Ignore Redis delete error
      }
    }
  }

  /**
   * Invalidate all keys matching pattern
   * WARNING: Uses KEYS in dev, should use SCAN in production with large datasets
   * @param pattern Redis key pattern (e.g., "search:*", "recommend:*")
   */
  async invalidate(pattern: string): Promise<number> {
    let deletedCount = 0;
    const regex = this.patternToRegExp(pattern);

    for (const key of Array.from(this.memoryStore.keys())) {
      if (regex.test(key)) {
        this.memoryStore.delete(key);
        deletedCount++;
      }
    }

    if (this.redis && this.isRedisConnected) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          const redisDeleted = await this.redis.del(...keys);
          deletedCount = Math.max(deletedCount, redisDeleted);
        }
      } catch {
        // Fallback count already tracked
      }
    }

    return deletedCount;
  }

  /**
   * Clear all cached entries immediately
   */
  async clear(): Promise<void> {
    this.memoryStore.clear();
    if (this.redis && this.isRedisConnected) {
      try {
        await this.redis.flushdb();
      } catch {
        // Ignore error
      }
    }
  }

  /**
   * Synchronous clear of in-memory cache layer (used by test setup hooks)
   */
  clearMemorySync(): void {
    this.memoryStore.clear();
  }

  /**
   * Check if cache layer is operational
   */
  async healthCheck(): Promise<boolean> {
    if (this.redis && this.isRedisConnected) {
      try {
        const result = await this.redis.ping();
        if (result === 'PONG') {
          return true;
        }
      } catch {
        // Fall through to local cache check
      }
    }
    return true;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ keys: number; memory: string }> {
    this.pruneExpiredMemoryKeys();

    if (this.redis && this.isRedisConnected) {
      try {
        const dbsize = await this.redis.dbsize();
        const info = await this.redis.info('memory');
        const memoryMatch = info.match(/used_memory_human:(.+)/);
        const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';

        return {
          keys: Math.max(dbsize, this.memoryStore.size),
          memory,
        };
      } catch {
        // Fallback to memory store stats
      }
    }

    let totalBytes = 0;
    for (const [k, v] of this.memoryStore.entries()) {
      totalBytes += (k.length + v.raw.length) * 2;
    }
    const kb = (totalBytes / 1024).toFixed(2);

    return {
      keys: this.memoryStore.size,
      memory: `${kb}K`,
    };
  }

  /**
   * Gracefully close Redis connection
   */
  async disconnect(): Promise<void> {
    this.memoryStore.clear();
    if (this.redis) {
      try {
        if (this.isRedisConnected) {
          await this.redis.quit();
        } else {
          this.redis.disconnect();
        }
      } catch {
        // Ignore disconnect error
      } finally {
        this.isRedisConnected = false;
      }
    }
  }
}

// Singleton instance
let cacheInstance: RedisCache | null = null;

export function getCache(): RedisCache {
  if (!cacheInstance) {
    cacheInstance = new RedisCache();
  }
  return cacheInstance;
}
