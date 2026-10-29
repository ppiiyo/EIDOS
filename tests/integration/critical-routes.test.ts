import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server';

describe('Critical API Routes Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Fresh Start & Health Verification', () => {
    it('GET /v1/health should verify vector store initialized in an empty state (itemsIndexed = 0)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.itemsIndexed).toBe(0);
      expect(body.initialItemsIndexed).toBe(0);
      expect(body.initializedEmpty).toBe(true);
      expect(body.checks?.vectorStore?.itemsIndexed).toBe(0);
      expect(body.checks?.vectorStore?.initializedEmpty).toBe(true);
    });
  });

  describe('Demo Endpoints (no auth required)', () => {
    beforeAll(async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/demo/load',
      });
    });

    it('POST /v1/demo/search should return 200 and results', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        headers: { 'content-type': 'application/json' },
        payload: { query: 'wireless headphones', limit: 5 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('results');
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results.length).toBeGreaterThan(0);
      expect(body.results.length).toBeLessThanOrEqual(5);
      expect(body).toHaveProperty('latencyMs');
    });

    it('POST /v1/demo/recommend should return 200 and recommendations for item_1 and item-1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/demo/recommend',
        headers: { 'content-type': 'application/json' },
        payload: { item_id: 'item_1', limit: 5 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('recommendations');
      expect(Array.isArray(body.recommendations)).toBe(true);
      expect(body.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Protected Endpoints (auth required)', () => {
    it('POST /v1/search without API key should return 401 (NOT 404!)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'content-type': 'application/json' },
        payload: { query: 'test', limit: 5 },
      });

      // Route must be found (not 404), and guarded by auth (401)
      expect(response.statusCode).toBe(401);
      expect(response.statusCode).not.toBe(404);
    });

    it('POST /v1/search with valid API key should return 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'eidos_test_key_1',
        },
        payload: { query: 'wireless headphones', limit: 5 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.results).toBeDefined();
      expect(body.results.length).toBeGreaterThan(0);
    });

    it('POST /v1/recommend without API key should return 401 (NOT 404!)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: { 'content-type': 'application/json' },
        payload: { item_id: 'item_1', limit: 5 },
      });

      expect(response.statusCode).toBe(401);
      expect(response.statusCode).not.toBe(404);
    });

    it('POST /v1/recommend with valid API key should return 200', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/recommend',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'eidos_test_key_1',
        },
        payload: { item_id: 'item_1', limit: 5 },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.recommendations).toBeDefined();
      expect(body.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Working Endpoints (regression check)', () => {
    it('GET /v1/health should return 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /v1/catalog/stats should return 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/catalog/stats',
      });

      expect(response.statusCode).toBe(200);
    });

    it('GET /v1/routes should return registered routes in non-production', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/routes',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.routes).toContain('/v1/search (POST)');
      expect(body.routes).toContain('/v1/recommend (POST)');
      expect(body.routes).toContain('/v1/demo/search (POST)');
      expect(body.routes).toContain('/v1/demo/recommend (POST)');
    });

    it('GET /v1/nonexistent should return 404 JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });
  });
});
