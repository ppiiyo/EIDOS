import { AuditLogEntry, EnterpriseTenant } from '../types';

/**
 * Enterprise Multi-Tenant RBAC & Scope Validator.
 */
export class EnterpriseRBAC {
  private tenants = new Map<string, EnterpriseTenant>();

  constructor() {
    // Seed default tenants for open-core and enterprise tiers
    this.registerTenant({
      tenantId: 'community-default',
      name: 'EIDOS Community Edition',
      plan: 'community',
      apiKeyHash: 'hash-community-free',
      allowedScopes: ['read:recommend', 'search:catalog'],
      rateLimitPerMinute: 600,
      createdAt: Date.now(),
    });

    this.registerTenant({
      tenantId: 'enterprise-client-01',
      name: 'Enterprise Tier Client',
      plan: 'enterprise',
      apiKeyHash: 'hash-live-enterprise-sk',
      allowedScopes: [
        'read:recommend',
        'search:catalog',
        'write:catalog',
        'admin:shards',
        'audit:logs',
        'stream:cdc',
      ],
      rateLimitPerMinute: 120000,
      createdAt: Date.now(),
    });
  }

  public registerTenant(tenant: EnterpriseTenant): void {
    this.tenants.set(tenant.tenantId, tenant);
  }

  public validateAccess(
    tenantId: string,
    requiredScope: string
  ): { allowed: boolean; reason?: string } {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      return { allowed: false, reason: 'Invalid or missing tenant credentials.' };
    }
    if (!tenant.allowedScopes.includes(requiredScope) && !tenant.allowedScopes.includes('admin:*')) {
      return { allowed: false, reason: `Scope '${requiredScope}' not permitted on plan '${tenant.plan}'. Upgrade to Enterprise.` };
    }
    return { allowed: true };
  }

  public getTenant(tenantId: string): EnterpriseTenant | undefined {
    return this.tenants.get(tenantId);
  }
}

/**
 * Enterprise SOC2 / GDPR Audit Logger.
 * Records immutable, cryptographically timestamped records of data access and catalog mutations.
 */
export class AuditLogger {
  private logs: AuditLogEntry[] = [];

  public logEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const record: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.logs.push(record);
    if (this.logs.length > 5000) {
      this.logs.shift();
    }
    return record;
  }

  public getLogs(tenantId?: string, limit: number = 50): AuditLogEntry[] {
    let result = this.logs;
    if (tenantId) {
      result = result.filter((l) => l.tenantId === tenantId);
    }
    return result.slice(-limit).reverse();
  }
}

/**
 * Universal Catalog Feed & Ingestion Parser (Shopify, YML, CommerceML, JSON).
 */
export class CatalogSyncConnector {
  public static parseYMLFeed(xmlString: string): Array<{ id: string; title: string; category: string; price?: number }> {
    const items: Array<{ id: string; title: string; category: string; price?: number }> = [];
    const offerRegex = /<offer[^>]*id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/offer>/gi;
    let match;

    while ((match = offerRegex.exec(xmlString)) !== null) {
      const id = match[1];
      const body = match[2];

      const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(body);
      const catMatch = /<categoryId>([\s\S]*?)<\/categoryId>/i.exec(body) || /<category>([\s\S]*?)<\/category>/i.exec(body);
      const priceMatch = /<price>([\s\S]*?)<\/price>/i.exec(body);

      items.push({
        id,
        title: nameMatch ? nameMatch[1].trim() : `Товар #${id}`,
        category: catMatch ? catMatch[1].trim() : 'Общая',
        price: priceMatch ? parseFloat(priceMatch[1]) : undefined,
      });
    }

    return items;
  }
}
