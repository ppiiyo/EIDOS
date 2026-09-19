import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import * as fs from 'fs';
import * as path from 'path';
import { ServerEmbedder } from './services/embedder';
import { VectorStore } from './services/vector-store';
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
  const fastify = Fastify({
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
        fastify.log.warn(`Could not parse seed file at ${p}:`, err);
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
      embedding: v1,
      normalizedVector: v1,
    });
    vectorStore.upsert({
      id: '2',
      title: 'Custom Keycap Set PBT Dye-Sub',
      description: 'Cherry profile keycaps matching mechanical switches.',
      category: 'Electronics',
      tags: ['accessories', 'typing'],
      price: 34.0,
      embedding: v2,
      normalizedVector: v2,
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
        server.log.info(`EIDOS REST API active at ${address}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start EIDOS REST API server:', err);
      process.exit(1);
    });
}
