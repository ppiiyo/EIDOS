import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';

/**
 * Registers OpenAPI 3.0.3 / Swagger schema specifications and interactive Swagger UI.
 * Mounts interactive documentation at `/docs` and raw spec at `/docs/json` & `/v1/openapi.json`.
 */
export async function registerOpenAPI(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Eidos API — Semantic Search & Adaptive Recommendation Engine',
        description:
          'Production Hybrid Vector Search (BM25 + 384-d HNSW), Cross-Encoder Reranker, Semantic Cache, Index Manager, Multi-Interest User Tower, Contextual Bandits (LinUCB), and SMMR Diversity Re-ranking API.',
        version: '3.5.0',
        contact: {
          name: 'Eidos Engineering Team',
          url: 'https://github.com/ppiiyo/EIDOS',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:8080',
          description: 'Local Development API Server',
        },
        {
          url: 'https://eidos-semantic-ideation-platform.ai.studio',
          description: 'Cloud Production API Server',
        },
      ],
      tags: [
        { name: 'Health', description: 'System health, Kubernetes readiness/liveness probes, and telemetry' },
        { name: 'Catalog', description: 'Item ingestion, vector embedding, and catalog diagnostics' },
        { name: 'Search', description: 'Hybrid (BM25 + Dense 384-d HNSW) semantic search with Cross-Encoder Reranking' },
        { name: 'Recommendation', description: 'Unified item-to-item, adaptive multi-feature, and personalized user recommendations' },
        { name: 'Indexes', description: 'Index creation, shard management, and document ingestion' },
        { name: 'API Keys', description: 'API key generation, listing, and revocation' },
        { name: 'Analytics', description: 'Real-time search latency percentiles (p50/p95/p99), cache hit rates, and SEO telemetry' },
        { name: 'Settings', description: 'Rate limits, webhooks, and runtime engine parameters' },
        { name: 'Feedback', description: 'Online click/conversion feedback loop and adaptive weight learning' },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header',
            description: 'API key authentication header (`x-api-key: <EIDOS_API_KEY>`)',
          },
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Bearer API Key or signed JWT token (`Authorization: Bearer <TOKEN>`)',
          },
        },
      },
    },
  });

  await fastify.register(fastifySwaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject) => {
      const spec = { ...swaggerObject, paths: { ...(swaggerObject.paths || {}) } };
      const extraPaths: Record<string, Record<string, unknown>> = {
        '/v1/indexes': {
          get: {
            tags: ['Indexes'],
            summary: 'List all vector & hybrid indexes',
            security: [{ apiKey: [] }],
            responses: { 200: { description: 'List of configured indexes with document counts and memory usage' } },
          },
          post: {
            tags: ['Indexes'],
            summary: 'Create a new HNSW vector index',
            security: [{ apiKey: [] }],
            responses: { 201: { description: 'Index created' } },
          },
        },
        '/v1/indexes/{name}': {
          delete: {
            tags: ['Indexes'],
            summary: 'Delete an index by name',
            security: [{ apiKey: [] }],
            responses: { 200: { description: 'Index deleted' } },
          },
        },
        '/v1/indexes/{name}/documents': {
          post: {
            tags: ['Indexes'],
            summary: 'Batch ingest JSON or CSV documents into an index',
            security: [{ apiKey: [] }],
            responses: { 200: { description: 'Documents indexed' } },
          },
        },
        '/v1/keys': {
          get: {
            tags: ['API Keys'],
            summary: 'List active and revoked API keys',
            security: [{ apiKey: [] }],
            responses: { 200: { description: 'Masked API keys list' } },
          },
        },
        '/v1/keys/generate': {
          post: {
            tags: ['API Keys'],
            summary: 'Generate a new Eidos API key (eidos_pk_...)',
            security: [{ apiKey: [] }],
            responses: { 201: { description: 'Generated API key' } },
          },
        },
        '/v1/keys/revoke': {
          post: {
            tags: ['API Keys'],
            summary: 'Revoke an existing API key',
            security: [{ apiKey: [] }],
            responses: { 200: { description: 'Key revoked' } },
          },
        },
        '/v1/analytics/metrics': {
          get: {
            tags: ['Analytics'],
            summary: 'Get real-time latency percentiles (p50, p95, p99), cache hit rate, and search volume series',
            security: [{ apiKey: [] }],
            responses: { 200: { description: 'Real-time analytics metrics payload' } },
          },
        },
        '/v1/settings': {
          get: {
            tags: ['Settings'],
            summary: 'Get workspace rate limits, webhooks, and engine settings',
            security: [{ apiKey: [] }],
            responses: { 200: { description: 'Current workspace configuration' } },
          },
          put: {
            tags: ['Settings'],
            summary: 'Update workspace rate limits and engine parameters',
            security: [{ apiKey: [] }],
            responses: { 200: { description: 'Updated workspace configuration' } },
          },
        },
      };

      for (const [routePath, methods] of Object.entries(extraPaths)) {
        spec.paths[routePath] = {
          ...(spec.paths[routePath] || {}),
          ...methods,
        };
      }
      return spec;
    },
  });

  fastify.get('/v1/openapi.json', async () => {
    return fastify.swagger();
  });
}
