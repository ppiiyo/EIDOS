import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';
import { getCache } from '../services/cache';

export interface ComponentCheck {
  status: 'ok' | 'warning' | 'degraded' | 'error';
  [key: string]: unknown;
}

async function checkVectorStore(vectorStore: VectorStore): Promise<ComponentCheck> {
  try {
    const itemCount = vectorStore.size();
    const hnswSize = vectorStore.getHNSW().size();
    return {
      status: itemCount > 0 ? 'ok' : 'warning',
      itemCount,
      itemsCount: itemCount,
      hnswIndexedCount: hnswSize,
      message: itemCount > 0 ? `Indexed ${itemCount} items` : 'Vector store is empty',
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
      message: 'Embedding model loaded',
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function checkMemory(): ComponentCheck {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);

  return {
    status: rssMB < 2048 ? 'ok' : 'warning',
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
  const cache = getCache();

  const handleHealthCheck = async (_request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();

    const [redisHealthy, cacheStats] = await Promise.all([
      cache.healthCheck(),
      cache.getStats(),
    ]);

    const checks = {
      vectorStore: await checkVectorStore(opts.vectorStore),
      database: await checkDatabase(opts.vectorStore),
      embeddingModel: await checkEmbeddingModel(opts.embedder),
      redis: {
        status: (redisHealthy ? 'ok' : 'degraded') as ComponentCheck['status'],
        connected: redisHealthy,
        stats: cacheStats,
      },
      memory: checkMemory(),
      uptime: checkUptime(),
    };

    const isHealthy = Object.values(checks).every((c) => c.status === 'ok');
    const responseTime = Date.now() - startTime;
    const itemCount = opts.vectorStore.count();

    return reply.status(isHealthy ? 200 : 503).send({
      ok: isHealthy,
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTimeMs: responseTime,
      version: process.env.npm_package_version || '1.0.0',
      itemsIndexed: itemCount,
      itemsCount: itemCount,
      uptimeSeconds: Math.floor((Date.now() - bootTime) / 1000),
      model: 'all-MiniLM-L6-v2',
      ...(isHealthy ? {} : { error: 'One or more health checks reported degraded or error status' }),
      checks,
    });
  };

  // Public health check endpoints (no authentication required in any environment)
  fastify.get('/v1/health', handleHealthCheck);
  fastify.get('/health', handleHealthCheck);
  fastify.get('/api/health', handleHealthCheck);

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
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks: {
        vectorStore,
        database,
        embeddingModel,
      },
    });
  });

  // Liveness probe for Kubernetes
  fastify.get('/v1/health/live', async (_request, reply) => {
    return reply.status(200).send({
      status: 'ok',
      alive: true,
      timestamp: new Date().toISOString(),
    });
  });
}

(healthRoutes as any)[Symbol.for('skip-override')] = true;

