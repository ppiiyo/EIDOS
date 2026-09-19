import { describe, it, expect } from 'vitest';
import { Ranker } from '../../adaptive/ranker';
import { RankingFeatures } from '../../adaptive/types';

describe('Ranker', () => {
  const sampleFeatures: RankingFeatures = {
    similarity: 0.8,
    popularity: 0.6,
    freshness: 0.5,
    userAffinity: 0.7,
    categoryRepetition: 0.2,
    contextualRelevance: 0.9,
    kgCentrality: 0.4,
  };

  it('calculates score according to multi-feature linear formula', () => {
    const ranker = new Ranker();
    // Default weights:
    // alpha=0.45, beta=0.15, gamma=0.10, delta=0.20, epsilon=0.05, zeta=0.03, eta=0.02
    // score = 0.45*0.8 + 0.15*0.6 + 0.10*0.5 + 0.20*0.7 + 0.03*0.9 + 0.02*0.4 - 0.05*0.2
    // = 0.36 + 0.09 + 0.05 + 0.14 + 0.027 + 0.008 - 0.01 = 0.665
    const score = ranker.score(sampleFeatures);
    expect(score).toBeCloseTo(0.665, 3);
  });

  it('explain returns detailed breakdown of components', () => {
    const ranker = new Ranker();
    const explanation = ranker.explain(sampleFeatures);

    expect(explanation.similarityContribution).toBeCloseTo(0.36, 2);
    expect(explanation.popularityContribution).toBeCloseTo(0.09, 2);
    expect(explanation.categoryPenaltyContribution).toBeCloseTo(-0.01, 2);
    expect(explanation.totalScore).toBeCloseTo(0.665, 3);
  });

  it('allows configurable weight overrides per ranker and per score execution', () => {
    const customRanker = new Ranker({ alpha: 1.0, beta: 0, gamma: 0, delta: 0, epsilon: 0, zeta: 0, eta: 0 });
    expect(customRanker.score(sampleFeatures)).toBeCloseTo(0.8, 4);

    const overrideScore = customRanker.score(sampleFeatures, { alpha: 0.5 });
    expect(overrideScore).toBeCloseTo(0.4, 4);
  });

  it('throws error when negative weights are supplied', () => {
    expect(() => new Ranker({ alpha: -0.1 })).toThrow(/Weight 'alpha' must be non-negative/);
  });

  it('rank sorts candidates descending by composite score', () => {
    const ranker = new Ranker();
    const candidates = [
      { id: 'low', features: { ...sampleFeatures, similarity: 0.1, popularity: 0.1 } },
      { id: 'high', features: { ...sampleFeatures, similarity: 0.95, popularity: 0.9 } },
    ];

    const ranked = ranker.rank(candidates);
    expect(ranked[0].id).toBe('high');
    expect(ranked[1].id).toBe('low');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});
