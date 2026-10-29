/**
 * Multi-Objective Pareto Frontier Weight Optimizer
 * Finds non-dominated weight configurations across 3 competing axes:
 * 1. Relevance Precision (NDCG / Dense+Lexical alignment)
 * 2. Discovery & Anti-Echo-Chamber Diversity (Entropy + Orthogonal Serendipity)
 * 3. Commercial Utility (Conversion potential + Price-Value elasticity)
 */

export interface ParetoCandidateSolution {
  id: string;
  labelRu: string;
  labelEn: string;
  weights: {
    alpha: number;
    mmrLambda: number;
    serendipityWeight: number;
    priceValueWeight: number;
  };
  objectives: {
    relevanceScore: number;
    discoveryScore: number;
    commercialScore: number;
    harmonicComposite: number;
  };
  isParetoOptimal: boolean;
}

export interface ParetoOptimizationReport {
  frontier: ParetoCandidateSolution[];
  recommendedBalanced: ParetoCandidateSolution;
  recommendedMaxRelevance: ParetoCandidateSolution;
  recommendedMaxDiscovery: ParetoCandidateSolution;
  recommendedMaxCommercial: ParetoCandidateSolution;
  evaluatedGridSize: number;
}

export class ParetoWeightOptimizer {
  /**
   * Evaluates a grid of ranking hyperparameters against catalog & session statistics
   * and extracts the non-dominated Pareto Frontier.
   */
  public static optimize(params?: {
    avgDenseScore?: number;
    avgBm25Score?: number;
    categoryEntropyNormalized?: number;
    explorationTemperature?: number;
    priceSensitivity?: number;
  }): ParetoOptimizationReport {
    const avgDense = Math.max(0.2, Math.min(1, params?.avgDenseScore ?? 0.72));
    const avgBm25 = Math.max(0.1, Math.min(1, params?.avgBm25Score ?? 0.54));
    const baseEntropy = Math.max(0.2, Math.min(1, params?.categoryEntropyNormalized ?? 0.65));
    const explorationTemp = Math.max(0.1, Math.min(1, params?.explorationTemperature ?? 0.5));
    const priceSens = Math.max(0, Math.min(1, params?.priceSensitivity ?? 0.35));

    const alphaGrid = [0.35, 0.55, 0.7, 0.85];
    const mmrGrid = [0.15, 0.35, 0.55, 0.72];
    const serendipityGrid = [0.05, 0.2, 0.38, 0.52];

    const candidates: ParetoCandidateSolution[] = [];
    let idx = 0;

    for (const alpha of alphaGrid) {
      for (const mmrLambda of mmrGrid) {
        for (const serendipityWeight of serendipityGrid) {
          idx++;
          const priceValueWeight =
            Math.round(Math.max(0.05, Math.min(0.45, 0.15 + priceSens * 0.25 - serendipityWeight * 0.1)) * 100) /
            100;

          // Objective 1: Relevance Precision (peaks around alpha=0.70, low MMR dilution, low serendipity drift)
          const alphaFit = 1 - Math.abs(alpha - 0.72) * 0.65;
          const baseAlign = alpha * avgDense + (1 - alpha) * avgBm25;
          const dilutionPenalty = mmrLambda * 0.22 + serendipityWeight * 0.28;
          const relevanceScore =
            Math.round(Math.min(0.99, Math.max(0.35, baseAlign * 0.65 + alphaFit * 0.45 - dilutionPenalty)) * 1000) /
            1000;

          // Objective 2: Discovery & Anti-Echo-Chamber Diversity
          const discoveryRaw =
            baseEntropy * 0.35 +
            mmrLambda * 0.42 +
            serendipityWeight * 0.55 +
            explorationTemp * 0.12 -
            (1 - alpha) * 0.12;
          const discoveryScore =
            Math.round(Math.min(0.99, Math.max(0.2, discoveryRaw)) * 1000) / 1000;

          // Objective 3: Commercial Utility (balances relevance with moderate diversity & price elasticity)
          const diversitySweetSpot = 1 - Math.abs(mmrLambda - 0.35) * 0.8;
          const commercialRaw =
            relevanceScore * 0.48 +
            diversitySweetSpot * 0.26 +
            priceValueWeight * 0.38 +
            serendipityWeight * 0.14;
          const commercialScore =
            Math.round(Math.min(0.99, Math.max(0.3, commercialRaw)) * 1000) / 1000;

          const harmonicComposite =
            Math.round(
              (3 /
                (1 / Math.max(0.01, relevanceScore) +
                  1 / Math.max(0.01, discoveryScore) +
                  1 / Math.max(0.01, commercialScore))) *
                1000
            ) / 1000;

          candidates.push({
            id: `pareto-${idx}`,
            labelRu: `Конфигурация #${idx}`,
            labelEn: `Config #${idx}`,
            weights: {
              alpha,
              mmrLambda,
              serendipityWeight,
              priceValueWeight,
            },
            objectives: {
              relevanceScore,
              discoveryScore,
              commercialScore,
              harmonicComposite,
            },
            isParetoOptimal: false,
          });
        }
      }
    }

    // Identify non-dominated Pareto frontier
    for (let i = 0; i < candidates.length; i++) {
      const a = candidates[i];
      let dominated = false;
      for (let j = 0; j < candidates.length; j++) {
        if (i === j) continue;
        const b = candidates[j];
        const bGeAll =
          b.objectives.relevanceScore >= a.objectives.relevanceScore &&
          b.objectives.discoveryScore >= a.objectives.discoveryScore &&
          b.objectives.commercialScore >= a.objectives.commercialScore;
        const bStrictBetter =
          b.objectives.relevanceScore > a.objectives.relevanceScore ||
          b.objectives.discoveryScore > a.objectives.discoveryScore ||
          b.objectives.commercialScore > a.objectives.commercialScore;

        if (bGeAll && bStrictBetter) {
          dominated = true;
          break;
        }
      }
      a.isParetoOptimal = !dominated;
    }

    const frontier = candidates
      .filter((c) => c.isParetoOptimal)
      .sort((a, b) => b.objectives.harmonicComposite - a.objectives.harmonicComposite);

    const recommendedBalanced = {
      ...(frontier[0] || candidates[0]),
      labelRu: 'Парето-оптимум (Гармонический баланс)',
      labelEn: 'Pareto Harmonic Optimum',
    };

    const recommendedMaxRelevance = {
      ...[...frontier].sort((a, b) => b.objectives.relevanceScore - a.objectives.relevanceScore)[0],
      labelRu: 'Максимум точности (NDCG Снайпер)',
      labelEn: 'Max Relevance Precision',
    };

    const recommendedMaxDiscovery = {
      ...[...frontier].sort((a, b) => b.objectives.discoveryScore - a.objectives.discoveryScore)[0],
      labelRu: 'Максимум открытий (Анти-Эхо-Камера)',
      labelEn: 'Max Serendipity Discovery',
    };

    const recommendedMaxCommercial = {
      ...[...frontier].sort((a, b) => b.objectives.commercialScore - a.objectives.commercialScore)[0],
      labelRu: 'Максимум конверсии и выручки (GMV)',
      labelEn: 'Max Commercial Utility',
    };

    return {
      frontier: frontier.slice(0, 12),
      recommendedBalanced,
      recommendedMaxRelevance,
      recommendedMaxDiscovery,
      recommendedMaxCommercial,
      evaluatedGridSize: candidates.length,
    };
  }
}
