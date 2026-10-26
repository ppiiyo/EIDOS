/// <reference path="../../apps/api/src/types/fastify.d.ts" />
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { buildServer } from '../../apps/api/src/server';
import { authenticate } from '../../apps/api/src/middleware/auth';

describe('PHASE 1 Modernization: Fastify Declaration Merging & CSP Hardening', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('augments FastifyRequest with demoMode, demoRateLimit, and tenantId without (request as any)', async () => {
    let capturedRequest: {
      demoMode?: boolean;
      demoRateLimit?: number;
      tenantId?: string;
    } = {};

    const testApp = await buildServer();
    testApp.get(
      '/v1/catalog/test-phase1-types',
      { preHandler: authenticate },
      async (request: FastifyRequest) => {
        capturedRequest = {
          demoMode: request.demoMode,
          demoRateLimit: request.demoRateLimit,
          tenantId: request.tenantId,
        };
        return {
          demoMode: request.demoMode ?? false,
          demoRateLimit: request.demoRateLimit ?? null,
          tenantId: request.tenantId ?? 'default',
        };
      }
    );
    await testApp.ready();

    const demoRes = await testApp.inject({
      method: 'GET',
      url: '/v1/catalog/test-phase1-types',
      headers: {
        'x-api-key': 'eidos_demo_key',
        'x-tenant-id': 'acme-corp',
      },
    });

    expect(demoRes.statusCode).toBe(200);
    expect(capturedRequest.demoMode).toBe(true);
    expect(capturedRequest.demoRateLimit).toBe(10);
    expect(capturedRequest.tenantId).toBe('acme-corp');

    await testApp.close();
  });

  it('enforces strict CSP script-src without unsafe-inline while keeping style-src compatible with Studio UI', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });

    expect(res.statusCode).toBe(200);
    const csp = String(res.headers['content-security-policy'] || '');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");

    const scriptSrcDirective = csp
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('script-src'));
    expect(scriptSrcDirective).toBe("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });
});
