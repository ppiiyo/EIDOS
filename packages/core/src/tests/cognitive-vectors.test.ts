import { describe, it, expect } from 'vitest';
import {
  KineticAttentionEngine,
  SerendipityOrthogonalEngine,
  ChronoCognitiveEngine,
  AdaptiveQueryRouter,
  ParetoWeightOptimizer,
  cosineSimilarity,
} from '../index';

describe('Next-Gen Cognitive Recommendation Vectors & Optimizers', () => {
  describe('KineticAttentionEngine (Pre-click Cursor & Scroll Micro-Physics)', () => {
    it('classifies analytical_comparer when A <-> B card alternations are high', () => {
      const profile = KineticAttentionEngine.analyze({
        scrollVelocityPxPerSec: 90,
        hoverDwellByItemId: { 'item-1': 2900, 'item-2': 2600 },
        comparisonAlternations: 5,
        priceHoverCount: 1,
      });

      expect(profile.archetype).toBe('analytical_comparer');
      expect(profile.biometricVector).toHaveLength(16);
      expect(profile.comparedItemIds).toContain('item-1');
      expect(profile.alphaAdjustment).toBeGreaterThan(0);

      // Verify 16-d vector is L2 normalized
      const normSq = profile.biometricVector.reduce((s, x) => s + x * x, 0);
      expect(normSq).toBeCloseTo(1.0, 2);
    });

    it('classifies price_sensitive_hesitant and boosts value items below median price', () => {
      const profile = KineticAttentionEngine.analyze({
        scrollVelocityPxPerSec: 120,
        hoverDwellByItemId: { 'item-1': 3100 },
        comparisonAlternations: 1,
        priceHoverCount: 5,
      });

      expect(profile.archetype).toBe('price_sensitive_hesitant');
      expect(profile.priceElasticityBoost).toBeGreaterThan(1.2);

      const mod = KineticAttentionEngine.modulateCandidateScore(0.75, 650, 1000, profile);
      expect(mod.kineticBonus).toBeGreaterThan(0);
      expect(mod.adjustedScore).toBeGreaterThan(0.75);
    });

    it('classifies fast_scanner when scroll velocity is high without dwell fixation', () => {
      const profile = KineticAttentionEngine.analyze({
        scrollVelocityPxPerSec: 1200,
        hoverDwellByItemId: {},
        comparisonAlternations: 0,
        priceHoverCount: 0,
      });

      expect(profile.archetype).toBe('fast_scanner');
      expect(profile.recommendedMmrLambda).toBeGreaterThanOrEqual(0.6);
      expect(profile.serendipityBoost).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('SerendipityOrthogonalEngine (Gram-Schmidt Anti-Echo-Chamber Vector)', () => {
    it('computes strictly orthogonal residual vector via Gram-Schmidt projection', () => {
      const seenCentroid = new Float32Array([0.8, 0.6, 0.0, 0.0]);
      const candidate = new Float32Array([0.6, 0.4, 0.7, 0.2]);

      const { orthogonalVector, orthogonalMagnitude } =
        SerendipityOrthogonalEngine.computeOrthogonalProjection(candidate, seenCentroid);

      // Dot product between orthogonal residual and seenCentroid must be ~0
      const dot =
        orthogonalVector[0] * seenCentroid[0] +
        orthogonalVector[1] * seenCentroid[1] +
        orthogonalVector[2] * seenCentroid[2] +
        orthogonalVector[3] * seenCentroid[3];

      expect(Math.abs(dot)).toBeLessThan(1e-5);
      expect(orthogonalMagnitude).toBeGreaterThan(0.5);
    });

    it('identifies cross-category serendipity discoveries that break the filter bubble', () => {
      const queryVec = new Float32Array(384).fill(0.05);
      const echoCentroid = new Float32Array(384).fill(0.05);
      // Candidate shares partial query signal but diverges strongly in dimensions 100..250
      const candidateVec = new Float32Array(384);
      for (let i = 0; i < 384; i++) {
        candidateVec[i] = i < 120 ? 0.05 : i % 2 === 0 ? 0.14 : -0.14;
      }

      const evalResult = SerendipityOrthogonalEngine.evaluateCandidate({
        id: 'sku-bridge-42',
        category: 'Acoustic Studio Gear',
        dominantCategory: 'Headphones',
        candidateVec,
        queryVec,
        echoCentroidVec: echoCentroid,
      });

      expect(evalResult.orthogonalNovelty).toBeGreaterThan(0.5);
      expect(evalResult.serendipityScore).toBeGreaterThan(0.56);
      expect(evalResult.isSerendipityDiscovery).toBe(true);
    });

    it('synthesizes unit-normalized steered query vector from 2D Intent Radar coordinates', () => {
      const baseQuery = new Float32Array(384).fill(1 / Math.sqrt(384));
      const echoCentroid = new Float32Array(384).fill(0);
      echoCentroid[0] = 1;

      const steered = SerendipityOrthogonalEngine.synthesizeSteeredQueryVector(
        baseQuery,
        { axisDiscovery: 0.85, axisTier: 0.6 },
        echoCentroid
      );

      let normSq = 0;
      for (let i = 0; i < steered.length; i++) normSq += steered[i] * steered[i];
      expect(normSq).toBeCloseTo(1.0, 3);
      expect(cosineSimilarity(baseQuery, steered)).toBeLessThan(0.999);
    });
  });

  describe('ChronoCognitiveEngine (Circadian & Session Tempo Vector)', () => {
    it('activates sniper_utility mode during weekday morning high-tempo sessions', () => {
      const morning = ChronoCognitiveEngine.evaluate({
        localHour: 9,
        dayOfWeek: 2,
        sessionDurationSec: 30,
        actionsPerMinute: 11,
      });

      expect(morning.mode).toBe('sniper_utility');
      expect(morning.explorationTemperature).toBeLessThanOrEqual(0.35);
    });

    it('activates dopamine_discovery mode during late-night exploratory sessions', () => {
      const night = ChronoCognitiveEngine.evaluate({
        localHour: 23,
        dayOfWeek: 5,
        sessionDurationSec: 260,
        actionsPerMinute: 2.5,
      });

      expect(night.mode).toBe('dopamine_discovery');
      expect(night.explorationTemperature).toBeGreaterThanOrEqual(0.62);
      expect(night.recommendedSerendipityWeight).toBeGreaterThan(0.25);
    });
  });

  describe('AdaptiveQueryRouter & ParetoWeightOptimizer', () => {
    it('routes exact SKU codes to LEXICAL_FAST_PATH and conceptual queries to COGNITIVE_EXPLORATORY_PATH', () => {
      const skuRoute = AdaptiveQueryRouter.routeQuery('SKU-9084X');
      expect(skuRoute.route).toBe('LEXICAL_FAST_PATH');
      expect(skuRoute.efSearch).toBeLessThanOrEqual(32);
      expect(skuRoute.estimatedComputeSavingsPct).toBeGreaterThanOrEqual(50);

      const conceptualRoute = AdaptiveQueryRouter.routeQuery(
        'философия времени и атмосфера глубокого космоса как в интерстеллар',
        { radarDiscoveryAxis: 0.5, explorationTemperature: 0.7 }
      );
      expect(conceptualRoute.route).toBe('COGNITIVE_EXPLORATORY_PATH');
      expect(conceptualRoute.efSearch).toBeGreaterThanOrEqual(64);
      expect(conceptualRoute.enableSerendipity).toBe(true);
    });

    it('computes non-dominated Pareto frontier across Relevance, Discovery, and Commercial objectives', () => {
      const report = ParetoWeightOptimizer.optimize({
        avgDenseScore: 0.78,
        avgBm25Score: 0.6,
        categoryEntropyNormalized: 0.7,
        explorationTemperature: 0.65,
        priceSensitivity: 0.4,
      });

      expect(report.evaluatedGridSize).toBe(64);
      expect(report.frontier.length).toBeGreaterThan(0);
      expect(report.recommendedMaxRelevance.objectives.relevanceScore).toBeGreaterThanOrEqual(
        report.recommendedMaxDiscovery.objectives.relevanceScore
      );
      expect(report.recommendedMaxDiscovery.objectives.discoveryScore).toBeGreaterThanOrEqual(
        report.recommendedMaxRelevance.objectives.discoveryScore
      );
    });
  });
});
