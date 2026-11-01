<?php
/**
 * WooCommerce Search Replacer hooking into WordPress pre_get_posts with graceful fallback,
 * request-storm protection, stale ID skipping, and simpleCategoryGate pass-through.
 *
 * @package Eidos\Connectors\WooCommerce
 */

declare(strict_types=1);

namespace Eidos\Connectors\WooCommerce;

use Throwable;

/**
 * Class SearchReplacer
 *
 * Technical: Intercepts main search queries via WordPress `pre_get_posts` and `woocommerce_product_query`,
 * queries EIDOS `POST /v1/search`, and injects matched product IDs into `$query->set('post__in', $ids)`.
 * If EIDOS is unreachable, times out, or returns an error, leaves `$query` untouched (Graceful Fallback)
 * and trips a per-request circuit breaker so EIDOS is not called repeatedly during the same request storm.
 */
class SearchReplacer
{
    private HttpClient $httpClient;
    private bool $lastSearchUsedFallback = false;
    private bool $failedInCurrentRequest = false;
    private string $defaultCategoryGate = 'hard';
    private float $defaultTimeoutSec = 2.0;

    /**
     * Tracks product/variation IDs that were deleted or trashed in WooCommerce before EIDOS index cleanup.
     *
     * @var array<string, bool>
     */
    private array $deletedProductIds = [];

    /**
     * Optional custom native fallback search callback for testing or custom theme hooks.
     *
     * @var callable|null
     */
    private $fallbackHandler = null;

    public function __construct(
        HttpClient $httpClient,
        ?callable $fallbackHandler = null,
        string $defaultCategoryGate = 'hard',
        float $defaultTimeoutSec = 2.0
    ) {
        $this->httpClient = $httpClient;
        $this->fallbackHandler = $fallbackHandler;
        $this->setDefaultCategoryGate($defaultCategoryGate);
        $this->defaultTimeoutSec = max(0.2, min(15.0, $defaultTimeoutSec));
    }

    public function setDefaultCategoryGate(string $gate): void
    {
        if (in_array($gate, ['hard', 'soft', 'off'], true)) {
            $this->defaultCategoryGate = $gate;
        }
    }

    public function getDefaultCategoryGate(): string
    {
        return $this->defaultCategoryGate;
    }

    /**
     * Marks a WooCommerce product/variation ID as deleted/trashed locally so stale hits from EIDOS are skipped.
     */
    public function markItemDeletedInWooCommerce(string $id): void
    {
        $cleanId = trim($id);
        if ($cleanId !== '') {
            $this->deletedProductIds[$cleanId] = true;
        }
    }

    /**
     * Resets the per-request circuit breaker (used between isolated test cases or worker requests).
     */
    public function resetRequestState(): void
    {
        $this->failedInCurrentRequest = false;
        $this->lastSearchUsedFallback = false;
    }

    public function isRequestStormTripped(): bool
    {
        return $this->failedInCurrentRequest;
    }

    /**
     * Registers WordPress `pre_get_posts`, `woocommerce_product_query`, and SQL filters
     * for compatibility with Astra, Flatsome, Storefront, Elementor, WOOF, and Filter Everything.
     */
    public function registerHooks(): void
    {
        if (function_exists('add_action')) {
            add_action('pre_get_posts', [$this, 'handlePreGetPosts'], 20, 1);
            add_action('woocommerce_product_query', [$this, 'handlePreGetPosts'], 20, 1);
        }
        if (function_exists('add_filter')) {
            add_filter('posts_search', [$this, 'filterPostsSearchSql'], 20, 2);
            add_filter('posts_orderby', [$this, 'enforceEidosOrderbySql'], 99, 2);
        }
    }

    /**
     * Replaces standard WooCommerce search with EIDOS hybrid search (POST /v1/search).
     * Returns matched product/variation IDs. On EIDOS failure/timeout, triggers fallback.
     *
     * @param string               $query   Customer search query
     * @param array<string, mixed> $options Search parameters (limit, filters, alpha, mode, simpleCategoryGate, activeProductIds)
     * @return array<int, string|int> Array of product IDs from EIDOS (or from fallback handler if provided)
     */
    public function replaceSearch(string $query, array $options = []): array
    {
        $this->lastSearchUsedFallback = false;
        $cleanQuery = trim(strip_tags($query));

        if ($cleanQuery === '') {
            return [];
        }

        // Request-storm circuit breaker: if EIDOS already failed during this PHP request, do not call again
        if ($this->failedInCurrentRequest) {
            return $this->triggerFallback($cleanQuery, $options);
        }

        $limit = max(1, min(100, (int) ($options['limit'] ?? 20)));
        $alpha = isset($options['alpha']) ? max(0.0, min(1.0, (float) $options['alpha'])) : 0.65;
        $mode = isset($options['mode']) && in_array($options['mode'], ['hybrid', 'dense', 'sparse'], true)
            ? (string) $options['mode']
            : 'hybrid';
        $gate = isset($options['simpleCategoryGate']) && in_array($options['simpleCategoryGate'], ['hard', 'soft', 'off'], true)
            ? (string) $options['simpleCategoryGate']
            : $this->defaultCategoryGate;

        $payload = [
            'query' => $cleanQuery,
            'limit' => $limit,
            'mode' => $mode,
            'alpha' => $alpha,
            'simpleCategoryGate' => $gate,
        ];

        if (!empty($options['filters']) && is_array($options['filters'])) {
            $filters = [];
            if (!empty($options['filters']['category'])) {
                $filters['category'] = (string) $options['filters']['category'];
            }
            if (isset($options['filters']['minPrice'])) {
                $filters['min_price'] = (float) $options['filters']['minPrice'];
            } elseif (isset($options['filters']['min_price'])) {
                $filters['min_price'] = (float) $options['filters']['min_price'];
            }
            if (isset($options['filters']['maxPrice'])) {
                $filters['max_price'] = (float) $options['filters']['maxPrice'];
            } elseif (isset($options['filters']['max_price'])) {
                $filters['max_price'] = (float) $options['filters']['max_price'];
            }
            if (!empty($filters)) {
                $payload['filters'] = $filters;
            }
        }

        try {
            $timeoutSec = isset($options['timeout']) ? (float) $options['timeout'] : $this->defaultTimeoutSec;
            $response = $this->httpClient->post('/v1/search', $payload, $timeoutSec, 'replaceSearch');

            if (!$response['ok']) {
                $this->failedInCurrentRequest = true;
                return $this->triggerFallback($cleanQuery, $options);
            }

            $results = $response['data']['results'] ?? null;
            if (!is_array($results)) {
                $this->httpClient->logError('replaceSearch', 'Malformed response: missing results array');
                $this->failedInCurrentRequest = true;
                return $this->triggerFallback($cleanQuery, $options);
            }

            $activeWhitelist = null;
            if (isset($options['activeProductIds']) && is_array($options['activeProductIds'])) {
                $activeWhitelist = array_fill_keys(array_map('strval', $options['activeProductIds']), true);
            }

            $ids = [];
            foreach ($results as $hit) {
                if (!is_array($hit)) {
                    continue;
                }
                $rawId = $hit['id'] ?? ($hit['item']['id'] ?? null);
                if ($rawId === null || $rawId === '') {
                    continue;
                }
                $strId = trim((string) $rawId);
                if (isset($this->deletedProductIds[$strId])) {
                    continue;
                }
                if ($activeWhitelist !== null && !isset($activeWhitelist[$strId])) {
                    continue;
                }
                $ids[] = is_numeric($rawId) ? (int) $rawId : $strId;
            }

            return array_values(array_unique($ids, SORT_REGULAR));
        } catch (Throwable $e) {
            $this->httpClient->logError('replaceSearch', $e->getMessage());
            $this->failedInCurrentRequest = true;
            return $this->triggerFallback($cleanQuery, $options);
        }
    }

    /**
     * Handles WordPress `pre_get_posts` and `woocommerce_product_query` hooks.
     * - Intercepts only main frontend search queries (never admin, REST, or secondary widget loops).
     * - Preserves `posts_per_page`.
     * - Sets `post__in` and `orderby = post__in` when EIDOS returns product IDs.
     * - Sets `post__in = [0]` when EIDOS returns `count = 0` so WooCommerce renders an empty state (never "all products").
     * - Leaves `$wpQuery` completely untouched on fallback so native WordPress/WooCommerce search executes.
     *
     * @param object $wpQuery WP_Query instance
     */
    public function handlePreGetPosts(object $wpQuery): void
    {
        if (function_exists('is_admin') && is_admin() && (!defined('DOING_AJAX') || !DOING_AJAX)) {
            return;
        }

        if (defined('REST_REQUEST') && REST_REQUEST) {
            return;
        }

        if (!method_exists($wpQuery, 'is_search') || !method_exists($wpQuery, 'is_main_query')) {
            return;
        }

        if (!$wpQuery->is_search() || !$wpQuery->is_main_query()) {
            return;
        }

        // Prevent duplicate execution if both pre_get_posts and woocommerce_product_query fire on the same WP_Query
        if (method_exists($wpQuery, 'get') && $wpQuery->get('eidos_search_handled')) {
            return;
        }

        $searchTerm = method_exists($wpQuery, 'get') ? (string) $wpQuery->get('s') : '';
        if (trim($searchTerm) === '') {
            return;
        }

        $originalPostsPerPage = method_exists($wpQuery, 'get') ? (int) $wpQuery->get('posts_per_page') : 0;
        $limit = $originalPostsPerPage > 0 ? $originalPostsPerPage : 20;

        $ids = $this->replaceSearch($searchTerm, [
            'limit' => max($limit, 24),
            'simpleCategoryGate' => $this->defaultCategoryGate,
        ]);

        // Fallback: if EIDOS is unreachable or timed out, leave $wpQuery completely untouched
        if ($this->lastSearchUsedFallback) {
            return;
        }

        if (!method_exists($wpQuery, 'set')) {
            return;
        }

        $wpQuery->set('eidos_search_handled', true);
        if ($originalPostsPerPage > 0) {
            $wpQuery->set('posts_per_page', $originalPostsPerPage);
        }

        if (empty($ids)) {
            // EIDOS responded 200 OK with count = 0 -> return 0 products (not all catalog items)
            $wpQuery->set('post__in', [0]);
            $wpQuery->set('post_type', 'product');
            return;
        }

        $numericIds = [];
        foreach ($ids as $rawId) {
            if (is_int($rawId) && $rawId > 0) {
                $numericIds[] = $rawId;
            } elseif (is_string($rawId) && ctype_digit($rawId) && (int) $rawId > 0) {
                $numericIds[] = (int) $rawId;
            }
        }
        if (empty($numericIds)) {
            $wpQuery->set('post__in', [0]);
            $wpQuery->set('post_type', 'product');
            return;
        }

        $existingPostIn = method_exists($wpQuery, 'get') ? $wpQuery->get('post__in') : [];
        if (is_array($existingPostIn) && !empty($existingPostIn)) {
            $existingFiltered = array_values(array_filter(array_map('intval', $existingPostIn), static fn(int $id): bool => $id > 0));
            if (!empty($existingFiltered)) {
                $existingSet = array_flip($existingFiltered);
                $numericIds = array_values(array_filter(
                    $numericIds,
                    static fn(int $id): bool => isset($existingSet[$id])
                ));
                if (empty($numericIds)) {
                    $wpQuery->set('post__in', [0]);
                    return;
                }
            }
        }

        $wpQuery->set('eidos_original_query', $searchTerm);
        $wpQuery->set('eidos_search_active', true);
        $wpQuery->set('eidos_ordered_ids', $numericIds);
        $wpQuery->set('post__in', $numericIds);
        $wpQuery->set('post_type', ['product', 'product_variation']);
        $wpQuery->set('orderby', 'post__in');

        if (!function_exists('add_filter')) {
            $wpQuery->set('s', '');
        }
    }

    /**
     * Suppresses WordPress default SQL LIKE condition when EIDOS search is active,
     * keeping query var `s` intact for theme templates (`get_search_query()`, `is_search()`).
     */
    public function filterPostsSearchSql(string $searchSql, object $wpQuery): string
    {
        if (method_exists($wpQuery, 'get') && $wpQuery->get('eidos_search_active')) {
            return '';
        }
        return $searchSql;
    }

    /**
     * Enforces EIDOS ranking order (`FIELD(ID, ...)`) even if a filter plugin overwrote `orderby`.
     */
    public function enforceEidosOrderbySql(string $orderbySql, object $wpQuery): string
    {
        if (!method_exists($wpQuery, 'get') || !$wpQuery->get('eidos_search_active')) {
            return $orderbySql;
        }

        $orderedIds = $wpQuery->get('eidos_ordered_ids');
        if (!is_array($orderedIds) || empty($orderedIds)) {
            return $orderbySql;
        }

        $safeIds = implode(',', array_map('intval', $orderedIds));
        global $wpdb;
        $postsTable = (isset($wpdb) && is_object($wpdb) && !empty($wpdb->posts)) ? $wpdb->posts : 'wp_posts';

        return sprintf('FIELD(%s.ID, %s)', $postsTable, $safeIds);
    }

    public function didLastSearchUseFallback(): bool
    {
        return $this->lastSearchUsedFallback;
    }

    /**
     * @param array<string, mixed> $options
     * @return array<int, string|int>
     */
    private function triggerFallback(string $query, array $options): array
    {
        $this->lastSearchUsedFallback = true;

        if ($this->fallbackHandler !== null) {
            return ($this->fallbackHandler)($query, $options);
        }

        if (!empty($options['useWcFallback']) && function_exists('wc_get_products')) {
            $products = wc_get_products([
                's' => $query,
                'limit' => (int) ($options['limit'] ?? 20),
                'status' => 'publish',
                'return' => 'ids',
            ]);
            return is_array($products) ? $products : [];
        }

        return [];
    }
}

if (!class_exists('Eidos_WC_Search_Replacer', false)) {
    class_alias(SearchReplacer::class, 'Eidos_WC_Search_Replacer');
}
