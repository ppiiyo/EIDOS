import crypto from 'crypto';
import { FastifyRequest } from 'fastify';
import { VectorStore } from './vector-store';
import { StoreRegistry } from './store-registry';

export type EidosRole = 'admin' | 'merchandiser' | 'editor' | 'readonly' | 'viewer';

export interface TenantQuota {
  maxItems: number;
  rateLimitPerMin: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  tenantId: string;
  actorRole: EidosRole;
  action: string;
  resourceId?: string;
  details: Record<string, unknown>;
  integrityHash: string;
}

/**
 * Multi-Tenancy Namespace Manager, RBAC Access Control, and Tamper-Evident Audit Logger.
 * Ensures 100% vector & lexical index isolation between tenants while delegating to
 * the unified StoreRegistry to prevent split-brain state.
 */
export class TenantNamespaceManager {
  private static instance: TenantNamespaceManager | null = null;

  public static getInstance(): TenantNamespaceManager {
    if (!TenantNamespaceManager.instance) {
      TenantNamespaceManager.instance = new TenantNamespaceManager();
    }
    return TenantNamespaceManager.instance;
  }

  /**
   * Registers the default shared VectorStore so existing single-tenant requests
   * operate with zero overhead or behavior change.
   */
  public setDefaultStore(store: VectorStore): void {
    StoreRegistry.getInstance().setDefaultStore(store);
  }

  public reset(): void {
    StoreRegistry.getInstance().reset();
  }

  /**
   * Resolves the tenant namespace ID from `X-Tenant-ID` header or API key prefix (`eidos_tenant_<tenant>_<key>`).
   */
  public resolveTenantId(
    request?: FastifyRequest | { headers?: Record<string, unknown>; tenantId?: string }
  ): string {
    return StoreRegistry.getInstance().resolveTenantId(request);
  }

  /**
   * Retrieves or creates an isolated VectorStore for the given tenant namespace.
   */
  public getStore(tenantId = 'default', indexName = 'default'): VectorStore {
    return StoreRegistry.getInstance().getStore(tenantId, indexName, { createIfMissing: true });
  }

  public setTenantQuota(tenantId: string, quota: Partial<TenantQuota>): void {
    StoreRegistry.getInstance().setTenantQuota(tenantId, quota);
  }

  public getTenantQuota(tenantId: string): TenantQuota {
    const q = StoreRegistry.getInstance().getTenantQuota(tenantId);
    return {
      maxItems: q.maxItems,
      rateLimitPerMin: q.rateLimitPerMin,
    };
  }

  public checkItemQuota(tenantId: string): { allowed: boolean; currentCount: number; maxItems: number } {
    return StoreRegistry.getInstance().checkItemQuota(tenantId, 'default', 1);
  }

  public listTenants(): Array<{ tenantId: string; itemCount: number; quota: TenantQuota }> {
    return StoreRegistry.getInstance()
      .listTenants()
      .map((t) => ({
        tenantId: t.tenantId,
        itemCount: t.itemCount,
        quota: {
          maxItems: t.quota.maxItems,
          rateLimitPerMin: t.quota.rateLimitPerMin,
        },
      }));
  }
}

/**
 * Role-Based Access Control (RBAC) Evaluator for Admin, Merchandiser/Editor, and Read-Only/Viewer roles.
 */
export class RBACManager {
  public static resolveRole(
    request?: FastifyRequest | { headers?: Record<string, unknown>; demoMode?: boolean }
  ): EidosRole {
    if (!request || !request.headers) return 'readonly';
    if (request.demoMode) return 'readonly';

    const apiKey = String(request.headers['x-api-key'] || '');
    if (
      apiKey.includes('demo_key') ||
      apiKey.startsWith('eidos_readonly_') ||
      apiKey.startsWith('eidos_viewer_')
    ) {
      return 'readonly';
    }

    const explicitRole = String(request.headers['x-eidos-role'] || '').toLowerCase();
    if (
      explicitRole === 'merchandiser' ||
      explicitRole === 'editor' ||
      apiKey.startsWith('eidos_merch_') ||
      apiKey.startsWith('eidos_editor_')
    ) {
      return explicitRole === 'editor' ? 'editor' : 'merchandiser';
    }
    if (explicitRole === 'readonly' || explicitRole === 'viewer') {
      return explicitRole === 'viewer' ? 'viewer' : 'readonly';
    }

    return 'admin';
  }

  public static hasPermission(
    role: EidosRole,
    permission: 'read' | 'write' | 'admin'
  ): boolean {
    if (permission === 'read') return this.canRead(role);
    if (permission === 'write') return this.canUpdateMerchandising(role);
    return this.canManageCatalogAndConfig(role);
  }

  public static canRead(role: EidosRole): boolean {
    return (
      role === 'admin' ||
      role === 'merchandiser' ||
      role === 'editor' ||
      role === 'readonly' ||
      role === 'viewer'
    );
  }

  public static canUpdateMerchandising(role: EidosRole): boolean {
    return role === 'admin' || role === 'merchandiser' || role === 'editor';
  }

  public static canManageCatalogAndConfig(role: EidosRole): boolean {
    return role === 'admin';
  }
}

/**
 * Tamper-Evident Ring-Buffer Audit Logger for Merchandising & RBAC Governance.
 */
export class AuditLogger {
  private static instance: AuditLogger | null = null;
  private readonly logs: AuditLogEntry[] = [];
  private readonly maxEntries: number;
  private lastHash = '0000000000000000';

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  public record(params: {
    tenantId: string;
    actorRole: EidosRole;
    action: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): AuditLogEntry {
    const timestamp = new Date().toISOString();
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const detailsObj = {
      ...(params.details || {}),
      ...(params.metadata || {}),
      ...(params.resourceId ? { resourceId: params.resourceId } : {}),
    };
    const payload = `${this.lastHash}|${id}|${timestamp}|${params.tenantId}|${params.actorRole}|${params.action}|${JSON.stringify(detailsObj)}`;
    const integrityHash = crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
    this.lastHash = integrityHash;

    const entry: AuditLogEntry = {
      id,
      timestamp,
      tenantId: params.tenantId,
      actorRole: params.actorRole,
      action: params.action,
      resourceId: params.resourceId,
      details: detailsObj,
      integrityHash,
    };

    if (this.logs.length >= this.maxEntries) {
      this.logs.shift();
    }
    this.logs.push(entry);
    return entry;
  }

  public getLogs(tenantId?: string, limit = 100): AuditLogEntry[] {
    const filtered = tenantId
      ? this.logs.filter((l) => l.tenantId === tenantId.toLowerCase().trim())
      : this.logs;
    return filtered.slice(-limit).reverse();
  }

  public clear(): void {
    this.logs.length = 0;
    this.lastHash = '0000000000000000';
  }
}
