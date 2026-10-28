import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { ApiQueryCache } from '../src/services/query-cache';

describe('PHASE 4: Horizontal Scaling, Cluster Failover & Final E2E Verification v3.2', () => {
  let nodeA: FastifyInstance;
  let nodeB: FastifyInstance;
  const apiKey = 'test-key';

  beforeAll(async () => {
    process.env.AIL_ENABLED = 'true';
    ApiQueryCache.invalidateAll();

    process.env.EIDOS_NODE_ID = 'eidos-node-alpha';
    nodeA = await buildServer();
    await nodeA.ready();

    process.env.EIDOS_NODE_ID = 'eidos-node-beta';
    nodeB = await buildServer();
    await nodeB.ready();

    delete process.env.EIDOS_NODE_ID;
  });

  afterAll(async () => {
    await nodeA.close();
    await nodeB.close();
  });

  it('TASK 4.1: Multi-Instance Horizontal Scaling & Cross-Node Cache Invalidation Bus', async () => {
    // 1. Query nodeB first -> MISS, then second time -> HIT
    const queryPayload = { query: 'Quantum Spatial Audio Headphones', limit: 5, mode: 'hybrid' };

    const resB1 = await nodeB.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': apiKey },
      payload: queryPayload,
    });
    expect(resB1.statusCode).toBe(200);
    expect(resB1.headers['x-eidos-node-id']).toBe('eidos-node-beta');
    expect(resB1.headers['x-cache']).toBe('MISS');
    const versionBefore = Number(resB1.headers['x-eidos-catalog-version']);
    expect(versionBefore).toBeGreaterThanOrEqual(1);

    const resB2 = await nodeB.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': apiKey },
      payload: queryPayload,
    });
    expect(resB2.statusCode).toBe(200);
    expect(resB2.headers['x-cache']).toBe('HIT');

    // 2. Upsert a new item on nodeA -> broadcasts cross-node invalidation to nodeB
    const upsertResA = await nodeA.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': apiKey },
      payload: {
        id: 'phase4-cluster-item-1',
        title: 'Quantum Spatial Audio Headphones Pro Max',
        description: 'Distributed cluster synchronized spatial audio headset',
        category: 'Electronics',
        tags: ['quantum', 'spatial', 'audio'],
        price: 349,
      },
    });
    expect(upsertResA.statusCode).toBe(200);
    expect(upsertResA.headers['x-eidos-node-id']).toBe('eidos-node-alpha');

    // 3. Subsequent query on nodeB sees incremented catalog version and fresh cache MISS
    const resB3 = await nodeB.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': apiKey },
      payload: queryPayload,
    });
    expect(resB3.statusCode).toBe(200);
    expect(resB3.headers['x-cache']).toBe('MISS');
    const versionAfter = Number(resB3.headers['x-eidos-catalog-version']);
    expect(versionAfter).toBeGreaterThan(versionBefore);
  });

  it('TASK 4.2: Cluster Topology, Automatic Leader Election & Shard Failover with Zero 5xx Errors', async () => {
    const statusBeforeRes = await nodeA.inject({
      method: 'GET',
      url: '/v1/cluster/status',
    });
    expect(statusBeforeRes.statusCode).toBe(200);
    const statusBefore = statusBeforeRes.json();
    expect(statusBefore.nodeId).toBe('eidos-node-alpha');
    expect(statusBefore.shardCount).toBeGreaterThanOrEqual(3);
    expect(statusBefore.healthyShards).toBe(statusBefore.shardCount);
    expect(statusBefore.leaderState.leaderShardId).toBe('shard-0');
    expect(statusBefore.circuitBreakerState).toBe('CLOSED');

    // Simulate primary leader shard-0 failure
    const failShardRes = await nodeA.inject({
      method: 'POST',
      url: '/v1/cluster/shards/shard-0/health',
      headers: { 'x-api-key': apiKey },
      payload: { healthy: false },
    });
    expect(failShardRes.statusCode).toBe(200);
    const failShardBody = failShardRes.json();
    expect(failShardBody.leaderState.leaderShardId).toBe('shard-1');
    expect(failShardBody.leaderState.term).toBeGreaterThanOrEqual(2);
    expect(failShardBody.leaderState.healthy).toBe(true);
    expect(failShardBody.stats.healthyShards).toBe(statusBefore.shardCount - 1);

    // Verify search & recommend requests continue serving with zero 5xx errors during shard outage
    const searchDuringOutage = await nodeA.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': apiKey },
      payload: { query: 'wireless headphones', limit: 5 },
    });
    expect(searchDuringOutage.statusCode).toBe(200);
    expect(searchDuringOutage.json().results.length).toBeGreaterThan(0);

    // Recover shard-0
    const recoverShardRes = await nodeA.inject({
      method: 'POST',
      url: '/v1/cluster/shards/shard-0/health',
      headers: { 'x-api-key': apiKey },
      payload: { healthy: true },
    });
    expect(recoverShardRes.statusCode).toBe(200);
    expect(recoverShardRes.json().stats.healthyShards).toBe(statusBefore.shardCount);
  });

  it('TASK 4.3: Graceful Drain Mode Readiness & Liveness Probes (/ready & /live)', async () => {
    // 1. Before drain: /ready and /v1/health/ready return 200 OK
    const readyBefore = await nodeB.inject({
      method: 'GET',
      url: '/ready',
    });
    expect(readyBefore.statusCode).toBe(200);
    expect(readyBefore.json().ready).toBe(true);
    expect(readyBefore.json().draining).toBe(false);

    // 2. Enable graceful drain mode on nodeB
    const drainOn = await nodeB.inject({
      method: 'POST',
      url: '/v1/cluster/drain',
      headers: { 'x-api-key': apiKey },
      payload: { draining: true },
    });
    expect(drainOn.statusCode).toBe(200);
    expect(drainOn.json().draining).toBe(true);

    // 3. During drain: /ready and /v1/health/ready return 503 Service Unavailable
    const readyDuringDrain = await nodeB.inject({
      method: 'GET',
      url: '/v1/health/ready',
    });
    expect(readyDuringDrain.statusCode).toBe(503);
    expect(readyDuringDrain.json().status).toBe('draining');
    expect(readyDuringDrain.json().draining).toBe(true);

    // 4. Liveness probe (/live & /v1/health/live) remains 200 OK so Kubernetes does not kill in-flight requests
    const liveDuringDrain = await nodeB.inject({
      method: 'GET',
      url: '/live',
    });
    expect(liveDuringDrain.statusCode).toBe(200);
    expect(liveDuringDrain.json().alive).toBe(true);
    expect(liveDuringDrain.json().draining).toBe(true);

    // 5. Exit drain mode -> /ready returns 200 OK again
    await nodeB.inject({
      method: 'POST',
      url: '/v1/cluster/drain',
      headers: { 'x-api-key': apiKey },
      payload: { draining: false },
    });
    const readyAfter = await nodeB.inject({
      method: 'GET',
      url: '/ready',
    });
    expect(readyAfter.statusCode).toBe(200);
    expect(readyAfter.json().ready).toBe(true);
  });

  it('TASK 4.4: Final E2E v3.2 Pipeline Verification (Upsert -> Hybrid Search -> Unified Recommend -> Online Feedback -> Prometheus)', async () => {
    // Step 1: Upsert custom items into catalog
    const batchUpsertRes = await nodeA.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': apiKey },
      payload: {
        items: [
          {
            id: 'e2e-v32-item-1',
            title: 'Neural Acoustic Studio Monitor',
            description: 'Reference grade bi-amplified studio monitor with DSP room correction',
            category: 'Audio',
            tags: ['studio', 'monitor', 'dsp', 'acoustic'],
            price: 799,
          },
          {
            id: 'e2e-v32-item-2',
            title: 'Sub-Bass Planar Magnetic Headphones',
            description: 'Open-back planar magnetic mastering headphones for audio engineers',
            category: 'Audio',
            tags: ['planar', 'mastering', 'studio', 'headphones'],
            price: 649,
          },
        ],
      },
    });
    expect(batchUpsertRes.statusCode).toBe(200);
    expect(batchUpsertRes.json().upserted).toBe(2);

    // Step 2: Hybrid Search with X-Ray explanation
    const searchRes = await nodeA.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': apiKey },
      payload: {
        query: 'Neural Acoustic Studio Monitor DSP',
        mode: 'hybrid',
        limit: 5,
      },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = searchRes.json();
    expect(searchBody.results.length).toBeGreaterThan(0);
    expect(searchBody.results[0].explanation).toBeDefined();
    expect(typeof searchBody.results[0].explanation.rrfScore).toBe('number');

    // Step 3: Unified /v1/recommend across simple, adaptive, and user strategies
    const recSimple = await nodeA.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': apiKey },
      payload: {
        item_id: 'e2e-v32-item-1',
        strategy: 'simple',
        limit: 5,
      },
    });
    expect(recSimple.statusCode).toBe(200);
    expect(recSimple.json().strategy).toBe('simple');
    expect(recSimple.json().recommendations.length).toBeGreaterThan(0);

    const recAdaptive = await nodeA.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': apiKey },
      payload: {
        item_id: 'e2e-v32-item-1',
        user_id: 'e2e-user-42',
        history: ['e2e-v32-item-1', 'e2e-v32-item-2'],
        strategy: 'adaptive',
        limit: 5,
        context: { device: 'desktop', hourOfDay: 14 },
      },
    });
    expect(recAdaptive.statusCode).toBe(200);
    expect(recAdaptive.json().strategy).toBe('adaptive');
    expect(recAdaptive.json().recommendations.length).toBeGreaterThan(0);

    const recUser = await nodeA.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': apiKey },
      payload: {
        user_id: 'e2e-user-42',
        history: ['e2e-v32-item-1', 'e2e-v32-item-2'],
        strategy: 'user',
        limit: 5,
      },
    });
    expect(recUser.statusCode).toBe(200);
    expect(recUser.json().strategy).toBe('user');
    expect(recUser.json().recommendations.length).toBeGreaterThan(0);

    // Step 4: Online Feedback Loop (click + purchase)
    const feedbackRes = await nodeA.inject({
      method: 'POST',
      url: '/v1/feedback',
      headers: { 'x-api-key': apiKey },
      payload: {
        userId: 'e2e-user-42',
        itemId: 'e2e-v32-item-2',
        eventType: 'purchase',
        context: { device: 'desktop', sessionId: 'sess-e2e-99' },
      },
    });
    expect(feedbackRes.statusCode).toBe(200);
    expect(feedbackRes.json().accepted).toBe(true);
    expect(feedbackRes.json().stats.purchases).toBeGreaterThan(0);

    // Step 5: Prometheus /metrics & /v1/telemetry verification
    const metricsRes = await nodeA.inject({
      method: 'GET',
      url: '/metrics',
    });
    expect(metricsRes.statusCode).toBe(200);
    expect(metricsRes.body).toContain('eidos_requests_total');
    expect(metricsRes.body).toContain('eidos_vector_store_size');

    const telemetryRes = await nodeA.inject({
      method: 'GET',
      url: '/v1/telemetry',
    });
    expect(telemetryRes.statusCode).toBe(200);
    expect(telemetryRes.json().status).toBe('ok');
    expect(telemetryRes.json().latency.totalRequests).toBeGreaterThan(0);
  });
});
