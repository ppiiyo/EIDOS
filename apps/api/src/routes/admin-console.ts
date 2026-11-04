import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { RBACManager } from '../services/multi-tenancy';
import { StoreRegistry } from '../services/store-registry';
import { VectorStore } from '../services/vector-store';
import { AdminConsoleStore } from '../services/admin-console-store';
import { ApiQueryCache } from '../services/query-cache';
import { getCache, getSemanticCache } from '../services/cache';

const updateDictionariesSchema = z.object({
  synonyms: z
    .array(
      z.object({
        id: z.string().optional(),
        phrase: z.string().min(1).max(200),
        replacement: z.string().min(1).max(200),
        enabled: z.boolean().optional().default(true),
      })
    )
    .max(500)
    .optional(),
  rewrites: z
    .array(
      z.object({
        id: z.string().optional(),
        from: z.string().min(1).max(200),
        to: z.string().min(1).max(200),
        enabled: z.boolean().optional().default(true),
      })
    )
    .max(500)
    .optional(),
  stopwords: z.array(z.string().min(1).max(80)).max(1000).optional(),
});

const updateRankingDefaultsSchema = z.object({
  simpleCategoryGate: z.enum(['hard', 'soft', 'off']).optional(),
  defaultAlpha: z.number().min(0).max(1).optional(),
  minScore: z.number().min(0).max(1).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
});

const logQueryBodySchema = z.object({
  query: z.string().min(1).max(500),
  normalizedQuery: z.string().max(500).optional(),
  resultCount: z.number().int().min(0).default(0),
  latencyMs: z.number().min(0).default(0),
  cacheHit: z.boolean().optional().default(false),
  headCategoryIntent: z.string().nullable().optional(),
  simpleCategoryGate: z.enum(['hard', 'soft', 'off']).optional().default('hard'),
  alpha: z.number().min(0).max(1).optional().default(0.5),
  top1: z
    .object({
      id: z.string(),
      title: z.string(),
      category: z.string(),
      scorePercent: z.number(),
      score: z.number(),
    })
    .nullable()
    .optional(),
  flags: z
    .object({
      empty: z.boolean(),
      gated: z.boolean().optional().default(false),
      rewritten: z.boolean().optional().default(false),
      fallback_not_applicable: z.boolean().optional().default(false),
    })
    .optional(),
});

const storefrontEventSchema = z.object({
  type: z.enum(['click', 'add_to_cart', 'purchase']),
  searchId: z.string().max(128).optional(),
  query: z.string().max(500).optional(),
  productId: z.string().min(1).max(128),
});

export async function adminConsoleRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore }
): Promise<void> {
  const adminStore = AdminConsoleStore.getInstance();
  const storeRegistry = fastify.storeRegistry || StoreRegistry.getInstance();
  storeRegistry.setDefaultStore(opts.vectorStore);
  const cache = getCache();

  function requireAdminRole(request: FastifyRequest, reply: FastifyReply): boolean {
    const role = RBACManager.resolveRole(request);
    if (!RBACManager.canManageCatalogAndConfig(role)) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Admin Key is required to access EIDOS Admin Console endpoints.',
      });
      return false;
    }
    return true;
  }

  function resolveTenantId(request: FastifyRequest): string {
    try {
      return storeRegistry.resolveRequestStore(request).tenantId || 'default';
    } catch {
      return 'default';
    }
  }

  async function flushSearchCaches(): Promise<void> {
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
    await cache.invalidate('search:*');
  }

  /**
   * POST /v1/admin/queries/log
   * Records a search query log entry.
   */
  fastify.post('/v1/admin/queries/log', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const parsed = logQueryBodySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const tenantId = resolveTenantId(request);
    const data = parsed.data;
    const entry = adminStore.recordQueryLog({
      tenantId,
      indexName: 'default',
      query: data.query,
      normalizedQuery: data.normalizedQuery || data.query,
      resultCount: data.resultCount,
      latencyMs: data.latencyMs,
      cacheHit: data.cacheHit,
      headCategoryIntent: data.headCategoryIntent ?? null,
      simpleCategoryGate: data.simpleCategoryGate,
      alpha: data.alpha,
      top1: data.top1 ?? null,
      flags: data.flags || {
        empty: data.resultCount === 0,
        gated: false,
        rewritten: Boolean(data.normalizedQuery && data.normalizedQuery !== data.query),
        fallback_not_applicable: false,
      },
    });

    return reply.status(201).send({ success: true, entry });
  });

  /**
   * GET /v1/admin/queries
   * Lists query logs with search, emptyOnly, gatedOnly, rewrittenOnly, period, and pagination.
   */
  fastify.get('/v1/admin/queries', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const qParams = (request.query as Record<string, string | undefined>) || {};
    const periodRaw = qParams.period;
    const period: '24h' | '7d' | '30d' =
      periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' ? periodRaw : '30d';

    const result = adminStore.listQueryLogs({
      q: qParams.q,
      emptyOnly: qParams.emptyOnly === 'true' || qParams.empty === 'true',
      gatedOnly: qParams.gatedOnly === 'true',
      rewrittenOnly: qParams.rewrittenOnly === 'true',
      period,
      page: parseInt(qParams.page || '1', 10) || 1,
      limit: parseInt(qParams.limit || '50', 10) || 50,
    });

    return result;
  });

  /**
   * GET /v1/admin/analytics/summary
   * Honest search & click aggregates over 24h / 7d / 30d without fake orders.
   */
  fastify.get(
    '/v1/admin/analytics/summary',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const qParams = (request.query as Record<string, string | undefined>) || {};
      const periodRaw = qParams.period;
      const period: '24h' | '7d' | '30d' =
        periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' ? periodRaw : '7d';

      return adminStore.getAnalyticsSummary({ period });
    }
  );

  /**
   * GET /v1/admin/dictionaries
   */
  fastify.get('/v1/admin/dictionaries', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const tenantId = resolveTenantId(request);
    return adminStore.getDictionaries(tenantId);
  });

  /**
   * PUT /v1/admin/dictionaries
   */
  fastify.put('/v1/admin/dictionaries', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const parsed = updateDictionariesSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const tenantId = resolveTenantId(request);
    const updated = adminStore.updateDictionaries(tenantId, parsed.data);
    await flushSearchCaches();
    return updated;
  });

  /**
   * GET /v1/admin/ranking-defaults
   */
  fastify.get(
    '/v1/admin/ranking-defaults',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const tenantId = resolveTenantId(request);
      return adminStore.getRankingDefaults(tenantId);
    }
  );

  /**
   * PUT /v1/admin/ranking-defaults
   */
  fastify.put(
    '/v1/admin/ranking-defaults',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const parsed = updateRankingDefaultsSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }

      const tenantId = resolveTenantId(request);
      const updated = adminStore.updateRankingDefaults(tenantId, parsed.data);
      await flushSearchCaches();
      return updated;
    }
  );

  /**
   * GET /v1/admin/catalog/summary
   */
  fastify.get(
    '/v1/admin/catalog/summary',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const { store, tenantId, indexName } = storeRegistry.resolveRequestStore(request);
      const allItems = store.getAll();
      const categories: Record<string, number> = {};
      for (const item of allItems) {
        categories[item.category] = (categories[item.category] || 0) + 1;
      }

      return {
        tenantId,
        indexName,
        itemsIndexed: store.count(),
        hnswIndexed: store.getHNSW().size(),
        walPending: store.getWAL().size(),
        categories,
        lastUpsert: adminStore.getLastCatalogUpsert(tenantId),
        syncGuides: {
          bitrix: 'docs/integrations/bitrix.md',
          woocommerce: 'docs/integrations/woocommerce.md',
          csvContract: 'docs/CSV_CONTRACT.md',
          productionRunbook: 'docs/PRODUCTION.md',
        },
      };
    }
  );

  /**
   * POST /v1/events
   * Honest storefront click / add_to_cart / purchase event ingestion (usable by SEARCH_KEY or ADMIN_KEY).
   */
  fastify.post('/v1/events', { preHandler: authenticate }, async (request, reply) => {
    const parsed = storefrontEventSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const tenantId = resolveTenantId(request);
    const ev = adminStore.recordStorefrontEvent({
      tenantId,
      type: parsed.data.type,
      searchId: parsed.data.searchId,
      query: parsed.data.query,
      productId: parsed.data.productId,
    });

    if (fastify.funnelService && parsed.data.type === 'click') {
      fastify.funnelService.addEvent({
        type: 'click',
        query: parsed.data.query,
        itemId: parsed.data.productId,
        sessionId: 'storefront',
      });
    }

    return reply.status(201).send({ success: true, event: ev });
  });
}
