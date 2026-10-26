# Коннектор EIDOS для 1С-Битрикс (`eidos.connector` v1.0)

Изолированный production-ready модуль гибридного поиска и рекомендаций **EIDOS** для CMS **«1С-Битрикс: Управление сайтом»** (редакции «Малый бизнес», «Бизнес», «Энтерпрайз»).

Коннектор работает строго поверх публичного HTTP REST API (`/v1/*`), не модифицирует ядро EIDOS или системные таблицы Битрикса и автоматически переключается на штатный поиск `bitrix:search.page` / `CIBlockElement::GetList`, если сервер EIDOS недоступен.

---

## Структура модуля (`/local/modules/eidos.connector/`)

```text
packages/connectors/bitrix/ (или /local/modules/eidos.connector/)
├── install/
│   ├── index.php          # Установка модуля, регистрация CAgent, копирование компонентов и tools
│   └── version.php        # Версия модуля (1.0.0)
├── src/ (и lib/)
│   ├── Connector.php      # Основной класс коннектора (6 методов контракта + syncDeltaAgent)
│   ├── HttpClient.php     # Обёртка над cURL с таймаутами (3 сек) и AddMessage2Log
│   ├── Mapper.php         # Маппинг полей инфоблока Битрикс -> схема EIDOS
│   ├── SearchReplacer.php # Перехват поиска с обязательным fallback на Битрикс
│   └── Settings.php       # Управление настройками в b_option (COption)
├── admin/
│   └── options.php        # Страница настроек в админке со статусом Health-check
├── options.php            # Точка входа настроек модуля Битрикс
├── components/
│   └── eidos/
│       └── search.page/   # Кастомный компонент поиска eidos:search.page
│           ├── .description.php
│           ├── component.php
│           └── templates/.default/template.php
├── tools/
│   └── eidos_feedback.php # Неблокирующий обработчик кликов (navigator.sendBeacon -> 204 No Content)
├── lang/ru/
│   └── options.php        # Локализация админки (RU)
├── cron/
│   └── sync-delta.php     # CLI-скрипт ежечасной инкрементальной синхронизации
└── include.php            # Автозагрузка классов и глобальный алиас EidosConnector
```

---

## Карта интеграции с 1С-Битрикс

| Задача | Где в 1С-Битрикс | Как используется |
|---|---|---|
| Товары (инфоблоки) | `b_iblock_element`, `CIBlockElement::GetList()` | Источник данных для `syncCatalog()` |
| Цены и остатки | `b_catalog_price` (`CPrice::GetBasePrice()`), `b_catalog_product` (`CCatalogProduct::GetByID()`) | Извлечение базовой цены и `inStock` |
| Инкрементальная дельта | `b_iblock_element.TIMESTAMP_X` (`>TIMESTAMP_X`, сортировка `ASC`) | `syncDelta($since)` возвращает точный `TIMESTAMP_X` последнего товара |
| Агенты (cron) | `CAgent::AddAgent("EidosConnector::syncDeltaAgent();", "eidos.connector", "N", 3600)` | Автоматический запуск `syncDelta` раз в час |
| Поиск с fallback | Компонент `eidos:search.page` | Вызывает `POST /v1/search`, при ошибке/таймауте передаёт управление `bitrix:search.page` |
| Обратная связь (клики) | `/bitrix/tools/eidos_feedback.php` + `navigator.sendBeacon` | Неблокирующая отправка кликов в `POST /v1/feedback` (`204 No Content`) |
| Настройки модуля | `b_option` (`COption::GetOptionString` / `SetOptionString`) | Хранение `api_url`, `api_key`, `iblock_id`, `last_sync` |
| Логирование | `AddMessage2Log('[EIDOS] ...', 'eidos.connector')` | Запись ошибок соединения и таймаутов в журнал событий Битрикс |

---

## Быстрая установка в 1С-Битрикс

### Вариант 1. Как нативный модуль `/local/modules/eidos.connector/`
1. Скопируйте содержимое `packages/connectors/bitrix` в `/local/modules/eidos.connector/`.
2. В административной панели перейдите в **Marketplace → Установленные решения** (`/bitrix/admin/partner_modules.php`) и нажмите **«Установить»** напротив **«EIDOS: Гибридный поиск и рекомендации»**.
3. При установке модуль автоматически:
   - скопирует компонент `eidos:search.page` в `/bitrix/components/eidos/search.page/`;
   - скопирует обработчик кликов в `/bitrix/tools/eidos_feedback.php`;
   - зарегистрирует ежечасный агент `EidosConnector::syncDeltaAgent();` в `CAgent`.

### Вариант 2. Через Composer
```bash
cd packages/connectors/bitrix
composer install
```

---

## Настройка в административной панели
1. Откройте **Настройки → Настройки продукта → Настройки модулей → EIDOS: Гибридный поиск и рекомендации**.
2. Укажите:
   - **URL сервера EIDOS**: например, `https://eidos.myshop.ru`
   - **API-ключ EIDOS**: секретный ключ вашего инстанса EIDOS
   - **ID инфоблока товаров**: ID торгового каталога
3. Нажмите **«Проверить связь»** — отобразится статус:
   - `✅ EIDOS доступен (товаров в индексе: 1000)`
   - или `❌ EIDOS недоступен (поиск работает через стандартный Битрикс)`
4. Нажмите **«Синхронизировать сейчас»** для первичной загрузки каталога в EIDOS.

---

## Запуск тестов (PHPUnit)
```bash
cd packages/connectors/bitrix
./vendor/bin/phpunit --colors=always tests/ConnectorTest.php
```
