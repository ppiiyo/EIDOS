import { describe, test, expect } from 'vitest';
import { ApiKeyManager } from '../../apps/api/src/services/api-key-manager';
import { buildServer } from '../../apps/api/src/server';

describe('ApiKeyManager & /v1/keys/revoke Rotation', () => {
  test('revoked key is rejected', async () => {
    const keyManager = new ApiKeyManager();
    const { key, key_hash } = keyManager.generateKey('tenant-1');

    expect(keyManager.isValid(key)).toBe(true);

    keyManager.revokeKey(key_hash);
    expect(keyManager.isValid(key)).toBe(false);
    expect(keyManager.isRevokedOrExpired(key)).toBe(true);
  });

  test('expired key is rejected', () => {
    const keyManager = new ApiKeyManager();
    const pastDate = new Date(Date.now() - 60_000);
    const { key } = keyManager.generateKey('tenant-expired', pastDate);

    expect(keyManager.isValid(key)).toBe(false);
    expect(keyManager.isRevokedOrExpired(key)).toBe(true);
  });

  test('POST /v1/keys/revoke revokes key and middleware rejects subsequent requests with 401', async () => {
    const app = await buildServer();
    await app.ready();

    try {
      const keyManager = app.keyManager!;
      const { key, key_hash } = keyManager.generateKey('tenant-enterprise');

      // 1. Verify newly generated key is accepted by middleware
      const okRes = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': key },
        payload: { query: 'headphones', limit: 3 },
      });
      expect(okRes.statusCode).toBe(200);

      // 2. Revoke key via POST /v1/keys/revoke
      const revokeRes = await app.inject({
        method: 'POST',
        url: '/v1/keys/revoke',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { key_hash },
      });
      expect(revokeRes.statusCode).toBe(200);
      expect(revokeRes.json()).toEqual({ success: true, message: 'Key revoked' });

      // 3. Subsequent request with revoked key is rejected with 401
      const rejectedRes = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': key },
        payload: { query: 'headphones', limit: 3 },
      });
      expect(rejectedRes.statusCode).toBe(401);
      expect(rejectedRes.json().message).toBe('API key has been revoked or expired.');
    } finally {
      await app.close();
    }
  });
});
