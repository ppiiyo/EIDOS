import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { z } from 'zod';
import { Metrics } from '@eidos/core';
import { authenticate } from '../middleware/auth';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';
import { StoreRegistry } from '../services/store-registry';
import { ApiKeyManager } from '../services/api-key-manager';
import { RBACManager } from '../services/multi-tenancy';
import { getCache, CacheKeys, getSemanticCache } from '../services/cache';
import { ApiQueryCache } from '../services/query-cache';
import { getLatencyQuantiles, getAverageSearchLatencyMs } from '../plugins/observability';
import { OperationalLogStore, LogLevel } from '../services/structured-logger';

export interface SnapshotMetadata {
  snapshotId: string;
  tenantId: string;
  indexName: string;
  path: string;
  itemsCount: number;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
}

const snapshotRegistry: SnapshotMetadata[] = [];

const createAdminKeySchema = z.object({
  tenant_id: z.string().min(1).max(128).default('default'),
  role: z.enum(['admin', 'search', 'merchandiser']).default('search'),
  description: z.string().max(256).optional(),
  allowed_indexes: z.array(z.string().min(1).max(128)).max(50).optional(),
  allowed_filters: z.record(z.unknown()).optional(),
  expires_in_days: z.number().int().min(1).max(3650).optional(),
});

const rotateAdminKeySchema = z.object({
  key_hash: z.string().length(64),
  grace_period_seconds: z.number().int().min(0).max(86400 * 7).default(300),
});

export async function adminRoutes(
  fastify: FastifyInstance,
  opts: { vectorStore: VectorStore; embedder: ServerEmbedder }
): Promise<void> {
  const storeRegistry = fastify.storeRegistry || StoreRegistry.getInstance();
  storeRegistry.setDefaultStore(opts.vectorStore);
  const keyManager = fastify.keyManager || ApiKeyManager.getInstance();
  const logStore = OperationalLogStore.getInstance();
  const cache = getCache();

  function requireAdminRole(request: FastifyRequest, reply: FastifyReply): boolean {
    const role = RBACManager.resolveRole(request);
    if (!RBACManager.canManageCatalogAndConfig(role)) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Admin Key is required to access operational admin endpoints.',
      });
      return false;
    }
    return true;
  }

  /**
   * GET /v1/admin/stats
   * Comprehensive operational telemetry: index size, tenants, memory, latency percentiles, cache stats.
   */
  fastify.get('/v1/admin/stats', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;

    const mem = process.memoryUsage();
    const l1Stats = ApiQueryCache.getInstance().stats();
    const redisStats = await cache.getStats();
    const tenants = storeRegistry.listTenants();
    const indexes = storeRegistry.listIndexes();
    const totalItems = storeRegistry.getTotalVectorCount();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime() * 100) / 100,
      index: {
        totalItems,
        defaultStoreItems: opts.vectorStore.count(),
        hnswNodes: opts.vectorStore.getHNSW().size(),
        walPendingEntries: opts.vectorStore.getWAL().size(),
        activeIndexesCount: indexes.length,
        activeTenantsCount: tenants.length,
        tenants,
      },
      memory: {
        rssBytes: mem.rss,
        rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        heapUsedBytes: mem.heapUsed,
        heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalBytes: mem.heapTotal,
        heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      },
      latency: {
        avgSearchLatencyMs: getAverageSearchLatencyMs(),
        ...getLatencyQuantiles(),
      },
      cache: {
        l1: l1Stats,
        redis: redisStats,
      },
      snapshots: {
        count: snapshotRegistry.length,
        latestSnapshot: snapshotRegistry[snapshotRegistry.length - 1] ?? null,
      },
    };
  });

  /**
   * GET /v1/admin/keys
   * Lists managed API keys (masked prefixes only, never raw keys).
   */
  fastify.get('/v1/admin/keys', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const tenantFilter = (request.query as { tenant_id?: string })?.tenant_id;
    return {
      keys: keyManager.listKeys(tenantFilter).map((k) => ({
        key_hash: k.key_hash,
        key_prefix: k.key_prefix,
        role: k.role,
        description: k.description ?? null,
        tenant_id: k.tenant_id,
        allowed_indexes: k.allowed_indexes ?? null,
        allowed_filters: k.allowed_filters ?? null,
        created_at: k.created_at.toISOString(),
        revoked_at: k.revoked_at ? k.revoked_at.toISOString() : null,
        expires_at: k.expires_at ? k.expires_at.toISOString() : null,
        rotated_to_hash: k.rotated_to_hash ?? null,
      })),
    };
  });

  /**
   * POST /v1/admin/keys
   * Creates a new Admin, Search, or Scoped Tenant API key.
   */
  fastify.post('/v1/admin/keys', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;

    const parsed = createAdminKeySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      });
    }

    const hasExplicitMasterKey = Boolean(
      (process.env.EIDOS_MASTER_KEY || process.env.MASTER_KEY || '').trim()
    );
    if (hasExplicitMasterKey && parsed.data.role === 'admin' && !request.apiKeyContext?.isMasterKey) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'MASTER_KEY is required to create Admin keys when EIDOS_MASTER_KEY is set.',
      });
    }

    const expiresAt = parsed.data.expires_in_days
      ? new Date(Date.now() + parsed.data.expires_in_days * 86400_000)
      : undefined;

    const generated = keyManager.generateKey({
      tenantId: parsed.data.tenant_id,
      role: parsed.data.role,
      description: parsed.data.description,
      allowedIndexes: parsed.data.allowed_indexes,
      allowedFilters: parsed.data.allowed_filters,
      expiresAt,
    });

    logStore.record('info', 'admin.key_created', {
      requestId: request.headers['x-request-id'] as string,
      keyId: request.apiKeyContext?.keyId,
      tenantId: generated.tenant_id,
      details: { keyHash: generated.key_hash, role: generated.role },
    });

    return reply.status(201).send({
      success: true,
      key: generated.key,
      key_hash: generated.key_hash,
      key_prefix: generated.key_prefix,
      role: generated.role,
      tenant_id: generated.tenant_id,
      allowed_indexes: parsed.data.allowed_indexes ?? null,
      allowed_filters: parsed.data.allowed_filters ?? null,
      expires_at: expiresAt?.toISOString() ?? null,
    });
  });

  /**
   * POST /v1/admin/keys/rotate
   * Zero-downtime key rotation with configurable grace period.
   */
  fastify.post('/v1/admin/keys/rotate', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const parsed = rotateAdminKeySchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid key rotation parameters' });
    }

    const rotated = keyManager.rotateKey(parsed.data.key_hash, parsed.data.grace_period_seconds);
    if (!rotated) {
      return reply.status(404).send({ error: 'Key not found or already revoked' });
    }

    logStore.record('info', 'admin.key_rotated', {
      requestId: request.headers['x-request-id'] as string,
      keyId: request.apiKeyContext?.keyId,
      tenantId: rotated.tenant_id,
      details: {
        oldKeyHash: rotated.old_key_hash,
        newKeyHash: rotated.new_key_hash,
        gracePeriodSeconds: parsed.data.grace_period_seconds,
      },
    });

    return {
      success: true,
      ...rotated,
    };
  });

  /**
   * DELETE /v1/admin/keys/:keyHash
   * Immediately revokes an API key by its SHA-256 hash.
   */
  fastify.delete<{ Params: { keyHash: string } }>(
    '/v1/admin/keys/:keyHash',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!requireAdminRole(request, reply)) return reply;
      const { keyHash } = request.params;
      const revoked = keyManager.revokeKey(keyHash);
      if (!revoked) {
        return reply.status(404).send({ error: 'Key not found' });
      }
      logStore.record('info', 'admin.key_revoked', {
        requestId: request.headers['x-request-id'] as string,
        keyId: request.apiKeyContext?.keyId,
        details: { revokedKeyHash: keyHash },
      });
      return { success: true, revokedKeyHash: keyHash };
    }
  );

  /**
   * POST /v1/admin/reindex & POST /v1/admin/optimize
   * Rebuilds and compacts the HNSW graph + BM25 index for the resolved store and flushes stale caches.
   */
  const handleReindexOrOptimize = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const startMs = performance.now();
    const { store, tenantId, indexName } = storeRegistry.resolveRequestStore(request);
    const items = store.getAll();

    await store.clear();
    if (items.length > 0) {
      store.bulkSeed(items);
    }
    await store.getWAL().flush();

    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
    await Promise.all([
      cache.invalidate('search:*'),
      cache.invalidate('recommend:*'),
      cache.del(CacheKeys.catalogStats()),
    ]);
    Metrics.vectorStoreSize.set(store.count());

    const durationMs = Math.round((performance.now() - startMs) * 100) / 100;
    logStore.record('info', 'catalog.indexing', {
      requestId: request.headers['x-request-id'] as string,
      tenantId,
      indexName,
      keyId: request.apiKeyContext?.keyId,
      latencyMs: durationMs,
      details: { operation: 'reindex_optimize', batchSize: items.length },
    });

    return {
      status: 'optimized',
      tenantId,
      indexName,
      itemsReindexed: items.length,
      hnswNodes: store.getHNSW().size(),
      durationMs,
      timestamp: new Date().toISOString(),
    };
  };

  fastify.post('/v1/admin/reindex', { preHandler: authenticate }, handleReindexOrOptimize);
  fastify.post('/v1/admin/optimize', { preHandler: authenticate }, handleReindexOrOptimize);

  /**
   * GET /v1/admin/logs
   * Returns structured operational logs (search, indexing, auth_failed, key rotation, snapshots).
   */
  fastify.get('/v1/admin/logs', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const query = (request.query as {
      limit?: string;
      level?: LogLevel;
      event?: string;
      tenantId?: string;
    }) || {};
    const limit = Math.min(Math.max(parseInt(query.limit || '100', 10) || 100, 1), 500);
    const logs = logStore.getRecentLogs({
      limit,
      level: query.level,
      event: query.event,
      tenantId: query.tenantId,
    });
    return {
      count: logs.length,
      logs,
    };
  });

  /**
   * POST /v1/snapshots
   * Triggers an immediate atomic disk snapshot of the catalog & index state.
   */
  fastify.post('/v1/snapshots', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const { store, tenantId, indexName } = storeRegistry.resolveRequestStore(request);
    const body = (request.body as { path?: string } | null) || {};

    const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const defaultDir = process.env.EIDOS_SNAPSHOT_DIR || './data/snapshots';
    const relativeTarget =
      body.path || path.join(defaultDir, `${tenantId}_${indexName}_${snapshotId}.json`);
    const absPath = store.getSnapshotPath(relativeTarget);

    await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
    const snapshotArray = store.toSnapshotArray();
    const payload = JSON.stringify(snapshotArray, null, 2);
    const tmpPath = `${absPath}.tmp-${Date.now()}`;
    await fs.promises.writeFile(tmpPath, payload, 'utf8');
    await fs.promises.rename(tmpPath, absPath);

    // Also update primary snapshot file if EIDOS_SNAPSHOT_PATH is configured
    if (process.env.EIDOS_SNAPSHOT_PATH) {
      await store.saveSnapshotAsync(process.env.EIDOS_SNAPSHOT_PATH);
    }

    const checksumSha256 = crypto.createHash('sha256').update(payload).digest('hex');
    const sizeBytes = Buffer.byteLength(payload, 'utf8');
    const meta: SnapshotMetadata = {
      snapshotId,
      tenantId,
      indexName,
      path: absPath,
      itemsCount: snapshotArray.length,
      sizeBytes,
      checksumSha256,
      createdAt: new Date().toISOString(),
    };
    snapshotRegistry.push(meta);

    logStore.record('info', 'snapshot.persisted', {
      requestId: request.headers['x-request-id'] as string,
      tenantId,
      indexName,
      keyId: request.apiKeyContext?.keyId,
      details: {
        snapshotId,
        itemsCount: meta.itemsCount,
        sizeBytes,
        checksumSha256,
      },
    });

    return reply.status(201).send({
      success: true,
      snapshot: meta,
    });
  });

  /**
   * GET /v1/snapshots
   * Lists recorded snapshots.
   */
  fastify.get('/v1/snapshots', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    return {
      count: snapshotRegistry.length,
      snapshots: [...snapshotRegistry].reverse(),
    };
  });

  /**
   * POST /v1/snapshots/restore
   * Restores a catalog snapshot from disk into the active store.
   */
  fastify.post('/v1/snapshots/restore', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const { store, tenantId, indexName } = storeRegistry.resolveRequestStore(request);
    const body = (request.body as { snapshotId?: string; path?: string } | null) || {};

    let targetPath = body.path;
    if (!targetPath && body.snapshotId) {
      const found = snapshotRegistry.find((s) => s.snapshotId === body.snapshotId);
      if (!found) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Snapshot '${body.snapshotId}' not found`,
        });
      }
      targetPath = found.path;
    }

    const restoredCount = await store.loadSnapshotFromDisk(opts.embedder, targetPath);
    Metrics.vectorStoreSize.set(store.count());

    logStore.record('info', 'snapshot.restored', {
      requestId: request.headers['x-request-id'] as string,
      tenantId,
      indexName,
      keyId: request.apiKeyContext?.keyId,
      details: { snapshotId: body.snapshotId, restoredCount },
    });

    return {
      success: true,
      restoredCount,
      totalItems: store.count(),
    };
  });

  /**
   * GET /v1/catalog/export
   * Exports full catalog in JSON or CSV format for backups and migrations.
   */
  fastify.get('/v1/catalog/export', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdminRole(request, reply)) return reply;
    const { store, tenantId, indexName } = storeRegistry.resolveRequestStore(request);
    const format = ((request.query as { format?: string })?.format || 'json').toLowerCase();
    const items = store.toSnapshotArray();

    if (format === 'csv') {
      const header = 'id,title,category,price,inStock,tags,description';
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = items.map((it) =>
        [
          esc(it.id),
          esc(it.title),
          esc(it.category),
          it.price,
          it.inStock,
          esc((it.tags || []).join('|')),
          esc(it.description),
        ].join(',')
      );
      reply.header('content-type', 'text/csv; charset=utf-8');
      return [header, ...rows].join('\n');
    }

    return {
      tenantId,
      indexName,
      exportedAt: new Date().toISOString(),
      count: items.length,
      items,
    };
  });
}
