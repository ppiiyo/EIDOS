import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';

describe('EIDOS v3.1 Release Features & Production Hardening', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. /v1/health is public, does not require authentication, and verifies empty initial vector store', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.itemsIndexed).toBe(0);
    expect(body.initializedEmpty).toBe(true);
    expect(body.checks).toBeDefined();
  });

  it('2. /v1/catalog/stats is public and returns indexed categories after loading demo catalog', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/catalog/stats',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.totalItems).toBe(48);
    expect(body.cache).toBeDefined();
    expect(['redis', 'in-memory']).toContain(body.cache.type);

    const categories = body.categories;
    expect(Object.keys(categories).length).toBeGreaterThanOrEqual(8);
  });

  it('3. Public demo key eidos_public_demo_key_2026 authenticates search request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'eidos_public_demo_key_2026',
      },
      payload: {
        query: 'wireless headphones',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.results)).toBe(true);
  });

  it('4. Demo key rate limit enforces 10 req/min and returns 429 on 11th request', async () => {
    const uniqueIp = '192.168.100.42';

    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'eidos_public_demo_key_2026',
          'x-forwarded-for': uniqueIp,
        },
        remoteAddress: uniqueIp,
        payload: {
          query: `rate limit test query ${i}`,
          limit: 1,
        },
      });
      lastStatus = res.statusCode;
      if (i < 10) {
        expect(res.statusCode).toBe(200);
      }
    }

    expect(lastStatus).toBe(429);
  });
});
