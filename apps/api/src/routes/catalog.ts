import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { Metrics } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { ServerEmbedder } from '../services/embedder';
import { VectorStore } from '../services/vector-store';
import { AILManager } from '../services/ail';
import { ApiQueryCache } from '../services/query-cache';

export const upsertItemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  category: z.string().max(100).optional().default('General'),
  tags: z.array(z.string()).max(20).optional().default([]),
  price: z.number().positive().optional(),
  embedding: z.array(z.number()).length(384).optional(),
});

const catalogItemSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional().default(''),
  category: z.string().max(100).optional().default('General'),
  tags: z.array(z.string()).default([]),
  price: z.number().optional(),
  embedding: z.array(z.number()).optional(),
});

const ingestPayloadSchema = z.object({
  items: z.array(catalogItemSchema).min(1).max(500),
});

export async function catalogRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
  /**
   * Catalog statistics & diagnostics endpoint.
   */
  fastify.get('/v1/catalog/stats', async () => {
    const allItems = opts.vectorStore.getAll();
    const categories: Record<string, number> = {};
    for (const item of allItems) {
      categories[item.category] = (categories[item.category] || 0) + 1;
    }

    return {
      totalItems: opts.vectorStore.count(),
      hnswIndexed: opts.vectorStore.getHNSW().size(),
      walPending: opts.vectorStore.getWAL().size(),
      categories,
      cache: ApiQueryCache.getInstance().stats(),
    };
  });

  /**
   * Single item upsert with strict Zod validation schema (BUG #7).
   */
  fastify.post('/v1/catalog/upsert', { preHandler: authenticate }, async (request, reply) => {
    try {
      const validated = upsertItemSchema.parse(request.body);

      let embedding = validated.embedding;
      if (!embedding || embedding.length === 0) {
        const text = `${validated.title}. ${validated.category}. ${validated.tags.join(', ')}. ${validated.description}`;
        const vec = await opts.embedder.embed(text);
        embedding = Array.from(vec);
      }

      opts.vectorStore.upsert({
        ...validated,
        description: validated.description || '',
        category: validated.category || 'General',
        tags: validated.tags || [],
        embedding,
      });

      ApiQueryCache.invalidateAll();
      Metrics.vectorStoreSize.set(opts.vectorStore.count());

      if (AILManager.isEnabled()) {
        const ail = AILManager.getInstance();
        ail.ranker.updateStatistics({
          popularity: 1.0,
          freshness: 1.0,
        });
      }

      return reply.status(200).send({
        success: true,
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
   * Batch catalog ingestion using batch embedding inference (BUG #4).
   */
  fastify.post('/v1/catalog', { preHandler: authenticate }, async (request, reply) => {
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
      opts.vectorStore.upsert({
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

    ApiQueryCache.invalidateAll();
    Metrics.vectorStoreSize.set(opts.vectorStore.count());

    const durationMs = Date.now() - start;
    return reply.status(201).send({
      success: true,
      indexedCount: indexed,
      durationMs,
    });
  });
}
