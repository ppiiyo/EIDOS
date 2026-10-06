import { describe, it, expect } from 'vitest';
import { BanditExplorer } from '../../adaptive/bandit-explorer';

describe('PR #2: Float64 LinUCB & Cholesky Updates', () => {
  it('remains strictly finite and numerically stable after 10,000 iterations', () => {
    const explorer = new BanditExplorer({ featureDimension: 4, alpha: 0.5, strategy: 'linucb' });
    const d = 4;

    for (let i = 0; i < 10000; i++) {
      const ctx = new Float32Array([
        Math.sin(i * 0.1),
        Math.cos(i * 0.1),
        (i % 10) / 10,
        1.0,
      ]);
      const reward = (i % 2 === 0 ? 1.0 : -0.2) + Math.random() * 0.1;
      explorer.update('arm_stable', ctx, reward);
    }

    const testCtx = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    const prediction = explorer.predictArm('arm_stable', testCtx);

    expect(Number.isFinite(prediction.expectedReward)).toBe(true);
    expect(Number.isFinite(prediction.explorationBonus)).toBe(true);
    expect(Number.isFinite(prediction.finalScore)).toBe(true);
    expect(Number.isNaN(prediction.finalScore)).toBe(false);
    expect(prediction.explorationBonus).toBeGreaterThanOrEqual(0.0);
    expect(prediction.explorationBonus).toBeLessThanOrEqual(10.0);
  });

  it('handles zero context vector [0, 0, 0, 0] returning 0 exploration bonus', () => {
    const explorer = new BanditExplorer({ featureDimension: 4 });
    const zeroCtx = new Float32Array([0, 0, 0, 0]);
    const pred = explorer.predictArm('arm_zero', zeroCtx);
    expect(pred.explorationBonus).toBe(0.0);
    expect(pred.expectedReward).toBe(0.0);
    expect(pred.finalScore).toBe(0.0);
  });

  it('Cholesky rank-1 update produces positive diagonal elements', () => {
    const d = 3;
    const L = new Float64Array(d * d);
    for (let i = 0; i < d; i++) L[i * d + i] = 1.0;

    const x = new Float64Array([0.5, 0.3, 0.2]);
    const L_updated = BanditExplorer.choleskyRank1Update(L, x, d);

    for (let i = 0; i < d; i++) {
      const diag = L_updated[i * d + i];
      expect(diag).toBeGreaterThan(0.0);
      expect(Number.isFinite(diag)).toBe(true);
    }
  });

  it('handles extremely small context vectors xT * A_inv * x < 1e-12 cleanly without underflow errors', () => {
    const explorer = new BanditExplorer({ featureDimension: 4 });
    const tinyCtx = new Float32Array([1e-15, 1e-15, 1e-15, 1e-15]);
    const pred = explorer.predictArm('arm_tiny', tinyCtx);
    expect(Number.isFinite(pred.explorationBonus)).toBe(true);
    expect(pred.explorationBonus).toBeCloseTo(0.0, 5);
  });
});
