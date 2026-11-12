import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Metrics, SecurityGuardrails } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { ServerEmbedder } from '../services/embedder';
import { VectorStore } from '../services/vector-store';
import { AILManager } from '../services/ail';
import { ApiQueryCache } from '../services/query-cache';
import { getCache, CacheKeys, getSemanticCache } from '../services/cache';
import { RBACManager, AuditLogger } from '../services/multi-tenancy';
import { StoreError, StoreRegistry, withTimeout } from '../services/store-registry';
import { getAverageSearchLatencyMs } from '../plugins/observability';
import { OperationalLogStore } from '../services/structured-logger';
import { AdminConsoleStore } from '../services/admin-console-store';
import { safeFetchText } from '../services/safe-fetch';
import { parseYmlOrCommerceMl } from '../services/yml-parser';

const itemAttributesSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
  .optional();

export const upsertItemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  category: z.string().max(100).optional().default('General'),
  sku: z.string().max(100).optional().nullable(),
  brand: z.string().max(100).optional(),
  tags: z.array(z.string()).max(20).optional().default([]),
  price: z.number().nonnegative().optional(),
  inStock: z.boolean().optional(),
  stock: z.number().int().min(0).optional(),
  url: z.string().max(2000).optional(),
  imageUrl: z.string().max(2000).optional().nullable(),
  variantGroup: z.string().max(120).optional(),
  attributes: itemAttributesSchema,
  embedding: z.array(z.number()).length(384).optional(),
  index: z.string().optional(),
  indexName: z.string().optional(),
});

const catalogItemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  category: z.string().max(100).optional().default('General'),
  sku: z.string().max(100).optional().nullable(),
  brand: z.string().max(100).optional(),
  tags: z.array(z.string()).default([]),
  price: z.number().nonnegative().optional(),
  inStock: z.boolean().optional(),
  stock: z.number().int().min(0).optional(),
  url: z.string().max(2000).optional(),
  imageUrl: z.string().max(2000).optional().nullable(),
  variantGroup: z.string().max(120).optional(),
  attributes: itemAttributesSchema,
  embedding: z.array(z.number()).optional(),
});

const ingestPayloadSchema = z.object({
  items: z.array(catalogItemSchema).min(1).max(500),
  index: z.string().optional(),
  indexName: z.string().optional(),
});

export async function catalogRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
  const cache = getCache();
  const semanticCache = getSemanticCache();
  const storeRegistry = fastify.storeRegistry || StoreRegistry.getInstance();
  storeRegistry.setDefaultStore(opts.vectorStore);

  async function resolveStore(request: any): Promise<{ store: VectorStore; tenantId: string; indexName: string }> {
    const resolved = storeRegistry.resolveRequestStore(request);
    await resolved.store.whenReady();
    return {
      store: resolved.store,
      tenantId: resolved.tenantId,
      indexName: resolved.indexName,
    };
  }

  async function invalidateCatalogCaches(tenantId = 'default', indexName = 'default'): Promise<void> {
    const ns = `${tenantId}:${indexName}`;
    ApiQueryCache.invalidateNamespace(ns);
    semanticCache.invalidateNamespace(ns);
    fastify.clusterCoordinator?.broadcastInvalidation(`catalog.mutation:${ns}`);
    await Promise.all([
      cache.invalidate(`search:${ns}:*`),
      cache.invalidate(`recommend:${ns}:*`),
      cache.del(CacheKeys.catalogStats()),
    ]);
  }

  /**
   * Catalog statistics & diagnostics endpoint.
   */
  fastify.get('/v1/catalog/stats', async (request, reply) => {
    try {
      const { store, tenantId, indexName } = await resolveStore(request);
      let effectiveStore = store;
      if (tenantId === 'default' && indexName === 'default') {
        const demoStore = storeRegistry.getOrCreateStore('demo', 'demo');
        if (demoStore.count() > store.count() && demoStore.count() >= 1000) {
          effectiveStore = demoStore;
        }
      }
      const allItems = effectiveStore.getAll();
      const categories: Record<string, number> = {};
      for (const item of allItems) {
        categories[item.category] = (categories[item.category] || 0) + 1;
      }

      const redisStats = await cache.getStats();
      const itemCount = effectiveStore.count();

      return {
        itemsIndexed: itemCount,
        totalItems: itemCount,
        vectorDimension: 384,
        hnswIndexed: effectiveStore.getHNSW().size(),
        walPending: effectiveStore.getWAL().size(),
        avgSearchLatencyMs: getAverageSearchLatencyMs(),
        categories,
        cache: {
          type: redisStats.type || 'in-memory',
          ...ApiQueryCache.getInstance().stats(),
          redis: redisStats,
        },
      };
    } catch (err) {
      if (err instanceof StoreError) {
        return reply.status(err.statusCode).send(err.toJSON());
      }
      throw err;
    }
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

      const { store, tenantId, indexName } = await resolveStore(request);
      const rawBody = request.body as Record<string, unknown> | null;

      // Batch mode: {"items": [...]}
      if (rawBody && typeof rawBody === 'object' && 'items' in rawBody && Array.isArray(rawBody.items)) {
        const rawItems = rawBody.items as unknown[];
        if (rawItems.length === 0) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Validation Error',
            message: 'Field "items" must contain at least 1 catalog item.',
            upserted: 0,
            failed: 0,
            errors: ['items: Array must contain at least 1 element'],
          });
        }

        if (rawItems.length > 500) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Validation Error',
            message: 'Batch size exceeds maximum limit of 500 items per request.',
            upserted: 0,
            failed: rawItems.length,
            errors: ['items: Array must contain at most 500 elements'],
          });
        }

        const validItems: Array<z.infer<typeof upsertItemSchema>> = [];
        const errors: string[] = [];
        const rowErrors: Array<{ row: number; field: string; message: string }> = [];
        let failed = 0;

        for (let idx = 0; idx < rawItems.length; idx++) {
          const parsed = upsertItemSchema.safeParse(rawItems[idx]);
          if (parsed.success) {
            validItems.push(parsed.data);
          } else {
            failed++;
            for (const issue of parsed.error.errors) {
              rowErrors.push({
                row: idx + 1,
                field: issue.path.join('.') || 'item',
                message: issue.message,
              });
            }
            const msg = parsed.error.errors
              .map((e) => `field "${e.path.join('.') || 'item'}": ${e.message}`)
              .join(', ');
            errors.push(`row ${idx + 1} (items[${idx}]): ${msg}`);
          }
        }

        if (validItems.length === 0 && failed > 0) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Validation Error',
            message: errors.join('; '),
            upserted: 0,
            failed,
            errors,
            rowErrors,
            details: errors,
          });
        }

        storeRegistry.assertItemQuota(tenantId, indexName, validItems.length);

        const needingEmbeddings: Array<{ index: number; text: string }> = [];
        for (let i = 0; i < validItems.length; i++) {
          const it = validItems[i];
          if (!it.embedding || it.embedding.length === 0) {
            const text = `${it.title}. ${it.category}. ${it.tags.join(', ')}. ${it.description}`;
            needingEmbeddings.push({ index: i, text });
          }
        }

        if (needingEmbeddings.length > 0) {
          const generated = await withTimeout(
            opts.embedder.embedBatch(needingEmbeddings.map((e) => e.text)),
            10_000,
            'catalog.upsertBatchEmbed'
          );
          for (let j = 0; j < needingEmbeddings.length; j++) {
            const targetIdx = needingEmbeddings[j].index;
            validItems[targetIdx].embedding = Array.from(generated[j]);
          }
        }

        const batchStartMs = performance.now();
        const batchPrepared = validItems.map((item) => {
          const cleanTitle = SecurityGuardrails.scanAndSanitize(item.title).sanitizedInput || item.title;
          const cleanDesc = item.description
            ? SecurityGuardrails.scanAndSanitize(item.description).sanitizedInput || item.description
            : '';
          return {
            ...item,
            sku: item.sku || String(item.id),
            inStock:
              item.inStock !== undefined
                ? item.inStock
                : item.stock !== undefined
                ? item.stock > 0
                : true,
            imageUrl: item.imageUrl ?? null,
            title: cleanTitle,
            description: cleanDesc,
            category: item.category || 'General',
            tags: item.tags || [],
            embedding: item.embedding!,
          };
        });
        const upserted = store.upsertBatch(batchPrepared);

        if (upserted > 0) {
          await invalidateCatalogCaches(tenantId, indexName);
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

          OperationalLogStore.getInstance().record('info', 'catalog.indexing', {
            requestId: request.headers['x-request-id'] as string,
            tenantId,
            indexName,
            keyId: request.apiKeyContext?.keyId,
            latencyMs: Math.round((performance.now() - batchStartMs) * 100) / 100,
            details: { operation: 'upsert_batch', batchSize: upserted, failed },
          });

          void store.saveSnapshotAsync();
        }

        AdminConsoleStore.getInstance().recordCatalogUpsert({
          tenantId,
          indexName,
          upserted,
          failed,
          sampleRowErrors: rowErrors,
        });

        return reply.status(200).send({
          upserted,
          failed,
          errors,
          rowErrors,
        });
      }

      // Single item mode: {id, title, ...}
      const singleStartMs = performance.now();
      const validated = upsertItemSchema.parse(request.body);
      storeRegistry.assertItemQuota(tenantId, indexName, 1);

      const cleanTitle = SecurityGuardrails.scanAndSanitize(validated.title).sanitizedInput || validated.title;
      const cleanDesc = validated.description
        ? SecurityGuardrails.scanAndSanitize(validated.description).sanitizedInput || validated.description
        : '';

      let embedding = validated.embedding;
      if (!embedding || embedding.length === 0) {
        const text = `${cleanTitle}. ${validated.category}. ${validated.tags.join(', ')}. ${cleanDesc}`;
        const vec = await withTimeout(opts.embedder.embed(text), 5_000, 'catalog.upsertEmbed');
        embedding = Array.from(vec);
      }

      store.upsert({
        ...validated,
        sku: validated.sku || String(validated.id),
        inStock:
          validated.inStock !== undefined
            ? validated.inStock
            : validated.stock !== undefined
            ? validated.stock > 0
            : true,
        imageUrl: validated.imageUrl ?? null,
        title: cleanTitle,
        description: cleanDesc,
        category: validated.category || 'General',
        tags: validated.tags || [],
        embedding,
      });

      await invalidateCatalogCaches(tenantId, indexName);
      Metrics.vectorStoreSize.set(store.count());

      if (AILManager.isEnabled()) {
        const ail = AILManager.getInstance();
        ail.ranker.updateStatistics({
          popularity: 1.0,
          freshness: 1.0,
        });
      }

      AdminConsoleStore.getInstance().recordCatalogUpsert({
        tenantId,
        indexName,
        upserted: 1,
        failed: 0,
        sampleRowErrors: [],
      });

      AuditLogger.getInstance().record({
        tenantId,
        actorRole: role,
        action: 'catalog.upsert',
        resourceId: validated.id,
      });

      OperationalLogStore.getInstance().record('info', 'catalog.indexing', {
        requestId: request.headers['x-request-id'] as string,
        tenantId,
        indexName,
        keyId: request.apiKeyContext?.keyId,
        latencyMs: Math.round((performance.now() - singleStartMs) * 100) / 100,
        details: { operation: 'upsert_single', batchSize: 1, itemId: validated.id },
      });

      void store.saveSnapshotAsync();

      return reply.status(200).send({
        success: true,
        upserted: 1,
        failed: 0,
        errors: [],
        item: {
          id: validated.id,
          sku: validated.sku || String(validated.id),
          title: cleanTitle,
          category: validated.category,
        },
      });
    } catch (err) {
      if (err instanceof StoreError) {
        return reply.status(err.statusCode).send(err.toJSON());
      }
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

      const { store, tenantId, indexName } = await resolveStore(request);
      const body = request.body as Record<string, any>;
      const rawItems = Array.isArray(body?.items) ? body.items : [body];
      const parsedItems = z.array(catalogItemSchema).min(1).max(500).parse(rawItems);

      storeRegistry.assertItemQuota(tenantId, indexName, parsedItems.length);

      const preparedItems = [];
      for (const item of parsedItems) {
        let embedding = item.embedding;
        if (!embedding || embedding.length === 0) {
          const text = `${item.title}. ${item.category}. ${(item.tags || []).join(', ')}. ${item.description}`;
          const vec = await withTimeout(opts.embedder.embed(text), 5_000, 'catalog.itemsEmbed');
          embedding = Array.from(vec);
        }

        preparedItems.push({
          ...item,
          sku: item.sku || String(item.id),
          imageUrl: item.imageUrl ?? null,
          description: item.description || '',
          category: item.category || 'General',
          tags: item.tags || [],
          embedding,
        });
      }
      const indexedCount = store.upsertBatch(preparedItems);

      // Invalidate search and recommend caches when catalog changes
      await invalidateCatalogCaches(tenantId, indexName);
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
      if (err instanceof StoreError) {
        return reply.status(err.statusCode).send(err.toJSON());
      }
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
      try {
        const role = RBACManager.resolveRole(request);
        if (!RBACManager.hasPermission(role, 'write')) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: `Role '${role}' is not permitted to delete catalog items`,
          });
        }

        const { store, tenantId, indexName } = await resolveStore(request);
        const { id } = request.params;
        const deleted = store.delete(id);

        // Invalidate caches on deletion
        await invalidateCatalogCaches(tenantId, indexName);
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
      } catch (err) {
        if (err instanceof StoreError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        throw err;
      }
    }
  );

  /**
   * Clear all items from the resolved catalog store and invalidate caches
   */
  fastify.delete(
    '/v1/catalog/clear',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const role = RBACManager.resolveRole(request);
        if (!RBACManager.hasPermission(role, 'write')) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: `Role '${role}' is not permitted to clear catalog`,
          });
        }
        const { store, tenantId, indexName } = await resolveStore(request);
        await store.clear();
        await invalidateCatalogCaches(tenantId, indexName);
        Metrics.vectorStoreSize.set(0);
        AuditLogger.getInstance().record({
          tenantId,
          actorRole: role,
          action: 'catalog.clear',
        });
        return reply.status(200).send({
          success: true,
          cleared: true,
          totalItems: 0,
        });
      } catch (err) {
        if (err instanceof StoreError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        throw err;
      }
    }
  );

  /**
   * Batch catalog ingestion using batch embedding inference (BUG #4).
   */
  fastify.post('/v1/catalog', { preHandler: authenticate }, async (request, reply) => {
    try {
      const role = RBACManager.resolveRole(request);
      if (!RBACManager.hasPermission(role, 'write')) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: `Role '${role}' is not permitted to ingest catalog items`,
        });
      }

      const { store, tenantId, indexName } = await resolveStore(request);
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
      storeRegistry.assertItemQuota(tenantId, indexName, items.length);
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
        const generatedEmbeddings = await withTimeout(
          opts.embedder.embedBatch(textsToEmbed),
          10_000,
          'catalog.batchEmbed'
        );
        for (let j = 0; j < itemsNeedingEmbedding.length; j++) {
          const targetIdx = itemsNeedingEmbedding[j].index;
          items[targetIdx].embedding = Array.from(generatedEmbeddings[j]);
        }
      }

      const batchItems = items.map((item) => ({
        ...item,
        sku: item.sku || String(item.id),
        imageUrl: item.imageUrl ?? null,
        description: item.description || '',
        category: item.category || 'General',
        tags: item.tags || [],
        embedding: item.embedding!,
      }));
      const indexed = store.upsertBatch(batchItems);

      if (AILManager.isEnabled()) {
        const ail = AILManager.getInstance();
        ail.ranker.updateStatistics({
          popularity: 1.0,
          freshness: 1.0,
        });
      }

      await invalidateCatalogCaches(tenantId, indexName);
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
    } catch (err) {
      if (err instanceof StoreError) {
        return reply.status(err.statusCode).send(err.toJSON());
      }
      throw err;
    }
  });

  // POST /v1/catalog/import-yml — Server-side proxy + parser for Yandex.Market YML & 1C-Bitrix CommerceML feeds
  fastify.post('/v1/catalog/import-yml', { preHandler: authenticate }, async (request, reply) => {
    const role = RBACManager.resolveRole(request);
    if (!RBACManager.hasPermission(role, 'write') || (request.apiKeyContext?.role !== 'admin' && request.apiKeyContext?.role !== 'master')) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Admin or Master key is required to import YML feeds.',
      });
    }

    const start = Date.now();
    const body = (request.body || {}) as { url?: string; xml?: string; autoIndex?: boolean; maxItems?: number };
    let xmlText = (body.xml || '').trim();

    if (!xmlText && body.url) {
      const targetUrl = String(body.url).trim();
      try {
        const fetched = await safeFetchText(targetUrl, {
          timeoutMs: 12_000,
          maxBytes: 50 * 1024 * 1024, // 50 MB max
          maxRedirects: 3,
          headers: { Accept: 'application/xml, text/xml, */*' },
        });
        if (fetched.status < 200 || fetched.status >= 300) {
          return reply.status(502).send({ error: `Remote YML server responded with HTTP ${fetched.status}` });
        }
        xmlText = fetched.body;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        if (msg.startsWith('SSRF_BLOCKED')) {
          return reply.status(400).send({
            code: 'SSRF_BLOCKED',
            error: msg,
          });
        }
        return reply.status(502).send({
          error: `Failed to fetch remote YML feed: ${msg}`,
        });
      }
    }

    if (!xmlText) {
      return reply.status(400).send({ error: 'Provide either "url" or "xml" payload' });
    }

    const maxItemsCap = Math.min(Math.max(Number(body.maxItems) || 50_000, 1), 100_000);
    const items = parseYmlOrCommerceMl(xmlText, maxItemsCap);

    let indexedCount = 0;
    let usedWorkerThread = false;
    if (body.autoIndex && items.length > 0) {
      const { store, tenantId, indexName } = await resolveStore(request);
      storeRegistry.assertItemQuota(tenantId, indexName, items.length);

      const BATCH_SIZE = 200;
      const allPrepared: Array<{
        id: string;
        sku?: string;
        brand?: string;
        title: string;
        description: string;
        category: string;
        price: number;
        inStock: boolean;
        url?: string;
        imageUrl?: string | null;
        tags: string[];
        embedding: number[];
      }> = [];

      for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
        const chunk = items.slice(offset, offset + BATCH_SIZE);
        const texts = chunk.map((it) => `${it.title}. ${it.category}. ${it.description}`);
        const vectors = await opts.embedder.embedBatch(texts);
        for (let i = 0; i < chunk.length; i++) {
          const it = chunk[i];
          allPrepared.push({
            id: it.id,
            sku: it.sku,
            brand: it.brand,
            title: it.title,
            description: it.description,
            category: it.category,
            price: it.price,
            inStock: it.inStock,
            url: it.url,
            imageUrl: it.imageUrl,
            tags: it.tags,
            embedding: Array.from(vectors[i]),
          });
        }
      }

      // Offload HNSW graph construction to worker_threads with O(1) ArrayBuffer transfer
      const { indexedCount: count, workerBuild } = await store.upsertBatchInWorker(allPrepared);
      indexedCount = count;
      usedWorkerThread = workerBuild.usedWorkerThread;

      await invalidateCatalogCaches(tenantId, indexName);
      await store.saveSnapshotAsync();
    }

    return reply.status(200).send({
      success: true,
      parsedCount: items.length,
      importedCount: body.autoIndex ? indexedCount : items.length,
      indexedCount,
      usedWorkerThread,
      items,
      durationMs: Date.now() - start,
    });
  });

  // POST /v1/benchmark/compare-url — Side-by-side Storefront URL vs EIDOS Hybrid 384-d Benchmark
  fastify.post('/v1/benchmark/compare-url', { preHandler: authenticate }, async (request, reply) => {
    if (request.apiKeyContext?.role !== 'admin' && request.apiKeyContext?.role !== 'master') {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Admin or Master key is required for external URL benchmarking.',
      });
    }

    const body = (request.body || {}) as {
      searchUrlTemplate?: string;
      queries?: string[];
    };
    const queries =
      Array.isArray(body.queries) && body.queries.length > 0
        ? body.queries.slice(0, 10)
        : [
            'крсовки для марафона',
            'акб на камри',
            'недорогие наушники для бега',
            'ghjuhfvvbhjdfybt rust',
            'робот пылесос с лидаром',
          ];

    const { store } = await resolveStore(request);
    const allItems = store.getAll();

    const comparisons = [];
    for (const q of queries) {
      const t0 = Date.now();
      let externalTitles: string[] = [];
      let externalStatus: 'fetched' | 'simulated_sql_like' = 'simulated_sql_like';

      if (body.searchUrlTemplate) {
        const url = body.searchUrlTemplate.includes('{query}')
          ? body.searchUrlTemplate.replace('{query}', encodeURIComponent(q))
          : `${body.searchUrlTemplate}${body.searchUrlTemplate.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`;
        try {
          const fetched = await safeFetchText(url, {
            timeoutMs: 4_000,
            maxBytes: 2 * 1024 * 1024, // 2 MB cap for HTML scrape
            maxRedirects: 2,
          });
          if (fetched.status >= 200 && fetched.status < 300) {
            const html = fetched.body;
            const hMatches =
              html.match(
                /<(?:h2|h3|a)[^>]*class=["'][^"']*(?:title|name|product|catalog-item)[^"']*["'][^>]*>([\s\S]*?)<\/(?:h2|h3|a)>/gi
              ) || [];
            externalTitles = hMatches
              .map((m) => m.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
              .filter((t) => t.length > 3)
              .slice(0, 3);
            externalStatus = 'fetched';
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.startsWith('SSRF_BLOCKED')) {
            return reply.status(400).send({
              code: 'SSRF_BLOCKED',
              error: msg,
            });
          }
          externalStatus = 'simulated_sql_like';
        }
      }

      if (externalStatus === 'simulated_sql_like') {
        const lowerWords = q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
        externalTitles = allItems
          .filter((item) => {
            const hay = `${item.title} ${item.description || ''}`.toLowerCase();
            return lowerWords.length > 0 && lowerWords.every((w) => hay.includes(w));
          })
          .slice(0, 3)
          .map((i) => i.title);
      }

      const qVec = await opts.embedder.embed(q);
      const eidosHits = store.hybridSearch(q, qVec, 3);
      comparisons.push({
        query: q,
        legacyStatus: externalStatus,
        legacyCount: externalTitles.length,
        legacyTopTitles: externalTitles,
        eidosCount: eidosHits.length,
        eidosTopItems: eidosHits.map((h) => ({
          id: h.item.id,
          title: h.item.title,
          category: h.item.category,
          price: h.item.price,
          score: Number(h.score.toFixed(3)),
        })),
        latencyMs: Math.max(1, Date.now() - t0),
      });
    }

    return reply.status(200).send({
      success: true,
      searchUrlTemplate: body.searchUrlTemplate || null,
      comparisons,
    });
  });
}

(catalogRoutes as any)[Symbol.for('skip-override')] = true;


