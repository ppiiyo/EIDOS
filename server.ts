import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { buildServer as BuildServerFn } from './apps/api/src/server';

export function resolvePort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const cliPort = Number(process.argv[portArgIdx + 1]);
    if (!Number.isNaN(cliPort) && cliPort > 0) return cliPort;
  }
  if (process.env.EIDOS_PORT) {
    return Number(process.env.EIDOS_PORT);
  }
  if (process.env.DEFAULT_APP_PORT) {
    return Number(process.env.DEFAULT_APP_PORT);
  }
  if (process.env.PORT && process.env.PORT !== process.env.NGINX_PORT) {
    return Number(process.env.PORT);
  }
  return 3000;
}

const PORT = resolvePort();
const isProduction = process.env.NODE_ENV === 'production';
if (process.env.EIDOS_FAIL_CLOSED_EMPTY_INDEX === undefined) {
  process.env.EIDOS_FAIL_CLOSED_EMPTY_INDEX = 'true';
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

export function isApiOrTelemetryRoute(url: string): boolean {
  const cleanUrl = url.split('?')[0];
  return (
    cleanUrl === '/v1' ||
    cleanUrl.startsWith('/v1/') ||
    cleanUrl === '/api/v1' ||
    cleanUrl.startsWith('/api/v1/') ||
    cleanUrl === '/health' ||
    cleanUrl === '/api/health' ||
    cleanUrl === '/ready' ||
    cleanUrl === '/live' ||
    cleanUrl === '/widget.js' ||
    cleanUrl === '/docs' ||
    cleanUrl.startsWith('/docs/') ||
    cleanUrl === '/metrics'
  );
}

export interface UnifiedHandlerOptions {
  isProduction?: boolean;
  buildServerOverride?: () => Promise<Awaited<ReturnType<typeof BuildServerFn>>>;
  viteMiddlewaresOverride?:
    | ((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void)
    | null;
}

export function createUnifiedServerLifecycle(options: UnifiedHandlerOptions = {}) {
  const prodMode = options.isProduction ?? isProduction;
  let fastifyApp: Awaited<ReturnType<typeof BuildServerFn>> | null = null;
  let apiInitError: Error | null = null;
  let viteMiddlewares:
    | ((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void)
    | null = options.viteMiddlewaresOverride ?? null;

  let resolveViteReady: () => void = () => {};
  const vitePromise = new Promise<void>((resolve) => {
    resolveViteReady = resolve;
  });

  let resolveApiReady: () => void = () => {};
  const apiPromise = new Promise<void>((resolve) => {
    resolveApiReady = resolve;
  });

  const sendApiInitError = (res: http.ServerResponse) => {
    const message =
      apiInitError instanceof Error
        ? apiInitError.message
        : 'Fastify API failed to initialize';
    if (!res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    }
    res.end(
      JSON.stringify({
        ok: false,
        status: 'error',
        code: 'API_INIT_FAILED',
        error: 'Service Unavailable',
        message,
        timestamp: new Date().toISOString(),
      })
    );
  };

  const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    if (
      req.url &&
      (req.url === '/api/v1' || req.url.startsWith('/api/v1/') || req.url.startsWith('/api/v1?'))
    ) {
      req.url = req.url.slice(4);
    }
    const url = req.url || '/';
    const cleanUrl = url.split('?')[0];

    // Fast-path readiness check for HEAD probes on frontend root before Vite finishes cold-start
    if (
      req.method === 'HEAD' &&
      !isApiOrTelemetryRoute(url) &&
      !viteMiddlewares &&
      !prodMode
    ) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end();
      return;
    }

    // Liveness probe (/live, /v1/health/live) reports process liveness while Fastify boots
    if (
      (cleanUrl === '/live' || cleanUrl === '/v1/health/live') &&
      !fastifyApp &&
      !apiInitError
    ) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          status: 'starting',
          alive: true,
          draining: false,
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // In production mode, serve static files from dist/ immediately without blocking on API hydration
    if (prodMode && !isApiOrTelemetryRoute(url)) {
      const distDir = path.resolve(process.cwd(), 'dist');
      let decodedPath = cleanUrl;
      try {
        decodedPath = decodeURIComponent(cleanUrl);
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad Request');
        return;
      }

      if (decodedPath.includes('\0') || decodedPath.includes('..')) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      const safeRelPath = (decodedPath === '/' ? 'index.html' : decodedPath).replace(/^\/+/, '');
      const candidateFile = path.resolve(distDir, safeRelPath);

      if (!candidateFile.startsWith(distDir + path.sep) && candidateFile !== distDir) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      if (fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
        const ext = path.extname(candidateFile);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(candidateFile).pipe(res);
        return;
      }

      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(indexHtml).pipe(res);
        return;
      }
    }

    // Route all /v1/*, /health, /api/health, /ready, /docs*, and /metrics requests through real Fastify API
    if (isApiOrTelemetryRoute(url)) {
      await apiPromise;
      if (apiInitError || !fastifyApp) {
        sendApiInitError(res);
        return;
      }
      fastifyApp.routing(req, res);
      return;
    }

    // In development mode, delegate frontend assets & SPA routes to Vite middleware without waiting for HNSW seed
    if (!prodMode) {
      await vitePromise;
      if (viteMiddlewares) {
        viteMiddlewares(req, res, () => {
          res.statusCode = 404;
          res.end('Not Found');
        });
        return;
      }
    }

    await apiPromise;
    if (apiInitError || !fastifyApp) {
      sendApiInitError(res);
      return;
    }
    fastifyApp.routing(req, res);
  };

  const init = async (httpServer?: http.Server) => {
    const viteInit = (async () => {
      try {
        if (!prodMode && !options.viteMiddlewaresOverride) {
          const { createServer: createViteServer } = await import('vite');
          const vite = await createViteServer({
            configFile: path.resolve(process.cwd(), 'apps/workspace/vite.config.ts'),
            server: {
              middlewareMode: true,
              hmr:
                process.env.DISABLE_HMR === 'true'
                  ? false
                  : httpServer
                  ? { server: httpServer }
                  : true,
              watch: null,
            },
            appType: 'spa',
          });
          viteMiddlewares = vite.middlewares;
        }
      } finally {
        resolveViteReady();
      }
    })();

    const apiInit = (async () => {
      try {
        await viteInit;
        if (options.buildServerOverride) {
          fastifyApp = await options.buildServerOverride();
        } else {
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
          const { buildServer } = await import('./apps/api/src/server');
          fastifyApp = await buildServer();
        }
        await fastifyApp.ready();
      } catch (err) {
        apiInitError = err instanceof Error ? err : new Error(String(err));
        console.error('Error initializing Fastify API inside unified server:', err);
      } finally {
        resolveApiReady();
      }
    })();

    await Promise.all([viteInit, apiInit]);
  };

  return {
    requestHandler,
    init,
    getFastifyApp: () => fastifyApp,
    getApiInitError: () => apiInitError,
  };
}

export async function startUnifiedServer() {
  const lifecycle = createUnifiedServerLifecycle();
  const server = http.createServer((req, res) => {
    void lifecycle.requestHandler(req, res);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `🚀 Eidos Unified Server (Fastify API /v1/* + Studio UI) listening on http://0.0.0.0:${PORT}`
    );
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}. Closing unified server and saving catalog snapshot...`);
    try {
      const fastifyApp = lifecycle.getFastifyApp();
      if (fastifyApp) {
        await fastifyApp.close();
      }
      server.close();
    } catch {
      // Ignore close errors
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => void gracefulShutdown('SIGINT'));

  await lifecycle.init(server);
}

const isMainModule = (() => {
  if (process.env.EIDOS_SKIP_AUTO_START === 'true' || process.env.VITEST) {
    return false;
  }
  try {
    const currentFile = fileURLToPath(import.meta.url);
    const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return currentFile === entryFile || entryFile.endsWith('/server.ts');
  } catch {
    return true;
  }
})();

if (isMainModule) {
  startUnifiedServer().catch((err) => {
    console.error('Failed to start Eidos unified server:', err);
    process.exit(1);
  });
}
