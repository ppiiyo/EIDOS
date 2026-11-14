import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { SearchFunnelService } from '../services/search-funnel';

const funnelEventSchema = z.object({
  type: z.enum(['search', 'click', 'purchase']),
  sessionId: z.string().min(1).max(128).optional().default('anonymous'),
  query: z.string().max(256).optional(),
  itemId: z.string().max(128).optional(),
  userId: z.string().max(128).optional(),
  timestamp: z.number().optional(),
});

const funnelRateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkFunnelRateLimit(request: FastifyRequest, reply: FastifyReply): boolean {
  const ip = request.ip || '127.0.0.1';
  const now = Date.now();
  const maxPerMin = Number(
    process.env.EIDOS_FUNNEL_RATE_LIMIT_MAX_PER_MIN ||
      process.env.EIDOS_FUNNEL_RATE_LIMIT_MAX ||
      180
  );

  if (funnelRateBuckets.size > 2000) {
    for (const [k, v] of funnelRateBuckets.entries()) {
      if (v.resetAt < now) funnelRateBuckets.delete(k);
    }
  }

  const entry = funnelRateBuckets.get(ip);
  if (!entry || entry.resetAt < now) {
    funnelRateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMin) {
    reply.status(429).send({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Funnel event rate limit exceeded.',
    });
    return false;
  }
  entry.count += 1;
  return true;
}

async function enforceFunnelSecurity(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  if (!checkFunnelRateLimit(request, reply)) {
    return reply;
  }
  const cleanPath = request.url.split('?')[0];
  const hasExplicitToken = Boolean(
    request.headers['x-api-key'] || request.headers.authorization
  );
  const requireAuth =
    process.env.NODE_ENV === 'production' ||
    process.env.EIDOS_REQUIRE_FUNNEL_AUTH === 'true' ||
    cleanPath === '/v1/analytics/funnel-event' ||
    hasExplicitToken;

  if (requireAuth) {
    return await authenticate(request, reply);
  }
}

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
  funnelRateBuckets.clear();
  if (!fastify.hasDecorator('funnelService')) {
    fastify.decorate('funnelService', new SearchFunnelService());
  }

  fastify.get(
    '/v1/analytics/funnel',
    { preHandler: enforceFunnelSecurity },
    async (request: FastifyRequest) => {
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
    }
  );

  const handleFunnelEvent = async (request: FastifyRequest, reply: FastifyReply) => {
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
  };

  fastify.post(
    '/v1/analytics/funnel/event',
    { preHandler: enforceFunnelSecurity },
    handleFunnelEvent
  );

  fastify.post(
    '/v1/analytics/funnel-event',
    { preHandler: enforceFunnelSecurity },
    handleFunnelEvent
  );
}

(funnelRoutes as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;
