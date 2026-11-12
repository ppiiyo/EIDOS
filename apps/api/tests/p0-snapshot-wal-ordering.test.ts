/**
 * P0: snapshot → WAL ordering must not drop post-checkpoint writes after restart simulation.
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { VectorStore } from '../src/services/vector-store';

function tmpDir(name: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), name));
  return dir;
}

describe('P0 snapshot→WAL ordering', () => {
  let dir: string;
  beforeEach(() => {
    dir = tmpDir('eidos-p0-');
  });
  afterEach(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('keeps items added after checkpoint when replaying snapshot then WAL', async () => {
    const snapshotPath = path.join(dir, 'catalog.snapshot.json');
    const walPath = path.join(dir, 'catalog.wal.jsonl');

    const store1 = new VectorStore({
      tenantId: 'acme',
      indexName: 'default',
      snapshotPath,
      walPath,
    });

    for (let i = 0; i < 5; i++) {
      store1.upsert({
        id: `sku-${i}`,
        title: `Item ${i}`,
        description: 'test',
        category: 'Test',
        price: 100 + i,
        embedding: new Float32Array(384).map((_, d) => ((i + 1) * (d + 1)) % 1),
      } as any);
    }
    if (typeof store1.saveSnapshotSync === 'function') {
      store1.saveSnapshotSync();
    }

    for (let i = 5; i < 8; i++) {
      store1.upsert({
        id: `sku-${i}`,
        title: `Item ${i}`,
        description: 'post-checkpoint',
        category: 'Test',
        price: 200 + i,
        embedding: new Float32Array(384).map((_, d) => ((i + 1) * (d + 1)) % 1),
      } as any);
    }
    expect(store1.count()).toBeGreaterThanOrEqual(8);

    const store2 = new VectorStore({
      tenantId: 'acme',
      indexName: 'default',
      snapshotPath,
      walPath,
    });
    const ready = (async () => {
      await store2.loadSnapshotFromDisk(snapshotPath);
      store2.replayWalFromDisk(walPath);
    })();
    store2.setReadyPromise(ready);
    await store2.whenReady();

    expect(store2.count()).toBeGreaterThanOrEqual(8);
    for (let i = 5; i < 8; i++) {
      const item = store2.get(`sku-${i}`);
      expect(item, `sku-${i} must exist after restore`).toBeTruthy();
    }
  });
});
