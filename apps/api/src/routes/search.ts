import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { ServerEmbedder } from '../services/embedder';
import { VectorStore } from '../services/vector-store';

const searchRequestSchema = z.object({
  query: z.string().min(1, 'query is required').max(500),
  limit: z.number().int().min(1).max(50).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.25),
  filterCategory: z.string().optional(),
});

export async function searchRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
  fastify.post('/v1/search', { preHandler: authenticate }, async (request, reply) => {
    const startTime = performance.now();

    const parseResult = searchRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { query, limit, minSimilarity, filterCategory } = parseResult.data;

    let queryVector: Float32Array;
    try {
      queryVector = await opts.embedder.embed(query);
    } catch (err) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: `Inference error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    const results = opts.vectorStore.search(
      queryVector,
      limit,
      minSimilarity,
      undefined,
      filterCategory
    );

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      query,
      results: results.map((r) => ({
        id: r.item.id,
        title: r.item.title,
        description: r.item.description,
        category: r.item.category,
        tags: r.item.tags,
        price: r.item.price,
        score: r.score,
      })),
      latencyMs,
    };
  });
}
