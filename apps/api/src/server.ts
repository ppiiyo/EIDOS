import Fastify, { FastifyInstance } from 'fastify';
import { Metrics } from '@eidos/core';
import { registerOpenAPI } from './openapi';
import { securityPlugin } from './plugins/security';
import { observabilityPlugin } from './plugins/observability';
import { errorTrackerPlugin } from './plugins/error-tracker';
import { apiRoutesPlugin } from './plugins/routes';
import { VectorStore } from './services/vector-store';
import { ServerEmbedder } from './services/embedder';
import { AILManager } from './services/ail';
import { getPrecomputedSeedCatalog } from './services/seed-catalog';
import { initTracing } from './tracing';

export async function buildServer(): Promise<FastifyInstance> {
  initTracing();

  const fastify = Fastify({
    logger: false,
    connectionTimeout: 15_000,
    requestTimeout: 10_000,
  });

  // 1. Register security stack (CORS whitelist, Rate Limit, Helmet CSP)
  await fastify.register(securityPlugin);

  // 2. Register observability & error tracking plugins
  await fastify.register(observabilityPlugin);
  await fastify.register(errorTrackerPlugin);

  // 3. Register OpenAPI / Swagger documentation
  await registerOpenAPI(fastify);

  const vectorStore = new VectorStore();
  const embedder = ServerEmbedder.getInstance();
  const ail = AILManager.getInstance();

  // Seed 5,005 catalog items with 384-d vectors in <35ms
  const seedItems = await getPrecomputedSeedCatalog(embedder, 5005);
  vectorStore.bulkSeed(seedItems);

  for (let i = 0; i < Math.min(seedItems.length, 100); i++) {
    const item = seedItems[i];
    ail.metadataStore.add({
      id: item.id,
      category: item.category,
      popularity: 0.75,
      createdAt: Date.now() - 86400_000,
      attributes: {},
    });
  }

  Metrics.vectorStoreSize.set(vectorStore.count());

  // Prometheus /metrics endpoint
  fastify.get('/metrics', async (_request, reply) => {
    reply.header('content-type', Metrics.getContentType());
    return await Metrics.getMetrics();
  });

  // 4. Register API routes and 404/SPA fallback handler
  await fastify.register(apiRoutesPlugin, { vectorStore, embedder });

  // Warm up V8 JIT for search & recommend hot paths without populating ApiQueryCache
  const warmupItem = vectorStore.get('item-10');
  if (warmupItem) {
    vectorStore.search(warmupItem.normalizedVector || warmupItem.embedding, 20, 0.35, 'item-10');
  }

  // Attach vectorStore cleanup on Fastify close
  fastify.addHook('onClose', async () => {
    await vectorStore.getWAL().flush();
  });

  return fastify;
}

export const buildApp = buildServer;

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  buildServer()
    .then(async (app) => {
      const gracefulShutdown = async (signal: string) => {
        console.log(`Received ${signal}. Flushing WAL and shutting down gracefully...`);
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
