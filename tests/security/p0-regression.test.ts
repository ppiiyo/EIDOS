import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildServer } from '../../apps/api/src/server';
import { isPrivateOrReservedIp, validateAndResolvePublicUrl } from '../../apps/api/src/services/safe-fetch';
import { validateProductionKeyPolicy } from '../../apps/api/src/middleware/auth';
import { ApiKeyManager } from '../../apps/api/src/services/api-key-manager';

describe('P0 Security Regression Suite', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  describe('P0-1: SSRF & DNS Rebinding Guard', () => {
    it('blocks loopback, RFC1918, link-local IMDS, IPv6 ULA/loopback, and IPv4-mapped IPv6', () => {
      expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('172.16.5.4')).toBe(true);
      expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
      expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
      expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true);
      expect(isPrivateOrReservedIp('::1')).toBe(true);
      expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
      expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
      expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIp('::ffff:169.254.169.254')).toBe(true);
      expect(isPrivateOrReservedIp('93.184.216.34')).toBe(false);
    });

    it('rejects non-canonical IP literals, disallowed ports, and internal hostnames', async () => {
      await expect(validateAndResolvePublicUrl('http://2130706433/feed.xml')).rejects.toThrow(/SSRF_BLOCKED/);
      await expect(validateAndResolvePublicUrl('http://0x7f000001/feed.xml')).rejects.toThrow(/SSRF_BLOCKED/);
      await expect(validateAndResolvePublicUrl('http://127.0.0.1.nip.io/feed.xml')).rejects.toThrow(/SSRF_BLOCKED/);
      await expect(validateAndResolvePublicUrl('http://example.com:6379/feed.xml')).rejects.toThrow(/SSRF_BLOCKED/);
      await expect(validateAndResolvePublicUrl('file:///etc/passwd')).rejects.toThrow(/SSRF_BLOCKED/);
    });
  });

  describe('P0-2 & P0-3 & P0-4 & P0-5: Auth, JWT, Demo Sandbox, and Tenant Isolation', () => {
    it('enforces minimum 24-char strong key in production', () => {
      expect(validateProductionKeyPolicy({ NODE_ENV: 'production', EIDOS_MASTER_KEY: 'short_key_123' }).valid).toBe(false);
      expect(validateProductionKeyPolicy({ NODE_ENV: 'production', EIDOS_MASTER_KEY: 'eidos_dev_key' }).valid).toBe(false);
      expect(
        validateProductionKeyPolicy({
          NODE_ENV: 'production',
          EIDOS_MASTER_KEY: 'eidos_mk_prod_9f8e7d6c5b4a3f2e1d0c9b8a7f6e',
        }).valid
      ).toBe(true);
    });

    it('rejects alg:none JWT, unregistered prefix keys, and cross-tenant search keys', async () => {
      process.env.EIDOS_MASTER_KEY = 'master_secret_key_for_test_suite_123456';
      process.env.EIDOS_SEARCH_KEY = 'search_only_key_for_default_tenant_1234';
      const app = await buildServer();

      // 1. Forged alg:none JWT -> 401
      const forgedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const forgedPayload = Buffer.from(JSON.stringify({ role: 'admin', exp: 9999999999 })).toString('base64url');
      const forgedJwt = `${forgedHeader}.${forgedPayload}.`;

      const resJwt = await app.inject({
        method: 'GET',
        url: '/v1/admin/keys',
        headers: { authorization: `Bearer ${forgedJwt}` },
      });
      expect(resJwt.statusCode).toBe(401);

      // 2. Unregistered prefix-spoofed key -> 401
      const resSpoof = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_pk_forged_unregistered_random_string' },
        payload: { query: 'test' },
      });
      expect(resSpoof.statusCode).toBe(401);

      // 3. Hardcoded legacy demo key -> 401
      const resOldDemo = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_demo_key' },
        payload: { query: 'test' },
      });
      expect(resOldDemo.statusCode).toBe(401);

      // 4. Env EIDOS_SEARCH_KEY attempting cross-tenant access -> 403
      const resCrossTenant = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: {
          'x-api-key': 'search_only_key_for_default_tenant_1234',
          'x-tenant-id': 'victim-tenant',
        },
        payload: { query: 'test' },
      });
      expect(resCrossTenant.statusCode).toBe(403);

      // 5. Unauthenticated POST /v1/catalog/import-yml -> 401
      const resImportNoAuth = await app.inject({
        method: 'POST',
        url: '/v1/catalog/import-yml',
        payload: { url: 'http://127.0.0.1:8080/internal.xml' },
      });
      expect(resImportNoAuth.statusCode).toBe(401);

      await app.close();
    });

    it('isolates /v1/demo/reset from production default store (P0-4)', async () => {
      process.env.EIDOS_ADMIN_KEY = 'admin_secret_key_for_test_suite_123456';
      const app = await buildServer();

      // Seed 1 item into production `default:default` store
      const upsertRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': 'admin_secret_key_for_test_suite_123456' },
        payload: {
          id: 'prod-1',
          title: 'Production Laptop Pro',
          category: 'Laptops',
          price: 1000,
        },
      });
      expect(upsertRes.statusCode).toBe(200);

      // Call public /v1/demo/reset
      const resetRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/reset',
      });
      expect(resetRes.statusCode).toBe(200);

      // Verify production store still has its item intact
      const statsRes = await app.inject({
        method: 'GET',
        url: '/v1/catalog/stats',
      });
      expect(statsRes.json().itemsIndexed).toBe(1);

      await app.close();
    });
  });

  describe('P0-6: Stored XSS URL Sanitization in VectorStore', () => {
    it('strips javascript: and data: URLs during catalog upsert', async () => {
      process.env.EIDOS_ADMIN_KEY = 'admin_secret_key_for_test_suite_123456';
      const app = await buildServer();

      await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': 'admin_secret_key_for_test_suite_123456' },
        payload: {
          id: 'xss-item-1',
          title: 'Wireless Headphones X1',
          category: 'Audio',
          url: 'javascript:alert(document.cookie)',
          imageUrl: 'data:text/html,<script>alert(1)</script>',
        },
      });

      const searchRes = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'admin_secret_key_for_test_suite_123456' },
        payload: { query: 'Wireless Headphones X1' },
      });

      const hit = searchRes.json().results[0];
      expect(hit).toBeDefined();
      expect(hit.url).toBe('/product/xss-item-1');
      expect(hit.imageUrl).toBeNull();

      await app.close();
    });
  });
});
