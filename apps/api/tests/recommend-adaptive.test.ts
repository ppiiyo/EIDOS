import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';

describe('POST /v1/recommend/adaptive', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.AIL_ENABLED = 'true';
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without API key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend/adaptive',
      payload: { item_id: '1' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 on invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend/adaptive',
      headers: { 'x-api-key': 'test-key' },
      payload: { limit: -5 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for nonexistent item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend/adaptive',
      headers: { 'x-api-key': 'test-key' },
      payload: { item_id: 'nonexistent-item-999' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns adaptive recommendations with user history and KG enrichment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend/adaptive',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        item_id: '1',
        user_id: 'u-100',
        history: ['2'],
        limit: 5,
        context: { device: 'mobile' },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.item_id).toBe('1');
    expect(body.recommendations).toBeInstanceOf(Array);
    expect(body.debug.sources).toContain('similarity');
    expect(body.debug.sources).toContain('user_affinity');
  });

  it('falls back cleanly when AIL_ENABLED is false', async () => {
    process.env.AIL_ENABLED = 'false';
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend/adaptive',
      headers: { 'x-api-key': 'test-key' },
      payload: { item_id: '1', limit: 2 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.fallback).toBe(true);
    process.env.AIL_ENABLED = 'true';
  });
});
