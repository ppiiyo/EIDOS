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
import { initTracing } from './tracing';

const SEED_ITEMS = [
  {
    id: '1',
    title: 'Cyberpunk 2077',
    description: 'Open-world cyberpunk sci-fi RPG set in Night City with neural implants and AI.',
    category: 'Games',
    tags: ['cyberpunk', 'rpg', 'scifi', 'simulation'],
    price: 59.99,
  },
  {
    id: '2',
    title: 'The Matrix',
    description: 'Cult sci-fi movie about simulated reality, artificial intelligence, and rebellion.',
    category: 'Movies',
    tags: ['scifi', 'simulation', 'cyberpunk', 'ai'],
    price: 14.99,
  },
  {
    id: '3',
    title: 'Dune',
    description: 'Epic science fiction novel about desert planet Arrakis, politics, and ecology.',
    category: 'Books',
    tags: ['scifi', 'space', 'politics'],
    price: 19.99,
  },
  {
    id: '4',
    title: 'Python Machine Learning Handbook',
    description: 'Complete guide to programming, algorithms, deep learning, and neural networks.',
    category: 'Books',
    tags: ['programming', 'python', 'ai', 'code'],
    price: 39.99,
  },
  {
    id: '5',
    title: 'Barista Pro Espresso Machine',
    description: '15-bar automatic coffee maker with integrated conical burr grinder.',
    category: 'Appliances',
    tags: ['coffee', 'espresso', 'kitchen'],
    price: 499.0,
  },
];

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

  // Seed default catalog items with deterministic 384-d vectors
  for (const item of SEED_ITEMS) {
    const text = `${item.title}. ${item.category}. ${item.tags.join(', ')}. ${item.description}`;
    const vec = await embedder.embed(text);
    vectorStore.upsert({
      ...item,
      embedding: Array.from(vec),
    });
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
