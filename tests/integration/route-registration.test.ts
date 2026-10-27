import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../apps/api/src/server';
import { FastifyInstance } from 'fastify';

describe('Route Registration Diagnostics', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register /v1/search route', () => {
    const routes = app.printRoutes({ commonPrefix: false });
    console.log('Registered routes:\n', routes);
    expect(routes).toContain('/v1/search');
  });

  it('should register /v1/recommend route', () => {
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes).toContain('/v1/recommend');
  });

  it('should register /v1/demo/search route', () => {
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes).toContain('/v1/demo/search');
  });

  it('should register /v1/demo/recommend route', () => {
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes).toContain('/v1/demo/recommend');
  });

  it('should respond to POST /v1/demo/search with valid payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/demo/search',
      headers: {
        'content-type': 'application/json',
      },
      payload: {
        query: 'wireless headphones',
        limit: 5,
      },
    });

    console.log('Response status:', response.statusCode);
    console.log('Response body:', response.body);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('results');
    expect(Array.isArray(body.results)).toBe(true);
  });
});
