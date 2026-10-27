import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { buildServer } from '../../apps/api/src/server';

describe('Phase 3 Tasks 3.2 & 3.3: OpenAPI Documentation & Production Deployment Config', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Task 3.2: serves interactive Swagger UI at GET /docs and OpenAPI 3.0.3 JSON spec at GET /docs/json', async () => {
    const uiRes = await app.inject({
      method: 'GET',
      url: '/docs',
    });
    expect([200, 302]).toContain(uiRes.statusCode);

    const specRes = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });
    expect(specRes.statusCode).toBe(200);
    const spec = specRes.json();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toContain('Eidos API');
    expect(spec.paths).toBeDefined();
    expect(spec.paths['/v1/search']).toBeDefined();
    expect(spec.paths['/v1/recommend']).toBeDefined();
    expect(spec.paths['/v1/indexes']).toBeDefined();
    expect(spec.paths['/v1/keys']).toBeDefined();
    expect(spec.paths['/v1/keys/generate']).toBeDefined();
    expect(spec.paths['/v1/keys/revoke']).toBeDefined();
    expect(spec.paths['/v1/analytics/metrics']).toBeDefined();
    expect(spec.paths['/v1/settings']).toBeDefined();
  });

  it('Task 3.3: provides production docker-compose.prod.yml with API, PostgreSQL, Redis, Prometheus, and Grafana', () => {
    const composePath = path.resolve(process.cwd(), 'docker-compose.prod.yml');
    expect(fs.existsSync(composePath)).toBe(true);
    const content = fs.readFileSync(composePath, 'utf-8');

    expect(content).toContain('api:');
    expect(content).toContain('postgres:');
    expect(content).toContain('pgvector/pgvector:pg16');
    expect(content).toContain('redis:');
    expect(content).toContain('redis:7-alpine');
    expect(content).toContain('prometheus:');
    expect(content).toContain('prom/prometheus');
    expect(content).toContain('grafana:');
    expect(content).toContain('grafana/grafana');
    expect(content).toContain('healthcheck:');
  });

  it('Task 3.3: provides complete .env.example with all production environment variables', () => {
    const envExamplePath = path.resolve(process.cwd(), '.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const envContent = fs.readFileSync(envExamplePath, 'utf-8');

    const requiredVars = [
      'PORT=',
      'EIDOS_API_KEY=',
      'EIDOS_MASTER_KEY=',
      'HNSW_M=',
      'HNSW_EF_CONSTRUCTION=',
      'HNSW_EF_SEARCH=',
      'REDIS_URL=',
      'DATABASE_URL=',
      'SEMANTIC_CACHE_SIMILARITY_THRESHOLD=',
      'PROMETHEUS_PORT=',
      'GRAFANA_PORT=',
    ];

    for (const key of requiredVars) {
      expect(envContent).toContain(key);
    }
  });
});
