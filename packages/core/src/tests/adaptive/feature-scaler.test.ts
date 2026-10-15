import { describe, it, expect } from 'vitest';
import { StreamingQuantileScaler } from '../../adaptive/feature-scaler';
import { Ranker } from '../../adaptive/ranker';
import { RankingFeatures } from '../../adaptive/types';

describe('PR #1: Feature Normalization Layer & StreamingQuantileScaler', () => {
  it('handles cold-start gracefully without producing NaN or throwing', () => {
    const scaler = new StreamingQuantileScaler(1000, 0, 100);
    // 0 samples
    expect(scaler.transform(50)).toBeCloseTo(0.5, 2);
    expect(Number.isFinite(scaler.transform(50))).toBe(true);

    // 1-4 samples
    scaler.update(10);
    scaler.update(20);
    expect(scaler.transform(15)).toBeCloseTo(0.15, 2);
  });

  it('handles homogeneous data (all values equal) without division by zero', () => {
    const scaler = new StreamingQuantileScaler();
    for (let i = 0; i < 20; i++) {
      scaler.update(100);
    }
    expect(scaler.transform(100)).toBe(0.5);
    expect(scaler.transform(200)).toBe(0.5);
  });

  it('handles negative values such as negative freshness offsets', () => {
    const scaler = new StreamingQuantileScaler(1000, -100, 100);
    for (let i = -50; i <= 50; i += 10) {
      scaler.update(i);
    }
    const val = scaler.transform(0);
    expect(val).toBeGreaterThan(0.3);
    expect(val).toBeLessThan(0.7);
  });

  it('clips extreme 99th percentile outliers properly', () => {
    const scaler = new StreamingQuantileScaler(10000);
    // Feed 100 normal observations in range [10, 100]
    for (let i = 10; i <= 100; i++) {
      scaler.update(i);
    }
    // Add extreme outlier
    scaler.update(1_000_000);

    // Value well within normal range should still have reasonable rank
    const norm = scaler.transform(50);
    expect(norm).toBeGreaterThan(0.2);
    expect(norm).toBeLessThan(0.8);

    // Extreme outlier gets clipped to 1.0
    expect(scaler.transform(2_000_000)).toBe(1.0);
  });

  it('guarantees similarity >= 30% contribution when popularity has large scale (100 to 10,000)', () => {
    const ranker = new Ranker();

    // Ingest streaming popularity observations
    const popValues = [100, 250, 500, 1000, 2500, 5000, 7500, 10000];
    for (const p of popValues) {
      ranker.updateStatistics({ popularity: p });
    }

    const candidateFeatures: RankingFeatures = {
      similarity: 0.9,
      popularity: 10000, // raw 10k!
      freshness: 0.5,
      userAffinity: 0.5,
      categoryRepetition: 0.0,
      contextualRelevance: 0.5,
      kgCentrality: 0.5,
    };

    const explanation = ranker.explain(candidateFeatures);
    const totalScore = explanation.totalScore;
    const similarityImpact = explanation.similarityContribution / totalScore;

    // Acceptance criterion: similarity impacts final score by at least 30%
    expect(similarityImpact).toBeGreaterThanOrEqual(0.30);
  });
});
