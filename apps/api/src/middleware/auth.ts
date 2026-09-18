import { FastifyReply, FastifyRequest } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  const configuredKey = process.env.EIDOS_API_KEY || 'eidos_dev_key';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected format: Bearer <API_KEY>',
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (token !== configuredKey) {
    reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid API key provided.',
    });
    return;
  }
}
