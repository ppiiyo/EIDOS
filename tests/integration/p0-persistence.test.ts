import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VectorStore } from '../../apps/api/src/services/vector-store';
import { resetPersistenceStoreForTests } from '../../apps/api/src/services/persistence-store';
import { ApiKeyManager } from '../../apps/api/src/services/api-key-manager';
import { AdminConsoleStore } from '../../apps/api/src/services/admin-console-store';

describe('P0-10 & P0-11: WAL Crash Recovery & Control-Plane Persistence', () => {
  it('replays uncommitted WAL operations from disk into items, HNSW, and BM25 after simulated crash', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-wal-test-'));
    const walPath = path.join(tmpDir, 'crash.wal.jsonl');
    process.env.EIDOS_WAL_PATH = walPath;

    // Instance 1 writes an item (appended to WAL file on disk, no snapshot written)
    const store1 = new VectorStore();
    const vec = new Float32Array(384);
    vec[5] = 1.0;

    store1.upsert({
      id: 'wal-item-42',
      sku: 'WAL-42',
      brand: 'Bosch',
      title: 'Bosch Laser Level GLL 3-80',
      description: 'Professional 360 laser level',
      category: 'Tools',
      price: 19900,
      inStock: true,
      tags: ['laser'],
      url: '/product/wal-item-42',
      imageUrl: null,
      embedding: Array.from(vec),
      normalizedVector: vec,
    });

    expect(fs.existsSync(walPath)).toBe(true);

    // Instance 2 boots cold and replays WAL from disk
    const store2 = new VectorStore();
    expect(store2.count()).toBe(0);

    const replayed = store2.replayWalFromDisk(walPath);
    expect(replayed).toBe(1);
    expect(store2.count()).toBe(1);
    expect(store2.get('wal-item-42')?.title).toBe('Bosch Laser Level GLL 3-80');

    const hits = store2.hybridSearch('WAL-42', vec, 5);
    expect(hits[0]?.item.id).toBe('wal-item-42');

    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.EIDOS_WAL_PATH;
  });

  it('persists ApiKeyManager keys and AdminConsoleStore rules across instance restarts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-db-test-'));
    resetPersistenceStoreForTests(tmpDir);
    ApiKeyManager.resetInstance();
    AdminConsoleStore.resetInstance();

    const km1 = ApiKeyManager.getInstance();
    const generated = km1.generateKey({ tenantId: 'acme', role: 'search', description: 'Storefront key' });

    const admin1 = AdminConsoleStore.getInstance();
    admin1.createSynonymGroup('acme', { terms: ['смартфон', 'телефон'] });

    // Simulate process restart by resetting singletons over the same data dir
    ApiKeyManager.resetInstance();
    AdminConsoleStore.resetInstance();

    const km2 = ApiKeyManager.getInstance();
    expect(km2.isValid(generated.key)).toBe(true);
    expect(km2.getRecord(generated.key)?.tenant_id).toBe('acme');

    const admin2 = AdminConsoleStore.getInstance();
    expect(admin2.getSynonymGroups('acme').length).toBe(1);
    expect(admin2.getSynonymGroups('acme')[0].terms).toContain('смартфон');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
