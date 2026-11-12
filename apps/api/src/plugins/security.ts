import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import helmet from './helmet-shim';
import { FastifyInstance } from 'fastify';

export async function securityPlugin(fastify: FastifyInstance): Promise<void> {
  const rawCorsOrigins = process.env.CORS_ORIGIN || process.env.CORS_ALLOWED_ORIGINS || '';
  const origins = rawCorsOrigins
    ? rawCorsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [
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
      ? '*'
      : reqOrigin && origins.includes(reqOrigin)
        ? reqOrigin
        : origins[0];

    if (!reply.getHeader('access-control-allow-origin')) {
      reply.header('access-control-allow-origin', matchedOrigin);
    }
    if (!reply.getHeader('access-control-allow-methods')) {
      reply.header('access-control-allow-methods', allowedMethods.join(', '));
    }
    if (!reply.getHeader('access-control-allow-headers')) {
      reply.header(
        'access-control-allow-headers',
        'Content-Type, Authorization, X-API-Key, X-Tenant-Id, X-Index-Name, X-Request-Id'
      );
    }
    return payload;
  });

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

  await fastify.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  });
}
