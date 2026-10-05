import { describe, it, expect } from 'vitest';
import { ExplainabilityEngine } from '../../adaptive/explainability';
import { VectorSteering } from '../../adaptive/vector-steering';
import { RankingConfig, RankingFeatures } from '../../adaptive/types';
import { cosineSimilarity } from '../../cosine';

describe('ExplainabilityEngine', () => {
  const mockConfig: RankingConfig = {
    alpha: 0.35, // similarity
    beta: 0.15,  // popularity
    gamma: 0.15, // freshness
    delta: 0.25, // userAffinity
    epsilon: 0.1, // categoryRepetition
    zeta: 0.05,  // contextualRelevance
    eta: 0.15,   // kgCentrality
  };

  it('calculates feature attributions and identifies top driver', () => {
    const features: RankingFeatures = {
      similarity: 0.9,
      userAffinity: 0.2,
      popularity: 0.4,
      freshness: 0.1,
      contextualRelevance: 0.1,
      kgCentrality: 0.2,
      categoryRepetition: 0.0,
    };

    const explanation = ExplainabilityEngine.explain('item_1', features, mockConfig, [], [], 'ru');

    expect(explanation.itemId).toBe('item_1');
    expect(explanation.primaryDriver).toBe('similarity');
    expect(explanation.summary).toContain('концептуальное соответствие');

    // Attributions must total 100% (+/- 2% due to integer rounding)
    const sumPct = explanation.attributions.reduce((s, a) => s + a.percentage, 0);
    expect(sumPct).toBeGreaterThanOrEqual(98);
    expect(sumPct).toBeLessThanOrEqual(102);
  });

  it('detects and cites Knowledge Graph paths to user history', () => {
    const features: RankingFeatures = {
      similarity: 0.5,
      userAffinity: 0.5,
      popularity: 0.5,
      freshness: 0.5,
      contextualRelevance: 0.5,
      kgCentrality: 0.8,
      categoryRepetition: 0.0,
    };

    const graphEdges = [
      { source: 'history_item_42', target: 'item_target', weight: 0.86 },
    ];

    const explanation = ExplainabilityEngine.explain(
      'item_target',
      features,
      mockConfig,
      ['history_item_42'],
      graphEdges,
      'ru'
    );

    expect(explanation.primaryDriver).toBe('kg_path');
    expect(explanation.kgPath).toBeDefined();
    expect(explanation.kgPath?.sourceItemId).toBe('history_item_42');
    expect(explanation.kgPath?.similarity).toBe(0.86);
    expect(explanation.summary).toContain('history_item_42');
    expect(explanation.summary).toContain('86%');
  });

  it('supports English locale summaries', () => {
    const features: RankingFeatures = {
      similarity: 0.2,
      userAffinity: 0.95,
      popularity: 0.1,
      freshness: 0.1,
      contextualRelevance: 0.1,
      kgCentrality: 0.1,
      categoryRepetition: 0.0,
    };

    const explanation = ExplainabilityEngine.explain('item_en', features, mockConfig, [], [], 'en');
    expect(explanation.primaryDriver).toBe('user_affinity');
    expect(explanation.summary).toContain('taste profile');
  });
});

describe('VectorSteering', () => {
  it('steers base vector positively towards desired modifier and away from negative', () => {
    const dim = 4;
    // Base is aligned on dim 0
    const base = new Float32Array([1.0, 0.0, 0.0, 0.0]);
    // Positive modifier pulls along dim 1
    const positiveMod = new Float32Array([0.0, 1.0, 0.0, 0.0]);
    // Negative modifier pushes away from dim 0
    const negativeMod = new Float32Array([0.5, 0.0, 0.0, 0.0]);

    const steered = VectorSteering.steer(base, [
      { vector: positiveMod, weight: 0.8, type: 'positive', label: 'modern' },
      { vector: negativeMod, weight: 0.4, type: 'negative', label: 'vintage' },
    ]);

    // Steered vector should have significant positive projection along dim 1
    expect(steered[1]).toBeGreaterThan(0.5);
    // Dim 0 should be reduced due to negative modifier
    expect(steered[0]).toBeLessThan(base[0]);
    // L2 normalized
    const norm = Math.hypot(...Array.from(steered));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('respects maxAngularDeviation ceiling constraint', () => {
    const base = new Float32Array([1.0, 0.0]);
    // Completely orthogonal modifier with huge weight
    const extremeMod = new Float32Array([0.0, 1.0]);

    const steered = VectorSteering.steer(
      base,
      [{ vector: extremeMod, weight: 10.0, type: 'positive' }],
      { maxAngularDeviation: 0.3 }
    );

    // Cosine similarity with base must not fall below (1 - maxAngularDeviation) = 0.7
    const sim = cosineSimilarity(Array.from(base), Array.from(steered));
    expect(sim).toBeGreaterThanOrEqual(0.68);
  });

  it('computes directional delta vector between two concepts', () => {
    const vA = new Float32Array([1.0, 0.0, 0.0]);
    const vB = new Float32Array([0.0, 1.0, 0.0]);

    const delta = VectorSteering.computeDelta(vA, vB);
    expect(delta[0]).toBeLessThan(0); // moving away from vA
    expect(delta[1]).toBeGreaterThan(0); // moving towards vB
    const norm = Math.hypot(...Array.from(delta));
    expect(norm).toBeCloseTo(1.0, 4);
  });
});
