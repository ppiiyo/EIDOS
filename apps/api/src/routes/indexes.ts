import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';
import { AuditLogger, RBACManager } from '../services/multi-tenancy';
import {
  IndexMetadata,
  QuantizationMode,
  serializeIndexMetadata,
  StoreError,
  StoreRegistry,
  withTimeout,
} from '../services/store-registry';
import { ApiQueryCache } from '../services/query-cache';
import { getCache, getSemanticCache } from '../services/cache';

export { QuantizationMode, IndexMetadata };

const createIndexSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Index name must be alphanumeric with hyphens or underscores'),
  dimension: z.number().int().min(8).max(4096).default(384),
  quantization: z.enum(['fp32', 'fp16', 'int8', 'binary']).default('int8'),
  M: z.number().int().min(4).max(128).default(16),
  efConstruction: z.number().int().min(16).max(512).default(128),
  efSearch: z.number().int().min(8).max(512).default(64),
  shards: z.number().int().min(1).max(32).default(3),
  replicationFactor: z.number().int().min(1).max(5).default(2),
});

const bulkDocumentsSchema = z.object({
  documents: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        title: z.string().min(1).max(500),
        description: z.string().max(4000).optional().default(''),
        category: z.string().max(120).optional().default('General'),
        price: z.number().nonnegative().optional().default(0),
        tags: z.array(z.string()).optional().default([]),
        embedding: z.array(z.number()).optional(),
      })
    )
    .min(1)
    .max(1000),
});

export async function indexRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
  const storeRegistry = fastify.storeRegistry || StoreRegistry.getInstance();
  storeRegistry.setDefaultStore(opts.vectorStore);

  fastify.get('/v1/indexes', async (request, reply) => {
    try {
      const explicitHeaderTenant = request.headers['x-tenant-id'];
      const tenantFilter =
        typeof explicitHeaderTenant === 'string' && explicitHeaderTenant.trim().length > 0
          ? storeRegistry.resolveTenantId(request)
          : undefined;
      const list = storeRegistry.listIndexes(tenantFilter).map(serializeIndexMetadata);
      return {
        total: list.length,
        indexes: list,
      };
    } catch (err) {
      if (err instanceof StoreError) {
        return reply.status(err.statusCode).send(err.toJSON());
      }
      throw err;
    }
  });

  fastify.post('/v1/indexes', async (request, reply) => {
    const parsed = createIndexSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    try {
      const data = parsed.data;
      const tenantId = storeRegistry.resolveTenantId(request);
      const meta = storeRegistry.createIndex(data, tenantId);

      AuditLogger.getInstance().record({
        tenantId: meta.tenantId === 'default' ? meta.name : meta.tenantId,
        actorRole: RBACManager.resolveRole(request),
        action: 'index.create',
        resourceId: meta.name,
        details: {
          dimension: meta.dimension,
          quantization: meta.quantization,
          M: meta.M,
          efConstruction: meta.efConstruction,
        },
      });

      return reply.status(201).send({
        success: true,
        index: serializeIndexMetadata(meta),
      });
    } catch (err) {
      if (err instanceof StoreError) {
        return reply.status(err.statusCode).send(err.toJSON());
      }
      throw err;
    }
  });

  fastify.delete<{ Params: { name: string } }>('/v1/indexes/:name', async (request, reply) => {
    try {
      const tenantId = storeRegistry.resolveTenantId(request);
      const key = request.params.name.toLowerCase();
      storeRegistry.deleteIndex(key, tenantId);

      AuditLogger.getInstance().record({
        tenantId: tenantId === 'default' ? key : tenantId,
        actorRole: RBACManager.resolveRole(request),
        action: 'index.delete',
        resourceId: key,
      });

      return reply.status(200).send({
        success: true,
        deleted: key,
      });
    } catch (err) {
      if (err instanceof StoreError) {
        return reply.status(err.statusCode).send(err.toJSON());
      }
      throw err;
    }
  });

  fastify.post<{ Params: { name: string } }>(
    '/v1/indexes/:name/documents',
    async (request, reply) => {
      try {
        const tenantId = storeRegistry.resolveTenantId(request);
        const key = request.params.name.toLowerCase();
        const meta = storeRegistry.getMetadata(tenantId, key, { createIfMissing: false });

        const parsed = bulkDocumentsSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
          });
        }

        const docs = parsed.data.documents;
        storeRegistry.assertItemQuota(meta.tenantId, meta.name, docs.length);

        const textsToEmbed: Array<{ idx: number; text: string }> = [];
        for (let i = 0; i < docs.length; i++) {
          const d = docs[i];
          if (!d.embedding || d.embedding.length !== meta.dimension) {
            textsToEmbed.push({
              idx: i,
              text: `${d.title}. ${d.category}. ${(d.tags || []).join(', ')}. ${d.description}`,
            });
          }
        }

        if (textsToEmbed.length > 0) {
          const generated = await withTimeout(
            opts.embedder.embedBatch(textsToEmbed.map((t) => t.text)),
            10_000,
            'index.embedBatch'
          );
          for (let j = 0; j < textsToEmbed.length; j++) {
            docs[textsToEmbed[j].idx].embedding = Array.from(generated[j]);
          }
        }

        let indexed = 0;
        for (const doc of docs) {
          meta.store.upsert({
            id: doc.id,
            title: doc.title,
            description: doc.description || '',
            category: doc.category || 'General',
            price: doc.price ?? 0,
            inStock: true,
            tags: doc.tags || [],
            embedding: doc.embedding!,
          });
          indexed++;
        }

        // Invalidate caches so newly indexed documents are immediately visible to search & recommend
        ApiQueryCache.invalidateAll();
        getSemanticCache().clear();
        await Promise.all([
          getCache().invalidate('search:*'),
          getCache().invalidate('recommend:*'),
        ]);

        return reply.status(200).send({
          success: true,
          index: serializeIndexMetadata(meta),
          indexedCount: indexed,
        });
      } catch (err) {
        if (err instanceof StoreError) {
          return reply.status(err.statusCode).send(err.toJSON());
        }
        throw err;
      }
    }
  );
}

(indexRoutes as any)[Symbol.for('skip-override')] = true;
