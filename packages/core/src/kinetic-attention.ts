/**
 * Kinetic Micro-Hesitation & Attention Physics Engine
 * Converts pre-click cursor/scroll physics into a 16-d biometric attention vector
 * and classifies the buyer's real-time cognitive archetype.
 */

export type BuyerKineticArchetype =
  | 'analytical_comparer'
  | 'price_sensitive_hesitant'
  | 'fast_scanner'
  | 'decisive_sniper';

export interface KineticTelemetryInput {
  /** Average and peak scroll speed in px/sec */
  scrollVelocityPxPerSec: number;
  /** Dwell duration (ms) per item card hovered in current view */
  hoverDwellByItemId: Record<string, number>;
  /** Number of back-and-forth cursor alternations between 2-3 candidate cards (A <-> B <-> A) */
  comparisonAlternations: number;
  /** Number of cursor hover fixations on price tags */
  priceHoverCount: number;
  /** Query refinement count per minute */
  queryRefinementVelocity?: number;
}

export interface KineticAttentionProfile {
  archetype: BuyerKineticArchetype;
  archetypeLabelRu: string;
  archetypeLabelEn: string;
  confidence: number;
  /** 16-dimensional L2-normalized biometric physics vector */
  biometricVector: number[];
  /** Recommended dynamic shift to hybrid alpha (-0.25 .. +0.25) */
  alphaAdjustment: number;
  /** Recommended dynamic MMR diversity lambda (0.10 .. 0.75) */
  recommendedMmrLambda: number;
  /** Weight multiplier for price-value elasticity (1.0 .. 1.6) */
  priceElasticityBoost: number;
  /** Weight multiplier for orthogonal serendipity discoveries (0.0 .. 1.0) */
  serendipityBoost: number;
  /** IDs of items currently involved in active cursor comparison */
  comparedItemIds: string[];
  /** Summary of detected micro-behavior */
  diagnosticSummary: string;
}

export class KineticAttentionEngine {
  /**
   * Encodes raw cursor and scroll physics into a 16-d normalized vector
   * and derives the active buyer archetype with ranking adjustments.
   */
  public static analyze(input?: Partial<KineticTelemetryInput>): KineticAttentionProfile {
    const scrollVel = Math.max(0, input?.scrollVelocityPxPerSec ?? 120);
    const dwellMap = input?.hoverDwellByItemId ?? {};
    const alternations = Math.max(0, input?.comparisonAlternations ?? 0);
    const priceHovers = Math.max(0, input?.priceHoverCount ?? 0);
    const queryVel = Math.max(0, input?.queryRefinementVelocity ?? 0.5);

    const dwellEntries = Object.entries(dwellMap)
      .filter(([, ms]) => typeof ms === 'number' && ms > 0)
      .sort((a, b) => b[1] - a[1]);

    const totalDwellMs = dwellEntries.reduce((acc, [, ms]) => acc + ms, 0);
    const maxDwellMs = dwellEntries.length > 0 ? dwellEntries[0][1] : 0;
    const secondDwellMs = dwellEntries.length > 1 ? dwellEntries[1][1] : 0;
    const activeHoverCount = dwellEntries.filter(([, ms]) => ms >= 350).length;

    // Ratio between top-2 hovered cards (high when user compares 2 items closely)
    const pairBalanceRatio =
      maxDwellMs > 200 ? Math.min(1, secondDwellMs / Math.max(1, maxDwellMs)) : 0;

    // Construct 16-dimensional biometric physics vector
    const rawVec = new Float32Array(16);
    rawVec[0] = Math.min(1, scrollVel / 1800); // Normalized scroll velocity
    rawVec[1] = Math.min(1, totalDwellMs / 12000); // Cumulative attention dwell
    rawVec[2] = Math.min(1, maxDwellMs / 5000); // Peak card fixation
    rawVec[3] = pairBalanceRatio; // A/B comparison symmetry
    rawVec[4] = Math.min(1, alternations / 8); // Back-and-forth oscillation intensity
    rawVec[5] = Math.min(1, priceHovers / 6); // Price sensitivity fixation
    rawVec[6] = Math.min(1, activeHoverCount / 6); // Breadth of card inspection
    rawVec[7] = Math.min(1, queryVel / 4); // Query reformulation tempo
    // Non-linear cross-interaction features (dims 8..15)
    rawVec[8] = rawVec[3] * rawVec[4]; // Analytical comparison interaction
    rawVec[9] = rawVec[5] * rawVec[2]; // Hesitation over price on top card
    rawVec[10] = rawVec[0] * (1 - rawVec[1]); // Rapid scanning without stopping
    rawVec[11] = (1 - rawVec[0]) * rawVec[2] * (1 - rawVec[4]); // Decisive sniper focus
    rawVec[12] = Math.sin(rawVec[1] * Math.PI * 0.5);
    rawVec[13] = Math.cos(rawVec[0] * Math.PI * 0.5);
    rawVec[14] = Math.min(1, (rawVec[4] + rawVec[5]) * 0.5);
    rawVec[15] = Math.max(0, 1 - (rawVec[0] + rawVec[4] + rawVec[5]) / 3);

    // L2 normalize the 16-d vector
    let normSq = 0;
    for (let i = 0; i < 16; i++) {
      normSq += rawVec[i] * rawVec[i];
    }
    const norm = Math.sqrt(normSq) || 1;
    const biometricVector = Array.from(rawVec, (v) => Math.round((v / norm) * 10000) / 10000);

    // Score each archetype
    const comparerScore = rawVec[4] * 0.5 + rawVec[3] * 0.35 + rawVec[6] * 0.15;
    const priceHesitantScore = rawVec[5] * 0.55 + rawVec[9] * 0.3 + (rawVec[1] > 0.25 ? 0.15 : 0);
    const scannerScore = rawVec[0] * 0.6 + rawVec[10] * 0.4;
    const sniperScore = rawVec[11] * 0.55 + (1 - rawVec[4]) * 0.25 + (1 - rawVec[5]) * 0.2;

    let archetype: BuyerKineticArchetype = 'decisive_sniper';
    let maxScore = sniperScore;

    if (comparerScore >= maxScore && (alternations >= 2 || pairBalanceRatio >= 0.45)) {
      archetype = 'analytical_comparer';
      maxScore = comparerScore;
    }
    if (priceHesitantScore >= maxScore && priceHovers >= 2) {
      archetype = 'price_sensitive_hesitant';
      maxScore = priceHesitantScore;
    }
    if (scannerScore >= maxScore && scrollVel >= 650) {
      archetype = 'fast_scanner';
      maxScore = scannerScore;
    }

    const confidence = Math.round(Math.min(0.98, Math.max(0.55, 0.52 + maxScore * 0.48)) * 100) / 100;
    const comparedItemIds = dwellEntries.slice(0, 3).map(([id]) => id);

    switch (archetype) {
      case 'analytical_comparer':
        return {
          archetype,
          archetypeLabelRu: 'Сравнительный аналитик (A ↔ B)',
          archetypeLabelEn: 'Analytical Comparer (A ↔ B)',
          confidence,
          biometricVector,
          alphaAdjustment: 0.12,
          recommendedMmrLambda: 0.25,
          priceElasticityBoost: 1.15,
          serendipityBoost: 0.25,
          comparedItemIds,
          diagnosticSummary: `Обнаружено ${alternations} возвратных сравнений между карточками; усилен вес глубокого семантического сходства характеристик (+0.12 α).`,
        };
      case 'price_sensitive_hesitant':
        return {
          archetype,
          archetypeLabelRu: 'Ценовое сомнение (Price-Gravity)',
          archetypeLabelEn: 'Price-Sensitive Hesitant',
          confidence,
          biometricVector,
          alphaAdjustment: 0.05,
          recommendedMmrLambda: 0.4,
          priceElasticityBoost: 1.5,
          serendipityBoost: 0.35,
          comparedItemIds,
          diagnosticSummary: `Зафиксировано ${priceHovers} задержек курсора на ценнике без клика; активирован буст альтернатив с лучшим соотношением цена/качество (×1.50).`,
        };
      case 'fast_scanner':
        return {
          archetype,
          archetypeLabelRu: 'Быстрый сканер (Исследователь)',
          archetypeLabelEn: 'Fast Exploratory Scanner',
          confidence,
          biometricVector,
          alphaAdjustment: 0.18,
          recommendedMmrLambda: 0.68,
          priceElasticityBoost: 1.05,
          serendipityBoost: 0.75,
          comparedItemIds,
          diagnosticSummary: `Высокая скорость скролла (${Math.round(scrollVel)} px/s) без фиксации; повышен MMR-коэффициент разнообразия (λ=0.68) и вектор открытий.`,
        };
      default:
        return {
          archetype: 'decisive_sniper',
          archetypeLabelRu: 'Целевой снайпер (Точный фокус)',
          archetypeLabelEn: 'Decisive Sniper Focus',
          confidence,
          biometricVector,
          alphaAdjustment: 0.0,
          recommendedMmrLambda: 0.2,
          priceElasticityBoost: 1.0,
          serendipityBoost: 0.15,
          comparedItemIds,
          diagnosticSummary:
            'Стабильный целевой паттерн внимания; сохраняется максимальная точность ранжирования без избыточной диверсификации.',
        };
    }
  }

  /**
   * Applies kinetic attention modulation to a candidate's base score.
   */
  public static modulateCandidateScore(
    baseScore: number,
    itemPrice: number | undefined,
    medianPrice: number,
    profile: KineticAttentionProfile
  ): { adjustedScore: number; kineticBonus: number } {
    let kineticBonus = 0;

    if (
      profile.archetype === 'price_sensitive_hesitant' &&
      typeof itemPrice === 'number' &&
      medianPrice > 0
    ) {
      // Reward items priced below or near median when buyer shows price hesitation
      const relativeSavings = (medianPrice - itemPrice) / Math.max(1, medianPrice);
      if (relativeSavings > 0) {
        kineticBonus += Math.min(0.14, relativeSavings * 0.18 * (profile.priceElasticityBoost - 1));
      }
    } else if (profile.archetype === 'analytical_comparer') {
      // Slight boost to high-precision matches
      kineticBonus += baseScore * 0.05;
    }

    const adjustedScore = Math.min(0.999, Math.max(0, baseScore + kineticBonus));
    return {
      adjustedScore: Math.round(adjustedScore * 10000) / 10000,
      kineticBonus: Math.round(kineticBonus * 10000) / 10000,
    };
  }
}
