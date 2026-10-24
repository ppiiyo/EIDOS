import { describe, it, expect } from 'vitest';
import { SingleFlight } from '../src/services/cache/singleflight';
import { InMemoryCache } from '../src/services/cache/in-memory-cache';
import {
  isCacheKeySafe,
  isResponseCacheable,
  sanitizeHeadersForCache,
  generateSafeCacheKey,
} from '../src/services/cache/cache-validator';
import {
  cacheMetrics,
  recordCacheHit,
  recordCacheMiss,
  recordCacheOperation,
} from '../src/services/cache/cache-metrics';
import { buildServer } from '../src/server';

describe('Cache Hardening Tests', () => {
  describe('SingleFlight', () => {
    it('should prevent thundering herd', async () => {
      const sf = new SingleFlight();
      let executionCount = 0;

      const fn = async () => {
        executionCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'result';
      };

      // 100 concurrent requests
      const promises = Array.from({ length: 100 }, () => sf.do('key', fn));
      await Promise.all(promises);

      expect(executionCount).toBe(1); // Only one execution
    });

    it('should handle timeouts', async () => {
      const sf = new SingleFlight();

      const slowFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        return 'slow';
      };

      await expect(sf.do('key', slowFn, 100)).rejects.toThrow('timeout');
    });
  });

  describe('InMemoryCache', () => {
    it('should respect maxKeys limit', async () => {
      const cache = new InMemoryCache({ maxKeys: 10 });

      // Add 20 keys
      for (let i = 0; i < 20; i++) {
        await cache.set(`key-${i}`, `value-${i}`, 300);
      }

      const stats = await cache.getStats();
      expect(stats.keys).toBeLessThanOrEqual(10);
      await cache.disconnect();
    });

    it('should expire keys correctly', async () => {
      const cache = new InMemoryCache();

      await cache.set('key', 'value', 1); // 1 second TTL

      // Should exist immediately
      expect(await cache.get('key')).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired
      expect(await cache.get('key')).toBe(null);
      await cache.disconnect();
    });
  });

  describe('Cache Validator', () => {
    it('should reject unsafe cache keys', () => {
      expect(isCacheKeySafe('search:password:123')).toBe(false);
      expect(isCacheKeySafe('search:user-id:456')).toBe(false);
      expect(isCacheKeySafe('search:../../etc/passwd')).toBe(false);
      expect(isCacheKeySafe('a'.repeat(2000))).toBe(false); // Too long
    });

    it('should accept safe cache keys', () => {
      expect(isCacheKeySafe('search:наушники:abc123')).toBe(true);
      expect(isCacheKeySafe('recommend:item-1:adaptive')).toBe(true);
    });

    it('should reject non-cacheable responses', () => {
      expect(isResponseCacheable({ userId: '123', data: [] })).toBe(false);
      expect(isResponseCacheable({ token: 'abc', data: [] })).toBe(false);
      expect(isResponseCacheable({ email: 'user@example.com' })).toBe(false);
    });

    it('should accept cacheable responses', () => {
      expect(isResponseCacheable({ results: [], count: 0 })).toBe(true);
      expect(isResponseCacheable({ items: [], total: 100 })).toBe(true);
    });

    it('should sanitize headers and generate safe cache keys', () => {
      const sanitized = sanitizeHeadersForCache({
        Authorization: 'Bearer secret-token',
        Cookie: 'session=abc',
        'x-user-id': 'u-99',
        'accept-language': 'ru-RU',
      });
      expect(sanitized.Authorization).toBeUndefined();
      expect(sanitized.Cookie).toBeUndefined();
      expect(sanitized['x-user-id']).toBeUndefined();
      expect(sanitized['accept-language']).toBe('ru-RU');

      const safeKey = generateSafeCacheKey('search', { query: 'headphones', limit: 5 });
      expect(safeKey).toContain('search:');
      expect(() => generateSafeCacheKey('search', { password: '123' })).toThrow('Unsafe cache key');
    });
  });

  describe('Prometheus Cache Metrics (Patch 5)', () => {
    it('exposes eidos_cache_* metrics on GET /metrics', async () => {
      recordCacheHit('search', 'redis');
      recordCacheMiss('search', 'redis');
      recordCacheOperation('get', 0.45, 'redis');

      const hitsMetric = await cacheMetrics.hits.get();
      expect(hitsMetric.values.length).toBeGreaterThan(0);

      const app = await buildServer();
      await app.ready();

      const res = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('eidos_cache_hits_total');
      expect(res.body).toContain('eidos_cache_misses_total');
      expect(res.body).toContain('eidos_cache_hit_rate');
      expect(res.body).toContain('eidos_cache_operation_duration_ms');
      expect(res.body).toContain('eidos_cache_keys_total');
      expect(res.body).toContain('eidos_cache_errors_total');

      await app.close();
    });
  });
});
