import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import * as fs from 'fs';
import * as path from 'path';
import { Metrics } from '@kostra44sip/core';
import { ServerEmbedder } from './services/embedder';
import { VectorStore } from './services/vector-store';
import { registerOpenAPI } from './openapi';
import { initTracing } from './tracing';
import { healthRoutes } from './routes/health';
import { catalogRoutes } from './routes/catalog';
import { recommendRoutes } from './routes/recommend';
import { searchRoutes } from './routes/search';
import { recommendUserRoutes } from './routes/recommend-user';
import { recommendAdaptiveRoutes } from './routes/recommend-adaptive';
import { feedbackRoutes } from './routes/feedback';
import { StoredItem } from './types';

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';

export async function buildApp() {
  // Initialize OpenTelemetry Tracing (Task 2.2)
  initTracing();

  const fastify = Fastify({
    bodyLimit: 1048576, // 1MB payload ceiling to prevent body flooding DoS
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: { colorize: true },
            }
          : undefined,
    },
  });

  // Initialize Prometheus Metrics
  Metrics.initialize();

  // Telemetry & Metrics Hooks
  fastify.addHook('onRequest', async (request) => {
    (request as unknown as { startTime: number }).startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const startTime = (request as unknown as { startTime: number }).startTime || Date.now();
    const durationSec = (Date.now() - startTime) / 1000;
    const route = request.routeOptions?.url || request.url;
    Metrics.requestsTotal.inc({
      method: request.method,
      endpoint: route,
      status: reply.statusCode,
      status_code: reply.statusCode.toString(),
    });
    Metrics.requestDuration.observe({ method: request.method, endpoint: route }, durationSec);
  });

  fastify.addHook('onError', async (request, _reply, error) => {
    const route = request.routeOptions?.url || request.url || 'unknown';
    Metrics.errorsTotal.inc({
      error_type: error.name || 'Error',
      endpoint: route,
    });
  });

  // Enterprise Security Headers Hook
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-XSS-Protection', '0');
  });

  // Unified Error Handler (Shield internal stack traces in production)
  fastify.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      fastify.log.error(error);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message:
          process.env.NODE_ENV === 'production'
            ? 'An unexpected server error occurred.'
            : error.message,
      });
    }
    return reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Error',
      message: error.message,
    });
  });

  // OpenAPI Swagger Documentation
  await registerOpenAPI(fastify);

  // Security and Rate Limit Middlewares
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '1200', 10),
    timeWindow: '1 minute',
  });

  // Services
  const vectorStore = new VectorStore();
  const embedder = ServerEmbedder.getInstance();

  // Load HNSW binary snapshot on startup if available (Task 0.2)
  const snapshotCandidates = [
    path.resolve(process.cwd(), 'data/hnsw-snapshot.bin'),
    path.resolve(process.cwd(), '../../data/hnsw-snapshot.bin'),
  ];
  for (const sPath of snapshotCandidates) {
    if (fs.existsSync(sPath)) {
      try {
        const snapshotBytes = fs.readFileSync(sPath);
        vectorStore.importBinarySnapshot(snapshotBytes);
        fastify.log.info(`Restored HNSW binary snapshot from ${sPath} (${vectorStore.count()} items)`);
        break;
      } catch (err) {
        fastify.log.warn({ err }, `Failed to restore HNSW snapshot from ${sPath}`);
      }
    }
  }

  // Pre-seed catalog if available
  const catalogCandidates = [
    path.resolve(process.cwd(), 'data/catalog.json'),
    path.resolve(process.cwd(), '../../data/catalog.json'),
  ];

  for (const p of catalogCandidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const items: StoredItem[] = JSON.parse(raw);
        for (const it of items) {
          if (it.embedding && it.embedding.length > 0) {
            vectorStore.upsert(it);
          }
        }
        fastify.log.info(`Pre-loaded ${vectorStore.count()} catalog items from ${p}`);
        break;
      } catch (err) {
        fastify.log.warn({ err }, `Could not parse seed file at ${p}`);
      }
    }
  }

  // Register Routes
  await fastify.register(healthRoutes, { vectorStore });
  await fastify.register(catalogRoutes, { vectorStore, embedder });
  await fastify.register(recommendRoutes, { vectorStore });
  await fastify.register(searchRoutes, { vectorStore, embedder });
  await fastify.register(recommendUserRoutes, { vectorStore });
  await fastify.register(recommendAdaptiveRoutes, { vectorStore });
  await fastify.register(feedbackRoutes);

  // Prometheus Metrics Exposition Endpoint
  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', Metrics.getContentType());
    return reply.send(await Metrics.getMetrics());
  });

  // Synchronize vector store metric
  Metrics.vectorStoreSize.set(vectorStore.count());

  if (vectorStore.count() === 0) {
    const v1 = new Float32Array(384).fill(0.1);
    const v2 = new Float32Array(384).fill(0.12);
    vectorStore.upsert({
      id: '1',
      title: 'Mechanical Keyboard Blue Switches',
      description: 'Clicky tactile typing keyboard with aluminum chassis.',
      category: 'Electronics',
      tags: ['typing', 'hardware'],
      price: 189.0,
      embedding: Array.from(v1),
      normalizedVector: v1,
    });
    vectorStore.upsert({
      id: '2',
      title: 'Custom Keycap Set PBT Dye-Sub',
      description: 'Cherry profile keycaps matching mechanical switches.',
      category: 'Electronics',
      tags: ['accessories', 'typing'],
      price: 34.0,
      embedding: Array.from(v2),
      normalizedVector: v2,
    });
    Metrics.vectorStoreSize.set(vectorStore.count());
  }

  // Graceful Shutdown Handler (Task 0.2)
  const gracefulShutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, commencing graceful shutdown...`);
    try {
      // 1. Stop accepting new requests
      await fastify.close();
      fastify.log.info('HTTP server closed');

      // 2. Flush Write-Ahead Log
      const wal = vectorStore.getWAL();
      await wal.flush();
      fastify.log.info('WAL flushed to disk');

      // 3. Persist binary snapshot atomically
      if (vectorStore.count() > 0) {
        const snapshotDir = path.resolve(process.cwd(), 'data');
        if (!fs.existsSync(snapshotDir)) {
          fs.mkdirSync(snapshotDir, { recursive: true });
        }
        const snapshotFile = path.join(snapshotDir, 'hnsw-snapshot.bin');
        const tempFile = path.join(snapshotDir, 'hnsw-snapshot.bin.tmp');

        const snapshot = vectorStore.exportBinarySnapshot();
        fs.writeFileSync(tempFile, snapshot);
        fs.renameSync(tempFile, snapshotFile);

        fastify.log.info(`Saved HNSW snapshot: ${snapshot.byteLength} bytes to ${snapshotFile}`);
      }

      fastify.log.info('Graceful shutdown completed successfully');
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        process.exit(0);
      }
    } catch (err) {
      fastify.log.error({ err }, 'Error during graceful shutdown');
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        process.exit(1);
      }
    }
  };

  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('uncaughtException', (err) => {
      fastify.log.error({ err }, 'Uncaught exception');
      gracefulShutdown('uncaughtException');
    });
    process.once('unhandledRejection', (reason) => {
      fastify.log.error({ err: reason }, 'Unhandled rejection');
      gracefulShutdown('unhandledRejection');
    });
  }

  return fastify;
}

export const buildServer = buildApp;

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  buildApp()
    .then((server) => {
      server.listen({ port: PORT, host: HOST }, (err, address) => {
        if (err) {
          server.log.error(err);
          process.exit(1);
        }
        server.log.info(`kostra44SIP REST API active at ${address}`);
        server.log.info(`OpenAPI docs available at ${address}/docs`);
      });
    })
    .catch((err) => {
      console.error('Failed to start kostra44SIP REST API server:', err);
      process.exit(1);
    });
}
