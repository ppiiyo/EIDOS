import { FastifyRequest } from 'fastify';
import { VectorStore } from './vector-store';

export type QuantizationMode = 'fp32' | 'fp16' | 'int8' | 'binary';

export type StoreErrorCode =
  | 'STORE_NOT_FOUND'
  | 'STORE_ALREADY_EXISTS'
  | 'QUOTA_EXCEEDED'
  | 'DIMENSION_MISMATCH'
  | 'INVALID_TENANT_ID'
  | 'INVALID_INDEX_NAME'
  | 'OPERATION_TIMEOUT'
  | 'CANNOT_DELETE_DEFAULT';

export class StoreError extends Error {
  public readonly code: StoreErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: StoreErrorCode,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, StoreError.prototype);
  }

  public toJSON(): Record<string, unknown> {
    const statusTextMap: Record<number, string> = {
      400: 'Bad Request',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      429: 'Too Many Requests',
      504: 'Gateway Timeout',
    };
    return {
      statusCode: this.statusCode,
      error: statusTextMap[this.statusCode] || 'Store Error',
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

/**
 * Executes an asynchronous store operation with a strict timeout deadline and timer cleanup.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName = 'store_operation'
): Promise<T> {
  if (timeoutMs <= 0) {
    throw new StoreError(
      'OPERATION_TIMEOUT',
      `Operation '${operationName}' timed out after ${timeoutMs}ms`,
      504,
      { operationName, timeoutMs }
    );
  }

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new StoreError(
          'OPERATION_TIMEOUT',
          `Operation '${operationName}' timed out after ${timeoutMs}ms`,
          504,
          { operationName, timeoutMs }
        )
      );
    }, timeoutMs);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export interface IndexMetadata {
  tenantId: string;
  name: string;
  dimension: number;
  quantization: QuantizationMode;
  M: number;
  efConstruction: number;
  efSearch: number;
  shards: number;
  replicationFactor: number;
  createdAt: string;
  store: VectorStore;
}

export interface CreateIndexConfig {
  name: string;
  dimension?: number;
  quantization?: QuantizationMode;
  M?: number;
  efConstruction?: number;
  efSearch?: number;
  shards?: number;
  replicationFactor?: number;
  store?: VectorStore;
}

export interface TenantStoreQuota {
  maxItems: number;
  maxIndexes: number;
  rateLimitPerMin: number;
}

const IDENTIFIER_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function computeIndexMemoryBytes(
  docCount: number,
  dimension: number,
  quantization: QuantizationMode
): number {
  const bytesPerDim =
    quantization === 'fp32'
      ? 4
      : quantization === 'fp16'
        ? 2
        : quantization === 'int8'
          ? 1
          : 0.125;
  const vectorBytes = docCount * dimension * bytesPerDim;
  const graphOverheadBytes = docCount * 128;
  return Math.round(vectorBytes + graphOverheadBytes);
}

export function serializeIndexMetadata(meta: IndexMetadata) {
  const docCount = meta.store.count();
  return {
    tenantId: meta.tenantId,
    name: meta.name,
    dimension: meta.dimension,
    documentCount: docCount,
    quantization: meta.quantization,
    hnswConfig: {
      M: meta.M,
      efConstruction: meta.efConstruction,
      efSearch: meta.efSearch,
    },
    shards: meta.shards,
    replicationFactor: meta.replicationFactor,
    memoryBytes: computeIndexMemoryBytes(docCount, meta.dimension, meta.quantization),
    status: 'ready' as const,
    createdAt: meta.createdAt,
  };
}

/**
 * Unified StoreRegistry eliminating Split-Brain state across `/v1/search`, `/v1/recommend`,
 * `/v1/catalog`, and `/v1/indexes`.
 * Manages composite `${tenantId}:${indexName}` namespaces with strict validation and quotas.
 */
export class StoreRegistry {
  private static instance: StoreRegistry | null = null;
  private readonly stores = new Map<string, IndexMetadata>();
  private readonly quotas = new Map<string, TenantStoreQuota>();
  private readonly defaultQuota: TenantStoreQuota = {
    maxItems: 100_000,
    maxIndexes: 50,
    rateLimitPerMin: 5_000,
  };

  constructor(defaultStore?: VectorStore) {
    this.setDefaultStore(defaultStore || new VectorStore());
  }

  public static getInstance(): StoreRegistry {
    if (!StoreRegistry.instance) {
      StoreRegistry.instance = new StoreRegistry();
    }
    return StoreRegistry.instance;
  }

  public static resetInstance(): void {
    if (StoreRegistry.instance) {
      StoreRegistry.instance.reset();
    }
  }

  public getTotalVectorCount(): number {
    let total = 0;
    for (const meta of this.stores.values()) {
      total += meta.store.count();
    }
    return total;
  }

  public static validateTenantId(tenantId: string): string {
    const clean = (tenantId || '').trim().toLowerCase();
    if (!clean || !IDENTIFIER_REGEX.test(clean)) {
      throw new StoreError(
        'INVALID_TENANT_ID',
        `Invalid tenantId '${tenantId}'. Must be 1-64 alphanumeric characters, hyphens, or underscores.`,
        400,
        { tenantId }
      );
    }
    return clean;
  }

  public static validateIndexName(indexName: string): string {
    const clean = (indexName || '').trim().toLowerCase();
    if (!clean || !IDENTIFIER_REGEX.test(clean)) {
      throw new StoreError(
        'INVALID_INDEX_NAME',
        `Invalid index name '${indexName}'. Must be 1-64 alphanumeric characters, hyphens, or underscores.`,
        400,
        { indexName }
      );
    }
    return clean;
  }

  private static makeKey(tenantId: string, indexName: string): string {
    return `${tenantId}:${indexName}`;
  }

  public setDefaultStore(store: VectorStore): void {
    const key = StoreRegistry.makeKey('default', 'default');
    const existing = this.stores.get(key);
    this.stores.set(key, {
      tenantId: 'default',
      name: 'default',
      dimension: existing?.dimension ?? 384,
      quantization: existing?.quantization ?? 'int8',
      M: existing?.M ?? 16,
      efConstruction: existing?.efConstruction ?? 128,
      efSearch: existing?.efSearch ?? 64,
      shards: existing?.shards ?? 3,
      replicationFactor: existing?.replicationFactor ?? 2,
      createdAt: existing?.createdAt ?? new Date(Date.now() - 86_400_000 * 7).toISOString(),
      store,
    });
  }

  public reset(): void {
    const defaultMeta = this.stores.get(StoreRegistry.makeKey('default', 'default'));
    this.stores.clear();
    this.quotas.clear();
    if (defaultMeta) {
      this.stores.set(StoreRegistry.makeKey('default', 'default'), defaultMeta);
    } else {
      this.setDefaultStore(new VectorStore());
    }
  }

  public getStore(
    tenantId = 'default',
    indexName = 'default',
    options?: { createIfMissing?: boolean }
  ): VectorStore {
    return this.getMetadata(tenantId, indexName, options).store;
  }

  public getMetadata(
    tenantId = 'default',
    indexName = 'default',
    options?: { createIfMissing?: boolean }
  ): IndexMetadata {
    const cleanTenant = StoreRegistry.validateTenantId(tenantId);
    const cleanIndex = StoreRegistry.validateIndexName(indexName);
    const key = StoreRegistry.makeKey(cleanTenant, cleanIndex);

    const direct = this.stores.get(key);
    if (direct) {
      return direct;
    }

    // Backward-compatible bridge: if a custom index was created under 'default:<name>'
    // and accessed via tenant '<name>:default', or vice-versa, return the existing metadata.
    if (cleanIndex === 'default' && cleanTenant !== 'default') {
      const asNamedIndex = this.stores.get(StoreRegistry.makeKey('default', cleanTenant));
      if (asNamedIndex) {
        return asNamedIndex;
      }
    }

    const shouldCreate =
      options?.createIfMissing !== undefined
        ? options.createIfMissing
        : cleanIndex === 'default';

    if (!shouldCreate) {
      throw new StoreError(
        'STORE_NOT_FOUND',
        `Index '${cleanIndex}' not found in tenant '${cleanTenant}'`,
        404,
        { tenantId: cleanTenant, indexName: cleanIndex }
      );
    }

    const meta: IndexMetadata = {
      tenantId: cleanTenant,
      name: cleanIndex,
      dimension: 384,
      quantization: 'int8',
      M: 16,
      efConstruction: 128,
      efSearch: 64,
      shards: 3,
      replicationFactor: 2,
      createdAt: new Date().toISOString(),
      store: new VectorStore(),
    };
    this.stores.set(key, meta);
    return meta;
  }

  public createIndex(config: CreateIndexConfig, tenantId = 'default'): IndexMetadata {
    const cleanTenant = StoreRegistry.validateTenantId(tenantId);
    const cleanName = StoreRegistry.validateIndexName(config.name);
    const key = StoreRegistry.makeKey(cleanTenant, cleanName);

    if (this.stores.has(key)) {
      throw new StoreError(
        'STORE_ALREADY_EXISTS',
        `Index '${config.name}' already exists`,
        409,
        { tenantId: cleanTenant, indexName: cleanName }
      );
    }

    const quota = this.getTenantQuota(cleanTenant);
    const tenantIndexesCount = Array.from(this.stores.values()).filter(
      (m) => m.tenantId === cleanTenant
    ).length;
    if (tenantIndexesCount >= quota.maxIndexes) {
      throw new StoreError(
        'QUOTA_EXCEEDED',
        `Tenant '${cleanTenant}' has reached maximum index quota (${quota.maxIndexes})`,
        429,
        { tenantId: cleanTenant, maxIndexes: quota.maxIndexes }
      );
    }

    const dimension = config.dimension ?? 384;
    const quantization = config.quantization ?? 'int8';
    const M = config.M ?? 16;
    const efConstruction = config.efConstruction ?? 128;
    const efSearch = config.efSearch ?? 64;
    const shards = config.shards ?? 3;
    const replicationFactor = config.replicationFactor ?? 2;

    const store =
      config.store ||
      new VectorStore({
        M,
        efConstruction,
        efSearch,
        useQuantization: quantization !== 'fp32',
      });

    const meta: IndexMetadata = {
      tenantId: cleanTenant,
      name: cleanName,
      dimension,
      quantization,
      M,
      efConstruction,
      efSearch,
      shards,
      replicationFactor,
      createdAt: new Date().toISOString(),
      store,
    };

    this.stores.set(key, meta);
    return meta;
  }

  public deleteIndex(indexName: string, tenantId = 'default'): boolean {
    const cleanTenant = StoreRegistry.validateTenantId(tenantId);
    const cleanName = StoreRegistry.validateIndexName(indexName);

    if (cleanName === 'default') {
      throw new StoreError(
        'CANNOT_DELETE_DEFAULT',
        'Cannot delete the primary default index',
        400,
        { tenantId: cleanTenant, indexName: cleanName }
      );
    }

    const key = StoreRegistry.makeKey(cleanTenant, cleanName);
    if (!this.stores.has(key)) {
      throw new StoreError(
        'STORE_NOT_FOUND',
        `Index '${indexName}' not found`,
        404,
        { tenantId: cleanTenant, indexName: cleanName }
      );
    }

    return this.stores.delete(key);
  }

  public listIndexes(tenantId?: string): IndexMetadata[] {
    const all = Array.from(this.stores.values());
    if (!tenantId) {
      return all;
    }
    const cleanTenant = StoreRegistry.validateTenantId(tenantId);
    return all.filter((m) => m.tenantId === cleanTenant);
  }

  public setTenantQuota(tenantId: string, quota: Partial<TenantStoreQuota>): void {
    const cleanTenant = StoreRegistry.validateTenantId(tenantId);
    const current = this.getTenantQuota(cleanTenant);
    this.quotas.set(cleanTenant, { ...current, ...quota });
  }

  public getTenantQuota(tenantId: string): TenantStoreQuota {
    const cleanTenant = StoreRegistry.validateTenantId(tenantId);
    return this.quotas.get(cleanTenant) || this.defaultQuota;
  }

  public checkItemQuota(
    tenantId: string,
    indexName = 'default',
    incomingCount = 1
  ): { allowed: boolean; currentCount: number; maxItems: number } {
    const store = this.getStore(tenantId, indexName, { createIfMissing: true });
    const quota = this.getTenantQuota(tenantId);
    const currentCount = store.count();
    return {
      allowed: currentCount + incomingCount <= quota.maxItems,
      currentCount,
      maxItems: quota.maxItems,
    };
  }

  public assertItemQuota(tenantId: string, indexName = 'default', incomingCount = 1): void {
    const check = this.checkItemQuota(tenantId, indexName, incomingCount);
    if (!check.allowed) {
      throw new StoreError(
        'QUOTA_EXCEEDED',
        `Quota exceeded for tenant '${tenantId}': ${check.currentCount + incomingCount} > ${check.maxItems} max items`,
        429,
        {
          tenantId,
          indexName,
          currentCount: check.currentCount,
          incomingCount,
          maxItems: check.maxItems,
        }
      );
    }
  }

  public listTenants(): Array<{ tenantId: string; itemCount: number; quota: TenantStoreQuota }> {
    const tenantTotals = new Map<string, number>();
    for (const meta of this.stores.values()) {
      const prev = tenantTotals.get(meta.tenantId) || 0;
      tenantTotals.set(meta.tenantId, prev + meta.store.count());
    }
    const out: Array<{ tenantId: string; itemCount: number; quota: TenantStoreQuota }> = [];
    for (const [tenantId, itemCount] of tenantTotals.entries()) {
      out.push({
        tenantId,
        itemCount,
        quota: this.getTenantQuota(tenantId),
      });
    }
    return out;
  }

  public resolveTenantId(
    request?: FastifyRequest | { headers?: Record<string, unknown>; tenantId?: string }
  ): string {
    if (!request) return 'default';
    if (typeof request.tenantId === 'string' && request.tenantId.trim().length > 0) {
      return StoreRegistry.validateTenantId(request.tenantId);
    }
    if (!request.headers) return 'default';

    const headerTenant = request.headers['x-tenant-id'];
    if (typeof headerTenant === 'string' && headerTenant.trim().length > 0) {
      const sanitized = headerTenant.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      return sanitized ? StoreRegistry.validateTenantId(sanitized) : 'default';
    }

    const apiKey = String(request.headers['x-api-key'] || '');
    const prefixMatch = apiKey.match(/^eidos_tenant_([a-z0-9_-]+)_/i);
    if (prefixMatch && prefixMatch[1]) {
      return StoreRegistry.validateTenantId(prefixMatch[1]);
    }

    return 'default';
  }

  public resolveIndexName(
    request?:
      | FastifyRequest
      | {
          headers?: Record<string, unknown>;
          body?: unknown;
          query?: unknown;
        }
  ): string {
    if (!request) return 'default';

    if (request.headers) {
      const headerIndex = request.headers['x-index-name'] || request.headers['x-eidos-index'];
      if (typeof headerIndex === 'string' && headerIndex.trim().length > 0) {
        return StoreRegistry.validateIndexName(headerIndex);
      }
    }

    const body = request.body as Record<string, unknown> | null | undefined;
    if (body && typeof body === 'object') {
      const bodyIndex = body.index ?? body.indexName ?? body.index_name;
      if (typeof bodyIndex === 'string' && bodyIndex.trim().length > 0) {
        return StoreRegistry.validateIndexName(bodyIndex);
      }
    }

    const query = request.query as Record<string, unknown> | null | undefined;
    if (query && typeof query === 'object') {
      const queryIndex = query.index ?? query.indexName ?? query.index_name;
      if (typeof queryIndex === 'string' && queryIndex.trim().length > 0) {
        return StoreRegistry.validateIndexName(queryIndex);
      }
    }

    return 'default';
  }

  public resolveRequestStore(
    request?:
      | FastifyRequest
      | {
          headers?: Record<string, unknown>;
          tenantId?: string;
          body?: unknown;
          query?: unknown;
        },
    options?: { createIfMissing?: boolean }
  ): { store: VectorStore; tenantId: string; indexName: string; metadata: IndexMetadata } {
    const tenantId = this.resolveTenantId(request);
    const indexName = this.resolveIndexName(request);
    const metadata = this.getMetadata(tenantId, indexName, options);
    return {
      store: metadata.store,
      tenantId: metadata.tenantId,
      indexName: metadata.name,
      metadata,
    };
  }
}
