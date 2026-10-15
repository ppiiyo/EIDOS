import { describe, it, expect } from 'vitest';
import { SMMR } from '../../adaptive/smmr';

describe('SMMR', () => {
  const c1 = { id: 'c1', score: 0.9, embedding: new Float32Array([1.0, 0.0]) };
  const c2 = { id: 'c2', score: 0.85, embedding: new Float32Array([0.99, 0.01]) }; // Almost identical to c1
  const c3 = { id: 'c3', score: 0.7, embedding: new Float32Array([0.0, 1.0]) };   // Orthogonal/diverse from c1

  it('deterministic mode (or temperature=0) returns repeatable argmax MMR', () => {
    const smmr = new SMMR({ lambda: 0.5, deterministic: true });
    const res1 = smmr.rerank([c1, c2, c3], 2);
    const res2 = smmr.rerank([c1, c2, c3], 2);

    expect(res1).toEqual(res2);
    expect(res1.length).toBe(2);
    expect(res1[0].id).toBe('c1');
    // c3 is much more diverse than c2 despite slightly lower score
    expect(res1[1].id).toBe('c3');
  });

  it('lambda=1 disables diversity and behaves strictly as greedy score ranking', () => {
    const smmr = new SMMR({ lambda: 1.0, deterministic: true });
    const res = smmr.rerank([c1, c2, c3], 3);

    expect(res.map((r) => r.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('lambda=0 picks first item by highest score then maximizes diversity', () => {
    const smmr = new SMMR({ lambda: 0.0, deterministic: true });
    const res = smmr.rerank([c1, c2, c3], 2);

    expect(res[0].id).toBe('c1');
    expect(res[1].id).toBe('c3');
  });

  it('result length matches min(limit, candidates.length)', () => {
    const smmr = new SMMR();
    expect(smmr.rerank([c1, c2], 5).length).toBe(2);
    expect(smmr.rerank([c1, c2, c3], 1).length).toBe(1);
    expect(smmr.rerank([], 3).length).toBe(0);
  });
});
