import { FeedbackEvent, RankingConfig } from './types';

/**
 * Online Feedback Loop dynamically shifts ranking weights and catalog popularity
 * in response to user actions (clicks, likes, purchases, ignores, dislikes).
 * Employs a decay-stabilized stochastic gradient-style update rule.
 */
export class FeedbackLoop {
  private readonly learningRate: number;
  private readonly decayFactor: number;
  private clickCount = 0;
  private likeCount = 0;
  private purchaseCount = 0;
  private ignoreCount = 0;
  private dislikeCount = 0;

  // Running delta adjustments to ranking weights
  private weightDeltas: Partial<RankingConfig> = {
    delta: 0, // userAffinity
    alpha: 0, // similarity
    beta: 0,  // popularity
  };

  /**
   * Initializes the FeedbackLoop with step parameters.
   *
   * @param config - learningRate and decayFactor
   */
  constructor(config?: { learningRate?: number; decayFactor?: number }) {
    this.learningRate = config?.learningRate ?? 0.01;
    this.decayFactor = config?.decayFactor ?? 0.99;
  }

  /**
   * Registers a user feedback event and incrementally nudges ranking weights.
   *
   * @param event - FeedbackEvent payload
   */
  public register(event: FeedbackEvent): void {
    // Apply time decay to accumulated adjustments to avoid runaway bias
    this.weightDeltas.delta = (this.weightDeltas.delta || 0) * this.decayFactor;
    this.weightDeltas.alpha = (this.weightDeltas.alpha || 0) * this.decayFactor;
    this.weightDeltas.beta = (this.weightDeltas.beta || 0) * this.decayFactor;

    switch (event.eventType) {
      case 'click':
        this.clickCount++;
        this.weightDeltas.delta = (this.weightDeltas.delta || 0) + this.learningRate * 0.5;
        this.weightDeltas.beta = (this.weightDeltas.beta || 0) + this.learningRate * 0.2;
        break;
      case 'like':
        this.likeCount++;
        this.weightDeltas.delta = (this.weightDeltas.delta || 0) + this.learningRate * 1.0;
        this.weightDeltas.beta = (this.weightDeltas.beta || 0) + this.learningRate * 0.5;
        break;
      case 'purchase':
        this.purchaseCount++;
        this.weightDeltas.delta = (this.weightDeltas.delta || 0) + this.learningRate * 2.0;
        this.weightDeltas.beta = (this.weightDeltas.beta || 0) + this.learningRate * 1.0;
        break;
      case 'ignore':
        this.ignoreCount++;
        this.weightDeltas.beta = (this.weightDeltas.beta || 0) - this.learningRate * 0.1;
        break;
      case 'dislike':
        this.dislikeCount++;
        this.weightDeltas.alpha = (this.weightDeltas.alpha || 0) - this.learningRate * 0.5;
        this.weightDeltas.delta = (this.weightDeltas.delta || 0) - this.learningRate * 0.5;
        break;
    }
  }

  /**
   * Returns additive weight deltas learned from feedback.
   */
  public getAdjustedWeights(): Partial<RankingConfig> {
    return {
      alpha: Math.max(-0.2, Math.min(0.2, this.weightDeltas.alpha || 0)),
      delta: Math.max(-0.2, Math.min(0.2, this.weightDeltas.delta || 0)),
      beta: Math.max(-0.2, Math.min(0.2, this.weightDeltas.beta || 0)),
    };
  }

  /**
   * Resets all accumulated feedback counters and weight adjustments.
   */
  public reset(): void {
    this.clickCount = 0;
    this.likeCount = 0;
    this.purchaseCount = 0;
    this.ignoreCount = 0;
    this.dislikeCount = 0;
    this.weightDeltas = {
      delta: 0,
      alpha: 0,
      beta: 0,
    };
  }

  /**
   * Returns current feedback summary metrics.
   */
  public stats(): {
    clicks: number;
    likes: number;
    purchases: number;
    ignores: number;
    dislikes: number;
  } {
    return {
      clicks: this.clickCount,
      likes: this.likeCount,
      purchases: this.purchaseCount,
      ignores: this.ignoreCount,
      dislikes: this.dislikeCount,
    };
  }
}
