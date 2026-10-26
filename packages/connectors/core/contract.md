# Контракт EIDOS Connector v1.0 (Core Specification)

Версия контракта: **1.0.0**  
Статус: **Stable / Production-Ready**  
Протокол взаимодействия: **HTTP/HTTPS REST API (`/v1/*`)**

---

## 1. Архитектурные инварианты

1. **Полная изоляция**:
   - Коннектор располагается в `packages/connectors/<system>/` и имеет собственный манифест зависимостей (`composer.json` для PHP, `package.json` для JS/TS).
   - Коннектор **не импортирует** код из `packages/core/` и не обращается к внутренним структурам данных EIDOS напрямую.
   - Всё взаимодействие осуществляется исключительно по протоколу HTTPS через публичные эндпоинты EIDOS:
     - `POST /v1/catalog/upsert`
     - `POST /v1/search`
     - `POST /v1/feedback`
     - `GET /v1/health`

2. **Отказоустойчивость (Graceful Fallback)**:
   - Любой сбой EIDOS (сетевой таймаут, HTTP 5xx, ошибка DNS/TLS, некорректный JSON) при вызове `replaceSearch()` **обязан** прозрачно переключать выполнение на штатный поисковый движок CMS (`CIBlockElement::GetList` / `CSearch` в 1С-Битрикс, `WP_Query` / `wc_get_products` в WooCommerce).
   - Покупатель интернет-магазина никогда не должен видеть страницу с ошибкой или пустую выдачу из-за недоступности внешнего сервиса поиска.

3. **Единый формат логирования**:
   - Все ошибки записываются в системный журнал CMS (`AddMessage2Log` в 1С-Битрикс, `wc_get_logger()` в WooCommerce) в строгом формате:
     ```text
     [EIDOS] <method> <error>
     ```

4. **Безопасность**:
   - Все запросы выполняются по `https://` (в production-режиме HTTP-схема отклоняется).
   - API-ключ передаётся в заголовках `Authorization: Bearer <API_KEY>` и `X-API-Key: <API_KEY>` и хранится в хранилище настроек CMS (`b_option` / `wp_options`), а не в исходном коде.
   - Все входные строки (`query`, `filters`) проходят санитизацию и экранирование перед сериализацией в JSON.

---

## 2. Обязательные методы интерфейса (6 методов)

### 2.1. `syncCatalog(array $options = []): array`
Полная синхронизация товарного каталога из CMS в EIDOS.
- **Параметры `$options`**:
  - `batchSize` (`int`, по умолчанию `100`): размер пакета выгрузки из БД CMS.
  - `onProgress` (`callable|null`): `function(int $processed, int $total, int $synced, int $failed): void` для обновления UI прогресс-бара.
  - `forceSync` (`bool`, по умолчанию `false`): если в каталоге `> 500` товаров и `forceSync === false` (вызов из веб-админки), коннектор ставит задачу в фоновую очередь/cron-агент и возвращает статус постановки в очередь (`queued => true`), чтобы не блокировать HTTP-воркер админки.
- **Алгоритм**:
  - Итерирует товары батчами по `batchSize`.
  - Для каждого товара вызывает `mapFields($item)`, затем отправляет `POST /v1/catalog/upsert`.
- **Возвращаемое значение**:
  ```php
  [
      'synced' => int,
      'failed' => int,
      'errors' => array<int, string>,
      'queued' => bool, // опционально true при > 500 товаров в web-режиме
  ]
  ```

### 2.2. `syncDelta(\DateTimeInterface $since, int $batchSize = 100): array`
Инкрементальная синхронизация товаров, изменённых начиная с момента `$since`.
- **Источники изменений**:
  - 1С-Битрикс: фильтр `>=TIMESTAMP_X` по `b_iblock_element` (или `DATE_CHANGE` в `b_search_content`).
  - WooCommerce: `wc_get_products(['date_modified' => '>=' . $since->format('Y-m-d H:i:s')])`.
- **Идемпотентность**:
  - Повторный вызов с тем же `$since` обновляет детерминированные `id` через `POST /v1/catalog/upsert` и отслеживает хэши/водяной знак (`watermark`), исключая дублирование записей.
- **Возвращаемое значение**:
  ```php
  [
      'synced' => int,
      'since'  => \DateTimeInterface, // новая метка времени для следующего запуска
  ]
  ```

### 2.3. `replaceSearch(string $query, array $options = []): array`
Гибридный семантический + лексический поиск через `POST /v1/search` с возвратом результатов в **нативном формате CMS**.
- **Параметры `$options`**:
  - `limit` (`int`, по умолчанию `20`)
  - `filters` (`array`: `category`, `minPrice`, `maxPrice`, `inStock`)
  - `alpha` (`float`, по умолчанию `0.65`)
  - `diversityFactor` (`float`, по умолчанию `0.35`)
- **Формат возврата**:
  - **1С-Битрикс**: список ассоциативных массивов с ключами `ID`, `NAME`, `DETAIL_PAGE_URL`, `PRICE`, `PREVIEW_PICTURE`.
  - **WooCommerce**: список объектов `WC_Product` или `WP_Post`.
- **Fallback**: при недоступности EIDOS автоматически вызывает нативный поиск CMS.

### 2.4. `pushFeedback(array $event): bool`
Отправка поведенческого сигнала пользователя в `POST /v1/feedback`.
- **Входной массив `$event`**:
  ```php
  [
      'userId'    => string,
      'itemId'    => string,
      'eventType' => 'click' | 'like' | 'purchase' | 'dislike',
      'query'     => ?string,
      'timestamp' => \DateTimeInterface,
  ]
  ```
- **Поведение**:
  - Не блокирует основной поток рендеринга (короткий таймаут / отложенная отправка через `register_shutdown_function` / `fastcgi_finish_request` при наличии).
  - При ошибке логирует `[EIDOS] pushFeedback <error>` и возвращает `false`.

### 2.5. `healthCheck(): array`
Проверка доступности и состояния индекса EIDOS через `GET /v1/health`.
- **Таймаут**: строго `3.0` секунды (`3000 мс`).
- **Возвращаемое значение**:
  ```php
  [
      'ok'           => bool,
      'version'      => string,
      'itemsIndexed' => int,
      'latencyMs'    => float,
      'error'        => ?string, // 'timeout' при превышении 3 секунд
  ]
  ```

### 2.6. `mapFields(mixed $systemItem): array`
Преобразование карточки товара из структуры CMS в каноническую схему EIDOS Connector v1.0 (`schema.json`).
- **Правила очистки**:
  - `description`: удаление всех HTML-тегов (`strip_tags`), декодирование HTML-сущностей, схлопывание пробелов, обрезка до `5000` символов (UTF-8 `mb_substr`).
- **Возвращаемое значение**:
  ```php
  [
      'id'          => string,
      'title'       => string,
      'description' => string,
      'category'    => string,
      'price'       => float,
      'inStock'     => bool,
      'tags'        => array<int, string>,
      'url'         => string,
      'imageUrl'    => ?string,
  ]
  ```
