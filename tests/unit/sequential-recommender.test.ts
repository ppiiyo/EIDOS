import { describe, it, expect } from 'vitest';
import { SequentialRecommender } from '../../packages/core/src/recommender/sequential-recommender';

describe('Task 3.3: Session-Based Sequential Recommender', () => {
  it('weights recent interactions higher than older ones using exponential decay and L2 normalization', () => {
    const rec = new SequentialRecommender();
    const embs = new Map<string, Float32Array>([
      ['old_item', new Float32Array([1, 0])],
      ['recent_item', new Float32Array([0, 1])],
    ]);

    rec.recordInteraction('s1', 'old_item');
    rec.recordInteraction('s1', 'recent_item');

    const vec = rec.computeSessionVector('s1', embs, 0.5)!;
    expect(vec).not.toBeNull();
    // Recent item [0,1] has weight 1.0, old item [1,0] has weight 0.5 -> vec[1] > vec[0]
    expect(vec[1]).toBeGreaterThan(vec[0]);

    // Check L2 norm is ~1.0
    const l2Norm = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1]);
    expect(l2Norm).toBeCloseTo(1.0, 5);
  });
});
