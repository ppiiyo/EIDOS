import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';

/**
 * Registers OpenAPI / Swagger schema specifications and the interactive Swagger UI.
 * Mounts interactive documentation at `/docs` and raw spec at `/docs/json`.
 */
export async function registerOpenAPI(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'EIDOS API',
        description: 'Production Semantic Recommendation & Approximate Nearest Neighbor Retrieval Engine',
        version: '2.1.0',
        contact: {
          name: 'EIDOS Engineering Team',
          url: 'https://github.com/ppiiyo/EIDOS',
        },
      },
      servers: [
        {
          url: 'http://localhost:8080',
          description: 'Development API Server',
        },
      ],
      tags: [
        { name: 'Health', description: 'System health, telemetry, and index diagnostics' },
        { name: 'Catalog', description: 'Item ingestion, vector embedding and upsert operations' },
        { name: 'Search', description: 'Dense semantic similarity search over high-dimensional vectors' },
        { name: 'Recommendation', description: 'Item-to-item and user-to-item personalized neural recommendations' },
        { name: 'Adaptive', description: 'Exploration bandits, LinUCB, multi-interest and steering' },
        { name: 'Feedback', description: 'Online click/conversion feedback and adaptive ranking training' },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            name: 'x-api-key',
            in: 'header',
            description: 'API key authentication token for enterprise access',
          },
        },
      },
    },
  });

  await fastify.register(fastifySwaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });
}
