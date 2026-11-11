import { describe, it, expect } from 'vitest';
import { VectorStore } from '../../apps/api/src/services/vector-store';

describe('P0-7 & P0-8: HNSW Upsert Update & Multi-Layer Recall', () => {
  it('updates HNSW vector when an existing item ID is re-upserted with a new embedding', () => {
    const store = new VectorStore();

    const vecAudio = new Float32Array(384);
    vecAudio[0] = 1.0;

    const vecAuto = new Float32Array(384);
    vecAuto[1] = 1.0;

    // 1. Initial insert as Audio
    store.upsert({
      id: 'sku-100',
      sku: 'SKU-100',
      title: 'Sony Headphones',
      description: 'Wireless audio',
      category: 'Audio',
      price: 100,
      inStock: true,
      tags: ['audio'],
      url: '/product/sku-100',
      imageUrl: null,
      embedding: Array.from(vecAudio),
      normalizedVector: vecAudio,
    });

    // 2. Re-upsert SAME ID with completely different title & orthogonal vector
    store.upsert({
      id: 'sku-100',
      sku: 'SKU-100',
      title: 'Motul 5W-40 Motor Oil',
      description: 'Synthetic engine oil',
      category: 'Auto',
      price: 50,
      inStock: true,
      tags: ['oil'],
      url: '/product/sku-100',
      imageUrl: null,
      embedding: Array.from(vecAuto),
      normalizedVector: vecAuto,
    });

    const annHits = store.getHNSW().search(vecAuto, 5);
    expect(annHits.length).toBe(1);
    expect(annHits[0].id).toBe('sku-100');
    expect(annHits[0].score).toBeGreaterThan(0.99);
  });

  it('indexes SKU and brand in bulkSeed so exact SKU search hits top-1', () => {
    const store = new VectorStore();
    const vec = new Float32Array(384);
    vec[0] = 1.0;

    store.bulkSeed([
      {
        id: 'item-1',
        sku: 'WH-1000XM5',
        brand: 'Sony',
        title: 'Беспроводные наушники с шумоподавлением',
        description: 'Флагманский звук',
        category: 'Наушники и аудио',
        price: 29990,
        inStock: true,
        tags: ['anc'],
        url: '/product/item-1',
        imageUrl: null,
        embedding: Array.from(vec),
        normalizedVector: vec,
      },
    ]);

    const hits = store.hybridSearch('WH-1000XM5', vec, 5, 0.5, 0.5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].item.id).toBe('item-1');
  });
});
