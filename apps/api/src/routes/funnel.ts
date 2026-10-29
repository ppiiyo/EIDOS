import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { SearchFunnelService } from '../services/search-funnel';

const funnelEventSchema = z.object({
  type: z.enum(['search', 'click', 'purchase']),
  sessionId: z.string().min(1).optional().default('anonymous'),
  query: z.string().optional(),
  itemId: z.string().optional(),
  userId: z.string().optional(),
  timestamp: z.number().optional(),
});

function parsePeriodToMs(periodRaw?: string): { label: string; periodMs: number } {
  const clean = (periodRaw || '24h').trim().toLowerCase();
  if (clean === '7d' || clean === '168h') {
    return { label: '7d', periodMs: 7 * 24 * 60 * 60 * 1000 };
  }
  if (clean === '30d') {
    return { label: '30d', periodMs: 30 * 24 * 60 * 60 * 1000 };
  }
  if (clean === '1h') {
    return { label: '1h', periodMs: 60 * 60 * 1000 };
  }
  const numMs = Number(clean);
  if (Number.isFinite(numMs) && numMs > 0) {
    return { label: `${numMs}ms`, periodMs: numMs };
  }
  return { label: '24h', periodMs: 24 * 60 * 60 * 1000 };
}

export async function funnelRoutes(fastify: FastifyInstance): Promise<void> {
  if (!fastify.hasDecorator('funnelService')) {
    fastify.decorate('funnelService', new SearchFunnelService());
  }

  fastify.get('/v1/analytics/funnel', async (request: FastifyRequest) => {
    const queryObj = (request.query || {}) as { period?: string };
    const { label, periodMs } = parsePeriodToMs(queryObj.period);
    const metrics = fastify.funnelService.getMetrics(periodMs);

    return {
      ok: true,
      period: label,
      periodMs,
      metrics,
      ...metrics,
    };
  });

  fastify.post(
    '/v1/analytics/funnel/event',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = funnelEventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        });
      }

      const stored = fastify.funnelService.addEvent(parsed.data);

      return {
        ok: true,
        accepted: true,
        event: stored,
      };
    }
  );
}

(funnelRoutes as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;
