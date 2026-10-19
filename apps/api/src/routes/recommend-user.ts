import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cosineSimilarity } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { VectorStore } from '../services/vector-store';
import { AILManager } from '../services/ail';

const recommendUserSchema = z.object({
  user_id: z.string().min(1),
  history: z.array(z.string()).default([]),
  limit: z.number().int().min(1).max(50).default(10),
  context: z
    .object({
      timestamp: z.number().optional(),
      device: z.enum(['mobile', 'desktop', 'tablet']).optional(),
      sessionId: z.string().optional(),
      hourOfDay: z.number().min(0).max(23).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      language: z.string().optional(),
    })
    .optional(),
});

export async function recommendUserRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore }
): Promise<void> {
  fastify.post('/v1/recommend/user', { preHandler: authenticate }, async (request, reply) => {
    const parseResult = recommendUserSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { user_id, history, limit, context } = parseResult.data;
    const ail = AILManager.getInstance();

    // 1. Fallback when AIL_ENABLED is false
    if (!AILManager.isEnabled()) {
      const fallbackItemId = history.length > 0 ? history[0] : '1';
      const fallbackSource = opts.vectorStore.get(fallbackItemId);
      if (!fallbackSource) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Fallback item '${fallbackItemId}' not found in index.`,
        });
      }

      const results = opts.vectorStore.search(
        fallbackSource.normalizedVector || fallbackSource.embedding,
        limit,
        0.01,
        fallbackItemId
      );

      return {
        user_id,
        fallback: true,
        recommendations: results.map((r) => ({
          id: r.item.id,
          title: r.item.title,
          category: r.item.category,
          score: r.score,
        })),
      };
    }

    // 2. Build user profile with UserTower
    const profile = await ail.userTower.buildProfile(
      user_id,
      history,
      async (itemId) => {
        const item = opts.vectorStore.get(itemId);
        return item ? new Float32Array(item.normalizedVector || item.embedding) : new Float32Array(384);
      },
      (itemId) => opts.vectorStore.get(itemId)?.category || 'General'
    );

    // 3. Retrieval top-100 candidates by user embedding
    const topCandidates = opts.vectorStore.search(profile.embedding, 100, 0.0);

    // Filter out items user already experienced in history
    const historySet = new Set(history);
    const candidateItems = topCandidates.filter((c) => !historySet.has(c.item.id));

    // 4. Extract features and compute Multi-Feature Ranker scores
    const reqContext = context ? { timestamp: context.timestamp ?? Date.now(), ...context } : { timestamp: Date.now() };

    const candidatesWithFeatures = candidateItems.map((c) => {
      const similarity = c.score;
      const popularity = ail.metadataStore.getPopularity(c.item.id);
      const freshness = ail.metadataStore.getFreshness(c.item.id);
      const userAff = cosineSimilarity(profile.embedding, c.item.normalizedVector || c.item.embedding);
      const catCount = profile.categoryDistribution.get(c.item.category) || 0;
      const categoryRepetition = Math.min(1, catCount / Math.max(1, profile.history.length));
      const contextualRelevance = ail.contextSignals.getContextualRelevance(c.item.category, reqContext);
      const kgCentrality = ail.kgEnricher.getCentrality(c.item.id);

      return {
        id: c.item.id,
        item: c.item,
        features: {
          similarity,
          popularity,
          freshness,
          userAffinity: Math.max(0, userAff),
          categoryRepetition,
          contextualRelevance,
          kgCentrality,
        },
      };
    });

    const adjustedWeights = ail.feedbackLoop.getAdjustedWeights();
    const ranked = ail.ranker.rank(
      candidatesWithFeatures.map((c) => ({ id: c.id, features: c.features })),
      adjustedWeights
    );

    // Map ranked items for SMMR
    const candidateMap = new Map(candidatesWithFeatures.map((c) => [c.id, c]));
    const smmrPool = ranked
      .map((r) => {
        const orig = candidateMap.get(r.id);
        if (!orig) return null;
        return {
          id: r.id,
          score: r.score,
          embedding: new Float32Array(orig.item.normalizedVector || orig.item.embedding),
        };
      })
      .filter((x): x is { id: string; score: number; embedding: Float32Array } => x !== null);

    // 5. SMMR diversity re-ranking
    const finalSelected = ail.smmr.rerank(smmrPool, limit);

    return {
      user_id,
      recommendations: finalSelected.map((s) => {
        const itemInfo = candidateMap.get(s.id)?.item;
        return {
          id: s.id,
          title: itemInfo?.title || s.id,
          description: itemInfo?.description,
          category: itemInfo?.category,
          score: Math.round(s.score * 10000) / 10000,
        };
      }),
      debug: {
        totalCandidates: candidateItems.length,
        weights: adjustedWeights,
      },
    };
  });
}
