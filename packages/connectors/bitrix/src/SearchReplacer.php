<?php

declare(strict_types=1);

namespace Eidos\Connectors\Bitrix;

/**
 * Executes hybrid search via POST /v1/search in EIDOS, converts results back into native
 * 1C-Bitrix format (ID, NAME, DETAIL_PAGE_URL, PRICE, PREVIEW_PICTURE), and provides
 * seamless fallback to standard Bitrix search (CIBlockElement::GetList / CSearch) if EIDOS is down.
 */
class SearchReplacer
{
    private HttpClient $httpClient;
    private Mapper $mapper;

    /**
     * Local metadata lookup cache populated during sync or hydrated from Bitrix DB.
     * Maps ID => ['DETAIL_PAGE_URL' => string, 'PREVIEW_PICTURE' => ?string, 'PRICE' => float, 'IN_STOCK' => bool, 'NAME' => string, 'CATEGORY' => string]
     *
     * @var array<string, array<string, mixed>>
     */
    private array $localCatalogIndex = [];

    /**
     * Optional custom native Bitrix fallback callback for testing or custom IBlock queries:
     * callable(string $query, array $options): array<int, array<string, mixed>>
     *
     * @var callable|null
     */
    private $nativeSearchFallback;

    public function __construct(
        HttpClient $httpClient,
        Mapper $mapper,
        ?callable $nativeSearchFallback = null
    ) {
        $this->httpClient = $httpClient;
        $this->mapper = $mapper;
        $this->nativeSearchFallback = $nativeSearchFallback;
    }

    /**
     * Caches mapped item metadata locally so search results can be hydrated in O(1) without extra SQL queries.
     *
     * @param array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl?: ?string} $mapped
     */
    public function registerLocalItemMetadata(array $mapped): void
    {
        $this->localCatalogIndex[$mapped['id']] = [
            'ID' => $mapped['id'],
            'NAME' => $mapped['title'],
            'DESCRIPTION' => $mapped['description'],
            'CATEGORY' => $mapped['category'],
            'DETAIL_PAGE_URL' => $mapped['url'],
            'PRICE' => $mapped['price'],
            'PREVIEW_PICTURE' => $mapped['imageUrl'] ?? null,
            'IN_STOCK' => $mapped['inStock'],
            'TAGS' => $mapped['tags'],
        ];
    }

    /**
     * Отправляет POST /v1/search в EIDOS и возвращает результаты в формате 1С-Битрикс:
     * [['ID' => ..., 'NAME' => ..., 'DETAIL_PAGE_URL' => ..., 'PRICE' => ..., 'PREVIEW_PICTURE' => ...], ...]
     *
     * При любой недоступности EIDOS прозрачно переключается на стандартный поиск Битрикса.
     *
     * @param string $query
     * @param array<string, mixed> $options
     * @return array<int, array{ID: string, NAME: string, DETAIL_PAGE_URL: string, PRICE: float, PREVIEW_PICTURE: ?string}>
     */
    public function replaceSearch(string $query, array $options = []): array
    {
        $sanitizedQuery = $this->mapper->cleanPlainText($query, 500);
        if ($sanitizedQuery === '') {
            return [];
        }

        $limit = max(1, min(100, (int) ($options['limit'] ?? 20)));
        $alpha = isset($options['alpha']) ? max(0.0, min(1.0, (float) $options['alpha'])) : 0.65;
        $diversityFactor = isset($options['diversityFactor'])
            ? max(0.0, min(1.0, (float) $options['diversityFactor']))
            : 0.35;

        $rawFilters = is_array($options['filters'] ?? null) ? $options['filters'] : [];
        $eidosFilters = [];

        if (!empty($rawFilters['category'])) {
            $eidosFilters['category'] = $this->mapper->cleanPlainText((string) $rawFilters['category'], 100);
        }
        if (isset($rawFilters['minPrice']) && is_numeric($rawFilters['minPrice'])) {
            $eidosFilters['min_price'] = (float) $rawFilters['minPrice'];
        }
        if (isset($rawFilters['maxPrice']) && is_numeric($rawFilters['maxPrice'])) {
            $eidosFilters['max_price'] = (float) $rawFilters['maxPrice'];
        }

        $payload = [
            'query' => $sanitizedQuery,
            'limit' => $limit,
            'mode' => 'hybrid',
            'alpha' => $alpha,
            'filters' => (object) array_merge($eidosFilters, [
                'diversityFactor' => $diversityFactor,
            ]),
        ];

        if (!empty($eidosFilters['category'])) {
            $payload['filterCategory'] = $eidosFilters['category'];
        }

        $response = $this->httpClient->request(
            'POST',
            '/v1/search',
            $payload,
            1.8,
            'replaceSearch'
        );

        if (
            !$response['ok']
            || !isset($response['data']['results'])
            || !is_array($response['data']['results'])
            || empty($response['data']['results'])
        ) {
            $fallbackItems = $this->executeBitrixFallbackSearch($sanitizedQuery, $options);
            $this->bindBitrixSearchGlobals($sanitizedQuery, $fallbackItems, true, $options);
            return $fallbackItems;
        }

        $filterInStock = isset($rawFilters['inStock']) ? (bool) $rawFilters['inStock'] : null;
        $bitrixItems = [];

        foreach ($response['data']['results'] as $hit) {
            if (!is_array($hit)) {
                continue;
            }

            // Поддерживаем как вложенный формат $hit['item'], так и плоский ответ /v1/search
            $itemData = isset($hit['item']) && is_array($hit['item']) ? $hit['item'] : $hit;
            if (empty($itemData['id'])) {
                continue;
            }

            $id = (string) $itemData['id'];
            $tags = is_array($itemData['tags'] ?? null) ? $itemData['tags'] : [];
            $metaFromTags = $this->extractMetaFromTags($tags);
            $localMeta = $this->localCatalogIndex[$id] ?? [];

            $inStock = $itemData['inStock'] ?? $metaFromTags['inStock'] ?? ($localMeta['IN_STOCK'] ?? true);
            if ($filterInStock !== null && (bool) $inStock !== $filterInStock) {
                continue;
            }

            $url = (string) (
                $itemData['url']
                ?? $metaFromTags['url']
                ?? $localMeta['DETAIL_PAGE_URL']
                ?? ('/catalog/item/' . rawurlencode($id) . '/')
            );
            $title = (string) ($itemData['title'] ?? $localMeta['NAME'] ?? '');
            $description = (string) ($itemData['description'] ?? $localMeta['DESCRIPTION'] ?? '');
            $price = isset($itemData['price']) ? (float) $itemData['price'] : (float) ($localMeta['PRICE'] ?? 0.0);
            $explanation = isset($hit['explanation']) && is_string($hit['explanation'])
                ? $hit['explanation']
                : null;

            $bitrixItems[] = [
                'ID' => $id,
                'ITEM_ID' => $id,
                'MODULE_ID' => 'iblock',
                'NAME' => $title,
                'TITLE' => $title,
                'TITLE_FORMATED' => htmlspecialchars($title, ENT_QUOTES, 'UTF-8'),
                'DETAIL_PAGE_URL' => $url,
                'URL' => $url,
                'BODY_FORMATED' => $description,
                'PRICE' => $price,
                'PREVIEW_PICTURE' => $itemData['imageUrl'] ?? $metaFromTags['imageUrl'] ?? ($localMeta['PREVIEW_PICTURE'] ?? null),
                'EXPLANATION' => $explanation,
            ];

            if (count($bitrixItems) >= $limit) {
                break;
            }
        }

        // Если после фильтрации по наличию список пуст — пробуем резервный поиск Битрикса
        if (empty($bitrixItems)) {
            $fallbackItems = $this->executeBitrixFallbackSearch($sanitizedQuery, $options);
            $this->bindBitrixSearchGlobals($sanitizedQuery, $fallbackItems, true, $options);
            return $fallbackItems;
        }

        $this->bindBitrixSearchGlobals($sanitizedQuery, $bitrixItems, false, $options);

        return $bitrixItems;
    }

    /**
     * Напрямую подменяет результаты внутри компонента 1С-Битрикс ($arResult['ITEMS'], $arResult['SEARCH'],
     * $arResult['ELEMENTS']) и глобального фильтра каталога ($GLOBALS['searchFilter'] / $GLOBALS['arrFilter']).
     *
     * @param array<string, mixed> $arResult
     * @param string $query
     * @param array<string, mixed> $options
     * @return array<int, array<string, mixed>>
     */
    public function applyToBitrixComponent(array &$arResult, string $query, array $options = []): array
    {
        $items = $this->replaceSearch($query, $options);
        $ids = array_values(array_map(static fn(array $it): string => (string) $it['ID'], $items));

        $arResult['QUERY'] = htmlspecialchars($query, ENT_QUOTES, 'UTF-8');
        $arResult['ITEMS'] = $items;
        $arResult['SEARCH'] = $items;
        $arResult['ELEMENTS'] = !empty($ids) ? array_combine($ids, $ids) : [];
        $arResult['FALLBACK_USED'] = (bool) ($GLOBALS['EIDOS_SEARCH_RESULT']['FALLBACK_USED'] ?? false);
        $arResult['EIDOS_REPLACED'] = !$arResult['FALLBACK_USED'];

        return $items;
    }

    /**
     * Привязывает результаты поиска EIDOS к глобальному контексту 1С-Битрикс:
     * - Заполняет $GLOBALS['searchFilter'] и $GLOBALS['arrFilter'] (['=ID' => $ids]) для bitrix:catalog.search
     * - Заполняет $GLOBALS['arResult']['ITEMS'] и $GLOBALS['arResult']['SEARCH'] для bitrix:search.page
     * - Подключает JS-маяк navigator.sendBeacon('/bitrix/tools/eidos_feedback.php') через $APPLICATION->AddHeadString
     *
     * @param string $query
     * @param array<int, array<string, mixed>> $items
     * @param bool $fallbackUsed
     * @param array<string, mixed> $options
     */
    private function bindBitrixSearchGlobals(string $query, array $items, bool $fallbackUsed, array $options = []): void
    {
        $ids = array_values(array_map(static fn(array $it): string => (string) ($it['ID'] ?? ''), $items));
        $ids = array_values(array_filter($ids, static fn(string $id): bool => $id !== ''));

        $GLOBALS['EIDOS_SEARCH_RESULT'] = [
            'QUERY' => $query,
            'IDS' => $ids,
            'ITEMS' => $items,
            'FALLBACK_USED' => $fallbackUsed,
            'EIDOS_REPLACED' => !$fallbackUsed,
        ];

        // Заполняем глобальные фильтры для штатного компонента bitrix:catalog.search / bitrix:catalog.section
        $filterName = isset($options['filterName']) && is_string($options['filterName']) && $options['filterName'] !== ''
            ? $options['filterName']
            : 'searchFilter';

        $idFilter = !empty($ids) ? ['=ID' => $ids] : ['=ID' => -1];
        $GLOBALS[$filterName] = array_merge(is_array($GLOBALS[$filterName] ?? null) ? $GLOBALS[$filterName] : [], $idFilter);
        $GLOBALS['arrFilter'] = array_merge(is_array($GLOBALS['arrFilter'] ?? null) ? $GLOBALS['arrFilter'] : [], $idFilter);

        // Если в глобальной области видимости активен $arResult компонента поиска — обновляем его на месте
        if (isset($GLOBALS['arResult']) && is_array($GLOBALS['arResult'])) {
            $GLOBALS['arResult']['ITEMS'] = $items;
            $GLOBALS['arResult']['SEARCH'] = $items;
            $GLOBALS['arResult']['ELEMENTS'] = !empty($ids) ? array_combine($ids, $ids) : [];
            $GLOBALS['arResult']['FALLBACK_USED'] = $fallbackUsed;
            $GLOBALS['arResult']['EIDOS_REPLACED'] = !$fallbackUsed;
        }

        // Регистрируем неблокирующий скрипт отправки кликов в шапке страницы Битрикса
        if (isset($GLOBALS['APPLICATION']) && is_object($GLOBALS['APPLICATION']) && method_exists($GLOBALS['APPLICATION'], 'AddHeadString')) {
            $GLOBALS['APPLICATION']->AddHeadString(self::getTrackingScriptHtml($query), true);
        }
    }

    /**
     * Возвращает HTML/JS код для автоматического неблокирующего трекинга кликов через navigator.sendBeacon.
     */
    public static function getTrackingScriptHtml(string $defaultQuery = ''): string
    {
        $encodedQuery = json_encode($defaultQuery, JSON_UNESCAPED_UNICODE);
        return <<<HTML
<script data-eidos-tracker="1">
window.eidosTrackClick = window.eidosTrackClick || function(itemId, query) {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/bitrix/tools/eidos_feedback.php', JSON.stringify({
            itemId: String(itemId),
            query: String(query || {$encodedQuery} || ''),
            eventType: 'click'
        }));
    }
};
</script>
HTML;
    }

    /**
     * Fallback на штатный поиск 1С-Битрикс (CSearch::Search из b_search_content,
     * затем CIBlockElement::GetList или локальный индекс).
     *
     * @param string $query
     * @param array<string, mixed> $options
     * @return array<int, array{ID: string, NAME: string, DETAIL_PAGE_URL: string, URL: string, BODY_FORMATED: string, PRICE: float, PREVIEW_PICTURE: ?string, EXPLANATION?: ?string}>
     */
    private function executeBitrixFallbackSearch(string $query, array $options = []): array
    {
        if ($this->nativeSearchFallback !== null) {
            return ($this->nativeSearchFallback)($query, $options);
        }

        $limit = max(1, min(100, (int) ($options['limit'] ?? 20)));
        $filters = is_array($options['filters'] ?? null) ? $options['filters'] : [];

        // 1. Пробуем штатный поисковый модуль 1С-Битрикс (b_search_content / CSearch::Search)
        if (class_exists('\CModule')) {
            /** @phpstan-ignore-next-line */
            \CModule::IncludeModule('search');
        }
        if (class_exists('\CSearch')) {
            /** @phpstan-ignore-next-line */
            $obSearch = new \CSearch();
            $siteId = defined('SITE_ID') ? (string) constant('SITE_ID') : 's1';
            $searchParams = [
                'QUERY' => $query,
                'SITE_ID' => $siteId,
                'MODULE_ID' => 'iblock',
            ];
            $iblockId = (int) Settings::getOption('iblock_id', Settings::getOption(Settings::OPT_IBLOCK_ID, '0'));
            if ($iblockId > 0) {
                $searchParams['PARAM2'] = $iblockId;
            }

            /** @phpstan-ignore-next-line */
            $obSearch->Search($searchParams, ['CUSTOM_RANK' => 'DESC', 'RANK' => 'DESC']);
            $csearchResults = [];
            /** @phpstan-ignore-next-line */
            while ($arSearch = $obSearch->GetNext()) {
                $itemId = (string) ($arSearch['ITEM_ID'] ?? $arSearch['ID'] ?? '');
                if ($itemId === '') {
                    continue;
                }
                $localMeta = $this->localCatalogIndex[$itemId] ?? [];
                $url = (string) ($arSearch['URL'] ?? $localMeta['DETAIL_PAGE_URL'] ?? '');
                $title = strip_tags((string) ($arSearch['TITLE'] ?? $localMeta['NAME'] ?? ''));

                $csearchResults[] = [
                    'ID' => $itemId,
                    'ITEM_ID' => $itemId,
                    'MODULE_ID' => 'iblock',
                    'NAME' => $title,
                    'TITLE' => $title,
                    'TITLE_FORMATED' => (string) ($arSearch['TITLE_FORMATED'] ?? htmlspecialchars($title, ENT_QUOTES, 'UTF-8')),
                    'DETAIL_PAGE_URL' => $url,
                    'URL' => $url,
                    'BODY_FORMATED' => strip_tags((string) ($arSearch['BODY_FORMATED'] ?? $localMeta['DESCRIPTION'] ?? '')),
                    'PRICE' => (float) ($localMeta['PRICE'] ?? 0.0),
                    'PREVIEW_PICTURE' => $localMeta['PREVIEW_PICTURE'] ?? null,
                    'EXPLANATION' => null,
                ];
                if (count($csearchResults) >= $limit) {
                    break;
                }
            }

            if (!empty($csearchResults)) {
                return $csearchResults;
            }
        }

        // 2. Если модуль search пуст или не индексировал каталог — ищем через CIBlockElement::GetList
        if (class_exists('\CIBlockElement')) {
            $arFilter = [
                'ACTIVE' => 'Y',
                '%NAME' => $query,
            ];
            if (!empty($filters['category'])) {
                $arFilter['SECTION_NAME'] = (string) $filters['category'];
            }

            /** @phpstan-ignore-next-line */
            $rsElements = \CIBlockElement::GetList(
                ['SORT' => 'ASC', 'ID' => 'DESC'],
                $arFilter,
                false,
                ['nTopCount' => $limit],
                ['ID', 'NAME', 'PREVIEW_TEXT', 'DETAIL_TEXT', 'DETAIL_PAGE_URL', 'PREVIEW_PICTURE', 'CATALOG_PRICE_1']
            );

            $results = [];
            while ($arItem = $rsElements->GetNext()) {
                $id = (string) $arItem['ID'];
                $title = (string) $arItem['NAME'];
                $url = (string) ($arItem['DETAIL_PAGE_URL'] ?? '');
                $desc = strip_tags((string) ($arItem['PREVIEW_TEXT'] ?: ($arItem['DETAIL_TEXT'] ?? '')));
                $results[] = [
                    'ID' => $id,
                    'ITEM_ID' => $id,
                    'MODULE_ID' => 'iblock',
                    'NAME' => $title,
                    'TITLE' => $title,
                    'TITLE_FORMATED' => htmlspecialchars($title, ENT_QUOTES, 'UTF-8'),
                    'DETAIL_PAGE_URL' => $url,
                    'URL' => $url,
                    'BODY_FORMATED' => $desc,
                    'PRICE' => (float) ($arItem['CATALOG_PRICE_1'] ?? 0.0),
                    'PREVIEW_PICTURE' => isset($arItem['PREVIEW_PICTURE']) ? (string) $arItem['PREVIEW_PICTURE'] : null,
                    'EXPLANATION' => null,
                ];
            }
            return $results;
        }

        // 3. Локальный полнотекстовый fallback по проиндексированным элементам (для CLI/тестов)
        $tokens = array_filter(explode(' ', mb_strtolower($query, 'UTF-8')));
        $scored = [];

        foreach ($this->localCatalogIndex as $id => $meta) {
            if (isset($filters['inStock']) && (bool) $filters['inStock'] !== (bool) $meta['IN_STOCK']) {
                continue;
            }
            if (!empty($filters['category']) && mb_strtolower((string) $meta['CATEGORY'], 'UTF-8') !== mb_strtolower((string) $filters['category'], 'UTF-8')) {
                continue;
            }
            if (isset($filters['minPrice']) && (float) $meta['PRICE'] < (float) $filters['minPrice']) {
                continue;
            }
            if (isset($filters['maxPrice']) && (float) $meta['PRICE'] > (float) $filters['maxPrice']) {
                continue;
            }

            $haystack = mb_strtolower(
                $meta['NAME'] . ' ' . ($meta['DESCRIPTION'] ?? '') . ' ' . implode(' ', $meta['TAGS'] ?? []),
                'UTF-8'
            );

            $matches = 0;
            foreach ($tokens as $token) {
                if ($token !== '' && mb_strpos($haystack, $token, 0, 'UTF-8') !== false) {
                    $matches++;
                }
            }

            if ($matches > 0 || empty($tokens)) {
                $url = (string) $meta['DETAIL_PAGE_URL'];
                $title = (string) $meta['NAME'];
                $scored[] = [
                    'score' => $matches,
                    'item' => [
                        'ID' => (string) $id,
                        'ITEM_ID' => (string) $id,
                        'MODULE_ID' => 'iblock',
                        'NAME' => $title,
                        'TITLE' => $title,
                        'TITLE_FORMATED' => htmlspecialchars($title, ENT_QUOTES, 'UTF-8'),
                        'DETAIL_PAGE_URL' => $url,
                        'URL' => $url,
                        'BODY_FORMATED' => (string) ($meta['DESCRIPTION'] ?? ''),
                        'PRICE' => (float) $meta['PRICE'],
                        'PREVIEW_PICTURE' => $meta['PREVIEW_PICTURE'] ?? null,
                        'EXPLANATION' => null,
                    ],
                ];
            }
        }

        usort($scored, static fn(array $a, array $b): int => $b['score'] <=> $a['score']);

        return array_slice(array_column($scored, 'item'), 0, $limit);
    }

    /**
     * @param array<int, mixed> $tags
     * @return array{url: ?string, imageUrl: ?string, inStock: ?bool}
     */
    private function extractMetaFromTags(array $tags): array
    {
        $url = null;
        $imageUrl = null;
        $inStock = null;

        foreach ($tags as $tag) {
            if (!is_string($tag)) {
                continue;
            }
            if (str_starts_with($tag, '__eidos_url:')) {
                $url = substr($tag, strlen('__eidos_url:'));
            } elseif (str_starts_with($tag, '__eidos_img:')) {
                $imageUrl = substr($tag, strlen('__eidos_img:'));
            } elseif (str_starts_with($tag, '__eidos_instock:')) {
                $inStock = substr($tag, strlen('__eidos_instock:')) === '1';
            }
        }

        return [
            'url' => $url,
            'imageUrl' => $imageUrl,
            'inStock' => $inStock,
        ];
    }
}
