<?php
/**
 * Main EIDOS WooCommerce Connector implementing all 6 methods of EIDOS Connector v1.0.
 *
 * @package Eidos\Connectors\WooCommerce
 */

declare(strict_types=1);

namespace Eidos\Connectors\WooCommerce;

use DateTimeImmutable;
use DateTimeInterface;
use Eidos\Connectors\Core\ConnectorInterface;
use Throwable;

if (!interface_exists(ConnectorInterface::class)) {
    $coreInterfacePath = dirname(__DIR__, 2) . '/core/src/ConnectorInterface.php';
    if (file_exists($coreInterfacePath)) {
        require_once $coreInterfacePath;
    }
}

/**
 * Class Connector
 *
 * Technical: Implements syncCatalog, syncDelta, replaceSearch, pushFeedback,
 * healthCheck, and mapFields in strict compliance with EIDOS Connector v1.0.
 */
class Connector implements ConnectorInterface
{
    public const DEFAULT_BATCH_SIZE = 100;
    public const WC_REST_PER_PAGE = 100;

    private HttpClient $httpClient;
    private Mapper $mapper;
    private SearchReplacer $searchReplacer;

    /**
     * Optional custom provider for testing or custom WooCommerce REST transport:
     * callable(int $page, int $perPage, ?DateTimeInterface $modifiedAfter): array<int, mixed>
     *
     * @var callable|null
     */
    private $productsFetcher;

    /**
     * Optional custom variations provider:
     * callable(int|string $parentId): array<int, mixed>
     *
     * @var callable|null
     */
    private $variationsFetcher;

    /**
     * Tracks content hashes per item ID for idempotent syncDelta calls.
     *
     * @var array<string, string>
     */
    private array $syncedDeltaFingerprints = [];

    public function __construct(
        HttpClient $httpClient,
        ?Mapper $mapper = null,
        ?SearchReplacer $searchReplacer = null,
        ?callable $productsFetcher = null,
        ?callable $variationsFetcher = null
    ) {
        $this->httpClient = $httpClient;
        $this->mapper = $mapper ?? new Mapper();
        $this->searchReplacer = $searchReplacer ?? new SearchReplacer($this->httpClient);
        $this->productsFetcher = $productsFetcher;
        $this->variationsFetcher = $variationsFetcher;
    }

    /**
     * Регистрирует REST-роут `/wp-json/eidos/v1/feedback` и хук поиска `pre_get_posts`.
     */
    public function registerWordPressHooks(): void
    {
        $this->searchReplacer->registerHooks();

        if (function_exists('add_action')) {
            add_action('rest_api_init', [$this, 'registerFeedbackRestRoute']);
            add_action('eidos_wc_cron_sync_delta', [$this, 'runScheduledDeltaSync']);
        }
    }

    /**
     * Регистрация собственного REST-роута WordPress: POST /wp-json/eidos/v1/feedback
     * для приёма событий кликов от navigator.sendBeacon на фронтенде.
     */
    public function registerFeedbackRestRoute(): void
    {
        if (!function_exists('register_rest_route')) {
            return;
        }

        register_rest_route('eidos/v1', '/feedback', [
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => function ($request) {
                $params = is_object($request) && method_exists($request, 'get_json_params')
                    ? (array) $request->get_json_params()
                    : [];
                if (empty($params) && is_object($request) && method_exists($request, 'get_params')) {
                    $params = (array) $request->get_params();
                }

                $ok = $this->pushFeedback([
                    'itemId' => (string) ($params['itemId'] ?? $params['item_id'] ?? ''),
                    'eventType' => (string) ($params['eventType'] ?? $params['event'] ?? 'click'),
                    'query' => isset($params['query']) ? (string) $params['query'] : '',
                    'userId' => isset($params['userId']) ? (string) $params['userId'] : null,
                    'position' => isset($params['position']) ? (int) $params['position'] : null,
                ]);

                if (function_exists('rest_ensure_response')) {
                    return rest_ensure_response(['ok' => $ok]);
                }

                return ['ok' => $ok];
            },
        ]);
    }

    /**
     * 1. Бизнес-логика: полная синхронизация каталога WooCommerce в EIDOS.
     * - Забирает родительские товары постранично через GET /wp-json/wc/v3/products?per_page=100&page=N.
     * - Для каждого variable-товара дополнительно забирает его вариации через
     *   GET /wp-json/wc/v3/products/{id}/variations.
     * - Преобразует карточки через mapFields() и отправляет батчами по 100 шт. в POST /v1/catalog/upsert
     *   с обёрткой {"items": [...]}.
     *
     * @param array<string, mixed> $options
     * @return array{synced: int, failed: int, errors: array<int, string>}
     */
    public function syncCatalog(array $options = []): array
    {
        $batchSize = max(1, min(500, (int) ($options['batchSize'] ?? self::DEFAULT_BATCH_SIZE)));
        $perPage = max(1, min(self::WC_REST_PER_PAGE, (int) ($options['perPage'] ?? self::WC_REST_PER_PAGE)));
        $onProgress = isset($options['onProgress']) && is_callable($options['onProgress'])
            ? $options['onProgress']
            : null;

        $synced = 0;
        $failed = 0;
        $errors = [];
        $pendingBatch = [];
        $page = 1;
        $processed = 0;

        while (true) {
            $parentProducts = $this->fetchProductsPage($page, $perPage, null, $errors);
            if (empty($parentProducts)) {
                break;
            }

            foreach ($parentProducts as $parentProduct) {
                $expandedItems = $this->expandProductWithVariations($parentProduct, $errors);

                foreach ($expandedItems as $entry) {
                    $processed++;
                    try {
                        $rawItem = $entry['item'];
                        $mapped = $this->mapFields($rawItem, $entry['parentContext']);
                        $itemTimestamp = $this->extractModifiedTimestamp($rawItem, 0);
                        $this->syncedDeltaFingerprints[$mapped['id']] = sha1(
                            $mapped['id'] . '|' . $itemTimestamp . '|' . $mapped['title'] . '|' . $mapped['price'] . '|' . ($mapped['inStock'] ? '1' : '0')
                        );
                        $pendingBatch[] = $this->mapper->toUpsertPayload($mapped);
                    } catch (Throwable $e) {
                        $failed++;
                        $msg = $e->getMessage();
                        $this->httpClient->logError('syncCatalog', $msg);
                        $errors[] = $msg;
                    }

                    if (count($pendingBatch) >= $batchSize) {
                        $this->flushUpsertBatch($pendingBatch, 'syncCatalog', $synced, $failed, $errors);
                        $pendingBatch = [];
                        if ($onProgress !== null) {
                            $onProgress($processed, $processed, $synced, $failed);
                        }
                    }
                }
            }

            if (count($parentProducts) < $perPage) {
                break;
            }
            $page++;
        }

        if (!empty($pendingBatch)) {
            $this->flushUpsertBatch($pendingBatch, 'syncCatalog', $synced, $failed, $errors);
            if ($onProgress !== null) {
                $onProgress($processed, $processed, $synced, $failed);
            }
        }

        if (function_exists('update_option')) {
            update_option('eidos_wc_last_sync', gmdate('c'), false);
        }

        return [
            'synced' => $synced,
            'failed' => $failed,
            'errors' => $errors,
        ];
    }

    /**
     * 2. Бизнес-логика: инкрементальная синхронизация изменённых товаров (syncDelta).
     * - Запрашивает GET /wp-json/wc/v3/products?modified_after={ISO8601}&per_page=100.
     * - Для изменённых variable-товаров забирает их вариации.
     * - Отправляет батчами по 100 в POST /v1/catalog/upsert.
     *
     * @param DateTimeInterface $since
     * @param int               $batchSize
     * @return array{synced: int, since: DateTimeInterface}
     */
    public function syncDelta(DateTimeInterface $since, int $batchSize = 100): array
    {
        $effectiveBatchSize = max(1, min(500, $batchSize));
        $synced = 0;
        $errors = [];
        $pendingBatch = [];
        $pendingMeta = [];
        $page = 1;
        $maxTimestamp = $since->getTimestamp();

        while (true) {
            $modifiedProducts = $this->fetchProductsPage($page, self::WC_REST_PER_PAGE, $since, $errors);
            if (empty($modifiedProducts)) {
                break;
            }

            foreach ($modifiedProducts as $parentProduct) {
                $expandedItems = $this->expandProductWithVariations($parentProduct, $errors);

                foreach ($expandedItems as $entry) {
                    try {
                        $rawItem = $entry['item'];
                        $mapped = $this->mapFields($rawItem, $entry['parentContext']);
                        $itemTimestamp = $this->extractModifiedTimestamp($rawItem, $since->getTimestamp());

                        $hasExplicitDate = (is_array($rawItem) && (!empty($rawItem['date_modified_gmt']) || !empty($rawItem['date_modified'])))
                            || (is_object($rawItem) && method_exists($rawItem, 'get_date_modified') && $rawItem->get_date_modified() !== null);

                        if ($hasExplicitDate && $itemTimestamp < $since->getTimestamp()) {
                            continue;
                        }

                        $fingerprint = sha1(
                            $mapped['id'] . '|' . $itemTimestamp . '|' . $mapped['title'] . '|' . $mapped['price'] . '|' . ($mapped['inStock'] ? '1' : '0')
                        );

                        if (
                            isset($this->syncedDeltaFingerprints[$mapped['id']]) &&
                            $this->syncedDeltaFingerprints[$mapped['id']] === $fingerprint
                        ) {
                            continue;
                        }

                        $pendingBatch[] = $this->mapper->toUpsertPayload($mapped);
                        $pendingMeta[] = [
                            'id' => $mapped['id'],
                            'fingerprint' => $fingerprint,
                            'timestamp' => $itemTimestamp,
                        ];

                        if (count($pendingBatch) >= $effectiveBatchSize) {
                            $this->flushDeltaBatch($pendingBatch, $pendingMeta, $synced, $maxTimestamp);
                            $pendingBatch = [];
                            $pendingMeta = [];
                        }
                    } catch (Throwable $e) {
                        $this->httpClient->logError('syncDelta', $e->getMessage());
                    }
                }
            }

            if (count($modifiedProducts) < self::WC_REST_PER_PAGE) {
                break;
            }
            $page++;
        }

        if (!empty($pendingBatch)) {
            $this->flushDeltaBatch($pendingBatch, $pendingMeta, $synced, $maxTimestamp);
        }

        $nextSince = (new DateTimeImmutable())->setTimestamp(max($maxTimestamp, time()));
        if (function_exists('update_option')) {
            update_option('eidos_wc_last_sync', $nextSince->format('c'), false);
        }

        return [
            'synced' => $synced,
            'since' => $nextSince,
        ];
    }

    /**
     * 3. Бизнес-логика: замена стандартного поиска WooCommerce через EIDOS (POST /v1/search)
     * с автоматическим fallback на стандартный поиск WordPress при ошибке/таймауте.
     *
     * @param string               $query
     * @param array<string, mixed> $options
     * @return array<int, string|int>
     */
    public function replaceSearch(string $query, array $options = []): array
    {
        return $this->searchReplacer->replaceSearch($query, $options);
    }

    /**
     * 4. Бизнес-логика: неблокирующая отправка обратной связи (кликов, покупок) в POST /v1/feedback.
     * Таймаут строго 1.0 секунда. Никогда не выбрасывает исключений пользователю.
     *
     * @param array<string, mixed> $event ['itemId' => string, 'eventType' => string, 'query' => ?string, 'userId' => ?string]
     * @return bool
     */
    public function pushFeedback(array $event): bool
    {
        $itemId = trim((string) ($event['itemId'] ?? $event['item_id'] ?? ''));
        $rawEventType = strtolower(trim((string) ($event['eventType'] ?? $event['event'] ?? 'click')));
        $query = trim((string) ($event['query'] ?? ''));
        $userId = isset($event['userId']) && trim((string) $event['userId']) !== ''
            ? trim((string) $event['userId'])
            : null;
        $position = isset($event['position']) && is_numeric($event['position'])
            ? max(0, (int) $event['position'])
            : null;

        if ($itemId === '') {
            $this->httpClient->logError('pushFeedback', 'Missing itemId in feedback event');
            return false;
        }

        // Нормализация типа события под схему /v1/feedback EIDOS ('click' | 'conversion' | 'purchase' | 'impression')
        $eventMap = [
            'click' => 'click',
            'view' => 'impression',
            'impression' => 'impression',
            'like' => 'click',
            'add_to_cart' => 'conversion',
            'conversion' => 'conversion',
            'purchase' => 'purchase',
            'dislike' => 'click',
        ];
        $normalizedEvent = $eventMap[$rawEventType] ?? $rawEventType;

        $payload = [
            'itemId' => $itemId,
            'eventType' => $normalizedEvent,
            'event' => $normalizedEvent,
            'query' => $query !== '' ? $query : 'catalog',
        ];

        if ($userId !== null) {
            $payload['userId'] = $userId;
        }
        if ($position !== null) {
            $payload['position'] = $position;
        }

        try {
            $resp = $this->httpClient->post('/v1/feedback', $payload, 1.0, 'pushFeedback');
            return (bool) $resp['ok'];
        } catch (Throwable $e) {
            $this->httpClient->logError('pushFeedback', $e->getMessage());
            return false;
        }
    }

    /**
     * 5. Бизнес-логика: проверка состояния EIDOS через GET /v1/health (таймаут 3 секунды).
     *
     * @return array{ok: bool, version: string, itemsIndexed: int, latencyMs: float, error: ?string}
     */
    public function healthCheck(): array
    {
        try {
            $resp = $this->httpClient->get('/v1/health', 3.0, 'healthCheck');
            if (!$resp['ok']) {
                return [
                    'ok' => false,
                    'version' => 'unknown',
                    'itemsIndexed' => 0,
                    'latencyMs' => $resp['latencyMs'],
                    'error' => $resp['error'] ?? 'health_check_failed',
                ];
            }

            $data = $resp['data'];
            $status = strtolower((string) ($data['status'] ?? ''));
            $isOk = (bool) ($data['ok'] ?? in_array($status, ['ok', 'healthy'], true));
            $itemsIndexed = (int) (
                $data['itemsIndexed']
                ?? $data['catalogSize']
                ?? $data['checks']['vectorStore']['items']
                ?? 0
            );
            $version = (string) ($data['version'] ?? '1.0.0');

            return [
                'ok' => $isOk,
                'version' => $version,
                'itemsIndexed' => $itemsIndexed,
                'latencyMs' => $resp['latencyMs'],
                'error' => $isOk ? null : ($resp['error'] ?? 'unhealthy_status'),
            ];
        } catch (Throwable $e) {
            $this->httpClient->logError('healthCheck', $e->getMessage());
            return [
                'ok' => false,
                'version' => 'unknown',
                'itemsIndexed' => 0,
                'latencyMs' => 0.0,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * 6. Бизнес-логика: преобразование товара WooCommerce (WC_Product или массива REST API)
     * в каноническую схему EIDOS Connector v1.0.
     *
     * @param mixed                     $systemItem
     * @param array<string, mixed>|null $parentContext
     * @return array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl: ?string}
     */
    public function mapFields(mixed $systemItem, ?array $parentContext = null): array
    {
        return $this->mapper->mapFields($systemItem, $parentContext);
    }

    /**
     * Запуск фоновой синхронизации дельты по расписанию WP-Cron.
     */
    public function runScheduledDeltaSync(): void
    {
        $lastSyncRaw = function_exists('get_option')
            ? (string) get_option('eidos_wc_last_sync', '')
            : '';
        $since = $lastSyncRaw !== ''
            ? new DateTimeImmutable($lastSyncRaw)
            : new DateTimeImmutable('-1 hour');

        $this->syncDelta($since);
    }

    public function getSearchReplacer(): SearchReplacer
    {
        return $this->searchReplacer;
    }

    /**
     * Получает страницу родительских товаров через REST API `/wp-json/wc/v3/products`
     * (или через локальный вызов `wc_get_products`, если настроен in-process режим).
     *
     * @param array<int, string> $errors
     * @return array<int, mixed>
     */
    private function fetchProductsPage(
        int $page,
        int $perPage,
        ?DateTimeInterface $modifiedAfter,
        array &$errors
    ): array {
        if ($this->productsFetcher !== null) {
            $result = ($this->productsFetcher)($page, $perPage, $modifiedAfter);
            return is_array($result) ? $result : [];
        }

        $queryParams = [
            'per_page' => $perPage,
            'page' => $page,
            'status' => 'publish',
        ];

        if ($modifiedAfter !== null) {
            // WooCommerce REST API ожидает ISO8601 дату в параметре modified_after
            $queryParams['modified_after'] = $modifiedAfter->format('Y-m-d\TH:i:s');
        }

        // Если мы работаем внутри процесса WordPress и доступна функция rest_do_request,
        // либо используем HTTP-клиент к /wp-json/wc/v3/products
        $caller = $modifiedAfter !== null ? 'syncDelta' : 'syncCatalog';
        $resp = $this->httpClient->requestWooCommerceRest(
            '/wp-json/wc/v3/products',
            $queryParams,
            30.0,
            $caller
        );

        if ($resp['ok'] && is_array($resp['data'])) {
            return array_values($resp['data']);
        }

        // Fallback на локальный API WooCommerce (wc_get_products), если REST API не настроен ключами
        if (function_exists('wc_get_products')) {
            $wcArgs = [
                'limit' => $perPage,
                'page' => $page,
                'status' => 'publish',
                'parent' => 0,
            ];
            if ($modifiedAfter !== null) {
                $wcArgs['date_modified'] = '>=' . $modifiedAfter->format('Y-m-d H:i:s');
            }
            $products = wc_get_products($wcArgs);
            return is_array($products) ? $products : [];
        }

        if (!empty($resp['error'])) {
            $errors[] = sprintf('WooCommerce REST page %d error: %s', $page, $resp['error']);
        }

        return [];
    }

    /**
     * Раскрывает родительский товар: если это `variable`-товар, дополнительно запрашивает
     * все его вариации через `/wp-json/wc/v3/products/{id}/variations`.
     *
     * @param mixed              $parentProduct
     * @param array<int, string> &$errors
     * @return array<int, array{item: mixed, parentContext: ?array<string, mixed>}>
     */
    private function expandProductWithVariations(mixed $parentProduct, array &$errors): array
    {
        $entries = [
            [
                'item' => $parentProduct,
                'parentContext' => null,
            ],
        ];

        $isVariable = false;
        $parentId = null;

        if (is_object($parentProduct)) {
            $isVariable = method_exists($parentProduct, 'is_type') && $parentProduct->is_type('variable');
            $parentId = method_exists($parentProduct, 'get_id') ? $parentProduct->get_id() : null;
        } elseif (is_array($parentProduct)) {
            $isVariable = (($parentProduct['type'] ?? '') === 'variable');
            $parentId = $parentProduct['id'] ?? null;
        }

        if (!$isVariable || $parentId === null || $parentId === '') {
            return $entries;
        }

        $parentContext = null;
        try {
            $parentContext = $this->mapFields($parentProduct);
        } catch (Throwable $e) {
            // Если родительский variable-товар не имеет собственной цены, формируем базовый контекст
            if (is_array($parentProduct)) {
                $parentContext = [
                    'title' => (string) ($parentProduct['name'] ?? $parentProduct['title'] ?? ''),
                    'description' => (string) ($parentProduct['description'] ?? ''),
                    'category' => 'Uncategorized',
                    'price' => 0.0,
                    'tags' => [],
                    'url' => (string) ($parentProduct['permalink'] ?? ''),
                    'imageUrl' => $parentProduct['images'][0]['src'] ?? null,
                ];
            }
        }

        $variations = $this->fetchProductVariations($parentId, $errors);
        foreach ($variations as $variation) {
            $entries[] = [
                'item' => $variation,
                'parentContext' => $parentContext,
            ];
        }

        return $entries;
    }

    /**
     * Запрашивает все вариации variable-товара через `GET /wp-json/wc/v3/products/{id}/variations`.
     *
     * @param int|string         $parentId
     * @param array<int, string> &$errors
     * @return array<int, mixed>
     */
    private function fetchProductVariations(int|string $parentId, array &$errors): array
    {
        if ($this->variationsFetcher !== null) {
            $res = ($this->variationsFetcher)($parentId);
            return is_array($res) ? $res : [];
        }

        $allVariations = [];
        $varPage = 1;

        while (true) {
            $resp = $this->httpClient->requestWooCommerceRest(
                sprintf('/wp-json/wc/v3/products/%s/variations', rawurlencode((string) $parentId)),
                [
                    'per_page' => self::WC_REST_PER_PAGE,
                    'page' => $varPage,
                    'status' => 'publish',
                ],
                30.0,
                'syncCatalog'
            );

            if ($resp['ok'] && is_array($resp['data'])) {
                $pageItems = array_values($resp['data']);
                foreach ($pageItems as $v) {
                    $allVariations[] = $v;
                }
                if (count($pageItems) < self::WC_REST_PER_PAGE) {
                    break;
                }
                $varPage++;
                continue;
            }

            // Fallback на WC_Product::get_children() при работе внутри WordPress без REST-ключей
            if (function_exists('wc_get_product')) {
                $wcParent = wc_get_product($parentId);
                if (is_object($wcParent) && method_exists($wcParent, 'get_children')) {
                    $childIds = (array) $wcParent->get_children();
                    foreach ($childIds as $childId) {
                        $childObj = wc_get_product($childId);
                        if (is_object($childObj)) {
                            $allVariations[] = $childObj;
                        }
                    }
                }
                break;
            }

            if (!empty($resp['error'])) {
                $errors[] = sprintf('Variations fetch failed for product %s: %s', (string) $parentId, $resp['error']);
            }
            break;
        }

        return $allVariations;
    }

    /**
     * Отправляет накопленный батч (по 100 товаров) в `POST /v1/catalog/upsert` с обёрткой `{"items": [...]}`.
     *
     * @param array<int, array<string, mixed>> $batchPayload
     * @param array<int, string>               &$errors
     */
    private function flushUpsertBatch(
        array $batchPayload,
        string $callerMethod,
        int &$synced,
        int &$failed,
        array &$errors
    ): void {
        if (empty($batchPayload)) {
            return;
        }

        $resp = $this->httpClient->post(
            '/v1/catalog/upsert',
            ['items' => array_values($batchPayload)],
            60.0,
            $callerMethod
        );

        if ($resp['ok']) {
            $data = $resp['data'];
            $batchUpserted = isset($data['upserted'])
                ? (int) $data['upserted']
                : count($batchPayload);
            $batchFailed = isset($data['failed']) ? (int) $data['failed'] : 0;

            $synced += $batchUpserted;
            $failed += $batchFailed;

            if (!empty($data['errors']) && is_array($data['errors'])) {
                foreach ($data['errors'] as $errItem) {
                    $errors[] = is_string($errItem) ? $errItem : (string) json_encode($errItem);
                }
            }
            return;
        }

        $failed += count($batchPayload);
        $errors[] = $resp['error'] ?? 'upsert_batch_failed';
    }

    /**
     * Отправляет батч изменённых товаров для syncDelta и фиксирует идемпотентные хэши.
     *
     * @param array<int, array<string, mixed>>                           $batchPayload
     * @param array<int, array{id: string, fingerprint: string, timestamp: int}> $batchMeta
     */
    private function flushDeltaBatch(
        array $batchPayload,
        array $batchMeta,
        int &$synced,
        int &$maxTimestamp
    ): void {
        $resp = $this->httpClient->post(
            '/v1/catalog/upsert',
            ['items' => array_values($batchPayload)],
            60.0,
            'syncDelta'
        );

        if ($resp['ok']) {
            $data = $resp['data'];
            $batchUpserted = isset($data['upserted'])
                ? (int) $data['upserted']
                : count($batchPayload);
            $synced += $batchUpserted;

            foreach ($batchMeta as $meta) {
                $this->syncedDeltaFingerprints[$meta['id']] = $meta['fingerprint'];
                if ($meta['timestamp'] > $maxTimestamp) {
                    $maxTimestamp = $meta['timestamp'];
                }
            }
        }
    }

    private function extractModifiedTimestamp(mixed $rawItem, int $fallbackTimestamp): int
    {
        if (is_object($rawItem) && method_exists($rawItem, 'get_date_modified')) {
            $dateObj = $rawItem->get_date_modified();
            if (is_object($dateObj) && method_exists($dateObj, 'getTimestamp')) {
                return (int) $dateObj->getTimestamp();
            }
        }

        if (is_array($rawItem)) {
            $dateStr = (string) ($rawItem['date_modified_gmt'] ?? $rawItem['date_modified'] ?? '');
            if ($dateStr !== '') {
                $parsed = strtotime($dateStr);
                if ($parsed !== false) {
                    return $parsed;
                }
            }
        }

        return $fallbackTimestamp;
    }
}

if (!class_exists('Eidos_WC_Connector', false)) {
    class_alias(Connector::class, 'Eidos_WC_Connector');
}
