import * as crypto from 'crypto';

export type ApiKeyScopeRole = 'master' | 'admin' | 'search' | 'merchandiser';

export interface ApiKeyRecord {
  key_hash: string;
  key_prefix: string;
  tenant_id: string;
  role: ApiKeyScopeRole;
  description?: string;
  allowed_indexes?: string[];
  allowed_filters?: Record<string, unknown>;
  created_at: Date;
  revoked_at?: Date;
  expires_at?: Date;
  rotated_to_hash?: string;
}

export interface GenerateKeyOptions {
  tenantId?: string;
  role?: ApiKeyScopeRole;
  description?: string;
  allowedIndexes?: string[];
  allowedFilters?: Record<string, unknown>;
  expiresAt?: Date;
}

export class ApiKeyManager {
  private static instance: ApiKeyManager | null = null;
  private keys = new Map<string, ApiKeyRecord>();

  public static getInstance(): ApiKeyManager {
    if (!ApiKeyManager.instance) {
      ApiKeyManager.instance = new ApiKeyManager();
    }
    return ApiKeyManager.instance;
  }

  public static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  public generateKey(
    tenantIdOrOptions: string | GenerateKeyOptions = 'default',
    expiresAt?: Date
  ): {
    key: string;
    key_hash: string;
    key_prefix: string;
    role: ApiKeyScopeRole;
    tenant_id: string;
  } {
    const opts: GenerateKeyOptions =
      typeof tenantIdOrOptions === 'string'
        ? { tenantId: tenantIdOrOptions, expiresAt }
        : tenantIdOrOptions;

    const tenantId = opts.tenantId || 'default';
    const role: ApiKeyScopeRole = opts.role || 'admin';
    const prefixTag =
      role === 'search' ? 'eidos_pk_' : role === 'merchandiser' ? 'eidos_mk_' : 'eidos_sk_';
    const randomPart = crypto.randomBytes(24).toString('hex');
    const key = `${prefixTag}${randomPart}`;
    const key_hash = ApiKeyManager.hashKey(key);
    const key_prefix = `${key.slice(0, 12)}...${key.slice(-4)}`;

    this.keys.set(key_hash, {
      key_hash,
      key_prefix,
      tenant_id: tenantId,
      role,
      description: opts.description,
      allowed_indexes: opts.allowedIndexes,
      allowed_filters: opts.allowedFilters,
      created_at: new Date(),
      expires_at: opts.expiresAt,
    });

    return { key, key_hash, key_prefix, role, tenant_id: tenantId };
  }

  /**
   * Zero-downtime key rotation: creates a replacement key with identical permissions
   * while keeping the old key valid for `gracePeriodSeconds` (default 300s).
   */
  public rotateKey(
    oldKeyHash: string,
    gracePeriodSeconds = 300
  ): {
    new_key: string;
    new_key_hash: string;
    old_key_hash: string;
    old_key_expires_at: string;
    role: ApiKeyScopeRole;
    tenant_id: string;
  } | null {
    const existing = this.keys.get(oldKeyHash);
    if (!existing || existing.revoked_at) {
      return null;
    }

    const generated = this.generateKey({
      tenantId: existing.tenant_id,
      role: existing.role,
      description: existing.description ? `${existing.description} (rotated)` : 'Rotated key',
      allowedIndexes: existing.allowed_indexes,
      allowedFilters: existing.allowed_filters,
    });

    const graceExpiry = new Date(Date.now() + Math.max(0, gracePeriodSeconds) * 1000);
    existing.expires_at = graceExpiry;
    existing.rotated_to_hash = generated.key_hash;
    if (gracePeriodSeconds <= 0) {
      existing.revoked_at = new Date();
    }

    return {
      new_key: generated.key,
      new_key_hash: generated.key_hash,
      old_key_hash: oldKeyHash,
      old_key_expires_at: graceExpiry.toISOString(),
      role: existing.role,
      tenant_id: existing.tenant_id,
    };
  }

  public revokeKey(key_hash: string): boolean {
    const record = this.keys.get(key_hash);
    if (!record) return false;

    record.revoked_at = new Date();
    return true;
  }

  public isValid(key: string): boolean {
    const key_hash = ApiKeyManager.hashKey(key);
    const record = this.keys.get(key_hash);

    if (!record) return false;
    if (record.revoked_at) return false;
    if (record.expires_at && record.expires_at < new Date()) return false;

    return true;
  }

  public hasKey(key: string): boolean {
    const key_hash = ApiKeyManager.hashKey(key);
    return this.keys.has(key_hash);
  }

  public isRevokedOrExpired(key: string): boolean {
    const key_hash = ApiKeyManager.hashKey(key);
    const record = this.keys.get(key_hash);
    if (!record) return false;
    if (record.revoked_at) return true;
    if (record.expires_at && record.expires_at < new Date()) return true;
    return false;
  }

  public getRecord(key: string): ApiKeyRecord | undefined {
    const key_hash = ApiKeyManager.hashKey(key);
    return this.keys.get(key_hash);
  }

  public getRecordByHash(keyHash: string): ApiKeyRecord | undefined {
    return this.keys.get(keyHash);
  }

  public listKeys(tenantId?: string): ApiKeyRecord[] {
    const all = Array.from(this.keys.values());
    if (!tenantId) return all;
    return all.filter((r) => r.tenant_id === tenantId);
  }

  public clear(): void {
    this.keys.clear();
  }
}
