import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Metrics } from '@eidos/core';
import { registerOpenAPI } from './openapi';
import { healthRoutes } from './routes/health';
import { catalogRoutes } from './routes/catalog';
import { searchRoutes } from './routes/search';
import { recommendRoutes } from './routes/recommend';
import { recommendUserRoutes } from './routes/recommend-user';
import { recommendAdaptiveRoutes } from './routes/recommend-adaptive';
import { feedbackRoutes } from './routes/feedback';
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
  });

  await fastify.register(cors, {
    origin: true,
  });

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

  // Prometheus /metrics endpoint
  fastify.get('/metrics', async (_request, reply) => {
    reply.header('content-type', Metrics.getContentType());
    return await Metrics.getMetrics();
  });

  // Register modular v1 routes
  await fastify.register(healthRoutes, { vectorStore });
  await fastify.register(catalogRoutes, { vectorStore, embedder });
  await fastify.register(searchRoutes, { vectorStore, embedder });
  await fastify.register(recommendRoutes, { vectorStore });
  await fastify.register(recommendUserRoutes, { vectorStore });
  await fastify.register(recommendAdaptiveRoutes, { vectorStore });
  await fastify.register(feedbackRoutes);

  return fastify;
}

export const buildApp = buildServer;

if (require.main === module) {
  const port = Number(process.env.PORT || 8080);
  buildServer()
    .then((app) => app.listen({ port, host: '0.0.0.0' }))
    .then(() => {
      console.log(`Eidos API server listening on http://0.0.0.0:${port}`);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
