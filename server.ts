import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { buildServer } from './apps/api/src/server';

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
  return (
    url === '/v1' ||
    url.startsWith('/v1/') ||
    url === '/docs' ||
    url.startsWith('/docs/') ||
    url === '/metrics' ||
    url.startsWith('/metrics?')
  );
}

async function startUnifiedServer() {
  let fastifyApp: Awaited<ReturnType<typeof buildServer>> | null = null;
  let viteMiddlewares: ((req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void) | null = null;

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';

    // In production mode, serve static files from dist/ immediately without blocking on API hydration
    if (isProduction && !isApiOrTelemetryRoute(url)) {
      const cleanPath = url.split('?')[0];
      const distDir = path.resolve(process.cwd(), 'dist');
      const candidateFile = path.join(distDir, cleanPath === '/' ? 'index.html' : cleanPath);

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

    await initPromise;

    // Route all /v1/*, /docs*, and /metrics requests directly through Fastify API
    if (fastifyApp && isApiOrTelemetryRoute(url)) {
      fastifyApp.routing(req, res);
      return;
    }

    // In development mode, delegate frontend assets & SPA routes to Vite middleware
    if (viteMiddlewares) {
      viteMiddlewares(req, res, () => {
        res.statusCode = 404;
        res.end('Not Found');
      });
      return;
    }

    if (fastifyApp) {
      fastifyApp.routing(req, res);
    }
  });

  // Bind immediately so readiness checks pass without waiting for full catalog seed
  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `🚀 Eidos Unified Server (Fastify API /v1/* + Studio UI) listening on http://0.0.0.0:${PORT}`
    );
  });

  const initPromise = (async () => {
    fastifyApp = await buildServer();
    await fastifyApp.ready();

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

  await initPromise;
}

startUnifiedServer().catch((err) => {
  console.error('Failed to start Eidos unified server:', err);
  process.exit(1);
});
