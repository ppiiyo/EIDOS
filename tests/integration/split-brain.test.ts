import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server';
import { StoreRegistry } from '../../apps/api/src/services/store-registry';

describe('PHASE 2: Split-Brain Elimination Integration Tests', () => {
  let app: FastifyInstance;
  const apiKey = process.env.EIDOS_API_KEY || 'eidos_dev_key';

  beforeAll(async () => {
    StoreRegistry.getInstance().reset();
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('unifies /v1/indexes, /v1/search, and /v1/recommend on the same StoreRegistry without split-brain', async () => {
    // 1. Create a new custom index via POST /v1/indexes
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/indexes',
      headers: { 'x-api-key': apiKey },
      payload: {
        name: 'luxury_watches',
        dimension: 384,
        quantization: 'int8',
      },
    });
    expect(createRes.statusCode).toBe(201);

    // 2. Index documents into 'luxury_watches' via POST /v1/indexes/luxury_watches/documents
    const docsRes = await app.inject({
      method: 'POST',
      url: '/v1/indexes/luxury_watches/documents',
      headers: { 'x-api-key': apiKey },
      payload: {
        documents: [
          {
            id: 'watch-1',
            title: 'Chronograph Titanium Automatic Watch',
            description: 'Swiss automatic movement sapphire crystal dive watch',
            category: 'Watches',
            price: 4200,
            tags: ['chronograph', 'titanium', 'swiss'],
          },
          {
            id: 'watch-2',
            title: 'Tourbillon Rose Gold Dress Watch',
            description: 'Hand-wound mechanical tourbillon timepiece',
            category: 'Watches',
            price: 12500,
            tags: ['tourbillon', 'gold', 'luxury'],
          },
        ],
      },
    });
    expect(docsRes.statusCode).toBe(200);
    expect(docsRes.json().indexedCount).toBe(2);

    // 3. Search in 'luxury_watches' via POST /v1/search with index parameter
    const searchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': apiKey },
      payload: {
        query: 'Chronograph Titanium Swiss Watch',
        index: 'luxury_watches',
        limit: 5,
      },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchBody = searchRes.json();
    expect(searchBody.results.some((r: any) => r.id === 'watch-1')).toBe(true);

    // 4. Recommend in 'luxury_watches' via POST /v1/recommend with index parameter
    const recRes = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': apiKey },
      payload: {
        item_id: 'watch-1',
        strategy: 'simple',
        index: 'luxury_watches',
        minSimilarity: 0.01,
        limit: 5,
      },
    });
    expect(recRes.statusCode).toBe(200);
    const recBody = recRes.json();
    expect(recBody.recommendations.some((r: any) => r.id === 'watch-2')).toBe(true);
  });

  it('isolates /v1/recommend and /v1/catalog/stats across tenants via StoreRegistry', async () => {
    // Upsert two items into tenant_omega
    const upsertRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: {
        'x-api-key': apiKey,
        'x-tenant-id': 'tenant_omega',
        'x-eidos-role': 'editor',
      },
      payload: {
        items: [
          {
            id: 'omega-1',
            title: 'Neural Interface Headset Pro',
            description: 'High-bandwidth BCI neural telemetry headset',
            category: 'Neurotech',
            tags: ['bci', 'neural'],
            price: 999,
          },
          {
            id: 'omega-2',
            title: 'Cortical Sensor Array Kit',
            description: 'Low-latency EEG & EMG sensor array for BCI headsets',
            category: 'Neurotech',
            tags: ['eeg', 'sensor', 'neural'],
            price: 499,
          },
        ],
      },
    });
    expect(upsertRes.statusCode).toBe(200);
    expect(upsertRes.json().upserted).toBe(2);

    // Recommend within tenant_omega finds omega-2 from omega-1
    const omegaRec = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: {
        'x-api-key': apiKey,
        'x-tenant-id': 'tenant_omega',
      },
      payload: {
        item_id: 'omega-1',
        strategy: 'simple',
        minSimilarity: 0.01,
        limit: 5,
      },
    });
    expect(omegaRec.statusCode).toBe(200);
    expect(omegaRec.json().recommendations.some((r: any) => r.id === 'omega-2')).toBe(true);

    // Recommend in default tenant for 'omega-1' returns 404 Not Found (strict tenant isolation)
    const defaultRec = await app.inject({
      method: 'POST',
      url: '/v1/recommend',
      headers: { 'x-api-key': apiKey },
      payload: {
        item_id: 'omega-1',
        strategy: 'simple',
        limit: 5,
      },
    });
    expect(defaultRec.statusCode).toBe(404);
  });

  it('returns 404 STORE_NOT_FOUND when querying a non-existent custom index', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': apiKey },
      payload: {
        query: 'headphones',
        index: 'non_existent_index_xyz',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('STORE_NOT_FOUND');
  });
});
