# Интеграция EIDOS v3.4.0 с 1С-Битрикс (Коннектор `packages/connectors/bitrix` и HTTP API)

> **Статус**: Pilot-Ready (`v3.4.0-pilot`). Интеграция выполняется через официальный PHP-пакет `packages/connectors/bitrix` (или cron-скрипт `/local/php_interface/cron/eidos_sync.php`) без публикации в Marketplace 1С-Битрикс. Для магазинов на WordPress/WooCommerce см. зеркальное руководство [`docs/integrations/woocommerce.md`](./woocommerce.md).

---

## Системные требования и контракт идентификаторов

- **PHP**: `>= 8.1`
- **Расширения PHP**:
  - `ext-curl` (обязательно для HTTP-запросов к `/v1/*`)
  - `ext-mbstring` (рекомендуется; в `Mapper.php` также встроен безопасный UTF-8 fallback `preg_match_all('/./us', ...)` при отсутствии `ext-mbstring`)
- **Контракт `id` и `sku`**:
  - `id` в EIDOS — всегда строковый **`ELEMENT_ID`** (`(string) $row['ID']`), чтобы гидратация через `CIBlockElement::GetList` работала за $O(1)$ без коллизий.
  - Внешний код 1С **`XML_ID`** передаётся строго в поле `sku` и мета-тег `__eidos_sku:<xml_id>`.
- **Разделение ключей (`ADMIN_KEY` vs `SEARCH_KEY`)**:
  - `EIDOS_ADMIN_KEY` — используется только в cron/агенте выгрузки (`POST /v1/catalog/upsert`).
  - `EIDOS_SEARCH_KEY` — ключ только для чтения, используется на витрине (`POST /v1/search`, `POST /v1/recommend`, `POST /v1/feedback`).
- **Защита от удалённых товаров (`stale IDs`)**:
  - Если товар был удалён или деактивирован в инфоблоке Битрикса до следующей переиндексации (`markItemDeletedInBitrix` / `activeBitrixIds`), `SearchReplacer` пропускает устаревший `ID` без ошибки `500`.

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
$eidosUrl = getenv('EIDOS_API_URL') ?: 'http://127.0.0.1:3000';
$adminKey = getenv('EIDOS_ADMIN_KEY') ?: 'your-admin-key';

$items = [];
$res = CIBlockElement::GetList(
    ['ID' => 'ASC'],
    ['IBLOCK_ID' => $iblockId, 'ACTIVE' => 'Y'],
    false,
    ['nTopCount' => 1000],
    ['ID', 'XML_ID', 'NAME', 'PREVIEW_TEXT', 'DETAIL_TEXT', 'DETAIL_PAGE_URL', 'IBLOCK_SECTION_ID', 'CATALOG_GROUP_1']
);

while ($row = $res->GetNext()) {
    $price = max(0.0, (float)($row['CATALOG_PRICE_1'] ?? 0));
    $description = trim(strip_tags($row['PREVIEW_TEXT'] ?: $row['DETAIL_TEXT']));
    if ($description === '') {
        $description = $row['NAME'];
    }

    $items[] = [
        'id'          => (string)$row['ID'], // Строго ELEMENT_ID
        'sku'         => (string)($row['XML_ID'] ?: $row['ID']), // Внешний код 1С XML_ID
        'title'       => html_entity_decode($row['NAME'], ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'description' => html_entity_decode($description, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'category'    => 'Каталог',
        'price'       => $price,
        'inStock'     => ($row['CATALOG_AVAILABLE'] ?? 'Y') === 'Y',
        'url'         => (string)($row['DETAIL_PAGE_URL'] ?? ''),
        'tags'        => !empty($row['XML_ID']) ? ['__eidos_sku:' . $row['XML_ID']] : [],
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

## 2. Поисковый запрос на витрине (`POST /v1/search` с `SEARCH_KEY` и Fallback)

```php
<?php
function eidosSearch(string $query, ?float $maxPrice = null, int $limit = 12): array {
    $eidosUrl  = getenv('EIDOS_API_URL') ?: 'http://127.0.0.1:3000';
    $searchKey = getenv('EIDOS_SEARCH_KEY') ?: 'your-search-key';

    $payload = [
        'query'              => $query,
        'limit'              => $limit,
        'alpha'              => 0.65,
        'simpleCategoryGate' => 'hard', // Приоритет целевой категории товара над модификаторами
    ];
    if ($maxPrice !== null) {
        $payload['filters'] = ['max_price' => $maxPrice];
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
        CURLOPT_TIMEOUT        => 2,
    ]);

    $raw = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $httpCode < 200 || $httpCode >= 300) {
        // Graceful Fallback: верните null/признак fallback, чтобы компонент вызвал штатный CSearch / CIBlockElement::GetList
        return ['fallback' => true, 'results' => []];
    }

    return json_decode((string)$raw, true) ?: ['results' => []];
}
```
