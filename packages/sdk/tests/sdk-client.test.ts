import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EidosClient } from '../src/client';

describe('@eidos/sdk EidosClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('validates required baseUrl and apiKey in constructor', () => {
    expect(() => new EidosClient({ baseUrl: '', apiKey: 'key' })).toThrow(/baseUrl is required/);
    expect(() => new EidosClient({ baseUrl: 'https://api.eidos.dev', apiKey: '' })).toThrow(
      /apiKey is required/
    );
  });

  it('executes recommend(), search(), ingestCatalog(), and health() against REST endpoints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/health') && init?.method === 'GET') {
        return new Response(
          JSON.stringify({ status: 'ok', version: '2.5.0', itemsCount: 42 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.endsWith('/v1/recommend') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            sourceItemId: '1',
            recommendations: [
              {
                id: '2',
                title: 'The Matrix',
                description: 'Sci-fi simulation movie',
                category: 'Movies',
                tags: ['scifi'],
                score: 0.94,
              },
            ],
            latencyMs: 1.2,
            entropy: 1.5,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.endsWith('/v1/search') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            query: 'cyberpunk',
            results: [
              {
                id: '1',
                title: 'Cyberpunk 2077',
                description: 'RPG',
                category: 'Games',
                tags: ['rpg'],
                score: 0.98,
              },
            ],
            latencyMs: 0.9,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.endsWith('/v1/catalog') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ success: true, indexedCount: 1, durationMs: 3.4 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new EidosClient({
      baseUrl: 'https://api.eidos.dev///',
      apiKey: 'secret-token',
      timeoutMs: 5000,
    });

    const health = await client.health();
    expect(health.status).toBe('ok');
    expect(health.itemsCount).toBe(42);

    const recRes = await client.recommend({ itemId: '1', limit: 5 });
    expect(recRes.sourceItemId).toBe('1');
    expect(recRes.recommendations).toHaveLength(1);

    const searchRes = await client.search({ query: 'cyberpunk', limit: 5 });
    expect(searchRes.results[0].id).toBe('1');

    const ingestRes = await client.ingestCatalog([
      {
        id: '10',
        title: 'Quantum CPU',
        description: 'Processor',
        category: 'Hardware',
        tags: ['cpu'],
      },
    ]);
    expect(ingestRes.success).toBe(true);
    expect(ingestRes.indexedCount).toBe(1);
  });

  it('surfaces structured API errors on non-2xx responses', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ message: 'Invalid API key provided' }), {
        status: 401,
        statusText: 'Unauthorized',
      });
    }) as unknown as typeof fetch;

    const client = new EidosClient({
      baseUrl: 'https://api.eidos.dev',
      apiKey: 'bad-key',
    });

    await expect(client.search({ query: 'test' })).rejects.toThrow(
      /Eidos API Error: Invalid API key provided/
    );
    await expect(client.health()).rejects.toThrow(/Eidos Health check failed: HTTP 401/);
  });
});
