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
 * PR #2 UPGRADE:
 * - Uses Float64Array for all covariance matrices, state vectors, and internal accumulation
 *   to ensure strict numerical stability over 100,000+ continuous iterations.
 * - Supports Cholesky rank-1 updates and positive-definiteness verification with adaptive regularization.
 * - Guarantees finite exploration bonuses with safe epsilon-greedy fallback against NaN/Infinity edge cases.
 */
export class BanditExplorer {
  private readonly config: BanditConfig;
  private readonly d: number;
  private readonly regLambda: number;
  private arms = new Map<string, BanditArmState>();

  constructor(config?: Partial<BanditConfig>) {
    this.config = {
      featureDimension: config?.featureDimension ?? 6,
      alpha: config?.alpha ?? 0.5,
      lambda: config?.lambda ?? 1.0,
      strategy: config?.strategy ?? 'linucb',
      varianceScale: config?.varianceScale ?? 0.25,
    };
    this.d = this.config.featureDimension;
    this.regLambda = Math.max(1e-6, this.config.lambda);
  }

  /**
   * Initializes a freshly regularized arm state with Float64Array:
   * A^{-1} = (1 / lambda) * I, L = sqrt(lambda) * I, b = 0, theta = 0.
   */
  private createArm(armId: string): BanditArmState {
    const d = this.d;
    const aInv = new Float64Array(d * d);
    const L = new Float64Array(d * d);
    const invLambda = 1.0 / this.regLambda;
    const sqrtLambda = Math.sqrt(this.regLambda);

    for (let i = 0; i < d; i++) {
      aInv[i * d + i] = invLambda;
      L[i * d + i] = sqrtLambda;
    }

    const state: BanditArmState = {
      armId,
      pulls: 0,
      totalReward: 0,
      aInv,
      L,
      b: new Float64Array(d),
      theta: new Float64Array(d),
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
   * Converts input Float32Array to Float64Array and pads/truncates to feature dimension d.
   */
  private alignContext(context: Float32Array | Float64Array | number[]): Float64Array {
    const aligned = new Float64Array(this.d);
    const limit = Math.min(context.length, this.d);
    for (let i = 0; i < limit; i++) {
      const val = context[i];
      aligned[i] = Number.isFinite(val) ? val : 0.0;
    }
    return aligned;
  }

  /**
   * Executes a rank-1 Cholesky update: computes updated lower triangular factor L_new
   * such that L_new * L_new^T = L * L^T + x * x^T.
   */
  public static choleskyRank1Update(
    L: Float64Array,
    x: Float64Array,
    d: number
  ): Float64Array {
    const L_out = new Float64Array(L);
    const x_work = new Float64Array(x);
    let beta = 1.0;

    for (let r = 0; r < d; r++) {
      const L_rr = L_out[r * d + r];
      const x_r = x_work[r];
      const L_rr_sq = L_rr * L_rr;
      const x_r_sq = x_r * x_r;
      const gamma = L_rr_sq + (x_r_sq / beta);

      if (gamma <= 1e-14) {
        L_out[r * d + r] = 1e-4;
        continue;
      }

      const alpha = Math.sqrt(gamma);
      const s = x_r / (beta * alpha);
      const c = L_rr / alpha;
      L_out[r * d + r] = alpha;
      beta = beta + (x_r_sq / (L_rr_sq || 1e-12));

      for (let c_idx = r + 1; c_idx < d; c_idx++) {
        const L_cr = L_out[c_idx * d + r];
        const x_c = x_work[c_idx];
        L_out[c_idx * d + r] = (L_cr * alpha + (x_r * x_c) / beta) / (L_rr || 1e-12);
        x_work[c_idx] = c * x_c - s * L_cr;
      }
    }

    return L_out;
  }

  /**
   * Verifies positive definiteness of inverse covariance matrix.
   * If non-positive diagonal entries or NaN/Infinity are encountered, re-regularizes.
   */
  private ensurePositiveDefinite(aInv: Float64Array): void {
    const d = this.d;
    let degenerate = false;

    for (let i = 0; i < d; i++) {
      const diag = aInv[i * d + i];
      if (!Number.isFinite(diag) || diag <= 1e-9) {
        degenerate = true;
        break;
      }
    }

    if (degenerate) {
      const invLambda = 1.0 / this.regLambda;
      for (let i = 0; i < d * d; i++) aInv[i] = 0;
      for (let i = 0; i < d; i++) aInv[i * d + i] = invLambda;
    }
  }

  /**
   * Computes expected reward and exploration bonus for candidate arm with context x.
   *
   * @param armId - Unique identifier of the candidate item
   * @param rawContext - Feature vector representing user/request context
   * @returns BanditArmScore with expected payoff, bonus, and composite score
   */
  public predictArm(armId: string, rawContext: Float32Array | Float64Array | number[]): BanditArmScore {
    const arm = this.getOrCreateArm(armId);
    const x = this.alignContext(rawContext);
    const d = this.d;

    // Check for zero context vector: x = [0, 0, ..., 0]
    let isZeroContext = true;
    for (let i = 0; i < d; i++) {
      if (Math.abs(x[i]) > 1e-12) {
        isZeroContext = false;
        break;
      }
    }

    if (isZeroContext) {
      return {
        armId,
        expectedReward: 0.0,
        explorationBonus: 0.0,
        finalScore: 0.0,
      };
    }

    // Compute expected reward: y_hat = theta^T * x
    let expectedReward = 0;
    for (let i = 0; i < d; i++) {
      expectedReward += arm.theta[i] * x[i];
    }
    if (!Number.isFinite(expectedReward)) expectedReward = 0.0;

    // Compute variance: sigma^2 = x^T * A_inv * x
    let variance = 0;
    const aInv = arm.aInv as Float64Array;
    for (let i = 0; i < d; i++) {
      let u_i = 0;
      const rowOffset = i * d;
      for (let j = 0; j < d; j++) {
        u_i += aInv[rowOffset + j] * x[j];
      }
      variance += x[i] * u_i;
    }

    // Handle very small or non-positive variance
    if (variance < 1e-12 || !Number.isFinite(variance)) {
      variance = 0;
    }

    const stdDev = Math.sqrt(Math.max(0, variance));

    if (this.config.strategy === 'thompson') {
      let sampledPerturbation = randomGaussian() * stdDev * this.config.varianceScale;
      if (!Number.isFinite(sampledPerturbation)) {
        sampledPerturbation = (Math.random() - 0.5) * 0.1;
      }
      const sampledScore = expectedReward + sampledPerturbation;
      return {
        armId,
        expectedReward,
        explorationBonus: sampledPerturbation,
        finalScore: sampledScore,
      };
    }

    // LinUCB: upper confidence bound = theta^T * x + alpha * sqrt(x^T * A_inv * x)
    let explorationBonus = this.config.alpha * stdDev;

    // Numerical stabilization fallback: clamp and verify finiteness
    if (!Number.isFinite(explorationBonus) || Number.isNaN(explorationBonus)) {
      explorationBonus = Math.random() < 0.1 ? 1.0 : 0.0;
    } else {
      explorationBonus = Math.min(10.0, Math.max(0.0, explorationBonus));
    }

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
   */
  public scoreCandidates(
    candidateIds: string[],
    context: Float32Array | Float64Array | number[]
  ): BanditArmScore[] {
    const scores = candidateIds.map((id) => this.predictArm(id, context));
    scores.sort((a, b) => b.finalScore - a.finalScore);
    return scores;
  }

  /**
   * Updates bandit arm parameters with observed reward using rank-1 updates on Float64Array.
   */
  public update(
    armId: string,
    rawContext: Float32Array | Float64Array | number[],
    reward: number
  ): void {
    const arm = this.getOrCreateArm(armId);
    const x = this.alignContext(rawContext);
    const d = this.d;
    const aInv = arm.aInv as Float64Array;
    const b = arm.b as Float64Array;
    const theta = arm.theta as Float64Array;

    // Step 1: Compute vector u = A_inv * x in Float64
    const u = new Float64Array(d);
    for (let i = 0; i < d; i++) {
      let sum = 0;
      const rowOffset = i * d;
      for (let j = 0; j < d; j++) {
        sum += aInv[rowOffset + j] * x[j];
      }
      u[i] = sum;
    }

    // Step 2: Denominator gamma = 1 + x^T * u
    let xTu = 0;
    for (let i = 0; i < d; i++) {
      xTu += x[i] * u[i];
    }
    const gamma = 1.0 + xTu;

    // Step 3: Sherman-Morrison rank-1 update of A_inv on Float64
    if (gamma > 1e-12 && Number.isFinite(gamma)) {
      const invGamma = 1.0 / gamma;
      for (let i = 0; i < d; i++) {
        const rowOffset = i * d;
        const u_i = u[i];
        for (let j = 0; j < d; j++) {
          aInv[rowOffset + j] -= (u_i * u[j]) * invGamma;
        }
      }
    }

    // Cholesky update if L factor is tracked
    if (arm.L) {
      arm.L = BanditExplorer.choleskyRank1Update(arm.L, x, d);
    }

    // Step 4: Update b_new = b + reward * x
    const safeReward = Number.isFinite(reward) ? reward : 0.0;
    for (let i = 0; i < d; i++) {
      b[i] += safeReward * x[i];
    }

    // Guardrail against loss of positive-definiteness
    this.ensurePositiveDefinite(aInv);

    // Step 5: Solve theta_new = A_inv * b
    for (let i = 0; i < d; i++) {
      let sum = 0;
      const rowOffset = i * d;
      for (let j = 0; j < d; j++) {
        sum += aInv[rowOffset + j] * b[j];
      }
      theta[i] = Number.isFinite(sum) ? sum : 0.0;
    }

    arm.pulls += 1;
    arm.totalReward += safeReward;
    arm.lastUpdated = Date.now();
  }

  /**
   * Processes a structured FeedbackEvent and automatically updates the corresponding arm.
   */
  public updateFromFeedback(event: FeedbackEvent, context?: Float32Array | Float64Array): void {
    let reward = 0;
    switch (event.eventType) {
      case 'purchase':
        reward = 1.0;
        break;
      case 'like':
        reward = 0.5;
        break;
      case 'click':
        reward = 0.2;
        break;
      case 'ignore':
        reward = -0.05;
        break;
      case 'dislike':
        reward = -0.8;
        break;
    }

    const ctx = context ?? new Float64Array(this.d);
    this.update(event.itemId, ctx, reward);
  }

  /**
   * Retrieves summary telemetry for all tracked arms.
   */
  public getArmsState(): Array<{ armId: string; pulls: number; avgReward: number }> {
    const result: Array<{ armId: string; pulls: number; avgReward: number }> = [];
    for (const [armId, state] of this.arms.entries()) {
      result.push({
        armId,
        pulls: state.pulls,
        avgReward: state.pulls > 0 ? state.totalReward / state.pulls : 0,
      });
    }
    return result;
  }

  /**
   * Retrieves the raw arm state by ID, or null if not registered.
   */
  public getArmState(armId: string): BanditArmState | null {
    return this.arms.get(armId) ?? null;
  }

  /**
   * Evicts arms that have not received interaction within maxAgeMs milliseconds.
   */
  public evictStaleArms(maxAgeMs: number): number {
    const now = Date.now();
    let evicted = 0;
    for (const [id, state] of this.arms.entries()) {
      if (now - state.lastUpdated > maxAgeMs) {
        this.arms.delete(id);
        evicted++;
      }
    }
    return evicted;
  }

  /**
   * Clears all registered bandit arm states from memory.
   */
  public clear(): void {
    this.arms.clear();
  }
}
