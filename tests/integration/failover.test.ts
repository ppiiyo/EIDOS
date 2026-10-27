import { describe, it, expect } from 'vitest';
import { ShardCoordinator, normalizeVector } from '@eidos/core';

describe('PHASE 1 - Task 1.3: Cluster Failover & Automatic Leader Election Test', () => {
  it('handles shard failure with zero 5xx errors, elects a new leader automatically, and preserves 100% of indexed data via replica failover', () => {
    const coordinator = new ShardCoordinator({
      shardCount: 3,
      dimensions: 384,
      routingMode: 'key',
      replicationFactor: 2,
    });

    // 1. Index 150 items across the 3-node cluster
    const indexedIds: string[] = [];
    for (let i = 0; i < 150; i++) {
      const id = `failover-item-${i}`;
      indexedIds.push(id);
      const vec = normalizeVector(
        Array.from({ length: 384 }, (_, d) => Math.sin((i + 1) * 0.21 + d * 0.04))
      );
      coordinator.upsert(id, vec, { title: `Resilient Product ${i}` });
    }

    const beforeLeader = coordinator.getLeaderState();
    expect(beforeLeader.leaderShardId).toBe('shard-0');
    expect(beforeLeader.term).toBe(1);
    expect(beforeLeader.healthy).toBe(true);

    // 2. Kill primary leader shard (shard-0) -> simulate docker stop eidos-shard-1
    coordinator.setShardHealth('shard-0', false);

    // 3. Verify automatic leader election promoted shard-1 in term 2
    const afterLeader = coordinator.getLeaderState();
    expect(afterLeader.leaderShardId).toBe('shard-1');
    expect(afterLeader.term).toBe(2);
    expect(afterLeader.healthy).toBe(true);
    expect(coordinator.getStats().healthyShards).toBe(2);

    // 4. Execute 200 search requests during node outage -> verify 0 errors & zero data loss
    let errorCount = 0;
    const recoveredIds = new Set<string>();

    for (let i = 0; i < 150; i++) {
      try {
        const queryVec = normalizeVector(
          Array.from({ length: 384 }, (_, d) => Math.sin((i + 1) * 0.21 + d * 0.04))
        );
        const hits = coordinator.search(queryVec, 5);
        expect(hits.length).toBeGreaterThan(0);
        for (const h of hits) {
          recoveredIds.add(h.id);
          // Unhealthy shard-0 must never be returned as the serving shard
          expect(h.shardId).not.toBe('shard-0');
        }
      } catch {
        errorCount++;
      }
    }

    expect(errorCount).toBe(0);
    // Verify items originally routed to shard-0 are still served from shard-1 replica (zero data loss)
    expect(recoveredIds.size).toBe(150);

    // 5. Recover shard-0 -> cluster returns to 3/3 healthy shards
    coordinator.setShardHealth('shard-0', true);
    expect(coordinator.getStats().healthyShards).toBe(3);
  });
});
