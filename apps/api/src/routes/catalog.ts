import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { ServerEmbedder } from '../services/embedder';
import { VectorStore } from '../services/vector-store';

const catalogItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  price: z.number().optional(),
  embedding: z.array(z.number()).optional(),
});

const ingestPayloadSchema = z.object({
  items: z.array(catalogItemSchema).min(1),
});

export async function catalogRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
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
    let indexed = 0;

    for (const item of items) {
      let embedding = item.embedding;
      if (!embedding || embedding.length === 0) {
        const text = `${item.title}. ${item.category}. ${item.tags.join(', ')}. ${item.description}`;
        const vec = await opts.embedder.embed(text);
        embedding = Array.from(vec);
      }

      opts.vectorStore.upsert({
        ...item,
        embedding,
      });
      indexed++;
    }

    const durationMs = Date.now() - start;
    return reply.status(201).send({
      success: true,
      indexedCount: indexed,
      durationMs,
    });
  });
}
