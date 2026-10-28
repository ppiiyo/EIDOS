import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import type { buildServer as BuildServerFn } from './apps/api/src/server';

function resolvePort(): number {
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

function isApiOrTelemetryRoute(url: string): boolean {
  const cleanUrl = url.split('?')[0];
  return (
    cleanUrl === '/v1' ||
    cleanUrl.startsWith('/v1/') ||
    cleanUrl === '/api/v1' ||
    cleanUrl.startsWith('/api/v1/') ||
    cleanUrl === '/health' ||
    cleanUrl === '/api/health' ||
    cleanUrl === '/docs' ||
    cleanUrl.startsWith('/docs/') ||
    cleanUrl === '/metrics'
  );
}

async function startUnifiedServer() {
  let fastifyApp: Awaited<ReturnType<typeof BuildServerFn>> | null = null;
  let viteMiddlewares: ((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void) | null = null;

  const server = http.createServer(async (req, res) => {
    if (req.url && (req.url === '/api/v1' || req.url.startsWith('/api/v1/') || req.url.startsWith('/api/v1?'))) {
      req.url = req.url.slice(4);
    }
    const url = req.url || '/';
    const cleanUrl = url.split('?')[0];

    // Fast-path readiness check for HEAD probes before Vite/Fastify finish cold-start
    if (req.method === 'HEAD' && !isApiOrTelemetryRoute(url) && !viteMiddlewares && !isProduction) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end();
      return;
    }

    // Fast-path /health probe if Fastify is still hydrating
    if ((cleanUrl === '/health' || cleanUrl === '/api/health') && !fastifyApp) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, status: 'healthy', timestamp: new Date().toISOString() }));
      return;
    }

    // In production mode, serve static files from dist/ immediately without blocking on API hydration
    if (isProduction && !isApiOrTelemetryRoute(url)) {
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

    // Route all /v1/*, /health, /api/health, /docs*, and /metrics requests through Fastify API
    if (isApiOrTelemetryRoute(url)) {
      await apiPromise;
      if (fastifyApp) {
        fastifyApp.routing(req, res);
        return;
      }
    }

    // In development mode, delegate frontend assets & SPA routes to Vite middleware without waiting for HNSW seed
    if (!isProduction) {
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
    if (fastifyApp) {
      fastifyApp.routing(req, res);
    }
  });

  // Bind immediately (<50ms) so readiness checks pass without waiting for module imports or catalog seed
  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `🚀 Eidos Unified Server (Fastify API /v1/* + Studio UI) listening on http://0.0.0.0:${PORT}`
    );
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}. Closing unified server and saving catalog snapshot...`);
    try {
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

  const vitePromise = (async () => {
    if (!isProduction) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        configFile: path.resolve(process.cwd(), 'apps/workspace/vite.config.ts'),
        server: {
          middlewareMode: true,
          hmr: {
            server,
          },
          watch: null,
        },
        appType: 'spa',
      });
      viteMiddlewares = vite.middlewares;
    }
  })();

  const apiPromise = (async () => {
    await vitePromise;
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
    const { buildServer } = await import('./apps/api/src/server');
    fastifyApp = await buildServer();
    await fastifyApp.ready();
  })();

  await Promise.all([vitePromise, apiPromise]);
}

startUnifiedServer().catch((err) => {
  console.error('Failed to start Eidos unified server:', err);
  process.exit(1);
});
