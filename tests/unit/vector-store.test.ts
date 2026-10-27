import * as fs from 'fs';
import { describe, test, expect, afterEach } from 'vitest';
import { VectorStore } from '../../apps/api/src/services/vector-store';

describe('VectorStore Atomic Snapshot Persistence', () => {
  const testSnapshotPath = '/tmp/test-snapshot.json';

  afterEach(() => {
    if (fs.existsSync(testSnapshotPath)) {
      fs.unlinkSync(testSnapshotPath);
    }
    const tmpFiles = fs
      .readdirSync('/tmp')
      .filter((f) => f.startsWith('test-snapshot.json.tmp-'));
    for (const f of tmpFiles) {
      fs.unlinkSync(`/tmp/${f}`);
    }
  });

  test('saveSnapshotAsync uses atomic write', async () => {
    const store = new VectorStore();
    store.upsert({
      id: '1',
      title: 'Test',
      description: 'Atomic write test item',
      category: 'Electronics',
      embedding: [0.1, 0.2],
    });

    await store.saveSnapshotAsync(testSnapshotPath);

    const exists = fs.existsSync(testSnapshotPath);
    expect(exists).toBe(true);

    const parsed = JSON.parse(fs.readFileSync(testSnapshotPath, 'utf8'));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe('1');
    expect(parsed[0].title).toBe('Test');

    // Verify no .tmp files left behind
    const tmpFiles = fs.readdirSync('/tmp').filter((f) => f.includes('.tmp-'));
    expect(tmpFiles.length).toBe(0);
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
    const tmpFiles = fs.readdirSync('/tmp').filter((f) => f.includes('.tmp-'));
    expect(tmpFiles.length).toBe(0);
  });
});
