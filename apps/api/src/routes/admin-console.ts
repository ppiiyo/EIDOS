import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { normalizeQueryWithLayoutRecovery } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { RBACManager } from '../services/multi-tenancy';
import { StoreRegistry } from '../services/store-registry';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';
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
  synonymGroups: z
    .array(
      z.object({
        id: z.string().optional(),
        enabled: z.boolean().optional().default(true),
        terms: z.array(z.string().min(1).max(200)).min(2).max(50),
        bidirectional: z.literal(true).optional().default(true),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
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

const createSynonymGroupSchema = z.object({
  terms: z.union([
    z.array(z.string().min(1).max(200)).min(2),
    z
      .string()
      .min(3)
      .transform((s) =>
        s
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      ),
  ]),
  enabled: z.boolean().optional().default(true),
});

const patchSynonymGroupSchema = z.object({
  terms: z
    .union([
      z.array(z.string().min(1).max(200)).min(2),
      z
        .string()
        .min(3)
        .transform((s) =>
          s
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        ),
    ])
    .optional(),
  enabled: z.boolean().optional(),
});

const testSynonymQuerySchema = z.object({
  query: z.string().min(1).max(500),
});

const createMerchRuleSchema = z.object({
  enabled: z.boolean().optional().default(true),
  queryPattern: z.string().min(1).max(200),
  type: z.enum(['pin', 'boost', 'bury']),
  productId: z.string().min(1).max(128),
  position: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  weight: z.number().min(0.05).max(10).optional(),
});

const patchMerchRuleSchema = z.object({
  enabled: z.boolean().optional(),
  queryPattern: z.string().min(1).max(200).optional(),
  type: z.enum(['pin', 'boost', 'bury']).optional(),
  productId: z.string().min(1).max(128).optional(),
  position: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  weight: z.number().min(0.05).max(10).optional(),
});

const fieldImportanceSchema = z
  .object({
    title: z.number().min(0).optional(),
    sku: z.number().min(0).optional(),
    brand: z.number().min(0).optional(),
    category: z.number().min(0).optional(),
    description: z.number().min(0).optional(),
  })
  .optional();

const channelWindowsSchema = z
  .object({
    lexical: z.number().int().min(1).max(200).optional(),
    dense: z.number().int().min(1).max(200).optional(),
  })
  .optional();

const updateRankingDefaultsSchema = z.object({
  simpleCategoryGate: z.enum(['hard', 'soft', 'off']).optional(),
  defaultAlpha: z.number().min(0).max(1).optional(),
  minScore: z.number().min(0).max(1).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
  fieldBoosts: fieldImportanceSchema,
  fieldImportance: fieldImportanceSchema,
  rankWindow: channelWindowsSchema,
  channelWindows: channelWindowsSchema,
  rankConstant: z.number().positive().max(10000).optional(),
  weights: z
    .object({
      semantic: z.number().min(0).max(10).optional(),
      lexical: z.number().min(0).max(10).optional(),
    })
    .optional(),
  queryShapeBias: z
    .object({
      enabled: z.boolean().optional(),
    })
    .optional(),
  fusionMode: z.enum(['rrf', 'linear']).optional(),
  filterStrictMissing: z.boolean().optional(),
  constraintStrictMissing: z.boolean().optional(),
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
  opts: { vectorStore: VectorStore; embedder?: ServerEmbedder }
): Promise<void> {
  const adminStore = AdminConsoleStore.getInstance();
  const storeRegistry = fastify.storeRegistry || StoreRegistry.getInstance();
  storeRegistry.setDefaultStore(opts.vectorStore);
  const embedder = opts.embedder || ServerEmbedder.getInstance();
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
      emptyOnly:
        qParams.emptyOnly === 'true' || qParams.empty === 'true' || qParams.filter === 'zero',
      gatedOnly: qParams.gatedOnly === 'true',
      rewrittenOnly: qParams.rewrittenOnly === 'true',
      period,
      page: parseInt(qParams.page || '1', 10) || 1,
      limit: parseInt(qParams.limit || '50', 10) || 50,
    });

    return result;
  });

  /**
   * GET /v1/admin/overview
   * Combined admin console overview (analytics summary + catalog status).
   */
  fastify.get(
    '/v1/admin/overview',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const qParams = (request.query as Record<string, string | undefined>) || {};
      const periodRaw = qParams.period;
      const period: '24h' | '7d' | '30d' =
        periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' ? periodRaw : '7d';
      const { store, tenantId, indexName } = storeRegistry.resolveRequestStore(request);
      return {
        ...adminStore.getAnalyticsSummary({ period }),
        tenantId,
        indexName,
        itemsIndexed: store.count(),
        hnswIndexed: store.getHNSW().size(),
      };
    }
  );

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
   * GET /v1/admin/analytics/queries
   * Filtered analytics query list (?period=7d&filter=zero|all&limit=100)
   */
  fastify.get(
    '/v1/admin/analytics/queries',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const qParams = (request.query as Record<string, string | undefined>) || {};
      const periodRaw = qParams.period;
      const period: '24h' | '7d' | '30d' =
        periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' ? periodRaw : '7d';
      const filter = qParams.filter === 'zero' ? 'zero' : 'all';
      const limit = Math.min(500, Math.max(1, parseInt(qParams.limit || '100', 10) || 100));

      const listed = adminStore.listQueryLogs({
        emptyOnly: filter === 'zero',
        period,
        page: 1,
        limit,
      });

      return {
        period,
        filter,
        items: listed.items,
        total: listed.total,
      };
    }
  );

  /**
   * GET /v1/admin/analytics/export.csv
   * Exports query logs as UTF-8 CSV with BOM for Excel/Sheets compatibility.
   */
  fastify.get(
    '/v1/admin/analytics/export.csv',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const qParams = (request.query as Record<string, string | undefined>) || {};
      const periodRaw = qParams.period;
      const period: '24h' | '7d' | '30d' =
        periodRaw === '24h' || periodRaw === '7d' || periodRaw === '30d' ? periodRaw : '7d';
      const filter = qParams.filter === 'zero' ? 'zero' : 'all';

      const csvContent = adminStore.exportAnalyticsCsv({ period, filter });
      return reply
        .status(200)
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="eidos-analytics-${period}.csv"`)
        .send(csvContent);
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
   * GET /v1/admin/dictionaries/synonyms
   * Lists bidirectional SynonymGroups.
   */
  fastify.get(
    '/v1/admin/dictionaries/synonyms',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const tenantId = resolveTenantId(request);
      const groups = adminStore.getSynonymGroups(tenantId);
      return { groups, items: groups, total: groups.length };
    }
  );

  /**
   * POST /v1/admin/dictionaries/synonyms
   * Creates a new SynonymGroup (terms: string[] or comma-separated string).
   */
  fastify.post(
    '/v1/admin/dictionaries/synonyms',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const parsed = createSynonymGroupSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }
      if (parsed.data.terms.length < 2) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Synonym group must contain at least 2 terms.',
        });
      }

      const tenantId = resolveTenantId(request);
      const group = adminStore.createSynonymGroup(tenantId, {
        terms: parsed.data.terms,
        enabled: parsed.data.enabled,
      });
      await flushSearchCaches();
      const groups = adminStore.getSynonymGroups(tenantId);
      return reply.status(201).send({ group, groups });
    }
  );

  /**
   * PATCH /v1/admin/dictionaries/synonyms/:id
   * Updates an existing SynonymGroup.
   */
  fastify.patch(
    '/v1/admin/dictionaries/synonyms/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const { id } = request.params as { id: string };
      const parsed = patchSynonymGroupSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }

      const tenantId = resolveTenantId(request);
      const group = adminStore.updateSynonymGroup(tenantId, id, parsed.data);
      if (!group) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Synonym group ${id} not found`,
        });
      }
      await flushSearchCaches();
      const groups = adminStore.getSynonymGroups(tenantId);
      return { group, groups };
    }
  );

  /**
   * DELETE /v1/admin/dictionaries/synonyms/:id
   * Deletes a SynonymGroup by ID.
   */
  fastify.delete(
    '/v1/admin/dictionaries/synonyms/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const { id } = request.params as { id: string };
      const tenantId = resolveTenantId(request);
      const deleted = adminStore.deleteSynonymGroup(tenantId, id);
      if (!deleted) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Synonym group ${id} not found`,
        });
      }
      await flushSearchCaches();
      const groups = adminStore.getSynonymGroups(tenantId);
      return { deleted: true, id, groups };
    }
  );

  /**
   * POST /v1/admin/dictionaries/synonyms/test
   * Tests query normalization + synonyms and returns before/after top-3 preview results.
   */
  fastify.post(
    '/v1/admin/dictionaries/synonyms/test',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const parsed = testSynonymQuerySchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }

      const { store, tenantId } = storeRegistry.resolveRequestStore(request);
      const queryRaw = parsed.data.query.trim();
      const layoutInfo = normalizeQueryWithLayoutRecovery(queryRaw);
      const layoutQuery = layoutInfo.normalizedQuery || queryRaw;
      const layoutRewrites: Array<{
        type: 'layout' | 'synonym' | 'rewrite' | 'stopwords';
        from: string;
        to: string;
      }> = [];
      if (
        layoutInfo.layoutRecovered &&
        layoutQuery.trim().toLowerCase() !== queryRaw.toLowerCase()
      ) {
        layoutRewrites.push({
          type: 'layout',
          from: queryRaw,
          to: layoutQuery.trim(),
        });
      }

      const dictPrep = adminStore.preprocessQuery(layoutQuery, tenantId);
      const normalizedQuery = dictPrep.processedQuery || layoutQuery;
      const rewrites = [...layoutRewrites, ...(dictPrep.rewrites || [])];

      const rawVec = await embedder.embed(queryRaw);
      const normVec =
        normalizedQuery.toLowerCase() === queryRaw.toLowerCase()
          ? rawVec
          : await embedder.embed(normalizedQuery);

      const beforeHits = store
        .hybridSearch(queryRaw, rawVec, 3, 1, 1, undefined, { simpleCategoryGate: 'hard' })
        .map((r) => ({
          id: r.item.id,
          title: r.item.title,
          category: r.item.category,
          price: r.item.price,
          score: r.score,
        }));

      const afterHits = store
        .hybridSearch(normalizedQuery, normVec, 3, 1, 1, undefined, {
          simpleCategoryGate: 'hard',
        })
        .map((r) => ({
          id: r.item.id,
          title: r.item.title,
          category: r.item.category,
          price: r.item.price,
          score: r.score,
        }));

      return {
        queryRaw,
        normalizedQuery,
        rewrites,
        beforeResults: beforeHits,
        previewResults: afterHits,
      };
    }
  );

  /**
   * GET /v1/admin/merch/rules
   */
  fastify.get('/v1/admin/merch/rules', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const tenantId = resolveTenantId(request);
    const rules = adminStore.getMerchRules(tenantId);
    return { rules, items: rules, total: rules.length };
  });

  /**
   * POST /v1/admin/merch/rules
   */
  fastify.post('/v1/admin/merch/rules', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const parsed = createMerchRuleSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const tenantId = resolveTenantId(request);
    const rule = adminStore.createMerchRule(tenantId, parsed.data);
    await flushSearchCaches();
    const rules = adminStore.getMerchRules(tenantId);
    return reply.status(201).send({ rule, rules });
  });

  /**
   * PATCH /v1/admin/merch/rules/:id
   */
  fastify.patch(
    '/v1/admin/merch/rules/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const { id } = request.params as { id: string };
      const parsed = patchMerchRuleSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }

      const tenantId = resolveTenantId(request);
      const rule = adminStore.updateMerchRule(tenantId, id, parsed.data);
      if (!rule) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Merch rule ${id} not found`,
        });
      }
      await flushSearchCaches();
      const rules = adminStore.getMerchRules(tenantId);
      return { rule, rules };
    }
  );

  /**
   * DELETE /v1/admin/merch/rules/:id
   */
  fastify.delete(
    '/v1/admin/merch/rules/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const { id } = request.params as { id: string };
      const tenantId = resolveTenantId(request);
      const deleted = adminStore.deleteMerchRule(tenantId, id);
      if (!deleted) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Merch rule ${id} not found`,
        });
      }
      await flushSearchCaches();
      const rules = adminStore.getMerchRules(tenantId);
      return { deleted: true, id, rules };
    }
  );

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
          bitrix: 'connectors/bitrix/eidos.search',
          woocommerce: 'connectors/woocommerce/eidos-search',
          csvContract: 'docs/CSV_CONTRACT.md',
          productionRunbook: 'docs/PILOT.md',
        },
      };
    }
  );

  /**
   * POST /v1/catalog/clear
   * Clears the active tenant store and marks it explicitly cleared so /v1/search returns 503 INDEX_EMPTY.
   */
  fastify.post('/v1/catalog/clear', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const { store } = storeRegistry.resolveRequestStore(request);
    await store.clear();
    await flushSearchCaches();
    return { ok: true, itemsIndexed: store.count() };
  });

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
