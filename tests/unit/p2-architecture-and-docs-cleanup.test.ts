import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  PRODUCT_CATEGORY_FAMILIES as FamiliesFromModule,
  type CategoryFamilySpec,
} from '../../packages/core/src/search/demo-product-category-families';
import {
  PRODUCT_CATEGORY_FAMILIES as FamiliesFromGuardrails,
  buildDynamicCategoryFamiliesFromCatalog,
  extractHeadCategoryIntent,
} from '../../packages/core/src/search/ranking-guardrails';
import { buildServer } from '../../apps/api/src/server';

describe('P2 — Architectural De-duplication, Honest Totals, Widget Build Sync & Docs Integrity', () => {
  const rootDir = process.cwd();

  it('1. removes legacy patch scripts (apply_eidos_hotfix.py, patches/vector-store.p0.diff) from repository', () => {
    expect(fs.existsSync(path.join(rootDir, 'apply_eidos_hotfix.py'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'patches/vector-store.p0.diff'))).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'patches'))).toBe(false);
  });

  it('2. extracts PRODUCT_CATEGORY_FAMILIES to demo-product-category-families.ts and re-exports cleanly (EIDOS-104)', () => {
    expect(FamiliesFromModule).toBe(FamiliesFromGuardrails);
    expect(FamiliesFromModule.length).toBeGreaterThanOrEqual(15);

    const guardrailsSrc = fs.readFileSync(
      path.join(rootDir, 'packages/core/src/search/ranking-guardrails.ts'),
      'utf8'
    );
    expect(guardrailsSrc).toContain("from './demo-product-category-families'");

    // Custom tenant families and dynamic catalog families work seamlessly
    const customFamilies: CategoryFamilySpec[] = [
      {
        id: 'custom_3d_printers',
        canonicalRu: '3D-принтеры',
        canonicalEn: '3D printers',
        queryStems: ['3d-принтер', 'фотополимерн'],
        itemStems: ['3d-принтер', 'фотополимерн', 'anycubic'],
      },
    ];
    const intent = extractHeadCategoryIntent('фотополимерный 3d-принтер для студии', customFamilies);
    expect(intent.hasHeadCategoryIntent).toBe(true);
    expect(intent.familyId).toBe('custom_3d_printers');

    const dynamic = buildDynamicCategoryFamiliesFromCatalog([
      { category: 'Сварочные инверторы', title: 'Сварочный инвертор Ресанта САИ-220' },
    ]);
    expect(dynamic.length).toBe(1);
    expect(dynamic[0].id).toContain('dyn_');
  });

  it('3. /v1/search reports totalIsApproximate and preserves total across fresh and cached hits (EIDOS-105)', async () => {
    const app = await buildServer();
    try {
      await app.inject({
        method: 'POST',
        url: '/v1/catalog/upsert',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: {
          items: [
            {
              id: 'p2-audio-1',
              title: 'Беспроводные наушники Sony WH-1000XM5',
              category: 'Наушники и аудио',
              price: 29990,
              inStock: true,
            },
            {
              id: 'p2-audio-2',
              title: 'Спортивные наушники Shokz OpenRun Pro',
              category: 'Наушники и аудио',
              price: 15990,
              inStock: true,
            },
            {
              id: 'p2-audio-3',
              title: 'Наушники JBL Tune 510BT',
              category: 'Наушники и аудио',
              price: 3990,
              inStock: true,
            },
          ],
        },
      });

      const res1 = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { query: 'наушники', limit: 1 },
      });
      expect(res1.statusCode).toBe(200);
      const body1 = res1.json();
      expect(body1.count).toBe(1);
      expect(body1.total).toBeGreaterThanOrEqual(3);
      expect(typeof body1.totalIsApproximate).toBe('boolean');
      expect(body1.totalIsApproximate).toBe(false);
      expect(body1.meta.totalIsApproximate).toBe(false);

      // Second identical request hits cache and preserves total >= 3 even when limit = 1
      const res2 = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': 'eidos_dev_key' },
        payload: { query: 'наушники', limit: 1 },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = res2.json();
      expect(body2.count).toBe(1);
      expect(body2.total).toBe(body1.total);
      expect(body2.totalIsApproximate).toBe(false);
      expect(body2.meta.totalIsApproximate).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('4. vite.config.ts registers vite-plugin-sync-eidos-widget and widget copies are identical', () => {
    const viteConfig = fs.readFileSync(
      path.join(rootDir, 'apps/workspace/vite.config.ts'),
      'utf8'
    );
    expect(viteConfig).toContain('vite-plugin-sync-eidos-widget');
    expect(viteConfig).toContain('syncStorefrontWidgetPlugin()');

    const rootWidget = fs.readFileSync(path.join(rootDir, 'public/widget.js'), 'utf8');
    const workspaceWidget = fs.readFileSync(
      path.join(rootDir, 'apps/workspace/public/widget.js'),
      'utf8'
    );
    expect(rootWidget).toBe(workspaceWidget);
  });

  it('5. status and benchmark docs contain zero references to deleted patch scripts and document multilingual ONNX + Recall@K', () => {
    const docFiles = [
      'docs/MASTER_P0_STATUS.md',
      'docs/P0_DOD.md',
      'docs/P0_EIDOS104_STATUS.md',
      'docs/P0_UNBLOCK.md',
      'docs/PHASE0_REPORT.md',
      'docs/PHASE_STATUS.md',
      'docs/PILOT_READY.md',
      'docs/BENCHMARKS.md',
      'MIGRATION.md',
    ];
    for (const rel of docFiles) {
      const content = fs.readFileSync(path.join(rootDir, rel), 'utf8');
      expect(content).not.toMatch(
        /apply_master_p0\.py|apply_p0_104_105_remaining\.py|vector-store\.p0\.diff|verify_injects\.sh/
      );
    }

    const benchmarksDoc = fs.readFileSync(path.join(rootDir, 'docs/BENCHMARKS.md'), 'utf8');
    expect(benchmarksDoc).toContain('Xenova/paraphrase-multilingual-MiniLM-L12-v2');
    expect(benchmarksDoc).toContain('evaluateRecallAtK');
  });
});
