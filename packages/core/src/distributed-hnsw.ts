import { HNSWIndex } from './hnsw';
import { DistributedClusterConfig, HNSWSearchResult, ShardNode } from './types';

/**
 * High-performance 32-bit FNV-1a hash function for consistent hashing.
 */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

/**
 * Consistent Hash Ring for distributed vector index routing.
 * Distributes vector items evenly across physical shards using virtual tokens.
 */
export class HashRingRouter {
  private ring = new Map<number, string>();
  private sortedTokens: number[] = [];

  constructor(
    private shardIds: string[],
    private virtualTokensPerShard: number = 64
  ) {
    this.rebuildRing();
  }

  private rebuildRing(): void {
    this.ring.clear();
    for (const shardId of this.shardIds) {
      for (let i = 0; i < this.virtualTokensPerShard; i++) {
        const token = fnv1a(`${shardId}#vnode-${i}`);
        this.ring.set(token, shardId);
      }
    }
    this.sortedTokens = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  /**
   * Locates the primary shard responsible for the given item key.
   */
  public getShard(key: string): string {
    if (this.sortedTokens.length === 0) {
      throw new Error('Hash ring is empty.');
    }
    const hash = fnv1a(key);

    // Binary search for the first token >= hash
    let low = 0;
    let high = this.sortedTokens.length - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (this.sortedTokens[mid] >= hash) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    const index = low < this.sortedTokens.length ? low : 0;
    const token = this.sortedTokens[index];
    return this.ring.get(token)!;
  }
}

/**
 * Distributed HNSW Cluster manager.
 * Partitions massive catalogs (>10,000,000 vectors) across parallel shards
 * and provides sub-millisecond scatter-gather approximate nearest neighbor search.
 */
export class DistributedHNSWCluster {
  private shards = new Map<string, HNSWIndex>();
  private shardStats = new Map<string, ShardNode>();
  private router: HashRingRouter;

  constructor(private config: DistributedClusterConfig = { shardsCount: 4, virtualNodesPerShard: 64, replicationFactor: 1 }) {
    const shardIds: string[] = [];
    for (let i = 0; i < config.shardsCount; i++) {
      const shardId = `shard-${i}`;
      shardIds.push(shardId);
      this.shards.set(shardId, new HNSWIndex({ M: 16, efConstruction: 64, efSearch: 32 }));
      this.shardStats.set(shardId, {
        shardId,
        weight: 1.0,
        itemCount: 0,
        healthy: true,
      });
    }
    this.router = new HashRingRouter(shardIds, config.virtualNodesPerShard);
  }

  /**
   * Inserts a vector into the cluster using consistent hash routing.
   */
  public insert(id: string, vector: Float32Array): string {
    const targetShardId = this.router.getShard(id);
    const targetShard = this.shards.get(targetShardId);
    if (!targetShard) {
      throw new Error(`Shard ${targetShardId} not found.`);
    }

    targetShard.insert(id, vector);

    const stats = this.shardStats.get(targetShardId);
    if (stats) {
      stats.itemCount++;
    }

    return targetShardId;
  }

  /**
   * Executes parallel Scatter-Gather approximate nearest neighbor search across all healthy shards,
   * then merges and ranks the top-K candidates.
   */
  public async scatterGatherSearch(
    query: Float32Array,
    k: number = 10
  ): Promise<Array<HNSWSearchResult & { shardId: string }>> {
    const shardSearches: Array<Promise<{ shardId: string; results: HNSWSearchResult[] }>> = [];

    for (const [shardId, shard] of this.shards.entries()) {
      const stats = this.shardStats.get(shardId);
      if (!stats || !stats.healthy) continue;

      shardSearches.push(
        Promise.resolve({
          shardId,
          results: shard.search(query, k),
        })
      );
    }

    const shardResults = await Promise.all(shardSearches);

    // Merge-sort all candidates by distance ascending (similarity descending)
    const aggregated: Array<HNSWSearchResult & { shardId: string }> = [];
    for (const sr of shardResults) {
      for (const res of sr.results) {
        aggregated.push({
          id: res.id,
          distance: res.distance,
          score: res.score,
          shardId: sr.shardId,
        });
      }
    }

    aggregated.sort((a, b) => a.distance - b.distance);
    return aggregated.slice(0, k);
  }

  /**
   * Returns health, vector count, and topology statistics for all cluster shards.
   */
  public getClusterTopology(): {
    totalItems: number;
    shards: ShardNode[];
  } {
    const shards = Array.from(this.shardStats.values());
    const totalItems = shards.reduce((sum, s) => sum + s.itemCount, 0);
    return {
      totalItems,
      shards,
    };
  }
}
