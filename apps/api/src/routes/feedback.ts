import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { AILManager } from '../services/ail';

const feedbackSchema = z.object({
  userId: z.string().min(1),
  itemId: z.string().min(1),
  eventType: z.enum(['click', 'like', 'purchase', 'ignore', 'dislike']),
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

    // 1. Register with Online FeedbackLoop
    ail.feedbackLoop.register(event);

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

    return {
      accepted: true,
      stats: ail.feedbackLoop.stats(),
    };
  });
}
