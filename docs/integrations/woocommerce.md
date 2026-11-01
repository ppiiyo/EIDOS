# Интеграция EIDOS v3.4.0 с WooCommerce (WordPress Plugin / Server-Side Search Replace)

> **Статус**: Pilot-Ready (`v3.4.0-pilot`). Интеграция выполняется за 10–15 минут установкой ZIP-плагина из `packages/connectors/woocommerce` без изменения шаблонов темы (Astra, Flatsome, Storefront, WoodMart, Elementor).

---

## Архитектура интеграции (Симметрия с 1С-Битрикс)

```text
WooCommerce products (+ variations)
  → Connector::syncCatalog / syncDelta (ADMIN_KEY)
  → POST /v1/catalog/upsert (batches of 100)
EIDOS self-hosted (/v1/*)
  → POST /v1/search (SEARCH_KEY, simpleCategoryGate='hard')
  → SearchReplacer: post__in = matched IDs, orderby = post__in (FIELD(ID, ...))
  → Штатный цикл темы WooCommerce без смены шаблона
  → EIDOS down / timeout → штатный поиск WordPress/WooCommerce ($wpQuery не модифицируется)
```

| Возможность | 1С-Битрикс (`packages/connectors/bitrix`) | WooCommerce (`packages/connectors/woocommerce`) |
| :--- | :--- | :--- |
| **Контракт `id` и `sku`** | `id = ELEMENT_ID` (string), `sku = XML_ID` | `id = product_id / variation_id` (string), `sku = get_sku()` |
| **Категория и `simpleCategoryGate`** | Основной раздел инфоблока (`hard` по умолчанию) | Первая категория `product_cat` (`hard` по умолчанию, доп. категории в `tags`) |
| **Вариации / Торговые предложения** | Поддержка SKU / `XML_ID` | Индексация `parent + variations` (атрибуты вариации в `title` и `tags`) |
| **Разделение ключей (`ADMIN` vs `SEARCH`)** | `setSearchKey` / `getEffectiveKeyForPath` | `setSearchKey` / `getEffectiveKeyForPath` (`autoload = no` в `wp_options`) |
| **Перехват поиска и Graceful Fallback** | `SearchReplacer` + пропуск удалённых `ELEMENT_ID` | `pre_get_posts` + `woocommerce_product_query`, `post__in = [0]` на пустой выдаче, защита от request storm |
| **Фоновая дельта-синхронизация** | Агент `CAgent` / cron `syncDelta` | **Action Scheduler** (`as_schedule_recurring_action`) или `WP-Cron` (`eidos_wc_cron_sync_delta`) |
| **Зависимости PHP** | `PHP >= 8.1`, `ext-curl`, `ext-mbstring` (+ UTF-8 fallback) | `PHP >= 8.1`, `ext-curl`, `ext-mbstring` (+ UTF-8 fallback) |

---

## 1. Сборка и установка ZIP-плагина

1. Соберите архив плагина из репозитория:
   ```bash
   cd packages/connectors && zip -r eidos-woocommerce.zip woocommerce/
   ```
2. В админ-панели WordPress перейдите в **Плагины → Добавить новый → Загрузить плагин**, загрузите `eidos-woocommerce.zip` и нажмите **Активировать**.
3. Откройте **Настройки → EIDOS Search** и заполните:
   - **URL сервера EIDOS**: `http://localhost:3000` (или внутренний адрес Docker-сети / HTTPS-домен).
   - **EIDOS ADMIN_KEY**: ключ с правами записи для `POST /v1/catalog/upsert`.
   - **EIDOS SEARCH_KEY**: ключ только для чтения (`/v1/search`, `/v1/recommend`, `/v1/feedback`).
   - **Фильтр целевой категории (`simpleCategoryGate`)**: `hard` (рекомендуется для витрины).
4. Нажмите **«Проверить связь»**, затем **«Синхронизировать»**.

---

## 2. Пример прямого использования в PHP-коде (при кастомной интеграции)

```php
<?php
use Eidos\Connectors\WooCommerce\Connector;
use Eidos\Connectors\WooCommerce\HttpClient;
use Eidos\Connectors\WooCommerce\Mapper;
use Eidos\Connectors\WooCommerce\SearchReplacer;

$httpClient = new HttpClient(
    getenv('EIDOS_API_URL') ?: 'http://127.0.0.1:3000',
    getenv('EIDOS_ADMIN_KEY') ?: 'your-admin-key',
    2.0,
    1,
    false,
    null,
    '',
    '',
    home_url(),
    getenv('EIDOS_SEARCH_KEY') ?: 'your-search-key'
);

$mapper = new Mapper();
$searchReplacer = new SearchReplacer($httpClient, null, 'hard', 2.0);
$connector = new Connector($httpClient, $mapper, $searchReplacer);

// 1. Полная синхронизация опубликованных товаров и вариаций
$report = $connector->syncCatalog(['batchSize' => 100]);
// $report = ['synced' => 240, 'failed' => 0, 'skipped' => 3, 'errors' => [], 'rowErrors' => []]

// 2. Поиск релевантных ID товаров с защитой категории (simpleCategoryGate = 'hard')
$productIds = $connector->replaceSearch('недорогие наушники для бега', [
    'limit' => 12,
    'alpha' => 0.65,
    'simpleCategoryGate' => 'hard',
]);
```

---

## 3. Диагностика и частые вопросы (Troubleshooting)

- **Нужен ли CORS на сервере EIDOS?**
  Нет, если используется серверный перехват `SearchReplacer` (`pre_get_posts`) и встроенный прокси телеметрии `/wp-json/eidos/v1/feedback` — все запросы к EIDOS выполняются с сервера PHP (server-to-server).
- **Что происходит, если контейнер EIDOS перезапускается или недоступен?**
  При таймауте (`2.0 сек`) или ошибке сети `SearchReplacer` выставляет `didLastSearchUseFallback() === true`, включает защиту от повторных вызовов в текущем запросе (`isRequestStormTripped()`) и не изменяет `$wpQuery`. Покупатель видит результаты штатного поиска WooCommerce без белого экрана (WSOD).
- **Что происходит, если покупатель вводит бессмысленный запрос (`xyzabcqqq999`)?**
  Сервер EIDOS возвращает `count: 0, results: []`. Плагин устанавливает `$wpQuery->set('post__in', [0])`, и WooCommerce корректно отображает шаблон «Товатов, соответствующих вашему запросу, не обнаружено» (вместо вывода всех товаров каталога).
