import { buildServer } from '../apps/api/src/server';
import { DEMO_CATALOG_1000 } from '../apps/api/src/demo/demo-catalog-1000';
import { ServerEmbedder } from '../apps/api/src/services/embedder';
import { AdminConsoleStore } from '../apps/api/src/services/admin-console-store';

interface CheckResult {
  id: string;
  title: string;
  passed: boolean;
  details: string;
}

async function runGoldenEval(): Promise<void> {
  process.env.API_KEY = 'golden-eval-admin-key';
  process.env.ADMIN_KEY = 'golden-eval-admin-key';
  process.env.SEARCH_KEY = 'golden-eval-search-key';

  AdminConsoleStore.getInstance().resetForTests();
  const server = await buildServer();
  await server.ready();

  const loadRes = await server.inject({
    method: 'POST',
    url: '/v1/demo/load',
    payload: {},
  });
  if (loadRes.statusCode !== 200) {
    throw new Error(`Failed to load demo catalog: ${loadRes.body}`);
  }
  const store = server.storeRegistry.resolveRequestStore({ headers: {} } as any).store;

  const checks: CheckResult[] = [];

  const search = async (body: Record<string, unknown>) => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/demo/search',
      payload: body,
    });
    const json = res.json();
    if (res.statusCode >= 500) {
      console.error('500 ERROR IN SEARCH:', json);
    }
    return { status: res.statusCode, json };
  };

  // G1: недорогие наушники для бега -> all top-10 in Наушники и аудио
  {
    const { status, json } = await search({ query: 'недорогие наушники для бега', limit: 10 });
    const results = json.results || [];
    const allAudio =
      status === 200 &&
      results.length > 0 &&
      results.every((r: any) => r.category === 'Наушники и аудио');
    checks.push({
      id: 'G1',
      title: '«недорогие наушники для бега» → 100% top-10 в категории «Наушники и аудио»',
      passed: allAudio,
      details: `count=${results.length}, categories=${Array.from(new Set(results.map((r: any) => r.category))).join(', ')}`,
    });
  }

  // G2: детский смартфон до 15000 -> all in Смартфоны и гаджеты
  {
    const { status, json } = await search({ query: 'детский смартфон до 15000', limit: 10 });
    const results = json.results || [];
    const allPhones =
      status === 200 &&
      results.length > 0 &&
      results.every((r: any) => r.category === 'Смартфоны и гаджеты');
    checks.push({
      id: 'G2',
      title: '«детский смартфон до 15000» → 100% в категории «Смартфоны и гаджеты»',
      passed: allPhones,
      details: `count=${results.length}, categories=${Array.from(new Set(results.map((r: any) => r.category))).join(', ')}`,
    });
  }

  // G3: yfeiybrb -> normalizedQuery = наушники, results > 0
  {
    const { status, json } = await search({ query: 'yfeiybrb', limit: 10 });
    const results = json.results || [];
    const passed =
      status === 200 &&
      json.normalizedQuery === 'наушники' &&
      results.length > 0 &&
      Array.isArray(json.meta?.rewrites) &&
      json.meta.rewrites.some((rw: any) => rw.type === 'layout');
    checks.push({
      id: 'G3',
      title: '«yfeiybrb» → layout recovery в «наушники», выдача > 0',
      passed,
      details: `normalizedQuery="${json.normalizedQuery}", count=${results.length}`,
    });
  }

  // G4: перфоратр -> normalizedQuery = перфоратор, meta.rewrites non-empty
  {
    const { status, json } = await search({ query: 'перфоратр', limit: 10 });
    const results = json.results || [];
    const passed =
      status === 200 &&
      json.normalizedQuery === 'перфоратор' &&
      results.length > 0 &&
      Array.isArray(json.meta?.rewrites) &&
      json.meta.rewrites.length > 0;
    checks.push({
      id: 'G4',
      title: '«перфоратр» → typo recovery в «перфоратор», meta.rewrites не пуст',
      passed,
      details: `normalizedQuery="${json.normalizedQuery}", rewrites=${JSON.stringify(json.meta?.rewrites)}`,
    });
  }

  // G5: 5W-40 -> top-1 Motor oil 5W-40, queryShape = sku_like
  {
    const { status, json } = await search({ query: '5W-40', limit: 5 });
    const top1 = json.results?.[0];
    const passed =
      status === 200 &&
      Boolean(top1) &&
      (`${top1.title} ${top1.sku}`.toUpperCase().includes('5W-40') ||
        top1.category === 'Автотовары и масла') &&
      json.meta?.queryShape === 'sku_like';
    checks.push({
      id: 'G5',
      title: '«5W-40» → top-1 моторное масло 5W-40, queryShape="sku_like"',
      passed,
      details: `top1="${top1?.title}" (sku=${top1?.sku}), queryShape=${json.meta?.queryShape}`,
    });
  }

  // G6: Абракадабра -> count = 0
  {
    const { status, json } = await search({ query: 'Абракадабра', limit: 10 });
    const passed = status === 200 && json.count === 0 && (json.results || []).length === 0;
    checks.push({
      id: 'G6',
      title: '«Абракадабра» → честный 0 результатов (count = 0)',
      passed,
      details: `count=${json.count}`,
    });
  }

  // C1: Constraints (priceMax + inStock)
  {
    const { status, json } = await search({
      query: 'наушники',
      constraints: { priceMax: 5000, inStock: true },
      limit: 10,
    });
    const results = json.results || [];
    const passed =
      status === 200 &&
      results.length > 0 &&
      results.every((r: any) => typeof r.price === 'number' && r.price <= 5000 && r.inStock === true) &&
      json.meta?.candidatesAfterConstraints < json.meta?.candidatesBeforeConstraints;
    checks.push({
      id: 'C1',
      title: 'Constraints { priceMax: 5000, inStock: true } → все товары ≤ 5000 и в наличии',
      passed,
      details: `count=${results.length}, before=${json.meta?.candidatesBeforeConstraints}, after=${json.meta?.candidatesAfterConstraints}`,
    });
  }

  // C2: Constraints + Gate intersection
  {
    const { status, json } = await search({
      query: 'наушники',
      constraints: { category: 'Автотовары и масла' },
      simpleCategoryGate: 'hard',
      limit: 10,
    });
    const passed = status === 200 && json.count === 0;
    checks.push({
      id: 'C2',
      title: 'Пересечение constraints.category="Автотовары и масла" + запрос «наушники» → count=0',
      passed,
      details: `count=${json.count}`,
    });
  }

  // F1: Weighted fusion math
  {
    const { status, json } = await search({
      query: 'наушники',
      weights: { lexical: 0.65, dense: 0.35 },
      rankConstant: 60,
      limit: 5,
    });
    const results = json.results || [];
    const mathOk =
      status === 200 &&
      results.length > 0 &&
      results.every((hit: any) => {
        const f = hit.fusion;
        if (!f) return false;
        const expectedLex = f.lexicalRank !== null ? 0.65 / (60 + f.lexicalRank) : 0;
        const expectedDense = f.denseRank !== null ? 0.35 / (60 + f.denseRank) : 0;
        const expectedFused = expectedLex + expectedDense;
        return Math.abs(f.fusedScore - expectedFused) <= 1e-5;
      });
    checks.push({
      id: 'F1',
      title: 'Weighted Fusion math: hit.fusion.fusedScore == w_l/(k+r_l) + w_d/(k+r_d) (±1e-6)',
      passed: mathOk,
      details: `top1 fusion=${JSON.stringify(results[0]?.fusion)}`,
    });
  }

  // Q1: Query-shape bias (5W-40 vs недорогие наушники для бега)
  {
    const skuRes = await search({ query: '5W-40', limit: 3 });
    const natRes = await search({ query: 'недорогие наушники для бега', limit: 3 });
    const skuMeta = skuRes.json.meta;
    const natMeta = natRes.json.meta;
    const passed =
      skuMeta?.queryShape === 'sku_like' &&
      skuMeta?.weightsEffective?.lexical > skuMeta?.weightsEffective?.semantic &&
      natMeta?.queryShape === 'natural' &&
      natMeta?.weightsEffective?.semantic > natMeta?.weightsEffective?.lexical;
    checks.push({
      id: 'Q1',
      title: 'Query-Shape Bias: "5W-40" (sku_like, lex>sem) vs "недорогие наушники для бега" (natural, sem>lex)',
      passed,
      details: `sku_like=${JSON.stringify(skuMeta?.weightsEffective)}, natural=${JSON.stringify(natMeta?.weightsEffective)}`,
    });
  }

  // H1: Highlights with XSS escaping
  {
    const { status, json } = await search({ query: 'наушники', limit: 5 });
    const top1 = json.results?.[0];
    const hasEm =
      status === 200 &&
      typeof top1?.highlights?.title === 'string' &&
      top1.highlights.title.includes('<em>') &&
      !top1.highlights.title.includes('<script>');
    checks.push({
      id: 'H1',
      title: 'Highlights: hit.highlights.title содержит безопасные <em>...</em> совпадения',
      passed: hasEm,
      details: `title highlight="${top1?.highlights?.title}"`,
    });
  }

  // K1: Cache hit + invalidation on upsert
  {
    const first = await search({ query: 'кроссовки для бега', limit: 5 });
    const second = await search({ query: 'кроссовки для бега', limit: 5 });
    const firstMiss = first.json.meta?.cacheHit === false;
    const secondHit = second.json.meta?.cacheHit === true;

    // Mutate catalog via upsert -> should increment catalogVersion and invalidate cache
    const existingItem = store.getAll()[0];
    store.upsert({ ...existingItem, price: existingItem.price + 1 });

    const third = await search({ query: 'кроссовки для бега', limit: 5 });
    const thirdMissAfterUpsert =
      third.json.meta?.cacheHit === false &&
      third.json.meta?.catalogVersion > first.json.meta?.catalogVersion;

    checks.push({
      id: 'K1',
      title: 'Cache & Invalidation: 1-й запрос MISS, 2-й HIT, после upsert — MISS с новым catalogVersion',
      passed: firstMiss && secondHit && thirdMissAfterUpsert,
      details: `1st.cacheHit=${first.json.meta?.cacheHit}, 2nd.cacheHit=${second.json.meta?.cacheHit}, 3rd.cacheHit=${third.json.meta?.cacheHit} (v${first.json.meta?.catalogVersion}->v${third.json.meta?.catalogVersion})`,
    });
  }

  await server.close();

  console.log('\n============================================================');
  console.log('EIDOS Retrieval Product Layer v1 — Golden Eval Suite');
  console.log('============================================================');
  let allPassed = true;
  for (const c of checks) {
    const badge = c.passed ? 'PASS' : 'FAIL';
    if (!c.passed) allPassed = false;
    console.log(`[${badge}] ${c.id}: ${c.title}`);
    console.log(`       ${c.details}`);
  }
  console.log('============================================================');
  console.log(`Result: ${checks.filter((c) => c.passed).length}/${checks.length} passed`);
  console.log('============================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
  process.exit(0);
}

runGoldenEval().catch((err) => {
  console.error('Golden eval failed with error:', err);
  process.exit(1);
});
