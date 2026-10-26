<?php

declare(strict_types=1);

/**
 * Кастомный компонент поиска eidos:search.page для 1С-Битрикс.
 * Перехватывает поисковый запрос, обращается к EIDOS POST /v1/search,
 * а при любой ошибке или недоступности автоматически вызывает стандартный bitrix:search.page.
 */

if (class_exists('\CModule')) {
    \CModule::IncludeModule('eidos.connector');
}

$moduleInclude = dirname(__DIR__, 3) . '/include.php';
if (is_file($moduleInclude)) {
    require_once $moduleInclude;
}

$query = trim((string) ($_GET['q'] ?? $_REQUEST['q'] ?? ''));
$arResult['QUERY'] = htmlspecialchars($query, ENT_QUOTES, 'UTF-8');
$arResult['ITEMS'] = [];
$arResult['FALLBACK_USED'] = false;

if ($query !== '') {
    try {
        $connector = \EidosConnector::fromBitrixOptions(false);
        $pageResults = isset($arParams['PAGE_RESULT_COUNT']) ? (int) $arParams['PAGE_RESULT_COUNT'] : 20;

        $items = $connector->replaceSearch($query, [
            'limit' => max(1, $pageResults),
            'alpha' => isset($arParams['ALPHA']) ? (float) $arParams['ALPHA'] : 0.65,
        ]);

        if (!empty($items)) {
            $arResult['ITEMS'] = $items;
        } else {
            // Fallback на стандартный компонент bitrix:search.page
            $arResult['FALLBACK_USED'] = true;
            if (isset($APPLICATION) && is_object($APPLICATION) && method_exists($APPLICATION, 'IncludeComponent')) {
                $APPLICATION->IncludeComponent(
                    'bitrix:search.page',
                    '',
                    $arParams ?? [],
                    $component ?? null
                );
                return;
            }
        }
    } catch (\Throwable $e) {
        if (function_exists('AddMessage2Log')) {
            AddMessage2Log('[EIDOS] Search component fallback: ' . $e->getMessage(), 'eidos.connector');
        }
        $arResult['FALLBACK_USED'] = true;
        if (isset($APPLICATION) && is_object($APPLICATION) && method_exists($APPLICATION, 'IncludeComponent')) {
            $APPLICATION->IncludeComponent(
                'bitrix:search.page',
                '',
                $arParams ?? [],
                $component ?? null
            );
            return;
        }
    }
}

if (isset($this) && is_object($this) && method_exists($this, 'IncludeComponentTemplate')) {
    $this->IncludeComponentTemplate();
}
