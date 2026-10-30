import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiKeyManager } from '../services/api-key-manager';
import { authenticate } from '../middleware/auth';
import { OperationalLogStore } from '../services/structured-logger';

const revokeSchema = z.object({
  key_hash: z.string().length(64),
});

const rotateSchema = z.object({
  key_hash: z.string().length(64),
  grace_period_seconds: z.number().int().min(0).max(86400 * 7).optional().default(300),
});

const generateSchema = z.object({
  tenant_id: z.string().min(1).max(128).default('default'),
  role: z.enum(['admin', 'search', 'merchandiser']).optional().default('admin'),
  description: z.string().max(256).optional(),
  allowed_indexes: z.array(z.string().min(1).max(128)).max(50).optional(),
  allowed_filters: z.record(z.unknown()).optional(),
  expires_in_days: z.number().int().min(1).max(3650).optional(),
});

export interface KeyRoutesOptions {
  keyManager?: ApiKeyManager;
}

export async function keyRoutes(fastify: FastifyInstance, opts: KeyRoutesOptions) {
  const manager = opts.keyManager || fastify.keyManager || ApiKeyManager.getInstance();
  const logStore = OperationalLogStore.getInstance();

  fastify.post('/v1/keys/revoke', { preHandler: authenticate }, async (request, reply) => {
    const parseResult = revokeSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid key_hash' });
    }

    const success = manager.revokeKey(parseResult.data.key_hash);
    if (!success) {
      return reply.status(404).send({ error: 'Key not found' });
    }

    logStore.record('info', 'key_revoked', {
      requestId: request.headers['x-request-id'] as string,
      keyId: request.apiKeyContext?.keyId,
      details: { revokedKeyHash: parseResult.data.key_hash },
    });

    return { success: true, message: 'Key revoked' };
  });

  fastify.post('/v1/keys/rotate', { preHandler: authenticate }, async (request, reply) => {
    const parseResult = rotateSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid key rotation parameters' });
    }

    const rotated = manager.rotateKey(
      parseResult.data.key_hash,
      parseResult.data.grace_period_seconds
    );
    if (!rotated) {
      return reply.status(404).send({ error: 'Key not found or already revoked' });
    }

    logStore.record('info', 'key_rotated', {
      requestId: request.headers['x-request-id'] as string,
      keyId: request.apiKeyContext?.keyId,
      tenantId: rotated.tenant_id,
      details: {
        oldKeyHash: rotated.old_key_hash,
        newKeyHash: rotated.new_key_hash,
        gracePeriodSeconds: parseResult.data.grace_period_seconds,
      },
    });

    return {
      success: true,
      ...rotated,
    };
  });

  fastify.post('/v1/keys/generate', { preHandler: authenticate }, async (request, reply) => {
    const parseResult = generateSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid key generation parameters' });
    }

    // If EIDOS_MASTER_KEY is explicitly configured in production, creating an 'admin' key requires Master Key
    const hasExplicitMasterKey = Boolean(
      (process.env.EIDOS_MASTER_KEY || process.env.MASTER_KEY || '').trim()
    );
    if (
      hasExplicitMasterKey &&
      parseResult.data.role === 'admin' &&
      !request.apiKeyContext?.isMasterKey
    ) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'MASTER_KEY is required to generate Admin keys when EIDOS_MASTER_KEY is configured.',
      });
    }

    const expiresAt = parseResult.data.expires_in_days
      ? new Date(Date.now() + parseResult.data.expires_in_days * 86400_000)
      : undefined;

    const generated = manager.generateKey({
      tenantId: parseResult.data.tenant_id,
      role: parseResult.data.role,
      description: parseResult.data.description,
      allowedIndexes: parseResult.data.allowed_indexes,
      allowedFilters: parseResult.data.allowed_filters,
      expiresAt,
    });

    logStore.record('info', 'key_generated', {
      requestId: request.headers['x-request-id'] as string,
      keyId: request.apiKeyContext?.keyId,
      tenantId: generated.tenant_id,
      details: {
        generatedKeyHash: generated.key_hash,
        role: generated.role,
        allowedIndexes: parseResult.data.allowed_indexes,
      },
    });

    return {
      success: true,
      key: generated.key,
      key_hash: generated.key_hash,
      key_prefix: generated.key_prefix,
      role: generated.role,
      tenant_id: generated.tenant_id,
      allowed_indexes: parseResult.data.allowed_indexes ?? null,
      expires_at: expiresAt?.toISOString() ?? null,
    };
  });

  fastify.get('/v1/keys', { preHandler: authenticate }, async (request) => {
    const tenantFilter = (request.query as { tenant_id?: string })?.tenant_id;
    return {
      keys: manager.listKeys(tenantFilter).map((k) => ({
        key_hash: k.key_hash,
        key_prefix: k.key_prefix,
        role: k.role,
        description: k.description ?? null,
        tenant_id: k.tenant_id,
        allowed_indexes: k.allowed_indexes ?? null,
        created_at: k.created_at.toISOString(),
        revoked_at: k.revoked_at ? k.revoked_at.toISOString() : null,
        expires_at: k.expires_at ? k.expires_at.toISOString() : null,
        rotated_to_hash: k.rotated_to_hash ?? null,
      })),
    };
  });
}
