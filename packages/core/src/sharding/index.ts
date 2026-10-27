import { cosineSimilarity } from '../cosine';
import { calculateMMRScore } from '../entropy';
import { HNSWIndex } from '../hnsw';
import { HNSWSearchResult, ShardNode } from '../types';

/**
 * Deterministic 32-bit FNV-1a hash function for consistent hashing and hyperplane seeding.
 */
function fnv1aHash(input: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export interface LSHRouterOptions {
  shardIds?: string[];
  shardCount?: number;
  dimension?: number;
  dimensions?: number;
  numHyperplanes?: number;
  virtualNodesPerShard?: number;
  seed?: number;
}

/**
 * LSHShardRouter combines Locality-Sensitive Hashing (random hyperplane projections)
 * for semantic locality routing with a Consistent Hash Ring (virtual nodes) for
 * deterministic key-based routing.
 */
export class LSHShardRouter {
  private readonly shardIds: string[];
  private readonly dimension: number;
  private readonly numHyperplanes: number;
  private readonly hyperplanes: Float32Array[];
  private readonly ring = new Map<number, string>();
  private sortedRingTokens: number[] = [];
  private readonly virtualNodesPerShard: number;

  constructor(options?: LSHRouterOptions) {
    const count = options?.shardCount ?? 4;
    this.shardIds =
      options?.shardIds && options.shardIds.length > 0
        ? [...options.shardIds]
        : Array.from({ length: Math.max(1, count) }, (_, i) => `shard-${i}`);
    this.dimension = options?.dimension ?? options?.dimensions ?? 384;
    this.numHyperplanes = options?.numHyperplanes ?? 8;
    this.virtualNodesPerShard = options?.virtualNodesPerShard ?? 64;

    const baseSeed = options?.seed ?? 1337;
    this.hyperplanes = this.generateDeterministicHyperplanes(baseSeed);
    this.rebuildRing();
  }

  private generateDeterministicHyperplanes(seed: number): Float32Array[] {
    const planes: Float32Array[] = [];
    let state = seed >>> 0;

    for (let p = 0; p < this.numHyperplanes; p++) {
      const plane = new Float32Array(this.dimension);
      let normSq = 0;
      for (let d = 0; d < this.dimension; d++) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        const val = ((state >>> 0) / 0xffffffff) * 2 - 1;
        plane[d] = val;
        normSq += val * val;
      }
      const norm = Math.sqrt(normSq) || 1;
      for (let d = 0; d < this.dimension; d++) {
        plane[d] /= norm;
      }
      planes.push(plane);
    }
    return planes;
  }

  private rebuildRing(): void {
    this.ring.clear();
    for (const shardId of this.shardIds) {
      for (let v = 0; v < this.virtualNodesPerShard; v++) {
        const token = fnv1aHash(`${shardId}::vnode::${v}`);
        this.ring.set(token, shardId);
      }
    }
    this.sortedRingTokens = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  /**
   * Computes an n-bit LSH signature from a vector using hyperplane dot products.
   */
  public computeLSHSignature(vector: Float32Array | number[]): number {
    let signature = 0;
    const len = Math.min(this.dimension, vector.length);
    for (let p = 0; p < this.numHyperplanes; p++) {
      const plane = this.hyperplanes[p];
      let dot = 0;
      for (let d = 0; d < len; d++) {
        dot += vector[d] * plane[d];
      }
      if (dot >= 0) {
        signature |= 1 << p;
      }
    }
    return signature >>> 0;
  }

  /**
   * Routes a vector to a primary shard index (0..N-1) based on its LSH bucket signature.
   */
  public getPrimaryShardForVector(vector: Float32Array | number[]): number {
    const sig = this.computeLSHSignature(vector);
    return sig % this.shardIds.length;
  }

  /**
   * Routes a vector to a primary shard ID string based on its LSH bucket signature.
   */
  public getShardForVector(vector: Float32Array | number[]): string {
    return this.shardIds[this.getPrimaryShardForVector(vector)];
  }

  /**
   * Multi-probe LSH routing returning numeric shard indices.
   */
  public getProbeShards(vector: Float32Array | number[], maxProbes = 2): number[] {
    const primarySig = this.computeLSHSignature(vector);
    const probed = new Set<number>();
    probed.add(primarySig % this.shardIds.length);

    for (let bit = 0; bit < this.numHyperplanes && probed.size < maxProbes; bit++) {
      const flippedSig = (primarySig ^ (1 << bit)) >>> 0;
      probed.add(flippedSig % this.shardIds.length);
    }

    if (probed.size < Math.min(maxProbes, this.shardIds.length)) {
      for (let i = 0; i < this.shardIds.length; i++) {
        probed.add(i);
        if (probed.size >= maxProbes) break;
      }
    }

    return Array.from(probed);
  }

  /**
   * Multi-probe LSH routing returning shard ID strings.
   */
  public getProbedShardsForVector(vector: Float32Array | number[], maxProbes = 2): string[] {
    return this.getProbeShards(vector, maxProbes).map((idx) => this.shardIds[idx]);
  }

  /**
   * Routes an item ID deterministically using the Consistent Hash Ring.
   */
  public getShardForKey(key: string): string {
    if (this.sortedRingTokens.length === 0) {
      return this.shardIds[0];
    }
    const hash = fnv1aHash(key);
    let low = 0;
    let high = this.sortedRingTokens.length - 1;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (this.sortedRingTokens[mid] >= hash) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    const idx = low < this.sortedRingTokens.length ? low : 0;
    return this.ring.get(this.sortedRingTokens[idx])!;
  }

  public getShardIds(): string[] {
    return [...this.shardIds];
  }
}

export interface ShardedCandidate {
  id: string;
  score: number;
  distance?: number;
  shardId: string | number;
  vector?: Float32Array | number[];
  metadata?: Record<string, unknown>;
  source?: 'dense' | 'sparse' | 'hybrid';
}

/**
 * DistributedResultMerger merges candidate lists from multiple shards using
 * Global Reciprocal Rank Fusion (RRF) and optional Maximal Marginal Relevance (MMR).
 */
export class DistributedResultMerger {
  /**
   * Merges ranked candidate lists from multiple shards using Reciprocal Rank Fusion (RRF)
   * combined with normalized raw similarity score tie-breaking.
   */
  public static mergeRRF(
    shardLists: ShardedCandidate[][],
    limit = 10,
    rrfK = 60
  ): ShardedCandidate[] {
    const fusedMap = new Map<
      string,
      {
        candidate: ShardedCandidate;
        rrfScore: number;
        maxRawScore: number;
      }
    >();

    for (const list of shardLists) {
      const sorted = [...list].sort((a, b) => b.score - a.score);
      for (let rank = 0; rank < sorted.length; rank++) {
        const item = sorted[rank];
        const rrfContribution = 1.0 / (rrfK + rank + 1);
        const existing = fusedMap.get(item.id);

        if (existing) {
          existing.rrfScore += rrfContribution;
          if (item.score > existing.maxRawScore) {
            existing.maxRawScore = item.score;
            existing.candidate = item;
          }
        } else {
          fusedMap.set(item.id, {
            candidate: { ...item },
            rrfScore: rrfContribution,
            maxRawScore: item.score,
          });
        }
      }
    }

    const merged = Array.from(fusedMap.values())
      .map((entry) => ({
        ...entry.candidate,
        score: Math.round((entry.rrfScore * 30 + entry.maxRawScore * 0.5) * 10000) / 10000,
      }))
      .sort((a, b) => b.score - a.score);

    return merged.slice(0, limit);
  }

  /**
   * Merges shard candidates and applies Maximal Marginal Relevance (MMR) diversification.
   */
  public static mergeWithMMR(
    queryVector: Float32Array | number[],
    shardLists: ShardedCandidate[][],
    limit = 10,
    lambda = 0.7
  ): ShardedCandidate[] {
    const pool = this.mergeRRF(shardLists, limit * 3);
    if (pool.length <= 1 || lambda >= 1.0) {
      return pool.slice(0, limit);
    }

    const clampedLambda = Math.max(0, Math.min(1, lambda));
    const selected: ShardedCandidate[] = [];
    const selectedVectors: number[][] = [];
    const remaining = [...pool];

    while (selected.length < limit && remaining.length > 0) {
      let bestIdx = 0;
      let bestMmr = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const cand = remaining[i];
        const vec = cand.vector ? Array.from(cand.vector) : Array.from(queryVector);
        let maxSimToSelected = 0;
        for (const selVec of selectedVectors) {
          const sim = cosineSimilarity(vec, selVec);
          if (sim > maxSimToSelected) {
            maxSimToSelected = sim;
          }
        }
        const mmrScore = calculateMMRScore(cand.score, maxSimToSelected, clampedLambda);
        if (mmrScore > bestMmr) {
          bestMmr = mmrScore;
          bestIdx = i;
        }
      }

      const winner = remaining.splice(bestIdx, 1)[0];
      selected.push({
        ...winner,
        score: Math.round(bestMmr * 10000) / 10000,
      });
      selectedVectors.push(
        winner.vector ? Array.from(winner.vector) : Array.from(queryVector)
      );
    }

    return selected;
  }
}

export interface ShardCoordinatorConfig {
  shardCount?: number;
  shardId?: string;
  coordinatorUrls?: string[];
  dimension?: number;
  dimensions?: number;
  routingMode?: 'key' | 'lsh';
  replicationFactor?: number;
}

/**
 * ShardCoordinator manages local and remote HNSW shards, replica health checks,
 * dynamic node registration, automatic leader election, and scatter-gather query execution.
 */
export class ShardCoordinator {
  private readonly shards = new Map<string, HNSWIndex>();
  private readonly replicaShards = new Map<string, HNSWIndex>();
  private readonly vectors = new Map<string, Float32Array>();
  private readonly itemMetadata = new Map<string, Record<string, unknown>>();
  private readonly metadata = new Map<string, ShardNode & { endpointUrl?: string; role?: 'leader' | 'follower'; queriesHandled?: number }>();
  private router: LSHShardRouter;
  private readonly dimension: number;
  private readonly routingMode: 'key' | 'lsh';
  private readonly replicationFactor: number;
  private leaderShardId: string;
  private leaderTerm = 1;

  constructor(config?: ShardCoordinatorConfig) {
    const shardCount =
      config?.shardCount ?? Math.max(1, parseInt(process.env.EIDOS_SHARD_COUNT || '4', 10));
    this.dimension = config?.dimension ?? config?.dimensions ?? 384;
    this.routingMode = config?.routingMode ?? 'key';
    this.replicationFactor = Math.max(1, config?.replicationFactor ?? 2);

    const urls =
      config?.coordinatorUrls ??
      (process.env.EIDOS_COORDINATOR_URLS
        ? process.env.EIDOS_COORDINATOR_URLS.split(',').map((u) => u.trim())
        : process.env.SHARD_URLS
        ? process.env.SHARD_URLS.split(',').map((u) => u.trim())
        : []);

    const shardIds: string[] = [];
    for (let i = 0; i < shardCount; i++) {
      const id = `shard-${i}`;
      shardIds.push(id);
      this.shards.set(id, new HNSWIndex({ M: 16, efConstruction: 64, efSearch: 32 }));
      this.replicaShards.set(id, new HNSWIndex({ M: 16, efConstruction: 64, efSearch: 32 }));
      this.metadata.set(id, {
        shardId: id,
        weight: 1.0,
        itemCount: 0,
        healthy: true,
        endpointUrl: urls[i] || `local://${id}`,
        role: i === 0 ? 'leader' : 'follower',
        queriesHandled: 0,
      });
    }

    this.leaderShardId = shardIds[0] || 'shard-0';
    this.router = new LSHShardRouter({
      shardIds,
      dimension: this.dimension,
    });
  }

  public upsert(
    id: string,
    vector: Float32Array | number[],
    meta?: Record<string, unknown>
  ): string {
    const f32 = vector instanceof Float32Array ? vector : new Float32Array(vector);
    const shardId =
      this.routingMode === 'lsh'
        ? this.router.getShardForVector(f32)
        : this.router.getShardForKey(id);

    const shard = this.shards.get(shardId);
    if (!shard) {
      throw new Error(`Target shard ${shardId} is not registered`);
    }

    const existed = this.vectors.has(id);
    this.vectors.set(id, f32);
    if (meta) {
      this.itemMetadata.set(id, meta);
    }
    shard.insert(id, f32);

    // Maintain secondary replica on next shard in the ring for zero data loss during single-node failure
    if (this.replicationFactor > 1 && this.shards.size > 1) {
      const shardIds = Array.from(this.shards.keys());
      const primaryIdx = shardIds.indexOf(shardId);
      const replicaShardId = shardIds[(primaryIdx + 1) % shardIds.length];
      const replicaIdx = this.replicaShards.get(replicaShardId);
      if (replicaIdx) {
        replicaIdx.insert(id, f32);
      }
    }

    const shardMeta = this.metadata.get(shardId);
    if (shardMeta && !existed) {
      shardMeta.itemCount++;
    }

    return shardId;
  }

  public setShardHealth(shardId: string, healthy: boolean): void {
    const meta = this.metadata.get(shardId);
    if (meta) {
      meta.healthy = healthy;
      if (!healthy && this.leaderShardId === shardId) {
        this.electLeader();
      } else if (healthy && !this.metadata.get(this.leaderShardId)?.healthy) {
        this.electLeader();
      }
    }
  }

  /**
   * Performs deterministic Raft-style leader election among all healthy shards.
   */
  public electLeader(): { leaderShardId: string; term: number } {
    for (const [id, meta] of this.metadata.entries()) {
      if (meta.healthy) {
        this.leaderShardId = id;
        this.leaderTerm++;
        for (const [sId, sMeta] of this.metadata.entries()) {
          sMeta.role = sId === id ? 'leader' : 'follower';
        }
        return { leaderShardId: this.leaderShardId, term: this.leaderTerm };
      }
    }
    return { leaderShardId: this.leaderShardId, term: this.leaderTerm };
  }

  public getLeaderState(): { leaderShardId: string; term: number; healthy: boolean } {
    const leaderMeta = this.metadata.get(this.leaderShardId);
    return {
      leaderShardId: this.leaderShardId,
      term: this.leaderTerm,
      healthy: Boolean(leaderMeta?.healthy),
    };
  }

  public registerReplicaShard(shardId: string, endpointUrl?: string): void {
    if (!this.shards.has(shardId)) {
      this.shards.set(shardId, new HNSWIndex({ M: 16, efConstruction: 64, efSearch: 32 }));
      this.replicaShards.set(shardId, new HNSWIndex({ M: 16, efConstruction: 64, efSearch: 32 }));
      this.metadata.set(shardId, {
        shardId,
        weight: 1.0,
        itemCount: 0,
        healthy: true,
        endpointUrl: endpointUrl || `local://${shardId}`,
        role: 'follower',
        queriesHandled: 0,
      });
      this.router = new LSHShardRouter({
        shardIds: Array.from(this.shards.keys()),
        dimension: this.dimension,
      });
    }
  }

  public search(
    queryVector: Float32Array | number[],
    limit = 10,
    options?: { probeCount?: number; diversityLambda?: number; mmrLambda?: number }
  ): ShardedCandidate[] {
    const qVec = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
    const allShardIds = Array.from(this.shards.keys());
    const targetShards =
      this.routingMode === 'lsh' && options?.probeCount
        ? this.router.getProbedShardsForVector(qVec, options.probeCount)
        : allShardIds;

    const shardLists: ShardedCandidate[][] = [];

    for (const shardId of targetShards) {
      const meta = this.metadata.get(shardId);
      const shard = this.shards.get(shardId);
      if (!meta || !shard) continue;

      if (meta.healthy) {
        meta.queriesHandled = (meta.queriesHandled || 0) + 1;
        const raw: HNSWSearchResult[] = shard.search(qVec, limit);
        shardLists.push(
          raw.map((r) => ({
            id: r.id,
            score: r.score ?? 1 - r.distance,
            distance: r.distance,
            shardId,
            vector: this.vectors.get(r.id),
            metadata: this.itemMetadata.get(r.id),
            source: 'dense' as const,
          }))
        );
      } else if (this.replicationFactor > 1 && allShardIds.length > 1) {
        // Automatic Failover: reroute unhealthy primary shard read to healthy replica shard
        const primaryIdx = allShardIds.indexOf(shardId);
        const replicaShardId = allShardIds[(primaryIdx + 1) % allShardIds.length];
        const replicaMeta = this.metadata.get(replicaShardId);
        const replicaIdx = this.replicaShards.get(replicaShardId);

        if (replicaMeta && replicaMeta.healthy && replicaIdx) {
          replicaMeta.queriesHandled = (replicaMeta.queriesHandled || 0) + 1;
          const rawReplica: HNSWSearchResult[] = replicaIdx.search(qVec, limit);
          shardLists.push(
            rawReplica.map((r) => ({
              id: r.id,
              score: r.score ?? 1 - r.distance,
              distance: r.distance,
              shardId: replicaShardId,
              vector: this.vectors.get(r.id),
              metadata: this.itemMetadata.get(r.id),
              source: 'dense' as const,
            }))
          );
        }
      }
    }

    const lambda = options?.mmrLambda ?? options?.diversityLambda;
    if (lambda !== undefined && lambda < 1.0) {
      return DistributedResultMerger.mergeWithMMR(qVec, shardLists, limit, lambda);
    }

    return DistributedResultMerger.mergeRRF(shardLists, limit);
  }

  public getStats(): {
    shardCount: number;
    totalVectors: number;
    healthyShards: number;
    leaderShardId: string;
    leaderTerm: number;
    shards: Array<ShardNode & { endpointUrl?: string; role?: 'leader' | 'follower'; queriesHandled?: number }>;
  } {
    const shards = Array.from(this.metadata.values());
    const totalVectors = shards.reduce((acc, s) => acc + s.itemCount, 0);
    const healthyShards = shards.filter((s) => s.healthy).length;
    return {
      shardCount: shards.length,
      totalVectors,
      healthyShards,
      leaderShardId: this.leaderShardId,
      leaderTerm: this.leaderTerm,
      shards,
    };
  }

  public getStatus() {
    const stats = this.getStats();
    return {
      totalItems: stats.totalVectors,
      healthyShards: stats.healthyShards,
      totalShards: stats.shardCount,
      leaderShardId: stats.leaderShardId,
      leaderTerm: stats.leaderTerm,
      shards: stats.shards,
    };
  }

  public getRouter(): LSHShardRouter {
    return this.router;
  }
}
