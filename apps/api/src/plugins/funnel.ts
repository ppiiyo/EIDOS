import { FastifyInstance } from 'fastify';
import { SearchFunnelService } from '../services/search-funnel';

declare module 'fastify' {
  interface FastifyInstance {
    funnelService: SearchFunnelService;
  }
}

export async function funnelPlugin(fastify: FastifyInstance): Promise<void> {
  if (!fastify.hasDecorator('funnelService')) {
    fastify.decorate('funnelService', new SearchFunnelService());
  }
}

(funnelPlugin as unknown as Record<symbol, boolean>)[Symbol.for('skip-override')] = true;

export default funnelPlugin;
