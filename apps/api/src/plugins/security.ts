import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { FastifyInstance } from 'fastify';

export async function securityPlugin(fastify: FastifyInstance): Promise<void> {
  // CORS with explicit origin whitelist
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
      : [
          'https://eidos-semantic-ideation-platform.ai.studio',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
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

  // Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
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
