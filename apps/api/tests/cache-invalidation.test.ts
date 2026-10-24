import { describe, it, expect, vi } from 'vitest';
import { RedisCache } from '../src/services/cache/redis-cache';

function createMockRedisWithKeys(initialKeys: string[]) {
  const slots = [...initialKeys];
  const store = new Set<string>(initialKeys);
  const scanCalls: Array<{ cursor: string; pattern: string; count: number }> = [];
  const unlinkCalls: string[][] = [];

  const mockRedis = {
    scan: vi.fn(async (cursor: string, _matchLit: string, pattern: string, _countLit: string, batchSize: number) => {
      scanCalls.push({ cursor, pattern, count: batchSize });
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
      const startIdx = parseInt(cursor, 10);
      const windowSlots = slots.slice(startIdx, startIdx + batchSize);
      const batch = windowSlots.filter((k) => store.has(k) && regex.test(k));
      const nextIdx = startIdx + batchSize;
      const nextCursor = nextIdx < slots.length ? String(nextIdx) : '0';
      return [nextCursor, batch] as [string, string[]];
    }),
    unlink: vi.fn(async (...keys: string[]) => {
      unlinkCalls.push(keys);
      let removed = 0;
      for (const k of keys) {
        if (store.delete(k)) removed++;
      }
      return removed;
    }),
    keys: vi.fn(() => {
      throw new Error('KEYS is forbidden in production! Use SCAN instead.');
    }),
    get: vi.fn(async () => null),
    setex: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
    ping: vi.fn(async () => 'PONG'),
    dbsize: vi.fn(async () => store.size),
    info: vi.fn(async () => 'used_memory_human:1.25M'),
    quit: vi.fn(async () => 'OK'),
    disconnect: vi.fn(),
  };

  return { mockRedis, store, scanCalls, unlinkCalls };
}

describe('Patch 1: SCAN + UNLINK Non-Blocking Cache Invalidation', () => {
  it('Should invalidate keys with SCAN + UNLINK without calling blocking KEYS', async () => {
    const initialKeys = ['search:a1', 'search:a2', 'search:a3', 'recommend:r1'];
    const { mockRedis, store, scanCalls, unlinkCalls } = createMockRedisWithKeys(initialKeys);

    const cache = new RedisCache(mockRedis as any);
    const deleted = await cache.invalidate('search:*', 2);

    expect(deleted).toBe(3);
    expect(mockRedis.keys).not.toHaveBeenCalled();
    expect(scanCalls.length).toBeGreaterThanOrEqual(1);
    expect(unlinkCalls.flat()).toEqual(['search:a1', 'search:a2', 'search:a3']);
    expect(store.has('recommend:r1')).toBe(true);
    await cache.disconnect();
  });

  it('Should handle large keysets (>1000 keys) incrementally across multiple SCAN batches', async () => {
    const largeKeyset = Array.from({ length: 1250 }, (_, i) => `search:key-${i}`);
    const { mockRedis, scanCalls } = createMockRedisWithKeys(largeKeyset);

    const cache = new RedisCache(mockRedis as any);
    const deleted = await cache.invalidate('search:*', 100);

    expect(deleted).toBe(1250);
    expect(scanCalls.length).toBeGreaterThanOrEqual(12);
    expect(mockRedis.keys).not.toHaveBeenCalled();
    await cache.disconnect();
  });

  it('Should return correct deletion count on in-memory fallback as well', async () => {
    const cache = new RedisCache();
    for (let i = 0; i < 15; i++) {
      await cache.set(`search:mem-${i}`, { idx: i }, 60);
    }
    await cache.set('recommend:keep-1', { ok: true }, 60);

    const deletedCount = await cache.invalidate('search:mem-*');
    expect(deletedCount).toBe(15);
    expect(await cache.get('recommend:keep-1')).toEqual({ ok: true });
    await cache.del('recommend:keep-1');
  });
});
