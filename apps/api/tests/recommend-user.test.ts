import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';

describe('POST /v1/recommend/user', () => {
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
      url: '/v1/recommend/user',
      payload: { user_id: 'user-42', history: ['1'], limit: 5 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 on invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend/user',
      headers: { 'x-api-key': 'test-key' },
      payload: { user_id: '', history: 'not-an-array' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns recommendations for valid user profile and history', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend/user',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        user_id: 'user-42',
        history: ['1'],
        limit: 5,
        context: { device: 'desktop', hourOfDay: 14 },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user_id).toBe('user-42');
    expect(body.recommendations).toBeInstanceOf(Array);
    expect(body.debug).toBeDefined();
  });

  it('falls back cleanly when AIL_ENABLED is false', async () => {
    process.env.AIL_ENABLED = 'false';
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend/user',
      headers: { 'x-api-key': 'test-key' },
      payload: { user_id: 'user-fallback', history: ['1'], limit: 2 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.fallback).toBe(true);
    process.env.AIL_ENABLED = 'true';
  });
});
