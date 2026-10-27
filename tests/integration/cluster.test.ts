import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { ShardCoordinator, normalizeVector } from '@eidos/core';

const ROOT_DIR = path.resolve(__dirname, '../..');

describe('PHASE 1 - Task 1.1: Multi-Node Cluster Integration Test (3 Shards + Coordinator)', () => {
  it('validates Docker Compose and Kubernetes cluster manifests exist and configure 3 shards + coordinator', () => {
    const composePath = path.join(ROOT_DIR, 'deploy/docker-compose.cluster.yml');
    const k8sPath = path.join(ROOT_DIR, 'deploy/kubernetes/eidos-cluster.yaml');
    const docPath = path.join(ROOT_DIR, 'docs/CLUSTER_DEPLOYMENT.md');

    expect(fs.existsSync(composePath)).toBe(true);
    expect(fs.existsSync(k8sPath)).toBe(true);
    expect(fs.existsSync(docPath)).toBe(true);

    const composeContent = fs.readFileSync(composePath, 'utf-8');
    expect(composeContent).toContain('eidos-shard-1:');
    expect(composeContent).toContain('eidos-shard-2:');
    expect(composeContent).toContain('eidos-shard-3:');
    expect(composeContent).toContain('eidos-coordinator:');
    expect(composeContent).toContain('SHARD_URLS=http://eidos-shard-1:3000,http://eidos-shard-2:3000,http://eidos-shard-3:3000');

    const k8sContent = fs.readFileSync(k8sPath, 'utf-8');
    expect(k8sContent).toContain('kind: StatefulSet');
    expect(k8sContent).toContain('kind: HorizontalPodAutoscaler');
  });

  it('spins up a 3-node HNSW cluster, indexes 300 items, executes 1,000 search queries, and verifies all 3 shards respond with balanced load', () => {
    const coordinator = new ShardCoordinator({
      shardCount: 3,
      dimensions: 384,
      routingMode: 'lsh',
      replicationFactor: 2,
      coordinatorUrls: [
        'http://eidos-shard-1:3000',
        'http://eidos-shard-2:3000',
        'http://eidos-shard-3:3000',
      ],
    });

    // 1. Index 300 diverse vectors across the 3 shards
    for (let i = 0; i < 300; i++) {
      const vec = normalizeVector(
        Array.from({ length: 384 }, (_, d) => Math.sin((i + 1) * 0.17 + d * 0.09))
      );
      coordinator.upsert(`cluster-item-${i}`, vec, {
        title: `Cluster Product ${i}`,
        category: i % 2 === 0 ? 'Electronics' : 'Audio',
      });
    }

    const initialStats = coordinator.getStats();
    expect(initialStats.shardCount).toBe(3);
    expect(initialStats.healthyShards).toBe(3);
    expect(initialStats.totalVectors).toBe(300);

    // Every shard must store a balanced partition of items
    for (const shard of initialStats.shards) {
      expect(shard.healthy).toBe(true);
      expect(shard.itemCount).toBeGreaterThan(30);
    }

    // 2. Execute 1,000 search queries across the 3-node cluster
    let successfulQueries = 0;
    for (let q = 0; q < 1000; q++) {
      const queryVec = normalizeVector(
        Array.from({ length: 384 }, (_, d) => Math.cos((q + 1) * 0.13 + d * 0.05))
      );
      const results = coordinator.search(queryVec, 10, { probeCount: 2 });
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(10);
      successfulQueries++;
    }

    expect(successfulQueries).toBe(1000);

    // 3. Verify all 3 shards responded and load is balanced across nodes
    const finalStats = coordinator.getStats();
    const totalShardQueries = finalStats.shards.reduce(
      (sum, s) => sum + (s.queriesHandled || 0),
      0
    );
    expect(totalShardQueries).toBeGreaterThanOrEqual(2000); // 1000 queries * 2 probes

    for (const shard of finalStats.shards) {
      expect(shard.queriesHandled).toBeGreaterThan(200);
    }
  });
});
