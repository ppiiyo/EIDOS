<?php
declare(strict_types=1);

/**
 * EIDOS Server-Side Search Proxy for 1C-Bitrix Storefronts
 *
 * Why use this proxy?
 * - Keeps EIDOS_API_URL and EIDOS_SEARCH_KEY on the Bitrix server (out of HTML source if desired)
 * - Avoids browser CORS preflight requests when EIDOS runs on an internal Docker network
 * - Provides graceful fallback (`fallback_native=Y`) if EIDOS is temporarily unreachable
 *
 * Deployment:
 * Copy or symlink this file to `/local/tools/eidos_search.php` in your 1C-Bitrix installation,
 * then configure the storefront widget with:
 *   data-api="/local/tools/eidos_search.php"
 *   data-key="eidos_sk_proxy"
 */

define('STOP_STATISTICS', true);
define('NO_KEEP_STATISTIC', 'Y');
define('NO_AGENT_STATISTIC', 'Y');
define('DisableEventsCheck', true);

// Bootstrap Bitrix prolog_before if running inside a real 1C-Bitrix environment
$docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
$prologPath = rtrim($docRoot, '/') . '/bitrix/modules/main/include/prolog_before.php';
if ($docRoot !== '' && is_file($prologPath)) {
    require_once $prologPath;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

// Read configuration from Bitrix Module Options or environment variables
$apiUrl = getenv('EIDOS_API_URL') ?: 'http://127.0.0.1:3000';
$searchKey = getenv('EIDOS_SEARCH_KEY') ?: '';
$timeoutSec = 2;

if (class_exists('\Bitrix\Main\Config\Option')) {
    $optUrl = \Bitrix\Main\Config\Option::get('eidos.search', 'api_url', '');
    $optKey = \Bitrix\Main\Config\Option::get('eidos.search', 'search_key', '');
    if ($optUrl !== '') {
        $apiUrl = $optUrl;
    }
    if ($optKey !== '') {
        $searchKey = $optKey;
    }
}

// Parse request input (supports POST JSON from widget.js or GET ?q=...&limit=8)
$rawBody = file_get_contents('php://input');
$payload = [];
if (is_string($rawBody) && trim($rawBody) !== '') {
    $decoded = json_decode($rawBody, true);
    if (is_array($decoded)) {
        $payload = $decoded;
    }
}

$query = isset($payload['query']) ? trim((string)$payload['query']) : trim((string)($_REQUEST['q'] ?? ''));
$limit = isset($payload['limit']) ? (int)$payload['limit'] : (int)($_REQUEST['limit'] ?? 8);
$limit = max(1, min(25, $limit));
$fallbackNative = (($_REQUEST['fallback_native'] ?? 'Y') !== 'N');

if (mb_strlen($query) < 2) {
    echo json_encode([
        'query' => $query,
        'count' => 0,
        'total' => 0,
        'took_ms' => 0,
        'results' => [],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Guard against accidental ADMIN/MASTER key usage in search proxy
if (str_starts_with($searchKey, 'eidos_mk_') || str_starts_with($searchKey, 'eidos_ak_')) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Invalid Key Type',
        'message' => 'Configure EIDOS_SEARCH_KEY (read-only Search Key), never MASTER_KEY or ADMIN_KEY.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$targetEndpoint = rtrim($apiUrl, '/') . '/v1/search';
$requestBody = json_encode([
    'query' => $query,
    'limit' => $limit,
    'explain' => false,
], JSON_UNESCAPED_UNICODE);

$responseBody = null;
$httpStatus = 0;

if (class_exists('\Bitrix\Main\Web\HttpClient')) {
    $client = new \Bitrix\Main\Web\HttpClient([
        'socketTimeout' => $timeoutSec,
        'streamTimeout' => $timeoutSec,
        'waitResponse' => true,
    ]);
    $client->setHeader('Content-Type', 'application/json');
    if ($searchKey !== '') {
        $client->setHeader('Authorization', 'Bearer ' . $searchKey);
        $client->setHeader('X-API-Key', $searchKey);
    }
    $result = $client->post($targetEndpoint, $requestBody);
    $httpStatus = (int)$client->getStatus();
    if ($result !== false) {
        $responseBody = (string)$result;
    }
} else {
    // Standard PHP stream context fallback when running outside Bitrix D7 core
    $headers = ["Content-Type: application/json"];
    if ($searchKey !== '') {
        $headers[] = "Authorization: Bearer " . $searchKey;
        $headers[] = "X-API-Key: " . $searchKey;
    }
    $ctx = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => implode("\r\n", $headers),
            'content' => $requestBody,
            'timeout' => $timeoutSec,
            'ignore_errors' => true,
        ],
    ]);
    $result = @file_get_contents($targetEndpoint, false, $ctx);
    if ($result !== false) {
        $responseBody = (string)$result;
        $httpStatus = 200;
        if (isset($http_response_header) && is_array($http_response_header)) {
            foreach ($http_response_header as $hdr) {
                if (preg_match('#^HTTP/\d+\.\d+\s+(\d+)#', $hdr, $m)) {
                    $httpStatus = (int)$m[1];
                }
            }
        }
    }
}

if ($responseBody !== null && $httpStatus >= 200 && $httpStatus < 300) {
    echo $responseBody;
    exit;
}

// Graceful fallback when EIDOS is unreachable
if ($fallbackNative && class_exists('\CSearch')) {
    $nativeResults = [];
    $obSearch = new \CSearch();
    $obSearch->Search(['QUERY' => $query, 'SITE_ID' => defined('SITE_ID') ? SITE_ID : 's1']);
    $idx = 0;
    while (($row = $obSearch->GetNext()) && $idx < $limit) {
        $nativeResults[] = [
            'id' => (string)($row['ITEM_ID'] ?? $idx),
            'title' => html_entity_decode(strip_tags((string)($row['TITLE_FORMATED'] ?? $row['TITLE'] ?? ''))),
            'category' => (string)($row['MODULE_ID'] ?? 'Catalog'),
            'url' => (string)($row['URL'] ?? ''),
            'scorePercent' => max(35, 85 - ($idx * 6)),
        ];
        $idx++;
    }
    echo json_encode([
        'query' => $query,
        'count' => count($nativeResults),
        'total' => count($nativeResults),
        'took_ms' => 0,
        'fallback' => 'bitrix_native',
        'results' => $nativeResults,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(502);
echo json_encode([
    'error' => 'Bad Gateway',
    'message' => 'EIDOS search upstream is temporarily unreachable.',
    'results' => [],
    'count' => 0,
], JSON_UNESCAPED_UNICODE);
