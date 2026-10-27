import * as crypto from 'crypto';

export interface ApiKeyRecord {
  key_hash: string;
  tenant_id: string;
  created_at: Date;
  revoked_at?: Date;
  expires_at?: Date;
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

  public generateKey(tenantId: string, expiresAt?: Date): { key: string; key_hash: string } {
    const key = crypto.randomBytes(32).toString('hex');
    const key_hash = ApiKeyManager.hashKey(key);

    this.keys.set(key_hash, {
      key_hash,
      tenant_id: tenantId,
      created_at: new Date(),
      expires_at: expiresAt,
    });

    return { key, key_hash };
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

  public listKeys(tenantId?: string): ApiKeyRecord[] {
    const all = Array.from(this.keys.values());
    if (!tenantId) return all;
    return all.filter((r) => r.tenant_id === tenantId);
  }
}
