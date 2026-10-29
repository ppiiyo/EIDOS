import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DEMO_CATALOG } from '../demo/demo-catalog';
import { demoRateLimit } from '../middleware/rate-limit-demo';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';

export async function demoRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder?: ServerEmbedder }
): Promise<void> {
  const applyDemoRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    request.demoMode = true;
    request.demoRateLimit = 10;
    await demoRateLimit(request, reply);
  };

  fastify.post(
    '/v1/demo/load',
    { preHandler: applyDemoRateLimit },
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
    { preHandler: applyDemoRateLimit },
    async () => {
      await opts.vectorStore.clear();
      return {
        ok: true,
      };
    }
  );
}

(demoRoutes as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;
