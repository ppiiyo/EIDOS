<?php

declare(strict_types=1);

/**
 * AJAX / sendBeacon обработчик пользовательских сигналов (клики, покупки) для 1С-Битрикс.
 * Устанавливается в /bitrix/tools/eidos_feedback.php.
 * Не блокирует переход пользователя по ссылке и возвращает 204 No Content.
 */

if (!defined('NO_KEEP_STATISTIC')) {
    define('NO_KEEP_STATISTIC', true);
}
if (!defined('NOT_CHECK_PERMISSIONS')) {
    define('NOT_CHECK_PERMISSIONS', true);
}

$docRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
$prologPath = $docRoot . '/bitrix/modules/main/include/prolog_before.php';
if ($docRoot !== '' && is_file($prologPath)) {
    require_once $prologPath;
}

if (class_exists('\CModule')) {
    \CModule::IncludeModule('eidos.connector');
}

$localInclude = dirname(__DIR__) . '/include.php';
if (is_file($localInclude)) {
    require_once $localInclude;
}

$rawBody = isset($GLOBALS['__EIDOS_TEST_RAW_BODY'])
    ? (string) $GLOBALS['__EIDOS_TEST_RAW_BODY']
    : (string) file_get_contents('php://input');

$data = json_decode($rawBody, true);

if (is_array($data) && !empty($data['itemId'])) {
    global $USER;
    $userId = '';
    if (isset($USER) && is_object($USER) && method_exists($USER, 'GetID')) {
        $uid = (string) $USER->GetID();
        if ($uid !== '' && $uid !== '0') {
            $userId = $uid;
        }
    }
    if ($userId === '') {
        $sid = session_id();
        $userId = ($sid !== false && $sid !== '') ? $sid : ((string) ($data['userId'] ?? 'anon_bitrix'));
    }

    $connector = isset($GLOBALS['__EIDOS_TEST_CONNECTOR']) && $GLOBALS['__EIDOS_TEST_CONNECTOR'] instanceof \Eidos\Connectors\Bitrix\Connector
        ? $GLOBALS['__EIDOS_TEST_CONNECTOR']
        : \EidosConnector::fromBitrixOptions(false);

    $connector->pushFeedback([
        'userId' => $userId,
        'itemId' => (string) $data['itemId'],
        'eventType' => (string) ($data['eventType'] ?? 'click'),
        'query' => (string) ($data['query'] ?? ''),
        'timestamp' => date('c'),
    ]);
}

if (!headers_sent()) {
    http_response_code(204);
}
