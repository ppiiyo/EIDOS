import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { VectorStore } from '../../apps/api/src/services/vector-store';
import { ServerEmbedder } from '../../apps/api/src/services/embedder';
import { apiRoutesPlugin } from '../../apps/api/src/plugins/routes';
import { TenantNamespaceManager, AuditLogger } from '../../apps/api/src/services/multi-tenancy';

describe('EIDOS v3.2 - Multi-Tenancy Isolation, RBAC & Audit Logging', () => {
  let app: FastifyInstance;
  const apiKey = process.env.EIDOS_API_KEY || 'eidos_dev_key';

  beforeAll(async () => {
    TenantNamespaceManager.getInstance().reset();
    AuditLogger.getInstance().clear();

    const defaultStore = new VectorStore();
    const embedder = new ServerEmbedder();

    app = Fastify();
    await app.register(apiRoutesPlugin, {
      vectorStore: defaultStore,
      embedder,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('strictly isolates catalog data and search results between tenant_alpha and tenant_beta', async () => {
    // Upsert item into tenant_alpha
    const alphaUpsert = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: {
        'x-api-key': apiKey,
        'x-tenant-id': 'tenant_alpha',
        'x-eidos-role': 'editor',
      },
      payload: {
        id: 'alpha-exclusive-1',
        title: 'Quantum Synthesizer Pro',
        description: 'Analog polyphonic synthesizer exclusive to tenant alpha',
        category: 'Electronics',
        tags: ['synth', 'audio'],
        price: 1299,
      },
    });
    expect(alphaUpsert.statusCode).toBe(200);

    // Upsert item into tenant_beta
    const betaUpsert = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: {
        'x-api-key': apiKey,
        'x-tenant-id': 'tenant_beta',
        'x-eidos-role': 'editor',
      },
      payload: {
        id: 'beta-exclusive-1',
        title: 'Titanium Mountain Bike',
        description: 'Carbon suspension trail bike exclusive to tenant beta',
        category: 'Sports',
        tags: ['bike', 'mountain'],
        price: 2499,
      },
    });
    expect(betaUpsert.statusCode).toBe(200);

    // Search in tenant_alpha should find alpha item and NEVER beta item
    const alphaSearch = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: {
        'x-api-key': apiKey,
        'x-tenant-id': 'tenant_alpha',
      },
      payload: {
        query: 'Quantum Synthesizer',
        topK: 10,
      },
    });
    expect(alphaSearch.statusCode).toBe(200);
    const alphaResults = alphaSearch.json().results;
    expect(alphaResults.some((r: any) => r.id === 'alpha-exclusive-1')).toBe(true);
    expect(alphaResults.some((r: any) => r.id === 'beta-exclusive-1')).toBe(false);

    // Search in tenant_beta for Quantum Synthesizer should NOT leak tenant_alpha's catalog
    const betaSearch = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: {
        'x-api-key': apiKey,
        'x-tenant-id': 'tenant_beta',
      },
      payload: {
        query: 'Quantum Synthesizer',
        topK: 10,
      },
    });
    expect(betaSearch.statusCode).toBe(200);
    const betaResults = betaSearch.json().results;
    expect(betaResults.some((r: any) => r.id === 'alpha-exclusive-1')).toBe(false);
  });

  it('enforces RBAC permissions (viewer blocked from write, admin allowed to view audit logs)', async () => {
    // Viewer role attempting catalog mutation -> 403 Forbidden
    const viewerAttempt = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: {
        'x-api-key': apiKey,
        'x-tenant-id': 'tenant_alpha',
        'x-eidos-role': 'viewer',
      },
      payload: {
        id: 'unauthorized-item',
        title: 'Unauthorized Item',
        category: 'General',
      },
    });
    expect(viewerAttempt.statusCode).toBe(403);

    // Editor role attempting to read /v1/audit/logs -> 403 Forbidden
    const editorAuditAttempt = await app.inject({
      method: 'GET',
      url: '/v1/audit/logs',
      headers: {
        'x-api-key': apiKey,
        'x-eidos-role': 'editor',
      },
    });
    expect(editorAuditAttempt.statusCode).toBe(403);

    // Admin role reading /v1/audit/logs -> 200 OK with recorded audit trail
    const adminAuditResponse = await app.inject({
      method: 'GET',
      url: '/v1/audit/logs?tenantId=tenant_alpha',
      headers: {
        'x-api-key': apiKey,
        'x-eidos-role': 'admin',
      },
    });
    expect(adminAuditResponse.statusCode).toBe(200);
    const body = adminAuditResponse.json();
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.logs[0].tenantId).toBe('tenant_alpha');
    expect(body.logs[0].action).toBe('catalog.upsert');
  });
});
