import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { AILManager } from '../services/ail';

const feedbackSchema = z.object({
  userId: z
    .string()
    .optional()
    .default('anonymous')
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : 'anonymous')),
  itemId: z.string().min(1),
  eventType: z.enum(['click', 'like', 'purchase', 'ignore', 'dislike']),
  query: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.number().default(() => Date.now()),
  context: z
    .object({
      timestamp: z.number().optional(),
      device: z.enum(['mobile', 'desktop', 'tablet']).optional(),
      sessionId: z.string().optional(),
      hourOfDay: z.number().min(0).max(23).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      language: z.string().optional(),
    })
    .optional(),
});

export async function feedbackRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/v1/feedback', { preHandler: authenticate }, async (request, reply) => {
    const parseResult = feedbackSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const event = parseResult.data;
    const ail = AILManager.getInstance();

    // Record click/purchase funnel events via fastify.funnelService decorator (Phase 2)
    if (
      fastify.funnelService &&
      (event.eventType === 'click' || event.eventType === 'purchase')
    ) {
      fastify.funnelService.addEvent({
        type: event.eventType,
        itemId: event.itemId,
        query: event.query,
        sessionId: event.sessionId || event.context?.sessionId || event.userId,
        userId: event.userId,
        timestamp: event.timestamp,
      });
    }

    // 1. Register with Online FeedbackLoop
    ail.feedbackLoop.register({
      userId: event.userId,
      itemId: event.itemId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      context: event.context
        ? {
            ...event.context,
            timestamp: event.context.timestamp ?? event.timestamp,
          }
        : undefined,
    });

    // 2. Update popularity in MetadataStore
    let delta = 0;
    switch (event.eventType) {
      case 'click':
        delta = 0.02;
        break;
      case 'like':
        delta = 0.05;
        break;
      case 'purchase':
        delta = 0.10;
        break;
      case 'ignore':
        delta = -0.01;
        break;
      case 'dislike':
        delta = -0.05;
        break;
    }

    ail.metadataStore.updatePopularity(event.itemId, delta);

    // 3. Online learning for Ranker StreamingQuantileScalers
    const meta = ail.metadataStore.get(event.itemId);
    if (meta) {
      ail.ranker.updateStatistics({
        popularity: meta.popularity,
        freshness: ail.metadataStore.getFreshness(event.itemId),
      });
    }

    return {
      ok: true,
      accepted: true,
      stats: ail.feedbackLoop.stats(),
    };
  });
}
