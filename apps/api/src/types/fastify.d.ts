import 'fastify';
import { ApiKeyManager } from '../services/api-key-manager';
import { StoreRegistry } from '../services/store-registry';
import { ClusterStateCoordinator } from '../services/cluster-coordinator';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * API Key rotation & revocation manager instance attached to the server.
     */
    keyManager?: ApiKeyManager;
    /**
     * Unified StoreRegistry managing tenant and index VectorStore instances.
     */
    storeRegistry?: StoreRegistry;
    /**
     * Multi-node horizontal scaling & cluster state coordinator attached to the server.
     */
    clusterCoordinator?: ClusterStateCoordinator;
  }

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
    /**
     * Guards against duplicate HTTP request metric recording across onSend/onResponse hooks.
     */
    __metricsRecorded?: boolean;
  }
}
