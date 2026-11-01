# EIDOS Connector for WooCommerce (v3.4.0-pilot)

Официальный плагин интеграции **WooCommerce** с self-hosted гибридным поисковым и рекомендательным движком **EIDOS** по контракту **EIDOS Connector v1.0** (симметрично с коннектором 1С-Битрикс).

---

## ⚡ One-Shot Happy Path (Запуск за 10 минут — RU / EN)

```text
Zip plugin → Upload → Activate → ADMIN_KEY + SEARCH_KEY → Health Check → Sync → проверить /?s= на витрине
```

---

## 🇷🇺 Инструкция по установке и настройке (RU)

### 1. Системные требования
- **WordPress**: `>= 6.0`
- **WooCommerce**: `>= 7.0`
- **PHP**: `>= 8.1` (совместимо с `8.0+`)
- **Расширения PHP**:
  - `ext-curl` (обязательно для HTTP-запросов к EIDOS `/v1/*`)
  - `ext-mbstring` (рекомендуется для UTF-8; в `Mapper.php` также встроен безопасный regex-fallback `preg_match_all('/./us', ...)` при отсутствии `ext-mbstring`)
- Запущенный self-hosted сервер **EIDOS** (`http://localhost:3000` или корпоративный HTTPS-инстанс)

### 2. Контракт идентификаторов и полей (`Mapper`)
- **`id`**: строковый `(string) product_id` (или `variation_id` для вариаций `WC_Product_Variation`). Полностью согласован с WordPress `post__in` и `FIELD(wp_posts.ID, ...)`, поэтому тема магазина (Astra, Flatsome, Storefront, WoodMart, Elementor) рендерит штатные карточки без изменения шаблонов.
- **`sku`**: артикул товара (`get_sku()` / `sku`), передаётся в поле `sku` и мета-тег `__eidos_sku:<sku>`.
- **`category`**: основная категория товара (первый терм `product_cat`, например `Наушники`), чтобы фильтр `simpleCategoryGate: 'hard'` в EIDOS работал предсказуемо; дополнительные категории сохраняются в `tags`.
- **Вариативные товары (`variable`)**: индексируются **родительский товар + опубликованные вариации** (`parent + variations`), наследуя категорию и описание родителя и добавляя атрибуты вариации (цвет, размер, объём памяти) в `title` и `tags`.
- **Edge cases**:
  - Товары со статусом `draft`, `private`, `pending`, `trash` автоматически пропускаются при синхронизации.
  - Пустой заголовок заменяется на `Product #{id}`.
  - Отрицательная цена приводится к `0.0` (или отклоняется с построчной ошибкой `rowErrors` при строгой валидации).

### 3. Разделение ключей `ADMIN_KEY` и `SEARCH_KEY`
| Ключ в настройках | Назначение | Эндпоинты EIDOS |
| :--- | :--- | :--- |
| **`ADMIN_KEY`** (`eidos_wc_api_key`) | Полная и дельта-выгрузка каталога | `POST /v1/catalog/upsert` |
| **`SEARCH_KEY`** (`eidos_wc_search_key`) | Поиск на витрине и телеметрия кликов | `POST /v1/search`, `POST /v1/recommend`, `POST /v1/feedback` |

> Все секретные ключи сохраняются в `wp_options` с флагом `autoload = no` и редактируются (`[REDACTED_KEY]`) при записи ошибок в `wc_get_logger()` / `error_log`. На фронтенд (`feedback.js`) ключи никогда не передаются.

### 4. Пошаговая установка через админку WordPress
1. Упакуйте директорию `packages/connectors/woocommerce` в архив `eidos-woocommerce.zip`:
   ```bash
   cd packages/connectors && zip -r eidos-woocommerce.zip woocommerce/
   ```
2. В админ-панели WordPress откройте **Плагины → Добавить новый → Загрузить плагин** (**Plugins → Add New → Upload Plugin**), выберите `eidos-woocommerce.zip`, установите и активируйте плагин.
3. Перейдите в **Настройки → EIDOS Search** (**Settings → EIDOS Search**).
4. Укажите:
   - **URL сервера EIDOS** (`http://localhost:3000` или `https://search.yourstore.com`)
   - **EIDOS ADMIN_KEY** и **EIDOS SEARCH_KEY**
   - При необходимости — **WooCommerce Consumer Key / Secret** (если не указаны, плагин автоматически использует локальный `wc_get_products()` внутри процесса WordPress)
   - Режим **`simpleCategoryGate`** (`hard` по умолчанию), таймаут поиска (`2.0 сек`) и размер батча (`100`).
5. Нажмите **«Проверить связь»** (`healthCheck`) — убедитесь, что EIDOS отвечает `200 OK`.
6. Нажмите **«Синхронизировать»** (`syncCatalog`) — товары и вариации выгрузятся батчами по 100 шт., а на странице отобразится отчёт (`Выгружено / Пропущено / Ошибок`).
7. Откройте витрину магазина и проверьте поиск: `/?s=недорогие+наушники+для+бега&post_type=product`.

---

## 🇬🇧 Installation & Setup Guide (EN)

### 1. System Requirements
- **WordPress**: `>= 6.0`, **WooCommerce**: `>= 7.0`
- **PHP**: `>= 8.1` (`ext-curl`, `ext-mbstring` with built-in UTF-8 regex fallback)
- Running self-hosted **EIDOS** instance (`v3.4.0+`)

### 2. One-Shot Setup
1. Zip `packages/connectors/woocommerce` into `eidos-woocommerce.zip`.
2. Upload & activate via **Plugins → Add New → Upload Plugin**.
3. Open **Settings → EIDOS Search**, configure **EIDOS URL**, **`ADMIN_KEY`**, and **`SEARCH_KEY`**.
4. Click **Check Connection** (`healthCheck`), then **Synchronize** (`syncCatalog`).
5. Test storefront search at `/?s=wireless+headphones&post_type=product`.

---

## Архитектура отказоустойчивости (`SearchReplacer`)
- Перехватывает только основной поисковый запрос витрины (`is_search() && is_main_query()`), не затрагивая админку (`is_admin()`), REST API (`REST_REQUEST`) и вторичные виджеты.
- При ответе EIDOS `count = 0` устанавливает `post__in = [0]`, чтобы WooCommerce показал корректную страницу «Товары не найдены» (а не весь каталог).
- При таймауте или недоступности EIDOS **оставляет `$wpQuery` нетронутым** (срабатывает штатный поиск WordPress/WooCommerce) и взводит одноразовый предохранитель (`failedInCurrentRequest = true`), исключая повторные сетевые вызовы в рамках одного HTTP-запроса.
- Автоматическая дельта-синхронизация (`syncDelta`) регистрируется через **WooCommerce Action Scheduler** (`as_schedule_recurring_action`) с автоматическим fallback на `WP-Cron` (`eidos_wc_cron_sync_delta`).
