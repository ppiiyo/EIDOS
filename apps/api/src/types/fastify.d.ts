import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Indicates that the request is authenticated with a read-only public demo key.
     */
    demoMode?: boolean;
    /**
     * Per-minute rate limit applied when demoMode is active.
     */
    demoRateLimit?: number;
    /**
     * Resolved multi-tenant namespace identifier (defaults to 'default').
     */
    tenantId?: string;
    /**
     * High-resolution request start timestamp recorded by observabilityPlugin.
     */
    __startTimeHr?: number;
  }
}
