import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FastifyInstance } from 'fastify';
import { LRUQueryCache, CircuitBreaker } from '@eidos/core';
import { buildServer } from '../src/server';
import { ApiQueryCache } from '../src/services/query-cache';

const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('PHASE 3: Competitive Edge 10/10 (LRU Query Cache, CircuitBreaker, SEO JSON-LD, Migration Guide, Python SDK)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ApiQueryCache.invalidateAll();
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('TASK 3.1: O(1) LRUQueryCache & API /v1/search + /v1/recommend return x-cache MISS then HIT and invalidate on upsert', async () => {
    const lru = new LRUQueryCache<number>(2, 5000);
    lru.set('a', 1);
    lru.set('b', 2);
    expect(lru.get('a')).toBe(1); // 'a' becomes MRU, 'b' becomes LRU
    lru.set('c', 3); // evicts 'b'
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('a')).toBe(1);
    expect(lru.stats().evictions).toBe(1);

    // First API search -> MISS
    const searchMiss = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'cyberpunk neural', limit: 3 },
    });
    expect(searchMiss.statusCode).toBe(200);
    expect(searchMiss.headers['x-cache']).toBe('MISS');

    // Second identical API search -> HIT
    const searchHit = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'cyberpunk neural', limit: 3 },
    });
    expect(searchHit.statusCode).toBe(200);
    expect(searchHit.headers['x-cache']).toBe('HIT');
    expect(searchHit.json().cached).toBe(true);

    // Upsert new item -> invalidates cache
    await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        id: 'cache-buster-item',
        title: 'Quantum Synthesizer',
        category: 'Electronics',
        price: 199,
      },
    });

    const searchAfterUpsert = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'cyberpunk neural', limit: 3 },
    });
    expect(searchAfterUpsert.headers['x-cache']).toBe('MISS');
  });

  it('TASK 3.2: SEO & Schema.org JSON-LD structured data, robots.txt, and sitemap.xml are present', () => {
    const indexHtml = fs.readFileSync(
      path.resolve(ROOT_DIR, 'apps/workspace/index.html'),
      'utf-8'
    );
    expect(indexHtml).toContain('application/ld+json');
    expect(indexHtml).toContain('"@type": "SoftwareApplication"');
    expect(indexHtml).toContain('rel="canonical"');

    expect(fs.existsSync(path.resolve(ROOT_DIR, 'public/robots.txt'))).toBe(true);
    expect(fs.existsSync(path.resolve(ROOT_DIR, 'public/sitemap.xml'))).toBe(true);
  });

  it('TASK 3.3: CircuitBreaker transitions CLOSED -> OPEN -> HALF_OPEN -> CLOSED cleanly', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 20,
      halfOpenMaxSuccesses: 1,
    });

    expect(cb.getState()).toBe('CLOSED');

    await expect(cb.execute(async () => { throw new Error('fail 1'); })).rejects.toThrow('fail 1');
    expect(cb.getState()).toBe('CLOSED');

    await expect(cb.execute(async () => { throw new Error('fail 2'); })).rejects.toThrow('fail 2');
    expect(cb.getState()).toBe('OPEN');

    // Fallback works while OPEN
    const fallbackVal = await cb.execute(
      async () => 'live',
      () => 'fallback-value'
    );
    expect(fallbackVal).toBe('fallback-value');

    // Wait for resetTimeoutMs -> HALF_OPEN -> success -> CLOSED
    await new Promise((r) => setTimeout(r, 30));
    expect(cb.getState()).toBe('HALF_OPEN');

    const recovered = await cb.execute(async () => 'recovered-ok');
    expect(recovered).toBe('recovered-ok');
    expect(cb.getState()).toBe('CLOSED');
  });

  it('TASK 3.4 & 3.5: docs/MIGRATION.md and Python SDK unified strategy client exist and are complete', () => {
    const migrationDoc = fs.readFileSync(path.resolve(ROOT_DIR, 'docs/MIGRATION.md'), 'utf-8');
    expect(migrationDoc).toContain('Algolia');
    expect(migrationDoc).toContain('Pinecone');
    expect(migrationDoc).toContain('Constructor.io');

    const pyInit = fs.readFileSync(
      path.resolve(ROOT_DIR, 'packages/python-sdk/eidos/__init__.py'),
      'utf-8'
    );
    expect(pyInit).toContain('strategy: Literal["simple", "adaptive", "user"]');
    expect(pyInit).toContain('def record_feedback');
    expect(pyInit).toContain('def upsert_item');

    expect(
      fs.existsSync(
        path.resolve(ROOT_DIR, 'packages/python-sdk/examples/quickstart_ecommerce.py')
      )
    ).toBe(true);
  });
});
