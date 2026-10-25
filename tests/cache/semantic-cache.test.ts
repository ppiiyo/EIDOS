import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeVector, cosineSimilarity } from '@eidos/core';
import { SemanticQueryCache, CacheKeys } from '../../apps/api/src/services/cache';

describe('EIDOS v3.1 - Semantic Query Caching & Adaptive TTL', () => {
  let semCache: SemanticQueryCache;

  beforeEach(() => {
    semCache = new SemanticQueryCache({ similarityThreshold: 0.95, maxEntries: 100 });
    CacheKeys.resetFrequencies();
  });

  it('returns SEMANTIC_HIT when query vector cosine similarity >= 0.95', () => {
    const baseVector = normalizeVector(
      Array.from({ length: 384 }, (_, i) => Math.sin(i * 0.05) + 1)
    );
    // Perturb slightly so cosine similarity is > 0.99
    const nearVector = normalizeVector(
      baseVector.map((v, i) => v + (i % 10 === 0 ? 0.01 : 0))
    );

    const similarity = cosineSimilarity(baseVector, nearVector);
    expect(similarity).toBeGreaterThanOrEqual(0.95);

    const mockPayload = {
      query: 'gaming laptop rtx',
      results: [{ id: 'item-1', title: 'ROG Strix RTX Laptop', score: 0.94 }],
      count: 1,
    };

    semCache.store('gaming laptop rtx', baseVector, 'category:Electronics', mockPayload, 300);

    const lookup = semCache.lookup(nearVector, 'category:Electronics');
    expect(lookup.hit).toBe(true);
    expect(lookup.similarity).toBeGreaterThanOrEqual(0.95);
    expect(lookup.matchedQuery).toBe('gaming laptop rtx');
    expect(lookup.response?.results).toEqual(mockPayload.results);
  });

  it('returns MISS when query vector cosine similarity < 0.95 or filterKey differs', () => {
    const vecA = normalizeVector(
      Array.from({ length: 384 }, (_, i) => (i < 192 ? 1.0 : 0.0))
    );
    const vecB = normalizeVector(
      Array.from({ length: 384 }, (_, i) => (i >= 192 ? 1.0 : 0.0))
    );

    semCache.store('wireless headphones', vecA, 'cat:Audio', { results: [] }, 300);

    // Orthogonal vector -> MISS
    const missOrthogonal = semCache.lookup(vecB, 'cat:Audio');
    expect(missOrthogonal.hit).toBe(false);

    // Identical vector but different filter context -> MISS
    const missFilter = semCache.lookup(vecA, 'cat:Books');
    expect(missFilter.hit).toBe(false);
  });

  it('calculates Adaptive TTL based on sliding-window query frequency', () => {
    const queryKey = 'popular wireless earbuds';

    // Long-tail (< 10 requests in window) -> 60s TTL
    const initialTtl = CacheKeys.getAdaptiveTTL(queryKey);
    expect(initialTtl).toBe(CacheKeys.TTL.ADAPTIVE_LONG_TAIL);
    expect(initialTtl).toBe(60);

    // Warm queries (10..50 requests in window) -> 300s TTL
    let warmTtl = 60;
    for (let i = 0; i < 12; i++) {
      warmTtl = CacheKeys.getAdaptiveTTL(queryKey);
    }
    expect(warmTtl).toBe(CacheKeys.TTL.ADAPTIVE_WARM);
    expect(warmTtl).toBe(300);

    // Hot queries (> 50 requests in window) -> 3600s TTL
    let hotTtl = 300;
    for (let i = 0; i < 45; i++) {
      hotTtl = CacheKeys.getAdaptiveTTL(queryKey);
    }
    expect(hotTtl).toBe(CacheKeys.TTL.ADAPTIVE_HOT);
    expect(hotTtl).toBe(3600);
  });
});
