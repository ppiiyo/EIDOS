import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Metrics } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { ServerEmbedder } from '../services/embedder';
import { VectorStore } from '../services/vector-store';
import { AILManager } from '../services/ail';
import { ApiQueryCache } from '../services/query-cache';
import { getCache, CacheKeys, getSemanticCache } from '../services/cache';
import { TenantNamespaceManager, RBACManager, AuditLogger } from '../services/multi-tenancy';
import { getAverageSearchLatencyMs } from '../plugins/observability';

export const upsertItemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  category: z.string().max(100).optional().default('General'),
  tags: z.array(z.string()).max(20).optional().default([]),
  price: z.number().nonnegative().optional().default(0),
  inStock: z.boolean().optional().default(true),
  url: z.string().optional(),
  embedding: z.array(z.number()).length(384).optional(),
});

const catalogItemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  category: z.string().max(100).optional().default('General'),
  tags: z.array(z.string()).default([]),
  price: z.number().nonnegative().optional().default(0),
  inStock: z.boolean().optional().default(true),
  url: z.string().optional(),
  embedding: z.array(z.number()).optional(),
});

const ingestPayloadSchema = z.object({
  items: z.array(catalogItemSchema).min(1).max(500),
});

export async function catalogRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
  const cache = getCache();
  const semanticCache = getSemanticCache();
  const tenantManager = TenantNamespaceManager.getInstance();

  function resolveStore(request: any): { store: VectorStore; tenantId: string } {
    const tenantId = tenantManager.resolveTenantId(request);
    const store = tenantId === 'default' ? opts.vectorStore : tenantManager.getStore(tenantId);
    return { store, tenantId };
  }

  async function invalidateCatalogCaches(): Promise<void> {
    ApiQueryCache.invalidateAll();
    semanticCache.clear();
    await Promise.all([
      cache.invalidate('search:*'),
      cache.invalidate('recommend:*'),
      cache.del(CacheKeys.catalogStats()),
    ]);
  }

  /**
   * Catalog statistics & diagnostics endpoint.
   */
  fastify.get('/v1/catalog/stats', async (request) => {
    const { store } = resolveStore(request);
    const allItems = store.getAll();
    const categories: Record<string, number> = {};
    for (const item of allItems) {
      categories[item.category] = (categories[item.category] || 0) + 1;
    }

    const redisStats = await cache.getStats();
    const itemCount = store.count();

    return {
      itemsIndexed: itemCount,
      totalItems: itemCount,
      vectorDimension: 384,
      hnswIndexed: store.getHNSW().size(),
      walPending: store.getWAL().size(),
      avgSearchLatencyMs: getAverageSearchLatencyMs(),
      categories,
      cache: {
        type: redisStats.type || 'in-memory',
        ...ApiQueryCache.getInstance().stats(),
        redis: redisStats,
      },
    };
  });

  /**
   * Single item or batch ({"items": [...]}) upsert with strict Zod validation schema.
   */
  fastify.post('/v1/catalog/upsert', { preHandler: authenticate }, async (request, reply) => {
    try {
      const role = RBACManager.resolveRole(request);
      if (!RBACManager.hasPermission(role, 'write')) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `Role '${role}' is not permitted to perform catalog mutations`,
        });
      }

      const { store, tenantId } = resolveStore(request);
      const rawBody = request.body as Record<string, unknown> | null;

      // Batch mode: {"items": [...]}
      if (rawBody && typeof rawBody === 'object' && 'items' in rawBody && Array.isArray(rawBody.items)) {
        const rawItems = rawBody.items as unknown[];
        const validItems: Array<z.infer<typeof upsertItemSchema>> = [];
        const errors: string[] = [];
        let failed = 0;

        for (let idx = 0; idx < rawItems.length; idx++) {
          const parsed = upsertItemSchema.safeParse(rawItems[idx]);
          if (parsed.success) {
            validItems.push(parsed.data);
          } else {
            failed++;
            const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
            errors.push(`items[${idx}]: ${msg}`);
          }
        }

        const needingEmbeddings: Array<{ index: number; text: string }> = [];
        for (let i = 0; i < validItems.length; i++) {
          const it = validItems[i];
          if (!it.embedding || it.embedding.length === 0) {
            const text = `${it.title}. ${it.category}. ${it.tags.join(', ')}. ${it.description}`;
            needingEmbeddings.push({ index: i, text });
          }
        }

        if (needingEmbeddings.length > 0) {
          const generated = await opts.embedder.embedBatch(needingEmbeddings.map((e) => e.text));
          for (let j = 0; j < needingEmbeddings.length; j++) {
            const targetIdx = needingEmbeddings[j].index;
            validItems[targetIdx].embedding = Array.from(generated[j]);
          }
        }

        let upserted = 0;
        const useFastLeaf = validItems.length >= 100 && store.count() >= 500;
        for (const item of validItems) {
          store.upsert(
            {
              ...item,
              description: item.description || '',
              category: item.category || 'General',
              tags: item.tags || [],
              embedding: item.embedding!,
            },
            { fastLeaf: useFastLeaf }
          );
          upserted++;
        }

        if (upserted > 0) {
          await invalidateCatalogCaches();
          Metrics.vectorStoreSize.set(store.count());

          if (AILManager.isEnabled()) {
            const ail = AILManager.getInstance();
            ail.ranker.updateStatistics({
              popularity: 1.0,
              freshness: 1.0,
            });
          }

          AuditLogger.getInstance().record({
            tenantId,
            actorRole: role,
            action: 'catalog.upsert',
            metadata: { upserted, failed },
          });

          void store.saveSnapshotAsync();
        }

        return reply.status(200).send({
          upserted,
          failed,
          errors,
        });
      }

      // Single item mode: {id, title, ...}
      const validated = upsertItemSchema.parse(request.body);

      let embedding = validated.embedding;
      if (!embedding || embedding.length === 0) {
        const text = `${validated.title}. ${validated.category}. ${validated.tags.join(', ')}. ${validated.description}`;
        const vec = await opts.embedder.embed(text);
        embedding = Array.from(vec);
      }

      store.upsert({
        ...validated,
        description: validated.description || '',
        category: validated.category || 'General',
        tags: validated.tags || [],
        embedding,
      });

      await invalidateCatalogCaches();
      Metrics.vectorStoreSize.set(store.count());

      if (AILManager.isEnabled()) {
        const ail = AILManager.getInstance();
        ail.ranker.updateStatistics({
          popularity: 1.0,
          freshness: 1.0,
        });
      }

      AuditLogger.getInstance().record({
        tenantId,
        actorRole: role,
        action: 'catalog.upsert',
        resourceId: validated.id,
      });

      void store.saveSnapshotAsync();

      return reply.status(200).send({
        success: true,
        upserted: 1,
        failed: 0,
        errors: [],
        item: {
          id: validated.id,
          title: validated.title,
          category: validated.category,
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          issues: err.errors,
        });
      }
      throw err;
    }
  });

  /**
   * Add/upsert item(s) via POST /v1/catalog/items and invalidate search & recommend caches
   */
  fastify.post('/v1/catalog/items', { preHandler: authenticate }, async (request, reply) => {
    try {
      const role = RBACManager.resolveRole(request);
      if (!RBACManager.hasPermission(role, 'write')) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `Role '${role}' is not permitted to perform catalog mutations`,
        });
      }

      const { store, tenantId } = resolveStore(request);
      const body = request.body as Record<string, any>;
      const rawItems = Array.isArray(body?.items) ? body.items : [body];
      const parsedItems = z.array(catalogItemSchema).min(1).max(500).parse(rawItems);

      let indexedCount = 0;
      for (const item of parsedItems) {
        let embedding = item.embedding;
        if (!embedding || embedding.length === 0) {
          const text = `${item.title}. ${item.category}. ${(item.tags || []).join(', ')}. ${item.description}`;
          const vec = await opts.embedder.embed(text);
          embedding = Array.from(vec);
        }

        store.upsert({
          ...item,
          description: item.description || '',
          category: item.category || 'General',
          tags: item.tags || [],
          embedding,
        });
        indexedCount++;
      }

      // Invalidate search and recommend caches when catalog changes
      await invalidateCatalogCaches();
      Metrics.vectorStoreSize.set(store.count());

      AuditLogger.getInstance().record({
        tenantId,
        actorRole: role,
        action: 'catalog.items.upsert',
        metadata: { indexedCount },
      });

      return reply.status(201).send({
        success: true,
        indexedCount,
        item: parsedItems.length === 1 ? { id: parsedItems[0].id, title: parsedItems[0].title, category: parsedItems[0].category } : undefined,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          issues: err.errors,
        });
      }
      throw err;
    }
  });

  /**
   * Delete item by ID via DELETE /v1/catalog/items/:id and invalidate caches
   */
  fastify.delete<{ Params: { id: string } }>(
    '/v1/catalog/items/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const role = RBACManager.resolveRole(request);
      if (!RBACManager.hasPermission(role, 'write')) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `Role '${role}' is not permitted to delete catalog items`,
        });
      }

      const { store, tenantId } = resolveStore(request);
      const { id } = request.params;
      const deleted = store.delete(id);

      // Invalidate caches on deletion
      await invalidateCatalogCaches();
      Metrics.vectorStoreSize.set(store.count());

      if (!deleted) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Item '${id}' not found in catalog`,
        });
      }

      AuditLogger.getInstance().record({
        tenantId,
        actorRole: role,
        action: 'catalog.delete',
        resourceId: id,
      });

      return reply.status(200).send({
        success: true,
        deletedId: id,
      });
    }
  );

  /**
   * Batch catalog ingestion using batch embedding inference (BUG #4).
   */
  fastify.post('/v1/catalog', { preHandler: authenticate }, async (request, reply) => {
    const role = RBACManager.resolveRole(request);
    if (!RBACManager.hasPermission(role, 'write')) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `Role '${role}' is not permitted to ingest catalog items`,
      });
    }

    const { store, tenantId } = resolveStore(request);
    const parseResult = ingestPayloadSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid catalog payload',
        issues: parseResult.error.issues,
      });
    }

    const { items } = parseResult.data;
    const start = Date.now();

    const itemsNeedingEmbedding: Array<{ index: number; text: string }> = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.embedding || it.embedding.length === 0) {
        const text = `${it.title}. ${it.category}. ${it.tags.join(', ')}. ${it.description}`;
        itemsNeedingEmbedding.push({ index: i, text });
      }
    }

    if (itemsNeedingEmbedding.length > 0) {
      const textsToEmbed = itemsNeedingEmbedding.map((e) => e.text);
      const generatedEmbeddings = await opts.embedder.embedBatch(textsToEmbed);
      for (let j = 0; j < itemsNeedingEmbedding.length; j++) {
        const targetIdx = itemsNeedingEmbedding[j].index;
        items[targetIdx].embedding = Array.from(generatedEmbeddings[j]);
      }
    }

    let indexed = 0;
    for (const item of items) {
      store.upsert({
        ...item,
        description: item.description || '',
        category: item.category || 'General',
        tags: item.tags || [],
        embedding: item.embedding!,
      });

      if (AILManager.isEnabled()) {
        const ail = AILManager.getInstance();
        ail.ranker.updateStatistics({
          popularity: 1.0,
          freshness: 1.0,
        });
      }

      indexed++;
    }

    await invalidateCatalogCaches();
    Metrics.vectorStoreSize.set(store.count());

    AuditLogger.getInstance().record({
      tenantId,
      actorRole: role,
      action: 'catalog.batch_ingest',
      metadata: { indexedCount: indexed },
    });

    const durationMs = Date.now() - start;
    return reply.status(201).send({
      success: true,
      indexedCount: indexed,
      durationMs,
    });
  });
}

