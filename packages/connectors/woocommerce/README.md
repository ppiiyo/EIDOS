# EIDOS Connector for WooCommerce (v1.0)

Официальный плагин интеграции **WooCommerce** с гибридным поисковым и рекомендательным движком **EIDOS** по контракту **EIDOS Connector v1.0**.

---

## 🇷🇺 Инструкция по установке и настройке (RU)

### 1. Требования
- **WordPress**: 6.0+
- **WooCommerce**: 7.0+
- **PHP**: 8.0+ с расширением `ext-curl` и `ext-mbstring`
- Запущенный сервер **EIDOS** (например, `docker run -d -p 3000:3000 eidos/eidos`)

### 2. Установка через админку WordPress
1. Упакуйте директорию `packages/connectors/woocommerce` в архив `eidos-woocommerce.zip`:
   ```bash
   cd packages/connectors && zip -r eidos-woocommerce.zip woocommerce/
   ```
2. В админ-панели WordPress перейдите в **Плагины → Добавить новый → Загрузить плагин** (**Plugins → Add New → Upload Plugin**).
3. Выберите `eidos-woocommerce.zip`, нажмите **Установить** и затем **Активировать плагин**.

### 3. Создание ключей WooCommerce REST API
Для выгрузки родительских товаров и их вариаций через `/wp-json/wc/v3/products`:
1. Откройте **WooCommerce → Настройки → Дополнительно → REST API** (**WooCommerce → Settings → Advanced → REST API**).
2. Нажмите **Добавить ключ** (**Add key**), выберите права **Чтение** (**Read**) и скопируйте `Consumer key` (`ck_...`) и `Consumer secret` (`cs_...`).

### 4. Настройка плагина EIDOS
1. Перейдите в **Настройки → EIDOS Search** (**Settings → EIDOS Search**).
2. Заполните поля:
   - **URL сервера EIDOS**: `http://localhost:3000` (или ваш production HTTPS-домен).
   - **API-ключ EIDOS**: `eidos_dev_key` (или ваш `EIDOS_API_KEY`).
   - **WooCommerce Consumer Key / Secret**: ключи из шага 3.
3. Нажмите **«Сохранить настройки»**.
4. Нажмите **«Проверить связь»** (`healthCheck`) — должно появиться зелёное уведомление с версией EIDOS, числом товаров в индексе и задержкой в мс.
5. Нажмите **«Синхронизировать»** (`syncCatalog`) — плагин выгрузит все родительские товары и вариации `variable`-товаров батчами по 100 шт. в `POST /v1/catalog/upsert`.

---

## 🇬🇧 Installation & Setup Guide (EN)

### 1. Requirements
- **WordPress**: 6.0+
- **WooCommerce**: 7.0+
- **PHP**: 8.0+ (`ext-curl`, `ext-mbstring`)
- Running **EIDOS** instance (`http://localhost:3000` or HTTPS endpoint)

### 2. Installation via WordPress Admin
1. Zip the `packages/connectors/woocommerce` folder into `eidos-woocommerce.zip`.
2. In WordPress Admin, navigate to **Plugins → Add New → Upload Plugin**.
3. Upload `eidos-woocommerce.zip` and click **Activate**.

### 3. Configuration
1. Generate WooCommerce REST API keys under **WooCommerce → Settings → Advanced → REST API** (`Read` permissions).
2. Navigate to **Settings → EIDOS Search**.
3. Enter your **EIDOS Server URL**, **EIDOS API Key**, and **WooCommerce Consumer Key / Secret**.
4. Click **Check Connection** (`healthCheck`) to verify connectivity, then click **Synchronize** (`syncCatalog`) to index all products and variations.

---

## Архитектура и 6 методов контракта EIDOS Connector v1.0

1. **`syncCatalog(array $options = []): array`**
   - Запрашивает родительские товары через `GET /wp-json/wc/v3/products?per_page=100&page=N`.
   - Для каждого `variable`-товара запрашивает вариации через `GET /wp-json/wc/v3/products/{id}/variations`.
   - Преобразует через `mapFields()` и отправляет батчами по 100 шт. в `POST /v1/catalog/upsert` (`{"items": [...]}`).
2. **`syncDelta(DateTimeInterface $since, int $batchSize = 100): array`**
   - Запрашивает изменённые товары через `GET /wp-json/wc/v3/products?modified_after={ISO8601}&per_page=100`.
   - Подтягивает вариации для изменённых `variable`-товаров и идемпотентно отправляет батчами в EIDOS.
3. **`replaceSearch(string $query, array $options = []): array`**
   - Перехватывает хук `pre_get_posts` на основном поисковом запросе витрины.
   - При успешном ответе `POST /v1/search` устанавливает `$query->set('post__in', $ids)`, `$query->set('post_type', ['product', 'product_variation'])` и `$query->set('orderby', 'post__in')`.
   - При ошибке или таймауте EIDOS **не модифицирует `$query`**, оставляя в работе стандартный поиск WordPress/WooCommerce (Graceful Fallback).
4. **`pushFeedback(array $event): bool`**
   - Принимает события кликов через REST-роут `POST /wp-json/eidos/v1/feedback` от `assets/js/feedback.js` (`navigator.sendBeacon`) и пересылает их в `POST /v1/feedback` с неблокирующим таймаутом `1.0s`.
5. **`healthCheck(): array`**
   - Выполняет `GET /v1/health` (таймаут `3.0s`) и возвращает `['ok' => bool, 'version' => string, 'itemsIndexed' => int, 'latencyMs' => float, 'error' => ?string]`.
6. **`mapFields(WC_Product|array $product): array`**
   - Очищает HTML-теги из описания (`wp_strip_all_tags`), извлекает категории (`product_cat`), теги (`product_tag`), цену, наличие (`is_in_stock`), permalink и URL изображения.
