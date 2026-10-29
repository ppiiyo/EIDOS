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
import { AILManager } from './services/ail';
import { intentDictionary } from './services/intent-dictionary';
import {
  getPrecomputedSeedCatalog,
  generateDeterministicSeedCatalog,
  mulberry32,
  resetSeedCatalogCache,
} from './services/seed-catalog';
import { initTracing } from './tracing';
import { recommendSchema, simpleRecommend } from './routes/recommend';
import { getCache } from './services/cache';
import { ClusterStateCoordinator } from './services/cluster-coordinator';

export { mulberry32, generateDeterministicSeedCatalog, resetSeedCatalogCache, intentDictionary };

const DETERMINISTIC_SEED = 42;
const DETERMINISTIC_EPOCH_MS = 1_700_000_000_000;

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
  initTracing();
  ensureProcessShutdownSnapshotHooks();

  const fastify = Fastify({
    logger:
      process.env.DEBUG_ROUTES === 'true'
        ? { level: 'debug', transport: { target: 'pino-pretty' } }
        : process.env.NODE_ENV === 'production'
          ? { level: 'info' }
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

  const vectorStore = new VectorStore();
  activeShutdownStore = vectorStore;
  const embedder = ServerEmbedder.getInstance();
  const ail = AILManager.getInstance();

  if (process.env.EIDOS_DEMO_MODE === 'true') {
    const seedItems = await getPrecomputedSeedCatalog(embedder, 5005, DETERMINISTIC_SEED);
    vectorStore.bulkSeed(seedItems);

    const prng = mulberry32(DETERMINISTIC_SEED);
    for (let i = 0; i < Math.min(seedItems.length, 100); i++) {
      const item = seedItems[i];
      ail.metadataStore.add({
        id: item.id,
        category: item.category,
        popularity: Math.round((0.65 + prng() * 0.25) * 1000) / 1000,
        createdAt: DETERMINISTIC_EPOCH_MS - i * 3600_000,
        attributes: {},
      });
    }
  }

  // Load persisted catalog snapshot (if present on disk) before HTTP server starts
  await vectorStore.loadSnapshotFromDisk(embedder);

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

  // Warm up V8 JIT and Redis TCP socket without populating ApiQueryCache
  await getCache().healthCheck();
  if (vectorStore.count() > 0) {
    const warmupQueryVec = await embedder.embed('Quantum Spatial Audio Headphones');
    vectorStore.hybridSearch('Quantum Spatial Audio Headphones', warmupQueryVec, 10);
    const parsedWarmup = recommendSchema.safeParse({
      item_id: 'item-10',
      strategy: 'simple',
      limit: 10,
    });
    if (parsedWarmup.success) {
      await simpleRecommend(parsedWarmup.data, vectorStore);
    }
  }

  // Attach vectorStore cleanup, graceful drain & synchronous snapshot persistence on Fastify close
  fastify.addHook('onClose', async () => {
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
