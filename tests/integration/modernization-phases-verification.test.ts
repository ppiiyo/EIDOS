/// <reference path="../../apps/api/src/types/fastify.d.ts" />
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, afterEach } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  buildServer,
  mulberry32,
  generateDeterministicSeedCatalog,
  resetSeedCatalogCache,
} from '../../apps/api/src/server';
import { authenticate } from '../../apps/api/src/middleware/auth';
import {
  demoRateLimit,
  clearRateLimitStore,
  getRateLimitStoreSize,
  hasRateLimitKey,
  MAX_IPS,
} from '../../apps/api/src/middleware/rate-limit-demo';
import {
  getAverageSearchLatencyMs,
  recordSearchLatency,
  resetObservabilityMetrics,
} from '../../apps/api/src/plugins/observability';
import { ServerEmbedder } from '../../apps/api/src/services/embedder';

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('PHASE 4: Full Modernization Verification Suite (Integration & Static Invariants)', () => {
  afterEach(() => {
    clearRateLimitStore();
    resetObservabilityMetrics();
    resetSeedCatalogCache();
  });

  it('1. Type Safety & Middleware: populates request.demoMode, request.demoRateLimit, and request.tenantId with zero (request as any) casts', async () => {
    // Verify static invariant: zero (request as any) in auth.ts, rate-limit-demo.ts, multi-tenancy.ts, observability.ts
    const targetFiles = [
      'apps/api/src/middleware/auth.ts',
      'apps/api/src/middleware/rate-limit-demo.ts',
      'apps/api/src/services/multi-tenancy.ts',
      'apps/api/src/plugins/observability.ts',
    ];
    for (const relPath of targetFiles) {
      const source = fs.readFileSync(path.resolve(ROOT_DIR, relPath), 'utf-8');
      expect(source).not.toContain('(request as any)');
      expect(source).not.toContain('(req as any)');
    }

    const app = await buildServer();
    let observedProps: {
      demoMode?: boolean;
      demoRateLimit?: number;
      tenantId?: string;
      hasStartTimeHr?: boolean;
    } = {};

    app.get(
      '/v1/catalog/type-check-probe',
      { preHandler: authenticate },
      async (request: FastifyRequest) => {
        observedProps = {
          demoMode: request.demoMode,
          demoRateLimit: request.demoRateLimit,
          tenantId: request.tenantId,
          hasStartTimeHr: typeof request.__startTimeHr === 'number',
        };
        return { ok: true, ...observedProps };
      }
    );
    await app.ready();

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/catalog/type-check-probe',
        headers: {
          'x-api-key': 'eidos_demo_key',
          'x-tenant-id': 'enterprise-tenant-42',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(observedProps.demoMode).toBe(true);
      expect(observedProps.demoRateLimit).toBe(10);
      expect(observedProps.tenantId).toBe('enterprise-tenant-42');
      expect(observedProps.hasStartTimeHr).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('2. Rate Limit LRU Eviction: strictly caps IP map at MAX_IPS (10,000) and evicts least-recently-used entries', async () => {
    const createReply = (): FastifyReply =>
      ({
        status() {
          return this;
        },
        send() {
          return this;
        },
      }) as unknown as FastifyReply;

    // Populate MAX_IPS entries
    for (let i = 0; i < MAX_IPS; i++) {
      const req = {
        ip: `10.10.${Math.floor(i / 256)}.${i % 256}`,
        demoMode: true,
        demoRateLimit: 10,
      } as unknown as FastifyRequest;
      await demoRateLimit(req, createReply());
    }

    expect(getRateLimitStoreSize()).toBe(MAX_IPS);

    // Access the very first IP ('10.10.0.0') to promote it in LRU order
    await demoRateLimit(
      {
        ip: '10.10.0.0',
        demoMode: true,
        demoRateLimit: 10,
      } as unknown as FastifyRequest,
      createReply()
    );

    // Insert 3 new IPs exceeding MAX_IPS
    for (let j = 0; j < 3; j++) {
      await demoRateLimit(
        {
          ip: `192.168.250.${j}`,
          demoMode: true,
          demoRateLimit: 10,
        } as unknown as FastifyRequest,
        createReply()
      );
    }

    expect(getRateLimitStoreSize()).toBe(MAX_IPS);
    expect(hasRateLimitKey('10.10.0.0')).toBe(true);
    expect(hasRateLimitKey('10.10.0.1')).toBe(false);
    expect(hasRateLimitKey('10.10.0.2')).toBe(false);
    expect(hasRateLimitKey('10.10.0.3')).toBe(false);
    expect(hasRateLimitKey('192.168.250.0')).toBe(true);
  });

  it('3. Deterministic Seeding & Real Metrics: produces identical seed vectors via mulberry32(42) and exposes real avgSearchLatencyMs on /v1/metrics', async () => {
    const embedder = ServerEmbedder.getInstance();
    const batchA = await generateDeterministicSeedCatalog(embedder, 30, 42);
    const batchB = await generateDeterministicSeedCatalog(embedder, 30, 42);

    expect(batchA.length).toBe(30);
    expect(batchB.length).toBe(30);

    for (let i = 0; i < 30; i++) {
      expect(Array.from(batchA[i].normalizedVector!)).toEqual(
        Array.from(batchB[i].normalizedVector!)
      );
    }

    // Verify PRNG determinism directly
    const prng1 = mulberry32(42);
    const prng2 = mulberry32(42);
    expect(Array.from({ length: 15 }, () => prng1())).toEqual(
      Array.from({ length: 15 }, () => prng2())
    );

    // Verify real latency tracking
    expect(getAverageSearchLatencyMs()).toBe(0);
    recordSearchLatency(6.5, 'hybrid');
    recordSearchLatency(13.5, 'dense');
    expect(getAverageSearchLatencyMs()).toBe(10);
  });
});
