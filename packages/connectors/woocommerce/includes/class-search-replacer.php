<?php
/**
 * WooCommerce Search Replacer hooking into WordPress pre_get_posts with graceful fallback.
 *
 * @package Eidos\Connectors\WooCommerce
 */

declare(strict_types=1);

namespace Eidos\Connectors\WooCommerce;

use Throwable;

/**
 * Class SearchReplacer
 *
 * Technical: Intercepts main search queries via WordPress `pre_get_posts` hook,
 * queries EIDOS `POST /v1/search`, and injects matched product IDs into `$query->set('post__in', $ids)`.
 * If EIDOS is unreachable, times out, or returns an error, leaves `$query` untouched (Graceful Fallback).
 */
class SearchReplacer
{
    private HttpClient $httpClient;
    private bool $lastSearchUsedFallback = false;

    /**
     * Optional custom native fallback search callback for testing or custom theme hooks.
     *
     * @var callable|null
     */
    private $fallbackHandler = null;

    public function __construct(HttpClient $httpClient, ?callable $fallbackHandler = null)
    {
        $this->httpClient = $httpClient;
        $this->fallbackHandler = $fallbackHandler;
    }

    /**
     * Регистрирует хук WordPress `pre_get_posts`, `woocommerce_product_query` и SQL-фильтры
     * для полной совместимости с кастомными темами (Astra, Flatsome) и плагинами фильтрации (WOOF, Filter Everything).
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
     * 3. Бизнес-логика: замена стандартного поиска на гибридный поиск EIDOS (POST /v1/search).
     * Возвращает массив ID найденных товаров. При недоступности EIDOS включает fallback.
     *
     * @param string               $query   Поисковый запрос покупателя
     * @param array<string, mixed> $options Параметры поиска (limit, filters, alpha, mode)
     * @return array<int, string|int> Массив ID товаров из EIDOS (или из fallback при наличии обработчика)
     */
    public function replaceSearch(string $query, array $options = []): array
    {
        $this->lastSearchUsedFallback = false;
        $cleanQuery = trim(strip_tags($query));

        if ($cleanQuery === '') {
            return [];
        }

        $limit = max(1, min(100, (int) ($options['limit'] ?? 20)));
        $alpha = isset($options['alpha']) ? max(0.0, min(1.0, (float) $options['alpha'])) : 0.5;
        $mode = isset($options['mode']) && in_array($options['mode'], ['hybrid', 'dense', 'sparse'], true)
            ? (string) $options['mode']
            : 'hybrid';

        $payload = [
            'query' => $cleanQuery,
            'limit' => $limit,
            'mode' => $mode,
            'alpha' => $alpha,
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
            $timeoutSec = isset($options['timeout']) ? (float) $options['timeout'] : 2.0;
            $response = $this->httpClient->post('/v1/search', $payload, $timeoutSec, 'replaceSearch');

            if (!$response['ok']) {
                return $this->triggerFallback($cleanQuery, $options);
            }

            $results = $response['data']['results'] ?? null;
            if (!is_array($results)) {
                $this->httpClient->logError('replaceSearch', 'Malformed response: missing results array');
                return $this->triggerFallback($cleanQuery, $options);
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
                $ids[] = is_numeric($rawId) ? (int) $rawId : (string) $rawId;
            }

            return array_values(array_unique($ids, SORT_REGULAR));
        } catch (Throwable $e) {
            $this->httpClient->logError('replaceSearch', $e->getMessage());
            return $this->triggerFallback($cleanQuery, $options);
        }
    }

    /**
     * Бизнес-логика: обработчик хука `pre_get_posts` в WordPress.
     * Если выполняется основной поисковый запрос на витрине:
     * - Запрашивает релевантные ID у EIDOS.
     * - При успехе подменяет `post__in`, `post_type = product`, `orderby = post__in` и сбрасывает `s`,
     *   чтобы SQL-запрос WordPress выбрал ровно товары EIDOS в порядке их семантического ранга.
     * - Если EIDOS недоступен (fallback), НЕ трогает объект $wpQuery — срабатывает штатный поиск WordPress.
     *
     * @param object $wpQuery Экземпляр WP_Query
     */
    public function handlePreGetPosts(object $wpQuery): void
    {
        if (function_exists('is_admin') && is_admin() && (!defined('DOING_AJAX') || !DOING_AJAX)) {
            return;
        }

        if (!method_exists($wpQuery, 'is_search') || !method_exists($wpQuery, 'is_main_query')) {
            return;
        }

        if (!$wpQuery->is_search() || !$wpQuery->is_main_query()) {
            return;
        }

        $searchTerm = method_exists($wpQuery, 'get') ? (string) $wpQuery->get('s') : '';
        if (trim($searchTerm) === '') {
            return;
        }

        $limit = method_exists($wpQuery, 'get') ? (int) $wpQuery->get('posts_per_page') : 20;
        if ($limit <= 0) {
            $limit = 20;
        }

        $ids = $this->replaceSearch($searchTerm, ['limit' => max($limit, 24)]);

        // Fallback: если EIDOS недоступен или вернул ошибку, НЕ модифицируем $wpQuery
        if ($this->lastSearchUsedFallback) {
            return;
        }

        if (!method_exists($wpQuery, 'set')) {
            return;
        }

        if (empty($ids)) {
            // EIDOS ответил успешно, но совпадений нет
            $wpQuery->set('post__in', [0]);
            $wpQuery->set('post_type', 'product');
            return;
        }

        // Оставляем только числовые ID постов WordPress (отбрасывая строковые демо-ID вида item-191)
        $numericIds = [];
        foreach ($ids as $rawId) {
            if (is_int($rawId) && $rawId > 0) {
                $numericIds[] = $rawId;
            } elseif (is_string($rawId) && ctype_digit($rawId) && (int) $rawId > 0) {
                $numericIds[] = (int) $rawId;
            }
        }
        if (empty($numericIds)) {
            return;
        }

        // Совместимость с плагинами фильтрации (WooCommerce Product Filter, WOOF, Filter Everything):
        // если фильтр уже ограничил выборку через post__in, пересекаем с сохранением порядка ранжирования EIDOS
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

        // Сохраняем исходный поисковый запрос в query_vars для телеметрии кликов (sendBeacon) и заголовков темы (Astra/Flatsome)
        $wpQuery->set('eidos_original_query', $searchTerm);
        $wpQuery->set('eidos_search_active', true);
        $wpQuery->set('eidos_ordered_ids', $numericIds);
        $wpQuery->set('post__in', $numericIds);
        $wpQuery->set('post_type', ['product', 'product_variation']);
        $wpQuery->set('orderby', 'post__in');

        // Если фильтр posts_search недоступен в минимальном тестовом окружении, сбрасываем 's',
        // иначе оставляем 's' для get_search_query() в шаблонах Astra/Flatsome и убираем SQL LIKE через posts_search
        if (!function_exists('add_filter')) {
            $wpQuery->set('s', '');
        }
    }

    /**
     * Отключает стандартное условие SQL `AND (((wp_posts.post_title LIKE ...)))` при активном поиске EIDOS,
     * сохраняя переменную запроса `s` нетронутой для шаблонов Astra / Flatsome (`get_search_query()`, `is_search()`).
     */
    public function filterPostsSearchSql(string $searchSql, object $wpQuery): string
    {
        if (method_exists($wpQuery, 'get') && $wpQuery->get('eidos_search_active')) {
            return '';
        }
        return $searchSql;
    }

    /**
     * Гарантирует сохранение порядка ранжирования EIDOS (`FIELD(ID, ...)`) даже если плагин фильтрации
     * (WooCommerce Product Filter / WOOF) перезаписал `orderby` на `menu_order title` или `relevance`.
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

        // Если в окружении доступна функция wc_get_products и запрос вызван напрямую вне WP_Query
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
