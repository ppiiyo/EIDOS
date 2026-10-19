import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/server';
import { ServerEmbedder } from '../src/services/embedder';

describe('Production Hardening API Integration Tests', () => {
  it('TASK 0.1: ServerEmbedder batch embedding & dimension validation', async () => {
    const embedder = ServerEmbedder.getInstance();
    expect(embedder.getEmbeddingDimension()).toBe(384);

    const empty = await embedder.embedBatch([]);
    expect(empty).toEqual([]);

    const single = await embedder.embedBatch(['']);
    expect(single.length).toBe(1);
    expect(single[0].length).toBe(384);
    expect(single[0].every((v) => v === 0)).toBe(true);
  });

  it('TASK 2.1: OpenAPI /docs Swagger specification endpoints', async () => {
    const app = await buildApp();

    // Swagger UI docs endpoint
    const docsRes = await app.inject({
      method: 'GET',
      url: '/docs/static/index.html',
    });
    expect([200, 302, 301]).toContain(docsRes.statusCode);

    // OpenAPI json spec
    const jsonRes = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });
    expect(jsonRes.statusCode).toBe(200);
    const spec = JSON.parse(jsonRes.body);
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toContain('Eidos API');

    // Prometheus /metrics endpoint
    const metricsRes = await app.inject({
      method: 'GET',
      url: '/metrics',
    });
    expect(metricsRes.statusCode).toBe(200);
    expect(metricsRes.headers['content-type']).toContain('text/plain');
    expect(metricsRes.body).toContain('eidos_requests_total');
    expect(metricsRes.body).toContain('eidos_vector_store_size');

    await app.close();
  });
});
