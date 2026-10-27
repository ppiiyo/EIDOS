import { EventEmitter } from 'events';
import { CircuitBreaker, ShardCoordinator, normalizeVector } from '@eidos/core';
import { ApiQueryCache } from './query-cache';
import { getCache, getSemanticCache } from './cache';

export interface ClusterInvalidationEvent {
  sourceNodeId: string;
  catalogVersion: number;
  reason: string;
  timestamp: number;
}

export interface ClusterNodeConfig {
  nodeId?: string;
  role?: 'coordinator' | 'shard' | 'standalone';
  clusterMode?: boolean;
  shardCount?: number;
}

/**
 * Shared in-process pub/sub bus simulating Redis Pub/Sub / gossip channel across
 * multiple Fastify instances in horizontal scaling tests & multi-worker deployments,
 * while also syncing with local L1/L2 caches.
 */
class ClusterInvalidationBus {
  private static readonly emitter = new EventEmitter();
  private static globalCatalogVersion = 1;

  static {
    ClusterInvalidationBus.emitter.setMaxListeners(100);
  }

  public static publish(sourceNodeId: string, reason: string): ClusterInvalidationEvent {
    ClusterInvalidationBus.globalCatalogVersion += 1;
    const event: ClusterInvalidationEvent = {
      sourceNodeId,
      catalogVersion: ClusterInvalidationBus.globalCatalogVersion,
      reason,
      timestamp: Date.now(),
    };
    ClusterInvalidationBus.emitter.emit('invalidate', event);
    return event;
  }

  public static subscribe(listener: (event: ClusterInvalidationEvent) => void): () => void {
    ClusterInvalidationBus.emitter.on('invalidate', listener);
    return () => {
      ClusterInvalidationBus.emitter.off('invalidate', listener);
    };
  }

  public static getVersion(): number {
    return ClusterInvalidationBus.globalCatalogVersion;
  }
}

/**
 * ClusterStateCoordinator manages horizontal scaling state for an EIDOS API node:
 * - Instance identity (`nodeId`, `role`, `clusterMode`)
 * - Graceful drain state (`draining`) for zero-downtime Kubernetes/Docker rolling updates
 * - Distributed cache invalidation & catalog version synchronization across API instances
 * - Distributed HNSW `ShardCoordinator` & `CircuitBreaker` failover orchestration
 */
export class ClusterStateCoordinator {
  private static nodeSeq = 0;

  public readonly nodeId: string;
  public readonly role: 'coordinator' | 'shard' | 'standalone';
  public readonly clusterMode: boolean;
  public readonly shardCoordinator: ShardCoordinator;
  public readonly circuitBreaker: CircuitBreaker;

  private draining = false;
  private localCatalogVersion: number;
  private unsubscribeBus: (() => void) | null = null;

  constructor(config?: ClusterNodeConfig) {
    ClusterStateCoordinator.nodeSeq += 1;
    this.nodeId =
      config?.nodeId ||
      process.env.EIDOS_NODE_ID ||
      process.env.POD_NAME ||
      (process.env.SHARD_ID !== undefined
        ? `eidos-shard-${process.env.SHARD_ID}`
        : `eidos-node-${ClusterStateCoordinator.nodeSeq}`);

    const rawRole = config?.role || process.env.ROLE || 'standalone';
    this.role =
      rawRole === 'coordinator' || rawRole === 'shard' ? rawRole : 'standalone';

    this.clusterMode =
      config?.clusterMode ?? process.env.CLUSTER_MODE === 'true';

    const shardCount =
      config?.shardCount ??
      Math.max(1, parseInt(process.env.EIDOS_SHARD_COUNT || '3', 10));

    this.shardCoordinator = new ShardCoordinator({
      shardCount,
      dimensions: 384,
      routingMode: 'lsh',
      replicationFactor: 2,
    });

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 5_000,
      halfOpenMaxSuccesses: 1,
    });

    this.localCatalogVersion = ClusterInvalidationBus.getVersion();

    // Seed initial baseline vectors into shard coordinator so cluster probes are ready immediately
    this.seedBaselineClusterVectors(30);

    // Subscribe to cross-instance cache invalidation events
    this.unsubscribeBus = ClusterInvalidationBus.subscribe((event) => {
      this.localCatalogVersion = Math.max(this.localCatalogVersion, event.catalogVersion);
      if (event.sourceNodeId !== this.nodeId) {
        ApiQueryCache.invalidateAll();
        getSemanticCache().clear();
        getCache().clearMemorySync();
      }
    });
  }

  private seedBaselineClusterVectors(count: number): void {
    for (let i = 0; i < count; i++) {
      const vec = normalizeVector(
        Array.from({ length: 384 }, (_, d) => Math.sin((i + 1) * 0.19 + d * 0.07))
      );
      this.shardCoordinator.upsert(`cluster-seed-${i}`, vec, {
        title: `Cluster Seed Item ${i}`,
        category: i % 2 === 0 ? 'Electronics' : 'Audio',
      });
    }
  }

  public getCatalogVersion(): number {
    return Math.max(this.localCatalogVersion, ClusterInvalidationBus.getVersion());
  }

  public broadcastInvalidation(reason = 'catalog.mutation'): ClusterInvalidationEvent {
    ApiQueryCache.invalidateAll();
    getSemanticCache().clear();
    getCache().clearMemorySync();
    const event = ClusterInvalidationBus.publish(this.nodeId, reason);
    this.localCatalogVersion = event.catalogVersion;
    return event;
  }

  public setDraining(draining: boolean): void {
    this.draining = draining;
  }

  public isDraining(): boolean {
    return this.draining;
  }

  public setShardHealth(shardId: string, healthy: boolean) {
    this.shardCoordinator.setShardHealth(shardId, healthy);
    return {
      shardId,
      healthy,
      leaderState: this.shardCoordinator.getLeaderState(),
      stats: this.shardCoordinator.getStats(),
    };
  }

  public getClusterStatus() {
    const stats = this.shardCoordinator.getStats();
    const leaderState = this.shardCoordinator.getLeaderState();
    return {
      nodeId: this.nodeId,
      role: this.role,
      clusterMode: this.clusterMode,
      draining: this.draining,
      catalogVersion: this.getCatalogVersion(),
      circuitBreakerState: this.circuitBreaker.getState(),
      leaderState,
      shardCount: stats.shardCount,
      healthyShards: stats.healthyShards,
      totalClusterVectors: stats.totalVectors,
      shards: stats.shards,
    };
  }

  public close(): void {
    if (this.unsubscribeBus) {
      this.unsubscribeBus();
      this.unsubscribeBus = null;
    }
  }
}
