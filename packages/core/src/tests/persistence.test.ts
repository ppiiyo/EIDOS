import { describe, it, expect } from 'vitest';
import { HNSWIndex } from '../hnsw';
import { HNSWIndexSerializer, WriteAheadLog } from '../persistence';

describe('PR #3: HNSW Index Persistence & WAL', () => {
  it('should serialize and deserialize an in-memory HNSW index with high fidelity', () => {
    const index = new HNSWIndex({ M: 8, efConstruction: 32, efSearch: 16 });

    const vecA = new Float32Array([1.0, 0.0, 0.0, 0.0]);
    const vecB = new Float32Array([0.0, 1.0, 0.0, 0.0]);
    const vecC = new Float32Array([0.9, 0.1, 0.0, 0.0]);

    index.insert('item-a', vecA);
    index.insert('item-b', vecB);
    index.insert('item-c', vecC);

    expect(index.size()).toBe(3);

    const binary = HNSWIndexSerializer.serialize(index);
    expect(binary.length).toBeGreaterThan(0);

    const restoredIndex = HNSWIndexSerializer.deserialize(binary);
    expect(restoredIndex.size()).toBe(3);
    expect(restoredIndex.getEntryPointId()).toBe(index.getEntryPointId());
    expect(restoredIndex.getMaxLevel()).toBe(index.getMaxLevel());

    // Search on restored index should return item-a and item-c as closest to query
    const query = new Float32Array([1.0, 0.0, 0.0, 0.0]);
    const results = restoredIndex.search(query, 2);
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('item-a');
    expect(results[1].id).toBe('item-c');
  });

  it('should serialize and deserialize quantized indices properly', () => {
    const index = new HNSWIndex({ M: 8, efConstruction: 32, useQuantization: true });

    for (let i = 0; i < 5; i++) {
      const v = new Float32Array([Math.sin(i), Math.cos(i), 0.5, -0.5]);
      index.insert(`node-${i}`, v);
    }

    const binary = HNSWIndexSerializer.serialize(index);
    const restored = HNSWIndexSerializer.deserialize(binary);

    expect(restored.size()).toBe(5);
    expect(restored.getConfig().useQuantization).toBe(true);
  });

  it('should correctly delete nodes and rewire neighbors', () => {
    const index = new HNSWIndex({ M: 4, efConstruction: 16 });
    index.insert('n1', new Float32Array([1, 0]));
    index.insert('n2', new Float32Array([0, 1]));
    index.insert('n3', new Float32Array([0.5, 0.5]));

    expect(index.size()).toBe(3);
    const deleted = index.delete('n2');
    expect(deleted).toBe(true);
    expect(index.size()).toBe(2);

    const nonExistent = index.delete('does-not-exist');
    expect(nonExistent).toBe(false);
  });

  it('should log operations in WriteAheadLog and replay into HNSWIndex', () => {
    const wal = new WriteAheadLog(100);
    const index = new HNSWIndex({ M: 8, efConstruction: 32 });

    const vec1 = new Float32Array([1.0, 0.2, -0.1]);
    const vec2 = new Float32Array([0.1, 0.9, 0.3]);

    wal.append({
      type: 'INSERT_NODE',
      nodeId: 'wal-item-1',
      vector: vec1,
    });

    wal.append({
      type: 'INSERT_NODE',
      nodeId: 'wal-item-2',
      vector: vec2,
    });

    wal.append({
      type: 'DELETE_NODE',
      nodeId: 'wal-item-1',
    });

    expect(wal.size()).toBe(3);

    const replayed = wal.replay(index);
    expect(replayed).toBe(3);
    expect(index.size()).toBe(1);

    const searchRes = index.search(vec2, 1);
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].id).toBe('wal-item-2');
  });

  it('should handle checkpoint callback and truncate operations', async () => {
    let checkpointCalled = false;
    const wal = new WriteAheadLog(2, async () => {
      checkpointCalled = true;
    });

    wal.append({
      type: 'INSERT_NODE',
      nodeId: 'p1',
      vector: new Float32Array([1, 0]),
    });

    expect(checkpointCalled).toBe(false);

    wal.append({
      type: 'INSERT_NODE',
      nodeId: 'p2',
      vector: new Float32Array([0, 1]),
    });

    // Checkpoint triggered automatically
    expect(checkpointCalled).toBe(true);
    expect(wal.size()).toBe(0);
  });
});
