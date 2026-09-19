import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';

describe('POST /v1/feedback', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without API key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback',
      payload: { userId: 'u1', itemId: '1', eventType: 'click' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 on invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback',
      headers: { 'x-api-key': 'test-key' },
      payload: { userId: 'u1', eventType: 'invalid-type' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 on click event and increments stats', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        userId: 'u1',
        itemId: '1',
        eventType: 'click',
        timestamp: Date.now(),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accepted).toBe(true);
    expect(body.stats.clicks).toBeGreaterThanOrEqual(1);
  });

  it('returns 200 on dislike event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/feedback',
      headers: { 'x-api-key': 'test-key' },
      payload: {
        userId: 'u2',
        itemId: '2',
        eventType: 'dislike',
        timestamp: Date.now(),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.accepted).toBe(true);
    expect(body.stats.dislikes).toBeGreaterThanOrEqual(1);
  });
});
