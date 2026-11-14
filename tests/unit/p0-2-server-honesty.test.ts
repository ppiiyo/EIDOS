import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createUnifiedServerLifecycle } from '../../server';
import { buildServer } from '../../apps/api/src/server';
import { StorefrontBenchmarkModal } from '../../apps/workspace/src/pages/DemoPage/components/StorefrontBenchmarkModal';
import { INITIAL_CATALOG } from '../../apps/workspace/src/utils/recommenderEngine';

function createMockHttpPair(method: string, url: string, headers: Record<string, string> = {}) {
  const reqStream = new Readable({
    read() {
      this.push(null);
    },
  });
  const req = Object.assign(reqStream, {
    method,
    url,
    headers: { host: 'localhost:3000', ...headers },
    socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as IncomingMessage;

  let statusCode = 200;
  let headersSent = false;
  let ended = false;
  const responseHeaders: Record<string, string | number | string[]> = {};
  const chunks: Buffer[] = [];
  let resolveEnd!: () => void;
  const endPromise = new Promise<void>((resolve) => {
    resolveEnd = resolve;
  });

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(val: number) {
      statusCode = val;
    },
    get headersSent() {
      return headersSent;
    },
    get writableEnded() {
      return ended;
    },
    setHeader(name: string, value: string | number | string[]) {
      responseHeaders[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name: string) {
      return responseHeaders[name.toLowerCase()];
    },
    writeHead(code: number, hdrs?: Record<string, string | number | string[]>) {
      statusCode = code;
      headersSent = true;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          responseHeaders[k.toLowerCase()] = v;
        }
      }
      return res;
    },
    write(chunk: unknown) {
      if (chunk !== undefined && chunk !== null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return true;
    },
    end(chunk?: unknown) {
      if (chunk !== undefined && chunk !== null) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      headersSent = true;
      ended = true;
      resolveEnd();
      return res;
    },
  } as unknown as ServerResponse;

  return {
    req,
    res,
    endPromise,
    getStatusCode: () => statusCode,
    getHeaders: () => responseHeaders,
    getBodyText: () => Buffer.concat(chunks).toString('utf8'),
    isEnded: () => ended,
  };
}

describe('P0-2: Server Startup Honesty, Real Health Delegation & Demo Singleflight', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns HTTP 503 API_INIT_FAILED immediately (never hangs) on /v1/* and /health when buildServer() fails', async () => {
    const lifecycle = createUnifiedServerLifecycle({
      viteMiddlewaresOverride: (_req, _res, next) => next(),
      buildServerOverride: async () => {
        throw new Error('Fatal index storage corruption during startup');
      },
    });

    await lifecycle.init();
    expect(lifecycle.getApiInitError()?.message).toContain('Fatal index storage corruption');

    const healthCall = createMockHttpPair('GET', '/health');
    await lifecycle.requestHandler(healthCall.req, healthCall.res);
    expect(healthCall.isEnded()).toBe(true);
    expect(healthCall.getStatusCode()).toBe(503);
    const healthJson = JSON.parse(healthCall.getBodyText());
    expect(healthJson).toMatchObject({
      ok: false,
      status: 'error',
      code: 'API_INIT_FAILED',
      error: 'Service Unavailable',
    });

    const searchCall = createMockHttpPair('POST', '/v1/search');
    await lifecycle.requestHandler(searchCall.req, searchCall.res);
    expect(searchCall.isEnded()).toBe(true);
    expect(searchCall.getStatusCode()).toBe(503);
    const searchJson = JSON.parse(searchCall.getBodyText());
    expect(searchJson.code).toBe('API_INIT_FAILED');
  });

  it('delegates /health to real Fastify healthRoutes (no fake fast-path before Fastify is ready)', async () => {
    let resolveFastify!: () => void;
    const gatePromise = new Promise<void>((resolve) => {
      resolveFastify = resolve;
    });

    const lifecycle = createUnifiedServerLifecycle({
      viteMiddlewaresOverride: (_req, _res, next) => next(),
      buildServerOverride: (async () => {
        await gatePromise;
        return {
          ready: async () => {},
          close: async () => {},
          routing: (_req: IncomingMessage, res: ServerResponse) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                ok: true,
                status: 'healthy',
                source: 'real-fastify-health-route',
                itemsIndexed: 42,
              }),
            );
          },
        };
      }) as unknown as NonNullable<Parameters<typeof createUnifiedServerLifecycle>[0]>['buildServerOverride'],
    });

    const initPromise = lifecycle.init();

    // While Fastify is still booting, /live responds immediately with starting status
    const liveCall = createMockHttpPair('GET', '/live');
    await lifecycle.requestHandler(liveCall.req, liveCall.res);
    expect(liveCall.getStatusCode()).toBe(200);
    expect(JSON.parse(liveCall.getBodyText())).toMatchObject({
      status: 'starting',
      alive: true,
      draining: false,
    });

    // Meanwhile /health must wait for Fastify rather than returning a fake fast-path response
    const healthCall = createMockHttpPair('GET', '/health');
    const pendingHealth = lifecycle.requestHandler(healthCall.req, healthCall.res);
    expect(healthCall.isEnded()).toBe(false);

    resolveFastify();
    await initPromise;
    await pendingHealth;
    await healthCall.endPromise;

    expect(healthCall.getStatusCode()).toBe(200);
    const payload = JSON.parse(healthCall.getBodyText());
    expect(payload).toMatchObject({
      ok: true,
      status: 'healthy',
      source: 'real-fastify-health-route',
      itemsIndexed: 42,
    });
  });

  it('supports GET /v1/demo/status, idempotent POST /v1/demo/load, and singleflight concurrency deduplication', async () => {
    const app = await buildServer();

    try {
      await app.ready();

      // 1. Reset first to guarantee clean 'idle' state
      const resetRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/reset',
      });
      expect(resetRes.statusCode).toBe(200);

      const statusIdle = await app.inject({
        method: 'GET',
        url: '/v1/demo/status',
      });
      expect(statusIdle.statusCode).toBe(200);
      expect(statusIdle.json()).toMatchObject({
        ok: true,
        status: 'idle',
        tenantId: 'demo',
        indexName: 'demo',
        itemsIndexed: 0,
      });

      // 2. Concurrent POST /v1/demo/load requests should coalesce via singleflight
      const [loadRes1, loadRes2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/v1/demo/load',
          payload: { scale: '48' },
        }),
        app.inject({
          method: 'POST',
          url: '/v1/demo/load',
          payload: { scale: '48' },
        }),
      ]);

      expect(loadRes1.statusCode).toBe(200);
      expect(loadRes2.statusCode).toBe(200);
      const body1 = loadRes1.json();
      const body2 = loadRes2.json();
      expect(body1.ok).toBe(true);
      expect(body2.ok).toBe(true);
      expect(body1.itemsLoaded).toBe(48);
      expect(body2.itemsLoaded).toBe(48);
      expect(body1.deduplicated || body2.deduplicated).toBe(true);

      // 3. Subsequent POST /v1/demo/load with same scale returns idempotent: true without re-indexing
      const idempotentRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/load',
        payload: { scale: '48' },
      });
      expect(idempotentRes.statusCode).toBe(200);
      expect(idempotentRes.json()).toMatchObject({
        ok: true,
        status: 'ready',
        idempotent: true,
        scale: '48',
        itemsLoaded: 48,
      });

      // 4. GET /v1/demo/status now reports 'ready' with 48 indexed items
      const statusReady = await app.inject({
        method: 'GET',
        url: '/v1/demo/status',
      });
      expect(statusReady.statusCode).toBe(200);
      expect(statusReady.json()).toMatchObject({
        ok: true,
        status: 'ready',
        scale: '48',
        itemsIndexed: 48,
      });
    } finally {
      await app.close();
    }
  });

  it('renders StorefrontBenchmarkModal without hardcoded +24.5% CR or pre-filled fake external URL', () => {
    const html = renderToStaticMarkup(
      React.createElement(StorefrontBenchmarkModal, {
        isOpen: true,
        onClose: () => {},
        catalog: INITIAL_CATALOG,
        language: 'ru',
        onSynonymsChanged: () => {},
        onRunQueryInStudio: () => {},
      }),
    );

    expect(html).not.toContain('+24.5% CR');
    expect(html).not.toContain('value="https://your-bitrix-shop.ru');
    expect(html).toContain('Локальная симуляция SQL LIKE по демо-каталогу');
    expect(html).toContain('полнота');
  });
});
