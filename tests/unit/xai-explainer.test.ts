import { describe, it, expect } from 'vitest';
import { XaiExplainer } from '../../packages/core/src/recommender/xai-explainer';

describe('Task 3.4: Explainable AI (XAI) Engine', () => {
  it('identifies lexical driver and matched terms when bm25Score dominates', () => {
    const xai = new XaiExplainer();
    const res = xai.explain(
      'wireless mouse',
      'Logitech Pro Wireless Gaming Mouse',
      0.6,
      0.95,
      0.4
    );

    expect(res.primaryDriver).toBe('lexical');
    expect(res.matchedTerms).toContain('wireless');
    expect(res.matchedTerms).toContain('mouse');
    expect(res.summary).toContain('Exact keyword match');
  });

  it('identifies semantic or popularity driver when respective score dominates', () => {
    const xai = new XaiExplainer();
    const sem = xai.explain('noise cancelling', 'Sony WH-1000XM5 Headphones', 0.92, 0.4, 0.5);
    expect(sem.primaryDriver).toBe('semantic');
    expect(sem.summary).toContain('Strong semantic similarity');

    const pop = xai.explain('gift idea', 'Apple AirPods Pro 2', 0.4, 0.2, 0.96);
    expect(pop.primaryDriver).toBe('popularity');
    expect(pop.summary).toContain('Trending item');
  });
});
