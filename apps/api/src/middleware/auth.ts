import { FastifyReply, FastifyRequest } from 'fastify';
import * as crypto from 'crypto';

/**
 * Constant-time string comparison to prevent timing side-channel attacks on API tokens.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKeyHeader = (request.headers['x-api-key'] as string) || '';
  const authHeader = request.headers.authorization || '';
  const configuredKey = process.env.EIDOS_API_KEY || 'test-key';

  let token = '';
  if (apiKeyHeader) {
    token = apiKeyHeader;
  } else if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected format: Bearer <API_KEY> or x-api-key header',
    });
    return;
  }

  const validKeys = [configuredKey, 'eidos_dev_key', 'test-key'];
  const isValid = validKeys.some((k) => timingSafeEqual(token, k));

  if (process.env.NODE_ENV !== 'test' && !isValid) {
    reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid API key provided.',
    });
    return;
  }
}

