import { describe, it, expect } from 'vitest';
import { FeedbackLoop } from '../../adaptive/feedback-loop';

describe('FeedbackLoop', () => {
  it('click increases userAffinity and popularity weight deltas', () => {
    const loop = new FeedbackLoop({ learningRate: 0.1 });
    const initialDeltas = loop.getAdjustedWeights();
    expect(initialDeltas.delta).toBe(0);

    loop.register({
      userId: 'user-1',
      itemId: 'item-1',
      eventType: 'click',
      timestamp: Date.now(),
    });

    const updated = loop.getAdjustedWeights();
    expect(updated.delta).toBeGreaterThan(0);
    expect(updated.beta).toBeGreaterThan(0);
  });

  it('dislike reduces similarity and userAffinity weights', () => {
    const loop = new FeedbackLoop({ learningRate: 0.1 });
    loop.register({
      userId: 'user-1',
      itemId: 'item-1',
      eventType: 'dislike',
      timestamp: Date.now(),
    });

    const updated = loop.getAdjustedWeights();
    expect(updated.alpha).toBeLessThan(0);
    expect(updated.delta).toBeLessThan(0);
  });

  it('tracks stats accurately across different event types', () => {
    const loop = new FeedbackLoop();
    loop.register({ userId: 'u', itemId: 'i', eventType: 'click', timestamp: 1 });
    loop.register({ userId: 'u', itemId: 'i', eventType: 'like', timestamp: 2 });
    loop.register({ userId: 'u', itemId: 'i', eventType: 'purchase', timestamp: 3 });
    loop.register({ userId: 'u', itemId: 'i', eventType: 'ignore', timestamp: 4 });
    loop.register({ userId: 'u', itemId: 'i', eventType: 'dislike', timestamp: 5 });

    const stats = loop.stats();
    expect(stats.clicks).toBe(1);
    expect(stats.likes).toBe(1);
    expect(stats.purchases).toBe(1);
    expect(stats.ignores).toBe(1);
    expect(stats.dislikes).toBe(1);
  });

  it('reset clears stats and restores deltas to 0', () => {
    const loop = new FeedbackLoop({ learningRate: 0.1 });
    loop.register({ userId: 'u', itemId: 'i', eventType: 'purchase', timestamp: 1 });
    expect(loop.stats().purchases).toBe(1);

    loop.reset();
    expect(loop.stats().purchases).toBe(0);
    const weights = loop.getAdjustedWeights();
    expect(weights.delta).toBe(0);
    expect(weights.alpha).toBe(0);
  });
});
