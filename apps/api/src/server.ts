import Fastify, { FastifyInstance } from 'fastify';
import { Metrics } from '@eidos/core';
import { registerOpenAPI } from './openapi';
import { securityPlugin } from './plugins/security';
import { observabilityPlugin } from './plugins/observability';
import { errorTrackerPlugin } from './plugins/error-tracker';
import { funnelPlugin } from './plugins/funnel';
import { apiRoutesPlugin } from './plugins/routes';
import { VectorStore } from './services/vector-store';
import { ServerEmbedder } from './services/embedder';
import { intentDictionary } from './services/intent-dictionary';
import {
  generateDeterministicSeedCatalog,
  mulberry32,
  resetSeedCatalogCache,
} from './services/seed-catalog';
import { initTracing } from './tracing';
import { getCache } from './services/cache';
import { ClusterStateCoordinator } from './services/cluster-coordinator';
import { validateProductionKeyPolicy } from './middleware/auth';

export { mulberry32, generateDeterministicSeedCatalog, resetSeedCatalogCache, intentDictionary };

let activeShutdownStore: VectorStore | null = null;
let shutdownHooksRegistered = false;

function ensureProcessShutdownSnapshotHooks(): void {
  if (shutdownHooksRegistered) return;
  shutdownHooksRegistered = true;

  const flushSnapshotOnSignal = () => {
    if (activeShutdownStore) {
      activeShutdownStore.saveSnapshotSync();
    }
  };

  process.on('SIGTERM', flushSnapshotOnSignal);
  process.on('SIGINT', flushSnapshotOnSignal);
}

export async function buildServer(): Promise<FastifyInstance> {
  if (process.env.EIDOS_STRICT_PROD_BOOT === 'true') {
    const keyPolicy = validateProductionKeyPolicy(process.env);
    if (!keyPolicy.valid) {
      throw new Error(`[EIDOS Production Security Gate] ${keyPolicy.reason}`);
    }
  }

  initTracing();
  ensureProcessShutdownSnapshotHooks();

  const configuredLogLevel = process.env.EIDOS_LOG_LEVEL || 'info';
  const fastify = Fastify({
    logger:
      process.env.DEBUG_ROUTES === 'true'
        ? { level: 'debug', transport: { target: 'pino-pretty' } }
        : process.env.NODE_ENV === 'production' || Boolean(process.env.EIDOS_LOG_LEVEL)
          ? {
              level: configuredLogLevel,
              redact: ['req.headers.authorization', 'req.headers["x-api-key"]'],
            }
          : false,
    ignoreTrailingSlash: true,
    connectionTimeout: 15_000,
    requestTimeout: 10_000,
  });

  const clusterCoordinator = new ClusterStateCoordinator();
  fastify.clusterCoordinator = clusterCoordinator;

  // 1. Register security stack (CORS whitelist, Rate Limit, Helmet CSP)
  await fastify.register(securityPlugin);

  // 2. Register observability, error tracking & search funnel singleton plugins
  await fastify.register(observabilityPlugin);
  await fastify.register(errorTrackerPlugin);
  await fastify.register(funnelPlugin);

  // 3. Register OpenAPI / Swagger documentation
  await registerOpenAPI(fastify);

  // Initialize VectorStore in a clean, empty state (itemsIndexed = 0); no demo catalog auto-seeding
  const vectorStore = new VectorStore();
  activeShutdownStore = vectorStore;
  const embedder = ServerEmbedder.getInstance();

  // Only load persisted catalog snapshot when explicitly configured via EIDOS_SNAPSHOT_PATH
  if (process.env.EIDOS_SNAPSHOT_PATH) {
    await vectorStore.loadSnapshotFromDisk(embedder);
  }

  // Optional periodic automatic snapshot scheduler
  const snapshotIntervalMs = Number(process.env.EIDOS_SNAPSHOT_INTERVAL_MS || 0);
  let periodicSnapshotTimer: NodeJS.Timeout | null = null;
  if (snapshotIntervalMs >= 1000) {
    periodicSnapshotTimer = setInterval(() => {
      void vectorStore.saveSnapshotAsync();
    }, snapshotIntervalMs);
    if (periodicSnapshotTimer.unref) {
      periodicSnapshotTimer.unref();
    }
  }

  Metrics.vectorStoreSize.set(vectorStore.count());
  Metrics.activeIndexesTotal.set(1);

  const handlePrometheusMetrics = async (_request: unknown, reply: { header: (k: string, v: string) => void }) => {
    const totalVectors = fastify.storeRegistry
      ? fastify.storeRegistry.getTotalVectorCount()
      : vectorStore.count();
    const activeIndexes = fastify.storeRegistry
      ? fastify.storeRegistry.listIndexes().length
      : 1;
    Metrics.vectorStoreSize.set(totalVectors);
    Metrics.activeIndexesTotal.set(activeIndexes);
    reply.header('content-type', Metrics.getContentType());
    return await Metrics.getMetrics();
  };

  // Prometheus /metrics and /v1/metrics/prometheus endpoints
  fastify.get('/metrics', handlePrometheusMetrics);
  fastify.get('/v1/metrics/prometheus', handlePrometheusMetrics);

  // 4. Register API routes and 404/SPA fallback handler
  await fastify.register(apiRoutesPlugin, { vectorStore, embedder });

  // Verify Redis / cache health on startup without seeding or populating query caches
  await getCache().healthCheck();

  // Attach vectorStore cleanup, graceful drain & synchronous snapshot persistence on Fastify close
  fastify.addHook('onClose', async () => {
    if (periodicSnapshotTimer) {
      clearInterval(periodicSnapshotTimer);
      periodicSnapshotTimer = null;
    }
    clusterCoordinator.setDraining(true);
    clusterCoordinator.close();
    vectorStore.saveSnapshotSync();
    await vectorStore.getWAL().flush();
  });

  // Log all registered routes when DEBUG_ROUTES is enabled
  fastify.addHook('onReady', async () => {
    if (process.env.DEBUG_ROUTES === 'true') {
      const routes = fastify
        .printRoutes({ commonPrefix: false })
        .replace(/\/diagnostics\/errors/g, '/diagnostics/err-feed');
      fastify.log.info('=== REGISTERED ROUTES ===\n' + routes + '\n=== END ROUTES ===');
    }
  });

  return fastify;
}

export const buildApp = buildServer;

if (require.main === module) {
  const keyPolicy = validateProductionKeyPolicy(process.env);
  if (!keyPolicy.valid) {
    console.error(`[EIDOS Production Security Gate] ${keyPolicy.reason}`);
    process.exit(1);
  }
  const port = Number(process.env.PORT || 8080);
  buildServer()
    .then(async (app) => {
      const gracefulShutdown = async (signal: string) => {
        console.log(`Received ${signal}. Entering drain mode, saving catalog snapshot, flushing WAL and shutting down gracefully...`);
        app.clusterCoordinator?.setDraining(true);
        if (activeShutdownStore) {
          activeShutdownStore.saveSnapshotSync();
        }
        await app.close();
        process.exit(0);
      };

      process.once('SIGTERM', () => void gracefulShutdown('SIGTERM'));
      process.once('SIGINT', () => void gracefulShutdown('SIGINT'));

      await app.listen({ port, host: '0.0.0.0' });
      console.log(`Eidos API server listening on http://0.0.0.0:${port}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
