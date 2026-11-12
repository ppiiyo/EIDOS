/**
 * P0 AC: StoreRegistry path must preserve post-checkpoint writes across re-instantiation.
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StoreRegistry } from '../src/services/store-registry';

describe('P0 StoreRegistry restart AC', () => {
  let dataDir: string;
  const prevData = process.env.EIDOS_DATA_DIR;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-reg-'));
    process.env.EIDOS_DATA_DIR = dataDir;
    StoreRegistry.resetInstance();
  });

  afterEach(() => {
    if (prevData === undefined) delete process.env.EIDOS_DATA_DIR;
    else process.env.EIDOS_DATA_DIR = prevData;
    StoreRegistry.resetInstance();
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('acme 200 checkpoint +50 survives registry reset → 250', async () => {
    const reg = StoreRegistry.getInstance();
    const s1 = reg.getOrCreateStore('acme', 'default');
    await s1.whenReady();

    const emb = (i: number) =>
      new Float32Array(384).map((_, d) => ((i + 1) * (d + 1) * 0.001) % 1);

    for (let i = 0; i < 200; i++) {
      s1.upsert({
        id: `sku-${i}`,
        title: `Item ${i}`,
        description: 'seed',
        category: 'Test',
        price: 100 + i,
        embedding: emb(i),
      } as any);
    }
    expect(s1.count()).toBe(200);
    if (typeof (s1 as any).saveSnapshotSync === 'function') {
      (s1 as any).saveSnapshotSync();
    }

    for (let i = 200; i < 250; i++) {
      s1.upsert({
        id: `sku-${i}`,
        title: `Item ${i}`,
        description: 'post-checkpoint',
        category: 'Test',
        price: 9000 + i,
        embedding: emb(i),
      } as any);
    }
    expect(s1.count()).toBe(250);

    StoreRegistry.resetInstance();
    const reg2 = StoreRegistry.getInstance();
    const s2 = reg2.getOrCreateStore('acme', 'default');
    await s2.whenReady();

    expect(s2.count()).toBe(250);
    const last = s2.get('sku-249') as any;
    expect(last, 'sku-249 must exist').toBeTruthy();
    expect(Number(last.price)).toBe(9249);
  }, 120_000);
});
