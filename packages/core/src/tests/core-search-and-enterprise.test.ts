import { describe, it, expect } from 'vitest';
import {
  normalizeQueryWithLayoutRecovery,
  buildDynamicCategoryFamiliesFromCatalog,
  extractHeadCategoryIntent,
  evaluateCandidateCategoryGate,
  evaluateCandidateGuardrail,
  calibrateScorePercent,
  buildHumanExplanation,
  validateAndResolveFieldBoosts,
  validateAndResolveFieldImportance,
  validateAndResolveRankWindow,
  validateAndResolveChannelWindows,
  validateAndResolveFusionMode,
  validateAndResolveRankConstant,
  resolveWeightedRrfWeights,
  computeWeightedRrfBreakdown,
  computeLinearFusionBreakdown,
  normalizeSearchFilters,
  matchesStructuredFilters,
  scoreMultiFieldLexicalDocument,
  validateAndNormalizeConstraints,
  classifyQueryShape,
  applyQueryShapeBias,
  buildHitHighlights,
  validateFacetsRequest,
  computeFacetCounts,
  LRUQueryCache,
  CircuitBreaker,
  SequentialRecommender,
  XaiExplainer,
  QueryParser,
  SpladeLite,
} from '../index';

describe('@eidos/core Search, Guardrails, Cache & Enterprise Modules', () => {
  it('normalizes keyboard layout, recovers typos, and extracts head category intent with dynamic catalog families', () => {
    const layoutInfo = normalizeQueryWithLayoutRecovery('yfeiybrb для бега до 15000');
    expect(layoutInfo.layoutRecovered).toBe(true);
    expect(layoutInfo.normalizedQuery).toContain('наушники');
    expect(layoutInfo.headTokens).toContain('наушники');
    expect(layoutInfo.modifierTokens).toContain('бега');

    const dynamicFamilies = buildDynamicCategoryFamiliesFromCatalog([
      { category: 'Смартфоны и гаджеты', title: 'Смартфон Realme', tags: ['смартфон'] },
      { category: 'Детские товары', title: 'Конструктор LEGO', tags: ['конструктор'] },
      { category: 'Бытовая техника', title: 'Кофемашина DeLonghi', tags: ['кофемашина'] },
      { category: 'Сварочные инверторы', title: 'Инвертор Ресанта', tags: ['сварка'] },
    ]);
    expect(dynamicFamilies.length).toBeGreaterThan(0);

    const smartphoneIntent = extractHeadCategoryIntent('детский смартфон до 15000', dynamicFamilies);
    expect(smartphoneIntent.hasHeadCategoryIntent).toBe(true);
    expect(smartphoneIntent.familyId).toBe('smartphones');
    expect(smartphoneIntent.maxPrice).toBe(15000);

    const invertedIntent = extractHeadCategoryIntent('для бега наушники', dynamicFamilies);
    expect(invertedIntent.hasHeadCategoryIntent).toBe(true);
    expect(invertedIntent.familyId).toBe('headphones');

    const customDynIntent = extractHeadCategoryIntent('сварочный инвертор от 5000', dynamicFamilies);
    expect(customDynIntent.hasHeadCategoryIntent).toBe(true);
    expect(customDynIntent.minPrice).toBe(5000);

    const noIntent = extractHeadCategoryIntent('подарок коллеге', dynamicFamilies);
    expect(noIntent.hasHeadCategoryIntent).toBe(false);
  });

  it('evaluates category gate, candidate guardrails, scorePercent calibration, and human explanations', () => {
    const qInfo = normalizeQueryWithLayoutRecovery('недорогие наушники для бега');
    const headIntent = extractHeadCategoryIntent('недорогие наушники для бега');

    const headphoneItem = {
      id: 'h1',
      sku: 'SKU-H1',
      brand: 'Shokz',
      title: 'Спортивные наушники для бега Shokz OpenRun',
      category: 'Наушники и аудио',
      tags: ['наушники', 'бег'],
      description: 'Костная проводимость для марафона',
    };
    const sneakerItem = {
      id: 's1',
      sku: 'SKU-S1',
      brand: 'Asics',
      title: 'Беговые кроссовки для бега Asics Gel',
      category: 'Обувь и кроссовки',
      tags: ['кроссовки', 'бег'],
      description: 'Амортизация для асфальта',
    };

    const gateHeadphone = evaluateCandidateCategoryGate(headIntent, headphoneItem, 'hard');
    expect(gateHeadphone.matchesHeadCategory).toBe(true);
    expect(gateHeadphone.passesHardGate).toBe(true);

    const gateSneaker = evaluateCandidateCategoryGate(headIntent, sneakerItem, 'hard');
    expect(gateSneaker.conflictsWithHeadCategory).toBe(true);
    expect(gateSneaker.passesHardGate).toBe(false);

    const guardHeadphone = evaluateCandidateGuardrail(qInfo, headphoneItem, 0.75, 8.5, true);
    expect(guardHeadphone.passesLexicalGate).toBe(true);
    expect(guardHeadphone.headNounMatchCount).toBeGreaterThan(0);

    const gibberishInfo = normalizeQueryWithLayoutRecovery('zzzz_garbage_999');
    const guardGibberish = evaluateCandidateGuardrail(gibberishInfo, headphoneItem, 0.2, 0, true);
    expect(guardGibberish.passesLexicalGate).toBe(false);

    expect(
      calibrateScorePercent({
        rawScore: 0.03,
        maxRawScore: 0.03,
        denseScore: 0.8,
        sparseScore: 10,
        titleMatchCount: 2,
        categoryOrTagMatchCount: 1,
        rankIndex: 0,
      })
    ).toBeGreaterThanOrEqual(80);
    expect(
      calibrateScorePercent({
        rawScore: 0,
        maxRawScore: 0,
        denseScore: 0,
        sparseScore: 0,
        titleMatchCount: 0,
        categoryOrTagMatchCount: 0,
        rankIndex: 0,
      })
    ).toBe(0);

    const expLex = buildHumanExplanation({
      category: 'Наушники',
      scorePercent: 92,
      denseScore: 0,
      sparseScore: 12,
      matchedTokens: ['наушники'],
      alpha: 0,
      rewrittenFrom: 'yfeiybrb',
      rewrittenTo: 'наушники',
      dominantLexicalField: 'title',
    });
    expect(expLex.ru).toContain('Точное совпадение слов');

    const expDense = buildHumanExplanation({
      category: 'Наушники',
      scorePercent: 85,
      denseScore: 0.82,
      sparseScore: 0,
      alpha: 1,
    });
    expect(expDense.ru).toContain('Близость по смыслу');

    const expHybrid = buildHumanExplanation({
      category: 'Наушники',
      scorePercent: 90,
      denseScore: 0.75,
      sparseScore: 9.2,
      titleMatchCount: 1,
      matchedTokens: ['наушники', 'бег'],
      matchesHeadCategory: true,
      alpha: 0.5,
      dominantLexicalField: 'sku',
    });
    expect(expHybrid.ru).toContain('Совпадение по смыслу и словам');
  });

  it('validates and executes retrieval-p1 controls (fieldBoosts, windows, fusion, filters, highlights, facets)', () => {
    expect(validateAndResolveFieldBoosts({ title: 4, sku: 8 }).valid).toBe(true);
    expect(validateAndResolveFieldBoosts({ unknownField: 1 }).valid).toBe(false);
    expect(validateAndResolveFieldImportance({ title: -1 }).valid).toBe(false);
    expect(validateAndResolveFieldBoosts([] as unknown as Record<string, unknown>).valid).toBe(false);

    expect(validateAndResolveRankWindow({ lexical: 80, dense: 100 }).valid).toBe(true);
    expect(validateAndResolveChannelWindows({ lexical: 500 }).valid).toBe(false);
    expect(validateAndResolveRankWindow({ extra: 10 }).valid).toBe(false);

    expect(validateAndResolveFusionMode('rrf').valid).toBe(true);
    expect(validateAndResolveFusionMode('linear').valid).toBe(true);
    expect(validateAndResolveFusionMode('invalid').valid).toBe(false);

    expect(validateAndResolveRankConstant(40).valid).toBe(true);
    expect(validateAndResolveRankConstant(-5).valid).toBe(false);

    const rrfWeights = resolveWeightedRrfWeights({
      weights: { lexical: 0.6, dense: 0.4 },
      mode: 'hybrid',
    });
    expect(rrfWeights.lexicalWeight).toBeCloseTo(0.6);
    expect(rrfWeights.denseWeight).toBeCloseTo(0.4);

    const rrfBreak = computeWeightedRrfBreakdown({
      k: 60,
      lexicalRank: 1,
      denseRank: 2,
      lexicalWeight: 0.6,
      denseWeight: 0.4,
    });
    expect(rrfBreak.fusedScore).toBeCloseTo(0.6 / 61 + 0.4 / 62, 6);

    const linBreak = computeLinearFusionBreakdown({
      lexicalRank: 1,
      denseRank: 1,
      normalizedLexicalScore: 1,
      normalizedDenseScore: 0.5,
      lexicalWeight: 0.5,
      denseWeight: 0.5,
    });
    expect(linBreak.fusedScore).toBeCloseTo(0.75, 5);

    const constraintsRes = validateAndNormalizeConstraints(
      { category: ['Наушники'], brand: 'Sony', priceMin: 1000, priceMax: 25000, inStock: true },
      undefined
    );
    expect(constraintsRes.valid).toBe(true);
    expect(
      validateAndNormalizeConstraints({ priceMin: 5000, priceMax: 1000 }).valid
    ).toBe(false);
    expect(validateAndNormalizeConstraints({ badKey: 1 }).valid).toBe(false);

    const sampleItem = {
      id: 'item-1',
      sku: 'BOS-1001',
      brand: 'Sony',
      title: 'Беспроводные наушники Sony WH-1000XM5 <script>',
      description: 'Флагманские наушники с активным шумоподавлением',
      category: 'Наушники и аудио',
      price: 19990,
      inStock: true,
      stock: 5,
    };
    expect(matchesStructuredFilters(sampleItem, constraintsRes.value, true)).toBe(true);
    expect(
      matchesStructuredFilters(sampleItem, normalizeSearchFilters({ excludeIds: ['item-1'] }), true)
    ).toBe(false);

    const lexDoc = scoreMultiFieldLexicalDocument({
      query: 'BOS-1001 наушники sony',
      item: sampleItem,
      fieldBoosts: { title: 3, sku: 5, brand: 2, category: 1.5, description: 1 },
    });
    expect(lexDoc.totalScore).toBeGreaterThan(0);
    expect(lexDoc.dominantField).toBe('sku');

    expect(classifyQueryShape('BOS-1001')).toBe('sku_like');
    expect(classifyQueryShape('наушники sony')).toBe('short');
    expect(classifyQueryShape('недорогие беспроводные наушники для бега')).toBe('natural');

    const biased = applyQueryShapeBias({ lexical: 0.5, semantic: 0.5, queryShape: 'sku_like' });
    expect(biased.lexical).toBeGreaterThan(0.5);

    const hl = buildHitHighlights({
      normalizedQuery: 'наушники bos-1001',
      title: sampleItem.title,
      sku: sampleItem.sku,
    });
    expect(hl.title).toContain('<em>наушники</em>');
    expect(hl.title).not.toContain('<script>');
    expect(hl.sku).toContain('<em>BOS-1001</em>');

    expect(validateFacetsRequest(['brand', 'category']).valid).toBe(true);
    expect(validateFacetsRequest(['invalid']).valid).toBe(false);
    const facets = computeFacetCounts([sampleItem], ['brand', 'category']);
    expect(facets?.brand?.[0]).toEqual({ value: 'Sony', count: 1 });
  });

  it('exercises LRUQueryCache, CircuitBreaker, SequentialRecommender, XaiExplainer, QueryParser, and SpladeLite', async () => {
    expect(() => new LRUQueryCache(0)).toThrow();
    const cache = new LRUQueryCache<number>(2, 5000);
    expect(cache.stats().hitRate).toBe(0);
    cache.set('q:1', 10);
    cache.set('q:1', 15); // overwrite existing key
    cache.set('q:2', 20);
    expect(cache.get('q:1')).toBe(15);
    cache.set('q:3', 30); // evicts q:2
    expect(cache.get('q:2')).toBeUndefined();
    expect(cache.stats().evictions).toBe(1);
    cache.set('exp:1', 99, -10); // already expired
    expect(cache.get('exp:1')).toBeUndefined();
    expect(cache.invalidatePrefix('q:')).toBe(1);
    cache.clear();

    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 5, halfOpenMaxSuccesses: 1 });
    await expect(cb.execute(async () => 'ok')).resolves.toBe('ok');
    await expect(cb.execute(async () => { throw new Error('fail 1'); }, () => 'fb1')).resolves.toBe('fb1');
    await expect(cb.execute(async () => { throw new Error('fail 2'); })).rejects.toThrow('fail 2');
    expect(cb.getState()).toBe('OPEN');
    await expect(cb.execute(async () => 'blocked', () => 'open-fb')).resolves.toBe('open-fb');
    await expect(cb.execute(async () => 'blocked')).rejects.toThrow('CircuitBreaker is OPEN');
    await new Promise((r) => setTimeout(r, 10));
    expect(cb.getState()).toBe('HALF_OPEN');
    await expect(cb.execute(async () => 'recovered')).resolves.toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');
    cb.reset();
    expect(cb.getState()).toBe('CLOSED');

    const seq = new SequentialRecommender();
    expect(seq.computeSessionVector('empty', new Map())).toBeNull();
    for (let i = 0; i < 22; i++) {
      seq.recordInteraction('sess-1', `i${i}`);
    }
    const embMap = new Map<string, Float32Array>([
      ['i20', new Float32Array([1, 0, 0])],
      ['i21', new Float32Array([0, 1, 0])],
    ]);
    const sessionVec = seq.computeSessionVector('sess-1', embMap);
    expect(sessionVec).not.toBeNull();
    expect(sessionVec!.length).toBe(3);

    const xai = new XaiExplainer();
    expect(xai.explain('наушники sony', 'Наушники Sony', 0.4, 0.9, 0.2).primaryDriver).toBe('lexical');
    expect(xai.explain('наушники', 'Гарнитура', 0.8, 0.1, 0.1, 0.75, 0).primaryDriver).toBe('serendipity');
    expect(xai.explain('наушники', 'Гарнитура', 0.5, 0.1, 0.1, 0, 0.15).primaryDriver).toBe('kinetic');
    expect(xai.explain('наушники', 'Гарнитура', 0.9, 0.1, 0.1).primaryDriver).toBe('semantic');
    expect(xai.explain('наушники', 'Гарнитура', 0.2, 0.1, 0.95).primaryDriver).toBe('popularity');

    const parser = new QueryParser();
    const parsed = parser.parse('cheap audio headphones under $150 over $20');
    expect(parsed.intent).toBe('cheap');
    expect(parsed.maxPrice).toBe(150);
    expect(parsed.minPrice).toBe(20);
    expect(parsed.category).toBe('audio');
    expect(parser.parse('pro laptops luxury').intent).toBe('premium');
    expect(parser.parse('wireless noise cancelling headphones black edition').intent).toBe('specific');

    const splade = new SpladeLite();
    const qWeights = splade.encode('cheap laptop');
    const dWeights = splade.encode('affordable notebook computer');
    expect(splade.score(qWeights, dWeights)).toBeGreaterThan(0);
  });
});
