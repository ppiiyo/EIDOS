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
import { authenticate, validateProductionKeyPolicy } from './middleware/auth';
import { getYmlSyncScheduler } from './services/yml-sync-scheduler';

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
    trustProxy: process.env.EIDOS_TRUST_PROXY === 'true',
    connectionTimeout: 15_000,
    requestTimeout: 10_000,
  });

  const clusterCoordinator = new ClusterStateCoordinator();
  fastify.clusterCoordinator = clusterCoordinator;

  await fastify.register(securityPlugin);
  await fastify.register(observabilityPlugin);
  await fastify.register(errorTrackerPlugin);
  await fastify.register(funnelPlugin);
  await registerOpenAPI(fastify);

  const vectorStore = new VectorStore();
  activeShutdownStore = vectorStore;
  const embedder = ServerEmbedder.getInstance();

  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  if (process.env.EIDOS_SNAPSHOT_PATH || !isTestEnv) {
    try {
      await vectorStore.loadSnapshotFromDisk(embedder);
    } catch (err) {
        const isSpaceMismatch =
          (err as any)?.name === 'EmbeddingSpaceMismatchError' ||
          /embedding space mismatch/i.test(String((err as any)?.message || err));
        if (isSpaceMismatch) throw err; // fail-closed: do not boot on incompatible index
        console.warn('[EIDOS] Skipping stale catalog snapshot on startup:', err instanceof Error ? err.message : err);
      }
  }
  if (process.env.EIDOS_WAL_PATH || !isTestEnv) {
    vectorStore.replayWalFromDisk();
  }

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

  fastify.get('/metrics', { preHandler: authenticate }, handlePrometheusMetrics);
  fastify.get('/v1/metrics/prometheus', { preHandler: authenticate }, handlePrometheusMetrics);

  await fastify.register(apiRoutesPlugin, { vectorStore, embedder });

  await getCache().healthCheck();

  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    getYmlSyncScheduler({ embedder }).start();
  }

  fastify.addHook('onClose', async () => {
    getYmlSyncScheduler().stop();
    if (periodicSnapshotTimer) {
      clearInterval(periodicSnapshotTimer);
      periodicSnapshotTimer = null;
    }
    clusterCoordinator.setDraining(true);
    clusterCoordinator.close();
    if (process.env.EIDOS_SNAPSHOT_PATH || !isTestEnv) {
      vectorStore.saveSnapshotSync();
      if (fastify.storeRegistry) {
        for (const meta of fastify.storeRegistry.listIndexes()) {
          if (meta.store !== vectorStore) {
            meta.store.saveSnapshotSync();
          }
        }
      }
    }
    await vectorStore.getWAL().flush();
    if (fastify.storeRegistry) {
      for (const meta of fastify.storeRegistry.listIndexes()) {
        if (meta.store !== vectorStore) {
          await meta.store.getWAL().flush();
        }
      }
    }
  });

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
