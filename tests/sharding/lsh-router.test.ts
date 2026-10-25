import { describe, it, expect } from 'vitest';
import {
  LSHShardRouter,
  DistributedResultMerger,
  ShardCoordinator,
  normalizeVector,
} from '@eidos/core';

describe('EIDOS v3.1 - Distributed HNSW Sharding & LSH Query Router', () => {
  it('deterministically assigns the same vector to the same primary shard via LSH hyperplanes', () => {
    const router = new LSHShardRouter({
      dimensions: 384,
      shardCount: 4,
      numHyperplanes: 8,
      seed: 1337,
    });

    const vecA = normalizeVector(Array.from({ length: 384 }, (_, i) => Math.sin(i * 0.1)));
    const shard1 = router.getPrimaryShardForVector(vecA);
    const shard2 = router.getPrimaryShardForVector(vecA);

    expect(shard1).toBe(shard2);
    expect(shard1).toBeGreaterThanOrEqual(0);
    expect(shard1).toBeLessThan(4);
  });

  it('routes document IDs consistently across the virtual node ring', () => {
    const router = new LSHShardRouter({ shardCount: 4 });
    const shardA1 = router.getShardForKey('item-enterprise-001');
    const shardA2 = router.getShardForKey('item-enterprise-001');
    expect(shardA1).toBe(shardA2);

    // Ensure distribution across shards for 100 items
    const counts = new Map<string, number>();
    for (let i = 0; i < 100; i++) {
      const s = router.getShardForKey(`product-${i}`);
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    expect(counts.size).toBe(4);
  });

  it('selects multi-probe shards ordered by hyperplane boundary margin', () => {
    const router = new LSHShardRouter({ shardCount: 4, numHyperplanes: 6 });
    const queryVec = normalizeVector(Array.from({ length: 384 }, (_, i) => Math.cos(i * 0.2)));

    const probes = router.getProbeShards(queryVec, 2);
    expect(probes.length).toBe(2);
    expect(probes[0]).toBe(router.getPrimaryShardForVector(queryVec));
    expect(new Set(probes).size).toBe(2);
  });

  it('merges results across 4 shards using RRF and MMR diversification', () => {
    const coordinator = new ShardCoordinator({ shardCount: 4, dimensions: 384 });
    const baseVec = normalizeVector(Array.from({ length: 384 }, (_, i) => (i % 5 === 0 ? 1 : 0.1)));

    // Index 40 items distributed across the 4 shards
    for (let i = 0; i < 40; i++) {
      const vec = normalizeVector(
        baseVec.map((v, idx) => v + (idx === i % 384 ? 0.5 : 0))
      );
      coordinator.upsert(`shard-item-${i}`, vec, { title: `Item ${i}`, shardIdx: i % 4 });
    }

    const stats = coordinator.getStats();
    expect(stats.shardCount).toBe(4);
    expect(stats.totalVectors).toBe(40);

    // Scatter-gather search across all 4 shards with RRF
    const rrfHits = coordinator.search(baseVec, 10, { probeCount: 4, mmrLambda: 1.0 });
    expect(rrfHits.length).toBe(10);
    expect(rrfHits[0].score).toBeGreaterThanOrEqual(rrfHits[1].score);

    // Scatter-gather search with MMR diversification
    const mmrHits = coordinator.search(baseVec, 5, { probeCount: 4, mmrLambda: 0.6 });
    expect(mmrHits.length).toBe(5);

    // Direct DistributedResultMerger check across 4 explicit shard lists
    const shardLists = [
      [{ id: 'doc-1', score: 0.95, shardId: 0 }, { id: 'doc-2', score: 0.85, shardId: 0 }],
      [{ id: 'doc-3', score: 0.92, shardId: 1 }, { id: 'doc-1', score: 0.90, shardId: 1 }],
      [{ id: 'doc-4', score: 0.88, shardId: 2 }],
      [{ id: 'doc-5', score: 0.81, shardId: 3 }],
    ];
    const merged = DistributedResultMerger.mergeRRF(shardLists, 3, 60);
    expect(merged.length).toBe(3);
    // doc-1 appears in two shards at top positions, so RRF boosts it to #1
    expect(merged[0].id).toBe('doc-1');
  });
});
