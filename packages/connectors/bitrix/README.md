# Коннектор EIDOS для 1С-Битрикс (EIDOS Connector v1.0)

Изолированный production-ready коннектор гибридного поиска и рекомендаций **EIDOS** для CMS **«1С-Битрикс: Управление сайтом»** (редакции «Малый бизнес», «Бизнес», «Энтерпрайз»).

Коннектор работает строго поверх публичного HTTP REST API (`/v1/*`), не модифицирует ядро EIDOS или системные таблицы Битрикса и автоматически переключается на штатный поиск `CIBlockElement::GetList` / `CSearch`, если сервер EIDOS недоступен.

---

## Быстрая установка (RU)

### Шаг 1. Установка пакета
Скопируйте каталог `packages/connectors/bitrix` в `/local/php_interface/eidos-connector/` вашего сайта на 1С-Битрикс и установите автозагрузчик Composer:
```bash
cd /var/www/bitrix/local/php_interface/eidos-connector
composer install --no-dev --optimize-autoloader
```

Подключите автозагрузчик в `/local/php_interface/init.php`:
```php
<?php
require_once $_SERVER['DOCUMENT_ROOT'] . '/local/php_interface/eidos-connector/vendor/autoload.php';
```

### Шаг 2. Настройка в административной панели
1. Откройте страницу настроек в админке: **Настройки → Настройки продукта → Настройки модулей → EIDOS Поиск** (`/bitrix/admin/eidos_connector_settings.php`).
2. Заполните поля:
   - **URL сервера EIDOS (HTTPS)**: например, `https://eidos.myshop.ru` (обязателен протокол `https://`).
   - **API-ключ EIDOS**: секретный ключ вашего инстанса EIDOS (хранится в таблице `b_option`, не попадает в Git).
   - **ID инфоблока каталога**: числовой ID основного торгового каталога.
3. Нажмите **«Проверить связь»** — появится уведомление:
   > `EIDOS доступен, 1000 товаров (версия 3.2.0, задержка 3.4 мс)`
4. Нажмите **«Синхронизировать»**:
   - Если в каталоге `<= 500` товаров, синхронизация выполнится с отображением прогресс-бара.
   - Если в каталоге `> 500` товаров, задача автоматически встанет в фоновый агент `CAgent`, не блокируя интерфейс администратора.

### Шаг 3. Настройка ежечасного Cron (`syncDelta`)
Добавьте задание в системный `crontab` пользователя `bitrix` (запуск раз в час):
```cron
0 * * * * /usr/bin/php /var/www/bitrix/local/php_interface/eidos-connector/cron/sync-delta.php >> /var/log/eidos-sync.log 2>&1
```
Либо зарегистрируйте штатный агент 1С-Битрикс в консоли PHP:
```php
CAgent::AddAgent(
    "\\Eidos\\Connectors\\Bitrix\\Cron\\runHourlySyncDelta();",
    "eidos.connector",
    "N",
    3600
);
```

### Шаг 4. Подключение поиска и фидбека в шаблоне каталога
В компоненте поиска (`search.page` / `catalog.search`):
```php
use Eidos\Connectors\Bitrix\Connector;
use Eidos\Connectors\Bitrix\HttpClient;
use Eidos\Connectors\Bitrix\Settings;

$http = new HttpClient(
    Settings::getOption(Settings::OPT_API_URL),
    Settings::getOption(Settings::OPT_API_KEY)
);
$connector = new Connector($http);

// Возвращает массив в формате Битрикс: [['ID', 'NAME', 'DETAIL_PAGE_URL', 'PRICE', 'PREVIEW_PICTURE'], ...]
$arResult['ITEMS'] = $connector->replaceSearch($_REQUEST['q'] ?? '', [
    'limit' => 20,
    'alpha' => 0.65,
    'diversityFactor' => 0.35,
    'filters' => [
        'inStock' => true,
    ],
]);
```

---

## Quick Installation Guide (EN)

### 1. Install via Composer
```bash
cd packages/connectors/bitrix
composer install
```

### 2. Configure HTTPS Endpoint & API Key
Set the EIDOS HTTPS endpoint and API key via the Bitrix Admin Panel (`Settings::handleAdminAction`). All credentials are saved in Bitrix `b_option` via `Bitrix\Main\Config\Option`.

### 3. Run Acceptance Tests (PHPUnit)
```bash
cd packages/connectors/bitrix
./vendor/bin/phpunit --colors=always tests/ConnectorTest.php
```
