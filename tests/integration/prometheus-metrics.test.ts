import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { Metrics, HistogramMetric } from '@eidos/core';
import { buildServer } from '../../apps/api/src/server';
import { StoreRegistry } from '../../apps/api/src/services/store-registry';

describe('PHASE 3: Prometheus Metrics & Observability Integration Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    StoreRegistry.resetInstance();
    Metrics.reset();
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    StoreRegistry.resetInstance();
  });

  it('1. Records non-zero HTTP request counters, request duration histograms, and search latencies on /metrics', async () => {
    // Verify fresh start has 0 items indexed
    const initialHealthRes = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });
    expect(initialHealthRes.statusCode).toBe(200);
    expect(initialHealthRes.json().itemsIndexed).toBe(0);
    expect(initialHealthRes.json().initializedEmpty).toBe(true);

    // Load demo catalog for recommend test
    await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
    });

    Metrics.reset();

    // Execute real API requests across health, demo search, authenticated search, and recommend
    const healthRes = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });
    expect(healthRes.statusCode).toBe(200);
    expect(healthRes.headers['x-request-id']).toBeDefined();
    expect(healthRes.headers['x-response-time']).toMatch(/ms$/);

    const demoSearchRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/search',
      headers: { 'content-type': 'application/json' },
      payload: { query: 'wireless headphones', limit: 5 },
    });
    expect(demoSearchRes.statusCode).toBe(200);

    const authSearchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'eidos_test_key_1',
      },
      payload: { query: 'spatial audio speaker', limit: 5, mode: 'hybrid' },
    });
    expect(authSearchRes.statusCode).toBe(200);

    const recRes = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'eidos_test_key_1',
      },
      payload: { item_id: 'item_1', strategy: 'simple', limit: 5 },
    });
    expect(recRes.statusCode).toBe(200);

    // Trigger an unauthorized 401 request to verify error counter tracking
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'content-type': 'application/json' },
      payload: { query: 'unauthorized probe', limit: 1 },
    });
    expect(unauthRes.statusCode).toBe(401);

    // Scrape /metrics
    const metricsRes = await app.inject({
      method: 'GET',
      url: '/metrics',
    });
    expect(metricsRes.statusCode).toBe(200);
    expect(metricsRes.headers['content-type']).toContain('text/plain; version=0.0.4');

    const body = metricsRes.body;

    // Verify aggregate counters are strictly > 0 (never stuck at 0)
    expect(body).not.toContain('\neidos_requests_total 0\n');
    expect(body).not.toContain('\neidos_request_duration_seconds_count 0\n');
    expect(body).toMatch(/eidos_requests_total [5-9]\d*/);
    expect(body).toMatch(/eidos_request_duration_seconds_count [5-9]\d*/);
    expect(body).toMatch(/eidos_search_latency_seconds_count [3-9]\d*/);

    // Verify labeled series for specific endpoints and statuses
    expect(body).toContain('eidos_requests_total{endpoint="/v1/health",method="GET",status="200"} 1');
    expect(body).toContain('eidos_requests_total{endpoint="/v1/demo/search",method="POST",status="200"} 1');
    expect(body).toContain('eidos_requests_total{endpoint="/v1/search",method="POST",status="200"} 1');
    expect(body).toContain('eidos_requests_total{endpoint="/v1/search",method="POST",status="401"} 1');
    expect(body).toContain('eidos_errors_total{endpoint="/v1/search",error_type="auth_error",status="401"} 1');
  });

  it('2. Dynamically updates eidos_vector_store_size and eidos_active_indexes_total when tenant indexes change', async () => {
    const beforeMetrics = await app.inject({
      method: 'GET',
      url: '/v1/metrics',
    });
    expect(beforeMetrics.statusCode).toBe(200);
    const beforeJson = beforeMetrics.json();
    const initialVectorSize = beforeJson.vectorStoreSize;
    const initialIndexesCount = beforeJson.activeIndexesTotal;
    expect(initialVectorSize).toBeGreaterThanOrEqual(0);
    expect(initialIndexesCount).toBeGreaterThanOrEqual(1);

    // Create a new index and upsert an item in tenant-observability
    const createIdxRes = await app.inject({
      method: 'POST',
      url: '/v1/indexes',
      headers: {
        'x-api-key': 'eidos_test_key_1',
        'x-tenant-id': 'tenant-observability',
      },
      payload: {
        name: 'metrics-idx',
        dimension: 384,
      },
    });
    expect(createIdxRes.statusCode).toBe(201);

    const upsertRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: {
        'x-api-key': 'eidos_test_key_1',
        'x-tenant-id': 'tenant-observability',
        'x-index-name': 'metrics-idx',
      },
      payload: {
        id: 'obs-item-1',
        title: 'Prometheus Telemetry Probe Sensor',
        description: 'High-precision latency and throughput telemetry sensor.',
        category: 'Electronics',
        price: 199.0,
      },
    });
    expect(upsertRes.statusCode).toBe(200);

    // Scrape /v1/metrics/prometheus and /v1/metrics
    const promRes = await app.inject({
      method: 'GET',
      url: '/v1/metrics/prometheus',
    });
    expect(promRes.statusCode).toBe(200);
    expect(promRes.body).toContain(`eidos_vector_store_size ${initialVectorSize + 1}`);
    expect(promRes.body).toContain(`eidos_active_indexes_total ${initialIndexesCount + 1}`);
    expect(promRes.body).toMatch(/eidos_embeddings_generated_total [1-9]\d*/);
  });

  it('3. Bounded O(1) HistogramMetric processes 10,000 observations in < 100ms without unbounded array allocation', () => {
    const hist = new HistogramMetric(
      'eidos_highload_latency_seconds',
      'High-load O(1) histogram test',
      ['route']
    );

    const start = performance.now();
    for (let i = 0; i < 10_000; i++) {
      hist.observe({ route: '/v1/search' }, (i % 100) * 0.002);
    }
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(100);
    expect(hist.getCount()).toBe(10_000);
    expect(hist.getCount({ route: '/v1/search' })).toBe(10_000);

    const rendered = hist.render();
    expect(rendered).toContain('eidos_highload_latency_seconds_count{route="/v1/search"} 10000');
    expect(rendered).toContain('eidos_highload_latency_seconds_count 10000');
  });
});
