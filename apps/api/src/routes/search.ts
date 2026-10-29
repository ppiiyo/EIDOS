import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  SecurityGuardrails,
  CircuitBreaker,
  cosineSimilarity,
  AdaptiveQueryRouter,
  KineticAttentionEngine,
  SerendipityOrthogonalEngine,
  ChronoCognitiveEngine,
  ParetoWeightOptimizer,
} from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { demoRateLimit } from '../middleware/rate-limit-demo';
import { ServerEmbedder } from '../services/embedder';
import { VectorStore } from '../services/vector-store';
import { ApiQueryCache } from '../services/query-cache';
import {
  getCache,
  CacheKeys,
  getSingleFlight,
  isCacheKeySafe,
  isResponseCacheable,
  getSemanticCache,
} from '../services/cache';
import { StoreError, StoreRegistry, withTimeout } from '../services/store-registry';
import { NeuralCrossEncoderReranker } from '../services/reranker';
import { intentDictionary } from '../services/intent-dictionary';
import { traceSpan } from '../tracing';
import { recordSearchLatency } from '../plugins/observability';

const cognitiveContextSchema = z
  .object({
    kineticTelemetry: z
      .object({
        scrollVelocityPxPerSec: z.number().min(0).optional(),
        hoverDwellByItemId: z.record(z.string(), z.number()).optional(),
        comparisonAlternations: z.number().min(0).optional(),
        priceHoverCount: z.number().min(0).optional(),
        queryRefinementVelocity: z.number().min(0).optional(),
      })
      .optional(),
    intentRadar: z
      .object({
        axisDiscovery: z.number().min(-1).max(1).default(0),
        axisTier: z.number().min(-1).max(1).default(0),
      })
      .optional(),
    chronoInput: z
      .object({
        localHour: z.number().min(0).max(23).optional(),
        dayOfWeek: z.number().min(0).max(6).optional(),
        sessionDurationSec: z.number().min(0).optional(),
        actionsPerMinute: z.number().min(0).optional(),
      })
      .optional(),
    enableSerendipity: z.boolean().optional(),
  })
  .optional();

const searchRequestSchema = z.object({
  query: z.string().min(1, 'query is required').max(500),
  limit: z.number().int().min(1).max(100).optional(),
  topK: z.number().int().min(1).max(100).optional(),
  minSimilarity: z.number().min(0).max(1).default(0.25),
  filterCategory: z.string().optional(),
  filters: z
    .object({
      category: z.string().optional(),
      min_price: z.number().optional(),
      max_price: z.number().optional(),
    })
    .passthrough()
    .optional(),
  mode: z
    .enum(['dense', 'sparse', 'hybrid', 'semantic'])
    .default('hybrid')
    .transform((m): 'dense' | 'sparse' | 'hybrid' => (m === 'semantic' ? 'dense' : m)),
  alpha: z.number().min(0).max(1).default(0.5),
  rerank: z.boolean().optional().default(false),
  rerankGamma: z.number().min(0).max(1).optional().default(0.65),
  index: z.string().optional(),
  indexName: z.string().optional(),
  sessionId: z.string().optional(),
  cognitiveContext: cognitiveContextSchema,
});

const paretoRequestSchema = z
  .object({
    avgDenseScore: z.number().min(0).max(1).optional(),
    avgBm25Score: z.number().min(0).max(1).optional(),
    categoryEntropyNormalized: z.number().min(0).max(1).optional(),
    explorationTemperature: z.number().min(0).max(1).optional(),
    priceSensitivity: z.number().min(0).max(1).optional(),
  })
  .optional();

const embedCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 15_000,
});

export async function searchRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
  const redisCache = getCache();
  const singleFlight = getSingleFlight();
  const semanticCache = getSemanticCache();
  const storeRegistry = fastify.storeRegistry || StoreRegistry.getInstance();
  storeRegistry.setDefaultStore(opts.vectorStore);
  const reranker = NeuralCrossEncoderReranker.getInstance();

  const handleSearch = async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = performance.now();

    return traceSpan('http.request', { route: request.url }, async () => {
      const parseResult = searchRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }

      const {
        query,
        limit: rawLimit,
        topK,
        minSimilarity,
        filterCategory,
        filters,
        mode,
        alpha,
        rerank,
        rerankGamma,
        sessionId,
        cognitiveContext,
      } = parseResult.data;
      const limit = rawLimit ?? topK ?? 10;
      const effectiveCategory = filterCategory ?? filters?.category;

      let activeStore: VectorStore;
      let tenantId: string;
      let indexName: string;
      try {
        const resolved = storeRegistry.resolveRequestStore(request);
        activeStore = resolved.store;
        tenantId = resolved.tenantId;
        indexName = resolved.indexName;
      } catch (err) {
        if (err instanceof StoreError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        throw err;
      }

      // Security Guardrail: Scan and sanitize user query against prompt injection and XSS
      const securityScan = SecurityGuardrails.scanAndSanitize(query);
      if (!securityScan.isSafe && securityScan.riskScore >= 0.7) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Security Policy Violation',
          message: 'Malicious payload or prompt injection attempt blocked by security guardrails.',
          threats: securityScan.threatsDetected,
        });
      }

      const safeQuery = securityScan.sanitizedInput;

      // Record search event in SearchFunnelService singleton decorator
      const resolvedSessionId =
        sessionId ||
        (typeof request.headers['x-session-id'] === 'string'
          ? request.headers['x-session-id']
          : undefined) ||
        'anonymous';
      if (fastify.funnelService) {
        fastify.funnelService.addEvent({
          type: 'search',
          query: safeQuery,
          sessionId: resolvedSessionId,
        });
      }

      // Feature Flag: Intent-Aware Search (Phase 1)
      const isIntentAwareEnabled = process.env.EIDOS_FEATURE_INTENT_AWARE_SEARCH === 'true';
      const extractedIntent = isIntentAwareEnabled
        ? intentDictionary.extractIntent(safeQuery)
        : undefined;

      // Evaluate Next-Gen Cognitive Engines (Chrono, Kinetic, Adaptive Router)
      const chronoProfile = ChronoCognitiveEngine.evaluate(cognitiveContext?.chronoInput);
      const kineticProfile = KineticAttentionEngine.analyze(cognitiveContext?.kineticTelemetry);
      const routeDecision = AdaptiveQueryRouter.routeQuery(safeQuery, {
        radarDiscoveryAxis: cognitiveContext?.intentRadar?.axisDiscovery,
        explorationTemperature: chronoProfile.explorationTemperature,
      });

      // 1. Check Redis Cache first
      const normalizedFilters: Record<string, any> = {
        ...(filters || {}),
      };
      if (effectiveCategory) normalizedFilters.category = effectiveCategory;
      if (minSimilarity !== 0.25) normalizedFilters.minSimilarity = minSimilarity;
      if (mode !== 'hybrid') normalizedFilters.mode = mode;
      if (alpha !== 0.5) normalizedFilters.alpha = alpha;
      if (tenantId !== 'default') normalizedFilters.tenantId = tenantId;
      if (indexName !== 'default') normalizedFilters.indexName = indexName;
      if (rerank) {
        normalizedFilters.rerank = true;
        normalizedFilters.rerankGamma = rerankGamma;
      }
      if (cognitiveContext) {
        normalizedFilters.cognitiveContext = cognitiveContext;
      }

      const cacheNamespace = `${tenantId}:${indexName}`;
      const cacheKey = CacheKeys.search(safeQuery, normalizedFilters, limit, cacheNamespace);
      const keySafe = isCacheKeySafe(cacheKey);
      const l1Cache = ApiQueryCache.getInstance();

      const cachedResponse = keySafe
        ? await traceSpan('redis.lookup', { key: cacheKey }, async () => {
            return (
              (await redisCache.get<Record<string, any>>(cacheKey, 'search')) ||
              (l1Cache.get(cacheKey) as Record<string, any> | undefined)
            );
          })
        : undefined;
      ApiQueryCache.syncMetrics();

      if (cachedResponse) {
        const hitLatencyMs = Math.round((performance.now() - startTime) * 100) / 100;
        recordSearchLatency(hitLatencyMs, `${mode}_cache_hit`);
        reply.header('x-cache', 'HIT');
        const { extractedIntent: _cachedIntent, ...restCached } = cachedResponse;
        return {
          ...restCached,
          ...(isIntentAwareEnabled && extractedIntent ? { extractedIntent } : {}),
          cached: true,
          cacheHit: true,
          cachedAt: cachedResponse.cachedAt || new Date().toISOString(),
          latencyMs: hitLatencyMs,
        };
      }

      const filterKey = JSON.stringify({ normalizedFilters, limit });

      // 2. Cache miss - check Semantic Query Cache or execute SingleFlight
      let freshResults: Array<{
        id: string;
        title: string;
        description?: string;
        category: string;
        tags?: string[];
        price?: number;
        score: number;
        source?: string;
        isSerendipityDiscovery?: boolean;
        discoveryReason?: string;
        explanation: {
          denseComponent: number;
          sparseBm25Component: number;
          rrfScore: number;
          mmrPenalty: number;
          businessBoost: number;
          serendipityScore?: number;
          kineticBonus?: number;
        };
      }>;
      let queryVectorForSemCache: Float32Array | number[] | null = null;

      try {
        const queryVector = await withTimeout(
          embedCircuitBreaker.execute(() => opts.embedder.embed(safeQuery)),
          5_000,
          'search.embed'
        );
        queryVectorForSemCache = queryVector;

        if (keySafe && !cognitiveContext) {
          const semHit = semanticCache.lookup(queryVector, filterKey);
          if (semHit.hit && semHit.response) {
            const semLatencyMs = Math.round((performance.now() - startTime) * 100) / 100;
            recordSearchLatency(semLatencyMs, `${mode}_semantic_hit`);
            reply.header('x-cache', 'SEMANTIC_HIT');
            const { extractedIntent: _semIntent, ...restSem } = semHit.response;
            return {
              ...restSem,
              ...(isIntentAwareEnabled && extractedIntent ? { extractedIntent } : {}),
              cached: true,
              cacheHit: true,
              semanticSimilarity: Number(semHit.similarity.toFixed(4)),
              matchedQuery: semHit.matchedQuery,
              cachedAt: (semHit.response.cachedAt as string) || new Date().toISOString(),
              latencyMs: semLatencyMs,
            };
          }
        }

        reply.header('x-cache', 'MISS');

        freshResults = await singleFlight.do(
          cacheKey,
          async () => {
            const vectorCheck = SecurityGuardrails.validateVectorBounds(queryVector, 384);
            if (!vectorCheck.isValid) {
              const vecErr = new Error(vectorCheck.error || 'Vector Integrity Error');
              (vecErr as any).statusCode = 400;
              (vecErr as any).errorType = 'Vector Integrity Error';
              throw vecErr;
            }
            let cleanVector: Float32Array | number[] = vectorCheck.corrected || queryVector;

            // Apply 2D Intent Radar vector synthesis if cognitiveContext.intentRadar is active
            if (cognitiveContext?.intentRadar) {
              cleanVector = SerendipityOrthogonalEngine.synthesizeSteeredQueryVector(
                cleanVector,
                cognitiveContext.intentRadar
              );
            }

            let results: Array<{ item: any; score: number; rrfScore?: number; source?: string }> = [];

            if (mode === 'hybrid') {
              const denseW = alpha * 2;
              const sparseW = (1 - alpha) * 2;
              results = await traceSpan('rrf.fusion', { mode: 'hybrid', limit }, async () =>
                activeStore.hybridSearch(
                  safeQuery,
                  cleanVector,
                  limit,
                  denseW,
                  sparseW,
                  effectiveCategory
                )
              );
            } else if (mode === 'dense') {
              results = await traceSpan('hnsw.search', { mode: 'dense', limit }, async () => {
                let denseHits = activeStore
                  .search(cleanVector, limit, minSimilarity, undefined, effectiveCategory)
                  .map((r) => ({ ...r, source: 'dense' }));
                if (denseHits.length === 0 && minSimilarity === 0.25) {
                  denseHits = activeStore
                    .search(cleanVector, limit, 0.0, undefined, effectiveCategory)
                    .map((r) => ({ ...r, source: 'dense' }));
                }
                return denseHits;
              });
            } else {
              results = await traceSpan('bm25.lexical_search', { mode: 'sparse', limit }, async () => {
                const out: Array<{ item: any; score: number; source?: string }> = [];
                const bm25Hits = activeStore.getBM25().search(safeQuery, limit * 2);
                for (const hit of bm25Hits) {
                  const item = activeStore.get(hit.id);
                  if (!item) continue;
                  if (effectiveCategory && item.category !== effectiveCategory) continue;
                  out.push({ item, score: hit.score, source: 'sparse' });
                  if (out.length >= limit) break;
                }
                return out;
              });
            }

            // Apply optional price filters if provided in filters object
            if (filters?.min_price !== undefined || filters?.max_price !== undefined) {
              results = results.filter((r) => {
                if (typeof r.item.price !== 'number') return false;
                if (filters.min_price !== undefined && r.item.price < filters.min_price) return false;
                if (filters.max_price !== undefined && r.item.price > filters.max_price) return false;
                return true;
              });
            }

            // Stage-2 Neural Cross-Encoder Reranking (v3.2) when requested
            if (rerank && results.length > 1) {
              results = await traceSpan(
                'cross_encoder.rerank',
                { count: results.length, gamma: rerankGamma },
                async () => {
                  const reranked = reranker.rerank(
                    safeQuery,
                    cleanVector,
                    results.map((r) => ({
                      id: r.item.id,
                      title: r.item.title,
                      description: r.item.description,
                      category: r.item.category,
                      tags: r.item.tags,
                      vector: r.item.embedding || r.item.vector,
                      rrfScore: r.score,
                    })),
                    rerankGamma
                  );
                  const lookup = new Map(results.map((r) => [r.item.id, r]));
                  return reranked.map((rk) => {
                    const orig = lookup.get(rk.id)!;
                    return {
                      item: orig.item,
                      score: rk.finalScore,
                      rrfScore: orig.score,
                      source: orig.source ? `${orig.source}+cross_encoder` : 'cross_encoder',
                    };
                  });
                }
              );
            }

            const bm25Map = new Map<string, number>();
            if (mode !== 'dense') {
              const bm25Hits = activeStore.getBM25().search(safeQuery, Math.max(limit * 3, 25));
              for (const h of bm25Hits) {
                bm25Map.set(h.id, h.score);
              }
            }

            // Compute Echo-Chamber centroid from top-3 results for Counterfactual Serendipity evaluation
            const topVectors = results
              .slice(0, 3)
              .map((r) => r.item.normalizedVector || r.item.embedding)
              .filter(Boolean);
            const echoCentroid = SerendipityOrthogonalEngine.computeEchoChamberCentroid(topVectors);
            const dominantCategory = results[0]?.item?.category || '';

            const pricedValues = results
              .map((r) => r.item.price)
              .filter((p): p is number => typeof p === 'number' && p > 0)
              .sort((a, b) => a - b);
            const medianPrice =
              pricedValues.length > 0 ? pricedValues[Math.floor(pricedValues.length / 2)] : 0;

            return results.map((r) => {
              const itemVec = r.item.normalizedVector || r.item.embedding;
              const rawDense =
                mode === 'sparse' || !itemVec ? 0 : Math.max(0, cosineSimilarity(cleanVector, itemVec));
              const denseComponent = Math.round(rawDense * 10000) / 10000;
              const rawSparse = mode === 'dense' ? 0 : (bm25Map.get(r.item.id) ?? 0);
              const sparseBm25Component = Math.round(rawSparse * 10000) / 10000;
              const rrfScore = Math.round((r.rrfScore ?? r.score) * 10000) / 10000;

              const serendipityEval = itemVec
                ? SerendipityOrthogonalEngine.evaluateCandidate({
                    id: r.item.id,
                    category: r.item.category,
                    dominantCategory,
                    candidateVec: itemVec,
                    queryVec: cleanVector,
                    echoCentroidVec: echoCentroid,
                  })
                : undefined;

              const kineticMod = KineticAttentionEngine.modulateCandidateScore(
                r.score,
                r.item.price,
                medianPrice,
                kineticProfile
              );

              return {
                id: r.item.id,
                title: r.item.title,
                description: r.item.description,
                category: r.item.category,
                tags: r.item.tags,
                price: r.item.price,
                score: cognitiveContext ? kineticMod.adjustedScore : r.score,
                source: r.source,
                isSerendipityDiscovery: serendipityEval?.isSerendipityDiscovery,
                discoveryReason: serendipityEval?.discoveryReason,
                explanation: {
                  denseComponent,
                  sparseBm25Component,
                  rrfScore,
                  mmrPenalty: 0,
                  businessBoost: kineticMod.kineticBonus,
                  serendipityScore: serendipityEval?.serendipityScore ?? 0,
                  kineticBonus: kineticMod.kineticBonus,
                },
              };
            });
          },
          10_000
        );
      } catch (err: any) {
        if (err instanceof StoreError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        if (err?.statusCode === 400) {
          return reply.status(400).send({
            statusCode: 400,
            error: err.errorType || 'Bad Request',
            message: err.message,
          });
        }
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: `Inference error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      recordSearchLatency(latencyMs, mode);
      const cachedAt = new Date().toISOString();
      const responsePayload = {
        query: safeQuery,
        mode,
        results: freshResults,
        count: freshResults.length,
        latencyMs,
        cacheHit: false,
        ...(isIntentAwareEnabled && extractedIntent ? { extractedIntent } : {}),
        cognitiveDiagnostics: {
          routeDecision,
          kineticProfile,
          chronoProfile,
          serendipityDiscoveriesCount: freshResults.filter((r) => r.isSerendipityDiscovery).length,
        },
      };

      // 3. Only cache if key and response are safe (Cache Poisoning Protection)
      if (keySafe && isResponseCacheable(responsePayload)) {
        const cacheEntry = { ...responsePayload, cachedAt };
        const adaptiveTtl = CacheKeys.getAdaptiveTTL(safeQuery);
        await redisCache.set(cacheKey, cacheEntry, adaptiveTtl, 'search');
        l1Cache.set(cacheKey, cacheEntry);
        if (queryVectorForSemCache && !cognitiveContext) {
          semanticCache.store(safeQuery, queryVectorForSemCache, filterKey, cacheEntry, adaptiveTtl);
        }
      }

      return responsePayload;
    });
  };

  const handleParetoOptimize = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = paretoRequestSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid Pareto optimization parameters',
      });
    }
    return ParetoWeightOptimizer.optimize(parsed.data);
  };

  fastify.post('/v1/search', { preHandler: authenticate }, handleSearch);
  fastify.post(
    '/v1/demo/search',
    {
      preHandler: async (request, reply) => {
        request.demoMode = true;
        request.demoRateLimit = 60;
        await demoRateLimit(request, reply);
      },
    },
    handleSearch
  );

  fastify.post('/v1/optimize/pareto', { preHandler: authenticate }, handleParetoOptimize);
  fastify.post(
    '/v1/demo/optimize/pareto',
    {
      preHandler: async (request, reply) => {
        request.demoMode = true;
        request.demoRateLimit = 60;
        await demoRateLimit(request, reply);
      },
    },
    handleParetoOptimize
  );
}

(searchRoutes as any)[Symbol.for('skip-override')] = true;


