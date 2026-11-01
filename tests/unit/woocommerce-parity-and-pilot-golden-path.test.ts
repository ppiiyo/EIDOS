import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildServer } from '../../apps/api/src/server';
import { ApiKeyManager } from '../../apps/api/src/services/api-key-manager';

describe('EIDOS v3.4.0-pilot — Self-Hosted Golden Path (A2) & WooCommerce ↔ Bitrix Parity (B1–B9)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  const adminKey = 'eidos_test_key_1';
  let searchOnlyKey = '';

  beforeAll(async () => {
    process.env.API_KEYS = adminKey;
    app = await buildServer();
    await app.ready();

    // Generate a dedicated read-only SEARCH_KEY (role = 'search') to test strict RBAC separation
    const generated = ApiKeyManager.getInstance().generateKey({
      tenantId: 'default',
      role: 'search',
      description: 'Storefront read-only SEARCH_KEY for WooCommerce & Bitrix',
    });
    searchOnlyKey = generated.key;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('A2. Self-Hosted Golden Path: ADMIN upsert -> GET /v1/ready -> SEARCH_KEY RBAC -> 15 Golden Queries (multi-intent, cross-lingual, layout, garbage)', async () => {
    await app.inject({
      method: 'DELETE',
      url: '/v1/catalog/clear',
      headers: { 'x-api-key': adminKey },
    });

    // 1. Verify SEARCH_KEY is forbidden (403) from mutating the catalog
    const forbiddenUpsert = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': searchOnlyKey },
      payload: {
        items: [{ id: 'unauth-1', title: 'Forbidden Item', category: 'Test', price: 100 }],
      },
    });
    expect(forbiddenUpsert.statusCode).toBe(403);

    // 2. Seed realistic multi-category client catalog via ADMIN_KEY
    const clientCatalog = [
      // Наушники (4 items)
      {
        id: 'wc-101',
        sku: 'SNY-RUN-101',
        title: 'Спортивные беспроводные наушники Sony Float Run TWS для бега',
        description: 'Лёгкие недорогие наушники с влагозащитой IPX4 для бега и тренировок',
        category: 'Наушники',
        price: 5990,
        inStock: true,
        tags: ['наушники', 'бег', 'спорт', 'tws', 'беспроводные'],
        url: '/product/sony-float-run/',
      },
      {
        id: 'wc-102',
        sku: 'JBL-RUN-102',
        title: 'Беспроводные наушники JBL Endurance Race для бега и фитнеса',
        description: 'Бюджетные спортивные наушники вкладыши с защитой от пота для бега',
        category: 'Наушники',
        price: 4490,
        inStock: true,
        tags: ['наушники', 'бег', 'гарнитура', 'недорогие'],
        url: '/product/jbl-endurance-race/',
      },
      {
        id: 'wc-103',
        sku: 'SHK-RUN-103',
        title: 'Наушники с костной проводимостью Shokz OpenMove для бега',
        description: 'Безопасные наушники для бега на улице и марафона',
        category: 'Наушники',
        price: 6990,
        inStock: true,
        tags: ['наушники', 'бег', 'марафон', 'shokz'],
        url: '/product/shokz-openmove/',
      },
      {
        id: 'wc-104',
        sku: 'SNY-XM5-104',
        title: 'Беспроводные наушники Sony WH-1000XM5 с шумоподавлением ANC',
        description: 'Полноразмерные Bluetooth наушники с активным шумоподавлением ANC и Spatial Audio',
        category: 'Наушники',
        price: 29990,
        inStock: true,
        tags: ['наушники', 'anc', 'шумоподавление', 'bluetooth'],
        url: '/product/sony-wh-1000xm5/',
      },
      // Кроссовки (3 items — distractors with "для бега" / "марафона")
      {
        id: 'wc-201',
        sku: 'ASICS-201',
        title: 'Беговые кроссовки Asics Gel-Kayano 30 для бега и марафона',
        description: 'Профессиональные кроссовки для бега по асфальту с амортизацией',
        category: 'Кроссовки',
        price: 14990,
        inStock: true,
        tags: ['кроссовки', 'бег', 'марафон', 'обувь'],
        url: '/product/asics-gel-kayano-30/',
      },
      {
        id: 'wc-202',
        sku: 'NIKE-202',
        title: 'Недорогие кроссовки для бега Nike Pegasus 40',
        description: 'Лёгкая спортивная обувь для ежедневного бега и марафона',
        category: 'Кроссовки',
        price: 9990,
        inStock: true,
        tags: ['кроссовки', 'бег', 'марафон', 'обувь'],
        url: '/product/nike-pegasus-40/',
      },
      {
        id: 'wc-203',
        sku: 'SAUC-203',
        title: 'Кроссовки Saucony Endorphin Speed для марафона и быстрого бега',
        description: 'Карбоновые беговые кроссовки для соревнований и марафона',
        category: 'Кроссовки',
        price: 16500,
        inStock: true,
        tags: ['кроссовки', 'марафон', 'бег'],
        url: '/product/saucony-endorphin/',
      },
      // Клавиатуры (2 items)
      {
        id: 'wc-301',
        sku: 'KEY-K2-301',
        title: 'Беспроводная механическая клавиатура Keychron K2 Pro',
        description: 'Компактная механическая клавиатура со свитчами Gateron для программирования и печати',
        category: 'Клавиатуры',
        price: 9500,
        inStock: true,
        tags: ['клавиатура', 'механическая', 'беспроводная', 'свитчи'],
        url: '/product/keychron-k2-pro/',
      },
      {
        id: 'wc-302',
        sku: 'NUPHY-302',
        title: 'Низкопрофильная механическая клавиатура NuPhy Air75',
        description: 'Тонкая беспроводная клавиатура для работы и кода',
        category: 'Клавиатуры',
        price: 10900,
        inStock: true,
        tags: ['клавиатура', 'механическая', 'печать'],
        url: '/product/nuphy-air75/',
      },
      // Кофемашины / Техника (2 items)
      {
        id: 'wc-401',
        sku: 'DEL-401',
        title: 'Автоматическая кофемашина DeLonghi Magnifica Эспрессо и Капучино',
        description: 'Зерновая кофемашина 15 бар для приготовления эспрессо и капучино дома',
        category: 'Кофемашины',
        price: 42990,
        inStock: true,
        tags: ['кофемашина', 'кофе', 'эспрессо', 'капучино', 'бариста'],
        url: '/product/delonghi-magnifica/',
      },
      // Смартфоны (1 item)
      {
        id: 'wc-501',
        sku: 'PIX-501',
        title: 'Смартфон Google Pixel 8 Pro 256GB Камерофон',
        description: 'Флагманский смартфон с OLED экраном и телефото камерой',
        category: 'Смартфоны',
        price: 79990,
        inStock: true,
        tags: ['смартфон', 'телефон', 'камерофон'],
        url: '/product/pixel-8-pro/',
      },
      // Ноутбуки (1 item)
      {
        id: 'wc-601',
        sku: 'MBP-601',
        title: 'Ноутбук Apple MacBook Pro 14 M3 для разработки и программирования',
        description: 'Мощный ультрабук и рабочая станция для программистов',
        category: 'Ноутбуки',
        price: 169990,
        inStock: true,
        tags: ['ноутбук', 'ультрабук', 'макбук', 'программирование'],
        url: '/product/macbook-pro-14/',
      },
      // Смарт-часы (1 item)
      {
        id: 'wc-701',
        sku: 'GAR-701',
        title: 'Спортивные смарт-часы Garmin Forerunner с пульсометром и GPS',
        description: 'Фитнес-часы для контроля пульса, сна и беговых тренировок',
        category: 'Смарт-часы',
        price: 28900,
        inStock: true,
        tags: ['часы', 'смарт-часы', 'пульс', 'фитнес'],
        url: '/product/garmin-forerunner/',
      },
      // Рюкзаки (1 item)
      {
        id: 'wc-801',
        sku: 'PEAK-801',
        title: 'Городской рюкзак Peak Design Everyday Backpack 20L для путешествий',
        description: 'Водонепроницаемый рюкзак для ноутбука, камеры и поездок',
        category: 'Рюкзаки',
        price: 18500,
        inStock: true,
        tags: ['рюкзак', 'сумка', 'поход'],
        url: '/product/peak-design-backpack/',
      },
      // Фотокамеры (1 item)
      {
        id: 'wc-901',
        sku: 'SNY-A7-901',
        title: 'Беззеркальная камера Sony Alpha A7 IV со сменным объективом',
        description: 'Полнокадровая фотокамера для профессиональной фото и видеосъёмки',
        category: 'Фотокамеры',
        price: 195000,
        inStock: true,
        tags: ['камера', 'фотоаппарат', 'объектив'],
        url: '/product/sony-a7-iv/',
      },
      // Мониторы (1 item)
      {
        id: 'wc-1001',
        sku: 'LG-OLED-1001',
        title: 'Игровой монитор LG UltraGear 27 OLED 4K 240Hz',
        description: 'Широкоформатный 4K OLED дисплей с минимальным временем отклика',
        category: 'Мониторы',
        price: 68000,
        inStock: true,
        tags: ['монитор', 'экран', 'дисплей', 'oled', '4k'],
        url: '/product/lg-ultragear-oled/',
      },
    ];

    const upsertRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': adminKey },
      payload: { items: clientCatalog },
    });
    expect(upsertRes.statusCode).toBe(200);
    expect(upsertRes.json().upserted).toBe(clientCatalog.length);

    // 3. Verify GET /v1/ready returns 200 OK
    const readyRes = await app.inject({
      method: 'GET',
      url: '/v1/ready',
    });
    expect(readyRes.statusCode).toBe(200);
    expect(readyRes.json().ready).toBe(true);

    // 4. Execute 15 Golden Queries using the read-only SEARCH_KEY
    const goldenQueries: Array<{
      query: string;
      expectedCategory: string | null; // null means garbage query expecting count = 0
      checkAllTop3?: boolean;
    }> = [
      { query: 'недорогие наушники для бега', expectedCategory: 'Наушники', checkAllTop3: true },
      { query: 'беспроводные наушники с шумоподавлением', expectedCategory: 'Наушники', checkAllTop3: true },
      { query: 'кроссовки для марафона и бега', expectedCategory: 'Кроссовки', checkAllTop3: true },
      { query: 'механическая клавиатура для программирования', expectedCategory: 'Клавиатуры' },
      { query: 'кофемашина эспрессо и капучино для дома', expectedCategory: 'Кофемашины' },
      { query: 'смартфон камерофон с oled экраном', expectedCategory: 'Смартфоны' },
      { query: 'ноутбук макбук для разработки', expectedCategory: 'Ноутбуки' },
      { query: 'спортивные смарт-часы с пульсометром', expectedCategory: 'Смарт-часы' },
      { query: 'водонепроницаемый рюкзак для путешествий', expectedCategory: 'Рюкзаки' },
      { query: 'беззеркальная фотокамера с объективом', expectedCategory: 'Фотокамеры' },
      { query: 'монитор 4k oled для игр', expectedCategory: 'Мониторы' },
      { query: 'wireless headphones anc', expectedCategory: 'Наушники', checkAllTop3: true },
      { query: 'yfeiybrb для бега', expectedCategory: 'Наушники', checkAllTop3: true }, // Keyboard layout typo recovery -> "наушники для бега"
      { query: 'xyzabcqqq999', expectedCategory: null }, // Garbage #1 -> count: 0
      { query: 'zzzz0000qqqq', expectedCategory: null }, // Garbage #2 -> count: 0
    ];

    expect(goldenQueries.length).toBe(15);

    for (const gq of goldenQueries) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/search',
        headers: { 'x-api-key': searchOnlyKey },
        payload: {
          query: gq.query,
          limit: 5,
          alpha: 0.65,
          simpleCategoryGate: 'hard',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();

      if (gq.expectedCategory === null) {
        expect(body.count).toBe(0);
        expect(body.results).toEqual([]);
      } else {
        expect(body.count).toBeGreaterThan(0);
        expect(body.results[0].category).toBe(gq.expectedCategory);
        expect(body.results[0].scorePercent).toBeGreaterThanOrEqual(50);
        expect(body.results[0].humanExplanation?.ru).toBeTruthy();
        expect(body.results[0].humanExplanation?.en).toBeTruthy();

        if (gq.checkAllTop3) {
          const top3Cats = body.results.slice(0, 3).map((r: any) => r.category);
          for (const cat of top3Cats) {
            expect(cat).toBe(gq.expectedCategory);
          }
        }
      }
    }
  });

  it('B1–B9. WooCommerce Connector Parity with Bitrix: Mapper, HttpClient, SearchReplacer, Settings, Docs & Live Sync -> Search Round-Trip', async () => {
    const wcDir = path.resolve(process.cwd(), 'packages/connectors/woocommerce');
    const mapperPhp = fs.readFileSync(path.join(wcDir, 'includes/class-mapper.php'), 'utf8');
    const httpClientPhp = fs.readFileSync(path.join(wcDir, 'includes/class-http-client.php'), 'utf8');
    const searchReplacerPhp = fs.readFileSync(path.join(wcDir, 'includes/class-search-replacer.php'), 'utf8');
    const connectorPhp = fs.readFileSync(path.join(wcDir, 'includes/class-connector.php'), 'utf8');
    const settingsPhp = fs.readFileSync(path.join(wcDir, 'includes/class-settings.php'), 'utf8');
    const settingsPagePhp = fs.readFileSync(path.join(wcDir, 'admin/settings-page.php'), 'utf8');
    const bootstrapPhp = fs.readFileSync(path.join(wcDir, 'eidos-woocommerce.php'), 'utf8');
    const readmeTxt = fs.readFileSync(path.join(wcDir, 'readme.txt'), 'utf8');
    const wcReadmeMd = fs.readFileSync(path.join(wcDir, 'README.md'), 'utf8');
    const docsWooMd = fs.readFileSync(
      path.resolve(process.cwd(), 'docs/integrations/woocommerce.md'),
      'utf8'
    );
    const docsBitrixMd = fs.readFileSync(
      path.resolve(process.cwd(), 'docs/integrations/bitrix.md'),
      'utf8'
    );
    const docsProdMd = fs.readFileSync(
      path.resolve(process.cwd(), 'docs/PRODUCTION.md'),
      'utf8'
    );

    // B2. Mapper parity checks: ext-mbstring safe UTF-8 fallback, primary category, SKU, empty title fallback, negative price, publish status filter
    expect(mapperPhp).toContain("function_exists('mb_substr')");
    expect(mapperPhp).toContain("function_exists('mb_strlen')");
    expect(mapperPhp).toContain("preg_match_all('/./us'");
    expect(mapperPhp).toContain('isPublishedProduct');
    expect(mapperPhp).toContain("sprintf('Product #%s', $id)");
    expect(mapperPhp).toContain("'__eidos_sku:'");
    expect(mapperPhp).toContain("$catNames[0]");

    // B3. HttpClient parity checks: SEARCH_KEY vs ADMIN_KEY, retry only on 429/502/503, secret redaction in logs
    expect(httpClientPhp).toContain('setSearchKey');
    expect(httpClientPhp).toContain('getEffectiveKeyForPath');
    expect(httpClientPhp).toContain('isRetryableStatus');
    expect(httpClientPhp).toContain('[429, 502, 503]');
    expect(httpClientPhp).toContain('redactSecrets');
    expect(httpClientPhp).toContain('[REDACTED_KEY]');

    // B4. SearchReplacer parity checks: post__in, orderby post__in, count=0 -> post__in=[0], request-storm breaker, stale ID skipping, simpleCategoryGate
    expect(searchReplacerPhp).toContain('failedInCurrentRequest');
    expect(searchReplacerPhp).toContain('isRequestStormTripped');
    expect(searchReplacerPhp).toContain('markItemDeletedInWooCommerce');
    expect(searchReplacerPhp).toContain('deletedProductIds');
    expect(searchReplacerPhp).toContain("'simpleCategoryGate' => $gate");
    expect(searchReplacerPhp).toContain("$wpQuery->set('post__in', [0])");
    expect(searchReplacerPhp).toContain("$wpQuery->set('orderby', 'post__in')");

    // B5–B7. Settings, Admin UX, Action Scheduler, autoload=no, rowErrors
    expect(settingsPhp).toContain('OPTION_SEARCH_KEY');
    expect(settingsPhp).toContain('OPTION_SIMPLE_CATEGORY_GATE');
    expect(settingsPhp).toContain('update_option(self::OPTION_API_KEY, $apiKey, false)');
    expect(settingsPhp).toContain('update_option(self::OPTION_SEARCH_KEY, $searchKey, false)');
    expect(settingsPhp).toContain("current_user_can('manage_woocommerce')");
    expect(settingsPagePhp).toContain('eidos_wc_search_key');
    expect(settingsPagePhp).toContain('eidos_wc_simple_category_gate');
    expect(connectorPhp).toContain('rowErrors');
    expect(bootstrapPhp).toContain('as_schedule_recurring_action');
    expect(readmeTxt).toContain('Requires PHP: 8.1');
    expect(readmeTxt).toContain('ext-mbstring');
    expect(readmeTxt).toContain('ext-curl');

    // B9 & D. Docs & Pilot Runbook checks
    expect(wcReadmeMd).toContain('ADMIN_KEY');
    expect(wcReadmeMd).toContain('SEARCH_KEY');
    expect(docsWooMd).toContain('Connector::syncCatalog');
    expect(docsWooMd).toContain('SearchReplacer');
    expect(docsBitrixMd).toContain('ELEMENT_ID');
    expect(docsBitrixMd).toContain('XML_ID');
    expect(docsProdMd).toContain('Pilot in 15 Minutes');
    expect(docsProdMd).toContain('v3.4.0-pilot');

    // Live round-trip simulation: WooCommerce parent product + variation upsert (ADMIN_KEY) -> search (SEARCH_KEY)
    await app.inject({
      method: 'DELETE',
      url: '/v1/catalog/clear',
      headers: { 'x-api-key': adminKey },
    });

    const wcSyncBatch = {
      items: [
        {
          id: '7010', // WooCommerce Parent Product ID
          sku: 'WC-SONY-XM5',
          title: 'Беспроводные наушники Sony WH-1000XM5',
          description: 'Флагманские полноразмерные наушники с активным шумоподавлением ANC',
          category: 'Наушники',
          price: 29990,
          inStock: true,
          url: 'https://shop.example.com/product/sony-wh-1000xm5/',
          tags: ['наушники', 'anc', '__eidos_sku:WC-SONY-XM5'],
        },
        {
          id: '7011', // WooCommerce Variation ID (Midnight Blue)
          sku: 'WC-SONY-XM5-BLUE',
          title: 'Беспроводные наушники Sony WH-1000XM5 (Синий / Midnight Blue)',
          description: 'Флагманские полноразмерные наушники с активным шумоподавлением ANC',
          category: 'Наушники',
          price: 30490,
          inStock: true,
          url: 'https://shop.example.com/product/sony-wh-1000xm5/?attribute_pa_color=blue',
          tags: ['наушники', 'anc', 'Синий', 'Midnight Blue', '__eidos_sku:WC-SONY-XM5-BLUE'],
        },
      ],
    };

    const syncRes = await app.inject({
      method: 'POST',
      url: '/v1/catalog/upsert',
      headers: { 'x-api-key': adminKey },
      payload: wcSyncBatch,
    });
    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().upserted).toBe(2);

    const searchRes = await app.inject({
      method: 'POST',
      url: '/v1/search',
      headers: { 'x-api-key': searchOnlyKey },
      payload: {
        query: 'синие наушники sony wh-1000xm5',
        limit: 5,
        alpha: 0.65,
        simpleCategoryGate: 'hard',
      },
    });
    expect(searchRes.statusCode).toBe(200);
    const searchData = searchRes.json();
    expect(searchData.count).toBe(2);
    // Variation 7011 ("Синий") ranks #1, and both IDs are numeric strings ready for WordPress post__in
    expect(searchData.results[0].id).toBe('7011');
    expect(searchData.results.map((r: any) => Number(r.id))).toEqual([7011, 7010]);
  });
});
