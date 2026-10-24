import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { getCache, CacheKeys, RedisCache } from '../src/services/cache';
import { ApiQueryCache } from '../src/services/query-cache';

describe('WEEK 1: Redis Caching Layer & Cache Invalidation', () => {
  let app: FastifyInstance;
  const cache = getCache();

  beforeAll(async () => {
    ApiQueryCache.invalidateAll();
    await cache.clear();
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('CacheKeys generates deterministic, collision-resistant keys for search, recommend, userRecommend, catalogStats, and healthCheck', () => {
    expect(typeof CacheKeys.search).toBe('function');
    expect(cache).toBeInstanceOf(RedisCache);

    const k1 = CacheKeys.search('Wireless Headphones', { category: 'Electronics' }, 10);
    const k2 = CacheKeys.search('  wireless headphones  ', { category: 'Electronics' }, 10);
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^search:[a-f0-9]{12}$/);

    expect(CacheKeys.recommend('item-1', 'simple', 10)).toBe('recommend:simple:item-1:10');
    expect(CacheKeys.userRecommend('user-42', 5)).toBe('recommend:user:user-42:5');
    expect(CacheKeys.catalogStats()).toBe('catalog:stats');
    expect(CacheKeys.healthCheck()).toBe('health:status');
  });

  it('RedisCache supports get, set, del, wildcard invalidate, healthCheck, and getStats', async () => {
    await cache.set('search:test-a', { hits: [1, 2] }, 60);
    await cache.set('search:test-b', { hits: [3, 4] }, 60);
    await cache.set('recommend:simple:1:10', { items: ['2'] }, 60);

    const valA = await cache.get<{ hits: number[] }>('search:test-a');
    expect(valA).toEqual({ hits: [1, 2] });

    const healthy = await cache.healthCheck();
    expect(healthy).toBe(true);

    const stats = await cache.getStats();
    expect(stats.keys).toBeGreaterThanOrEqual(3);
    expect(typeof stats.memory).toBe('string');

    // Delete single key
    await cache.del('search:test-a');
    expect(await cache.get('search:test-a')).toBeNull();

    // Wildcard pattern invalidation
    const deletedCount = await cache.invalidate('search:*');
    expect(deletedCount).toBeGreaterThanOrEqual(1);
    expect(await cache.get('search:test-b')).toBeNull();
    expect(await cache.get('recommend:simple:1:10')).toEqual({ items: ['2'] });

    await cache.del('recommend:simple:1:10');
  });

  it('POST /v1/search returns cacheHit: false on MISS and cacheHit: true + cachedAt on HIT', async () => {
    await cache.invalidate('search:*');
    ApiQueryCache.invalidateAll();

    const firstRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        query: 'wireless noise cancelling headphones',
        filters: { category: 'Electronics' },
        limit: 5,
      },
    });

    expect(firstRes.statusCode).toBe(200);
    const firstBody = firstRes.json();
    expect(firstBody.cacheHit).toBe(false);
    expect(firstRes.headers['x-cache']).toBe('MISS');

    const secondRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        query: 'wireless noise cancelling headphones',
        filters: { category: 'Electronics' },
        limit: 5,
      },
    });

    expect(secondRes.statusCode).toBe(200);
    const secondBody = secondRes.json();
    expect(secondBody.cacheHit).toBe(true);
    expect(typeof secondBody.cachedAt).toBe('string');
    expect(secondRes.headers['x-cache']).toBe('HIT');
  });

  it('POST /v1/recommend caches standard requests (600s TTL) and bypasses cache when dynamic exclude_ids are present', async () => {
    await cache.invalidate('recommend:*');
    ApiQueryCache.invalidateAll();

    const missRes = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        item_id: '1',
        strategy: 'simple',
        limit: 5,
      },
    });

    expect(missRes.statusCode).toBe(200);
    expect(missRes.json().cacheHit).toBe(false);

    const hitRes = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        item_id: '1',
        strategy: 'simple',
        limit: 5,
      },
    });

    expect(hitRes.statusCode).toBe(200);
    expect(hitRes.json().cacheHit).toBe(true);
    expect(typeof hitRes.json().cachedAt).toBe('string');

    // Request with dynamic filters.exclude_ids must bypass cache
    const dynamicRes = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        item_id: '1',
        strategy: 'simple',
        limit: 5,
        filters: { exclude_ids: ['2', '3'] },
      },
    });

    expect(dynamicRes.statusCode).toBe(200);
    expect(dynamicRes.json().cacheHit).toBe(false);
  });

  it('POST /v1/catalog/items and DELETE /v1/catalog/items/:id invalidate search:* and recommend:* caches', async () => {
    // Prime search cache
    await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'ergonomic chair', limit: 5 },
    });

    const hitBefore = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'ergonomic chair', limit: 5 },
    });
    expect(hitBefore.json().cacheHit).toBe(true);

    // Add item via POST /v1/catalog/items
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/items',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        id: 'redis-test-item-999',
        title: 'Ergonomic Studio Chair Pro',
        description: 'Lumbar support mesh chair',
        category: 'Home & Living',
        price: 349,
      },
    });
    expect(createRes.statusCode).toBe(201);

    // Search after catalog insertion must be a cache MISS
    const missAfterCreate = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'ergonomic chair', limit: 5 },
    });
    expect(missAfterCreate.json().cacheHit).toBe(false);

    // Prime again, then delete item via DELETE /v1/catalog/items/:id
    const hitAgain = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'ergonomic chair', limit: 5 },
    });
    expect(hitAgain.json().cacheHit).toBe(true);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: '/v1/catalog/items/redis-test-item-999',
      headers: { 'x-api-key': 'test-key' },
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().deletedId).toBe('redis-test-item-999');

    const missAfterDelete = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'ergonomic chair', limit: 5 },
    });
    expect(missAfterDelete.json().cacheHit).toBe(false);
  });

  it('GET /v1/health includes redis check status and cache statistics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.redis).toBeDefined();
    expect(body.checks.redis.status).toBe('ok');
    expect(body.checks.redis.connected).toBe(true);
    expect(typeof body.checks.redis.stats.keys).toBe('number');
    expect(typeof body.checks.redis.stats.memory).toBe('string');
  });
});
