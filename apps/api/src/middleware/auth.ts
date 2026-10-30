/// <reference path="../types/fastify.d.ts" />
import { FastifyReply, FastifyRequest } from 'fastify';
import * as crypto from 'crypto';
import { demoRateLimit } from './rate-limit-demo';
import { TenantNamespaceManager } from '../services/multi-tenancy';
import { ApiKeyManager, ApiKeyScopeRole } from '../services/api-key-manager';
import { maskApiKey, OperationalLogStore } from '../services/structured-logger';

const PUBLIC_ENDPOINTS = [
  '/v1/health',
  '/v1/health/live',
  '/v1/health/ready',
  '/v1/ready',
  '/ready',
  '/live',
  '/v1/catalog/stats',
  '/v1/metrics',
  '/v1/telemetry',
  '/health',
  '/api/health',
  '/metrics',
  '/docs',
];

const WEAK_KEY_BLACKLIST = new Set([
  'your_secret_key',
  'eidos_dev_key',
  'test-key',
  'eidos_test_key_1',
  'changeme',
  'password',
  'admin',
  'secret',
  '123456',
]);

/**
 * Validates that a production deployment has a strong Master or Admin key configured.
 * Throws an error to prevent startup if a weak or missing key is detected in strict production mode.
 */
export function validateProductionKeyPolicy(env: NodeJS.ProcessEnv = process.env): {
  valid: boolean;
  reason?: string;
} {
  if (env.NODE_ENV !== 'production') {
    return { valid: true };
  }

  const candidateKey =
    env.EIDOS_MASTER_KEY || env.MASTER_KEY || env.EIDOS_ADMIN_KEY || env.EIDOS_API_KEY || '';
  const trimmed = candidateKey.trim();

  if (!trimmed) {
    return {
      valid: false,
      reason:
        'Missing EIDOS_MASTER_KEY / EIDOS_ADMIN_KEY / EIDOS_API_KEY in production. Refusing to start without a strong secret key.',
    };
  }

  if (WEAK_KEY_BLACKLIST.has(trimmed) || trimmed.length < 12) {
    return {
      valid: false,
      reason:
        'Insecure or short API key detected in production (minimum 12 characters required, default dev keys forbidden).',
    };
  }

  return { valid: true };
}

/**
 * Constant-time string comparison using fixed-length SHA-256 digests
 * to prevent timing side-channel attacks (including token length leakage).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}

interface JwtValidationResult {
  isJwt: boolean;
  isValid: boolean;
  isExpired: boolean;
}

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

export function signJwtToken(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function isSearchOrPublicReadRoute(method: string, cleanPath: string): boolean {
  if (
    cleanPath === '/v1/search' ||
    cleanPath === '/v1/recommend' ||
    cleanPath.startsWith('/v1/recommend/') ||
    cleanPath === '/v1/feedback' ||
    cleanPath === '/v1/funnel/event' ||
    cleanPath === '/v1/optimize/pareto' ||
    cleanPath === '/v1/telemetry/kinetic'
  ) {
    return true;
  }
  if (
    method === 'GET' &&
    (cleanPath.startsWith('/v1/catalog') || cleanPath === '/v1/indexes')
  ) {
    return true;
  }
  return false;
}

function isKeyManagementRoute(cleanPath: string): boolean {
  return cleanPath.startsWith('/v1/keys') || cleanPath.startsWith('/v1/admin/keys');
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<unknown> {
  const cleanPath = request.url.split('?')[0];
  request.tenantId = TenantNamespaceManager.getInstance().resolveTenantId(request);

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

  const reqId = (request.headers['x-request-id'] as string) || undefined;
  const logStore = OperationalLogStore.getInstance();

  if (!token) {
    request.log.warn({
      event: 'auth_failed',
      reason: 'missing_token',
      requestId: reqId,
      ip: request.ip,
      path: request.url,
    });
    logStore.record('warn', 'auth_failed', {
      requestId: reqId,
      ip: request.ip,
      path: cleanPath,
      method: request.method,
      statusCode: 401,
      details: { reason: 'missing_token' },
    });
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message:
        'Missing or malformed Authorization header. Expected format: Bearer <API_KEY> or x-api-key header',
    });
  }

  const maskedKey = maskApiKey(token);

  // Determine if request is a read-only demo-eligible endpoint (/v1/search, /v1/recommend, /v1/catalog/stats)
  const isReadOnlyDemoEndpoint =
    cleanPath === '/v1/search' ||
    cleanPath === '/v1/recommend' ||
    (request.method === 'GET' && cleanPath.startsWith('/v1/catalog'));

  const configuredDemoKey = process.env.EIDOS_PUBLIC_DEMO_KEY;
  const demoKeys = [
    configuredDemoKey,
    'eidos_public_demo_key_2026',
    'eidos_demo_key',
    'eidos_public_demo_key',
    'eidos_demo_key_2026_public',
  ].filter(Boolean) as string[];

  const isDemoKey = demoKeys.some((k) => timingSafeEqual(token, k));
  if (isDemoKey) {
    if (isReadOnlyDemoEndpoint) {
      request.demoMode = true;
      request.demoRateLimit = 10;
      request.apiKeyContext = {
        keyId: maskedKey,
        role: 'search',
        tenantId: request.tenantId || 'default',
      };
      await demoRateLimit(request, reply);
      return;
    }
    logStore.record('warn', 'auth_failed', {
      requestId: reqId,
      keyId: maskedKey,
      ip: request.ip,
      path: cleanPath,
      method: request.method,
      statusCode: 401,
      details: { reason: 'demo_key_write_forbidden' },
    });
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Public demo key is restricted to read-only search and recommendation endpoints.',
    });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const masterKeyEnv = (process.env.EIDOS_MASTER_KEY || process.env.MASTER_KEY || '').trim();
  const adminKeyEnv = (process.env.EIDOS_ADMIN_KEY || '').trim();
  const searchKeyEnv = (process.env.EIDOS_SEARCH_KEY || '').trim();
  const rawEnvKey =
    process.env.EIDOS_API_KEY && process.env.EIDOS_API_KEY !== 'your_secret_key'
      ? process.env.EIDOS_API_KEY.trim()
      : undefined;

  if (!rawEnvKey && !masterKeyEnv && !adminKeyEnv) {
    request.log.warn('Using default API key. Set EIDOS_MASTER_KEY / EIDOS_API_KEY in production!');
  }

  // 1. Check JWT token first
  const jwtSecret =
    process.env.JWT_SECRET ||
    rawEnvKey ||
    adminKeyEnv ||
    masterKeyEnv ||
    (isProduction ? '' : 'eidos_jwt_secret');

  const jwtCheck = validateJwtToken(token, jwtSecret);
  if (jwtCheck.isJwt) {
    if (jwtCheck.isExpired) {
      request.log.warn({
        event: 'auth_failed',
        reason: 'token_expired',
        requestId: reqId,
        ip: request.ip,
        path: request.url,
      });
      logStore.record('warn', 'auth_failed', {
        requestId: reqId,
        keyId: maskedKey,
        ip: request.ip,
        path: cleanPath,
        method: request.method,
        statusCode: 401,
        details: { reason: 'token_expired' },
      });
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication token has expired.',
      });
    }

    if (jwtCheck.isValid) {
      request.apiKeyContext = {
        keyId: maskedKey,
        role: 'admin',
        tenantId: request.tenantId || 'default',
      };
      return;
    }
  }

  // 2. Check managed API keys (ApiKeyManager)
  const keyManager = request.server?.keyManager || ApiKeyManager.getInstance();
  if (keyManager && keyManager.isRevokedOrExpired(token)) {
    request.log.warn({
      event: 'auth_failed',
      reason: 'key_revoked_or_expired',
      requestId: reqId,
      ip: request.ip,
      path: request.url,
    });
    logStore.record('warn', 'auth_failed', {
      requestId: reqId,
      keyId: maskedKey,
      ip: request.ip,
      path: cleanPath,
      method: request.method,
      statusCode: 401,
      details: { reason: 'key_revoked_or_expired' },
    });
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'API key has been revoked or expired.',
    });
  }

  let resolvedRole: ApiKeyScopeRole | null = null;
  let boundTenantId: string | undefined;
  let allowedIndexes: string[] | undefined;
  let allowedFilters: Record<string, unknown> | undefined;

  if (keyManager && keyManager.isValid(token)) {
    const record = keyManager.getRecord(token);
    if (record) {
      resolvedRole = record.role || 'admin';
      boundTenantId = record.tenant_id;
      allowedIndexes = record.allowed_indexes;
      allowedFilters = record.allowed_filters;
    }
  }

  // 3. Check Environment Hierarchy Keys (MASTER_KEY -> Admin Key -> Search Key)
  if (!resolvedRole) {
    if (masterKeyEnv && timingSafeEqual(token, masterKeyEnv)) {
      resolvedRole = 'master';
    } else if (
      (adminKeyEnv && timingSafeEqual(token, adminKeyEnv)) ||
      (rawEnvKey && timingSafeEqual(token, rawEnvKey))
    ) {
      resolvedRole = 'admin';
    } else if (searchKeyEnv && timingSafeEqual(token, searchKeyEnv)) {
      resolvedRole = 'search';
    } else if (!isProduction) {
      const devAdminKeys = ['eidos_dev_key', 'eidos_test_key_1', 'test-key'];
      if (devAdminKeys.some((k) => timingSafeEqual(token, k))) {
        resolvedRole = 'admin';
      } else if (token.startsWith('eidos_readonly_') || token.startsWith('eidos_viewer_') || token.startsWith('eidos_pk_')) {
        resolvedRole = 'search';
      } else if (token.startsWith('eidos_merch_') || token.startsWith('eidos_editor_') || token.startsWith('eidos_mk_')) {
        resolvedRole = 'merchandiser';
      }
    }
  }

  if (!resolvedRole) {
    request.log.warn({
      event: 'auth_failed',
      reason: 'invalid_key',
      requestId: reqId,
      keyId: maskedKey,
      ip: request.ip,
      path: request.url,
    });
    logStore.record('warn', 'auth_failed', {
      requestId: reqId,
      keyId: maskedKey,
      ip: request.ip,
      path: cleanPath,
      method: request.method,
      statusCode: 401,
      details: { reason: 'invalid_key' },
    });
    return reply.status(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid API key provided.',
    });
  }

  // 4. Enforce Tenant Isolation when key is bound to a specific non-default tenant
  if (boundTenantId && boundTenantId !== 'default') {
    const requestedHeaderTenant = request.headers['x-tenant-id'];
    if (
      typeof requestedHeaderTenant === 'string' &&
      requestedHeaderTenant.trim() !== '' &&
      requestedHeaderTenant.trim().toLowerCase() !== boundTenantId.toLowerCase()
    ) {
      logStore.record('warn', 'auth_tenant_mismatch', {
        requestId: reqId,
        keyId: maskedKey,
        tenantId: boundTenantId,
        path: cleanPath,
        statusCode: 403,
        details: { requestedTenant: requestedHeaderTenant, boundTenantId },
      });
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `API key is scoped to tenant '${boundTenantId}' and cannot access tenant '${requestedHeaderTenant}'.`,
      });
    }
    request.tenantId = boundTenantId;
    request.headers['x-tenant-id'] = boundTenantId;
  } else if (boundTenantId && !request.headers['x-tenant-id']) {
    request.tenantId = boundTenantId;
  }

  // 5. Enforce Scoped Index restriction if key specifies allowedIndexes
  if (allowedIndexes && allowedIndexes.length > 0) {
    const bodyObj = (request.body as Record<string, unknown>) || {};
    const queryObj = (request.query as Record<string, unknown>) || {};
    const requestedIndex = String(
      request.headers['x-index-name'] ||
        bodyObj.indexName ||
        bodyObj.index ||
        queryObj.indexName ||
        queryObj.index ||
        'default'
    );
    if (!allowedIndexes.includes(requestedIndex) && !allowedIndexes.includes('*')) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `API key is not authorized for index '${requestedIndex}'. Allowed indexes: ${allowedIndexes.join(', ')}`,
      });
    }
  }

  request.apiKeyContext = {
    keyId: maskedKey,
    role: resolvedRole,
    tenantId: request.tenantId || 'default',
    isMasterKey: resolvedRole === 'master',
    allowedIndexes,
    allowedFilters,
  };

  // 6. Enforce Key Hierarchy (Master Key / Admin Key / Search Key)
  if (isKeyManagementRoute(cleanPath)) {
    // If EIDOS_MASTER_KEY is explicitly configured in production, require Master Key or Admin Key for key management
    if (resolvedRole !== 'master' && resolvedRole !== 'admin') {
      logStore.record('warn', 'auth_forbidden_role', {
        requestId: reqId,
        keyId: maskedKey,
        path: cleanPath,
        method: request.method,
        statusCode: 403,
        details: { role: resolvedRole, required: 'master_or_admin' },
      });
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Master Key or Admin Key is required to manage or rotate API keys.',
      });
    }
  } else if (resolvedRole === 'search') {
    if (!isSearchOrPublicReadRoute(request.method, cleanPath)) {
      logStore.record('warn', 'auth_forbidden_role', {
        requestId: reqId,
        keyId: maskedKey,
        path: cleanPath,
        method: request.method,
        statusCode: 403,
        details: { role: 'search', required: 'admin' },
      });
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message:
          'Search Key is restricted to search, recommendation, and public read endpoints. Admin Key is required for write or admin operations.',
      });
    }
  }
}
