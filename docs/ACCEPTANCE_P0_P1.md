# EIDOS v3.4 — Acceptance Checklist (P0 + P1 Master Spec)

Статус выполнения требований **EIDOS Master Spec v1.0** (`Onboarding · Live Search · RU-нормализация · Analytics · Fail-safe`).

---

## 1. DoD-P0 (Обязательный контур пилота и витрины)

| Код | Требование | Артефакт / Endpoint | Статус |
|-----|-----------|---------------------|--------|
| **P0-1** | `docker-compose.pilot.yml` + `deploy/pilot/install.sh` + `GET /v1/ready` (`ready, itemsIndexed, hnswIndexed, redis, version`) | `docker-compose.pilot.yml`, `deploy/pilot/install.sh`, `apps/api/src/routes/health.ts` | **PASS** |
| **P0-1** | WooCommerce & 1C-Bitrix 4-Step Setup Wizard (`Connection → Sync → Storefront → Verify`) + WP REST Proxy `/wp-json/eidos/v1/search` | `connectors/woocommerce/eidos-search/`, `connectors/bitrix/eidos.search/` | **PASS** |
| **P0-2** | `POST /v1/suggest` и `POST /v1/demo/suggest` вызывают **тот же** hybrid ranker + `simpleCategoryGate: 'hard'`, `limit <= 8`, `responseView = 'compact'`. Порядок `id` совпадает с `/v1/search` на 20/20 golden запросах | `apps/api/src/routes/search.ts`, `connectors/woocommerce/eidos-search/assets/eidos-suggest.js` | **PASS** |
| **P0-3** | При пустом индексе в fail-closed режиме (`503 INDEX_EMPTY`) или недоступности API коннекторы прозрачно откатываются на штатный поиск CMS (`WP_Query` / `CSearch`) | `apps/api/src/routes/search.ts`, `eidos-search.php`, `options.php` | **PASS** |
| **P0-3** | `/public-demo` при холодном старте гарантированно загружает $\ge 1000$ SKU (`1048 SKU`) до первого поискового запроса | `apps/api/src/routes/demo.ts`, `apps/workspace/src/pages/AdminConsolePage/EidosAdminConsole.tsx` | **PASS** |

---

## 2. DoD-P1 (Нормализация, Синонимы, Аналитика, Мерчандайзинг)

| Код | Требование | Артефакт / Endpoint | Статус |
|-----|-----------|---------------------|--------|
| **P1-1** | Двусторонняя конвертация раскладки `layoutConvert(query, direction)` (`yfeiybrb` → `наушники`, `bairiy` → `iphone`) + лёгкая толерантность к опечаткам (`перфоратр` → `перфоратор`, `fuzziness <= 1` для токенов $\ge 4$) без ослабления Category Gate и 0 на мусоре | `packages/core/src/search/ranking-guardrails.ts` | **PASS** |
| **P1-1** | Поле `meta: { queryRaw, normalizedQuery, rewrites, latencyMs, headCategoryIntent }`, `rewriteApplied: true` и префикс в `humanExplanation`: `«Запрос исправлен: yfeiybrb → наушники»` | `apps/api/src/routes/search.ts` | **PASS** |
| **P1-2** | `SynonymGroup` CRUD (`GET/POST/PATCH/DELETE /v1/admin/dictionaries/synonyms`) + `POST /v1/admin/dictionaries/synonyms/test` (side-by-side До/После top-3). Однопроходный longest-match-first (без каскадных циклов, max 5 замен) | `apps/api/src/services/admin-console-store.ts`, `apps/api/src/routes/admin-console.ts` | **PASS** |
| **P1-3** | Честная аналитика: `GET /v1/admin/analytics/summary`, `GET /v1/admin/analytics/queries`, `GET /v1/admin/analytics/export.csv` (UTF-8 BOM), `POST /v1/events` (`click`) + кнопка «+ Синоним» из пустых запросов | `apps/api/src/routes/admin-console.ts`, `AdminAnalyticsDictRankingTabs.tsx` | **PASS** |
| **P1-4** | Merchandising Rules (`pin` 1..3, `boost`, `bury`) после RRF и до финального среза (`GET/POST/PATCH/DELETE /v1/admin/merch/rules`) с отражением в X-Ray `businessBoost` | `apps/api/src/routes/search.ts`, `apps/api/src/routes/admin-console.ts` | **PASS** |
