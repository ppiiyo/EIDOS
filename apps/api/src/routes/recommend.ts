import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { calculateCategoryEntropy, calculateMMRScore, cosineSimilarity } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { VectorStore } from '../services/vector-store';

const recommendRequestSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  limit: z.number().int().min(1).max(50).default(5),
  minSimilarity: z.number().min(0).max(1).default(0.35),
  diversityFactor: z.number().min(0).max(1).default(0.7),
  excludeIds: z.array(z.string()).optional(),
  filterCategory: z.string().optional(),
});

export async function recommendRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore }
): Promise<void> {
  fastify.post('/v1/recommend', { preHandler: authenticate }, async (request, reply) => {
    const startTime = performance.now();

    const parseResult = recommendRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { itemId, limit, minSimilarity, diversityFactor, excludeIds = [], filterCategory } =
      parseResult.data;

    const sourceItem = opts.vectorStore.get(itemId);
    if (!sourceItem) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Item with id '${itemId}' does not exist in the index.`,
      });
    }

    // Step 1: Candidate retrieval via Cosine scan
    const candidates = opts.vectorStore.search(
      sourceItem.normalizedVector || sourceItem.embedding,
      Math.max(limit * 3, 20),
      minSimilarity,
      itemId,
      filterCategory
    );

    const filteredCandidates = candidates.filter((c) => !excludeIds.includes(c.item.id));

    // Step 2: MMR Diversity Re-ranking
    const selected: typeof filteredCandidates = [];
    const pool = [...filteredCandidates];

    while (selected.length < limit && pool.length > 0) {
      let bestScore = -Infinity;
      let bestIndex = -1;

      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[i];
        let maxSimToSelected = 0;

        for (const s of selected) {
          const sim = cosineSimilarity(
            candidate.item.normalizedVector || candidate.item.embedding,
            s.item.normalizedVector || s.item.embedding
          );
          if (sim > maxSimToSelected) maxSimToSelected = sim;
        }

        const mmr = calculateMMRScore(candidate.score, maxSimToSelected, diversityFactor);
        if (mmr > bestScore) {
          bestScore = mmr;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        selected.push(pool[bestIndex]);
        pool.splice(bestIndex, 1);
      } else {
        break;
      }
    }

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    const categories = selected.map((s) => s.item.category);
    const entropy = calculateCategoryEntropy(categories);

    return {
      sourceItemId: itemId,
      recommendations: selected.map((s) => ({
        id: s.item.id,
        title: s.item.title,
        description: s.item.description,
        category: s.item.category,
        tags: s.item.tags,
        price: s.item.price,
        score: s.score,
      })),
      latencyMs,
      entropy,
    };
  });
}
