import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import helmet from './helmet-shim';
import { FastifyInstance } from 'fastify';

export async function securityPlugin(fastify: FastifyInstance): Promise<void> {
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : [
        'https://eidos-semantic-ideation-platform.ai.studio',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ];

  // CORS with explicit origin whitelist
  await fastify.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  });

  // Ensure all 3 CORS headers are always emitted even on direct curl requests without Origin header
  fastify.addHook('onSend', async (request, reply, payload) => {
    const reqOrigin = request.headers.origin;
    const matchedOrigin =
      reqOrigin && allowedOrigins.includes(reqOrigin) ? reqOrigin : allowedOrigins[0];

    if (!reply.getHeader('access-control-allow-origin')) {
      reply.header('access-control-allow-origin', matchedOrigin);
    }
    if (!reply.getHeader('access-control-allow-methods')) {
      reply.header('access-control-allow-methods', 'GET, POST, OPTIONS');
    }
    if (!reply.getHeader('access-control-allow-credentials')) {
      reply.header('access-control-allow-credentials', 'true');
    }
    return payload;
  });

  // Rate limiting with in-memory cache and X-API-Key / IP key generator
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: '1 minute',
    cache: 10000,
    allowList: process.env.RATE_LIMIT_ALLOWLIST
      ? process.env.RATE_LIMIT_ALLOWLIST.split(',').map((ip) => ip.trim())
      : [],
    skipOnError: true,
    keyGenerator: (request) => {
      return (request.headers['x-api-key'] as string) || request.ip;
    },
  });

  // Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, COOP, CORP)
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:'],
      },
    },
  });
}

(securityPlugin as any)[Symbol.for('skip-override')] = true;
