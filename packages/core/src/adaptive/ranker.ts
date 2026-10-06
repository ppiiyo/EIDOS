import { RankingConfig, RankingFeatures } from './types';
import { StreamingQuantileScaler } from './feature-scaler';

/**
 * Multi-Feature Ranker executes candidate scoring and linear composite re-ranking.
 * Integrates an automated Feature Normalization Layer (StreamingQuantileScaler)
 * to prevent high-magnitude features (e.g. raw popularity 10,000+) from overpowering
 * bounded semantic similarity [0, 1].
 */
export class Ranker {
  private readonly config: RankingConfig;
  private readonly scalers = new Map<string, StreamingQuantileScaler>();

  /**
   * Initializes the Ranker with default engineering weights and quantile scalers.
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

    // Initialize scalers with default [0, 1] bounds for graceful cold start
    const featureKeys = [
      'popularity',
      'freshness',
      'userAffinity',
      'contextualRelevance',
      'kgCentrality',
      'categoryRepetition',
    ];

    for (const key of featureKeys) {
      this.scalers.set(key, new StreamingQuantileScaler(10000, 0.0, 1.0));
    }
  }

  /**
   * Online learning: updates empirical quantile statistics from observed feedback or catalog items.
   */
  public updateStatistics(features: Partial<RankingFeatures>): void {
    if (features.popularity !== undefined) this.scalers.get('popularity')?.update(features.popularity);
    if (features.freshness !== undefined) this.scalers.get('freshness')?.update(features.freshness);
    if (features.userAffinity !== undefined) this.scalers.get('userAffinity')?.update(features.userAffinity);
    if (features.contextualRelevance !== undefined) this.scalers.get('contextualRelevance')?.update(features.contextualRelevance);
    if (features.kgCentrality !== undefined) this.scalers.get('kgCentrality')?.update(features.kgCentrality);
    if (features.categoryRepetition !== undefined) this.scalers.get('categoryRepetition')?.update(features.categoryRepetition);
  }

  /**
   * Normalizes continuous raw features into [0, 1].
   */
  public normalizeFeatures(features: RankingFeatures): RankingFeatures {
    return {
      similarity: Math.min(1.0, Math.max(0.0, features.similarity)), // already in [0, 1]
      popularity: this.scalers.get('popularity')?.transform(features.popularity) ?? features.popularity,
      freshness: this.scalers.get('freshness')?.transform(features.freshness) ?? features.freshness,
      userAffinity: this.scalers.get('userAffinity')?.transform(features.userAffinity) ?? features.userAffinity,
      categoryRepetition: this.scalers.get('categoryRepetition')?.transform(features.categoryRepetition) ?? features.categoryRepetition,
      contextualRelevance: this.scalers.get('contextualRelevance')?.transform(features.contextualRelevance) ?? features.contextualRelevance,
      kgCentrality: this.scalers.get('kgCentrality')?.transform(features.kgCentrality) ?? features.kgCentrality,
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

    const norm = this.normalizeFeatures(features);

    const baseScore =
      alpha * norm.similarity +
      beta * norm.popularity +
      gamma * norm.freshness +
      delta * norm.userAffinity +
      zeta * norm.contextualRelevance +
      eta * norm.kgCentrality -
      epsilon * norm.categoryRepetition;

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
    const norm = this.normalizeFeatures(features);
    return {
      similarityContribution: this.config.alpha * norm.similarity,
      popularityContribution: this.config.beta * norm.popularity,
      freshnessContribution: this.config.gamma * norm.freshness,
      userAffinityContribution: this.config.delta * norm.userAffinity,
      contextualContribution: this.config.zeta * norm.contextualRelevance,
      kgCentralityContribution: this.config.eta * norm.kgCentrality,
      categoryPenaltyContribution: -(this.config.epsilon * norm.categoryRepetition),
      totalScore: this.score(features),
    };
  }
}
