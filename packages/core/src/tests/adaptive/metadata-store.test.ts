import { describe, it, expect } from 'vitest';
import { MetadataStore } from '../../adaptive/metadata-store';

describe('MetadataStore', () => {
  it('stores and retrieves item metadata', () => {
    const store = new MetadataStore();
    store.add({
      id: 'prod-1',
      category: 'Audio',
      createdAt: Date.now(),
      popularity: 0.8,
      attributes: { brand: 'Sony', color: 'black' },
    });

    expect(store.has('prod-1')).toBe(true);
    expect(store.size()).toBe(1);
    expect(store.getCategory('prod-1')).toBe('Audio');
    expect(store.getPopularity('prod-1')).toBe(0.8);
    expect(store.getAttributes('prod-1')).toEqual({ brand: 'Sony', color: 'black' });
  });

  it('calculates freshness decay over time', () => {
    const store = new MetadataStore();
    const now = Date.now();
    store.add({
      id: 'recent',
      category: 'Books',
      createdAt: now - 1000 * 60, // 1 min ago
      popularity: 0.5,
      attributes: {},
    });
    store.add({
      id: 'ancient',
      category: 'Books',
      createdAt: now - 1000 * 60 * 60 * 24 * 60, // 60 days ago
      popularity: 0.5,
      attributes: {},
    });

    const freshScore = store.getFreshness('recent', 30);
    const staleScore = store.getFreshness('ancient', 30);

    expect(freshScore).toBeGreaterThan(0.9);
    expect(staleScore).toBeLessThan(0.3);
  });

  it('updates popularity and clamps to [0, 1]', () => {
    const store = new MetadataStore();
    store.add({
      id: 'item-1',
      category: 'Games',
      createdAt: Date.now(),
      popularity: 0.9,
      attributes: {},
    });

    store.updatePopularity('item-1', 0.2);
    expect(store.getPopularity('item-1')).toBe(1.0);

    store.updatePopularity('item-1', -1.5);
    expect(store.getPopularity('item-1')).toBe(0.0);
  });

  it('batch export and import works cleanly', () => {
    const store1 = new MetadataStore();
    store1.addBatch([
      { id: '1', category: 'A', createdAt: 1, popularity: 0.2, attributes: {} },
      { id: '2', category: 'B', createdAt: 2, popularity: 0.4, attributes: {} },
    ]);

    const exported = store1.export();
    const store2 = new MetadataStore();
    store2.import(exported);

    expect(store2.size()).toBe(2);
    expect(store2.getCategory('2')).toBe('B');
  });
});
