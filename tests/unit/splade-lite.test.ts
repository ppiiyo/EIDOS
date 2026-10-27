import { describe, it, expect } from 'vitest';
import { SpladeLite } from '../../packages/core/src/search/splade-lite';

describe('Task 3.1: SPLADE-lite Learned Sparse Retrieval', () => {
  it('expands query terms with learned synonyms and scores non-overlapping lexical matches', () => {
    const splade = new SpladeLite();
    const q = splade.encode('cheap laptop');
    const doc = splade.encode('budget notebook with 16gb ram');

    expect(q.has('notebook')).toBe(true);
    expect(q.has('budget')).toBe(true);
    expect(splade.score(q, doc)).toBeGreaterThan(0.5);
  });

  it('supports Russian synonym expansion (ноутбук -> лэптоп, наушники -> гарнитура)', () => {
    const splade = new SpladeLite();
    const q = splade.encode('наушники ноутбук');
    const doc = splade.encode('беспроводная гарнитура и лэптоп');

    expect(q.has('гарнитура')).toBe(true);
    expect(q.has('лэптоп')).toBe(true);
    expect(splade.score(q, doc)).toBeGreaterThan(0.5);
  });
});
