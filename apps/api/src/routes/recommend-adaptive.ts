import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Candidate, cosineSimilarity } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { VectorStore } from '../services/vector-store';
import { AILManager } from '../services/ail';
import { StoreError, StoreRegistry } from '../services/store-registry';

const recommendAdaptiveSchema = z.object({
  item_id: z.string().min(1),
  user_id: z.string().optional(),
  history: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  index: z.string().optional(),
  indexName: z.string().optional(),
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

export async function recommendAdaptiveRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore }
): Promise<void> {
  const storeRegistry = fastify.storeRegistry || StoreRegistry.getInstance();
  storeRegistry.setDefaultStore(opts.vectorStore);

  fastify.post('/v1/recommend/adaptive', { preHandler: authenticate }, async (request, reply) => {
    reply.header('Deprecation', 'true');
    reply.header('Link', '</v1/recommend>; rel="successor-version"');
    const parseResult = recommendAdaptiveSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    let activeStore: VectorStore;
    try {
      activeStore = storeRegistry.resolveRequestStore(request).store;
    } catch (err) {
      if (err instanceof StoreError) {
        return reply.status(err.statusCode).send(err.toJSON());
      }
      throw err;
    }

    const { item_id, user_id, history = [], limit, context } = parseResult.data;
    const sourceItem = activeStore.get(item_id);

    if (!sourceItem) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Item '${item_id}' not found in catalog.`,
      });
    }

    const ail = AILManager.getInstance();

    // 1. Fallback when AIL_ENABLED is false
    if (!AILManager.isEnabled()) {
      const results = activeStore.search(
        sourceItem.normalizedVector || sourceItem.embedding,
        limit,
        0.01,
        item_id
      );

      return {
        item_id,
        fallback: true,
        recommendations: results.map((r) => ({
          id: r.item.id,
          title: r.item.title,
          category: r.item.category,
          score: r.score,
        })),
      };
    }

    // 2. Retrieval by item_id (top-100)
    const itemCandidates = activeStore.search(
      sourceItem.normalizedVector || sourceItem.embedding,
      100,
      0.0,
      item_id
    );

    const sources = new Map<string, Candidate[]>();
    sources.set(
      'similarity',
      itemCandidates.map((c) => ({
        id: c.item.id,
        source: 'similarity',
        rawScore: c.score,
        embedding: new Float32Array(c.item.normalizedVector || c.item.embedding),
      }))
    );

    // 3. User Tower & Candidate Fusion if user_id / history provided
    let userEmbedding: Float32Array | null = null;
    if (user_id || history.length > 0) {
      const uId = user_id || 'anonymous';
      const userProfile = await ail.userTower.buildProfile(
        uId,
        history,
        async (id: string) => {
          const it = activeStore.get(id);
          return it ? new Float32Array(it.normalizedVector || it.embedding) : new Float32Array(384);
        },
        (id: string) => activeStore.get(id)?.category || 'General'
      );
      const userVec: Float32Array = userProfile.embedding;
      userEmbedding = userVec;

      const userCandidates = activeStore.search(userVec, 100, 0.0, item_id);
      sources.set(
        'user_affinity',
        userCandidates.map((c) => ({
          id: c.item.id,
          source: 'user_affinity',
          rawScore: c.score,
          embedding: new Float32Array(c.item.normalizedVector || c.item.embedding),
        }))
      );
    }

    const fusedCandidates = ail.candidateFusion.fuse(sources, 100);

    // 4. KG Enrichment on candidate embeddings
    const enrichedCandidates = fusedCandidates.map(
      (cand: { id: string; fusedScore: number; embedding: Float32Array }) => {
        const enrichedVec = ail.kgEnricher.enrich(
          cand.id,
          cand.embedding,
          (id: string) => {
            const it = activeStore.get(id);
            return it ? new Float32Array(it.normalizedVector || it.embedding) : new Float32Array(384);
          }
        );
        return {
          ...cand,
          embedding: enrichedVec,
        };
      }
    );

    // 5. Multi-Feature Ranking
    const reqContext = context ? { timestamp: context.timestamp ?? Date.now(), ...context } : { timestamp: Date.now() };

    const candidatesWithFeatures = enrichedCandidates.map(
      (c: { id: string; fusedScore: number; embedding: Float32Array }) => {
        const stored = activeStore.get(c.id);
      const similarity = stored
        ? cosineSimilarity(sourceItem.normalizedVector || sourceItem.embedding, c.embedding)
        : 0;
      const popularity = ail.metadataStore.getPopularity(c.id);
      const freshness = ail.metadataStore.getFreshness(c.id);
      const userAffinity = userEmbedding ? Math.max(0, cosineSimilarity(userEmbedding, c.embedding)) : 0.5;
      const categoryRepetition = stored && stored.category === sourceItem.category ? 0.3 : 0.0;
      const contextualRelevance = stored
        ? ail.contextSignals.getContextualRelevance(stored.category, reqContext)
        : 0.5;
      const kgCentrality = ail.kgEnricher.getCentrality(c.id);

      return {
        id: c.id,
        embedding: c.embedding,
        stored,
        features: {
          similarity: Math.max(0, similarity),
          popularity,
          freshness,
          userAffinity,
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

    const candMap = new Map(candidatesWithFeatures.map((c) => [c.id, c]));
    const smmrPool = ranked
      .map((r: { id: string; score: number }) => {
        const item = candMap.get(r.id);
        if (!item) return null;
        return {
          id: r.id,
          score: r.score,
          embedding: item.embedding,
        };
      })
      .filter((x: { id: string; score: number; embedding: Float32Array } | null): x is { id: string; score: number; embedding: Float32Array } => x !== null);

    // 6. SMMR diversity re-ranking
    const finalSelected = ail.smmr.rerank(smmrPool, limit);

    return {
      item_id,
      user_id,
      recommendations: finalSelected.map((s: { id: string; score: number }) => {
        const itemInfo = candMap.get(s.id)?.stored;
        return {
          id: s.id,
          title: itemInfo?.title || s.id,
          description: itemInfo?.description,
          category: itemInfo?.category,
          score: Math.round(s.score * 10000) / 10000,
        };
      }),
      debug: {
        totalCandidates: enrichedCandidates.length,
        sources: Array.from(sources.keys()),
        weights: adjustedWeights,
      },
    };
  });
}
