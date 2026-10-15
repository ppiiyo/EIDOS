import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../cosine';

describe('cosineSimilarity', () => {
  it('returns 1 for identical normalized vectors', () => {
    const v = new Float32Array([0.6, 0.8]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([-1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('handles zero vectors gracefully', () => {
    const a = new Float32Array([0, 0]);
    const b = new Float32Array([1, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('throws on length mismatch', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(() => cosineSimilarity(a, b)).toThrow();
  });
});
