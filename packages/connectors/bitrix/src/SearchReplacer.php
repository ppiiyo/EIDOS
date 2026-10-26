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

        // Обязательный fallback на стандартный поиск 1С-Битрикс при недоступности EIDOS или пустом ответе
        if (
            !$response['ok']
            || !isset($response['data']['results'])
            || !is_array($response['data']['results'])
            || empty($response['data']['results'])
        ) {
            return $this->executeBitrixFallbackSearch($sanitizedQuery, $options);
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
            $description = (string) ($itemData['description'] ?? $localMeta['DESCRIPTION'] ?? '');
            $price = isset($itemData['price']) ? (float) $itemData['price'] : (float) ($localMeta['PRICE'] ?? 0.0);
            $explanation = isset($hit['explanation']) && is_string($hit['explanation'])
                ? $hit['explanation']
                : null;

            $bitrixItems[] = [
                'ID' => $id,
                'NAME' => (string) ($itemData['title'] ?? $localMeta['NAME'] ?? ''),
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

        return $bitrixItems;
    }

    /**
     * Fallback на штатный поиск 1С-Битрикс (CSearch / CIBlockElement::GetList или локальный индекс).
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

        // Если запущено внутри окружения 1С-Битрикс с подключенным модулем iblock
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
                $url = (string) ($arItem['DETAIL_PAGE_URL'] ?? '');
                $desc = strip_tags((string) ($arItem['PREVIEW_TEXT'] ?: ($arItem['DETAIL_TEXT'] ?? '')));
                $results[] = [
                    'ID' => (string) $arItem['ID'],
                    'NAME' => (string) $arItem['NAME'],
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

        // Локальный полнотекстовый fallback по проиндексированным элементам (для CLI/тестов)
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
                $scored[] = [
                    'score' => $matches,
                    'item' => [
                        'ID' => (string) $id,
                        'NAME' => (string) $meta['NAME'],
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
