import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { createServer as createViteServer } from 'vite';
import { buildServer } from './apps/api/src/server';

const PORT = Number(process.env.PORT || 3000);
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
  const fastifyApp = await buildServer();
  await fastifyApp.ready();

  const vite = !isProduction
    ? await createViteServer({
        configFile: path.resolve(process.cwd(), 'apps/workspace/vite.config.ts'),
        server: { middlewareMode: true },
        appType: 'spa',
      })
    : null;

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';

    // Route all /v1/*, /docs*, and /metrics requests directly through Fastify API
    if (isApiOrTelemetryRoute(url)) {
      fastifyApp.routing(req, res);
      return;
    }

    // In development mode, delegate frontend assets & SPA routes to Vite middleware
    if (vite) {
      vite.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end('Not Found');
      });
      return;
    }

    // In production mode, serve static files from dist/ with SPA index.html fallback
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

    fastifyApp.routing(req, res);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `🚀 Eidos Unified Server (Fastify API /v1/* + Studio UI) listening on http://0.0.0.0:${PORT}`
    );
  });
}

startUnifiedServer().catch((err) => {
  console.error('Failed to start Eidos unified server:', err);
  process.exit(1);
});
