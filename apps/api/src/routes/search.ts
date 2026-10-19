import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SecurityGuardrails } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { ServerEmbedder } from '../services/embedder';
import { VectorStore } from '../services/vector-store';

const searchRequestSchema = z.object({
  query: z.string().min(1, 'query is required').max(500),
  limit: z.number().int().min(1).max(50).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.25),
  filterCategory: z.string().optional(),
  mode: z.enum(['dense', 'sparse', 'hybrid']).default('hybrid'),
  alpha: z.number().min(0).max(1).default(0.5), // 0.0 = pure sparse BM25, 1.0 = pure dense HNSW
});

export async function searchRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
  fastify.post('/v1/search', { preHandler: authenticate }, async (request, reply) => {
    const startTime = performance.now();

    const parseResult = searchRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const { query, limit, minSimilarity, filterCategory, mode, alpha } = parseResult.data;

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

    let queryVector: Float32Array;
    try {
      queryVector = await opts.embedder.embed(safeQuery);
    } catch (err) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: `Inference error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // Vector Integrity Guardrail: Assert dimensions and absence of NaN / Inf
    const vectorCheck = SecurityGuardrails.validateVectorBounds(queryVector, 384);
    if (!vectorCheck.isValid) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Vector Integrity Error',
        message: vectorCheck.error,
      });
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
        filterCategory
      );
    } else if (mode === 'dense') {
      results = opts.vectorStore.search(
        cleanVector,
        limit,
        minSimilarity,
        undefined,
        filterCategory
      ).map((r) => ({ ...r, source: 'dense' }));
    } else {
      // Sparse BM25 only
      const bm25Hits = opts.vectorStore.getBM25().search(safeQuery, limit * 2);
      for (const hit of bm25Hits) {
        const item = opts.vectorStore.get(hit.id);
        if (!item) continue;
        if (filterCategory && item.category !== filterCategory) continue;
        results.push({ item, score: hit.score, source: 'sparse' });
        if (results.length >= limit) break;
      }
    }

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      query: safeQuery,
      mode,
      results: results.map((r) => ({
        id: r.item.id,
        title: r.item.title,
        description: r.item.description,
        category: r.item.category,
        tags: r.item.tags,
        price: r.item.price,
        score: r.score,
        source: r.source,
      })),
      latencyMs,
    };
  });
}
