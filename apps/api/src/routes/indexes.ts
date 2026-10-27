import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';
import { AuditLogger, RBACManager, TenantNamespaceManager } from '../services/multi-tenancy';

export type QuantizationMode = 'fp32' | 'fp16' | 'int8' | 'binary';

export interface IndexMetadata {
  name: string;
  dimension: number;
  quantization: QuantizationMode;
  M: number;
  efConstruction: number;
  efSearch: number;
  shards: number;
  replicationFactor: number;
  createdAt: string;
  store: VectorStore;
}

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

const indexRegistry = new Map<string, IndexMetadata>();

function computeMemoryBytes(docCount: number, dimension: number, quantization: QuantizationMode): number {
  const bytesPerDim =
    quantization === 'fp32'
      ? 4
      : quantization === 'fp16'
        ? 2
        : quantization === 'int8'
          ? 1
          : 0.125;
  const vectorBytes = docCount * dimension * bytesPerDim;
  const graphOverheadBytes = docCount * 128;
  return Math.round(vectorBytes + graphOverheadBytes);
}

function serializeIndex(meta: IndexMetadata) {
  const docCount = meta.store.count();
  return {
    name: meta.name,
    dimension: meta.dimension,
    documentCount: docCount,
    quantization: meta.quantization,
    hnswConfig: {
      M: meta.M,
      efConstruction: meta.efConstruction,
      efSearch: meta.efSearch,
    },
    shards: meta.shards,
    replicationFactor: meta.replicationFactor,
    memoryBytes: computeMemoryBytes(docCount, meta.dimension, meta.quantization),
    status: 'ready' as const,
    createdAt: meta.createdAt,
  };
}

export async function indexRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
  if (!indexRegistry.has('default')) {
    indexRegistry.set('default', {
      name: 'default',
      dimension: 384,
      quantization: 'int8',
      M: 16,
      efConstruction: 128,
      efSearch: 64,
      shards: 3,
      replicationFactor: 2,
      createdAt: new Date(Date.now() - 86_400_000 * 7).toISOString(),
      store: opts.vectorStore,
    });
  } else {
    const existingDefault = indexRegistry.get('default')!;
    existingDefault.store = opts.vectorStore;
  }

  fastify.get('/v1/indexes', async () => {
    const list = Array.from(indexRegistry.values()).map(serializeIndex);
    return {
      total: list.length,
      indexes: list,
    };
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

    const data = parsed.data;
    const key = data.name.toLowerCase();
    if (indexRegistry.has(key)) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: `Index '${data.name}' already exists`,
      });
    }

    const store = TenantNamespaceManager.getInstance().getStore(key);
    const meta: IndexMetadata = {
      name: key,
      dimension: data.dimension,
      quantization: data.quantization,
      M: data.M,
      efConstruction: data.efConstruction,
      efSearch: data.efSearch,
      shards: data.shards,
      replicationFactor: data.replicationFactor,
      createdAt: new Date().toISOString(),
      store,
    };

    indexRegistry.set(key, meta);

    AuditLogger.getInstance().record({
      tenantId: key,
      actorRole: RBACManager.resolveRole(request),
      action: 'index.create',
      resourceId: key,
      details: {
        dimension: data.dimension,
        quantization: data.quantization,
        M: data.M,
        efConstruction: data.efConstruction,
      },
    });

    return reply.status(201).send({
      success: true,
      index: serializeIndex(meta),
    });
  });

  fastify.delete<{ Params: { name: string } }>('/v1/indexes/:name', async (request, reply) => {
    const key = request.params.name.toLowerCase();
    if (key === 'default') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Cannot delete the primary default index',
      });
    }

    if (!indexRegistry.has(key)) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Index '${request.params.name}' not found`,
      });
    }

    indexRegistry.delete(key);
    AuditLogger.getInstance().record({
      tenantId: key,
      actorRole: RBACManager.resolveRole(request),
      action: 'index.delete',
      resourceId: key,
    });

    return reply.status(200).send({
      success: true,
      deleted: key,
    });
  });

  fastify.post<{ Params: { name: string } }>(
    '/v1/indexes/:name/documents',
    async (request, reply) => {
      const key = request.params.name.toLowerCase();
      const meta = indexRegistry.get(key);
      if (!meta) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Index '${request.params.name}' not found`,
        });
      }

      const parsed = bulkDocumentsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
      }

      const docs = parsed.data.documents;
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
        const generated = await opts.embedder.embedBatch(textsToEmbed.map((t) => t.text));
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

      return reply.status(200).send({
        success: true,
        index: serializeIndex(meta),
        indexedCount: indexed,
      });
    }
  );
}
