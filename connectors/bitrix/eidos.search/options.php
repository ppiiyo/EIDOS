<?php
/**
 * 1C-Bitrix Module Options & 4-Step Setup Wizard (connectors/bitrix/eidos.search/options.php)
 * Step 1: Connection (API URL, SEARCH_KEY, ADMIN_KEY -> GET /v1/ready)
 * Step 2: Sync IBlock (CIBlockElement::GetList in batches of 200 -> POST /v1/catalog/upsert)
 * Step 3: Storefront (Enable Live Suggest + Replace search.page with CSearch fallback)
 * Step 4: Verify (5-query control check: 3 real SKU, 1 layout typo, 1 garbage -> 0)
 */

use Bitrix\Main\Config\Option;
use Bitrix\Main\Web\HttpClient;

$module_id = 'eidos.search';
$batchSize = 200;
$timeoutSec = 2;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && check_bitrix_sessid()) {
    Option::set($module_id, 'api_url', trim((string)($_POST['api_url'] ?? 'http://localhost:3001')));
    Option::set($module_id, 'search_key', trim((string)($_POST['search_key'] ?? '')));
    Option::set($module_id, 'admin_key', trim((string)($_POST['admin_key'] ?? '')));
    Option::set($module_id, 'iblock_id', (string)(intval($_POST['iblock_id'] ?? 2)));
    Option::set($module_id, 'enable_suggest', isset($_POST['enable_suggest']) ? 'Y' : 'N');
    Option::set($module_id, 'replace_search', isset($_POST['replace_search']) ? 'Y' : 'N');
}

/**
 * Fail-safe search helper for Bitrix search.page component:
 * Queries EIDOS POST /v1/search with 2.5s timeout; falls back to native CSearch on error/5xx/503 INDEX_EMPTY.
 */
function eidosBitrixSearchWithFallback(string $query, int $limit = 24): array
{
    $module_id = 'eidos.search';
    $apiUrl = rtrim(Option::get($module_id, 'api_url', 'http://localhost:3001'), '/');
    $searchKey = Option::get($module_id, 'search_key', '');

    $http = new HttpClient(['socketTimeout' => 2, 'streamTimeout' => 2]);
    $http->setHeader('Content-Type', 'application/json');
    $http->setHeader('X-API-Key', $searchKey);
    $http->setHeader('X-Eidos-Fail-Closed', 'true');

    $raw = $http->post($apiUrl . '/v1/search', json_encode([
        'query' => $query,
        'limit' => $limit,
        'simpleCategoryGate' => 'hard',
    ], JSON_UNESCAPED_UNICODE));

    $status = $http->getStatus();
    $decoded = is_string($raw) ? json_decode($raw, true) : null;

    if ($status !== 200 || !is_array($decoded) || (isset($decoded['code']) && $decoded['code'] === 'INDEX_EMPTY')) {
        // Automatic fallback to native 1C-Bitrix CSearch
        $nativeIds = [];
        if (class_exists('CSearch')) {
            $obSearch = new CSearch();
            $obSearch->Search(['QUERY' => $query, 'MODULE_ID' => 'iblock']);
            while ($arResult = $obSearch->GetNext()) {
                $nativeIds[] = $arResult['ITEM_ID'];
            }
        }
        return ['ok' => false, 'fallback' => true, 'items' => $nativeIds];
    }

    return ['ok' => true, 'fallback' => false, 'results' => $decoded['results'] ?? [], 'meta' => $decoded['meta'] ?? []];
}

/**
 * Maps a 1C-Bitrix IBlock element into EIDOS upsert contract (id, sku, title, category, price, url, imageUrl).
 */
function eidosBitrixMapElement(array $arFields, array $arProps = []): array
{
    $id = (string)($arFields['ID'] ?? '');
    $article = trim((string)($arProps['CML2_ARTICLE']['VALUE'] ?? $arProps['ARTNUMBER']['VALUE'] ?? $arFields['XML_ID'] ?? ''));
    $sku = $article !== '' ? $article : $id;
    $url = !empty($arFields['DETAIL_PAGE_URL']) ? (string)$arFields['DETAIL_PAGE_URL'] : ('/catalog/' . rawurlencode($id) . '/');
    $imageUrl = !empty($arFields['DETAIL_PICTURE_SRC'])
        ? (string)$arFields['DETAIL_PICTURE_SRC']
        : (!empty($arFields['PREVIEW_PICTURE_SRC']) ? (string)$arFields['PREVIEW_PICTURE_SRC'] : null);

    return [
        'id'          => $id,
        'sku'         => $sku,
        'title'       => strip_tags((string)($arFields['NAME'] ?? '')),
        'description' => strip_tags((string)($arFields['PREVIEW_TEXT'] ?: ($arFields['DETAIL_TEXT'] ?? ''))),
        'category'    => (string)($arFields['SECTION_NAME'] ?? 'Каталог'),
        'price'       => (float)($arFields['CATALOG_PRICE_1'] ?? 0),
        'inStock'     => ((float)($arFields['CATALOG_QUANTITY'] ?? 1)) > 0,
        'url'         => $url,
        'imageUrl'    => $imageUrl,
        'tags'        => array_values(array_filter([$sku, $arFields['SECTION_NAME'] ?? null])),
    ];
}
