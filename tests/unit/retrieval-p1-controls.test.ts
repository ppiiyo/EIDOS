import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../../apps/api/src/server';
import { AdminConsoleStore } from '../../apps/api/src/services/admin-console-store';
import {
  DEFAULT_FIELD_BOOSTS,
  DEFAULT_RANK_CONSTANT,
  DEFAULT_RANK_WINDOW,
  computeWeightedRrfBreakdown,
  buildHitHighlights,
} from '@eidos/core';

describe('EIDOS Engine P1 — High-ROI Retrieval Controls (PR1–PR5 & Golden G1–G6 + F1/F2/R1)', () => {
  let app: FastifyInstance;
  const ADMIN_KEY = 'eidos_admin_master_spec_key_2026_secure';
  const PUBLIC_KEY = 'eidos_search_public_spec_key_2026_pub';

  beforeAll(async () => {
    process.env.EIDOS_ADMIN_KEY = ADMIN_KEY;
    process.env.EIDOS_MASTER_KEY = ADMIN_KEY;
    process.env.EIDOS_SEARCH_KEY = PUBLIC_KEY;
    app = await buildServer();
    await app.ready();
    const loadRes = await app.inject({
      method: 'POST',
      url: '/v1/demo/load',
      payload: {},
    });
    expect(loadRes.statusCode).toBe(200);
  }, 60_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('PR1 — Field Boosts (fieldBoosts) & X-Ray Honesty', () => {
    it('ranks SKU/title match above description-only match with default fieldBoosts, and flips when description boost is raised', async () => {
      const authHeaders = {
        'x-api-key': ADMIN_KEY,
      };

      const upsertRes = await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: authHeaders,
        payload: {
          items: [
            {
              id: 'item-desc-only',
              sku: 'GEN-001',
              brand: 'GenericBrand',
              title: 'Универсальный сетевой адаптер питания',
              category: 'Аксессуары и кабели',
              description: 'Подходит для студийного оборудования, кодовое слово: КВАЗАР777.',
              price: 1500,
              inStock: true,
            },
            {
              id: 'item-title-match',
              sku: 'GEN-002',
              brand: 'GenericBrand',
              title: 'Адаптер КВАЗАР777 сетевой',
              category: 'Аксессуары и кабели',
              description: 'Стандартный блок питания для дома и офиса.',
              price: 1500,
              inStock: true,
            },
            {
              id: 'item-sku-match',
              sku: 'КВАЗАР777',
              brand: 'GenericBrand',
              title: 'Сетевой блок питания',
              category: 'Аксессуары и кабели',
              description: 'Стандартный блок питания для дома и офиса.',
              price: 1500,
              inStock: true,
            },
          ],
        },
      });
      expect(upsertRes.statusCode).toBe(200);

      // 1. Default fieldBoosts (sku: 5, title: 3, description: 1) in lexical/hybrid search
      const defaultRes = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: authHeaders,
        payload: {
          query: 'КВАЗАР777',
          weights: { lexical: 1, dense: 0 },
          filters: { ids: ['item-desc-only', 'item-title-match', 'item-sku-match'] },
          includeXRay: true,
        },
      });
      expect(defaultRes.statusCode).toBe(200);
      const defaultBody = defaultRes.json();
      expect(defaultBody.results.length).toBe(3);
      expect(defaultBody.results[0].id).toBe('item-sku-match');
      expect(defaultBody.results[1].id).toBe('item-title-match');
      expect(defaultBody.results[2].id).toBe('item-desc-only');

      // Verify X-Ray lexicalFieldContributions & humanExplanation
      const topHit = defaultBody.results[0];
      expect(Array.isArray(topHit.explanation.lexicalFieldContributions)).toBe(true);
      const skuContrib = topHit.explanation.lexicalFieldContributions.find(
        (c: { field: string }) => c.field === 'sku'
      );
      expect(skuContrib).toBeDefined();
      expect(skuContrib.boost).toBe(DEFAULT_FIELD_BOOSTS.sku);
      expect(skuContrib.contribution).toBeGreaterThan(0);
      expect(topHit.humanExplanation.ru).toContain('Сильное совпадение по артикулу/названию');

      // 2. Flip ranking with fieldBoosts: { description: 15, title: 1, sku: 0.5 }
      const flippedRes = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: authHeaders,
        payload: {
          query: 'КВАЗАР777',
          weights: { lexical: 1, dense: 0 },
          filters: { ids: ['item-desc-only', 'item-title-match', 'item-sku-match'] },
          fieldBoosts: { description: 15, title: 1, sku: 0.5 },
        },
      });
      expect(flippedRes.statusCode).toBe(200);
      const flippedBody = flippedRes.json();
      expect(flippedBody.results[0].id).toBe('item-desc-only');

      // 3. Disable description field via fieldBoosts: { description: 0 }
      const zeroDescRes = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: authHeaders,
        payload: {
          query: 'КВАЗАР777',
          weights: { lexical: 1, dense: 0 },
          filters: { ids: ['item-desc-only', 'item-title-match', 'item-sku-match'] },
          fieldBoosts: { description: 0 },
        },
      });
      expect(zeroDescRes.statusCode).toBe(200);
      const zeroDescBody = zeroDescRes.json();
      const descOnlyHit = zeroDescBody.results.find(
        (r: { id: string }) => r.id === 'item-desc-only'
      );
      expect(descOnlyHit).toBeUndefined();
    });

    it('returns 400 INVALID_FIELD_BOOSTS on negative, NaN, or unknown field names', async () => {
      const negRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          fieldBoosts: { title: -2 },
        },
      });
      expect(negRes.statusCode).toBe(400);
      expect(negRes.json().code).toBe('INVALID_FIELD_BOOSTS');

      const unknownFieldRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          fieldBoosts: { title: 3, unknownField: 5 },
        },
      });
      expect(unknownFieldRes.statusCode).toBe(400);
      expect(unknownFieldRes.json().code).toBe('INVALID_FIELD_BOOSTS');
    });
  });

  describe('PR2 — Rank Window (rankWindow)', () => {
    it('truncates per-channel candidate lists before RRF according to rankWindow', async () => {
      // With rankWindow: { lexical: 5, dense: 5 }, no hit can have lexicalRank > 5 or denseRank > 5
      const smallWinRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          limit: 20,
          rankWindow: { lexical: 5, dense: 5 },
        },
      });
      expect(smallWinRes.statusCode).toBe(200);
      const smallWinBody = smallWinRes.json();
      expect(smallWinBody.results.length).toBeGreaterThan(0);
      for (const hit of smallWinBody.results) {
        if (hit.rrf.lexicalRank !== null) {
          expect(hit.rrf.lexicalRank).toBeLessThanOrEqual(5);
        }
        if (hit.rrf.denseRank !== null) {
          expect(hit.rrf.denseRank).toBeLessThanOrEqual(5);
        }
      }

      // Candidate at lexicalRank 8..15 is present when rankWindow: { lexical: 20, dense: 20 } (pure lexical)
      // and excluded when rankWindow: { lexical: 5, dense: 5 }
      const win20Res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          limit: 20,
          weights: { lexical: 1, dense: 0 },
          rankWindow: { lexical: 20, dense: 20 },
        },
      });
      const win5Res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          limit: 20,
          weights: { lexical: 1, dense: 0 },
          rankWindow: { lexical: 5, dense: 5 },
        },
      });
      expect(win20Res.json().results.length).toBeGreaterThan(5);
      expect(win5Res.json().results.length).toBeLessThanOrEqual(5);
    });

    it('returns 400 INVALID_RANK_WINDOW when lexical or dense window is <= 0 or > 200', async () => {
      const zeroWinRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          rankWindow: { lexical: 0, dense: 50 },
        },
      });
      expect(zeroWinRes.statusCode).toBe(400);
      expect(zeroWinRes.json().code).toBe('INVALID_RANK_WINDOW');

      const hugeWinRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          rankWindow: { lexical: 50, dense: 250 },
        },
      });
      expect(hugeWinRes.statusCode).toBe(400);
      expect(hugeWinRes.json().code).toBe('INVALID_RANK_WINDOW');
    });
  });

  describe('PR3 — Formalized Weighted RRF (rankConstant, weights, hit.rrf) & R1', () => {
    it('R1: fusedScore equals lexicalContribution + denseContribution within 1e-6 for every hit', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'моторное масло 5w-40',
          limit: 10,
          weights: { lexical: 0.65, dense: 0.35 },
          rankConstant: 40,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.results.length).toBeGreaterThan(0);

      for (const hit of body.results) {
        expect(hit.rrf).toBeDefined();
        expect(hit.rrf.k).toBe(40);
        expect(hit.rrf.lexicalWeight).toBeCloseTo(0.65, 4);
        expect(hit.rrf.denseWeight).toBeCloseTo(0.35, 4);

        const expectedLex =
          hit.rrf.lexicalRank !== null ? 0.65 * (1 / (40 + hit.rrf.lexicalRank)) : 0;
        const expectedDense =
          hit.rrf.denseRank !== null ? 0.35 * (1 / (40 + hit.rrf.denseRank)) : 0;

        expect(Math.abs(hit.rrf.lexicalContribution - expectedLex)).toBeLessThan(1e-5);
        expect(Math.abs(hit.rrf.denseContribution - expectedDense)).toBeLessThan(1e-5);
        expect(
          Math.abs(
            hit.rrf.fusedScore - (hit.rrf.lexicalContribution + hit.rrf.denseContribution)
          )
        ).toBeLessThan(1e-6);
      }
    });

    it('matches pure lexical rank order when w_lexical=1, w_dense=0 and pure dense rank order when w_lexical=0, w_dense=1', async () => {
      const lexRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'перфоратор',
          limit: 10,
          weights: { lexical: 1, dense: 0 },
        },
      });
      expect(lexRes.statusCode).toBe(200);
      const lexHits = lexRes.json().results;
      expect(lexHits.length).toBeGreaterThan(1);
      for (let i = 1; i < lexHits.length; i++) {
        expect(lexHits[i].rrf.lexicalRank).toBeGreaterThan(lexHits[i - 1].rrf.lexicalRank);
        expect(lexHits[i].rrf.denseContribution).toBe(0);
      }

      const denseRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'перфоратор',
          limit: 10,
          weights: { lexical: 0, dense: 1 },
        },
      });
      expect(denseRes.statusCode).toBe(200);
      const denseHits = denseRes.json().results;
      expect(denseHits.length).toBeGreaterThan(1);
      for (let i = 1; i < denseHits.length; i++) {
        expect(denseHits[i].rrf.denseRank).toBeGreaterThan(denseHits[i - 1].rrf.denseRank);
        expect(denseHits[i].rrf.lexicalContribution).toBe(0);
      }
    });

    it('predictably changes top-1 vs top-10 RRF score spread when rankConstant k changes (20 vs 100)', async () => {
      const k20 = computeWeightedRrfBreakdown({
        k: 20,
        lexicalRank: 1,
        denseRank: 1,
        lexicalWeight: 0.5,
        denseWeight: 0.5,
      });
      const k20Rank10 = computeWeightedRrfBreakdown({
        k: 20,
        lexicalRank: 10,
        denseRank: 10,
        lexicalWeight: 0.5,
        denseWeight: 0.5,
      });
      const k100 = computeWeightedRrfBreakdown({
        k: 100,
        lexicalRank: 1,
        denseRank: 1,
        lexicalWeight: 0.5,
        denseWeight: 0.5,
      });
      const k100Rank10 = computeWeightedRrfBreakdown({
        k: 100,
        lexicalRank: 10,
        denseRank: 10,
        lexicalWeight: 0.5,
        denseWeight: 0.5,
      });

      const spreadK20 = k20.fusedScore - k20Rank10.fusedScore;
      const spreadK100 = k100.fusedScore - k100Rank10.fusedScore;
      expect(spreadK20).toBeGreaterThan(spreadK100 * 3);
    });
  });

  describe('PR4 — Structured Filters (filters) & Category Gate Intersection (F1, F2)', () => {
    it('F1: filters by priceMax and inStock without adding score, and populates meta filter counts', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          limit: 15,
          filters: {
            priceMax: 5000,
            inStock: true,
          },
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.results.length).toBeGreaterThan(0);
      for (const hit of body.results) {
        expect(hit.price).toBeLessThanOrEqual(5000);
        expect(hit.inStock).toBe(true);
      }
      expect(body.meta.filtersApplied).toEqual({
        priceMax: 5000,
        inStock: true,
      });
      expect(body.meta.candidatesBeforeFilter).toBeGreaterThan(body.meta.candidatesAfterFilter);
      expect(body.meta.candidatesAfterFilter).toBeGreaterThan(0);
    });

    it('supports brand array (OR), ids whitelist, excludeIds blacklist, and excludes missing price when priceMax is active', async () => {
      const authHeaders = {
        'x-api-key': ADMIN_KEY,
      };

      await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: authHeaders,
        payload: {
          items: [
            {
              id: 'f-sony',
              sku: 'SNY-1',
              brand: 'Sony',
              title: 'Наушники беспроводные Sony Studio',
              category: 'Наушники и аудио',
              price: 4500,
              inStock: true,
            },
            {
              id: 'f-jbl',
              sku: 'JBL-1',
              brand: 'JBL',
              title: 'Наушники беспроводные JBL PureBass',
              category: 'Наушники и аудио',
              price: 3500,
              inStock: true,
            },
            {
              id: 'f-noprice',
              sku: 'NP-1',
              brand: 'Sony',
              title: 'Наушники беспроводные Sony Concept',
              category: 'Наушники и аудио',
              inStock: true,
            },
          ],
        },
      });

      // Brand OR filter + ids + excludeIds + priceMax excludes f-noprice (missing price)
      const res = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: authHeaders,
        payload: {
          query: 'наушники',
          filters: {
            ids: ['f-sony', 'f-jbl', 'f-noprice'],
            brand: ['Sony', 'JBL'],
            priceMax: 5000,
            excludeIds: ['f-jbl'],
          },
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.results.map((r: { id: string }) => r.id)).toEqual(['f-sony']);
    });

    it('F2: returns 0 results when query head-category ("наушники") conflicts with filters.category ("Обувь и кроссовки") under hard gate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          simpleCategoryGate: 'hard',
          filters: {
            category: 'Обувь и кроссовки',
          },
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.count).toBe(0);
      expect(body.results).toEqual([]);
      expect(body.meta.candidatesAfterFilter).toBeGreaterThan(0);
    });
  });

  describe('PR5 — Admin Ranking Defaults & /v1/search ≡ /v1/suggest Parity', () => {
    it('supports GET and PUT /v1/admin/ranking-defaults with P1 retrieval fields and enforces RBAC', async () => {
      const unauthRes = await app.inject({
        method: 'PUT',
        url: '/v1/admin/ranking-defaults',
        headers: { 'x-api-key': PUBLIC_KEY },
        payload: { rankConstant: 50 },
      });
      expect([401, 403]).toContain(unauthRes.statusCode);

      const getRes = await app.inject({
        method: 'GET',
        url: '/v1/admin/ranking-defaults',
        headers: { 'x-api-key': ADMIN_KEY },
      });
      expect(getRes.statusCode).toBe(200);
      const initialDefaults = getRes.json();
      expect(initialDefaults.fieldBoosts).toEqual(DEFAULT_FIELD_BOOSTS);
      expect(initialDefaults.rankWindow).toEqual(DEFAULT_RANK_WINDOW);
      expect(initialDefaults.rankConstant).toBe(DEFAULT_RANK_CONSTANT);

      const putRes = await app.inject({
        method: 'PUT',
        url: '/v1/admin/ranking-defaults',
        headers: { 'x-api-key': ADMIN_KEY },
        payload: {
          fieldBoosts: { title: 4, sku: 6 },
          rankWindow: { lexical: 40, dense: 40 },
          rankConstant: 50,
        },
      });
      expect(putRes.statusCode).toBe(200);
      const updated = putRes.json();
      expect(updated.fieldBoosts.title).toBe(4);
      expect(updated.fieldBoosts.sku).toBe(6);
      expect(updated.rankWindow).toEqual({ lexical: 40, dense: 40 });
      expect(updated.rankConstant).toBe(50);

      // Reset back to canonical defaults
      await app.inject({
        method: 'PUT',
        url: '/v1/admin/ranking-defaults',
        headers: { 'x-api-key': ADMIN_KEY },
        payload: {
          fieldBoosts: DEFAULT_FIELD_BOOSTS,
          rankWindow: DEFAULT_RANK_WINDOW,
          rankConstant: DEFAULT_RANK_CONSTANT,
          defaultAlpha: 0.5,
          simpleCategoryGate: 'hard',
        },
      });
      AdminConsoleStore.getInstance().updateRankingDefaults('default', {
        fieldBoosts: DEFAULT_FIELD_BOOSTS,
        rankWindow: DEFAULT_RANK_WINDOW,
        rankConstant: DEFAULT_RANK_CONSTANT,
      });
    });

    it('maintains 100% parity between /v1/search and /v1/suggest for identical P1 parameters', async () => {
      const payload = {
        query: 'наушники',
        limit: 5,
        filters: { priceMax: 10000, inStock: true },
        fieldBoosts: { title: 4, sku: 5, brand: 2, category: 1.5, description: 1 },
        rankWindow: { lexical: 30, dense: 30 },
        rankConstant: 45,
      };

      const searchRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload,
      });
      const suggestRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/suggest',
        payload,
      });

      expect(searchRes.statusCode).toBe(200);
      expect(suggestRes.statusCode).toBe(200);

      const searchIds = searchRes.json().results.map((r: { id: string }) => r.id);
      const suggestIds = suggestRes.json().results.map((r: { id: string }) => r.id);
      expect(searchIds.length).toBeGreaterThan(0);
      expect(suggestIds).toEqual(searchIds);
    });
  });

  describe('Golden Queries Regression Gate (G1–G6)', () => {
    it('G1: "недорогие наушники для бега" returns headphones with 0 sneakers in top-5', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: { query: 'недорогие наушники для бега', limit: 5 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.results.length).toBeGreaterThan(0);
      for (const hit of body.results) {
        const cat = String(hit.category).toLowerCase();
        expect(cat.includes('обувь') || cat.includes('кроссовк')).toBe(false);
      }
    });

    it('G2: "детский смартфон до 15000" returns smartphones with price <= 15000 in top-3', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: { query: 'детский смартфон до 15000', limit: 5 },
      });
      expect(res.statusCode).toBe(200);
      const results = res.json().results;
      expect(results.length).toBeGreaterThan(0);
      for (const hit of results.slice(0, 3)) {
        expect(String(hit.category).toLowerCase()).toContain('смартфон');
        expect(hit.price).toBeLessThanOrEqual(15000);
      }
    });

    it('G3: "5W-40" returns 5W-40 motor oil at top-1', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: { query: '5W-40', limit: 5 },
      });
      expect(res.statusCode).toBe(200);
      const top1 = res.json().results[0];
      expect(top1).toBeDefined();
      const text = `${top1.title} ${top1.description} ${top1.category}`.toLowerCase();
      expect(text.includes('5w-40') || text.includes('масл')).toBe(true);
    });

    it('G4: "yfeiybrb" recovers keyboard layout to наушники with non-empty meta.rewrites', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: { query: 'yfeiybrb', limit: 5 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.normalizedQuery).toContain('наушник');
      expect(body.count).toBeGreaterThan(0);
      expect(body.meta.rewrites.length).toBeGreaterThanOrEqual(1);
    });

    it('G5: "перфоратр" recovers typo to перфоратор with non-empty meta.rewrites', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: { query: 'перфоратр', limit: 5 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.count).toBeGreaterThan(0);
      expect(body.rewriteApplied).toBe(true);
      expect(body.meta.rewrites.length).toBeGreaterThanOrEqual(1);
    });

    it('G6: "xyzabcqqq999" and "абракадабра несуществующий товар 99999xyz" return count == 0', async () => {
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/v1/demo/search',
          payload: { query: 'xyzabcqqq999', limit: 5 },
        }),
        app.inject({
          method: 'POST',
          url: '/v1/demo/search',
          payload: { query: 'абракадабра несуществующий товар 99999xyz', limit: 5 },
        }),
      ]);
      expect(res1.statusCode).toBe(200);
      expect(res1.json().count).toBe(0);
      expect(res2.statusCode).toBe(200);
      expect(res2.json().count).toBe(0);
    });
  });

  describe('Retrieval Product Layer v1 — C1, C2, F1, Q1, H1, K1, Linear Fusion & Facets', () => {
    it('C1 & C2: supports constraints with INVALID_CONSTRAINTS validation and candidatesBeforeConstraints/AfterConstraints', async () => {
      const validRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          constraints: { priceMax: 5000, inStock: true },
          limit: 10,
        },
      });
      expect(validRes.statusCode).toBe(200);
      const validBody = validRes.json();
      expect(validBody.results.length).toBeGreaterThan(0);
      expect(validBody.meta.constraintsApplied).toEqual({ priceMax: 5000, inStock: true });
      expect(validBody.meta.candidatesBeforeConstraints).toBeGreaterThan(
        validBody.meta.candidatesAfterConstraints
      );

      // Invalid constraints: priceMin > priceMax -> 400 INVALID_CONSTRAINTS
      const invalidRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          constraints: { priceMin: 9000, priceMax: 2000 },
        },
      });
      expect(invalidRes.statusCode).toBe(400);
      expect(invalidRes.json().code).toBe('INVALID_CONSTRAINTS');
    });

    it('validates fieldImportance (INVALID_FIELD_IMPORTANCE) and channelWindows (INVALID_CHANNEL_WINDOWS)', async () => {
      const badFi = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          fieldImportance: { sku: -1 },
        },
      });
      expect(badFi.statusCode).toBe(400);
      expect(badFi.json().code).toBe('INVALID_FIELD_IMPORTANCE');

      const badCw = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          channelWindows: { lexical: 0, dense: 50 },
        },
      });
      expect(badCw.statusCode).toBe(400);
      expect(badCw.json().code).toBe('INVALID_CHANNEL_WINDOWS');
    });

    it('F1: supports fusionMode "rrf" and "linear" and exposes hit.fusion breakdown', async () => {
      const rrfRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          fusionMode: 'rrf',
          weights: { lexical: 0.65, dense: 0.35 },
          rankConstant: 60,
          limit: 5,
        },
      });
      expect(rrfRes.statusCode).toBe(200);
      const rrfBody = rrfRes.json();
      expect(rrfBody.meta.fusionMode).toBe('rrf');
      for (const hit of rrfBody.results) {
        expect(hit.fusion).toBeDefined();
        expect(hit.fusion.mode).toBe('rrf');
        const expected =
          (hit.fusion.lexicalRank !== null ? 0.65 / (60 + hit.fusion.lexicalRank) : 0) +
          (hit.fusion.denseRank !== null ? 0.35 / (60 + hit.fusion.denseRank) : 0);
        expect(Math.abs(hit.fusion.fusedScore - expected)).toBeLessThan(1e-5);
      }

      const linearRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: 'наушники',
          fusionMode: 'linear',
          weights: { lexical: 0.6, dense: 0.4 },
          limit: 5,
        },
      });
      expect(linearRes.statusCode).toBe(200);
      const linearBody = linearRes.json();
      expect(linearBody.meta.fusionMode).toBe('linear');
      expect(linearBody.results.length).toBeGreaterThan(0);
      for (const hit of linearBody.results) {
        expect(hit.fusion.mode).toBe('linear');
        expect(hit.fusion.k).toBe(60);
        expect(
          Math.abs(
            hit.fusion.fusedScore -
              (hit.fusion.lexicalContribution + hit.fusion.denseContribution)
          )
        ).toBeLessThan(1e-6);
      }
    });

    it('Q1: classifies queryShape ("sku_like" vs "natural") and biases weightsEffective', async () => {
      const skuRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: { query: '5W-40', limit: 3 },
      });
      expect(skuRes.statusCode).toBe(200);
      const skuMeta = skuRes.json().meta;
      expect(skuMeta.queryShape).toBe('sku_like');
      expect(skuMeta.weightsEffective.lexical).toBeGreaterThan(skuMeta.weightsEffective.semantic);

      const natRes = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: { query: 'недорогие наушники для бега', limit: 3 },
      });
      expect(natRes.statusCode).toBe(200);
      const natMeta = natRes.json().meta;
      expect(natMeta.queryShape).toBe('natural');
      expect(natMeta.weightsEffective.semantic).toBeGreaterThan(natMeta.weightsEffective.lexical);
    });

    it('H1 & Facets: builds XSS-safe <em> highlights in title/sku and returns side-channel facet counts', async () => {
      // 1. Direct unit check of buildHitHighlights HTML escaping
      const directHl = buildHitHighlights({
        normalizedQuery: '5w-40',
        rawQuery: '5W-40',
        title: 'Моторное масло 5W-40 <img src=x onerror=alert(1)>',
        sku: 'SKU-5W-40-<script>',
      });
      expect(directHl.title).toContain('<em>5W-40</em>');
      expect(directHl.title).not.toContain('<img');
      expect(directHl.title).toContain('&lt;img');
      expect(directHl.sku).toContain('<em>');
      expect(directHl.sku).toContain('5W-40');
      expect(directHl.sku).not.toContain('<script>');
      expect(directHl.sku).toContain('&lt;script&gt;');

      // 2. End-to-end API check with upsert sanitization + highlights + facets
      await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': ADMIN_KEY },
        payload: {
          items: [
            {
              id: 'xss-item-1',
              sku: 'SKU-5W-40-<script>',
              brand: 'Motul',
              title: 'Моторное масло 5W-40 <img src=x onerror=alert(1)>',
              category: 'Автотовары и масла',
              price: 3900,
              inStock: true,
            },
          ],
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: {
          query: '5W-40',
          facets: ['brand', 'category'],
          limit: 10,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.results.length).toBeGreaterThan(0);
      expect(body.results[0].highlights.title).toContain('<em>');
      const xssHit = body.results.find((r: any) => r.id === 'xss-item-1');
      if (xssHit) {
        expect(xssHit.highlights.title).toContain('<em>5W-40</em>');
        expect(xssHit.highlights.title).not.toContain('<img');
        expect(xssHit.highlights.sku).not.toContain('<script>');
      }
      expect(body.facets).toBeDefined();
      expect(Array.isArray(body.facets.brand)).toBe(true);
      expect(Array.isArray(body.facets.category)).toBe(true);
      expect(body.facets.category.length).toBeGreaterThan(0);
    });

    it('K1: caches identical query (cacheHit: true) and invalidates cache on catalog upsert (catalogVersion++)', async () => {
      const qPayload = { query: 'беговые кроссовки', limit: 5 };
      const first = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: qPayload,
      });
      expect(first.statusCode).toBe(200);
      const firstJson = first.json();
      expect(firstJson.meta.cacheHit).toBe(false);

      const second = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: qPayload,
      });
      expect(second.statusCode).toBe(200);
      const secondJson = second.json();
      expect(secondJson.meta.cacheHit).toBe(true);
      expect(secondJson.meta.catalogVersion).toBe(firstJson.meta.catalogVersion);

      // Mutate catalog via upsert
      await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': ADMIN_KEY },
        payload: {
          items: [
            {
              id: 'cache-bust-shoe-1',
              sku: 'SHOE-CB-1',
              brand: 'Asics',
              title: 'Беговые кроссовки Asics CloudSpeed',
              category: 'Обувь и кроссовки',
              price: 7990,
              inStock: true,
            },
          ],
        },
      });

      const third = await app.inject({
        method: 'POST',
        url: '/v1/demo/search',
        payload: qPayload,
      });
      expect(third.statusCode).toBe(200);
      const thirdJson = third.json();
      expect(thirdJson.meta.cacheHit).toBe(false);
      expect(thirdJson.meta.catalogVersion).toBeGreaterThan(firstJson.meta.catalogVersion);
      expect(Array.isArray(thirdJson.meta.pipelineStages)).toBe(true);
      expect(thirdJson.meta.pipelineStages.length).toBe(13);
    });
  });
});

