import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server';
import { signJwtToken } from '../src/middleware/auth';

describe('PHASE 1: Critical API Fixes & Security Hardening', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.AIL_ENABLED = 'true';
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('TASK 1.1: API Routing vs SPA Fallback', () => {
    it('returns 404 JSON for unknown /v1/* API endpoints (not SPA HTML)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/nonexistent-endpoint',
      });

      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/json');
      const body = res.json();
      expect(body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'API endpoint /v1/nonexistent-endpoint not found',
      });
    });

    it('returns SPA index.html fallback for non-API frontend routes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/studio/analytics',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain('<div id="root"></div>');
    });
  });

  describe('TASK 1.2: Security Stack (CORS, Helmet CSP, Rate Limiting)', () => {
    it('attaches 7+ Helmet CSP hardening headers and 3 CORS headers to API responses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      // 7+ Security headers
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-xss-protection']).toBeDefined();
      expect(res.headers['strict-transport-security']).toContain('max-age=');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');

      // 3 CORS headers
      expect(res.headers['access-control-allow-origin']).toBeDefined();
      expect(res.headers['access-control-allow-methods']).toContain('POST');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('enforces CORS origin whitelist', async () => {
      const allowedRes = await app.inject({
        method: 'OPTIONS',
        url: '/v1/search',
        headers: {
          origin: 'https://eidos-semantic-ideation-platform.ai.studio',
          'access-control-request-method': 'POST',
        },
      });

      expect(allowedRes.headers['access-control-allow-origin']).toBe(
        'https://eidos-semantic-ideation-platform.ai.studio'
      );
    });

    it('enforces rate limiting with 429 Too Many Requests when threshold is exceeded', async () => {
      const prevMax = process.env.RATE_LIMIT_MAX;
      process.env.RATE_LIMIT_MAX = '3';

      const rateLimitedApp = await buildServer();
      await rateLimitedApp.ready();

      const clientKey = 'rate-limit-test-client';
      const responses = [];
      for (let i = 0; i < 4; i++) {
        responses.push(
          await rateLimitedApp.inject({
            method: 'GET',
            url: '/v1/health/live',
            headers: { 'x-api-key': clientKey },
          })
        );
      }

      expect(responses[0].statusCode).toBe(200);
      expect(responses[1].statusCode).toBe(200);
      expect(responses[2].statusCode).toBe(200);
      expect(responses[3].statusCode).toBe(429);

      await rateLimitedApp.close();
      if (prevMax === undefined) {
        delete process.env.RATE_LIMIT_MAX;
      } else {
        process.env.RATE_LIMIT_MAX = prevMax;
      }
    });
  });

  describe('TASK 1.3: Production Auth & JWT Expiration Validation', () => {
    it('rejects missing key on /v1/health in production (401) and rejects hardcoded dev keys (eidos_dev_key, test-key)', async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevKey = process.env.EIDOS_API_KEY;
      process.env.NODE_ENV = 'production';
      process.env.EIDOS_API_KEY = 'prod_secret_key_999';

      const warnSpy = vi.spyOn(app.log, 'warn');

      const healthNoKeyRes = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });
      expect(healthNoKeyRes.statusCode).toBe(401);

      const healthWithKeyRes = await app.inject({
        method: 'GET',
        url: '/v1/health',
        headers: { 'x-api-key': 'prod_secret_key_999' },
      });
      expect(healthWithKeyRes.statusCode).toBe(200);

      const devKeyRes = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { item_id: '1', strategy: 'simple' },
      });
      expect(devKeyRes.statusCode).toBe(401);

      const testKeyRes = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { 'x-api-key': 'test-key' },
        payload: { item_id: '1', strategy: 'simple' },
      });
      expect(testKeyRes.statusCode).toBe(401);

      const prodKeyRes = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { 'x-api-key': 'prod_secret_key_999' },
        payload: { item_id: '1', strategy: 'simple' },
      });
      expect(prodKeyRes.statusCode).toBe(200);

      warnSpy.mockRestore();
      process.env.NODE_ENV = prevEnv;
      if (prevKey === undefined) {
        delete process.env.EIDOS_API_KEY;
      } else {
        process.env.EIDOS_API_KEY = prevKey;
      }
    });

    it('validates JWT expiration (rejects expired JWT and accepts valid JWT)', async () => {
      const secret = 'eidos_jwt_secret';
      const expiredJwt = signJwtToken(
        { sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 60 },
        secret
      );
      const validJwt = signJwtToken(
        { sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 },
        secret
      );

      const expiredRes = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { authorization: `Bearer ${expiredJwt}` },
        payload: { item_id: '1', strategy: 'simple' },
      });
      expect(expiredRes.statusCode).toBe(401);
      expect(expiredRes.json().message).toContain('expired');

      const validRes = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { authorization: `Bearer ${validJwt}` },
        payload: { item_id: '1', strategy: 'simple' },
      });
      expect(validRes.statusCode).toBe(200);
    });
  });

  describe('TASK 1.4: Unified /v1/recommend Endpoint with strategy parameter', () => {
    it('executes strategy="simple" with price and category filters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          item_id: '1',
          strategy: 'simple',
          limit: 5,
          diversity_factor: 0.7,
          minSimilarity: 0.0,
          filters: {
            max_price: 50,
            exclude_ids: ['3'],
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.strategy).toBe('simple');
      expect(body.item_id).toBe('1');
      expect(body.recommendations).toBeInstanceOf(Array);
      for (const rec of body.recommendations) {
        expect(rec.id).not.toBe('3');
        if (typeof rec.price === 'number') {
          expect(rec.price).toBeLessThanOrEqual(50);
        }
      }
    });

    it('executes strategy="adaptive" (default) with multi-feature ranking and KG enrichment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          item_id: '1',
          user_id: 'u-unified-1',
          history: ['2'],
          strategy: 'adaptive',
          limit: 5,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.strategy).toBe('adaptive');
      expect(body.item_id).toBe('1');
      expect(body.recommendations).toBeInstanceOf(Array);
      expect(body.debug).toBeDefined();
      expect(body.debug.sources).toContain('similarity');
    });

    it('executes strategy="user" for personalized user profile recommendations', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { 'x-api-key': 'test-key' },
        payload: {
          user_id: 'u-unified-2',
          history: ['1', '2'],
          strategy: 'user',
          limit: 5,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.strategy).toBe('user');
      expect(body.user_id).toBe('u-unified-2');
      expect(body.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('TASK 1.5: Full Diagnostic Health Check & Kubernetes Probes', () => {
    it('returns full component diagnostics on GET /v1/health', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('healthy');
      expect(typeof body.responseTimeMs).toBe('number');
      expect(body.checks.vectorStore.status).toBe('ok');
      expect(body.checks.database.status).toBe('ok');
      expect(body.checks.embeddingModel.status).toBe('ok');
      expect(body.checks.memory.status).toBe('ok');
      expect(body.checks.uptime.status).toBe('ok');
    });

    it('returns readiness status on GET /v1/health/ready and liveness on GET /v1/health/live', async () => {
      const readyRes = await app.inject({
        method: 'GET',
        url: '/v1/health/ready',
      });
      expect(readyRes.statusCode).toBe(200);
      expect(readyRes.json().status).toBe('ready');

      const liveRes = await app.inject({
        method: 'GET',
        url: '/v1/health/live',
      });
      expect(liveRes.statusCode).toBe(200);
      expect(liveRes.json().status).toBe('ok');
    });
  });
});
