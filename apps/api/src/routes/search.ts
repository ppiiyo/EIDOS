import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SecurityGuardrails, CircuitBreaker } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { ServerEmbedder } from '../services/embedder';
import { VectorStore } from '../services/vector-store';
import { ApiQueryCache } from '../services/query-cache';
import {
  getCache,
  CacheKeys,
  getSingleFlight,
  isCacheKeySafe,
  isResponseCacheable,
} from '../services/cache';

const searchRequestSchema = z.object({
  query: z.string().min(1, 'query is required').max(500),
  limit: z.number().int().min(1).max(100).default(10),
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
  mode: z.enum(['dense', 'sparse', 'hybrid']).default('hybrid'),
  alpha: z.number().min(0).max(1).default(0.5),
});

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

  const handleSearch = async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = performance.now();

    const parseResult = searchRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { query, limit, minSimilarity, filterCategory, filters, mode, alpha } = parseResult.data;
    const effectiveCategory = filterCategory ?? filters?.category;

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

    // 1. Check Redis Cache first
    const normalizedFilters: Record<string, any> = {
      ...(filters || {}),
    };
    if (effectiveCategory) normalizedFilters.category = effectiveCategory;
    if (minSimilarity !== 0.25) normalizedFilters.minSimilarity = minSimilarity;
    if (mode !== 'hybrid') normalizedFilters.mode = mode;
    if (alpha !== 0.5) normalizedFilters.alpha = alpha;

    const cacheKey = CacheKeys.search(safeQuery, normalizedFilters, limit);
    const keySafe = isCacheKeySafe(cacheKey);
    const l1Cache = ApiQueryCache.getInstance();

    const cachedResponse = keySafe
      ? (await redisCache.get<Record<string, any>>(cacheKey, 'search')) ||
        (l1Cache.get(cacheKey) as Record<string, any> | undefined)
      : undefined;
    ApiQueryCache.syncMetrics();

    if (cachedResponse) {
      reply.header('x-cache', 'HIT');
      return {
        ...cachedResponse,
        cached: true,
        cacheHit: true,
        cachedAt: cachedResponse.cachedAt || new Date().toISOString(),
        latencyMs: Math.round((performance.now() - startTime) * 100) / 100,
      };
    }

    reply.header('x-cache', 'MISS');

    // 2. Cache miss - use SingleFlight to prevent thundering herd
    let freshResults: Array<{
      id: string;
      title: string;
      description?: string;
      category: string;
      tags?: string[];
      price?: number;
      score: number;
      source?: string;
    }>;

    try {
      freshResults = await singleFlight.do(
        cacheKey,
        async () => {
          const queryVector = await embedCircuitBreaker.execute(() =>
            opts.embedder.embed(safeQuery)
          );

          const vectorCheck = SecurityGuardrails.validateVectorBounds(queryVector, 384);
          if (!vectorCheck.isValid) {
            const vecErr = new Error(vectorCheck.error || 'Vector Integrity Error');
            (vecErr as any).statusCode = 400;
            (vecErr as any).errorType = 'Vector Integrity Error';
            throw vecErr;
          }
          const cleanVector = vectorCheck.corrected || queryVector;

          let results: Array<{ item: any; score: number; source?: string }> = [];

          if (mode === 'hybrid') {
            const denseW = alpha * 2;
            const sparseW = (1 - alpha) * 2;
            results = opts.vectorStore.hybridSearch(
              safeQuery,
              cleanVector,
              limit,
              denseW,
              sparseW,
              effectiveCategory
            );
          } else if (mode === 'dense') {
            results = opts.vectorStore
              .search(cleanVector, limit, minSimilarity, undefined, effectiveCategory)
              .map((r) => ({ ...r, source: 'dense' }));
          } else {
            const bm25Hits = opts.vectorStore.getBM25().search(safeQuery, limit * 2);
            for (const hit of bm25Hits) {
              const item = opts.vectorStore.get(hit.id);
              if (!item) continue;
              if (effectiveCategory && item.category !== effectiveCategory) continue;
              results.push({ item, score: hit.score, source: 'sparse' });
              if (results.length >= limit) break;
            }
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

          return results.map((r) => ({
            id: r.item.id,
            title: r.item.title,
            description: r.item.description,
            category: r.item.category,
            tags: r.item.tags,
            price: r.item.price,
            score: r.score,
            source: r.source,
          }));
        },
        10_000
      );
    } catch (err: any) {
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
    const cachedAt = new Date().toISOString();
    const responsePayload = {
      query: safeQuery,
      mode,
      results: freshResults,
      count: freshResults.length,
      latencyMs,
      cacheHit: false,
    };

    // 3. Only cache if key and response are safe (Cache Poisoning Protection)
    if (keySafe && isResponseCacheable(responsePayload)) {
      const cacheEntry = { ...responsePayload, cachedAt };
      await redisCache.set(cacheKey, cacheEntry, 300, 'search');
      l1Cache.set(cacheKey, cacheEntry);
    }

    return responsePayload;
  };

  fastify.post('/v1/search', { preHandler: authenticate }, handleSearch);
  fastify.post('/v1/demo/search', handleSearch);
}


