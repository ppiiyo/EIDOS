/// <reference path="../types/fastify.d.ts" />
import { FastifyInstance } from 'fastify';
import * as crypto from 'crypto';
import { Metrics } from '@eidos/core';
import { cacheMetrics } from '../services/cache/cache-metrics';

const MAX_LATENCY_SAMPLES = 1000;
const latencySamplesMs: number[] = [];
const searchLatencySamplesMs: number[] = [];
let totalRequestsCount = 0;
let totalSearchRequestsCount = 0;

function recordLatencySample(ms: number): void {
  if (latencySamplesMs.length >= MAX_LATENCY_SAMPLES) {
    latencySamplesMs.shift();
  }
  latencySamplesMs.push(ms);
  totalRequestsCount++;
}

export function recordSearchLatency(ms: number, searchType = 'hybrid'): void {
  const safeMs = Number.isFinite(ms) && ms >= 0 ? ms : 0;
  if (searchLatencySamplesMs.length >= MAX_LATENCY_SAMPLES) {
    searchLatencySamplesMs.shift();
  }
  searchLatencySamplesMs.push(safeMs);
  totalSearchRequestsCount++;
  Metrics.searchLatency.observe({ search_type: searchType }, safeMs / 1000);
}

export function getAverageSearchLatencyMs(): number {
  if (searchLatencySamplesMs.length === 0) {
    return 0;
  }
  const sum = searchLatencySamplesMs.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / searchLatencySamplesMs.length) * 100) / 100;
}

export function getSearchLatencySampleCount(): number {
  return searchLatencySamplesMs.length;
}

export function resetObservabilityMetrics(): void {
  latencySamplesMs.length = 0;
  searchLatencySamplesMs.length = 0;
  totalRequestsCount = 0;
  totalSearchRequestsCount = 0;
}

function computePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
  );
  return Math.round(sorted[idx] * 100) / 100;
}

export function getLatencyQuantiles() {
  const sorted = [...latencySamplesMs].sort((a, b) => a - b);
  return {
    totalRequests: totalRequestsCount,
    sampleCount: sorted.length,
    p50Ms: computePercentile(sorted, 50),
    p95Ms: computePercentile(sorted, 95),
    p99Ms: computePercentile(sorted, 99),
  };
}

export async function observabilityPlugin(fastify: FastifyInstance): Promise<void> {
  // Periodically update hit rate gauge
  const hitRateTimer = setInterval(async () => {
    try {
      const hits = await cacheMetrics.hits.get();
      const misses = await cacheMetrics.misses.get();

      const totalHits = hits.values.reduce((sum, v) => sum + v.value, 0);
      const totalMisses = misses.values.reduce((sum, v) => sum + v.value, 0);
      const total = totalHits + totalMisses;

      if (total > 0) {
        const hitRate = totalHits / total;
        cacheMetrics.hitRate.set({ endpoint: 'all' }, hitRate);
      }
    } catch {
      // Ignore timer metric errors
    }
  }, 60_000);

  if (hitRateTimer.unref) {
    hitRateTimer.unref();
  }

  fastify.addHook('onClose', async () => {
    clearInterval(hitRateTimer);
  });

  fastify.addHook('onRequest', async (request, reply) => {
    const incomingId = request.headers['x-request-id'] as string | undefined;
    const requestId = incomingId || `req_${crypto.randomBytes(6).toString('hex')}`;
    request.headers['x-request-id'] = requestId;
    reply.header('x-request-id', requestId);
    request.__startTimeHr = performance.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const start = request.__startTimeHr;
    const elapsedMs = typeof start === 'number' ? Math.max(0, performance.now() - start) : 0;
    recordLatencySample(elapsedMs);

    const routePath = request.routeOptions?.url || request.url.split('?')[0];
    Metrics.requestsTotal.inc({
      endpoint: routePath,
      status: reply.statusCode,
    });
    Metrics.requestDuration.observe(
      { endpoint: routePath },
      elapsedMs / 1000
    );
  });

  fastify.addHook('onSend', async (request, reply, payload) => {
    const start = request.__startTimeHr;
    const elapsedMs =
      typeof start === 'number' ? Math.round((performance.now() - start) * 100) / 100 : 0;
    reply.header('x-response-time', `${elapsedMs}ms`);
    return payload;
  });

  fastify.get('/v1/telemetry', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      avgSearchLatencyMs: getAverageSearchLatencyMs(),
      latency: getLatencyQuantiles(),
      memory: process.memoryUsage(),
      uptimeSeconds: Math.round(process.uptime() * 100) / 100,
    };
  });

  fastify.get('/v1/metrics', async () => {
    const searchSorted = [...searchLatencySamplesMs].sort((a, b) => a - b);
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      avgSearchLatencyMs: getAverageSearchLatencyMs(),
      searchSampleCount: searchLatencySamplesMs.length,
      totalSearchRequests: totalSearchRequestsCount,
      searchLatency: {
        p50Ms: computePercentile(searchSorted, 50),
        p95Ms: computePercentile(searchSorted, 95),
        p99Ms: computePercentile(searchSorted, 99),
      },
      latency: getLatencyQuantiles(),
      vectorStoreSize: Metrics.vectorStoreSize.get(),
      cacheHitRate: Metrics.cacheHitRate.get(),
      uptimeSeconds: Math.round(process.uptime() * 100) / 100,
    };
  });
}

(observabilityPlugin as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;


