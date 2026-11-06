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
  normalizeQueryWithLayoutRecovery,
  evaluateCandidateGuardrail,
  calibrateScorePercent,
  buildHumanExplanation,
  extractHeadCategoryIntent,
  evaluateCandidateCategoryGate,
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
import { OperationalLogStore, summarizeQueryForLog } from '../services/structured-logger';
import { AdminConsoleStore } from '../services/admin-console-store';
import { DEMO_CATALOG_1000 } from '../demo/demo-catalog-1000';
import { seedDemoAnalyticsIfEmpty } from './demo';

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

const searchWeightsSchema = z
  .object({
    semantic: z.number().min(0).max(10).optional(),
    lexical: z.number().min(0).max(10).optional(),
    dense: z.number().min(0).max(10).optional(),
    sparse: z.number().min(0).max(10).optional(),
  })
  .optional();

const searchRequestSchema = z.object({
  query: z.string().max(500).optional().default(''),
  limit: z.number().int().min(1).max(100).optional(),
  topK: z.number().int().min(1).max(100).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
  minScore: z.number().min(0).max(1).optional(),
  simpleCategoryGate: z.enum(['hard', 'soft', 'off']).optional(),
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
  alpha: z.number().min(0).max(1).optional(),
  weights: searchWeightsSchema,
  rerank: z.boolean().optional().default(false),
  rerankGamma: z.number().min(0).max(1).optional().default(0.65),
  index: z.string().optional(),
  indexName: z.string().optional(),
  sessionId: z.string().optional(),
  cognitiveContext: cognitiveContextSchema,
  responseView: z.enum(['full', 'compact']).optional(),
  failClosed: z.boolean().optional(),
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

  const handleSearch = async (
    request: FastifyRequest,
    reply: FastifyReply,
    routeOpts?: { isSuggest?: boolean }
  ) => {
    const startTime = performance.now();
    const isSuggest = Boolean(routeOpts?.isSuggest);

    return traceSpan('http.request', { route: request.url }, async () => {
      const parseResult = searchRequestSchema.safeParse(request.body || {});
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
        minSimilarity: rawMinSimilarity,
        minScore: rawMinScore,
        simpleCategoryGate: rawSimpleCategoryGate,
        filterCategory,
        filters,
        mode,
        alpha: rawAlpha,
        weights,
        rerank,
        rerankGamma,
        sessionId,
        cognitiveContext,
        responseView: rawResponseView,
        failClosed,
      } = parseResult.data;

      const trimmedQuery = (query || '').trim();
      const graphemeCount = Array.from(trimmedQuery).length;

      // For /v1/search (non-suggest), empty query is 400 Bad Request
      if (!isSuggest && graphemeCount === 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'query: query is required',
        });
      }

      const responseView = isSuggest ? 'compact' : (rawResponseView ?? 'full');
      const limit = isSuggest
        ? Math.min(Math.max(rawLimit ?? topK ?? 6, 1), 8)
        : (rawLimit ?? topK ?? 10);
      const candidateFetchLimit = Math.max(limit, 10);

      const scopedCategory =
        typeof request.apiKeyContext?.allowedFilters?.category === 'string'
          ? request.apiKeyContext.allowedFilters.category
          : undefined;
      const effectiveCategory = scopedCategory ?? filterCategory ?? filters?.category;

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

      // P0-3 Fail-Safe: If index is empty (0 items) in production/fail-closed mode or after explicit clear, return 503 INDEX_EMPTY
      const isFailClosedEmpty =
        !request.demoMode &&
        activeStore.count() === 0 &&
        (activeStore.isExplicitlyCleared() ||
          process.env.EIDOS_FAIL_CLOSED_EMPTY_INDEX === 'true' ||
          request.headers['x-eidos-fail-closed'] === 'true' ||
          failClosed === true);

      if (isFailClosedEmpty) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          code: 'INDEX_EMPTY',
          message:
            'Search index is empty (0 items indexed). Storefront should fallback to native CMS search.',
        });
      }

      // P0-2 Live Suggest: queries < 2 unicode graphemes return 200 with empty results immediately
      if (isSuggest && graphemeCount < 2) {
        return reply.status(200).send({
          query: trimmedQuery,
          normalizedQuery: '',
          originalQuery: query || '',
          rewritten: false,
          rewriteApplied: false,
          count: 0,
          total: 0,
          results: [],
          latencyMs: 0,
          meta: {
            latencyMs: 0,
            queryRaw: query || '',
            normalizedQuery: '',
            rewrites: [],
            headCategoryIntent: null,
          },
        });
      }

      const adminStore = AdminConsoleStore.getInstance();
      const rankingDefaults = adminStore.getRankingDefaults(tenantId);
      const simpleCategoryGate = rawSimpleCategoryGate ?? rankingDefaults.simpleCategoryGate;
      const alpha = rawAlpha ?? rankingDefaults.defaultAlpha;
      const minSimilarity = rawMinSimilarity ?? rankingDefaults.minSimilarity;
      const minScore =
        rawMinScore ?? (rankingDefaults.minScore !== 0.09 ? rankingDefaults.minScore : undefined);

      // Resolve effective alpha and dense/sparse weights from either weights object or alpha/mode
      let appliedAlpha = alpha;
      if (weights) {
        const rawSem = weights.semantic ?? weights.dense ?? alpha;
        const rawLex = weights.lexical ?? weights.sparse ?? 1 - Math.min(1, Math.max(0, rawSem));
        const sumW = rawSem + rawLex;
        appliedAlpha = sumW > 0 ? Number((rawSem / sumW).toFixed(4)) : alpha;
      } else if (mode === 'dense') {
        appliedAlpha = 1;
      } else if (mode === 'sparse') {
        appliedAlpha = 0;
      }
      const denseW = Number((appliedAlpha * 2).toFixed(4));
      const sparseW = Number(((1 - appliedAlpha) * 2).toFixed(4));
      const appliedWeights = {
        semantic: appliedAlpha,
        lexical: Number((1 - appliedAlpha).toFixed(4)),
        denseWeight: denseW,
        sparseWeight: sparseW,
      };

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

      const rawSanitized = securityScan.sanitizedInput;
      const layoutInfo = normalizeQueryWithLayoutRecovery(rawSanitized);
      const layoutQuery = layoutInfo.normalizedQuery || rawSanitized;
      const layoutRewrites: Array<{
        type: 'layout' | 'synonym' | 'rewrite' | 'stopwords';
        from: string;
        to: string;
      }> = [];
      if (
        layoutInfo.layoutRecovered &&
        layoutQuery.trim().toLowerCase() !== rawSanitized.trim().toLowerCase()
      ) {
        layoutRewrites.push({
          type: 'layout',
          from: rawSanitized.trim(),
          to: layoutQuery.trim(),
        });
      }

      const dictPrep = adminStore.preprocessQuery(layoutQuery, tenantId);
      const queryInfo = dictPrep.rewritten
        ? normalizeQueryWithLayoutRecovery(dictPrep.processedQuery)
        : layoutInfo;
      const safeQuery = queryInfo.normalizedQuery || dictPrep.processedQuery || rawSanitized;
      const headIntent = extractHeadCategoryIntent(safeQuery);
      const allRewrites = [...layoutRewrites, ...(dictPrep.rewrites || [])];
      const wasRewritten =
        allRewrites.length > 0 ||
        dictPrep.rewritten ||
        Boolean(layoutInfo.layoutRecovered) ||
        safeQuery.toLowerCase() !== rawSanitized.trim().toLowerCase();

      const formatResultForView = (item: any) => {
        const resolvedUrl = item.url || `/product/${encodeURIComponent(String(item.id))}`;
        if (responseView === 'compact') {
          return {
            id: item.id,
            title: item.title,
            price: item.price,
            category: item.category,
            ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
            url: resolvedUrl,
            score: item.score,
            scorePercent: item.scorePercent,
            humanExplanation: item.humanExplanation,
          };
        }
        return {
          ...item,
          url: resolvedUrl,
        };
      };

      const shouldRecordLog = (isEmptyResult: boolean): boolean => {
        if (!isSuggest) return true;
        if (isEmptyResult) return true;
        const rate = Number(process.env.LOG_SUGGEST_RATE ?? 0.2);
        return Math.random() < Math.max(0, Math.min(1, rate));
      };

      // Record search event in SearchFunnelService singleton decorator
      const resolvedSessionId =
        sessionId ||
        (typeof request.headers['x-session-id'] === 'string'
          ? request.headers['x-session-id']
          : undefined) ||
        'anonymous';
      if (fastify.funnelService && !isSuggest) {
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
      if (minScore !== undefined) normalizedFilters.minScore = minScore;
      if (simpleCategoryGate !== 'hard') normalizedFilters.simpleCategoryGate = simpleCategoryGate;
      if (mode !== 'hybrid') normalizedFilters.mode = mode;
      if (appliedAlpha !== 0.5) normalizedFilters.alpha = appliedAlpha;
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
      const cacheKey = CacheKeys.search(
        safeQuery,
        normalizedFilters,
        candidateFetchLimit,
        cacheNamespace
      );
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
        const rawCachedResults = Array.isArray(cachedResponse.results)
          ? cachedResponse.results.slice(0, limit)
          : [];
        const formattedCachedResults = rawCachedResults.map(formatResultForView);
        const qSummary = summarizeQueryForLog(safeQuery);
        OperationalLogStore.getInstance().record('info', 'search.executed', {
          requestId: request.headers['x-request-id'] as string,
          tenantId,
          indexName,
          keyId: request.apiKeyContext?.keyId,
          latencyMs: hitLatencyMs,
          details: {
            ...qSummary,
            resultCount: formattedCachedResults.length,
            cacheStatus: 'HIT',
            mode,
            source: isSuggest ? 'suggest' : 'full',
          },
        });
        const topCached = formattedCachedResults[0];
        if (shouldRecordLog(formattedCachedResults.length === 0)) {
          try {
            adminStore.recordQueryLog({
              tenantId,
              indexName,
              query: rawSanitized,
              normalizedQuery: safeQuery,
              resultCount: formattedCachedResults.length,
              latencyMs: hitLatencyMs,
              cacheHit: true,
              headCategoryIntent: headIntent.familyKey,
              simpleCategoryGate,
              alpha: appliedAlpha,
              source: isSuggest ? 'suggest' : 'full',
              top1: topCached
                ? {
                    id: String(topCached.id),
                    title: String(topCached.title),
                    category: String(topCached.category),
                    scorePercent: Number(topCached.scorePercent ?? 0),
                    score: Number(topCached.score ?? 0),
                  }
                : null,
              flags: {
                empty: formattedCachedResults.length === 0,
                gated:
                  formattedCachedResults.length === 0 &&
                  Boolean(headIntent.hasHeadCategoryIntent && simpleCategoryGate === 'hard'),
                rewritten: wasRewritten,
                fallback_not_applicable: false,
              },
              appliedDictionaryRules: dictPrep.appliedRules,
            });
          } catch {
            // Non-blocking log
          }
        }
        const { extractedIntent: _cachedIntent, ...restCached } = cachedResponse;
        return {
          ...restCached,
          query: safeQuery,
          normalizedQuery: safeQuery,
          originalQuery: rawSanitized,
          rewritten: wasRewritten,
          rewriteApplied: wasRewritten,
          alpha: appliedAlpha,
          weights: appliedWeights,
          simpleCategoryGate,
          results: formattedCachedResults,
          count: formattedCachedResults.length,
          total: formattedCachedResults.length,
          meta: {
            latencyMs: hitLatencyMs,
            queryRaw: rawSanitized,
            normalizedQuery: safeQuery,
            rewrites: allRewrites,
            headCategoryIntent: headIntent.familyKey,
          },
          ...(isIntentAwareEnabled && extractedIntent ? { extractedIntent } : {}),
          cached: true,
          cacheHit: true,
          cachedAt: cachedResponse.cachedAt || new Date().toISOString(),
          latencyMs: hitLatencyMs,
        };
      }

      const filterKey = JSON.stringify({ normalizedFilters, limit: candidateFetchLimit });

      // 2. Cache miss - check Semantic Query Cache or execute SingleFlight
      let freshResults: Array<{
        id: string;
        title: string;
        description?: string;
        category: string;
        tags?: string[];
        price?: number;
        url?: string;
        imageUrl?: string;
        score: number;
        scorePercent: number;
        humanExplanation: { ru: string; en: string };
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
      const appliedMerchRuleLabels: string[] = [];

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
            const rawSemResults = Array.isArray(semHit.response.results)
              ? semHit.response.results.slice(0, limit)
              : [];
            const formattedSemResults = rawSemResults.map(formatResultForView);
            const topSem = formattedSemResults[0] as Record<string, unknown> | undefined;
            if (shouldRecordLog(formattedSemResults.length === 0)) {
              try {
                adminStore.recordQueryLog({
                  tenantId,
                  indexName,
                  query: rawSanitized,
                  normalizedQuery: safeQuery,
                  resultCount: formattedSemResults.length,
                  latencyMs: semLatencyMs,
                  cacheHit: true,
                  headCategoryIntent: headIntent.familyKey,
                  simpleCategoryGate,
                  alpha: appliedAlpha,
                  source: isSuggest ? 'suggest' : 'full',
                  top1: topSem
                    ? {
                        id: String(topSem.id),
                        title: String(topSem.title),
                        category: String(topSem.category),
                        scorePercent: Number(topSem.scorePercent ?? 0),
                        score: Number(topSem.score ?? 0),
                      }
                    : null,
                  flags: {
                    empty: formattedSemResults.length === 0,
                    gated:
                      formattedSemResults.length === 0 &&
                      Boolean(headIntent.hasHeadCategoryIntent && simpleCategoryGate === 'hard'),
                    rewritten: wasRewritten,
                    fallback_not_applicable: false,
                  },
                  appliedDictionaryRules: dictPrep.appliedRules,
                });
              } catch {
                // Non-blocking log
              }
            }
            const { extractedIntent: _semIntent, ...restSem } = semHit.response;
            return {
              ...restSem,
              alpha: appliedAlpha,
              weights: appliedWeights,
              simpleCategoryGate,
              rewriteApplied: wasRewritten,
              results: formattedSemResults,
              count: formattedSemResults.length,
              total: formattedSemResults.length,
              meta: {
                latencyMs: semLatencyMs,
                queryRaw: rawSanitized,
                normalizedQuery: safeQuery,
                rewrites: allRewrites,
                headCategoryIntent: headIntent.familyKey,
              },
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

            let results: Array<{
              item: any;
              score: number;
              rrfScore?: number;
              source?: string;
              merchBoostDelta?: number;
            }> = [];

            if (mode === 'hybrid') {
              results = await traceSpan(
                'rrf.fusion',
                { mode: 'hybrid', limit: candidateFetchLimit },
                async () =>
                  activeStore.hybridSearch(
                    safeQuery,
                    cleanVector,
                    candidateFetchLimit,
                    denseW,
                    sparseW,
                    effectiveCategory,
                    {
                      simpleCategoryGate,
                      minScore,
                    }
                  )
              );
            } else if (mode === 'dense') {
              results = await traceSpan(
                'hnsw.search',
                { mode: 'dense', limit: candidateFetchLimit },
                async () => {
                  const effectiveMinSim = Math.max(minSimilarity, minScore ?? 0.3);
                  const denseHits = activeStore
                    .search(
                      cleanVector,
                      candidateFetchLimit * 2,
                      effectiveMinSim,
                      undefined,
                      effectiveCategory
                    )
                    .map((r) => ({ ...r, source: 'dense' }));

                  const gated = denseHits.filter((r) => {
                    const g = evaluateCandidateGuardrail(queryInfo, r.item, r.score, 0, false);
                    if (!g.passesLexicalGate && r.score < 0.32) return false;
                    if (simpleCategoryGate === 'hard' && headIntent.hasHeadCategoryIntent) {
                      const cg = evaluateCandidateCategoryGate(headIntent, r.item, 'hard');
                      if (cg.conflictsWithHeadCategory) return false;
                    }
                    return true;
                  });
                  return gated.slice(0, candidateFetchLimit);
                }
              );
            } else {
              results = await traceSpan(
                'bm25.lexical_search',
                { mode: 'sparse', limit: candidateFetchLimit },
                async () => {
                  const out: Array<{ item: any; score: number; source?: string }> = [];
                  const bm25Hits = activeStore.getBM25().search(safeQuery, candidateFetchLimit * 3);
                  for (const hit of bm25Hits) {
                    if (hit.score <= 0) continue;
                    const item = activeStore.get(hit.id);
                    if (!item) continue;
                    if (effectiveCategory && item.category !== effectiveCategory) continue;
                    if (simpleCategoryGate === 'hard' && headIntent.hasHeadCategoryIntent) {
                      const cg = evaluateCandidateCategoryGate(headIntent, item, 'hard');
                      if (cg.conflictsWithHeadCategory) continue;
                    }
                    out.push({ item, score: hit.score, source: 'sparse' });
                    if (out.length >= candidateFetchLimit) break;
                  }
                  return out;
                }
              );
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
                      rrfScore: orig.rrfScore ?? orig.score,
                      source: orig.source ? `${orig.source}+cross_encoder` : 'cross_encoder',
                    };
                  });
                }
              );
            }

            // P1-4 Merchandising Rules (pin / boost / bury) applied after RRF and before final truncate
            const activeMerchRules = adminStore
              .getMerchRules(tenantId)
              .filter((mr) => {
                if (!mr.enabled) return false;
                const pat = mr.queryPattern.trim().toLowerCase();
                return (
                  pat === safeQuery.trim().toLowerCase() ||
                  pat === rawSanitized.trim().toLowerCase()
                );
              });

            if (activeMerchRules.length > 0) {
              for (const rule of activeMerchRules) {
                if (rule.type === 'boost' || rule.type === 'bury') {
                  const weight =
                    rule.weight ?? (rule.type === 'boost' ? 1.35 : 0.25);
                  const target = results.find((r) => String(r.item.id) === String(rule.productId));
                  if (target) {
                    const prevScore = target.score;
                    target.score = Number((prevScore * weight).toFixed(6));
                    target.merchBoostDelta =
                      (target.merchBoostDelta ?? 0) + Number((target.score - prevScore).toFixed(4));
                    appliedMerchRuleLabels.push(`merch:${rule.type}:${rule.productId}`);
                  }
                }
              }

              results.sort((a, b) => b.score - a.score);

              const pinRules = activeMerchRules
                .filter((r) => r.type === 'pin')
                .sort((a, b) => (a.position ?? 1) - (b.position ?? 1));

              for (const pinRule of pinRules) {
                const targetIdx = Math.max(0, Math.min(2, (pinRule.position ?? 1) - 1));
                const existingIdx = results.findIndex(
                  (r) => String(r.item.id) === String(pinRule.productId)
                );
                let pinnedEntry =
                  existingIdx >= 0 ? results.splice(existingIdx, 1)[0] : undefined;
                if (!pinnedEntry) {
                  const storeItem = activeStore.get(pinRule.productId);
                  if (
                    storeItem &&
                    (!effectiveCategory || storeItem.category === effectiveCategory)
                  ) {
                    const topScore = results[0]?.score ?? 0.05;
                    pinnedEntry = {
                      item: storeItem,
                      score: Number((topScore + 0.01).toFixed(6)),
                      rrfScore: topScore,
                      source: 'merch_pin',
                      merchBoostDelta: 0.25,
                    };
                  }
                } else {
                  const topScore = results[0]?.score ?? pinnedEntry.score;
                  pinnedEntry.score = Number((Math.max(pinnedEntry.score, topScore) + 0.005).toFixed(6));
                  pinnedEntry.merchBoostDelta = (pinnedEntry.merchBoostDelta ?? 0) + 0.2;
                }

                if (pinnedEntry) {
                  const insertAt = Math.min(targetIdx, results.length);
                  results.splice(insertAt, 0, pinnedEntry);
                  appliedMerchRuleLabels.push(
                    `merch:pin:${pinRule.productId}@${pinRule.position ?? 1}`
                  );
                }
              }
            }

            const bm25Map = new Map<string, number>();
            if (mode !== 'dense' && appliedAlpha < 1) {
              const bm25Hits = activeStore
                .getBM25()
                .search(safeQuery, Math.max(candidateFetchLimit * 3, 25));
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

            const maxRawScore = results.reduce((max, item) => Math.max(max, item.score), 0);

            return results.map((r, rankIndex) => {
              const itemVec = r.item.normalizedVector || r.item.embedding;
              const rawDense =
                mode === 'sparse' || appliedAlpha === 0 || !itemVec
                  ? 0
                  : Math.max(0, cosineSimilarity(cleanVector, itemVec));
              const denseComponent = Math.round(rawDense * 10000) / 10000;
              const rawSparse =
                mode === 'dense' || appliedAlpha === 1 ? 0 : (bm25Map.get(r.item.id) ?? 0);
              const sparseBm25Component = Math.round(rawSparse * 10000) / 10000;
              const rrfScore = Math.round((r.rrfScore ?? r.score) * 10000) / 10000;

              const guardrail = evaluateCandidateGuardrail(
                queryInfo,
                r.item,
                denseComponent,
                sparseBm25Component,
                true
              );

              // Suppress cross-domain serendipity unless explicitly enabled in cognitiveContext
              const allowSerendipity = Boolean(
                cognitiveContext?.enableSerendipity ||
                  (cognitiveContext?.intentRadar && cognitiveContext.intentRadar.axisDiscovery > 0.35)
              );

              const serendipityEval =
                allowSerendipity && itemVec
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

              const finalScore = cognitiveContext ? kineticMod.adjustedScore : r.score;
              const scorePercent = calibrateScorePercent({
                rawScore: finalScore,
                maxRawScore: Math.max(maxRawScore, finalScore),
                denseScore: denseComponent,
                sparseScore: sparseBm25Component,
                titleMatchCount: guardrail.titleMatchCount,
                categoryOrTagMatchCount: guardrail.categoryOrTagMatchCount,
                rankIndex,
              });
              const humanExplanation = buildHumanExplanation({
                titleMatchCount: guardrail.titleMatchCount,
                categoryOrTagMatchCount: guardrail.categoryOrTagMatchCount,
                matchedTokens: guardrail.matchedTokens,
                matchesHeadCategory: guardrail.headNounMatchCount > 0,
                scorePercent,
                alpha: appliedAlpha,
                denseScore: denseComponent,
                sparseScore: sparseBm25Component,
                category: r.item.category,
                rewrittenFrom: wasRewritten ? rawSanitized.trim() : undefined,
                rewrittenTo: wasRewritten ? safeQuery : undefined,
              });

              const explanation = {
                denseComponent,
                sparseBm25Component,
                rrfScore,
                mmrPenalty: 0,
                businessBoost:
                  Math.round(
                    (kineticMod.kineticBonus +
                      guardrail.consistencyBoost +
                      (r.merchBoostDelta ?? 0)) *
                      10000
                  ) / 10000,
                serendipityScore: serendipityEval?.serendipityScore ?? 0,
                kineticBonus: kineticMod.kineticBonus,
              };

              const resolvedUrl =
                r.item.url || `/product/${encodeURIComponent(String(r.item.id))}`;

              return {
                id: r.item.id,
                title: r.item.title,
                description: r.item.description,
                category: r.item.category,
                tags: r.item.tags,
                price: r.item.price,
                url: resolvedUrl,
                ...(r.item.imageUrl ? { imageUrl: r.item.imageUrl } : {}),
                score: finalScore,
                scorePercent,
                humanExplanation,
                source: r.source,
                isSerendipityDiscovery: serendipityEval?.isSerendipityDiscovery ?? false,
                discoveryReason: serendipityEval?.discoveryReason,
                explanation,
                xray: explanation,
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
      const combinedRules = [...dictPrep.appliedRules, ...appliedMerchRuleLabels];
      const slicedFresh = freshResults.slice(0, limit).map(formatResultForView);

      const fullCachePayload = {
        query: safeQuery,
        normalizedQuery: safeQuery,
        originalQuery: rawSanitized,
        rewritten: wasRewritten,
        rewriteApplied: wasRewritten,
        ...(combinedRules.length > 0 ? { appliedDictionaryRules: combinedRules } : {}),
        mode,
        alpha: appliedAlpha,
        weights: appliedWeights,
        simpleCategoryGate,
        headCategoryIntent: headIntent.familyKey,
        results: freshResults,
        count: freshResults.length,
        total: freshResults.length,
        latencyMs,
        cacheHit: false,
        meta: {
          latencyMs,
          queryRaw: rawSanitized,
          normalizedQuery: safeQuery,
          rewrites: allRewrites,
          headCategoryIntent: headIntent.familyKey,
        },
        ...(isIntentAwareEnabled && extractedIntent ? { extractedIntent } : {}),
        cognitiveDiagnostics: {
          routeDecision,
          kineticProfile,
          chronoProfile,
          serendipityDiscoveriesCount: freshResults.filter((r) => r.isSerendipityDiscovery).length,
        },
      };

      const responsePayload = {
        ...fullCachePayload,
        results: slicedFresh,
        count: slicedFresh.length,
        total: slicedFresh.length,
      };

      const topFresh = slicedFresh[0];
      if (shouldRecordLog(slicedFresh.length === 0)) {
        try {
          adminStore.recordQueryLog({
            tenantId,
            indexName,
            query: rawSanitized,
            normalizedQuery: safeQuery,
            resultCount: slicedFresh.length,
            latencyMs,
            cacheHit: false,
            headCategoryIntent: headIntent.familyKey,
            simpleCategoryGate,
            alpha: appliedAlpha,
            source: isSuggest ? 'suggest' : 'full',
            top1: topFresh
              ? {
                  id: String(topFresh.id),
                  title: String(topFresh.title),
                  category: String(topFresh.category),
                  scorePercent: Number(topFresh.scorePercent ?? 0),
                  score: Number(topFresh.score ?? 0),
                }
              : null,
            flags: {
              empty: slicedFresh.length === 0,
              gated:
                slicedFresh.length === 0 &&
                Boolean(headIntent.hasHeadCategoryIntent && simpleCategoryGate === 'hard'),
              rewritten: wasRewritten,
              fallback_not_applicable: false,
            },
            appliedDictionaryRules: combinedRules,
          });
        } catch {
          // Non-blocking log
        }
      }

      const qSummary = summarizeQueryForLog(safeQuery);
      OperationalLogStore.getInstance().record('info', 'search.executed', {
        requestId: request.headers['x-request-id'] as string,
        tenantId,
        indexName,
        keyId: request.apiKeyContext?.keyId,
        latencyMs,
        details: {
          ...qSummary,
          resultCount: slicedFresh.length,
          cacheStatus: 'MISS',
          mode,
          source: isSuggest ? 'suggest' : 'full',
        },
      });

      // 3. Only cache if key and response are safe (Cache Poisoning Protection)
      if (keySafe && isResponseCacheable(fullCachePayload)) {
        const cacheEntry = { ...fullCachePayload, cachedAt };
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

  const demoSearchPreHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    request.demoMode = true;
    request.demoRateLimit = 60;
    await demoRateLimit(request, reply);
    if (!reply.sent && opts.vectorStore.count() === 0) {
      fastify.storeRegistry?.setDefaultStore(opts.vectorStore);
      await opts.vectorStore.loadDemoCatalog(DEMO_CATALOG_1000, opts.embedder);
      seedDemoAnalyticsIfEmpty(AdminConsoleStore.getInstance());
    }
  };

  fastify.post('/v1/search', { preHandler: authenticate }, (req, reply) =>
    handleSearch(req, reply, { isSuggest: false })
  );
  fastify.post('/v1/suggest', { preHandler: authenticate }, (req, reply) =>
    handleSearch(req, reply, { isSuggest: true })
  );
  fastify.post('/v1/demo/search', { preHandler: demoSearchPreHandler }, (req, reply) =>
    handleSearch(req, reply, { isSuggest: false })
  );
  fastify.post('/v1/demo/suggest', { preHandler: demoSearchPreHandler }, (req, reply) =>
    handleSearch(req, reply, { isSuggest: true })
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


