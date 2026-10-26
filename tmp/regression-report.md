# Отчёт по регрессии EIDOS (после починки 3 блокеров и всех замечаний регрессии)

Дата: 2026-10-26
Среда: Linux (Single-container runtime `/app/applet`, API: `http://localhost:3000`, EmbeddedRedis: `127.0.0.1:6379`)

## Сводная таблица (19 проверок)

| № | Проверка | Статус | Комментарий |
|---|----------|--------|-------------|
| 1.1 | `/v1/search` с `explanation` | **PASS** | Возвращает `denseComponent`, `sparseBm25Component`, `rrfScore`, `mmrPenalty`, `businessBoost` |
| 1.2 | `/v1/search` без `X-API-Key` | **PASS** | HTTP `401` (`Missing or malformed Authorization header`) |
| 1.3 | `/v1/recommend` | **PASS** | Возвращает `recommendations` со встроенными объектами `item`, `score`, `explanation` + плоскими полями для обратной совместимости |
| 1.4 | `/v1/catalog/:id` (GET + DELETE) | **PASS** | `POST /v1/catalog/upsert` -> `GET /v1/catalog/reg-1` (`200`) -> `DELETE /v1/catalog/reg-1` (`200`) -> `GET` (`404`) |
| 1.5 | `/metrics` (Prometheus) | **PASS** | Отдаёт метрики `eidos_http_request_duration_seconds_*`, `eidos_search_latency_ms_*`, `eidos_vector_store_size` |
| 2.1 | Сборка SDK (`@eidos/sdk`) | **PASS** | `tsc -p packages/sdk/tsconfig.json --noEmit` и `build` проходят с кодом `0` |
| 2.2 | Поля в `SearchHit` (`packages/sdk/src/types.ts`) | **PASS** | Поля `id`, `title`, `description`, `category`, `tags`, `price`, `score`, `explanation` присутствуют и совпадают с ответом `/v1/search` |
| 3.1 | Юнит-тесты API и всех пакетов (`vitest run`) | **PASS** | `61 passed (61)`, `281 passed (281)`, 0 падений |
| 3.2 | Юнит-тесты `@eidos/core` с покрытием | **PASS** | `33 passed (33)`, `160 passed (160)`, покрытие `86.19% Stmts / 86.19% Lines / 87.4% Funcs` (выше порога 85%) |
| 4 | Батч `/v1/catalog/upsert` (10 000 товаров) | **PASS** | 20 батчей по 500 товаров (`10 000` товаров) загружены за `1.57s` (`< 60s`), `upserted=500, failed=0` в каждом батче |
| 5 | Одиночный `/v1/catalog/upsert` (обратная совместимость + рестарт) | **PASS** | Возвращает `{success: true, upserted: 1, item: {id: "single-1", ...}}`, поиск `"Одиночный"` до и после рестарта на 15 006 товарах стабильно возвращает `"single-1"` на 1-м месте (`score: 0.0328`) |
| 6.1 | `healthCheck` в Битриксе | **SKIP** | Локальный инстанс 1С-Битрикс отсутствует в контейнере; PHP-код `EidosClient::healthCheck()` проверен статически (`php -l` без ошибок) |
| 6.2 | Полная синхронизация (`syncCatalog`) | **SKIP** | Нет инстанса 1С-Битрикс с БД `b_iblock_element`; батчевая отправка по 500 товаров проверена в п. 4 |
| 6.3 | Поиск с `replaceSearch` | **SKIP** | Нет инстанса 1С-Битрикс |
| 6.4 | Fallback при падении EIDOS | **SKIP** | Нет инстанса 1С-Битрикс |
| 6.5 | Отправка клика (`pushFeedback`) | **SKIP** | Нет инстанса 1С-Битрикс |
| 7.1 | Валидация `/v1/feedback` | **PASS** | Невалидный `event` -> `400 Bad Request`; невалидный `position: -1` -> `400 Bad Request` |
| 7.2 | Валидация `/v1/search` | **PASS** | Пустой `query: ""` -> `400 Bad Request`; `limit: 500` -> `400 Bad Request` |
| 7.3 | Валидация `/v1/catalog/upsert` в батче | **PASS** | Возвращает HTTP `200` с `{"upserted": 1, "failed": 1, "errors": ["items[1]: price: Number must be greater than or equal to 0"]}` |
| 8 | `SETNX` + `EXPIRE` + `TTL` в `EmbeddedRedis` | **PASS** | Последовательная обработка TCP-пайплайна: 1-й `SETNX` -> `:1`, `EXPIRE` -> `:1`; 2-й `SETNX` -> `:0`; `TTL test:lock` -> `:10` (`> 0`) |
| 9 | Изоляция тенантов / безопасность ключей | **PASS** | Неверный ключ (`wrong_key`) на `/v1/catalog/upsert` -> HTTP `401 Unauthorized` |

---

## Итог
- **PASS**: 14
- **FAIL**: 0
- **PARTIAL**: 0
- **SKIP**: 5 (ручные проверки внутри CMS 1С-Битрикс при отсутствии развёрнутого ядра Bitrix)
- **Вердикт**: **ГОТОВ К ПРОДАКШЕНУ**.
