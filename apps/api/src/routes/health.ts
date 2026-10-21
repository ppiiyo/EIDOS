import { FastifyInstance } from 'fastify';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';

export interface ComponentCheck {
  status: 'ok' | 'degraded' | 'error';
  [key: string]: unknown;
}

async function checkVectorStore(vectorStore: VectorStore): Promise<ComponentCheck> {
  try {
    const count = vectorStore.count();
    const hnswSize = vectorStore.getHNSW().size();
    return {
      status: count >= 0 && hnswSize >= 0 ? 'ok' : 'degraded',
      itemsCount: count,
      hnswIndexedCount: hnswSize,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkDatabase(vectorStore: VectorStore): Promise<ComponentCheck> {
  try {
    const walSize = vectorStore.getWAL().size();
    return {
      status: 'ok',
      engine: 'in-memory-wal',
      walPendingEntries: walSize,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkEmbeddingModel(embedder?: ServerEmbedder): Promise<ComponentCheck> {
  try {
    const instance = embedder || ServerEmbedder.getInstance();
    const dim = instance.getEmbeddingDimension();
    return {
      status: dim === 384 ? 'ok' : 'degraded',
      model: 'all-MiniLM-L6-v2',
      dimension: dim,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function checkMemory(): ComponentCheck {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100;
  const heapTotalMB = Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100;
  const rssMB = Math.round((mem.rss / (1024 * 1024)) * 100) / 100;

  return {
    status: rssMB < 2048 ? 'ok' : 'degraded',
    heapUsedMB,
    heapTotalMB,
    rssMB,
  };
}

function checkUptime(): ComponentCheck {
  return {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime() * 100) / 100,
  };
}

export async function healthRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder?: ServerEmbedder }
): Promise<void> {
  const bootTime = Date.now();

  fastify.get('/v1/health', async (_request, reply) => {
    const startTime = Date.now();

    const checks = {
      vectorStore: await checkVectorStore(opts.vectorStore),
      database: await checkDatabase(opts.vectorStore),
      embeddingModel: await checkEmbeddingModel(opts.embedder),
      memory: checkMemory(),
      uptime: checkUptime(),
    };

    const isHealthy = Object.values(checks).every((c) => c.status === 'ok');
    const responseTime = Date.now() - startTime;

    return reply.status(isHealthy ? 200 : 503).send({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTimeMs: responseTime,
      version: process.env.npm_package_version || '1.0.0',
      itemsCount: opts.vectorStore.count(),
      uptimeSeconds: Math.floor((Date.now() - bootTime) / 1000),
      model: 'all-MiniLM-L6-v2',
      checks,
    });
  });

  // Readiness probe for Kubernetes
  fastify.get('/v1/health/ready', async (_request, reply) => {
    const [vectorStore, database, embeddingModel] = await Promise.all([
      checkVectorStore(opts.vectorStore),
      checkDatabase(opts.vectorStore),
      checkEmbeddingModel(opts.embedder),
    ]);

    const isReady =
      vectorStore.status === 'ok' &&
      database.status === 'ok' &&
      embeddingModel.status === 'ok';

    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: {
        vectorStore,
        database,
        embeddingModel,
      },
    });
  });

  // Liveness probe for Kubernetes
  fastify.get('/v1/health/live', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));
}
