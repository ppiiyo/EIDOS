import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server';
import { IndexManager } from '../../apps/workspace/src/pages/IndexManager';
import { Analytics } from '../../apps/workspace/src/pages/Analytics';
import { Settings } from '../../apps/workspace/src/pages/Settings';

describe('PHASE 2: UI Completion (Index Manager, Analytics Dashboard, Settings UI)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('Task 2.1: Index Manager UI renders indexes, quantization selector, bulk upload form, and /v1/indexes API supports CRUD + bulk ingestion', async () => {
    const html = renderToStaticMarkup(React.createElement(IndexManager, {}));
    expect(html).toContain('data-testid="index-manager-view"');
    expect(html).toContain('HNSW Index Manager');
    expect(html).toContain('data-testid="open-create-index-btn"');
    expect(html).toContain('data-testid="index-card-default"');
    expect(html).toContain('data-testid="bulk-upload-form"');

    // Verify GET /v1/indexes
    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/indexes',
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.total).toBeGreaterThanOrEqual(1);
    expect(listBody.indexes.some((i: any) => i.name === 'default')).toBe(true);

    // Verify POST /v1/indexes (create new index with INT8 quantization)
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/indexes',
      payload: {
        name: 'catalog-v32-int8',
        dimension: 384,
        quantization: 'int8',
        M: 24,
        efConstruction: 160,
        efSearch: 64,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.success).toBe(true);
    expect(created.index.name).toBe('catalog-v32-int8');
    expect(created.index.quantization).toBe('int8');
    expect(created.index.hnswConfig.M).toBe(24);

    // Verify POST /v1/indexes/:name/documents (bulk upload)
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/v1/indexes/catalog-v32-int8/documents',
      payload: {
        documents: [
          {
            id: 'bulk-doc-1',
            title: 'Quantum Neural Processor Card',
            description: 'High-speed PCIe vector accelerator',
            category: 'Hardware',
            price: 899,
          },
          {
            id: 'bulk-doc-2',
            title: 'Low-Latency Optical Switch',
            description: '100GbE cluster interconnect switch',
            category: 'Networking',
            price: 1299,
          },
        ],
      },
    });
    expect(uploadRes.statusCode).toBe(200);
    const uploadBody = uploadRes.json();
    expect(uploadBody.indexedCount).toBe(2);
    expect(uploadBody.index.documentCount).toBe(2);

    // Verify DELETE /v1/indexes/:name
    const delRes = await app.inject({
      method: 'DELETE',
      url: '/v1/indexes/catalog-v32-int8',
    });
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().deleted).toBe('catalog-v32-int8');
  });

  it('Task 2.2: Analytics Dashboard renders p50/p95/p99 latency percentiles, Cache Hit Rate, Top Queries, Zero-Result Queries, and /v1/analytics/metrics returns live telemetry', async () => {
    const html = renderToStaticMarkup(React.createElement(Analytics, {}));
    expect(html).toContain('data-testid="analytics-dashboard"');
    expect(html).toContain('data-testid="latency-percentiles-card"');
    expect(html).toContain('data-testid="latency-p50"');
    expect(html).toContain('data-testid="latency-p95"');
    expect(html).toContain('data-testid="latency-p99"');
    expect(html).toContain('data-testid="cache-hit-rate-card"');
    expect(html).toContain('data-testid="cache-hit-rate-value"');
    expect(html).toContain('data-testid="top-queries-table"');
    expect(html).toContain('data-testid="zero-results-list"');

    const res = await app.inject({
      method: 'GET',
      url: '/v1/analytics/metrics',
    });
    expect(res.statusCode).toBe(200);
    const metrics = res.json();
    expect(metrics.latencyPercentiles.p50).toBeGreaterThan(0);
    expect(metrics.latencyPercentiles.p95).toBeGreaterThanOrEqual(metrics.latencyPercentiles.p50);
    expect(metrics.latencyPercentiles.p99).toBeGreaterThanOrEqual(metrics.latencyPercentiles.p95);
    expect(metrics.cacheHitRate.hitRatePercent).toBeGreaterThan(50);
    expect(Array.isArray(metrics.searchVolumeSeries)).toBe(true);
    expect(metrics.searchVolumeSeries.length).toBe(7);
    expect(Array.isArray(metrics.topQueries)).toBe(true);
    expect(Array.isArray(metrics.zeroResultQueries)).toBe(true);
  });

  it('Task 2.3: Settings UI renders API Keys, HNSW parameters, Rate Limiting, and Webhooks, and /v1/settings API persists updates', async () => {
    const html = renderToStaticMarkup(React.createElement(Settings, {}));
    expect(html).toContain('data-testid="settings-view"');
    expect(html).toContain('data-testid="settings-api-keys-section"');
    expect(html).toContain('data-testid="generate-api-key-btn"');
    expect(html).toContain('data-testid="settings-hnsw-section"');
    expect(html).toContain('data-testid="setting-hnsw-m"');
    expect(html).toContain('data-testid="setting-rpm-limit"');
    expect(html).toContain('data-testid="settings-webhooks-section"');

    // GET /v1/settings
    const getRes = await app.inject({
      method: 'GET',
      url: '/v1/settings',
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().settings.hnsw.M).toBe(16);

    // PUT /v1/settings
    const putRes = await app.inject({
      method: 'PUT',
      url: '/v1/settings',
      payload: {
        hnsw: { M: 32, efConstruction: 200, efSearch: 96, quantization: 'fp16' },
        rateLimit: { maxRequestsPerMinute: 2500, burstLimit: 400, enabled: true },
        security: { piiRedaction: true, xssSanitization: true },
      },
    });
    expect(putRes.statusCode).toBe(200);
    const updated = putRes.json();
    expect(updated.settings.hnsw.M).toBe(32);
    expect(updated.settings.hnsw.quantization).toBe('fp16');
    expect(updated.settings.rateLimit.maxRequestsPerMinute).toBe(2500);

    // POST /v1/settings/webhooks
    const whRes = await app.inject({
      method: 'POST',
      url: '/v1/settings/webhooks',
      payload: {
        url: 'https://ops.eidos.ai/webhooks/cluster-health',
        events: ['drift.detected', 'index.degraded'],
      },
    });
    expect(whRes.statusCode).toBe(201);
    const whBody = whRes.json();
    expect(whBody.webhook.url).toBe('https://ops.eidos.ai/webhooks/cluster-health');
  });
});
