import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server';

describe('POST /v1/recommend', () => {
  let app: any;

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
      url: '/v1/recommend',
      payload: { item_id: '1', limit: 5 },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 on invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': 'test-key' },
      payload: { limit: 'not-a-number' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns recommendations for valid request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': 'test-key' },
      payload: { item_id: '1', limit: 5 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.recommendations).toBeInstanceOf(Array);
    expect(body.recommendations.length).toBeLessThanOrEqual(5);
  });

  it('returns 200 on GET /v1/health', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});
