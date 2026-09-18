import { FastifyInstance } from 'fastify';
import { VectorStore } from '../services/vector-store';

export async function healthRoutes(fastify: FastifyInstance, opts: { vectorStore: VectorStore }): Promise<void> {
  const startTime = Date.now();

  fastify.get('/v1/health', async (_request, _reply) => {
    return {
      status: 'ok',
      version: '1.0.0',
      itemsCount: opts.vectorStore.count(),
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      model: 'all-MiniLM-L6-v2',
      timestamp: new Date().toISOString(),
    };
  });
}
