import { BanditArmScore, BanditArmState, BanditConfig, FeedbackEvent } from './types';

/**
 * Standard Gaussian random generator using the Box-Muller transform.
 */
function randomGaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * BanditExplorer implements Contextual Bandits for recommendation exploration and exploitation.
 * Supports disjoint LinUCB (Linear Upper Confidence Bound) and Linear Thompson Sampling.
 *
 * Employs $O(d^2)$ Sherman-Morrison rank-1 updates to continuously maintain inverse covariance
 * matrices $A_a^{-1}$ in real time without matrix inversion overhead.
 */
export class BanditExplorer {
  private readonly config: BanditConfig;
  private readonly d: number;
  private arms = new Map<string, BanditArmState>();

  /**
   * Initializes the BanditExplorer with optional configuration.
   *
   * @param config - Partial configuration settings
   */
  constructor(config?: Partial<BanditConfig>) {
    this.config = {
      featureDimension: config?.featureDimension ?? 6,
      alpha: config?.alpha ?? 0.5,
      lambda: config?.lambda ?? 1.0,
      strategy: config?.strategy ?? 'linucb',
      varianceScale: config?.varianceScale ?? 0.25,
    };
    this.d = this.config.featureDimension;
  }

  /**
   * Creates a freshly initialized arm state with A^{-1} = (1 / lambda) * I and b = 0.
   *
   * @param armId - Identifier for the item or arm
   */
  private createArm(armId: string): BanditArmState {
    const d = this.d;
    const aInv = new Float32Array(d * d);
    const invLambda = 1.0 / Math.max(1e-6, this.config.lambda);

    for (let i = 0; i < d; i++) {
      aInv[i * d + i] = invLambda;
    }

    const state: BanditArmState = {
      armId,
      pulls: 0,
      totalReward: 0,
      aInv,
      b: new Float32Array(d),
      theta: new Float32Array(d),
      lastUpdated: Date.now(),
    };

    this.arms.set(armId, state);
    return state;
  }

  /**
   * Retrieves an existing arm or initializes a new one.
   */
  public getOrCreateArm(armId: string): BanditArmState {
    return this.arms.get(armId) ?? this.createArm(armId);
  }

  /**
   * Pads or truncates a context vector to match the configured feature dimension.
   */
  private alignContext(context: Float32Array): Float32Array {
    if (context.length === this.d) {
      return context;
    }
    const aligned = new Float32Array(this.d);
    const limit = Math.min(context.length, this.d);
    for (let i = 0; i < limit; i++) {
      aligned[i] = context[i];
    }
    return aligned;
  }

  /**
   * Computes expected reward and exploration bonus for a single candidate arm given context x.
   *
   * @param armId - Unique identifier of the candidate item
   * @param rawContext - Feature vector representing user/request context
   * @returns BanditArmScore with expected payoff, bonus, and composite score
   */
  public predictArm(armId: string, rawContext: Float32Array): BanditArmScore {
    const arm = this.getOrCreateArm(armId);
    const x = this.alignContext(rawContext);
    const d = this.d;

    // Compute expected reward: y_hat = theta^T * x
    let expectedReward = 0;
    for (let i = 0; i < d; i++) {
      expectedReward += arm.theta[i] * x[i];
    }

    // Compute variance: sigma^2 = x^T * A_inv * x
    // Step 1: u = A_inv * x
    let variance = 0;
    for (let i = 0; i < d; i++) {
      let u_i = 0;
      const rowOffset = i * d;
      for (let j = 0; j < d; j++) {
        u_i += arm.aInv[rowOffset + j] * x[j];
      }
      variance += x[i] * u_i;
    }

    const stdDev = Math.sqrt(Math.max(0, variance));

    if (this.config.strategy === 'thompson') {
      // Linear Thompson Sampling: sample perturbance from Gaussian posterior
      const sampledPerturbation = randomGaussian() * stdDev * this.config.varianceScale;
      const sampledScore = expectedReward + sampledPerturbation;
      return {
        armId,
        expectedReward,
        explorationBonus: sampledPerturbation,
        finalScore: sampledScore,
      };
    }

    // LinUCB: upper confidence bound score = theta^T * x + alpha * sqrt(x^T * A_inv * x)
    const explorationBonus = this.config.alpha * stdDev;
    const finalScore = expectedReward + explorationBonus;

    return {
      armId,
      expectedReward,
      explorationBonus,
      finalScore,
    };
  }

  /**
   * Scores and ranks candidate items according to UCB or Thompson scores.
   *
   * @param candidateIds - Array of item IDs to evaluate
   * @param context - Contextual feature vector
   * @returns Sorted array of BanditArmScore in descending order
   */
  public scoreCandidates(candidateIds: string[], context: Float32Array): BanditArmScore[] {
    const scores = candidateIds.map((id) => this.predictArm(id, context));
    scores.sort((a, b) => b.finalScore - a.finalScore);
    return scores;
  }

  /**
   * Updates bandit arm parameters with observed reward using rank-1 Sherman-Morrison updates.
   *
   * Formulas:
   *   u = A_inv * x
   *   gamma = 1 + x^T * u
   *   A_inv_new = A_inv - (u * u^T) / gamma
   *   b_new = b + reward * x
   *   theta_new = A_inv_new * b_new
   *
   * @param armId - Identifier of the selected item
   * @param rawContext - Feature vector at time of recommendation
   * @param reward - Numerical reward signal (e.g. -1.0 to 1.0)
   */
  public update(armId: string, rawContext: Float32Array, reward: number): void {
    const arm = this.getOrCreateArm(armId);
    const x = this.alignContext(rawContext);
    const d = this.d;

    // Step 1: Compute vector u = A_inv * x
    const u = new Float32Array(d);
    for (let i = 0; i < d; i++) {
      let sum = 0;
      const rowOffset = i * d;
      for (let j = 0; j < d; j++) {
        sum += arm.aInv[rowOffset + j] * x[j];
      }
      u[i] = sum;
    }

    // Step 2: Compute denominator gamma = 1 + x^T * u
    let xTu = 0;
    for (let i = 0; i < d; i++) {
      xTu += x[i] * u[i];
    }
    const gamma = 1.0 + xTu;

    // Step 3: Rank-1 update of A_inv: A_inv -= (u * u^T) / gamma
    const invGamma = 1.0 / Math.max(1e-6, gamma);
    for (let i = 0; i < d; i++) {
      const rowOffset = i * d;
      const u_i = u[i];
      for (let j = 0; j < d; j++) {
        arm.aInv[rowOffset + j] -= u_i * u[j] * invGamma;
      }
    }

    // Step 4: Update b += reward * x
    for (let i = 0; i < d; i++) {
      arm.b[i] += reward * x[i];
    }

    // Step 5: Update theta = A_inv * b
    for (let i = 0; i < d; i++) {
      let sum = 0;
      const rowOffset = i * d;
      for (let j = 0; j < d; j++) {
        sum += arm.aInv[rowOffset + j] * arm.b[j];
      }
      arm.theta[i] = sum;
    }

    arm.pulls++;
    arm.totalReward += reward;
    arm.lastUpdated = Date.now();
  }

  /**
   * Automatically maps a FeedbackEvent into a continuous reward signal and updates the arm.
   *
   * Mapping:
   *   'purchase' -> +1.0
   *   'like'     -> +0.7
   *   'click'    -> +0.4
   *   'ignore'   -> -0.1
   *   'dislike'  -> -0.8
   *
   * @param event - FeedbackEvent from user interaction
   * @param context - Feature context at the time of interaction
   */
  public updateFromFeedback(event: FeedbackEvent, context: Float32Array): void {
    let reward = 0;
    switch (event.eventType) {
      case 'purchase':
        reward = 1.0;
        break;
      case 'like':
        reward = 0.7;
        break;
      case 'click':
        reward = 0.4;
        break;
      case 'ignore':
        reward = -0.1;
        break;
      case 'dislike':
        reward = -0.8;
        break;
    }

    this.update(event.itemId, context, reward);
  }

  /**
   * Returns current statistics of an arm.
   */
  public getArmState(armId: string): BanditArmState | null {
    return this.arms.get(armId) || null;
  }

  /**
   * Resets all arm states.
   */
  public clear(): void {
    this.arms.clear();
  }

  /**
   * Evicts arms that have not been pulled or updated within maxAgeMs.
   */
  public evictStaleArms(maxAgeMs = 7 * 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [armId, arm] of this.arms.entries()) {
      if (now - arm.lastUpdated > maxAgeMs) {
        this.arms.delete(armId);
      }
    }
  }
}
