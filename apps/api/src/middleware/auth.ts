/// <reference path="../types/fastify.d.ts" />
import { FastifyReply, FastifyRequest } from 'fastify';
import * as crypto from 'crypto';
import { demoRateLimit } from './rate-limit-demo';
import { TenantNamespaceManager } from '../services/multi-tenancy';
import { ApiKeyManager } from '../services/api-key-manager';

const PUBLIC_ENDPOINTS = [
  '/v1/health',
  '/v1/health/live',
  '/v1/health/ready',
  '/v1/catalog/stats',
  '/v1/metrics',
  '/v1/telemetry',
  '/health',
  '/api/health',
  '/metrics',
  '/docs',
];

/**
 * Constant-time string comparison using fixed-length SHA-256 digests
 * to prevent timing side-channel attacks (including token length leakage).
 */
function timingSafeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}

interface JwtValidationResult {
  isJwt: boolean;
  isValid: boolean;
  isExpired: boolean;
}

/**
 * Validates JWT structure, expiration claim (exp), and optional HMAC-SHA256 signature.
 */
function validateJwtToken(token: string, secret: string): JwtValidationResult {
  const parts = token.split('.');
  if (parts.length !== 3 || !token.startsWith('eyJ')) {
    return { isJwt: false, isValid: false, isExpired: false };
  }

  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { exp?: number; nbf?: number };

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp <= nowSec) {
      return { isJwt: true, isValid: false, isExpired: true };
    }
    if (typeof payload.nbf === 'number' && payload.nbf > nowSec) {
      return { isJwt: true, isValid: false, isExpired: false };
    }

    if (!secret) {
      return { isJwt: true, isValid: false, isExpired: false };
    }

    const signingInput = `${parts[0]}.${parts[1]}`;
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(signingInput)
      .digest('base64url');

    const sigMatches = timingSafeEqual(parts[2], expectedSig);
    return { isJwt: true, isValid: sigMatches, isExpired: false };
  } catch {
    return { isJwt: true, isValid: false, isExpired: false };
  }
}

/**
 * Helper to sign JWT tokens for authenticated clients and tests.
 */
export function signJwtToken(
  payload: Record<string, unknown>,
  secret: string
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}


export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const cleanPath = request.url.split('?')[0];
  request.tenantId = TenantNamespaceManager.getInstance().resolveTenantId(request);

  // Whitelist public endpoints (no auth required)
  if (PUBLIC_ENDPOINTS.includes(cleanPath) || cleanPath.startsWith('/docs')) {
    return;
  }

  const apiKeyHeader = (request.headers['x-api-key'] as string) || '';
  const authHeader = request.headers.authorization || '';

  let token = '';
  if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  } else if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    request.log.warn({
      event: 'auth_failed',
      reason: 'missing_token',
      ip: request.ip,
      path: request.url,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message:
        'Missing or malformed Authorization header. Expected format: Bearer <API_KEY> or x-api-key header',
    });
  }

  // Determine if request is a read-only demo-eligible endpoint (/v1/search, /v1/recommend, /v1/catalog/stats)
  const isReadOnlyDemoEndpoint =
    cleanPath === '/v1/search' ||
    cleanPath === '/v1/recommend' ||
    (request.method === 'GET' && cleanPath.startsWith('/v1/catalog'));

  // Check if token is a public demo key on read-only demo endpoints
  const configuredDemoKey = process.env.EIDOS_PUBLIC_DEMO_KEY;
  const demoKeys = [
    configuredDemoKey,
    'eidos_public_demo_key_2026',
    'eidos_demo_key',
    'eidos_public_demo_key',
    'eidos_demo_key_2026_public',
  ].filter(Boolean) as string[];

  const isDemoKey = demoKeys.some((k) => timingSafeEqual(token, k));
  if (isDemoKey && isReadOnlyDemoEndpoint) {
    request.demoMode = true;
    request.demoRateLimit = 10;
    await demoRateLimit(request, reply);
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const rawEnvKey =
    process.env.EIDOS_API_KEY && process.env.EIDOS_API_KEY !== 'your_secret_key'
      ? process.env.EIDOS_API_KEY
      : undefined;

  if (!rawEnvKey) {
    request.log.warn('Using default API key. Set EIDOS_API_KEY in production!');
  }

  const configuredProdKey = rawEnvKey || 'eidos_dev_key';

  const publicDemoKeys = isReadOnlyDemoEndpoint
    ? [
        process.env.EIDOS_PUBLIC_DEMO_KEY,
        'eidos_demo_key',
        'eidos_public_demo_key',
        'eidos_demo_key_2026_public',
        ...(!rawEnvKey ? ['eidos_dev_key', 'test-key'] : []),
      ]
    : [];

  const validKeys = isProduction
    ? [configuredProdKey, ...publicDemoKeys].filter((k): k is string => Boolean(k))
    : [
        configuredProdKey,
        process.env.EIDOS_PUBLIC_DEMO_KEY,
        'eidos_demo_key',
        'eidos_public_demo_key',
        'eidos_demo_key_2026_public',
        'eidos_dev_key',
        'eidos_test_key_1',
        'test-key',
      ].filter((k): k is string => Boolean(k));

  const jwtSecret =
    process.env.JWT_SECRET ||
    process.env.EIDOS_API_KEY ||
    (isProduction ? '' : 'eidos_jwt_secret');

  // Check if token is a JWT and validate expiration + signature
  const jwtCheck = validateJwtToken(token, jwtSecret);
  if (jwtCheck.isJwt) {
    if (jwtCheck.isExpired) {
      request.log.warn({
        event: 'auth_failed',
        reason: 'token_expired',
        ip: request.ip,
        path: request.url,
        userAgent: request.headers['user-agent'],
      });
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token has expired.',
      });
    }

    if (jwtCheck.isValid) {
      return;
    }
  }

  const keyManager = request.server?.keyManager || ApiKeyManager.getInstance();
  if (keyManager && keyManager.isRevokedOrExpired(token)) {
    request.log.warn({
      event: 'auth_failed',
      reason: 'key_revoked_or_expired',
      ip: request.ip,
      path: request.url,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'API key has been revoked or expired.',
    });
  }

  if (keyManager && keyManager.isValid(token)) {
    const record = keyManager.getRecord(token);
    if (record && !request.headers['x-tenant-id']) {
      request.tenantId = record.tenant_id;
    }
    return;
  }

  const isValid = validKeys.some((k) => timingSafeEqual(token, k));

  if (!isValid) {
    request.log.warn({
      event: 'auth_failed',
      reason: 'invalid_key',
      ip: request.ip,
      path: request.url,
      userAgent: request.headers['user-agent'],
    });
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid API key provided.',
    });
  }
}
