# Интеграция EIDOS v3.4.0 с 1С-Битрикс (HTTP API / Cron-выгрузка)

> **Важно**: В EIDOS v3.4.0 нет готового коробочного модуля в Marketplace 1С-Битрикс. Интеграция выполняется напрямую по стандартному HTTP REST API за 30–60 минут с помощью штатного агента/cron-скрипта выгрузки инфоблока каталога и клиентского/серверного запроса к `/v1/search`.

---

## Архитектура интеграции

1. **Синхронизация каталога (1С-Битрикс → EIDOS)**:
   - PHP-скрипт в `/local/php_interface/cron/eidos_sync.php` выбирает активные элементы инфоблока каталога (`CIBlockElement::GetList` или D7 `ElementTable`) вместе с ценой и разделом.
   - Отправляет батч по 500 товаров в `POST /v1/catalog/upsert` с заголовком `Authorization: Bearer <EIDOS_ADMIN_KEY>`.
2. **Умный поиск на витрине (Витрина → EIDOS)**:
   - Компонент поиска (`search.title` / кастомный AJAX-обработчик) отправляет запрос в `POST /v1/search` с заголовком `Authorization: Bearer <EIDOS_SEARCH_KEY>`.
   - Получает отсортированные `id` (XML_ID или ID элемента инфоблока), `score` и `xray`-объяснение релевантности.

---

## 1. Выгрузка товаров из инфоблока (`POST /v1/catalog/upsert`)

Пример cron-скрипта `/local/php_interface/cron/eidos_sync.php`:

```php
<?php
$_SERVER["DOCUMENT_ROOT"] = realpath(dirname(__FILE__) . "/../../..");
define("NO_KEEP_STATISTIC", true);
define("NOT_CHECK_PERMISSIONS", true);
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");

\Bitrix\Main\Loader::includeModule('iblock');
\Bitrix\Main\Loader::includeModule('catalog');

$iblockId = 2; // ID инфоблока каталога
$eidosUrl = getenv('EIDOS_API_URL') ?: 'http://127.0.0.1:3001';
$adminKey = getenv('EIDOS_ADMIN_KEY') ?: 'your-admin-key';

$items = [];
$res = CIBlockElement::GetList(
    ['ID' => 'ASC'],
    ['IBLOCK_ID' => $iblockId, 'ACTIVE' => 'Y'],
    false,
    ['nTopCount' => 1000],
    ['ID', 'XML_ID', 'NAME', 'PREVIEW_TEXT', 'DETAIL_TEXT', 'IBLOCK_SECTION_ID', 'CATALOG_GROUP_1']
);

while ($row = $res->GetNext()) {
    $price = (float)($row['CATALOG_PRICE_1'] ?? 0);
    $description = trim(strip_tags($row['PREVIEW_TEXT'] ?: $row['DETAIL_TEXT']));
    if ($description === '') {
        $description = $row['NAME'];
    }

    $items[] = [
        'id'          => (string)$row['ID'],
        'sku'         => (string)($row['XML_ID'] ?: $row['ID']),
        'title'       => html_entity_decode($row['NAME'], ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'description' => html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'category'    => 'Каталог',
        'price'       => $price,
        'inStock'     => ($row['CATALOG_AVAILABLE'] ?? 'Y') === 'Y',
        'tags'        => [],
    ];
}

$ch = curl_init($eidosUrl . '/v1/catalog/upsert');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $adminKey,
    ],
    CURLOPT_POSTFIELDS     => json_encode(['items' => $items], JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT        => 30,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    fwrite(STDERR, "EIDOS sync failed ($httpCode): $response\n");
    exit(1);
}

echo "EIDOS sync OK: " . count($items) . " items indexed.\n";
```

---

## 2. Поисковый запрос из PHP / AJAX (`POST /v1/search`)

```php
<?php
function eidosSearch(string $query, ?float $maxPrice = null, int $limit = 12): array {
    $eidosUrl  = getenv('EIDOS_API_URL') ?: 'http://127.0.0.1:3001';
    $searchKey = getenv('EIDOS_SEARCH_KEY') ?: 'your-search-key';

    $payload = [
        'query' => $query,
        'limit' => $limit,
        'alpha' => 0.5, // 0.5 = баланс BM25 + векторной семантики
        'filters' => [
            'inStock' => true,
        ],
    ];
    if ($maxPrice !== null) {
        $payload['filters']['maxPrice'] = $maxPrice;
    }

    $ch = curl_init($eidosUrl . '/v1/search');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $searchKey,
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT        => 3,
    ]);

    $raw = curl_exec($ch);
    curl_close($ch);

    return json_decode((string)$raw, true) ?: ['results' => []];
}
```
