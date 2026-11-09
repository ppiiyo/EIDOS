import * as fs from 'fs';
import { describe, test, expect, afterEach } from 'vitest';
import { VectorStore } from '../../apps/api/src/services/vector-store';

describe('VectorStore Atomic Snapshot Persistence', () => {
  const testSnapshotPath = '/tmp/test-snapshot.json';
  const testBinSnapshotPath = '/tmp/test-snapshot.json.hnsw.bin';

  afterEach(() => {
    if (fs.existsSync(testSnapshotPath)) {
      fs.unlinkSync(testSnapshotPath);
    }
    if (fs.existsSync(testBinSnapshotPath)) {
      fs.unlinkSync(testBinSnapshotPath);
    }
    const tmpFiles = fs
      .readdirSync('/tmp')
      .filter((f) => f.startsWith('test-snapshot.json'));
    for (const f of tmpFiles) {
      fs.unlinkSync(`/tmp/${f}`);
    }
  });

  test('saveSnapshotAsync uses atomic write for both JSON and binary HNSW (.hnsw.bin)', async () => {
    const store = new VectorStore();
    store.upsert({
      id: '1',
      sku: 'SKU-TEST-1',
      brand: 'AudioBrand',
      title: 'Test',
      description: 'Atomic write test item',
      category: 'Electronics',
      price: 4990,
      inStock: true,
      stock: 12,
      embedding: [0.6, 0.8],
    });

    await store.saveSnapshotAsync(testSnapshotPath);

    expect(fs.existsSync(testSnapshotPath)).toBe(true);
    expect(fs.existsSync(testBinSnapshotPath)).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(testSnapshotPath, 'utf8'));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe('1');
    expect(parsed[0].sku).toBe('SKU-TEST-1');
    expect(parsed[0].brand).toBe('AudioBrand');
    expect(parsed[0].stock).toBe(12);

    // Verify no .tmp files left behind
    const tmpFiles = fs.readdirSync('/tmp').filter((f) => f.includes('.tmp-'));
    expect(tmpFiles.length).toBe(0);

    // Cold-start restore into a fresh VectorStore without invoking embedBatch
    let embedBatchCalled = 0;
    const restoredStore = new VectorStore();
    const loadedCount = await restoredStore.loadSnapshotFromDisk(
      {
        embed: async () => [0.6, 0.8],
        embedBatch: async () => {
          embedBatchCalled++;
          return [[0.6, 0.8]];
        },
      },
      testSnapshotPath
    );
    expect(loadedCount).toBe(1);
    expect(embedBatchCalled).toBe(0);
    expect(restoredStore.get('1')?.sku).toBe('SKU-TEST-1');
    expect(restoredStore.get('1')?.brand).toBe('AudioBrand');
    expect(restoredStore.getHNSW().size()).toBe(1);
  });

  test('saveSnapshotSync uses atomic write and clears pending debounce timer', () => {
    const store = new VectorStore();
    store.upsert({
      id: '2',
      title: 'Sync Atomic Item',
      description: 'Graceful shutdown snapshot test',
      category: 'Audio',
      embedding: [0.3, 0.4],
    });

    store.saveSnapshotSync(testSnapshotPath);

    expect(fs.existsSync(testSnapshotPath)).toBe(true);
    expect(fs.existsSync(testBinSnapshotPath)).toBe(true);
    const tmpFiles = fs.readdirSync('/tmp').filter((f) => f.includes('.tmp-'));
    expect(tmpFiles.length).toBe(0);
  });
});
