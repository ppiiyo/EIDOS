import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildServer,
  mulberry32,
  generateDeterministicSeedCatalog,
  resetSeedCatalogCache,
} from '../../apps/api/src/server';
import { ServerEmbedder } from '../../apps/api/src/services/embedder';
import {
  getAverageSearchLatencyMs,
  getSearchLatencySampleCount,
  recordSearchLatency,
  resetObservabilityMetrics,
} from '../../apps/api/src/plugins/observability';

describe('PHASE 3: Deterministic Seeding (mulberry32) & Real Search Latency Metrics', () => {
  beforeEach(() => {
    resetObservabilityMetrics();
    resetSeedCatalogCache();
  });

  it('mulberry32(42) produces 100% deterministic pseudo-random sequences', () => {
    const rngA = mulberry32(42);
    const rngB = mulberry32(42);
    const rngDifferent = mulberry32(1337);

    const seqA = Array.from({ length: 20 }, () => rngA());
    const seqB = Array.from({ length: 20 }, () => rngB());
    const seqDiff = Array.from({ length: 20 }, () => rngDifferent());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqDiff);
  });

  it('generateDeterministicSeedCatalog produces identical 384-d vectors across multiple runs with seed = 42', async () => {
    const embedder = ServerEmbedder.getInstance();

    const run1 = await generateDeterministicSeedCatalog(embedder, 25, 42);
    const run2 = await generateDeterministicSeedCatalog(embedder, 25, 42);
    const runOtherSeed = await generateDeterministicSeedCatalog(embedder, 25, 99);

    expect(run1.length).toBe(25);
    expect(run2.length).toBe(25);

    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].id).toBe(run2[i].id);
      expect(run1[i].title).toBe(run2[i].title);
      const vec1 = Array.from(run1[i].normalizedVector!);
      const vec2 = Array.from(run2[i].normalizedVector!);
      expect(vec1.length).toBe(384);
      expect(vec1).toEqual(vec2);
    }

    // Different seed must produce different perturbation vectors
    const vecSeed42 = Array.from(run1[10].normalizedVector!);
    const vecSeed99 = Array.from(runOtherSeed[10].normalizedVector!);
    expect(vecSeed42).not.toEqual(vecSeed99);
  });

  it('calculates real avgSearchLatencyMs from recorded samples instead of hardcoded constants', () => {
    expect(getAverageSearchLatencyMs()).toBe(0);
    expect(getSearchLatencySampleCount()).toBe(0);

    recordSearchLatency(8.4, 'hybrid');
    recordSearchLatency(12.6, 'dense');
    recordSearchLatency(15.0, 'sparse');

    expect(getSearchLatencySampleCount()).toBe(3);
    expect(getAverageSearchLatencyMs()).toBe(12);
    expect(getAverageSearchLatencyMs()).not.toBe(14.2);
  });

  it('GET /v1/metrics and GET /v1/catalog/stats reflect real search and recommend latencies', async () => {
    const app = await buildServer();
    try {
      const healthRes = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });
      expect(healthRes.statusCode).toBe(200);
      expect(healthRes.json().itemsIndexed).toBe(0);
      expect(healthRes.json().initializedEmpty).toBe(true);

      await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: {
          id: '1',
          title: 'Quantum Spatial Audio Headphones',
          description: 'Noise-canceling wireless spatial audio headphones',
          category: 'Electronics',
          price: 299,
          tags: ['audio', 'wireless'],
        },
      });

      resetObservabilityMetrics();

      const beforeMetricsRes = await app.inject({
        method: 'GET',
        url: '/v1/metrics',
      });
      expect(beforeMetricsRes.statusCode).toBe(200);
      const beforeBody = beforeMetricsRes.json();
      expect(beforeBody.avgSearchLatencyMs).toBe(0);
      expect(beforeBody.searchSampleCount).toBe(0);

      // Perform a real search request
      const searchRes = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: {
          query: 'Quantum Spatial Audio Headphones',
          limit: 5,
          mode: 'hybrid',
        },
      });
      expect(searchRes.statusCode).toBe(200);
      const searchBody = searchRes.json();
      expect(typeof searchBody.latencyMs).toBe('number');
      expect(searchBody.latencyMs).toBeGreaterThanOrEqual(0);

      // Perform a real recommend request
      const recRes = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: {
          item_id: '1',
          strategy: 'simple',
          limit: 5,
        },
      });
      expect(recRes.statusCode).toBe(200);

      const afterMetricsRes = await app.inject({
        method: 'GET',
        url: '/v1/metrics',
      });
      expect(afterMetricsRes.statusCode).toBe(200);
      const afterBody = afterMetricsRes.json();
      expect(afterBody.searchSampleCount).toBe(2);
      expect(afterBody.totalSearchRequests).toBe(2);
      expect(typeof afterBody.avgSearchLatencyMs).toBe('number');
      expect(afterBody.avgSearchLatencyMs).toBeGreaterThanOrEqual(0);

      const catalogStatsRes = await app.inject({
        method: 'GET',
        url: '/v1/catalog/stats',
      });
      expect(catalogStatsRes.statusCode).toBe(200);
      const statsBody = catalogStatsRes.json();
      expect(statsBody.avgSearchLatencyMs).toBe(afterBody.avgSearchLatencyMs);
    } finally {
      await app.close();
    }
  });
});
