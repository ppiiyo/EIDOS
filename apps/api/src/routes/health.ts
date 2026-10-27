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

  // Readiness probe for Kubernetes & Load Balancers
  const handleReadinessProbe = async (_request: FastifyRequest, reply: FastifyReply) => {
    const isDraining = Boolean(fastify.clusterCoordinator?.isDraining());
    if (isDraining) {
      return reply.status(503).send({
        status: 'draining',
        ready: false,
        draining: true,
        nodeId: fastify.clusterCoordinator?.nodeId || 'standalone',
        timestamp: new Date().toISOString(),
      });
    }

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
      ready: isReady,
      draining: false,
      nodeId: fastify.clusterCoordinator?.nodeId || 'standalone',
      catalogVersion: fastify.clusterCoordinator?.getCatalogVersion() ?? 1,
      timestamp: new Date().toISOString(),
      checks: {
        vectorStore,
        database,
        embeddingModel,
      },
    });
  };

  fastify.get('/v1/health/ready', handleReadinessProbe);
  fastify.get('/ready', handleReadinessProbe);

  // Liveness probe for Kubernetes (remains 200 OK during graceful drain so in-flight requests finish)
  const handleLivenessProbe = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      status: 'ok',
      alive: true,
      draining: Boolean(fastify.clusterCoordinator?.isDraining()),
      nodeId: fastify.clusterCoordinator?.nodeId || 'standalone',
      timestamp: new Date().toISOString(),
    });
  };

  fastify.get('/v1/health/live', handleLivenessProbe);
  fastify.get('/live', handleLivenessProbe);

  // Cluster topology, shard health & graceful drain endpoints (Phase 4 Horizontal Scaling)
  fastify.get('/v1/cluster/status', async (_request, reply) => {
    const coordinator = fastify.clusterCoordinator;
    if (!coordinator) {
      return reply.status(200).send({
        nodeId: 'standalone',
        role: 'standalone',
        clusterMode: false,
        draining: false,
        catalogVersion: 1,
      });
    }
    return reply.status(200).send(coordinator.getClusterStatus());
  });

  fastify.post('/v1/cluster/drain', async (request, reply) => {
    const coordinator = fastify.clusterCoordinator;
    const body = (request.body as { draining?: boolean } | null) || {};
    const draining = typeof body.draining === 'boolean' ? body.draining : true;
    coordinator?.setDraining(draining);
    return reply.status(200).send({
      ok: true,
      nodeId: coordinator?.nodeId || 'standalone',
      draining: coordinator ? coordinator.isDraining() : draining,
      timestamp: new Date().toISOString(),
    });
  });

  fastify.post('/v1/cluster/shards/:shardId/health', async (request, reply) => {
    const coordinator = fastify.clusterCoordinator;
    if (!coordinator) {
      return reply.status(503).send({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Cluster coordinator is not initialized on this instance',
      });
    }
    const params = request.params as { shardId: string };
    const body = (request.body as { healthy?: boolean } | null) || {};
    const healthy = typeof body.healthy === 'boolean' ? body.healthy : true;
    const updated = coordinator.setShardHealth(params.shardId, healthy);
    return reply.status(200).send({
      ok: true,
      nodeId: coordinator.nodeId,
      ...updated,
    });
  });
}

(healthRoutes as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;


