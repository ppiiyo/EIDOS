import { describe, it, expect } from 'vitest';
import { CrossEncoderRanker } from '../../adaptive/cross-encoder';
import { CrossEncoderCandidate, CrossEncoderQuery } from '../../adaptive/types';

describe('CrossEncoderRanker (Stage-2 Re-ranking)', () => {
  it('boosts candidate with shared category and lexical token overlap over pure superficial vector', () => {
    const ranker = new CrossEncoderRanker({ crossWeight: 0.7, attributeWeight: 0.4 });

    const query: CrossEncoderQuery = {
      title: 'Wireless Mechanical Keyboard RGB',
      category: 'Electronics',
      tags: ['mechanical', 'wireless', 'peripheral'],
      embedding: new Float32Array([1.0, 0.5, 0.2]),
    };

    const candidates: CrossEncoderCandidate[] = [
      {
        id: 'superficial_match',
        title: 'Office Water Bottle Insulated',
        category: 'Home',
        tags: ['kitchen', 'drinkware'],
        embedding: new Float32Array([0.98, 0.52, 0.18]), // High vector similarity but completely wrong domain
        baseScore: 0.85,
      },
      {
        id: 'genuine_relevance',
        title: 'Custom Mechanical Keyboard Wrist Rest',
        category: 'Electronics',
        tags: ['mechanical', 'accessory', 'peripheral'],
        embedding: new Float32Array([0.88, 0.45, 0.25]), // Slightly lower raw cosine
        baseScore: 0.78,
      },
    ];

    const results = ranker.rank(query, candidates);

    expect(results.length).toBe(2);
    // genuine_relevance must rank #1 due to category alignment and token overlap
    expect(results[0].id).toBe('genuine_relevance');
    expect(results[0].blendedScore).toBeGreaterThan(results[1].blendedScore);
    expect(results[0].tokenOverlap).toBeGreaterThan(0);
    expect(results[1].tokenOverlap).toBe(0);
  });

  it('ranks identical query-item pair with maximum cross interaction score', () => {
    const ranker = new CrossEncoderRanker();
    const vec = new Float32Array([0.5, 0.5, 0.5]);

    const query: CrossEncoderQuery = {
      title: 'Ergonomic Standing Desk',
      category: 'Furniture',
      tags: ['desk', 'office'],
      embedding: vec,
    };

    const candidates: CrossEncoderCandidate[] = [
      {
        id: 'exact_clone',
        title: 'Ergonomic Standing Desk',
        category: 'Furniture',
        tags: ['desk', 'office'],
        embedding: vec,
        baseScore: 0.95,
      },
      {
        id: 'distant_item',
        title: 'Running Shoes Sneakers',
        category: 'Footwear',
        tags: ['sport'],
        embedding: new Float32Array([-0.5, -0.5, -0.5]),
        baseScore: 0.1,
      },
    ];

    const results = ranker.rank(query, candidates);
    expect(results[0].id).toBe('exact_clone');
    expect(results[0].crossScore).toBeGreaterThan(0.7);
    expect(results[1].crossScore).toBeLessThan(0.4);
  });

  it('respects crossWeight hyperparameter balance between Stage 1 and Stage 2', () => {
    // When crossWeight is 0, blendedScore should equal baseScore
    const rankerZero = new CrossEncoderRanker({ crossWeight: 0.0 });
    const query: CrossEncoderQuery = {
      embedding: new Float32Array([1, 0]),
    };
    const candidate: CrossEncoderCandidate = {
      id: 'c1',
      embedding: new Float32Array([0, 1]),
      baseScore: 0.888,
    };

    const res = rankerZero.rank(query, [candidate]);
    expect(res[0].blendedScore).toBeCloseTo(0.888, 3);
  });
});
