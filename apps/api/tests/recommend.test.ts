import { describe, it, expect, beforeAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server';

describe('Fastify REST API Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.EIDOS_API_KEY = 'test_key_12345';
    process.env.NODE_ENV = 'test';
    app = await buildApp();
  });

  it('GET /v1/health returns status healthy without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('healthy');
    expect(body.version).toBe('1.0.0');
  });

  it('POST /v1/recommend returns 401 without Bearer token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      payload: { itemId: 'prod-001' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /v1/catalog ingests items and POST /v1/recommend retrieves matches', async () => {
    // 1. Ingest test items
    const ingestRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog',
      headers: {
        authorization: 'Bearer test_key_12345',
      },
      payload: {
        items: [
          {
            id: 'unit-item-1',
            title: 'Mechanical Keyboard Blue Switches',
            description: 'Clicky tactile typing keyboard with aluminum chassis.',
            category: 'Electronics',
            tags: ['typing', 'hardware'],
            embedding: [0.9, 0.1, 0.0, 0.0],
          },
          {
            id: 'unit-item-2',
            title: 'Custom Keycap Set PBT Dye-Sub',
            description: 'Cherry profile keycaps matching mechanical switches.',
            category: 'Electronics',
            tags: ['accessories', 'typing'],
            embedding: [0.85, 0.15, 0.0, 0.0],
          },
          {
            id: 'unit-item-3',
            title: 'Chef Santoku Japanese Steel Knife',
            description: 'Razor sharp kitchen blade for slicing vegetables.',
            category: 'Kitchen',
            tags: ['cooking', 'culinary'],
            embedding: [0.0, 0.0, 0.9, 0.1],
          },
        ],
      },
    });

    expect(ingestRes.statusCode).toBe(201);

    // 2. Recommend for item-1
    const recRes = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: {
        authorization: 'Bearer test_key_12345',
      },
      payload: {
        itemId: 'unit-item-1',
        limit: 2,
        diversityFactor: 0.7,
      },
    });

    expect(recRes.statusCode).toBe(200);
    const body = JSON.parse(recRes.body);
    expect(body.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(body.recommendations[0].id).toBe('unit-item-2');
  });
});
