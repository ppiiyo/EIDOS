import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DEMO_CATALOG } from '../demo/demo-catalog';
import { DEMO_CATALOG_1000 } from '../demo/demo-catalog-1000';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';
import { AdminConsoleStore, getAdminConsoleStore } from '../services/admin-console-store';
import { StoreRegistry } from '../services/store-registry';

const demoLifecycleRequests = new Map<string, { count: number; resetAt: number }>();

export const DEMO_TENANT_ID = 'demo';
export const DEMO_INDEX_NAME = 'demo';

export function getDemoStore(fastify: FastifyInstance): VectorStore {
  const registry = fastify.storeRegistry || StoreRegistry.getInstance();
  return registry.getOrCreateStore(DEMO_TENANT_ID, DEMO_INDEX_NAME);
}

export function seedDemoAnalyticsIfEmpty(adminStore: AdminConsoleStore): void {
  const existing = adminStore.getAnalyticsSummary({ tenantId: DEMO_TENANT_ID, period: '7d' });
  if (existing.totalSearches >= 10) return;

  const sampleQueries = [
    { q: 'недорогие наушники для бега', count: 18, topCat: 'Наушники и аудио', empty: false, gated: false, latency: 2.1 },
    { q: 'детский смартфон до 15000', count: 14, topCat: 'Смартфоны и гаджеты', empty: false, gated: false, latency: 3.2 },
    { q: '5W-40', count: 16, topCat: 'Автотовары и масла', empty: false, gated: false, latency: 1.8 },
    { q: 'yfeiybrb', count: 7, topCat: 'Наушники и аудио', empty: false, gated: false, latency: 2.4, rewritten: true },
    { q: 'беговые кроссовки asics', count: 9, topCat: 'Обувь и кроссовки', empty: false, gated: false, latency: 2.3 },
    { q: 'робот-пылесос с влажной уборкой', count: 8, topCat: 'Бытовая техника', empty: false, gated: false, latency: 3.4 },
    { q: 'моторное масло motul 5w-40', count: 12, topCat: 'Автотовары и масла', empty: false, gated: false, latency: 1.9 },
    { q: 'ноутбук для учебы', count: 6, topCat: 'Ноутбуки и компьютеры', empty: false, gated: false, latency: 2.7 },
    { q: 'детский конструктор lego', count: 7, topCat: 'Детские товары', empty: false, gated: false, latency: 2.2 },
    { q: 'лазерный уровень 3d', count: 5, topCat: 'Инструменты и ремонт', empty: false, gated: false, latency: 2.0 },
    { q: 'Абракадабра', count: 5, topCat: null, empty: true, gated: false, latency: 1.3 },
    { q: 'zzzz_garbage_999', count: 4, topCat: null, empty: true, gated: false, latency: 1.4 },
    { q: 'несуществующая_деталь_abc_123', count: 3, topCat: null, empty: true, gated: false, latency: 1.6 },
  ];

  for (const s of sampleQueries) {
    for (let i = 0; i < s.count; i++) {
      adminStore.recordQueryLog({
        tenantId: DEMO_TENANT_ID,
        indexName: DEMO_INDEX_NAME,
        query: s.q,
        normalizedQuery: s.rewritten ? 'наушники' : s.q,
        resultCount: s.empty ? 0 : 8,
        latencyMs: Math.round((s.latency + (Math.random() * 0.8 - 0.4)) * 10) / 10,
        cacheHit: i > 2,
        headCategoryIntent: s.topCat,
        simpleCategoryGate: 'hard',
        alpha: 0.55,
        top1: s.empty
          ? null
          : {
              id: `top-${s.topCat}-${i}`,
              title: `Топ результат: ${s.q}`,
              category: s.topCat || 'Общее',
              scorePercent: 92,
              score: 0.88,
            },
        flags: {
          empty: s.empty,
          gated: s.gated,
          rewritten: Boolean(s.rewritten),
          fallback_not_applicable: false,
        },
      });
    }
  }

  adminStore.recordStorefrontEvent({
    tenantId: DEMO_TENANT_ID,
    type: 'click',
    query: 'недорогие наушники для бега',
    productId: 'hp-run-1',
  });
  adminStore.recordStorefrontEvent({
    tenantId: DEMO_TENANT_ID,
    type: 'click',
    query: '5W-40',
    productId: 'sku-ecom-104',
  });
  adminStore.recordStorefrontEvent({
    tenantId: DEMO_TENANT_ID,
    type: 'add_to_cart',
    query: 'недорогие наушники для бега',
    productId: 'hp-run-1',
  });
}

export async function demoRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder?: ServerEmbedder }
): Promise<void> {

function assertDemoMutationsAllowed(reply: FastifyReply): boolean {
  const enabled = process.env.EIDOS_ENABLE_DEMO_MUTATIONS;
  const allowed =
    process.env.NODE_ENV === 'production'
      ? enabled === 'true'
      : enabled !== 'false';
  if (!allowed) {
    reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Demo catalog mutations disabled. Set EIDOS_ENABLE_DEMO_MUTATIONS=true to enable.',
    });
    return false;
  }
  return true;
}


  const applyDemoLifecycleRateLimit = async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip || 'unknown';
    const now = Date.now();
    const limit = 20; // Hardened: max 20 lifecycle ops per minute per IP

    if (demoLifecycleRequests.size > 1000) {
      for (const [k, v] of demoLifecycleRequests.entries()) {
        if (v.resetAt < now) {
          demoLifecycleRequests.delete(k);
        }
      }
      if (demoLifecycleRequests.size >= 5000) {
        const oldestKey = demoLifecycleRequests.keys().next().value;
        if (oldestKey) demoLifecycleRequests.delete(oldestKey);
      }
    }

    const existing = demoLifecycleRequests.get(ip);
    if (!existing || existing.resetAt < now) {
      demoLifecycleRequests.set(ip, { count: 1, resetAt: now + 60_000 });
      return;
    }
    if (existing.count >= limit) {
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Demo lifecycle rate limit exceeded.',
      });
    }
    existing.count += 1;
  };

  /**
   * POST /v1/demo/load
   * Loads demo catalog strictly into the isolated `demo:demo` store.
   * NEVER mutates the default production store.
   */
  fastify.post(
    '/v1/demo/load',
    { preHandler: applyDemoLifecycleRateLimit },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!assertDemoMutationsAllowed(reply)) return;
      const demoStore = getDemoStore(fastify);
      if (demoStore.hasProductionCatalogItems()) {
        return reply.status(409).send({ error: 'DEMO_DISABLED_FOR_PRODUCTION_CATALOG' });
      }

      const body = (request.body as { scale?: string | number; size?: string | number }) || {};
      const query = (request.query as { scale?: string | number; size?: string | number }) || {};
      const requestedScale = String(body.scale ?? body.size ?? query.scale ?? query.size ?? '1000');
      const scale = requestedScale === '48' ? '48' : '1000';
      const itemsToLoad = scale === '48' ? DEMO_CATALOG : DEMO_CATALOG_1000;

      await demoStore.loadDemoCatalog(itemsToLoad, opts.embedder);

      const adminStore = getAdminConsoleStore();
      seedDemoAnalyticsIfEmpty(adminStore);

      return {
        ok: true,
        tenantId: DEMO_TENANT_ID,
        indexName: DEMO_INDEX_NAME,
        itemsLoaded: itemsToLoad.length,
        scale,
      };
    }
  );

  /**
   * GET /v1/demo/analytics
   */
  fastify.get('/v1/demo/analytics', async (request: FastifyRequest) => {
    const query = (request.query as { period?: '24h' | '7d' | '30d' }) || {};
    const period = query.period || '7d';
    const adminStore = getAdminConsoleStore();
    seedDemoAnalyticsIfEmpty(adminStore);
    const summary = adminStore.getAnalyticsSummary({ tenantId: DEMO_TENANT_ID, period });
    const defaults = adminStore.getRankingDefaults(DEMO_TENANT_ID);
    return {
      ...summary,
      synthetic: true,
      rankingDefaults: {
        fieldBoosts: defaults.fieldBoosts,
        fieldImportance: defaults.fieldImportance,
        rankWindow: defaults.rankWindow,
        channelWindows: defaults.channelWindows,
        rankConstant: defaults.rankConstant,
        weights: defaults.weights,
        queryShapeBias: defaults.queryShapeBias,
        fusionMode: defaults.fusionMode,
        filterStrictMissing: defaults.filterStrictMissing,
        constraintStrictMissing: defaults.constraintStrictMissing,
        simpleCategoryGate: defaults.simpleCategoryGate,
      },
    };
  });

  /**
   * GET /v1/demo/queries
   */
  fastify.get('/v1/demo/queries', async (request: FastifyRequest) => {
    const query = (request.query as { limit?: string; emptyOnly?: string }) || {};
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const emptyOnly = query.emptyOnly === 'true';
    const adminStore = getAdminConsoleStore();
    seedDemoAnalyticsIfEmpty(adminStore);
    return {
      ...adminStore.listQueryLogs({ tenantId: DEMO_TENANT_ID, limit, emptyOnly }),
      synthetic: true,
    };
  });

  /**
   * POST /v1/demo/reset
   * Resets ONLY the isolated `demo:demo` sandbox store.
   * NEVER clears production items or touches `default:default`.
   */
  fastify.post(
    '/v1/demo/reset',
    { preHandler: applyDemoLifecycleRateLimit },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      if (!assertDemoMutationsAllowed(reply)) return;
      const demoStore = getDemoStore(fastify);
      if (demoStore.hasProductionCatalogItems()) {
        return reply.status(409).send({ error: 'DEMO_DISABLED_FOR_PRODUCTION_CATALOG' });
      }
      await demoStore.clear();
      return reply.status(200).send({
        ok: true,
        tenantId: DEMO_TENANT_ID,
        indexName: DEMO_INDEX_NAME,
      });
    }
  );
}
