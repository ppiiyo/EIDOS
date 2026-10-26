/// <reference path="../types/fastify.d.ts" />
import { FastifyRequest, FastifyReply } from 'fastify';

const demoRequests = new Map<string, { count: number; resetAt: number }>();

export async function demoRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.demoMode) return;

  const key = request.ip || 'unknown';
  const now = Date.now();
  const record = demoRequests.get(key);

  const limit = request.demoRateLimit || 10;

  if (!record || record.resetAt < now) {
    demoRequests.set(key, { count: 1, resetAt: now + 60000 });
    return;
  }

  if (record.count >= limit) {
    reply.status(429).send({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Demo key rate limit exceeded (${limit} req/min). Get your own API key for production use.`,
    });
    return;
  }

  record.count++;
}
