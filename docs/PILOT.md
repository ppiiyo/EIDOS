# EIDOS v3.4 — Pilot Onboarding Guide (15–30 минут)

Пошаговый регламент запуска **EIDOS Self-Hosted Hybrid Search** (HNSW 384-d + BM25 + RRF + Category Gate) на реальном магазине **WooCommerce** или **1С-Битрикс**.

---

## 1. Системные требования

- **ОС**: Linux x86_64 / ARM64 (Ubuntu 22.04+, Debian 12+)
- **Docker**: Docker Engine 24+ и Docker Compose v2
- **Ресурсы**: 2 vCPU, 2–4 GB RAM, 5 GB SSD (для каталогов до 50 000 SKU)
- **Сеть**: порт `3001` (внутренний или за Nginx/Caddy HTTPS)

---

## 2. Запуск сервера EIDOS за 3 минуты

Выполните скрипт автоматической инициализации пилота:

```bash
chmod +x deploy/pilot/install.sh
./deploy/pilot/install.sh
```

Скрипт автоматически:
1. Сгенерирует криптостойкие `ADMIN_KEY` (`eidos_adm_...`) и `SEARCH_KEY` (`eidos_pub_...`) в `.env.pilot`.
2. Запустит `docker compose -f docker-compose.pilot.yml up -d` с персистентным томом `/var/lib/eidos` и Redis 7.
3. Дождётся `GET http://localhost:3001/v1/ready` (`"ready": true`, `"processReady": true`).
4. Выведет готовые ключи для вставки в плагин WooCommerce (`connectors/woocommerce/eidos-search`) или модуль 1С-Битрикс (`connectors/bitrix/eidos.search`).

Проверка готовности вручную:
```bash
curl -s http://localhost:3001/v1/ready | jq
```
Ожидаемый ответ на чистом старте (до синхронизации каталога):
```json
{
  "ready": true,
  "processReady": true,
  "searchReady": false,
  "status": "ready",
  "itemsIndexed": 0,
  "hnswIndexed": 0,
  "redis": "ok",
  "version": "3.4.0",
  "code": "INDEX_EMPTY"
}
```
> **Важно**: `processReady: true` (`ready: true`) используется для Docker healthcheck контейнера, а `searchReady: true` (`itemsIndexed > 0`) сигнализирует витрине CMS, что каталог загружен и поиск готов принимать покупательский трафик.

---

## 3. Подключение WooCommerce (`connectors/woocommerce/eidos-search`)

1. Соберите ZIP-архив плагина командой `pnpm pack:woo` (`bash connectors/woocommerce/pack.sh` → `dist/eidos-woocommerce-plugin.zip`) или скопируйте `connectors/woocommerce/eidos-search` в `wp-content/plugins/eidos-search` и активируйте плагин.
2. Перейдите в **WooCommerce → EIDOS Search**:
   - **Шаг 1 — Connection**: укажите `API URL`, `SEARCH_KEY` (публичный) и `ADMIN_KEY` (серверный) → нажмите **«Проверить соединение»**.
   - **Шаг 2 — Sync**: нажмите **«Синхронизировать сейчас»** (пакетная выгрузка по 200 товаров в `POST /v1/catalog/upsert` с полями `id`, `sku`, `title`, `category`, `price`, `url`, `imageUrl` + включение хуков `save_post_product` / `woocommerce_update_product` / `before_delete_post`).
   - **Шаг 3 — Storefront**: включите **«Живые подсказки (Live Suggest)»** (`assets/eidos-suggest.js` через WP REST proxy `/wp-json/eidos/v1/search` → `POST /v1/suggest`) и **«Заменить страницу результатов поиска»**.
   - **Шаг 4 — Verify**: запустите **«Контрольную проверку (5 запросов)»** (3 реальных товара, 1 запрос в английской раскладке `yfeiybrb`, 1 мусорный запрос `абракадабра999` → 0 результатов).

---

## 4. Подключение 1С-Битрикс (`connectors/bitrix/eidos.search`)

1. Соберите ZIP-архив модуля командой `pnpm pack:bitrix` (`bash connectors/bitrix/pack.sh` → `dist/eidos-bitrix-module.zip`) или скопируйте `connectors/bitrix/eidos.search` в `/bitrix/modules/eidos.search` и установите модуль в *Marketplace → Установленные решения*.
2. В настройках модуля (`options.php`):
   - **Шаг 1 — Connection**: укажите `API URL`, `SEARCH_KEY`, `ADMIN_KEY`.
   - **Шаг 2 — Sync инфоблока**: выберите ID инфоблока каталога и запустите выгрузку (`CIBlockElement::GetList` батчами по 200 SKU через `eidosBitrixMapElement`). Автоматически регистрируются обработчики `OnAfterIBlockElementAdd/Update/Delete`.
   - **Шаг 3 — Storefront**: включите живые подсказки (`POST /v1/suggest`) и интеграцию с `search.page`.
   - **Шаг 4 — Verify**: выполните контрольную проверку 5 запросов.

---

## 5. Контракт отказоустойчивости (Fail-Safe Fallback)

- При таймауте (`> 2.5s`), сетевой ошибке, HTTP `5xx` или пустом индексе (`503 INDEX_EMPTY`, `searchReady: false`) коннекторы WooCommerce и 1С-Битрикс **автоматически переключаются на штатный поиск CMS** (`WP_Query` / `CSearch`) без белых экранов и ошибок 500 у покупателя.
- В браузер передаётся только публичный `SEARCH_KEY` (или запросы идут через серверный WP REST proxy `/wp-json/eidos/v1/search`). `ADMIN_KEY` хранится исключительно на сервере.
