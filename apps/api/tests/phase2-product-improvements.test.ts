import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { generateDemoCatalog } from '../../../scripts/seed-demo-data';
import { scrubSensitiveHeaders } from '../src/plugins/error-tracker';

describe('PHASE 2: Product Improvements (Seed Dataset, OpenAPI 3.0.3, Sentry Error Tracker, Observability)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('TASK 2.1: generateDemoCatalog generates 105 rich items across 6 categories and /v1/catalog/stats reports metrics', async () => {
    const items = generateDemoCatalog(105);
    expect(items.length).toBe(105);
    const categories = new Set(items.map((i) => i.category));
    expect(categories.size).toBeGreaterThanOrEqual(6);
    expect(categories.has('Electronics')).toBe(true);
    expect(categories.has('Books')).toBe(true);
    expect(categories.has('Sports')).toBe(true);

    const statsRes = await app.inject({
      method: 'GET',
      url: '/v1/catalog/stats',
    });
    expect(statsRes.statusCode).toBe(200);
    const stats = statsRes.json();
    expect(stats.totalItems).toBeGreaterThanOrEqual(5);
    expect(stats.hnswIndexed).toBeGreaterThanOrEqual(5);
    expect(stats.categories).toBeDefined();
  });

  it('TASK 2.2: OpenAPI /docs/json exposes 3.0.3 spec with apiKey and bearerAuth security schemes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.components.securitySchemes.apiKey).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it('TASK 2.3: Error Tracker scrubs sensitive auth headers and exposes /v1/diagnostics/errors', async () => {
    const scrubbed = scrubSensitiveHeaders({
      'x-api-key': 'secret-123',
      Authorization: 'Bearer secret-token',
      'user-agent': 'vitest',
    });
    expect(scrubbed['x-api-key']).toBe('[REDACTED]');
    expect(scrubbed.Authorization).toBe('[REDACTED]');
    expect(scrubbed['user-agent']).toBe('vitest');

    const diagRes = await app.inject({
      method: 'GET',
      url: '/v1/diagnostics/errors',
    });
    expect(diagRes.statusCode).toBe(200);
    expect(typeof diagRes.json().totalCaptured).toBe('number');
  });

  it('TASK 2.4: Observability plugin attaches x-request-id & x-response-time headers and exposes /v1/telemetry quantiles', async () => {
    const healthRes = await app.inject({
      method: 'GET',
      url: '/v1/health/live',
      headers: { 'x-request-id': 'custom-trace-001' },
    });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.headers['x-request-id']).toBe('custom-trace-001');
    expect(healthRes.headers['x-response-time']).toMatch(/ms$/);

    const telRes = await app.inject({
      method: 'GET',
      url: '/v1/telemetry',
    });
    expect(telRes.statusCode).toBe(200);
    const body = telRes.json();
    expect(body.status).toBe('ok');
    expect(typeof body.latency.p50Ms).toBe('number');
    expect(typeof body.latency.p95Ms).toBe('number');
    expect(typeof body.latency.p99Ms).toBe('number');
    expect(body.latency.totalRequests).toBeGreaterThan(0);
  });
});
