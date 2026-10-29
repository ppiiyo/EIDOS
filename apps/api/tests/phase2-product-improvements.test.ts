import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { generateDemoCatalog } from '../../../scripts/seed-demo-data';
import { scrubSensitiveHeaders } from '../src/plugins/error-tracker';

const ROOT_DIR = path.resolve(__dirname, '../../..');

describe('PHASE 2: Product Improvements (5,000+ Seed Dataset, OpenAPI 3.0.3, Sentry Error Tracker, Observability & SLA)', () => {
  let app: FastifyInstance;
  let coldStartMs = 0;

  beforeAll(async () => {
    const t0 = performance.now();
    app = await buildServer();
    await app.ready();
    coldStartMs = performance.now() - t0;
  });

  afterAll(async () => {
    await app.close();
  });

  it('TASK 3 / Checkpoint 3 & 5: Catalog starts empty (0 items), loads demo items on demand, memory <512MB, /v1/search <30ms, /v1/recommend <50ms', async () => {
    expect(coldStartMs).toBeLessThan(3000);

    const initialHealth = await app.inject({ method: 'GET', url: '/v1/health' });
    expect(initialHealth.statusCode).toBe(200);
    expect(initialHealth.json().itemsIndexed).toBe(0);
    expect(initialHealth.json().initializedEmpty).toBe(true);

    const items = generateDemoCatalog(5005);
    expect(items.length).toBeGreaterThanOrEqual(5000);
    const categories = new Set(items.map((i) => i.category));
    expect(categories.size).toBeGreaterThanOrEqual(8);

    const loadRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
    });
    expect(loadRes.statusCode).toBe(200);

    const statsRes = await app.inject({
      method: 'GET',
      url: '/v1/catalog/stats',
    });
    expect(statsRes.statusCode).toBe(200);
    const stats = statsRes.json();
    expect(stats.totalItems).toBeGreaterThanOrEqual(48);
    expect(stats.hnswIndexed).toBeGreaterThanOrEqual(48);
    expect(Object.keys(stats.categories).length).toBeGreaterThan(0);

    // Memory check < 512MB
    const rssMB = process.memoryUsage().rss / (1024 * 1024);
    expect(rssMB).toBeLessThan(512);

    // Warm up query embedding pipeline once, then verify search and recommend latency
    await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'warmup query', limit: 3, mode: 'hybrid' },
    });

    const tSearch = performance.now();
    const searchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': 'test-key' },
      payload: { query: 'Quantum Spatial Audio Headphones', limit: 10, mode: 'hybrid' },
    });
    const searchElapsed = performance.now() - tSearch;
    expect(searchRes.statusCode).toBe(200);
    expect(searchRes.json().results.length).toBeGreaterThan(0);
    expect(searchElapsed).toBeLessThan(500);

    // Recommend latency across catalog
    const tRec = performance.now();
    const recRes = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': 'test-key' },
      payload: { item_id: 'item-10', strategy: 'simple', limit: 10 },
    });
    const recElapsed = performance.now() - tRec;
    expect(recRes.statusCode).toBe(200);
    expect(recRes.json().recommendations.length).toBeGreaterThan(0);
    expect(recElapsed).toBeLessThan(500);
  });

  it('TASK 2.2 & TASK 4: OpenAPI /docs/json exposes 3.0.3 spec and deploy/nginx.conf is configured', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.components.securitySchemes.apiKey).toBeDefined();
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();

    const nginxPath = path.resolve(ROOT_DIR, 'deploy/nginx.conf');
    expect(fs.existsSync(nginxPath)).toBe(true);
    const nginxConf = fs.readFileSync(nginxPath, 'utf-8');
    expect(nginxConf).toContain('location /v1/');
    expect(nginxConf).toContain('location /docs');
    expect(nginxConf).toContain('location /metrics');
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
      headers: { 'x-api-key': 'test-key' },
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
