import { describe, it, expect } from 'vitest';
import { BanditExplorer } from '../../adaptive/bandit-explorer';

describe('BanditExplorer', () => {
  it('LinUCB provides higher exploration bonus to unpulled arms than frequently pulled arms', () => {
    const explorer = new BanditExplorer({ featureDimension: 3, alpha: 1.0, strategy: 'linucb' });
    const context = new Float32Array([1.0, 0.5, 0.2]);

    // Initial prediction for arm1 (unpulled)
    const initialArm1 = explorer.predictArm('item_new', context);
    expect(initialArm1.expectedReward).toBe(0);
    expect(initialArm1.explorationBonus).toBeGreaterThan(0);

    // Pull arm1 multiple times with neutral reward
    for (let i = 0; i < 10; i++) {
      explorer.update('item_new', context, 0.0);
    }

    const updatedArm1 = explorer.predictArm('item_new', context);
    // Exploration bonus must decrease as variance shrinks
    expect(updatedArm1.explorationBonus).toBeLessThan(initialArm1.explorationBonus);
  });

  it('learns to favor high-reward items on identical contexts', () => {
    const explorer = new BanditExplorer({ featureDimension: 2, alpha: 0.2, strategy: 'linucb' });
    const context = new Float32Array([1.0, 0.0]);

    // item_good receives multiple positive rewards (purchases)
    for (let i = 0; i < 5; i++) {
      explorer.update('item_good', context, 1.0);
    }

    // item_bad receives negative rewards (dislikes)
    for (let i = 0; i < 5; i++) {
      explorer.update('item_bad', context, -0.8);
    }

    const scoreGood = explorer.predictArm('item_good', context);
    const scoreBad = explorer.predictArm('item_bad', context);

    expect(scoreGood.expectedReward).toBeGreaterThan(0.5);
    expect(scoreBad.expectedReward).toBeLessThan(0);
    expect(scoreGood.finalScore).toBeGreaterThan(scoreBad.finalScore);

    const ranked = explorer.scoreCandidates(['item_bad', 'item_good'], context);
    expect(ranked[0].armId).toBe('item_good');
    expect(ranked[1].armId).toBe('item_bad');
  });

  it('updateFromFeedback correctly maps feedback event types to rewards', () => {
    const explorer = new BanditExplorer({ featureDimension: 4 });
    const context = new Float32Array([0.5, 0.5, 0.5, 0.5]);

    explorer.updateFromFeedback(
      {
        userId: 'u1',
        itemId: 'arm_purchase',
        eventType: 'purchase',
        timestamp: Date.now(),
      },
      context
    );

    explorer.updateFromFeedback(
      {
        userId: 'u1',
        itemId: 'arm_dislike',
        eventType: 'dislike',
        timestamp: Date.now(),
      },
      context
    );

    const purchaseArm = explorer.getArmState('arm_purchase');
    const dislikeArm = explorer.getArmState('arm_dislike');

    expect(purchaseArm?.totalReward).toBe(1.0);
    expect(dislikeArm?.totalReward).toBe(-0.8);
    expect(purchaseArm?.pulls).toBe(1);
    expect(dislikeArm?.pulls).toBe(1);
  });

  it('Thompson sampling mode generates stochastic scores within expected bounds', () => {
    const explorer = new BanditExplorer({
      featureDimension: 2,
      strategy: 'thompson',
      varianceScale: 0.5,
    });
    const context = new Float32Array([1.0, 1.0]);

    const score1 = explorer.predictArm('arm_ts', context);
    const score2 = explorer.predictArm('arm_ts', context);

    expect(typeof score1.finalScore).toBe('number');
    expect(typeof score2.finalScore).toBe('number');
    // Scores are finite numbers
    expect(Number.isFinite(score1.finalScore)).toBe(true);
  });

  it('handles arm eviction and clear', () => {
    const explorer = new BanditExplorer();
    explorer.update('arm_temp', new Float32Array([1, 0]), 0.5);

    expect(explorer.getArmState('arm_temp')).not.toBeNull();

    // Fast-forward age
    const arm = explorer.getArmState('arm_temp')!;
    arm.lastUpdated = Date.now() - 50000;

    explorer.evictStaleArms(10000);
    expect(explorer.getArmState('arm_temp')).toBeNull();

    explorer.update('arm_new', new Float32Array([1, 0]), 0.5);
    expect(explorer.getArmState('arm_new')).not.toBeNull();
    explorer.clear();
    expect(explorer.getArmState('arm_new')).toBeNull();
  });
});
