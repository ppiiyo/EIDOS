<?php

if (!defined('B_PROLOG_INCLUDED') || B_PROLOG_INCLUDED !== true) {
    // Allow inclusion in standalone test runner as well as Bitrix kernel
}

$arComponentDescription = [
    'NAME' => 'Страница гибридного поиска EIDOS',
    'DESCRIPTION' => 'Заменяет стандартный поиск 1С-Битрикс на гибридный поиск EIDOS (BM25 + векторный поиск) с автоматическим fallback на bitrix:search.page',
    'ICON' => '/images/search_page.gif',
    'CACHE_PATH' => 'Y',
    'PATH' => [
        'ID' => 'eidos',
        'NAME' => 'EIDOS Поиск и Рекомендации',
    ],
];
