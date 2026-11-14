import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { WriteAheadLog } from '@eidos/core';
import { VectorStore } from '../../apps/api/src/services/vector-store';
import { computeDeterministicEmbedding } from '../../apps/api/src/services/embedder';

describe('P0-4: Streaming Snapshot (NDJSON / JSON-Lines), .hnsw.bin SHA-256 Verification & Bounded WAL', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-p0-4-'));
  });

  afterEach(() => {
    delete process.env.EIDOS_SNAPSHOT_FORMAT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('streams 2,500+ items to NDJSON and multi-line JSON snapshots without full-array JSON.stringify and restores line-by-line', async () => {
    const ndjsonPath = path.join(tmpDir, 'catalog.snapshot.ndjson');
    const store = new VectorStore({ snapshotPath: ndjsonPath });

    const baseVec = Array.from(computeDeterministicEmbedding('беспроводные наушники sony', 384));
    const bulkItems = [];
    for (let i = 1; i <= 2500; i++) {
      bulkItems.push({
        id: `sku-${i}`,
        sku: `SKU-${i}`,
        brand: i % 2 === 0 ? 'Sony' : 'Sennheiser',
        title: `Беспроводные наушники серия ${i}`,
        description: `Высококачественные наушники с активным шумоподавлением #${i}`,
        category: 'Наушники и аудио',
        price: 5000 + i,
        inStock: true,
        tags: ['наушники', 'аудио'],
        embedding: baseVec,
      });
    }
    store.bulkSeed(bulkItems);

    await store.saveSnapshotAsync(ndjsonPath);

    expect(fs.existsSync(ndjsonPath)).toBe(true);
    expect(fs.existsSync(`${ndjsonPath}.meta.json`)).toBe(true);
    expect(fs.existsSync(`${ndjsonPath}.hnsw.bin`)).toBe(true);

    const meta = JSON.parse(fs.readFileSync(`${ndjsonPath}.meta.json`, 'utf8'));
    expect(meta.format).toBe('ndjson');
    expect(meta.itemCount).toBe(2500);
    expect(typeof meta.hnswSha256).toBe('string');
    expect(meta.hnswSha256.length).toBe(64);
    expect(meta.hnswByteLength).toBeGreaterThan(1000);

    // Verify NDJSON format: 2500 lines, each a standalone JSON object
    const lines = fs.readFileSync(ndjsonPath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2500);
    expect(JSON.parse(lines[0]).id).toBe('sku-1');
    expect(JSON.parse(lines[2499]).id).toBe('sku-2500');

    // Restore into a fresh VectorStore using streaming line-by-line reader + verified .hnsw.bin
    let embedBatchCalled = 0;
    const restoredStore = new VectorStore({ snapshotPath: ndjsonPath });
    const count = await restoredStore.loadSnapshotFromDisk(
      {
        embed: async () => baseVec,
        embedBatch: async (texts) => {
          embedBatchCalled++;
          return texts.map(() => baseVec);
        },
      },
      ndjsonPath
    );

    expect(count).toBe(2500);
    expect(embedBatchCalled).toBe(0);
    expect(restoredStore.size()).toBe(2500);
    expect(restoredStore.getHNSW().size()).toBe(2500);
    expect(restoredStore.get('sku-2500')?.title).toBe('Беспроводные наушники серия 2500');
  });

  it('detects corrupted .hnsw.bin via SHA-256 mismatch and gracefully rebuilds HNSW index from snapshot items', async () => {
    const snapPath = path.join(tmpDir, 'catalog.snapshot.json');
    const store = new VectorStore({ snapshotPath: snapPath });
    const vec = Array.from(computeDeterministicEmbedding('перфоратор makita', 384));

    store.upsert({
      id: 'item-1',
      sku: 'MAK-1',
      title: 'Перфоратор Makita HR2470',
      description: 'Трехрежимный перфоратор SDS-Plus',
      category: 'Инструменты и ремонт',
      price: 14500,
      inStock: true,
      embedding: vec,
    });
    store.upsert({
      id: 'item-2',
      sku: 'MAK-2',
      title: 'Шуруповерт Makita DDF482',
      description: 'Аккумуляторная дрель-шуруповерт 18В',
      category: 'Инструменты и ремонт',
      price: 11200,
      inStock: true,
      embedding: vec,
    });

    store.saveSnapshotSync(snapPath);

    // Corrupt .hnsw.bin by flipping bytes in the middle of the binary file
    const binPath = `${snapPath}.hnsw.bin`;
    const binBuf = fs.readFileSync(binPath);
    binBuf[Math.floor(binBuf.length / 2)] ^= 0xff;
    fs.writeFileSync(binPath, binBuf);

    let embedBatchCalls = 0;
    const restoredStore = new VectorStore({ snapshotPath: snapPath });
    const loadedCount = await restoredStore.loadSnapshotFromDisk(
      {
        embed: async () => vec,
        embedBatch: async (texts) => {
          embedBatchCalls++;
          return texts.map(() => vec);
        },
      },
      snapPath
    );

    // Corrupted .hnsw.bin was rejected by SHA-256 verification and rebuilt via embedBatch
    expect(loadedCount).toBe(2);
    expect(embedBatchCalls).toBe(1);
    expect(restoredStore.size()).toBe(2);
    expect(restoredStore.getHNSW().size()).toBe(2);
  });

  it('preserves on-disk WAL and caps in-memory operations at maxInMemoryOperations when checkpoint fails', async () => {
    const walPath = path.join(tmpDir, 'catalog.wal.jsonl');
    let shouldFailCheckpoint = true;

    const wal = new WriteAheadLog(
      5, // maxOperationsBeforeCheckpoint
      async () => {
        if (shouldFailCheckpoint) {
          throw new Error('ENOSPC: no space left on device');
        }
      },
      walPath,
      8 // maxInMemoryOperations cap
    );

    for (let i = 1; i <= 12; i++) {
      wal.append({
        type: 'INSERT_NODE',
        nodeId: `node-${i}`,
        vector: new Float32Array([0.1 * i, 0.2 * i]),
      });
    }

    await expect(wal.triggerCheckpoint()).rejects.toThrow('ENOSPC');
    expect(wal.getFailedCheckpointsCount()).toBeGreaterThanOrEqual(1);

    // In-memory operations must be capped at maxInMemoryOperations (8) to prevent OOM
    expect(wal.size()).toBeLessThanOrEqual(8);
    expect(wal.getDroppedInMemoryCount()).toBeGreaterThanOrEqual(4);

    // On-disk WAL must NOT be truncated when checkpoint fails — all 12 entries remain on disk
    const diskLines = fs.readFileSync(walPath, 'utf8').trim().split('\n');
    expect(diskLines.length).toBe(12);

    // Once disk space recovers, checkpoint succeeds and truncates on-disk WAL
    shouldFailCheckpoint = false;
    await wal.triggerCheckpoint();
    expect(wal.size()).toBe(0);
    expect(fs.readFileSync(walPath, 'utf8')).toBe('');
  });
});
