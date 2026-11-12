import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import helmet from './helmet-shim';
import { FastifyInstance } from 'fastify';

export async function securityPlugin(fastify: FastifyInstance): Promise<void> {
  const rawCorsOrigins = process.env.CORS_ORIGIN || process.env.CORS_ALLOWED_ORIGINS || '';
  const origins = rawCorsOrigins
    ? rawCorsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [
        'https://eidos-semantic-ideation-platform.ai.studio',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];
  const isWildcardOrigin = origins.includes('*');
  const corsOriginOption = isWildcardOrigin ? true : origins;
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

  // CORS with explicit origin whitelist (or wildcard when '*' is configured)
  await fastify.register(cors, {
    origin: corsOriginOption,
    methods: allowedMethods,
    credentials: !isWildcardOrigin,
  });

  // Ensure all 3 CORS headers are always emitted even on direct curl requests without Origin header
  fastify.addHook('onSend', async (request, reply, payload) => {
    const reqOrigin = request.headers.origin;
    const matchedOrigin = isWildcardOrigin
      ? reqOrigin || '*'
      : reqOrigin && origins.includes(reqOrigin)
      ? reqOrigin
      : origins[0];

    if (!reply.getHeader('access-control-allow-origin')) {
      reply.header('access-control-allow-origin', matchedOrigin);
    }
    if (!reply.getHeader('access-control-allow-methods')) {
      reply.header('access-control-allow-methods', allowedMethods.join(', '));
    }
    if (!isWildcardOrigin && !reply.getHeader('access-control-allow-credentials')) {
      reply.header('access-control-allow-credentials', 'true');
    }
    return payload;
  });

  // Rate limiting keyed by client IP (never trust unauthenticated X-API-Key header for bucket selection)
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || process.env.EIDOS_RATE_LIMIT_MAX || '300', 10),
    timeWindow: '1 minute',
    cache: 10000,
    allowList: process.env.RATE_LIMIT_ALLOWLIST
      ? process.env.RATE_LIMIT_ALLOWLIST.split(',').map((ip) => ip.trim())
      : [],
    skipOnError: true,
    keyGenerator: (request) => {
      return request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      code: 'RATE_LIMIT',
      error: 'Too Many Requests',
      retryAfterMs: typeof context.ttl === 'number' && context.ttl > 0 ? context.ttl : 12000,
      message: 'Rate limit exceeded. Retry shortly.',
    }),
  });

  // Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, COOP, CORP).
  // Note: 'unsafe-inline' is intentionally omitted from scriptSrc to mitigate XSS vectors on API and
  // SPA fallback responses. Studio UI loads its application bundle via external ES module scripts
  // ('self'), while styleSrc retains 'unsafe-inline' for runtime Tailwind/CSS style injection.
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:'],
      },
    },
  });
}

(securityPlugin as any)[Symbol.for('skip-override')] = true;
