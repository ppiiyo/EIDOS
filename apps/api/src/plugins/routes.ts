import { FastifyInstance, FastifyReply } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { healthRoutes } from '../routes/health';
import { catalogRoutes } from '../routes/catalog';
import { searchRoutes } from '../routes/search';
import { recommendRoutes } from '../routes/recommend';
import { recommendUserRoutes } from '../routes/recommend-user';
import { recommendAdaptiveRoutes } from '../routes/recommend-adaptive';
import { feedbackRoutes } from '../routes/feedback';
import { enterpriseRoutes } from '../routes/enterprise';
import { analyticsRoutes } from '../routes/analytics';
import { funnelRoutes } from '../routes/funnel';
import { keyRoutes } from '../routes/keys';
import { indexRoutes } from '../routes/indexes';
import { settingsRoutes } from '../routes/settings';
import { funnelPlugin } from './funnel';
import { VectorStore } from '../services/vector-store';
import { ServerEmbedder } from '../services/embedder';
import { TenantNamespaceManager } from '../services/multi-tenancy';
import { StoreRegistry } from '../services/store-registry';
import { ApiKeyManager } from '../services/api-key-manager';

export interface ApiRoutesPluginOptions {
  vectorStore: VectorStore;
  embedder: ServerEmbedder;
  keyManager?: ApiKeyManager;
  storeRegistry?: StoreRegistry;
}

export async function apiRoutesPlugin(
  fastify: FastifyInstance,
  opts: ApiRoutesPluginOptions
): Promise<void> {
  await fastify.register(funnelPlugin);

  const storeRegistry = opts.storeRegistry || StoreRegistry.getInstance();
  storeRegistry.setDefaultStore(opts.vectorStore);
  TenantNamespaceManager.getInstance().setDefaultStore(opts.vectorStore);
  fastify.storeRegistry = storeRegistry;

  const keyManager = opts.keyManager || ApiKeyManager.getInstance();
  fastify.keyManager = keyManager;

  // Ensure reply.sendFile is available even if @fastify/static is not mounted
  if (!fastify.hasReplyDecorator('sendFile')) {
    fastify.decorateReply('sendFile', function (this: FastifyReply, filename: string) {
      const candidatePaths = [
        path.resolve(process.cwd(), 'dist', filename),
        path.resolve(process.cwd(), 'apps/workspace/dist', filename),
        path.resolve(process.cwd(), 'apps/workspace', filename),
      ];
      for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
          const content = fs.readFileSync(candidate, 'utf-8');
          return this.status(200).header('content-type', 'text/html; charset=utf-8').send(content);
        }
      }
      return this.status(200)
        .header('content-type', 'text/html; charset=utf-8')
        .send(
          '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>EIDOS</title></head><body><div id="root"></div></body></html>'
        );
    });
  }

  // Register all API routes BEFORE SPA fallback
  await fastify.register(healthRoutes, {
    vectorStore: opts.vectorStore,
    embedder: opts.embedder,
  });
  await fastify.register(catalogRoutes, {
    vectorStore: opts.vectorStore,
    embedder: opts.embedder,
  });
  await fastify.register(searchRoutes, {
    vectorStore: opts.vectorStore,
    embedder: opts.embedder,
  });
  await fastify.register(recommendRoutes, {
    vectorStore: opts.vectorStore,
  });
  await fastify.register(recommendUserRoutes, {
    vectorStore: opts.vectorStore,
  });
  await fastify.register(recommendAdaptiveRoutes, {
    vectorStore: opts.vectorStore,
  });
  await fastify.register(feedbackRoutes);
  await fastify.register(enterpriseRoutes);
  await fastify.register(analyticsRoutes, {
    vectorStore: opts.vectorStore,
    embedder: opts.embedder,
  });
  await fastify.register(funnelRoutes);
  await fastify.register(keyRoutes, {
    keyManager,
  });
  await fastify.register(indexRoutes, {
    vectorStore: opts.vectorStore,
    embedder: opts.embedder,
  });
  await fastify.register(settingsRoutes);

  // Diagnostic endpoint for route verification (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    fastify.get('/v1/routes', async () => {
      return {
        routes: fastify.printRoutes({ commonPrefix: false }),
        timestamp: new Date().toISOString(),
      };
    });
  }

  // 404 JSON handler for unknown /v1/* API endpoints; SPA fallback ONLY for non-API routes
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/v1/') || request.url === '/v1') {
      reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `API endpoint ${request.url} not found`,
      });
    } else {
      // SPA fallback only for non-API routes
      (reply as FastifyReply & { sendFile: (file: string) => FastifyReply }).sendFile('index.html');
    }
  });
}

(apiRoutesPlugin as any)[Symbol.for('skip-override')] = true;
