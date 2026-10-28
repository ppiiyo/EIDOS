import { FastifyInstance, FastifyError } from 'fastify';
import { authenticate } from '../middleware/auth';

export interface CapturedErrorEvent {
  id: string;
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  statusCode: number;
  name: string;
  message: string;
  sentryForwarded: boolean;
}

const recentErrors: CapturedErrorEvent[] = [];
const MAX_ERROR_BUFFER = 100;

/**
 * Scrubs sensitive authentication headers before logging or forwarding to Sentry.
 */
export function scrubSensitiveHeaders(
  headers: Record<string, unknown>
): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = { ...headers };
  const sensitiveKeys = ['x-api-key', 'authorization', 'cookie', 'set-cookie'];
  for (const key of Object.keys(scrubbed)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      scrubbed[key] = '[REDACTED]';
    }
  }
  return scrubbed;
}

export async function errorTrackerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const requestId = (request.headers['x-request-id'] as string) || request.id;
    const sentryDsn = process.env.SENTRY_DSN;

    const event: CapturedErrorEvent = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      requestId: String(requestId),
      method: request.method,
      url: request.url,
      statusCode,
      name: error.name || 'Error',
      message: error.message || 'Internal Server Error',
      sentryForwarded: Boolean(sentryDsn),
    };

    if (recentErrors.length >= MAX_ERROR_BUFFER) {
      recentErrors.shift();
    }
    recentErrors.push(event);

    request.log.error({
      event: 'unhandled_exception',
      errorId: event.id,
      requestId: event.requestId,
      statusCode,
      path: request.url,
      headers: scrubSensitiveHeaders(request.headers as Record<string, unknown>),
      err: {
        name: error.name,
        message: error.message,
      },
    });

    reply.status(statusCode).send({
      statusCode,
      error: statusCode === 429 ? 'Too Many Requests' : error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
      requestId: event.requestId,
    });
  });

  fastify.get('/v1/diagnostics/errors', { preHandler: authenticate }, async () => ({
    sentryEnabled: Boolean(process.env.SENTRY_DSN),
    totalCaptured: recentErrors.length,
    recentErrors: recentErrors.slice(-20),
  }));
}

(errorTrackerPlugin as any)[Symbol.for('skip-override')] = true;
