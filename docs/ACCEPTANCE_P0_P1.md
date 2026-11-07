# EIDOS v3.4 — Acceptance Checklist (P0 + P1 Master Spec & Post-Audit Fix-PR)

Статус выполнения требований **EIDOS Master Spec v1.0** и **Fix-PR Spec (2026-11-06)**.

---

## Раздел A — Проверка без CMS (API / CLI / Vitest)

Автоматически проверяется в CI/Vitest (`tests/unit/p0-p1-master-spec.test.ts`, `tests/unit/v34-zero-bug-acceptance.test.ts`, `tests/unit/woocommerce-parity-and-pilot-golden-path.test.ts`) и через `curl`:

| Код | Требование | Артефакт / Endpoint | Статус |
|-----|-----------|---------------------|--------|
| **PR1** | Production `POST /v1/suggest` и `POST /v1/demo/suggest` доступны по `SEARCH_KEY`, `ADMIN_KEY` и публичному демо-ключу, вызывают **тот же** hybrid ranker (`responseView = 'compact'`, `limit <= 8`, опционально `includeXRay`) и возвращают идентичный top-ID список, что и `POST /v1/search` | `apps/api/src/routes/search.ts`, `apps/api/src/middleware/auth.ts` | **PASS** |
| **PR2** | `GET /v1/ready` различает готовность процесса (`ready: true`, `processReady: true` — для Docker healthcheck) и готовность поискового индекса (`searchReady: itemsIndexed > 0`, `code: "INDEX_EMPTY"` при `0 SKU` — для переключения витрины). При `itemsIndexed === 0` в fail-closed режиме `POST /v1/search` и `POST /v1/suggest` возвращают HTTP `503` с `code: "INDEX_EMPTY"` | `apps/api/src/routes/health.ts`, `apps/api/src/routes/search.ts` | **PASS** |
| **PR3** | Контракт выдачи и демо-сида (1048 SKU): каждый товар гарантированно содержит непустой `sku` (никогда `sku: null`, fallback `sku = id`), `url` (`/product/...`) и `imageUrl` (`/assets/demo/product-...svg` в демо или `string \| null` в прод-индексе) | `apps/api/src/demo/demo-catalog-1000.ts`, `apps/api/src/services/vector-store.ts`, `apps/api/src/routes/catalog.ts` | **PASS** |
| **PR4** | Полная прозрачность `meta.rewrites`: любое изменение запроса фиксируется в `meta.rewrites` с типом `layout` (`yfeiybrb → наушники`), `typo` (`перфоратр → перфоратор`), `synonym` или `normalize`. Выполнено инвариантное равенство `rewriteApplied === (meta.rewrites.length > 0)` | `packages/core/src/search/ranking-guardrails.ts`, `apps/api/src/routes/search.ts` | **PASS** |
| **PR5** | Единообразие путей `connectors/woocommerce` и `connectors/bitrix` во всей документации (`PILOT.md`, `docs/PILOT.md`, `README.md`) + скрипты сборки архивов `pnpm pack:woo` (`connectors/woocommerce/pack.sh`) и `pnpm pack:bitrix` (`connectors/bitrix/pack.sh`) | `connectors/woocommerce/pack.sh`, `connectors/bitrix/pack.sh`, `docs/PILOT.md` | **PASS** |
| **PR6** | Единый rate-limit bucket для `/v1/search` и `/v1/suggest`; при превышении порога возвращается HTTP `429` `{ statusCode: 429, code: "RATE_LIMIT", retryAfterMs, message }`, а виджет `eidos-suggest.js` корректно гасит ошибку без спама | `apps/api/src/middleware/rate-limit-demo.ts`, `apps/api/src/plugins/security.ts`, `eidos-suggest.js` | **PASS** |
| **G1–G6** | Golden-матрица: `недорогие наушники для бега` (только наушники), `детский смартфон до 15000` (только смартфоны $\le 15000$), `моторное масло 5W-40` (автотовары), `yfeiybrb` (`layout`), `перфоратр` (`typo`), `xyzabcqqq999` (`0` результатов) | `tests/unit/p0-p1-master-spec.test.ts` | **PASS** |

---

## Раздел B — Проверка со staging CMS (WooCommerce / 1C-Bitrix)

Выполняется при развёртывании пилота на staging/production контуре клиента:

1. **Сборка и установка пакета**:
   - Для WooCommerce: выполнить `pnpm pack:woo` → загрузить `dist/eidos-woocommerce-plugin.zip` в WordPress Admin → активировать плагин.
   - Для 1С-Битрикс: выполнить `pnpm pack:bitrix` → распаковать `dist/eidos-bitrix-module.zip` в `/bitrix/modules/eidos.search` → установить модуль.
2. **Проверка 4 шагов мастера (`Connection → Sync → Storefront → Verify`)**:
   - Убедиться, что шаг **Connection** проверяет `GET /v1/ready` (`processReady: true`), а после шага **Sync** (выгрузка батчами по 200 SKU с полями `id, sku, title, category, price, url, imageUrl`) `GET /v1/ready` возвращает `searchReady: true` и `itemsIndexed > 0`.
3. **Проверка Live Suggest и Fallback на живой витрине**:
   - Ввести в строке поиска магазина `yfeiybrb` и `перфоратр` — убедиться, что выпадающий список подсказок (`POST /v1/suggest` через CMS proxy) возвращает те же top-N карточки с ценами, картинками и артикулами, что и полная страница поиска.
   - Остановить контейнер EIDOS (`docker compose -f docker-compose.pilot.yml stop eidos-api`) или очистить индекс (`POST /v1/catalog/clear`) и убедиться, что витрина магазина за $\le 2.5\text{ с}$ прозрачно переключается на штатный поиск CMS (`WP_Query` / `CSearch`) без ошибок 500.
