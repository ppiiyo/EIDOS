import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';

/**
 * Registers OpenAPI 3.0.3 / Swagger schema specifications and interactive Swagger UI.
 * Mounts interactive documentation at `/docs` and raw spec at `/docs/json`.
 */
export async function registerOpenAPI(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Eidos API — Semantic Search & Adaptive Recommendation Engine',
        description:
          'Production Hybrid Vector Search (BM25 + 384-d HNSW), Multi-Interest User Tower, Contextual Bandits (LinUCB), and SMMR Diversity Re-ranking API.',
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
        { name: 'Search', description: 'Hybrid (BM25 + Dense 384-d HNSW) semantic search with security guardrails' },
        { name: 'Recommendation', description: 'Unified item-to-item, adaptive multi-feature, and personalized user recommendations' },
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
  });
}
