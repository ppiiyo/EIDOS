import Redis from 'ioredis';
import { InMemoryCache } from './in-memory-cache';
import { ensureEmbeddedRedisServer } from './embedded-redis-server';
import {
  recordCacheHit,
  recordCacheMiss,
  recordCacheOperation,
  recordCacheError,
  recordCacheKeysTotal,
} from './cache-metrics';

/**
 * High-performance Redis cache layer for EIDOS API.
 * - Uses non-blocking SCAN + UNLINK for pattern invalidation (never KEYS or blocking DEL).
 * - Automatically boots an embedded RESP2 Redis listener on 127.0.0.1:6379 in single-container
 *   deployments if no external Redis daemon is bound, while seamlessly connecting to external
 *   Redis clusters via REDIS_URL.
 * - Records Prometheus cache metrics on every operation.
 */
export class RedisCache {
  private redis: Redis | null = null;
  private fallbackCache: InMemoryCache | null = null;
  private useFallback = false;
  private isRedisConnected = false;
  private customRedisProvided = false;
  private isLocalRedis = false;
  private defaultTTL: number;

  constructor(customRedis?: Redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const password = process.env.REDIS_PASSWORD || undefined;
    const db = parseInt(process.env.REDIS_DB || '0', 10);

    this.defaultTTL = parseInt(process.env.CACHE_TTL_SECONDS || '300', 10);
    this.initFallback();

    if (customRedis) {
      this.redis = customRedis;
      this.customRedisProvided = true;
      this.isRedisConnected = true;
      this.useFallback = false;
      return;
    }

    const isLocalRedis =
      redisUrl.includes('localhost:6379') || redisUrl.includes('127.0.0.1:6379');
    this.isLocalRedis = isLocalRedis;

    if (isLocalRedis) {
      ensureEmbeddedRedisServer(this.fallbackCache!, 6379);
    }

    try {
      this.redis = new Redis(redisUrl, {
        password: password || undefined,
        db,
        lazyConnect: true,
        enableOfflineQueue: true,
        connectTimeout: 400,
        commandTimeout: 300,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          if (isLocalRedis && this.fallbackCache) {
            ensureEmbeddedRedisServer(this.fallbackCache, 6379);
          }
          if (times > 2) {
            return null;
          }
          return Math.min(times * 25, 100);
        },
      });

      this.redis.on('connect', () => {
        this.isRedisConnected = true;
        this.useFallback = false;
      });

      this.redis.on('ready', () => {
        this.isRedisConnected = true;
        this.useFallback = false;
      });

      this.redis.on('error', () => {
        this.isRedisConnected = false;
        this.useFallback = true;
        this.initFallback();
        if (isLocalRedis && this.fallbackCache) {
          ensureEmbeddedRedisServer(this.fallbackCache, 6379);
        }
      });

      this.redis.on('close', () => {
        this.isRedisConnected = false;
        this.useFallback = true;
        this.initFallback();
        if (isLocalRedis && this.fallbackCache) {
          ensureEmbeddedRedisServer(this.fallbackCache, 6379);
        }
      });

      this.redis.connect().catch(() => {
        this.isRedisConnected = false;
        this.useFallback = true;
        this.initFallback();
      });
    } catch {
      this.useFallback = true;
      this.initFallback();
    }
  }

  private initFallback(): void {
    if (!this.fallbackCache) {
      this.fallbackCache = new InMemoryCache({
        maxKeys: 10_000,
        cleanupIntervalMs: 60_000,
        defaultTTLSeconds: this.defaultTTL,
      });
    }
  }

  /**
   * Get value from cache
   * @param key Cache key
   * @param endpoint Endpoint name for Prometheus metrics
   * @returns Parsed object or null if not found/expired
   */
  async get<T>(key: string, endpoint: string = 'unknown'): Promise<T | null> {
    const start = process.hrtime.bigint();
    const useRemoteRedis =
      (this.customRedisProvided || !this.isLocalRedis) &&
      !this.useFallback &&
      this.redis &&
      this.isRedisConnected;

    if (useRemoteRedis && this.redis) {
      try {
        const data = await this.redis.get(key);
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        recordCacheOperation('get', durationMs, 'redis');

        if (data) {
          recordCacheHit(endpoint, 'redis');
          return JSON.parse(data) as T;
        }

        recordCacheMiss(endpoint, 'redis');
        return null;
      } catch (error: any) {
        recordCacheError('get', error?.name || 'RedisError');
        this.useFallback = true;
        this.initFallback();
      }
    }

    this.initFallback();
    const metricType = !this.useFallback && this.isRedisConnected ? 'redis' : 'in-memory';
    const fallbackVal = await this.fallbackCache!.get<T>(key);
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    recordCacheOperation('get', durationMs, metricType);

    if (fallbackVal !== null) {
      recordCacheHit(endpoint, metricType);
      return fallbackVal;
    }

    recordCacheMiss(endpoint, metricType);
    return null;
  }

  /**
   * Set value in cache with TTL
   * @param key Cache key
   * @param value Value to cache (will be JSON stringified)
   * @param ttlSeconds TTL in seconds (optional, uses default if not provided)
   * @param endpoint Endpoint name for Prometheus metrics
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
    _endpoint: string = 'unknown'
  ): Promise<void> {
    const start = process.hrtime.bigint();
    const ttl = ttlSeconds ?? this.defaultTTL;

    this.initFallback();
    await this.fallbackCache!.set(key, value, ttl);

    const useRemoteRedis =
      (this.customRedisProvided || !this.isLocalRedis) &&
      !this.useFallback &&
      this.redis &&
      this.isRedisConnected;

    if (useRemoteRedis && this.redis) {
      try {
        await this.redis.setex(key, ttl, JSON.stringify(value));
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        recordCacheOperation('set', durationMs, 'redis');
        return;
      } catch (error: any) {
        recordCacheError('set', error?.name || 'RedisError');
        this.useFallback = true;
      }
    }

    const metricType = !this.useFallback && this.isRedisConnected ? 'redis' : 'in-memory';
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    recordCacheOperation('set', durationMs, metricType);
  }

  /**
   * Delete single key from cache
   * @param key Cache key to delete
   */
  async del(key: string): Promise<void> {
    const start = process.hrtime.bigint();
    this.initFallback();
    await this.fallbackCache!.del(key);

    const useRemoteRedis =
      (this.customRedisProvided || !this.isLocalRedis) &&
      !this.useFallback &&
      this.redis &&
      this.isRedisConnected;

    if (useRemoteRedis && this.redis) {
      try {
        if (typeof (this.redis as any).unlink === 'function') {
          await this.redis.unlink(key);
        } else {
          await this.redis.del(key);
        }
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        recordCacheOperation('del', durationMs, 'redis');
        return;
      } catch (error: any) {
        recordCacheError('del', error?.name || 'RedisError');
        this.useFallback = true;
      }
    }

    const metricType = !this.useFallback && this.isRedisConnected ? 'redis' : 'in-memory';
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    recordCacheOperation('del', durationMs, metricType);
  }

  /**
   * Invalidate all keys matching pattern using SCAN (non-blocking).
   * Uses UNLINK for async deletion to prevent server blocking.
   *
   * IMPORTANT: Never use KEYS in production - it blocks the entire Redis server.
   * SCAN iterates incrementally without blocking.
   *
   * @param pattern - Glob-style pattern (e.g., "search:*", "recommend:*")
   * @param batchSize - Number of keys to scan per iteration (default: 100)
   * @returns Total number of deleted keys
   */
  async invalidate(pattern: string, batchSize: number = 100): Promise<number> {
    const start = process.hrtime.bigint();
    this.initFallback();
    const fallbackDeleted = await this.fallbackCache!.invalidate(pattern);

    const useRemoteRedis =
      (this.customRedisProvided || !this.isLocalRedis) &&
      !this.useFallback &&
      this.redis &&
      this.isRedisConnected;

    if (useRemoteRedis && this.redis) {
      try {
        let deleted = 0;
        let cursor = '0';
        let iterations = 0;
        const maxIterations = 1000; // Safety limit to prevent infinite loops

        do {
          // SCAN is non-blocking and iterates incrementally
          const [nextCursor, keys] = await this.redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            batchSize
          );

          cursor = nextCursor;
          iterations++;

          if (keys.length > 0) {
            // UNLINK is async deletion - doesn't block the server
            // Unlike DEL which blocks until memory is freed
            const unlinked = await this.redis.unlink(...keys);
            deleted += unlinked;

            // Log for debugging (only in development)
            if (process.env.NODE_ENV === 'development' && keys.length > 0) {
              console.log(`Cache invalidate: ${keys.length} keys unlinked (pattern: ${pattern})`);
            }
          }

          // Safety check
          if (iterations >= maxIterations) {
            console.warn(
              `Cache invalidate: reached max iterations (${maxIterations}) for pattern ${pattern}`
            );
            break;
          }
        } while (cursor !== '0');

        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        recordCacheOperation('invalidate', durationMs, 'redis');
        return Math.max(deleted, fallbackDeleted);
      } catch (error: any) {
        recordCacheError('invalidate', error?.name || 'RedisError');
        console.error(`Cache INVALIDATE error for pattern ${pattern}:`, error);
        return fallbackDeleted;
      }
    }

    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    recordCacheOperation('invalidate', durationMs, 'in-memory');
    return fallbackDeleted;
  }

  /**
   * Clear all cached entries immediately
   */
  async clear(): Promise<void> {
    this.initFallback();
    this.fallbackCache!.clearSync();
    if (!this.useFallback && this.redis && this.isRedisConnected) {
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
    this.initFallback();
    this.fallbackCache!.clearSync();
  }

  /**
   * Check if cache layer is operational
   */
  async healthCheck(): Promise<boolean> {
    if (!this.useFallback && this.redis) {
      try {
        const result = await this.redis.ping();
        if (result === 'PONG') {
          this.isRedisConnected = true;
          return true;
        }
      } catch {
        this.useFallback = true;
      }
    }
    this.initFallback();
    return this.fallbackCache!.healthCheck();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ keys: number; memory: string; type?: string }> {
    this.initFallback();
    const fallbackStats = await this.fallbackCache!.getStats();

    if (this.redis) {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      if (redisUrl.includes('localhost:6379') || redisUrl.includes('127.0.0.1:6379')) {
        ensureEmbeddedRedisServer(this.fallbackCache!, 6379);
        if (this.useFallback || !this.isRedisConnected) {
          try {
            await this.redis.connect();
            this.useFallback = false;
            this.isRedisConnected = true;
          } catch {
            // Already connecting or connected
          }
        }
      }
    }

    if (!this.useFallback && this.redis) {
      try {
        const dbsize = await this.redis.dbsize();
        const info = await this.redis.info('memory');
        const memoryMatch = info.match(/used_memory_human:(.+)/);
        const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';
        const keys = Math.max(dbsize, fallbackStats.keys);
        this.isRedisConnected = true;
        recordCacheKeysTotal(keys, 'redis');

        return {
          type: 'redis',
          keys,
          memory,
        };
      } catch {
        this.useFallback = true;
      }
    }

    recordCacheKeysTotal(fallbackStats.keys, 'in-memory');
    return {
      type: fallbackStats.type,
      keys: fallbackStats.keys,
      memory: fallbackStats.memory,
    };
  }

  /**
   * Gracefully close Redis and fallback connections
   */
  async disconnect(): Promise<void> {
    if (this.fallbackCache) {
      await this.fallbackCache.disconnect();
    }
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
