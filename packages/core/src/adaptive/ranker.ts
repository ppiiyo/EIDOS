import { RankingConfig, RankingFeatures } from './types';

/**
 * Multi-Feature Ranker executes candidate scoring and linear composite re-ranking.
 * Weights are initialized with engineering baseline defaults and can be tuned or
 * overridden per request or via environment configurations.
 */
export class Ranker {
  private readonly config: RankingConfig;

  /**
   * Initializes the Ranker with default engineering weights.
   * Defaults:
   * alpha (similarity) = 0.45
   * beta (popularity) = 0.15
   * gamma (freshness) = 0.10
   * delta (userAffinity) = 0.20
   * epsilon (categoryRepetition penalty) = 0.05
   * zeta (contextualRelevance) = 0.03
   * eta (kgCentrality) = 0.02
   *
   * @param config - Partial weights to override
   */
  constructor(config?: Partial<RankingConfig>) {
    this.validateWeights(config);
    this.config = {
      alpha: config?.alpha ?? 0.45,
      beta: config?.beta ?? 0.15,
      gamma: config?.gamma ?? 0.10,
      delta: config?.delta ?? 0.20,
      epsilon: config?.epsilon ?? 0.05,
      zeta: config?.zeta ?? 0.03,
      eta: config?.eta ?? 0.02,
    };
  }

  /**
   * Validates that all supplied weights are non-negative.
   */
  private validateWeights(config?: Partial<RankingConfig>): void {
    if (!config) return;
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'number' && value < 0) {
        throw new Error(`Weight '${key}' must be non-negative. Received: ${value}`);
      }
    }
  }

  /**
   * Calculates the composite multi-feature score for a single candidate.
   * Formula:
   * score = alpha * sim + beta * pop + gamma * fresh + delta * aff + zeta * ctx + eta * kg - epsilon * rep
   *
   * @param features - Feature vector of the candidate
   * @param config - Optional weight overrides
   * @returns Composite score
   */
  public score(features: RankingFeatures, config?: Partial<RankingConfig>): number {
    this.validateWeights(config);
    const alpha = config?.alpha ?? this.config.alpha;
    const beta = config?.beta ?? this.config.beta;
    const gamma = config?.gamma ?? this.config.gamma;
    const delta = config?.delta ?? this.config.delta;
    const epsilon = config?.epsilon ?? this.config.epsilon;
    const zeta = config?.zeta ?? this.config.zeta;
    const eta = config?.eta ?? this.config.eta;

    const baseScore =
      alpha * features.similarity +
      beta * features.popularity +
      gamma * features.freshness +
      delta * features.userAffinity +
      zeta * features.contextualRelevance +
      eta * features.kgCentrality -
      epsilon * features.categoryRepetition;

    return Math.max(0, baseScore);
  }

  /**
   * Ranks an array of candidates by computing their composite scores and sorting in descending order.
   *
   * @param candidates - List of candidate IDs and their extracted features
   * @param config - Optional weight overrides
   * @returns Sorted ranked list with final score and features
   */
  public rank(
    candidates: Array<{ id: string; features: RankingFeatures }>,
    config?: Partial<RankingConfig>
  ): Array<{ id: string; score: number; features: RankingFeatures }> {
    const scored = candidates.map((cand) => ({
      id: cand.id,
      score: this.score(cand.features, config),
      features: cand.features,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * Breaks down the score contributions for explainability and inspection.
   *
   * @param features - Candidate features
   * @returns Key-value breakdown of each weighted feature contribution
   */
  public explain(features: RankingFeatures): Record<string, number> {
    return {
      similarityContribution: this.config.alpha * features.similarity,
      popularityContribution: this.config.beta * features.popularity,
      freshnessContribution: this.config.gamma * features.freshness,
      userAffinityContribution: this.config.delta * features.userAffinity,
      contextualContribution: this.config.zeta * features.contextualRelevance,
      kgCentralityContribution: this.config.eta * features.kgCentrality,
      categoryPenaltyContribution: -(this.config.epsilon * features.categoryRepetition),
      totalScore: this.score(features),
    };
  }
}
