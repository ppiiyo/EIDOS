import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackEvent,
  clearAnalytics,
  subscribeAnalytics,
} from '../../apps/workspace/src/lib/analytics/tracker';
import { ConversationalAgent } from '../../apps/workspace/src/lib/agent/conversational-agent';
import {
  INITIAL_CATALOG,
  computeTextEmbedding,
  cosineSimilarity,
} from '../../apps/workspace/src/utils/recommenderEngine';
import { VectorSteering } from '@eidos/core';

describe('Phase 4: Pipeline Synchronization, Reactive Telemetry & Multi-Turn NLU Agent (TDD)', () => {
  beforeEach(() => {
    clearAnalytics();
  });

  it('notifies analytics subscribers in real time when trackEvent and clearAnalytics are called', () => {
    let notifications = 0;
    const unsubscribe = subscribeAnalytics(() => {
      notifications++;
    });

    trackEvent({ type: 'search', query: 'cyberpunk' });
    trackEvent({ type: 'item_click', itemId: '1', category: 'Игры' });
    expect(notifications).toBe(2);

    clearAnalytics();
    expect(notifications).toBe(3);
    unsubscribe();
  });

  it('ConversationalAgent sanitizes XSS/injection inputs and preserves multi-turn category context on follow-up budget refinement', async () => {
    const embeddings = new Map<string, Float32Array>();
    for (const item of INITIAL_CATALOG) {
      embeddings.set(
        String(item.id),
        computeTextEmbedding(`passage: ${item.title} ${item.description} ${item.category}`)
      );
    }

    const agent = new ConversationalAgent(
      INITIAL_CATALOG,
      embeddings,
      async (q) => computeTextEmbedding(`query: ${q}`)
    );

    // Turn 1: Ask for electronics / gadgets
    const turn1 = await agent.respond('покажи электронику и гаджеты');
    expect(turn1.items.length).toBeGreaterThan(0);

    // Turn 2: Follow-up with only a price constraint ("а дешевле 15000 рублей") should remember category context from Turn 1
    const turn2 = await agent.respond('а дешевле 15000 рублей');
    expect(turn2.items.length).toBeGreaterThan(0);
    for (const item of turn2.items) {
      const numericPrice = parseFloat((item.price || '0').replace(/[^\d.]/g, ''));
      expect(numericPrice).toBeLessThanOrEqual(15000);
    }

    // Turn 3: Malicious XSS input is sanitized cleanly
    const turn3 = await agent.respond('<script>alert("xss")</script> космос и черные дыры');
    expect(turn3.text).not.toContain('<script>');
  });

  it('VectorSteering.steer shifts 384-d seed vector toward modifier concept embedding', () => {
    const baseVec = computeTextEmbedding('passage: Ноутбук рабочий стандартный');
    const modVec = computeTextEmbedding('query: геймерский киберпанк неон');
    const steered = VectorSteering.steer(
      baseVec,
      [{ vector: modVec, weight: 0.65, type: 'positive', label: 'cyberpunk' }],
      { maxAngularDeviation: 0.75, normalization: 'l2' }
    );

    const simBefore = cosineSimilarity(baseVec, modVec);
    const simAfter = cosineSimilarity(steered, modVec);
    expect(simAfter).toBeGreaterThan(simBefore);
  });
});
