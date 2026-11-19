import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AdaptiveIntelligenceLayer } from '@eidos/core';
import { Metrics } from '@eidos/core';
import type { VectorStore } from '../services/vector-store.js';

const bodySchema = z.object({
  user_id: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  exclude: z.array(z.string()).optional(),
});

export const recommendUserRoutes: FastifyPluginAsync<{ store: VectorStore }> = async (app, opts) => {
  const { store } = opts;

  app.post('/v1/recommend/user', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
    }

    const { user_id, limit, exclude } = parsed.data;
    const start = performance.now();

    try {
      const profile = await store.getUserProfile?.(user_id);
      if (!profile || !profile.embedding) {
        return reply.code(404).send({ error: 'user_not_found', user_id });
      }

      const ail = new AdaptiveIntelligenceLayer();
      const queryVec = new Float32Array(profile.embedding);

      // Candidate generation via ANN
      const candidates = store.searchHnsw(queryVec, Math.max(limit * 8, 40));
      const excludeSet = new Set(exclude || []);

      const candidatesWithFeatures = candidates
        .filter((c) => !excludeSet.has(c.id))
        .map((c) => {
          const item = store.getItem(c.id);
          return item
            ? {
                id: c.id,
                score: c.score,
                item,
              }
            : null;
        })
        .filter((x): x is NonNullable<typeof x> => x != null);

      // Rank with adaptive weights
      const ranked = ail.rank(
        candidatesWithFeatures.map((c) => ({
          id: c.id,
          score: c.score,
          embedding: new Float32Array(c.item.normalizedVector || c.item.embedding),
        })),
        {
          queryEmbedding: queryVec,
          limit: limit * 3,
        }
      );

      // Map ranked items for SMMR
      const candidateMap = new Map(candidatesWithFeatures.map((c) => [c.id, c]));
      type SmmrItem = { id: string; score: number; embedding: Float32Array };
      const smmrPool: SmmrItem[] = [];
      for (const r of ranked as Array<{ id: string; score: number }>) {
        const orig = candidateMap.get(r.id);
        if (!orig) continue;
        smmrPool.push({
          id: r.id,
          score: r.score,
          embedding: new Float32Array(orig.item.normalizedVector || orig.item.embedding),
        });
      }

      // 5. SMMR diversity re-ranking
      const finalSelected = ail.smmr.rerank(smmrPool, limit);

      return {
        user_id,
        recommendations: finalSelected.map((s: { id: string; score: number }) => {
          const itemInfo = candidateMap.get(s.id)?.item;
          return {
            id: s.id,
            title: itemInfo?.title || s.id,
            score: s.score,
            category: itemInfo?.category,
            price: itemInfo?.price,
            url: itemInfo?.url,
            imageUrl: itemInfo?.imageUrl,
          };
        }),
        latencyMs: Math.round((performance.now() - start) * 100) / 100,
      };
    } catch (err) {
      Metrics.inc('recommend_user_errors');
      request.log.error({ err }, 'recommend/user failed');
      return reply.code(500).send({ error: 'recommend_failed' });
    }
  });
};
