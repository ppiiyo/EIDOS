import 'fastify';
import { ApiKeyManager, ApiKeyScopeRole } from '../services/api-key-manager';
import { StoreRegistry } from '../services/store-registry';
import { ClusterStateCoordinator } from '../services/cluster-coordinator';
import { SearchFunnelService } from '../services/search-funnel';

export interface AuthenticatedKeyContext {
  keyId: string;
  role: ApiKeyScopeRole;
  tenantId: string;
  isMasterKey?: boolean;
  allowedIndexes?: string[];
  allowedFilters?: Record<string, unknown>;
}

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
    /**
     * Search Funnel conversion tracking service decorated at server startup.
     */
    funnelService: SearchFunnelService;
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
     * Resolved API key hierarchy & scope context attached by authenticate middleware.
     */
    apiKeyContext?: AuthenticatedKeyContext;
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
