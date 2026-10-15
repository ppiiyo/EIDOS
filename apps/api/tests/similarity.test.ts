import { describe, it, expect } from 'vitest';
import { cosineSimilarity, normalizeVector } from '@eidos/core';

describe('Vector Mathematics & Similarity', () => {
  it('calculates identical vector similarity as 1.0', () => {
    const vecA = [0.5, 0.5, 0.5, 0.5];
    const sim = cosineSimilarity(vecA, vecA);
    expect(sim).toBeCloseTo(1.0, 4);
  });

  it('calculates orthogonal vector similarity as 0.0', () => {
    const vecA = [1.0, 0.0, 0.0];
    const vecB = [0.0, 1.0, 0.0];
    const sim = cosineSimilarity(vecA, vecB);
    expect(sim).toBeCloseTo(0.0, 4);
  });

  it('calculates diametrically opposed vector similarity as -1.0', () => {
    const vecA = [1.0, 2.0, 3.0];
    const vecB = [-1.0, -2.0, -3.0];
    const sim = cosineSimilarity(vecA, vecB);
    expect(sim).toBeCloseTo(-1.0, 4);
  });

  it('throws descriptive error on dimension mismatch', () => {
    const vecA = [1.0, 2.0];
    const vecB = [1.0, 2.0, 3.0];
    expect(() => cosineSimilarity(vecA, vecB)).toThrowError(/Vector dimension mismatch/);
  });

  it('normalizes vector to unit length', () => {
    const raw = [3.0, 4.0];
    const normalized = normalizeVector(raw);
    const length = Math.sqrt(normalized[0] * normalized[0] + normalized[1] * normalized[1]);
    expect(length).toBeCloseTo(1.0, 4);
  });
});
