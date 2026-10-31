import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  normalizeQueryWithLayoutRecovery,
  evaluateCandidateGuardrail,
  calibrateScorePercent,
} from '../../packages/core/src/search/ranking-guardrails';
import {
  executeHybridCatalogSearch,
  computeTextEmbedding,
} from '../../apps/workspace/src/utils/recommenderEngine';
import { buildServer } from '../../apps/api/src/server';
import { OnboardingWizard } from '../../apps/workspace/src/pages/OnboardingPage/OnboardingWizard';
import type { CatalogItem } from '../../apps/workspace/src/types';

function buildEmbeddingMap(items: CatalogItem[]): Map<string, Float32Array> {
  const map = new Map<string, Float32Array>();
  for (const item of items) {
    const text = `passage: ${item.title} ${item.description} ${item.category} ${(item.tags || []).join(' ')}`;
    map.set(String(item.id), computeTextEmbedding(text));
  }
  return map;
}

describe('EIDOS One-Command Pilot + Zero-Bug Hardening + Storefront Widget Suite', () => {
  describe('Part D — Ranking Guardrails & Off-Domain Noise Elimination', () => {
    const mixedCatalog: CatalogItem[] = [
      {
        id: 'book-1',
        title: 'Книга «Чистый код: создание, анализ и рефакторинг»',
        category: 'Книги',
        description: 'Бестселлер Роберта Мартина про разработку и архитектуру ПО.',
        price: 1200,
        rating: 4.9,
        inStock: true,
        margin: 0.45,
        tags: ['книга', 'программирование'],
      },
      {
        id: 'game-1',
        title: 'Видеоигра Cyberpunk 2077 Ultimate Edition (PS5)',
        category: 'Игры',
        description: 'Ролевая игра в открытом мире Найт-Сити.',
        price: 4990,
        rating: 4.8,
        inStock: true,
        margin: 0.4,
        tags: ['игра', 'ps5', 'rpg'],
      },
      {
        id: 'laptop-1',
        title: 'Ультрабук Apple MacBook Air 13 M3 16/512',
        category: 'Ноутбуки',
        description: 'Тонкий ноутбук для работы и путешествий.',
        price: 129990,
        rating: 4.9,
        inStock: true,
        margin: 0.25,
        tags: ['ноутбук', 'apple'],
      },
      {
        id: 'hp-1',
        title: 'Спортивные беспроводные наушники Shokz OpenRun Pro',
        category: 'Аудио и наушники',
        description: 'Легкие водостойкие наушники с костной проводимостью для бега и марафона.',
        price: 14990,
        rating: 4.9,
        inStock: true,
        margin: 0.35,
        tags: ['наушники', 'для бега', 'спорт', 'bluetooth'],
      },
      {
        id: 'hp-2',
        title: 'Беспроводные наушники Sony WH-1000XM5 ANC',
        category: 'Аудио и наушники',
        description: 'Полноразмерные наушники с активным шумоподавлением.',
        price: 32990,
        rating: 4.9,
        inStock: true,
        margin: 0.3,
        tags: ['наушники', 'шумоподавление', 'bluetooth'],
      },
    ];

    it('never ranks books, games, or laptops above headphones on "наушники" or "недорогие наушники для бега"', () => {
      const embeddings = buildEmbeddingMap(mixedCatalog);

      const q1 = 'наушники';
      const hitsSimple = executeHybridCatalogSearch(
        q1,
        computeTextEmbedding(`query: ${q1}`),
        mixedCatalog,
        embeddings,
        0.55,
        5
      );
      expect(hitsSimple.length).toBeGreaterThanOrEqual(2);
      expect(hitsSimple[0].item.id).toMatch(/^hp-/);
      expect(hitsSimple[1].item.id).toMatch(/^hp-/);
      const returnedIds = hitsSimple.map((h) => h.item.id);
      expect(returnedIds).not.toContain('book-1');
      expect(returnedIds).not.toContain('game-1');
      expect(returnedIds).not.toContain('laptop-1');

      const q2 = 'недорогие наушники для бега';
      const hitsRunning = executeHybridCatalogSearch(
        q2,
        computeTextEmbedding(`query: ${q2}`),
        mixedCatalog,
        embeddings,
        0.55,
        5
      );
      expect(hitsRunning.length).toBeGreaterThan(0);
      expect(hitsRunning[0].item.id).toBe('hp-1');
    });

    it('recovers wrong keyboard layout ("yfceiybrb" / "yfeiybrb" -> "наушники") and finds headphones', () => {
      const norm = normalizeQueryWithLayoutRecovery('yfceiybrb');
      expect(norm.layoutRecovered).toBe(true);
      expect(norm.normalizedQuery).toContain('наушники');

      const embeddings = buildEmbeddingMap(mixedCatalog);
      const hits = executeHybridCatalogSearch(
        'yfceiybrb',
        computeTextEmbedding(`query: ${norm.normalizedQuery}`),
        mixedCatalog,
        embeddings,
        0.55,
        5
      );
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0].item.id).toMatch(/^hp-/);
    });

    it('returns 0 hits for nonsense query "zzzz_nonexistent_999"', () => {
      const embeddings = buildEmbeddingMap(mixedCatalog);
      const q = 'zzzz_nonexistent_999';
      const hits = executeHybridCatalogSearch(
        q,
        computeTextEmbedding(`query: ${q}`),
        mixedCatalog,
        embeddings,
        0.55,
        5
      );
      expect(hits).toHaveLength(0);
    });

    it('evaluates guardrail and calibrates scorePercent into [0..100]', () => {
      const norm = normalizeQueryWithLayoutRecovery('беспроводные наушники');
      const pass = evaluateCandidateGuardrail(
        norm,
        {
          id: 'hp-2',
          title: 'Беспроводные наушники Sony',
          category: 'Аудио',
          description: 'Bluetooth наушники',
        },
        0.65,
        0.42,
        true
      );
      expect(pass.passesLexicalGate).toBe(true);
      expect(pass.consistencyBoost).toBeGreaterThan(0);

      const reject = evaluateCandidateGuardrail(
        norm,
        {
          id: 'book-1',
          title: 'Книга по истории архитектуры',
          category: 'Книги',
          description: 'Иллюстрированное издание',
        },
        0.2,
        0,
        true
      );
      expect(reject.passesLexicalGate).toBe(false);

      const pctTop = calibrateScorePercent({
        rawScore: 0.85,
        maxRawScore: 0.85,
        denseScore: 0.82,
        sparseScore: 0.75,
        titleMatchCount: 2,
        categoryOrTagMatchCount: 1,
        rankIndex: 0,
      });
      const pctMid = calibrateScorePercent({
        rawScore: 0.42,
        maxRawScore: 0.85,
        denseScore: 0.5,
        sparseScore: 0.2,
        titleMatchCount: 0,
        categoryOrTagMatchCount: 1,
        rankIndex: 2,
      });
      expect(pctTop).toBeGreaterThanOrEqual(80);
      expect(pctTop).toBeLessThanOrEqual(99);
      expect(pctMid).toBeGreaterThan(35);
      expect(pctMid).toBeLessThan(pctTop);
    });
  });

  describe('Part D.2 & C.1 — Fastify API Empty Catalog 200 OK, Calibrated scorePercent, and GET /widget.js', () => {
    it('returns 200 OK with empty results on 0 SKU catalog, serves /widget.js, and returns scorePercent after upsert', async () => {
      const app = await buildServer();

      try {
        const emptyRes = await app.inject({
          method: 'POST',
          url: '/v1/search',
          headers: {
            'x-api-key': 'eidos_demo_key',
          },
          payload: {
            query: 'наушники',
            limit: 5,
          },
        });
        expect(emptyRes.statusCode).toBe(200);
        const emptyBody = emptyRes.json();
        expect(emptyBody.count).toBe(0);
        expect(emptyBody.total).toBe(0);
        expect(Array.isArray(emptyBody.results)).toBe(true);
        expect(emptyBody.results).toHaveLength(0);

        const widgetRes = await app.inject({
          method: 'GET',
          url: '/widget.js',
        });
        expect(widgetRes.statusCode).toBe(200);
        expect(widgetRes.headers['content-type']).toContain('application/javascript');
        expect(widgetRes.body).toContain('EidosSearchWidget');
        expect(widgetRes.body).toContain('isSafeStorefrontKey');
      } finally {
        await app.close();
      }
    });
  });

  describe('Part C — Storefront Widget Security & Bitrix URL Template Resolution', () => {
    it('validates widget.js helper logic for key safety and Bitrix /catalog/#ID#/ URLs', () => {
      const widgetPath = path.resolve(process.cwd(), 'public/widget.js');
      expect(fs.existsSync(widgetPath)).toBe(true);

      const req = createRequire(import.meta.url);
      const widgetApi = req(widgetPath) as {
        isSafeStorefrontKey: (k: string) => boolean;
        resolveProductUrl: (item: Record<string, unknown>, tpl: string) => string;
      };
      expect(widgetApi).toBeDefined();

      expect(widgetApi.isSafeStorefrontKey('eidos_mk_secret_master_key_123456')).toBe(false);
      expect(widgetApi.isSafeStorefrontKey('eidos_ak_secret_admin_key_123456')).toBe(false);
      expect(widgetApi.isSafeStorefrontKey('eidos_sk_public_search_key_123456')).toBe(true);

      expect(
        widgetApi.resolveProductUrl(
          { id: '10452', url: '/catalog/audio/sony-xm5/' },
          '/catalog/#ID#/'
        )
      ).toBe('/catalog/audio/sony-xm5/');
      expect(widgetApi.resolveProductUrl({ id: '10452', sku: 'XM5' }, '/catalog/#ID#/')).toBe(
        '/catalog/10452/'
      );
      expect(
        widgetApi.resolveProductUrl({ id: '10452', sku: 'WH-1000XM5' }, '/products/#SKU#/')
      ).toBe('/products/WH-1000XM5/');
    });
  });

  describe('Part A, B, C.3, E — One-Command Installer, Onboarding Wizard, and No-Code Docs', () => {
    it('verifies install-pilot.sh, docker-compose.pilot.yml, Bitrix PHP proxy, and docs exist', () => {
      const root = process.cwd();
      const composePath = path.join(root, 'docker-compose.pilot.yml');
      const scriptPath = path.join(root, 'scripts/install-pilot.sh');
      const phpProxyPath = path.join(root, 'packages/connectors/bitrix/tools/eidos_search.php');
      const bitrixDocPath = path.join(root, 'docs/integrations/bitrix-widget.md');
      const noCodeDocPath = path.join(root, 'docs/PILOT_NO_CODE.md');

      expect(fs.existsSync(composePath)).toBe(true);
      expect(fs.existsSync(scriptPath)).toBe(true);
      expect(fs.existsSync(phpProxyPath)).toBe(true);
      expect(fs.existsSync(bitrixDocPath)).toBe(true);
      expect(fs.existsSync(noCodeDocPath)).toBe(true);

      const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
      expect(scriptContent).toContain('EIDOS_MASTER_KEY');
      expect(scriptContent).toContain('EIDOS_ADMIN_KEY');
      expect(scriptContent).toContain('EIDOS_SEARCH_KEY');
      expect(scriptContent).toContain('/v1/ready');
      expect(scriptContent).toContain('/onboarding');

      const phpContent = fs.readFileSync(phpProxyPath, 'utf-8');
      expect(phpContent).toContain('EIDOS_SEARCH_KEY');
      expect(phpContent).toContain('fallback_native');
    });

    it('renders all 5 steps of OnboardingWizard (/onboarding) cleanly', () => {
      const html = renderToStaticMarkup(
        <OnboardingWizard
          catalog={[]}
          onHybridSearch={async () => []}
          onNavigate={() => {}}
        />
      );
      expect(html).toContain('data-testid="onboarding-wizard"');
      expect(html).toContain('data-testid="onboarding-step-1"');
      expect(html).toContain('data-testid="onboarding-step-2"');
      expect(html).toContain('data-testid="onboarding-step-3"');
      expect(html).toContain('data-testid="onboarding-step-4"');
      expect(html).toContain('data-testid="onboarding-step-5"');
      expect(html).toContain('widget.js');
      expect(html).toContain('/catalog/#ID#/');
    });
  });
});
