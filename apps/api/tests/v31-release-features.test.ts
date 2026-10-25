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

  it('1. /v1/health is public and does not require authentication', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.checks).toBeDefined();
  });

  it('2. /v1/catalog/stats is public and returns balanced categories with >= 50 items each', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/catalog/stats',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.totalItems).toBeGreaterThanOrEqual(5000);
    expect(body.cache).toBeDefined();
    expect(['redis', 'in-memory']).toContain(body.cache.type);

    const categories = body.categories;
    const expectedCategories = [
      'Games',
      'Movies',
      'Books',
      'Appliances',
      'Electronics',
      'Sports',
      'Fashion',
      'Home',
      'Toys',
    ];

    for (const cat of expectedCategories) {
      expect(categories[cat]).toBeDefined();
      expect(categories[cat]).toBeGreaterThanOrEqual(50);
    }
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
