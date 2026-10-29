import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { SearchFunnelService } from '../../../apps/api/src/services/search-funnel';
import { buildServer } from '../../../apps/api/src/server';

describe('Phase 2: SearchFunnelService & /v1/analytics/funnel — 5 Tests + Regression', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. Links purchase and click events to query via sessionId in computeQueryConversions', () => {
    const funnel = new SearchFunnelService();
    funnel.addEvent({ type: 'search', query: 'наушники', sessionId: 's1' });
    funnel.addEvent({ type: 'click', itemId: 'item-1', sessionId: 's1' });
    funnel.addEvent({ type: 'purchase', itemId: 'item-1', sessionId: 's1' });

    const metrics = funnel.getMetrics(24 * 60 * 60 * 1000);
    expect(metrics.totalSearches).toBe(1);
    expect(metrics.totalClicks).toBe(1);
    expect(metrics.totalPurchases).toBe(1);
    expect(metrics.clickThroughRate).toBe(1);
    expect(metrics.conversionRate).toBeGreaterThan(0);
    expect(metrics.topConvertingQueries.length).toBe(1);
    expect(metrics.topConvertingQueries[0].query).toBe('наушники');
    expect(metrics.topConvertingQueries[0].conversionRate).toBe(1);
  });

  it('2. Computes topConvertingQueries and worstConvertingQueries accurately across sessions', () => {
    const funnel = new SearchFunnelService();
    // Converting session
    funnel.addEvent({ type: 'search', query: 'кроссовки', sessionId: 'sess-a' });
    funnel.addEvent({ type: 'purchase', itemId: 'item-2', sessionId: 'sess-a' });

    // Non-converting session
    funnel.addEvent({ type: 'search', query: 'редкий запрос', sessionId: 'sess-b' });
    funnel.addEvent({ type: 'search', query: 'редкий запрос', sessionId: 'sess-c' });

    const metrics = funnel.getMetrics(24 * 60 * 60 * 1000);
    expect(metrics.totalSearches).toBe(3);
    expect(metrics.totalPurchases).toBe(1);
    expect(metrics.topConvertingQueries[0].query).toBe('кроссовки');
    expect(metrics.worstConvertingQueries[0].query).toBe('редкий запрос');
    expect(metrics.worstConvertingQueries[0].conversionRate).toBe(0);
  });

  it('3. Enforces MAX_EVENTS = 10000 ring buffer limit in memory', () => {
    const smallFunnel = new SearchFunnelService(50);
    for (let i = 0; i < 75; i++) {
      smallFunnel.addEvent({
        type: 'search',
        query: `q-${i}`,
        sessionId: `s-${i}`,
      });
    }
    expect(smallFunnel.getEventCount()).toBe(50);
    expect(SearchFunnelService.MAX_EVENTS).toBe(10_000);
  });

  it('4. Exposes fastify.funnelService decorator and /v1/analytics/funnel endpoints', async () => {
    expect(app.funnelService).toBeInstanceOf(SearchFunnelService);
    app.funnelService.clear();

    const searchEv = await app.inject({
      method: 'POST',
      url: '/v1/analytics/funnel/event',
      headers: { 'content-type': 'application/json' },
      payload: { type: 'search', query: 'наушники', sessionId: 's1' },
    });
    expect(searchEv.statusCode).toBe(200);

    const purchaseEv = await app.inject({
      method: 'POST',
      url: '/v1/analytics/funnel/event',
      headers: { 'content-type': 'application/json' },
      payload: { type: 'purchase', itemId: 'item-1', sessionId: 's1' },
    });
    expect(purchaseEv.statusCode).toBe(200);

    const funnelRes = await app.inject({
      method: 'GET',
      url: '/v1/analytics/funnel?period=24h',
    });
    expect(funnelRes.statusCode).toBe(200);
    const body = funnelRes.json();
    expect(body.metrics.conversionRate).toBeGreaterThan(0);
    expect(body.metrics.topConvertingQueries[0].query).toBe('наушники');
  });

  it('5. Regression: /v1/search and /v1/feedback preserve all existing response fields while feeding funnel', async () => {
    app.funnelService.clear();
    await app.inject({ method: 'POST', url: '/v1/demo/load' });

    const sRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'eidos_dev_key',
      },
      payload: {
        query: 'Беспроводные наушники SoundMax ANC',
        limit: 5,
        sessionId: 'reg-session-1',
      },
    });
    expect(sRes.statusCode).toBe(200);
    const sBody = sRes.json();
    expect(Array.isArray(sBody.results)).toBe(true);
    expect(typeof sBody.latencyMs).toBe('number');
    expect(sBody.results[0].explanation).toBeDefined();

    const fRes = await app.inject({
      method: 'POST',
      url: '/v1/feedback',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'eidos_dev_key',
      },
      payload: {
        userId: 'user-1',
        itemId: sBody.results[0].id,
        eventType: 'purchase',
        context: { sessionId: 'reg-session-1' },
      },
    });
    expect(fRes.statusCode).toBe(200);
    const fBody = fRes.json();
    expect(fBody.ok).toBe(true);
    expect(fBody.accepted).toBe(true);
    expect(fBody.stats).toBeDefined();

    const metrics = app.funnelService.getMetrics(24 * 60 * 60 * 1000);
    expect(metrics.totalSearches).toBeGreaterThanOrEqual(1);
    expect(metrics.totalPurchases).toBeGreaterThanOrEqual(1);
    expect(metrics.conversionRate).toBeGreaterThan(0);
  });
});
