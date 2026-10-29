import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  IntentDictionary,
  intentDictionary,
  IntentPattern,
} from '../../../apps/api/src/services/intent-dictionary';
import { buildServer } from '../../../apps/api/src/server';

describe('Phase 1: IntentDictionary (Singleton) — 6 Core Unit Tests', () => {
  it('1. Simple category extraction & $1 capture group resolution (fixes literal "$1" bug)', () => {
    const resRu = intentDictionary.extractIntent('купить наушники');
    expect(resRu.category).toBe('наушники');
    expect(resRu.category).not.toBe('$1');
    expect(resRu.categories).toContain('наушники');
    expect(resRu.confidence).toBeGreaterThan(0);

    const resEn = intentDictionary.extractIntent('wireless headphones');
    expect(resEn.category).toBe('headphones');
    expect(resEn.category).not.toBe('$1');
  });

  it('2. UseCase extraction in Russian and English ("для бега", "for running")', () => {
    const resRu = intentDictionary.extractIntent('наушники для бега');
    expect(resRu.category).toBe('наушники');
    expect(resRu.useCase).toBe('бег');
    expect(resRu.useCases).toContain('бег');

    const resEn = intentDictionary.extractIntent('laptop for coding');
    expect(resEn.category).toBe('laptops');
    expect(resEn.useCase).toBe('coding');
  });

  it('3. PriceRange extraction (qualitative "недорогие" -> {max: 5000} and explicit numeric bounds)', () => {
    const resBudget = intentDictionary.extractIntent('недорогие наушники для бега');
    expect(resBudget.category).toBe('наушники');
    expect(resBudget.useCase).toBe('бег');
    expect(resBudget.priceRange).toEqual({ max: 5000 });
    expect(resBudget.explanation).toContain('category="наушники"');

    const resRange = intentDictionary.extractIntent('смартфон от 15000 до 35000');
    expect(resRange.category).toBe('смартфоны');
    expect(resRange.priceRange).toEqual({ min: 15000, max: 35000 });
  });

  it('4. Synonyms normalization (slang and inflections map to canonical category & useCase)', () => {
    const resSlang1 = intentDictionary.extractIntent('бюджетные уши для тренировок');
    expect(resSlang1.category).toBe('наушники');
    expect(resSlang1.useCase).toBe('спорт');
    expect(resSlang1.priceRange).toEqual({ max: 5000 });

    const resSlang2 = intentDictionary.extractIntent('мощный лэптоп для кодинга');
    expect(resSlang2.category).toBe('ноутбуки');
    expect(resSlang2.useCase).toBe('программирование');
  });

  it('5. Empty and whitespace-only query handling', () => {
    const emptyRes = intentDictionary.extractIntent('   ');
    expect(emptyRes.confidence).toBe(0);
    expect(emptyRes.category).toBeUndefined();
    expect(emptyRes.useCase).toBeUndefined();
    expect(emptyRes.priceRange).toBeUndefined();
    expect(emptyRes.matchedPatterns).toEqual([]);
    expect(emptyRes.explanation).toContain('Empty query');
  });

  it('6. Pattern priorities (higher priority explicit price & compound pattern overrides lower priority)', () => {
    const resPriority = intentDictionary.extractIntent('недорогие наушники до 3000');
    expect(resPriority.category).toBe('наушники');
    // Explicit "до 3000" (priority 95) must win over qualitative "недорогие" (priority 65 -> max: 5000)
    expect(resPriority.priceRange).toEqual({ max: 3000 });

    const customPatterns: IntentPattern[] = [
      {
        id: 'low_prio',
        regex: /(наушники)/i,
        priority: 10,
        confidenceBoost: 0.2,
        category: ['аудио-общее'],
        description: 'Low priority fallback',
      },
      {
        id: 'high_prio',
        regex: /(наушники)/i,
        priority: 90,
        confidenceBoost: 0.5,
        category: ['$1'],
        description: 'High priority exact $1 capture',
      },
    ];
    const customDict = new IntentDictionary(customPatterns);
    const customRes = customDict.extractIntent('наушники');
    expect(customRes.category).toBe('наушники');
  });
});

describe('Phase 1 Regression: /v1/search with EIDOS_FEATURE_INTENT_AWARE_SEARCH', () => {
  let app: FastifyInstance;
  const originalFlag = process.env.EIDOS_FEATURE_INTENT_AWARE_SEARCH;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (originalFlag === undefined) {
      delete process.env.EIDOS_FEATURE_INTENT_AWARE_SEARCH;
    } else {
      process.env.EIDOS_FEATURE_INTENT_AWARE_SEARCH = originalFlag;
    }
    await app.close();
  });

  it('preserves results, latencyMs, results[0].explanation and omits extractedIntent when flag is OFF', async () => {
    delete process.env.EIDOS_FEATURE_INTENT_AWARE_SEARCH;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'eidos_dev_key',
      },
      payload: {
        query: 'недорогие наушники для бега',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
    expect(typeof body.latencyMs).toBe('number');
    expect(body.results[0].explanation).toBeDefined();
    expect(typeof body.results[0].explanation.denseComponent).toBe('number');
    expect(body.extractedIntent).toBeUndefined();
  });

  it('returns extractedIntent alongside intact results, latencyMs, and explanation when flag is ON', async () => {
    process.env.EIDOS_FEATURE_INTENT_AWARE_SEARCH = 'true';

    const res = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'eidos_dev_key',
      },
      payload: {
        query: 'недорогие наушники для бега',
        limit: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
    expect(typeof body.latencyMs).toBe('number');
    expect(body.results[0].explanation).toBeDefined();
    expect(body.extractedIntent).toBeDefined();
    expect(body.extractedIntent.category).toBe('наушники');
    expect(body.extractedIntent.useCase).toBe('бег');
    expect(body.extractedIntent.priceRange).toEqual({ max: 5000 });
  });
});
