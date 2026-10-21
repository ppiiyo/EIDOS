import { FastifyInstance } from 'fastify';
import * as crypto from 'crypto';
import { Metrics } from '@eidos/core';

const MAX_LATENCY_SAMPLES = 1000;
const latencySamplesMs: number[] = [];
let totalRequestsCount = 0;

function recordLatencySample(ms: number): void {
  if (latencySamplesMs.length >= MAX_LATENCY_SAMPLES) {
    latencySamplesMs.shift();
  }
  latencySamplesMs.push(ms);
  totalRequestsCount++;
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
  fastify.addHook('onRequest', async (request, reply) => {
    const incomingId = request.headers['x-request-id'] as string | undefined;
    const requestId = incomingId || `req_${crypto.randomBytes(6).toString('hex')}`;
    request.headers['x-request-id'] = requestId;
    reply.header('x-request-id', requestId);
    (request as any).__startTimeHr = performance.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const start = (request as any).__startTimeHr as number | undefined;
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
    const start = (request as any).__startTimeHr as number | undefined;
    const elapsedMs =
      typeof start === 'number' ? Math.round((performance.now() - start) * 100) / 100 : 0;
    reply.header('x-response-time', `${elapsedMs}ms`);
    return payload;
  });

  fastify.get('/v1/telemetry', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      latency: getLatencyQuantiles(),
      memory: process.memoryUsage(),
      uptimeSeconds: Math.round(process.uptime() * 100) / 100,
    };
  });
}

(observabilityPlugin as any)[Symbol.for('skip-override')] = true;
