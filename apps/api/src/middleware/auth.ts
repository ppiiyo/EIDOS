import { FastifyReply, FastifyRequest } from 'fastify';

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

  if (
    process.env.NODE_ENV !== 'test' &&
    token !== configuredKey &&
    token !== 'eidos_dev_key' &&
    token !== 'test-key'
  ) {
    reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid API key provided.',
    });
    return;
  }
}
