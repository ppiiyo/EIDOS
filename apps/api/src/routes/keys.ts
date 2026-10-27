import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApiKeyManager } from '../services/api-key-manager';
import { authenticate } from '../middleware/auth';

const revokeSchema = z.object({
  key_hash: z.string().length(64),
});

const generateSchema = z.object({
  tenant_id: z.string().min(1).max(128).default('default'),
  expires_in_days: z.number().int().min(1).max(3650).optional(),
});

export interface KeyRoutesOptions {
  keyManager?: ApiKeyManager;
}

export async function keyRoutes(fastify: FastifyInstance, opts: KeyRoutesOptions) {
  const manager = opts.keyManager || fastify.keyManager || ApiKeyManager.getInstance();

  fastify.post('/v1/keys/revoke', { preHandler: authenticate }, async (request, reply) => {
    const parseResult = revokeSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid key_hash' });
    }

    const success = manager.revokeKey(parseResult.data.key_hash);
    if (!success) {
      return reply.status(404).send({ error: 'Key not found' });
    }

    return { success: true, message: 'Key revoked' };
  });

  fastify.post('/v1/keys/generate', { preHandler: authenticate }, async (request, reply) => {
    const parseResult = generateSchema.safeParse(request.body || {});
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid key generation parameters' });
    }

    const expiresAt = parseResult.data.expires_in_days
      ? new Date(Date.now() + parseResult.data.expires_in_days * 86400_000)
      : undefined;

    const generated = manager.generateKey(parseResult.data.tenant_id, expiresAt);
    return {
      success: true,
      key: generated.key,
      key_hash: generated.key_hash,
      tenant_id: parseResult.data.tenant_id,
      expires_at: expiresAt?.toISOString() ?? null,
    };
  });

  fastify.get('/v1/keys', { preHandler: authenticate }, async (request) => {
    const tenantFilter = (request.query as { tenant_id?: string })?.tenant_id;
    return {
      keys: manager.listKeys(tenantFilter).map((k) => ({
        key_hash: k.key_hash,
        tenant_id: k.tenant_id,
        created_at: k.created_at.toISOString(),
        revoked_at: k.revoked_at ? k.revoked_at.toISOString() : null,
        expires_at: k.expires_at ? k.expires_at.toISOString() : null,
      })),
    };
  });
}
