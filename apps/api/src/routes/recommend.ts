import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  calculateCategoryEntropy,
  calculateMMRScore,
  Candidate,
  cosineSimilarity,
  SecurityGuardrails,
} from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { VectorStore } from '../services/vector-store';
import { StoredItem } from '../types';
import { AILManager } from '../services/ail';
import { ApiQueryCache } from '../services/query-cache';
import { getCache, CacheKeys, getSingleFlight } from '../services/cache';
import { recordSearchLatency } from '../plugins/observability';

export const recommendSchema = z
  .object({
    item_id: z.string().min(1).optional(),
    itemId: z.string().min(1).optional(),
    user_id: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    history: z.array(z.string()).default([]),
    recentItemIds: z.array(z.string()).optional(),
    strategy: z.enum(['simple', 'adaptive', 'user']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    topK: z.number().int().min(1).max(100).optional(),
    diversity_factor: z.number().min(0).max(1).optional(),
    diversityFactor: z.number().min(0).max(1).optional(),
    minSimilarity: z.number().min(0).max(1).default(0.35),
    excludeIds: z.array(z.string()).optional(),
    filterCategory: z.string().optional(),
    filters: z
      .object({
        category: z.string().optional(),
        min_price: z.number().optional(),
        max_price: z.number().optional(),
        exclude_ids: z.array(z.string()).optional(),
      })
      .optional(),
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
  })
  .transform((data) => {
    const resolvedItemId = data.item_id || data.itemId;
    const resolvedUserId = data.user_id || data.userId;
    const mergedHistory =
      data.history && data.history.length > 0
        ? data.history
        : data.recentItemIds || [];
    const inferredStrategy: 'simple' | 'adaptive' | 'user' =
      data.strategy ?? (!resolvedItemId && (resolvedUserId || mergedHistory.length > 0) ? 'user' : 'adaptive');
    return {
      ...data,
      history: mergedHistory,
      strategy: inferredStrategy,
      limit: data.limit ?? data.topK ?? 10,
    };
  })
  .superRefine((data, ctx) => {
    const resolvedItemId = data.item_id || data.itemId;
    const resolvedUserId = data.user_id || data.userId;

    if (data.strategy === 'user') {
      if (!resolvedUserId && (!data.history || data.history.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'user_id or history required for user strategy',
          path: ['user_id'],
        });
      }
    } else {
      if (!resolvedItemId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'item_id or itemId is required for simple/adaptive strategy',
          path: ['item_id'],
        });
      }
    }
  });

export type UnifiedRecommendInput = z.infer<typeof recommendSchema>;

function matchesFilters(
  item: StoredItem | undefined,
  category?: string,
  minPrice?: number,
  maxPrice?: number,
  excludeSet?: Set<string>
): boolean {
  if (!item) return false;
  if (excludeSet && excludeSet.has(item.id)) return false;
  if (category && item.category !== category) return false;
  if (typeof minPrice === 'number' && (typeof item.price !== 'number' || item.price < minPrice)) {
    return false;
  }
  if (typeof maxPrice === 'number' && (typeof item.price !== 'number' || item.price > maxPrice)) {
    return false;
  }
  return true;
}

export async function simpleRecommend(
  data: UnifiedRecommendInput,
  vectorStore: VectorStore
) {
  const startTime = performance.now();
  const itemId = (data.item_id || data.itemId)!;
  const diversityFactor = data.diversity_factor ?? data.diversityFactor ?? 0.7;
  const category = data.filters?.category ?? data.filterCategory;
  const minPrice = data.filters?.min_price;
  const maxPrice = data.filters?.max_price;
  const excludeSet = new Set([
    ...(data.excludeIds || []),
    ...(data.filters?.exclude_ids || []),
  ]);

  const sourceItem = vectorStore.get(itemId);
  if (!sourceItem) {
    return {
      notFound: true as const,
      message: `Item with id '${itemId}' does not exist in the index.`,
    };
  }

  const rawVec = sourceItem.normalizedVector || sourceItem.embedding;
  const vectorCheck = SecurityGuardrails.validateVectorBounds(rawVec, 384);
  const sourceVec = vectorCheck.isValid ? vectorCheck.corrected || rawVec : rawVec;

  const candidates = vectorStore.search(
    sourceVec,
    Math.min(Math.max(data.limit * 2, 16), 30),
    data.minSimilarity,
    itemId,
    category
  );

  const filteredCandidates = candidates.filter((c) =>
    matchesFilters(c.item, category, minPrice, maxPrice, excludeSet)
  );

  const selected: typeof filteredCandidates = [];
  const pool = [...filteredCandidates];
  const maxSimCache = new Float32Array(pool.length);

  while (selected.length < data.limit && pool.length > 0) {
    let bestScore = -Infinity;
    let bestIndex = -1;

    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      const mmr = calculateMMRScore(candidate.score, maxSimCache[i], diversityFactor);
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      const chosen = pool[bestIndex];
      selected.push(chosen);
      const lastIdx = pool.length - 1;
      pool[bestIndex] = pool[lastIdx];
      maxSimCache[bestIndex] = maxSimCache[lastIdx];
      pool.pop();

      if (selected.length < data.limit) {
        const chosenVec = chosen.item.normalizedVector || chosen.item.embedding;
        for (let i = 0; i < pool.length; i++) {
          const candVec = pool[i].item.normalizedVector || pool[i].item.embedding;
          const sim = cosineSimilarity(candVec, chosenVec);
          if (sim > maxSimCache[i]) {
            maxSimCache[i] = sim;
          }
        }
      }
    } else {
      break;
    }
  }

  const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
  const categories = selected.map((s) => s.item.category);
  const entropy = calculateCategoryEntropy(categories);

  return {
    notFound: false as const,
    payload: {
      strategy: 'simple' as const,
      item_id: itemId,
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
    },
  };
}

export async function adaptiveRecommend(
  data: UnifiedRecommendInput,
  vectorStore: VectorStore,
  ail: AILManager
) {
  const startTime = performance.now();
  const itemId = (data.item_id || data.itemId)!;
  const userId = data.user_id || data.userId;
  const history = data.history || [];
  const category = data.filters?.category ?? data.filterCategory;
  const minPrice = data.filters?.min_price;
  const maxPrice = data.filters?.max_price;
  const excludeSet = new Set([
    ...(data.excludeIds || []),
    ...(data.filters?.exclude_ids || []),
  ]);

  const sourceItem = vectorStore.get(itemId);
  if (!sourceItem) {
    return {
      notFound: true as const,
      message: `Item '${itemId}' not found in catalog.`,
    };
  }

  if (!AILManager.isEnabled()) {
    const results = vectorStore
      .search(
        sourceItem.normalizedVector || sourceItem.embedding,
        data.limit * 2,
        0.01,
        itemId,
        category
      )
      .filter((r) => matchesFilters(r.item, category, minPrice, maxPrice, excludeSet))
      .slice(0, data.limit);

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    const entropy = calculateCategoryEntropy(results.map((r) => r.item.category));

    return {
      notFound: false as const,
      payload: {
        strategy: 'adaptive' as const,
        item_id: itemId,
        sourceItemId: itemId,
        user_id: userId,
        fallback: true,
        recommendations: results.map((r) => ({
          id: r.item.id,
          title: r.item.title,
          description: r.item.description,
          category: r.item.category,
          tags: r.item.tags,
          price: r.item.price,
          score: r.score,
        })),
        latencyMs,
        entropy,
      },
    };
  }

  const itemCandidates = vectorStore
    .search(sourceItem.normalizedVector || sourceItem.embedding, 100, 0.0, itemId, category)
    .filter((c) => matchesFilters(c.item, category, minPrice, maxPrice, excludeSet));

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

  let userEmbedding: Float32Array | null = null;
  if (userId || history.length > 0) {
    const uId = userId || 'anonymous';
    const userProfile = await ail.userTower.buildProfile(
      uId,
      history,
      async (id: string) => {
        const it = vectorStore.get(id);
        return it ? new Float32Array(it.normalizedVector || it.embedding) : new Float32Array(384);
      },
      (id: string) => vectorStore.get(id)?.category || 'General'
    );
    const userVec: Float32Array = userProfile.embedding;
    userEmbedding = userVec;

    const userCandidates = vectorStore
      .search(userVec, 100, 0.0, itemId, category)
      .filter((c) => matchesFilters(c.item, category, minPrice, maxPrice, excludeSet));
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
  const enrichedCandidates = fusedCandidates.map(
    (cand: { id: string; fusedScore: number; embedding: Float32Array }) => {
      const enrichedVec = ail.kgEnricher.enrich(cand.id, cand.embedding, (id: string) => {
        const it = vectorStore.get(id);
        return it ? new Float32Array(it.normalizedVector || it.embedding) : new Float32Array(384);
      });
      return {
        ...cand,
        embedding: enrichedVec,
      };
    }
  );

  const reqContext = data.context
    ? { timestamp: data.context.timestamp ?? Date.now(), ...data.context }
    : { timestamp: Date.now() };

  const candidatesWithFeatures = enrichedCandidates.map(
    (c: { id: string; fusedScore: number; embedding: Float32Array }) => {
      const stored = vectorStore.get(c.id);
    const similarity = stored
      ? cosineSimilarity(sourceItem.normalizedVector || sourceItem.embedding, c.embedding)
      : 0;
    const popularity = ail.metadataStore.getPopularity(c.id);
    const freshness = ail.metadataStore.getFreshness(c.id);
    const userAffinity = userEmbedding
      ? Math.max(0, cosineSimilarity(userEmbedding, c.embedding))
      : 0.5;
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

  const finalSelected = ail.smmr.rerank(smmrPool, data.limit);
  const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
  const selectedCategories = finalSelected
    .map((s: { id: string; score: number }) => candMap.get(s.id)?.stored?.category)
    .filter((c: string | undefined): c is string => Boolean(c));
  const entropy = calculateCategoryEntropy(selectedCategories);

  return {
    notFound: false as const,
    payload: {
      strategy: 'adaptive' as const,
      item_id: itemId,
      sourceItemId: itemId,
      user_id: userId,
      recommendations: finalSelected.map((s: { id: string; score: number }) => {
        const itemInfo = candMap.get(s.id)?.stored;
        return {
          id: s.id,
          title: itemInfo?.title || s.id,
          description: itemInfo?.description,
          category: itemInfo?.category,
          tags: itemInfo?.tags,
          price: itemInfo?.price,
          score: Math.round(s.score * 10000) / 10000,
        };
      }),
      latencyMs,
      entropy,
      debug: {
        totalCandidates: enrichedCandidates.length,
        sources: Array.from(sources.keys()),
        weights: adjustedWeights,
      },
    },
  };
}

export async function userRecommend(
  data: UnifiedRecommendInput,
  vectorStore: VectorStore,
  ail: AILManager
) {
  const startTime = performance.now();
  const userId = (data.user_id || data.userId)!;
  const history = data.history || [];
  const category = data.filters?.category ?? data.filterCategory;
  const minPrice = data.filters?.min_price;
  const maxPrice = data.filters?.max_price;
  const excludeSet = new Set([
    ...history,
    ...(data.excludeIds || []),
    ...(data.filters?.exclude_ids || []),
  ]);

  if (!AILManager.isEnabled()) {
    const rawFallbackId = history.length > 0 ? history[0] : '1';
    const fallbackSource =
      vectorStore.get(rawFallbackId) || vectorStore.get(rawFallbackId.replace(/^item_/, 'item-'));
    if (!fallbackSource) {
      return {
        notFound: true as const,
        message: `Fallback item '${rawFallbackId}' not found in index.`,
      };
    }
    const fallbackItemId = fallbackSource.id;

    const results = vectorStore
      .search(
        fallbackSource.normalizedVector || fallbackSource.embedding,
        data.limit * 2,
        0.01,
        fallbackItemId,
        category
      )
      .filter((r) => matchesFilters(r.item, category, minPrice, maxPrice, excludeSet))
      .slice(0, data.limit);

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    const entropy = calculateCategoryEntropy(results.map((r) => r.item.category));

    return {
      notFound: false as const,
      payload: {
        strategy: 'user' as const,
        user_id: userId,
        fallback: true,
        recommendations: results.map((r) => ({
          id: r.item.id,
          title: r.item.title,
          description: r.item.description,
          category: r.item.category,
          tags: r.item.tags,
          price: r.item.price,
          score: r.score,
        })),
        latencyMs,
        entropy,
      },
    };
  }

  const profile = await ail.userTower.buildProfile(
    userId,
    history,
    async (itemId: string) => {
      const item = vectorStore.get(itemId) || vectorStore.get(itemId.replace(/^item_/, 'item-'));
      return item ? new Float32Array(item.normalizedVector || item.embedding) : new Float32Array(384);
    },
    (itemId: string) =>
      (vectorStore.get(itemId) || vectorStore.get(itemId.replace(/^item_/, 'item-')))?.category || 'General'
  );

  const topCandidates = vectorStore.search(profile.embedding, 100, 0.0, undefined, category);
  const candidateItems = topCandidates.filter((c) =>
    matchesFilters(c.item, category, minPrice, maxPrice, excludeSet)
  );

  const reqContext = data.context
    ? { timestamp: data.context.timestamp ?? Date.now(), ...data.context }
    : { timestamp: Date.now() };

  const candidatesWithFeatures = candidateItems.map((c) => {
    const similarity = c.score;
    const popularity = ail.metadataStore.getPopularity(c.item.id);
    const freshness = ail.metadataStore.getFreshness(c.item.id);
    const userAff = cosineSimilarity(
      profile.embedding,
      c.item.normalizedVector || c.item.embedding
    );
    const catCount = profile.categoryDistribution.get(c.item.category) || 0;
    const categoryRepetition = Math.min(1, catCount / Math.max(1, profile.history.length));
    const contextualRelevance = ail.contextSignals.getContextualRelevance(
      c.item.category,
      reqContext
    );
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

  const candidateMap = new Map(candidatesWithFeatures.map((c) => [c.id, c]));
  const smmrPool = ranked
    .map((r: { id: string; score: number }) => {
      const orig = candidateMap.get(r.id);
      if (!orig) return null;
      return {
        id: r.id,
        score: r.score,
        embedding: new Float32Array(orig.item.normalizedVector || orig.item.embedding),
      };
    })
    .filter((x: { id: string; score: number; embedding: Float32Array } | null): x is { id: string; score: number; embedding: Float32Array } => x !== null);

  const finalSelected = ail.smmr.rerank(smmrPool, data.limit);
  const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
  const selectedCategories = finalSelected
    .map((s: { id: string; score: number }) => candidateMap.get(s.id)?.item.category)
    .filter((c: string | undefined): c is string => Boolean(c));
  const entropy = calculateCategoryEntropy(selectedCategories);

  return {
    notFound: false as const,
    payload: {
      strategy: 'user' as const,
      user_id: userId,
      recommendations: finalSelected.map((s: { id: string; score: number }) => {
        const itemInfo = candidateMap.get(s.id)?.item;
        return {
          id: s.id,
          title: itemInfo?.title || s.id,
          description: itemInfo?.description,
          category: itemInfo?.category,
          tags: itemInfo?.tags,
          price: itemInfo?.price,
          score: Math.round(s.score * 10000) / 10000,
        };
      }),
      latencyMs,
      entropy,
      debug: {
        totalCandidates: candidateItems.length,
        weights: adjustedWeights,
      },
    },
  };
}

export async function recommendRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore }
): Promise<void> {
  const redisCache = getCache();
  const singleFlight = getSingleFlight();

  const handleRecommend = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = recommendSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      });
    }

    const data = parseResult.data;
    const ail = AILManager.getInstance();

    // Only cache if no dynamic filters (like exclude_ids)
    const hasDynamicExclusions = Boolean(
      (data.filters?.exclude_ids && data.filters.exclude_ids.length > 0) ||
        (data.excludeIds && data.excludeIds.length > 0)
    );

    const resolvedItemId = data.item_id || data.itemId || '';
    const resolvedUserId = data.user_id || data.userId || '';
    const extraCacheParams: Record<string, any> = {};
    if (data.filters?.category || data.filterCategory) {
      extraCacheParams.category = data.filters?.category ?? data.filterCategory;
    }
    if (data.filters?.min_price !== undefined) extraCacheParams.minPrice = data.filters.min_price;
    if (data.filters?.max_price !== undefined) extraCacheParams.maxPrice = data.filters.max_price;
    if (data.diversity_factor !== undefined || data.diversityFactor !== undefined) {
      extraCacheParams.diversity = data.diversity_factor ?? data.diversityFactor;
    }
    if (data.minSimilarity !== 0.35) extraCacheParams.minSimilarity = data.minSimilarity;
    if (resolvedUserId && data.strategy !== 'user') extraCacheParams.userId = resolvedUserId;
    if (data.history && data.history.length > 0 && !data.recentItemIds) {
      extraCacheParams.history = data.history;
    }
    if (!AILManager.isEnabled() && data.strategy !== 'simple') extraCacheParams.ailDisabled = true;

    const cacheKey =
      data.strategy === 'user'
        ? CacheKeys.userRecommend(
            `${resolvedUserId}${Object.keys(extraCacheParams).length ? ':' + JSON.stringify(extraCacheParams) : ''}`,
            data.limit
          )
        : CacheKeys.recommend(
            resolvedItemId,
            data.strategy,
            data.limit,
            Object.keys(extraCacheParams).length > 0 ? extraCacheParams : undefined
          );

    const l1Cache = ApiQueryCache.getInstance();

    if (!hasDynamicExclusions) {
      const cached =
        (await redisCache.get<Record<string, any>>(cacheKey, 'recommend')) ||
        (l1Cache.get(cacheKey) as Record<string, any> | undefined);
      ApiQueryCache.syncMetrics();

      if (cached) {
        reply.header('x-cache', 'HIT');
        return {
          ...cached,
          cached: true,
          cacheHit: true,
          cachedAt: cached.cachedAt || new Date().toISOString(),
        };
      }
    }

    reply.header('x-cache', 'MISS');

    const computeRecommendation = async () => {
      switch (data.strategy) {
        case 'simple':
          return await simpleRecommend(data, opts.vectorStore);
        case 'adaptive':
          return await adaptiveRecommend(data, opts.vectorStore, ail);
        case 'user':
          return await userRecommend(data, opts.vectorStore, ail);
      }
    };

    const result = !hasDynamicExclusions
      ? await singleFlight.do(cacheKey, computeRecommendation, 10_000)
      : await computeRecommendation();

    if (result.notFound) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: result.message,
      });
    }

    const responsePayload = {
      ...result.payload,
      cacheHit: false,
    };

    recordSearchLatency(result.payload.latencyMs, `recommend_${data.strategy}`);

    // Store in Redis cache (10 minutes TTL = 600s) if no dynamic filters
    if (!hasDynamicExclusions) {
      const cacheEntry = {
        ...responsePayload,
        cachedAt: new Date().toISOString(),
      };
      await redisCache.set(cacheKey, cacheEntry, 600, 'recommend');
      l1Cache.set(cacheKey, cacheEntry);
    }

    return responsePayload;
  };

  fastify.post('/v1/recommend', { preHandler: authenticate }, handleRecommend);
  fastify.post('/v1/demo/recommend', handleRecommend);
}

