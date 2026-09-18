import { describe, it, expect } from 'vitest';
import { shannonEntropy } from '../entropy';

describe('shannonEntropy', () => {
  it('returns 0 for single value', () => {
    expect(shannonEntropy([1])).toBe(0);
  });

  it('returns 1 for uniform binary distribution', () => {
    expect(shannonEntropy([0.5, 0.5])).toBeCloseTo(1, 5);
  });

  it('returns log2(n) for uniform n-distribution', () => {
    const p = new Array(8).fill(1 / 8);
    expect(shannonEntropy(p)).toBeCloseTo(3, 5);
  });

  it('throws on negative probabilities', () => {
    expect(() => shannonEntropy([-0.1, 1.1])).toThrow();
  });

  it('throws when probabilities do not sum to 1', () => {
    expect(() => shannonEntropy([0.3, 0.3])).toThrow();
  });
});
