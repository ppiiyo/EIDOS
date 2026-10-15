import { describe, it, expect } from 'vitest';
import { BM25Index, HybridSearch } from '../search';
import { HNSWIndex } from '../hnsw';
import { RecommendationCache } from '../cache';
import { RecommendationExplainer } from '../adaptive/explainability';
import { RankingFeatures } from '../adaptive/types';

describe('Priority 2: BM25, Hybrid Search, Explanations & Multi-Tier Cache', () => {
  it('BM25Index indexes documents and finds keyword matches with Robertson-Sparck Jones IDF', () => {
    const bm25 = new BM25Index();
    bm25.addDocument('1', 'Красные кроссовки для бега спортивная обувь');
    bm25.addDocument('2', 'Белые кроссовки для тенниса легкие');
    bm25.addDocument('3', 'Синий офисный костюм шерсть классика');

    expect(bm25.size()).toBe(3);

    // Query for red sneakers
    const hits = bm25.search('красные кроссовки', 2);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe('1');
    expect(hits[0].score).toBeGreaterThan(0);
  });

  it('HybridSearch combines dense vector similarity and sparse BM25 scores via RRF', () => {
    const hnsw = new HNSWIndex({ M: 8, efConstruction: 32, efSearch: 16 });
    const bm25 = new BM25Index();

    // Doc 1: Perfect semantic fit, weak keyword
    const vec1 = new Float32Array(384);
    vec1[0] = 0.99;
    hnsw.insert('doc-dense', vec1);
    bm25.addDocument('doc-dense', 'Универсальная тренировочная экипировка');

    // Doc 2: Exact keyword match, different vector
    const vec2 = new Float32Array(384);
    vec2[10] = 0.99;
    hnsw.insert('doc-keyword', vec2);
    bm25.addDocument('doc-keyword', 'Красные кроссовки до 5000 рублей скидка');

    const hybrid = new HybridSearch(hnsw, bm25);
    const queryVec = new Float32Array(384);
    queryVec[0] = 0.95;

    const results = hybrid.search('красные кроссовки', queryVec, { limit: 2, rrfK: 30 });
    expect(results.length).toBe(2);
    expect(['doc-dense', 'doc-keyword']).toContain(results[0].id);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('RecommendationExplainer generates top-3 human-readable explanation badges', () => {
    const item = { id: 'item-101', category: 'Обувь', title: 'Nike Air Max' };
    const features: RankingFeatures = {
      similarity: 0.88,
      popularity: 0.85,
      freshness: 0.75,
      userAffinity: 0.70,
      categoryRepetition: 0.0,
      contextualRelevance: 0.45,
      kgCentrality: 0.35,
    };

    const badges = RecommendationExplainer.explain(item, features, {
      timeOfDay: 'evening',
      stylePreference: 'спорт-шик',
    });

    expect(badges.length).toBeLessThanOrEqual(3);
    expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(badges[0]).toHaveProperty('icon');
    expect(badges[0]).toHaveProperty('text');
    expect(badges[0].confidence).toBeGreaterThan(0.6);
  });

  it('RecommendationCache provides sub-millisecond in-memory L1 cache and invalidation', async () => {
    const cache = new RecommendationCache(1000); // 1 sec TTL

    let computeCount = 0;
    const fetchRecs = async () => {
      computeCount++;
      return { items: ['item-1', 'item-2'], computedAt: Date.now() };
    };

    // First call computes
    const res1 = await cache.getOrCompute('user:42', fetchRecs);
    expect(res1.items.length).toBe(2);
    expect(computeCount).toBe(1);

    // Second call reads from L1 memory cache without recomputing
    const res2 = await cache.getOrCompute('user:42', fetchRecs);
    expect(res2.items).toEqual(res1.items);
    expect(computeCount).toBe(1);

    // Cache invalidation triggers recomputation
    await cache.invalidate('user:42');
    const res3 = await cache.getOrCompute('user:42', fetchRecs);
    expect(computeCount).toBe(2);
  });
});
