import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DEMO_CATALOG } from '../demo/demo-catalog';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';

const demoLifecycleRequests = new Map<string, { count: number; resetAt: number }>();

export async function demoRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder?: ServerEmbedder }
): Promise<void> {
  const applyDemoLifecycleRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip || 'unknown';
    const now = Date.now();
    const limit = 120;
    const existing = demoLifecycleRequests.get(ip);
    if (!existing || existing.resetAt < now) {
      demoLifecycleRequests.set(ip, { count: 1, resetAt: now + 60_000 });
      return;
    }
    if (existing.count >= limit) {
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Demo lifecycle rate limit exceeded.',
      });
    }
    existing.count += 1;
  };

  fastify.post(
    '/v1/demo/load',
    { preHandler: applyDemoLifecycleRateLimit },
    async () => {
      fastify.storeRegistry?.setDefaultStore(opts.vectorStore);
      await opts.vectorStore.loadDemoCatalog(DEMO_CATALOG, opts.embedder);
      return {
        ok: true,
        itemsLoaded: DEMO_CATALOG.length,
      };
    }
  );

  fastify.post(
    '/v1/demo/reset',
    { preHandler: applyDemoLifecycleRateLimit },
    async () => {
      await opts.vectorStore.clear();
      return {
        ok: true,
      };
    }
  );
}
