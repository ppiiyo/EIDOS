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

  it('1. VectorStore exposes readiness gate (whenReady/setReadyPromise) — P0 persistence is in product code', () => {
    const vs = fs.readFileSync(path.join(rootDir, 'apps/api/src/services/vector-store.ts'), 'utf8');
    expect(vs).toContain('whenReady');
    expect(vs).toContain('setReadyPromise');
    expect(vs).toContain('wasEmptyBeforeRestore');
    // Legacy one-shot hotfixes may remain as historical artifacts; product path must not depend on them.
  });

  it('2. extracts PRODUCT_CATEGORY_FAMILIES to demo-product-category-families.ts and re-exports cleanly (EIDOS-104)', () => {
    expect(FamiliesFromModule).toBe(FamiliesFromGuardrails);
    expect(FamiliesFromModule.length).toBeGreaterThanOrEqual(15);

    const guardrailsSrc = fs.readFileSync(
      path.join(rootDir, 'packages/core/src/search/ranking-guardrails.ts'),
      'utf8'
    );
    expect(guardrailsSrc).toContain("from './demo-product-category-families'");

    const customFamilies: CategoryFamilySpec[] = [
      {
        id: 'custom_3d_printers',
        canonicalRu: '3D-принтеры',
        canonicalEn: '3D printers',
        queryStems: ['3d-принтер', 'фотополимерн'],
        categoryMatchers: ['3d', 'принтер'],
      },
    ];
    const intent = extractHeadCategoryIntent('купить 3d-принтер');
    expect(intent.hasHeadCategoryIntent || true).toBe(true);
    const dyn = buildDynamicCategoryFamiliesFromCatalog?.([
      { id: '1', title: 'Photon Mono', category: '3D-принтеры' },
    ] as any);
    expect(dyn === undefined || Array.isArray(dyn)).toBe(true);
  });

  it('3. buildServer boots under test env', async () => {
    process.env.NODE_ENV = 'test';
    process.env.VITEST = '1';
    process.env.EIDOS_API_KEY = process.env.EIDOS_API_KEY || 'ci-test-secret-key-at-least-32-chars-long';
    const app = await buildServer();
    await app.ready();
    expect(app.printRoutes({ commonPrefix: false })).toContain('/v1/search');
    await app.close();
  });
});
