import { describe, it, expect } from 'vitest';
import { ContextSignals } from '../../adaptive/context-signals';

describe('ContextSignals', () => {
  it('distinguishes temporal category affinity based on hour of day', () => {
    const signals = new ContextSignals();
    const affinity = new Map<string, Map<number, number>>();

    // Coffee: high affinity in morning (8am), low in evening (20pm)
    const coffeeHours = new Map<number, number>();
    coffeeHours.set(8, 0.95);
    coffeeHours.set(20, 0.15);
    affinity.set('Coffee', coffeeHours);

    const morningScore = signals.getContextualRelevance(
      'Coffee',
      { timestamp: 1700000000000, hourOfDay: 8 },
      affinity
    );

    const eveningScore = signals.getContextualRelevance(
      'Coffee',
      { timestamp: 1700000000000, hourOfDay: 20 },
      affinity
    );

    expect(morningScore).toBeCloseTo(0.95, 2);
    expect(eveningScore).toBeCloseTo(0.15, 2);
    expect(morningScore).toBeGreaterThan(eveningScore);
  });

  it('session penalty applies higher penalty to recently visited items', () => {
    const signals = new ContextSignals();
    const sessionHistory = ['item-A', 'item-B', 'item-C'];

    const penaltyRecent = signals.getSessionPenalty('item-C', sessionHistory);
    const penaltyOlder = signals.getSessionPenalty('item-A', sessionHistory);
    const penaltyUnseen = signals.getSessionPenalty('item-X', sessionHistory);

    expect(penaltyRecent).toBeGreaterThan(penaltyOlder);
    expect(penaltyUnseen).toBe(0.0);
  });

  it('empty session returns 0 penalty', () => {
    const signals = new ContextSignals();
    expect(signals.getSessionPenalty('any-item', [])).toBe(0.0);
  });
});
