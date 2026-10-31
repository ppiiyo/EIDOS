# Подключение поискового виджета EIDOS к витрине 1C-Bitrix (без переписывания шаблона)

Этот гид описывает **простой путь (Simple Path)** подключения гибридного поиска EIDOS к существующей витрине 1C-Bitrix за 10–15 минут без разработки собственного модуля и без правок ядра Bitrix.

> **Честный статус интеграции:** В официальном 1C-Bitrix Marketplace нет готового коробочного модуля EIDOS. Для пилота на живой витрине используется легковесный JS-виджет (`widget.js`), который подключается поверх стандартной строки поиска `bitrix:search.title`, а также (опционально) серверный PHP-прокси из `packages/connectors/bitrix/tools/eidos_search.php`.

---

## Вариант A — Прямое подключение одной строкой `<script>` (Рекомендуется для старта пилота)

Виджет `widget.js` автоматически находит стандартное поле поиска Bitrix (`#title-search-input`, `input[name="q"]`, `.search-input`) и отображает аккуратный выпадающий список с товарами, ценами, бейджем совпадения и клавиатурной навигацией (`↑`/`↓`/`Enter`/`Esc`).

### Шаг 1. Добавьте скрипт в шаблон сайта

Откройте файл `/local/templates/<ваш_шаблон>/header.php` (или `footer.php` перед закрывающим `</body>`) и вставьте одну строку:

```html
<script
  src="https://search.example.com/widget.js"
  defer
  data-api="https://search.example.com"
  data-key="eidos_sk_ВАШ_SEARCH_KEY"
  data-input="#title-search-input, input[name='q'], .search-input"
  data-limit="8"
  data-product-url-template="/catalog/#ID#/"
></script>
```

### Шаг 2. Как работают ссылки на карточки товаров (`data-product-url-template`)

1. Если при выгрузке каталога в CSV или через ` CatalogSync ` у товара передано поле `url` (например, `/catalog/audio/sony-wh1000xm5/`), виджет использует **точный URL товара**.
2. Если поле `url` в CSV не заполнено, виджет подставляет `id` или `sku` товара в шаблон `data-product-url-template`:
   - `/catalog/#ID#/` → `/catalog/10452/`
   - `/catalog/product/#SKU#/` → `/catalog/product/WH-1000XM5/`

### Шаг 3. Как отключить конфликт со встроенным popup `bitrix:search.title`

В стандартном шаблоне `bitrix:search.title` есть собственный AJAX-скрипт `JCTitleSearch`, который рисует второе выпадающее окно. Чтобы оставить только чистую выдачу EIDOS:

1. В параметрах вызова компонента `bitrix:search.title` в `header.php` (или через визуальный редактор) отключите AJAX-подсказки или укажите уникальный ID инпута:
   ```php
   <?php
   $APPLICATION->IncludeComponent(
       "bitrix:search.title",
       ".default",
       [
           "INPUT_ID" => "title-search-input",
           "CONTAINER_ID" => "title-search",
           // Достаточно закомментировать инициализацию JCTitleSearch в script.js шаблона
           // либо сменить INPUT_ID на "eidos-search-input"
       ],
       false
   );
   ?>
   ```
2. Либо вставьте обычную HTML-форму поиска в шапку шаблона:
   ```html
   <form action="/catalog/" method="get" class="header-search">
     <input id="title-search-input" type="search" name="q" placeholder="Поиск по каталогу..." autocomplete="off" />
   </form>
   ```

---

## Вариант B — Серверный PHP-прокси (`/local/tools/eidos_search.php`)

Если контейнер EIDOS запущен во внутренней сети сервера (`127.0.0.1:3000`) и вы не хотите открывать порт наружу или настраивать CORS:

1. Скопируйте файл `packages/connectors/bitrix/tools/eidos_search.php` в `/local/tools/eidos_search.php` вашего сайта на 1C-Bitrix.
2. Задайте переменные окружения на сервере (или опции модуля `eidos.search`):
   ```bash
   EIDOS_API_URL=http://127.0.0.1:3000
   EIDOS_SEARCH_KEY=eidos_sk_ВАШ_SEARCH_KEY
   ```
3. Подключите `widget.js`, указав `data-api="/local/tools/eidos_search.php"`:
   ```html
   <script
     src="/local/tools/widget.js"
     defer
     data-api="/local/tools/eidos_search.php"
     data-key="eidos_sk_proxy"
     data-input="#title-search-input"
     data-product-url-template="/catalog/#ID#/"
   ></script>
   ```
   При временной недоступности контейнера EIDOS скрипт `eidos_search.php` автоматически переключится на штатный `CSearch` Bitrix (`fallback_native=Y`), чтобы поиск на витрине не прерывался.

---

## Выгрузка каталога из Инфоблока 1C-Bitrix в CSV (без кода)

Для первичной загрузки товаров в мастере `/onboarding`:

1. В админке Bitrix перейдите в **Магазин → Настройки → Экспорт данных → CSV (простой)**.
2. Выберите ваш **Инфоблок каталога товаров** и отметьте поля:
   - `ID` (или `XML_ID`) → переименуйте колонку в `id`
   - `IE_NAME` (Наименование) → `title`
   - `IC_GROUP0` (Раздел) → `category`
   - `CV_PRICE_1` (Базовая цена) → `price`
   - `IE_PREVIEW_TEXT` (Описание) → `description`
   - Свойство «Бренд» → `brand`
   - `IE_DETAIL_PAGE_URL` → `url`
3. Загрузите полученный CSV-файл перетаскиванием (Drag & Drop) на Шаге 2 в мастере **`http://<ваш-сервер>:3000/onboarding`**.

---

## Безопасность, CORS и лимиты (Production Checklist)

- **Только `SEARCH_KEY` в браузере:** Виджет намеренно блокирует работу, если в `data-key` передать `MASTER_KEY` (`eidos_mk_...`) или `ADMIN_KEY` (`eidos_ak_...`). В HTML-коде витрины должен находиться только read-only ключ `EIDOS_SEARCH_KEY` (`eidos_sk_...`).
- **Настройка `CORS_ORIGIN`:** В файле `.env` вашего контейнера EIDOS укажите точный домен витрины:
  ```env
  CORS_ORIGIN=https://your-bitrix-shop.ru
  ```
- **Rate Limiting:** Сервер EIDOS ограничивает частоту запросов с одного IP (по умолчанию `120 req/min`), а `widget.js` использует `debounce(220ms)` и `AbortController`, отменяя промежуточные запросы при быстром вводе.

---

## Чеклист ручной проверки после установки

- [ ] Открыть главную страницу витрины и ввести в поиск 2+ символа (например, название категории или бренда).
- [ ] Проверить, что под строкой поиска за `< 250 мс` появляется выпадающий блок EIDOS с товарами, категорией, ценой и `% совпадения`.
- [ ] Проверить навигацию клавишами `↓`, `↑`, переход по `Enter` в карточку товара и закрытие по `Esc`.
- [ ] Ввести заведомо несуществующий запрос (`zzzz_nonexistent_999`) и убедиться, что отображается аккуратное пустое состояние «По запросу ничего не найдено».
