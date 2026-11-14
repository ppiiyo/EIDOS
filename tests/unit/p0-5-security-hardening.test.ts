import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildServer } from '../../apps/api/src/server';
import { summarizeQueryForLog, OperationalLogStore } from '../../apps/api/src/services/structured-logger';

describe('P0-5: Security Hardening (install-pilot.sh 0600, /metrics & funnel Auth, CORS Vary: Origin, Rate-Limit Key Rotation & Log PII Redaction)', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    'EIDOS_REQUIRE_METRICS_AUTH',
    'EIDOS_PUBLIC_METRICS',
    'EIDOS_REQUIRE_FUNNEL_AUTH',
    'EIDOS_FUNNEL_RATE_LIMIT_MAX',
    'RATE_LIMIT_MAX',
    'CORS_ORIGIN',
    'EIDOS_LOG_RAW_QUERIES',
  ];

  beforeEach(() => {
    for (const k of envKeys) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
    OperationalLogStore.getInstance().clear();
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = savedEnv[k];
      }
    }
  });

  it('1. scripts/install-pilot.sh --dry-run creates .env with 0600 permissions (umask 077), generates JWT_SECRET & EIDOS_PUBLIC_DEMO_KEY, and does not leak secrets to stdout', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-pilot-sec-'));
    try {
      const scriptPath = path.resolve(process.cwd(), 'scripts/install-pilot.sh');
      const stdout = execFileSync('bash', [scriptPath, '--dry-run', tmpDir], {
        encoding: 'utf8',
      });

      const envPath = path.join(tmpDir, '.env');
      expect(fs.existsSync(envPath)).toBe(true);

      const stat = fs.statSync(envPath);
      const mode = stat.mode & 0o777;
      expect(mode).toBe(0o600);

      const envContent = fs.readFileSync(envPath, 'utf8');
      expect(envContent).toContain('EIDOS_MASTER_KEY=eidos_mk_');
      expect(envContent).toContain('EIDOS_ADMIN_KEY=eidos_ak_');
      expect(envContent).toContain('EIDOS_SEARCH_KEY=eidos_pk_');
      expect(envContent).toContain('EIDOS_PUBLIC_DEMO_KEY=eidos_demo_');
      expect(envContent).toContain('JWT_SECRET=eidos_jwt_');
      expect(envContent).not.toContain('CORS_ORIGIN=*');

      // Dry-run stdout must not leak raw generated keys
      expect(stdout).not.toContain('eidos_mk_');
      expect(stdout).not.toContain('eidos_ak_');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('2. /metrics and /v1/analytics/funnel-event enforce authentication and rate-limiting', async () => {
    process.env.EIDOS_REQUIRE_METRICS_AUTH = 'true';
    process.env.EIDOS_REQUIRE_FUNNEL_AUTH = 'true';
    process.env.EIDOS_FUNNEL_RATE_LIMIT_MAX = '3';

    const app = await buildServer();
    try {
      await app.ready();

      // Unauthenticated /metrics must return 401
      const unauthMetrics = await app.inject({
        method: 'GET',
        url: '/metrics',
      });
      expect(unauthMetrics.statusCode).toBe(401);

      // Authenticated /metrics returns 200
      const authMetrics = await app.inject({
        method: 'GET',
        url: '/metrics',
        headers: { 'x-api-key': 'eidos_dev_key' },
      });
      expect(authMetrics.statusCode).toBe(200);
      expect(authMetrics.body).toContain('eidos_requests_total');

      // Unauthenticated POST /v1/analytics/funnel-event must return 401
      const unauthFunnel = await app.inject({
        method: 'POST',
        url: '/v1/analytics/funnel-event',
        payload: { type: 'click', itemId: 'sku-1', sessionId: 'sess-1' },
      });
      expect(unauthFunnel.statusCode).toBe(401);

      // Authenticated POST /v1/analytics/funnel-event returns 200
      const authFunnel = await app.inject({
        method: 'POST',
        url: '/v1/analytics/funnel-event',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { type: 'click', itemId: 'sku-1', sessionId: 'sess-1' },
      });
      expect(authFunnel.statusCode).toBe(200);
      expect(authFunnel.json().accepted).toBe(true);

      // 3rd request within window succeeds (max 3 per minute)
      const thirdFunnel = await app.inject({
        method: 'POST',
        url: '/v1/analytics/funnel-event',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { type: 'click', itemId: 'sku-2', sessionId: 'sess-1' },
      });
      expect(thirdFunnel.statusCode).toBe(200);

      // 4th request exceeds funnel rate limit (max 3 per minute) -> 429
      const rateLimitRes = await app.inject({
        method: 'POST',
        url: '/v1/analytics/funnel-event',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { type: 'click', itemId: 'sku-3', sessionId: 'sess-1' },
      });
      expect(rateLimitRes.statusCode).toBe(429);
    } finally {
      await app.close();
    }
  });

  it('3. CORS emits Vary: Origin and omits Access-Control-Allow-Origin for untrusted origins (no fallback to origins[0])', async () => {
    process.env.CORS_ORIGIN = 'https://shop.example.com,http://localhost:3000';
    const app = await buildServer();
    try {
      await app.ready();

      // Allowed origin
      const allowedRes = await app.inject({
        method: 'GET',
        url: '/v1/health',
        headers: { origin: 'https://shop.example.com' },
      });
      expect(allowedRes.statusCode).toBe(200);
      expect(allowedRes.headers['access-control-allow-origin']).toBe('https://shop.example.com');
      expect(String(allowedRes.headers['vary'])).toContain('Origin');

      // Untrusted origin must NOT receive origins[0] in access-control-allow-origin
      const evilRes = await app.inject({
        method: 'GET',
        url: '/v1/health',
        headers: { origin: 'https://evil-attacker.example.org' },
      });
      expect(evilRes.statusCode).toBe(200);
      expect(evilRes.headers['access-control-allow-origin']).toBeUndefined();
      expect(String(evilRes.headers['vary'])).toContain('Origin');
    } finally {
      await app.close();
    }
  });

  it('4. Rate limiter blocks IP flood even when attacker rotates random invalid x-api-key headers on every request', async () => {
    process.env.RATE_LIMIT_MAX = '3';
    const app = await buildServer();
    try {
      await app.ready();

      const statuses: number[] = [];
      for (let i = 1; i <= 4; i++) {
        const res = await app.inject({
          method: 'GET',
          url: '/v1/health/live',
          headers: { 'x-api-key': `random-unverified-attacker-key-${i}-${Date.now()}` },
        });
        statuses.push(res.statusCode);
      }

      expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
      expect(statuses[3]).toBe(429);
    } finally {
      await app.close();
    }
  });

  it('5. summarizeQueryForLog redacts raw query text by default to protect PII unless EIDOS_LOG_RAW_QUERIES=true', () => {
    const piiQuery = 'иван петров +79991234567 заказ 4421';

    const defaultSummary = summarizeQueryForLog(piiQuery);
    expect(defaultSummary.queryPreview).toBe('[REDACTED]');
    expect(defaultSummary.queryPreview).not.toContain('79991234567');
    expect(defaultSummary.queryLength).toBe(piiQuery.length);
    expect(defaultSummary.tokenCount).toBe(5);
    expect(defaultSummary.queryHash).toHaveLength(12);

    process.env.EIDOS_LOG_RAW_QUERIES = 'true';
    const optInSummary = summarizeQueryForLog(piiQuery);
    expect(optInSummary.queryPreview).toBe(piiQuery);
  });
});
