<?php

declare(strict_types=1);

namespace Eidos\Connectors\Bitrix;

use DateTimeImmutable;
use DateTimeInterface;
use Eidos\Connectors\Core\ConnectorInterface;
use Throwable;

/**
 * Production 1C-Bitrix Connector implementing the 6 required methods of EIDOS Connector v1.0.
 * Communicates exclusively with EIDOS via HTTPS REST API (/v1/*).
 */
class Connector implements ConnectorInterface
{
    public const ASYNC_QUEUE_THRESHOLD = 500;

    private HttpClient $httpClient;
    private Mapper $mapper;
    private SearchReplacer $searchReplacer;

    /**
     * Data source provider returning Bitrix catalog items:
     * callable(int $offset, int $limit, ?DateTimeInterface $since): array{items: array<int, array<string, mixed>>, total: int}
     *
     * @var callable
     */
    private $catalogProvider;

    /**
     * Tracks content hashes per item ID + timestamp for idempotent syncDelta execution.
     *
     * @var array<string, string>
     */
    private array $syncedDeltaFingerprints = [];

    private bool $isBackgroundJobQueued = false;

    public function __construct(
        HttpClient $httpClient,
        ?Mapper $mapper = null,
        ?SearchReplacer $searchReplacer = null,
        ?callable $catalogProvider = null
    ) {
        $this->httpClient = $httpClient;
        $this->mapper = $mapper ?? new Mapper();
        $this->searchReplacer = $searchReplacer ?? new SearchReplacer($this->httpClient, $this->mapper);
        $this->catalogProvider = $catalogProvider ?? [$this, 'fetchFromBitrixIBlock'];
    }

    /**
     * 1. Полная синхронизация каталога (батчами по batchSize, по умолчанию 100).
     * Если товаров > 500 и вызов происходит синхронно из веб-админки (forceSync = false),
     * ставит задачу в фоновый агент 1С-Битрикс (CAgent), чтобы не блокировать админку.
     *
     * @param array<string, mixed> $options
     * @return array{synced: int, failed: int, errors: array<int, string>, queued?: bool}
     */
    public function syncCatalog(array $options = []): array
    {
        $batchSize = max(1, min(500, (int) ($options['batchSize'] ?? 100)));
        $onProgress = isset($options['onProgress']) && is_callable($options['onProgress'])
            ? $options['onProgress']
            : null;
        $forceSync = (bool) ($options['forceSync'] ?? (PHP_SAPI === 'cli'));

        // Проверяем общее число товаров перед запуском
        $initialProbe = ($this->catalogProvider)(0, 1, null);
        $totalItems = (int) ($initialProbe['total'] ?? count($initialProbe['items'] ?? []));

        // Защита от блокировки админки при каталоге > 500 товаров
        if ($totalItems > self::ASYNC_QUEUE_THRESHOLD && !$forceSync) {
            $this->scheduleBitrixBackgroundSync();
            return [
                'synced' => 0,
                'failed' => 0,
                'errors' => [],
                'queued' => true,
            ];
        }

        $synced = 0;
        $failed = 0;
        $errors = [];
        $offset = 0;

        while ($offset < $totalItems || ($offset === 0 && $totalItems === 0)) {
            $batchResult = ($this->catalogProvider)($offset, $batchSize, null);
            $items = $batchResult['items'] ?? [];
            if (empty($items)) {
                break;
            }

            $batchPayload = [];
            foreach ($items as $rawItem) {
                try {
                    $mapped = $this->mapFields($rawItem);
                    $this->searchReplacer->registerLocalItemMetadata($mapped);
                    $batchPayload[] = $this->mapper->toUpsertPayload($mapped);
                } catch (Throwable $e) {
                    $failed++;
                    $msg = $e->getMessage();
                    $this->httpClient->logError('syncCatalog', $msg);
                    $errors[] = $msg;
                }
            }

            if (!empty($batchPayload)) {
                try {
                    $resp = $this->httpClient->post(
                        '/v1/catalog/upsert',
                        ['items' => $batchPayload],
                        60.0,
                        'syncCatalog'
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
                    } else {
                        $failed += count($batchPayload);
                        $errors[] = sprintf(
                            'Batch offset %d: %s',
                            $offset,
                            $resp['error'] ?? 'upsert_failed'
                        );
                    }
                } catch (Throwable $e) {
                    $failed += count($batchPayload);
                    $msg = $e->getMessage();
                    $this->httpClient->logError('syncCatalog', $msg);
                    $errors[] = $msg;
                }
            }

            $offset += count($items);
            if ($onProgress !== null) {
                $onProgress($offset, $totalItems, $synced, $failed);
            }

            if (count($items) < $batchSize) {
                break;
            }
        }

        return [
            'synced' => $synced,
            'failed' => $failed,
            'errors' => $errors,
        ];
    }

    /**
     * 2. Инкрементальная синхронизация товаров, изменённых с момента $since
     * (по полю b_iblock_element.TIMESTAMP_X или b_search_content.DATE_CHANGE).
     * Идемпотентна: повторный вызов с тем же $since не дублирует отправку неизменённых версий.
     *
     * @param DateTimeInterface $since
     * @param int $batchSize
     * @return array{synced: int, since: DateTimeInterface}
     */
    public function syncDelta(DateTimeInterface $since, int $batchSize = 100): array
    {
        $effectiveBatchSize = max(1, min(500, $batchSize));
        $offset = 0;
        $synced = 0;
        $maxTimestamp = $since->getTimestamp();

        while (true) {
            $batchResult = ($this->catalogProvider)($offset, $effectiveBatchSize, $since);
            $items = $batchResult['items'] ?? [];
            if (empty($items)) {
                break;
            }

            $batchPayload = [];
            $batchMeta = [];

            foreach ($items as $rawItem) {
                try {
                    $mapped = $this->mapFields($rawItem);
                    $itemModifiedStr = (string) ($rawItem['TIMESTAMP_X'] ?? $rawItem['DATE_CHANGE'] ?? '');
                    $itemTimestamp = $itemModifiedStr !== ''
                        ? (int) strtotime($itemModifiedStr)
                        : $since->getTimestamp();

                    // Проверка идемпотентности по отпечатку (ID + TIMESTAMP_X + контент)
                    $fingerprint = sha1(
                        $mapped['id'] . '|' . $itemTimestamp . '|' . $mapped['title'] . '|' . $mapped['price'] . '|' . ($mapped['inStock'] ? '1' : '0')
                    );

                    if (isset($this->syncedDeltaFingerprints[$mapped['id']]) && $this->syncedDeltaFingerprints[$mapped['id']] === $fingerprint) {
                        continue;
                    }

                    $this->searchReplacer->registerLocalItemMetadata($mapped);
                    $batchPayload[] = $this->mapper->toUpsertPayload($mapped);
                    $batchMeta[] = [
                        'id' => $mapped['id'],
                        'fingerprint' => $fingerprint,
                        'timestamp' => $itemTimestamp,
                    ];
                } catch (Throwable $e) {
                    $this->httpClient->logError('syncDelta', $e->getMessage());
                }
            }

            if (!empty($batchPayload)) {
                try {
                    $resp = $this->httpClient->post(
                        '/v1/catalog/upsert',
                        ['items' => $batchPayload],
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
                } catch (Throwable $e) {
                    $this->httpClient->logError('syncDelta', $e->getMessage());
                }
            }

            $offset += count($items);
            if (count($items) < $effectiveBatchSize) {
                break;
            }
        }

        // Возвращаем точный TIMESTAMP_X последнего синхронизированного товара (а не now()),
        // чтобы не пропустить товары, обновлённые во время работы синхронизации.
        $nextSince = $synced > 0
            ? (new DateTimeImmutable())->setTimestamp($maxTimestamp)
            : DateTimeImmutable::createFromInterface($since);

        return [
            'synced' => $synced,
            'since' => $nextSince,
        ];
    }

    /**
     * 3. Гибридный поиск с реальной подменой выдачи 1С-Битрикс ($arResult, $GLOBALS['searchFilter'], $GLOBALS['arrFilter'])
     * и автоматическим fallback на стандартный поиск Битрикса.
     *
     * @param string $query
     * @param array<string, mixed> $options
     * @return array<int, array<string, mixed>>
     */
    public function replaceSearch(string $query, array $options = []): array
    {
        return $this->searchReplacer->replaceSearch($query, $options);
    }

    /**
     * Напрямую заменяет поисковую выдачу внутри компонента 1С-Битрикс ($arResult['ITEMS'], $arResult['SEARCH'], $arResult['ELEMENTS']).
     *
     * @param array<string, mixed> $arResult
     * @param string $query
     * @param array<string, mixed> $options
     * @return array<int, array<string, mixed>>
     */
    public function applySearchToComponent(array &$arResult, string $query, array $options = []): array
    {
        return $this->searchReplacer->applyToBitrixComponent($arResult, $query, $options);
    }

    /**
     * 4. Неблокирующая отправка сигнала обратной связи (click, like, purchase, dislike) в POST /v1/feedback.
     *
     * @param array{userId?: string, itemId: string, eventType: string, query?: ?string, timestamp?: DateTimeInterface|string|int} $event
     * @return bool
     */
    public function pushFeedback(array $event): bool
    {
        try {
            $userId = $this->mapper->cleanPlainText((string) ($event['userId'] ?? ''), 100);
            if ($userId === '') {
                $userId = 'anonymous';
            }
            $itemId = $this->mapper->cleanPlainText((string) ($event['itemId'] ?? ''), 100);
            $eventType = strtolower(trim((string) ($event['eventType'] ?? '')));

            $allowedEvents = ['click', 'like', 'purchase', 'dislike', 'ignore'];
            if ($itemId === '' || !in_array($eventType, $allowedEvents, true)) {
                $this->httpClient->logError('pushFeedback', 'Invalid feedback event parameters');
                return false;
            }

            $rawTs = $event['timestamp'] ?? null;
            if ($rawTs instanceof DateTimeInterface) {
                $ts = $rawTs->getTimestamp() * 1000;
            } elseif (is_int($rawTs) || is_float($rawTs)) {
                $ts = $rawTs < 10_000_000_000 ? (int) round($rawTs * 1000) : (int) $rawTs;
            } elseif (is_string($rawTs) && $rawTs !== '') {
                $parsed = strtotime($rawTs);
                $ts = $parsed !== false ? $parsed * 1000 : (int) round(microtime(true) * 1000);
            } else {
                $ts = (int) round(microtime(true) * 1000);
            }

            $payload = [
                'userId' => $userId,
                'itemId' => $itemId,
                'eventType' => $eventType,
                'timestamp' => $ts,
            ];

            if (!empty($event['query'])) {
                $cleanQuery = $this->mapper->cleanPlainText((string) $event['query'], 200);
                $payload['query'] = $cleanQuery;
                $payload['context'] = [
                    'sessionId' => $cleanQuery,
                    'timestamp' => $ts,
                ];
            }

            $resp = $this->httpClient->request(
                'POST',
                '/v1/feedback',
                $payload,
                1.0,
                'pushFeedback'
            );

            return $resp['ok'];
        } catch (Throwable $e) {
            $this->httpClient->logError('pushFeedback', $e->getMessage());
            return false;
        }
    }

    /**
     * 5. Проверка доступности EIDOS (GET /v1/health) с таймаутом 3 секунды.
     *
     * @return array{ok: bool, version: string, itemsIndexed: int, latencyMs: float, error: ?string}
     */
    public function healthCheck(): array
    {
        $resp = $this->httpClient->request(
            'GET',
            '/v1/health',
            null,
            3.0,
            'healthCheck'
        );

        if (!$resp['ok']) {
            return [
                'ok' => false,
                'version' => '',
                'itemsIndexed' => 0,
                'latencyMs' => $resp['latencyMs'],
                'error' => $resp['error'] === 'timeout' ? 'timeout' : ($resp['error'] ?? 'unreachable'),
            ];
        }

        $data = $resp['data'];
        $itemsIndexed = (int) (
            $data['itemsIndexed']
            ?? $data['itemsCount']
            ?? $data['checks']['vectorStore']['itemCount']
            ?? $data['checks']['vectorStore']['itemsCount']
            ?? 0
        );

        return [
            'ok' => true,
            'version' => (string) ($data['version'] ?? '1.0.0'),
            'itemsIndexed' => $itemsIndexed,
            'latencyMs' => $resp['latencyMs'],
            'error' => null,
        ];
    }

    /**
     * 6. Маппинг товара из формата 1С-Битрикс в формат EIDOS Connector v1.0.
     *
     * @param mixed $systemItem
     * @return array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl?: ?string}
     */
    public function mapFields(mixed $systemItem): array
    {
        return $this->mapper->mapFields($systemItem);
    }

    public function isBackgroundJobQueued(): bool
    {
        return $this->isBackgroundJobQueued;
    }

    /**
     * Создаёт экземпляр коннектора из настроек модуля 1С-Битрикс (COption / b_option).
     */
    public static function fromBitrixOptions(bool $enforceHttps = true): self
    {
        $apiUrl = Settings::getOption('api_url', Settings::getOption(Settings::OPT_API_URL, 'https://localhost:3000'));
        $apiKey = Settings::getOption('api_key', Settings::getOption(Settings::OPT_API_KEY, ''));

        $httpClient = new HttpClient($apiUrl, $apiKey, 2.5, 1, $enforceHttps);
        return new self($httpClient);
    }

    /**
     * Системный обработчик события main:OnBeforeProlog в 1С-Битрикс.
     * Автоматически перехватывает поисковые запросы (?q=...) на витрине магазина,
     * выполняет гибридный поиск в EIDOS (с fallback на Битрикс) и заполняет
     * $GLOBALS['searchFilter'], $GLOBALS['arrFilter'] и $GLOBALS['EIDOS_SEARCH_RESULT'].
     */
    public static function onBeforeProlog(): void
    {
        if (defined('ADMIN_SECTION') && constant('ADMIN_SECTION') === true) {
            return;
        }

        $query = trim((string) ($_GET['q'] ?? $_REQUEST['q'] ?? ''));
        if ($query === '') {
            return;
        }

        try {
            $connector = isset($GLOBALS['__EIDOS_TEST_CONNECTOR']) && $GLOBALS['__EIDOS_TEST_CONNECTOR'] instanceof self
                ? $GLOBALS['__EIDOS_TEST_CONNECTOR']
                : self::fromBitrixOptions(false);

            $connector->replaceSearch($query, [
                'limit' => (int) ($_GET['limit'] ?? 20),
            ]);
        } catch (Throwable $e) {
            if (function_exists('AddMessage2Log')) {
                AddMessage2Log('[EIDOS] onBeforeProlog search hook error: ' . $e->getMessage(), 'eidos.connector');
            }
        }
    }

    /**
     * Агент 1С-Битрикс (CAgent) для ежечасного запуска syncDelta.
     * Возвращает строку вызова агента для повторного выполнения через 3600 сек.
     */
    public static function syncDeltaAgent(): string
    {
        try {
            $defaultSince = date('Y-m-d H:i:s', strtotime('-1 hour'));
            $lastSync = Settings::getOption(
                'last_sync',
                Settings::getOption(Settings::OPT_LAST_DELTA_SYNC, $defaultSince)
            );

            $connector = self::fromBitrixOptions(false);
            $result = $connector->syncDelta(new DateTimeImmutable($lastSync));

            $nextSinceStr = $result['since']->format('Y-m-d H:i:s');
            Settings::setOption('last_sync', $nextSinceStr);
            Settings::setOption(Settings::OPT_LAST_DELTA_SYNC, $nextSinceStr);
        } catch (Throwable $e) {
            if (function_exists('AddMessage2Log')) {
                AddMessage2Log('[EIDOS] syncDeltaAgent error: ' . $e->getMessage(), 'eidos.connector');
            }
        }

        return 'EidosConnector::syncDeltaAgent();';
    }

    /**
     * Одноразовый фоновый агент для полной синхронизации каталога > 500 товаров.
     */
    public static function runFullSyncAgent(): string
    {
        try {
            $connector = self::fromBitrixOptions(false);
            $connector->syncCatalog(['batchSize' => 100, 'forceSync' => true]);
        } catch (Throwable $e) {
            if (function_exists('AddMessage2Log')) {
                AddMessage2Log('[EIDOS] runFullSyncAgent error: ' . $e->getMessage(), 'eidos.connector');
            }
        }

        return '';
    }

    /**
     * Регистрирует одноразовый фоновый агент в 1С-Битрикс для полной синхронизации каталога > 500 товаров.
     */
    private function scheduleBitrixBackgroundSync(): void
    {
        $this->isBackgroundJobQueued = true;
        if (class_exists('\CAgent')) {
            /** @phpstan-ignore-next-line */
            \CAgent::AddAgent(
                '\\Eidos\\Connectors\\Bitrix\\Connector::runFullSyncAgent();',
                'eidos.connector',
                'N',
                60
            );
        }
    }

    /**
     * Чтение элементов инфоблока 1С-Битрикс (b_iblock_element + b_catalog_price + b_catalog_product).
     *
     * @param int $offset
     * @param int $limit
     * @param DateTimeInterface|null $since
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    private function fetchFromBitrixIBlock(int $offset, int $limit, ?DateTimeInterface $since): array
    {
        if (class_exists('\CModule')) {
            /** @phpstan-ignore-next-line */
            \CModule::IncludeModule('iblock');
            /** @phpstan-ignore-next-line */
            \CModule::IncludeModule('catalog');
        }

        if (!class_exists('\CIBlockElement')) {
            return ['items' => [], 'total' => 0];
        }

        $iblockId = (int) Settings::getOption('iblock_id', Settings::getOption(Settings::OPT_IBLOCK_ID, '0'));
        $arFilter = ['ACTIVE' => 'Y'];
        if ($iblockId > 0) {
            $arFilter['IBLOCK_ID'] = $iblockId;
        }
        if ($since !== null) {
            $arFilter['>TIMESTAMP_X'] = function_exists('ConvertTimeStamp')
                ? (string) ConvertTimeStamp($since->getTimestamp(), 'FULL')
                : $since->format('d.m.Y H:i:s');
        }

        /** @phpstan-ignore-next-line */
        $total = (int) \CIBlockElement::GetList([], $arFilter, []);
        $pageNumber = (int) floor($offset / max(1, $limit)) + 1;

        /** @phpstan-ignore-next-line */
        $rsElements = \CIBlockElement::GetList(
            ['TIMESTAMP_X' => 'ASC', 'ID' => 'ASC'],
            $arFilter,
            false,
            ['iNumPage' => $pageNumber, 'nPageSize' => $limit, 'checkOutOfRange' => true],
            [
                'ID',
                'IBLOCK_ID',
                'NAME',
                'DETAIL_TEXT',
                'PREVIEW_TEXT',
                'IBLOCK_SECTION_ID',
                'DETAIL_PAGE_URL',
                'PREVIEW_PICTURE',
                'TAGS',
                'TIMESTAMP_X',
                'CATALOG_PRICE_1',
                'CATALOG_QUANTITY',
            ]
        );

        $items = [];
        while ($row = $rsElements->GetNext()) {
            $itemId = (int) $row['ID'];

            // Получаем базовую цену из модуля торгового каталога (b_catalog_price)
            $priceVal = (float) ($row['CATALOG_PRICE_1'] ?? 0.0);
            if (class_exists('\CPrice')) {
                /** @phpstan-ignore-next-line */
                $basePrice = \CPrice::GetBasePrice($itemId);
                if (is_array($basePrice) && isset($basePrice['PRICE'])) {
                    $priceVal = (float) $basePrice['PRICE'];
                }
            }

            // Получаем остаток товара из b_catalog_product
            $quantityVal = (float) ($row['CATALOG_QUANTITY'] ?? 0.0);
            if (class_exists('\CCatalogProduct')) {
                /** @phpstan-ignore-next-line */
                $catalogProduct = \CCatalogProduct::GetByID($itemId);
                if (is_array($catalogProduct) && isset($catalogProduct['QUANTITY'])) {
                    $quantityVal = (float) $catalogProduct['QUANTITY'];
                }
            }

            // Получаем название раздела инфоблока
            $sectionName = (string) ($row['IBLOCK_SECTION_NAME'] ?? '');
            if ($sectionName === '' && !empty($row['IBLOCK_SECTION_ID']) && class_exists('\CIBlockSection')) {
                /** @phpstan-ignore-next-line */
                $rsSection = \CIBlockSection::GetByID((int) $row['IBLOCK_SECTION_ID']);
                if ($rsSection && ($arSection = $rsSection->GetNext())) {
                    $sectionName = (string) ($arSection['NAME'] ?? 'General');
                }
            }

            $items[] = [
                'ID' => $row['ID'],
                'NAME' => $row['NAME'],
                'DETAIL_TEXT' => $row['DETAIL_TEXT'] ?: $row['PREVIEW_TEXT'],
                'PREVIEW_TEXT' => $row['PREVIEW_TEXT'] ?? '',
                'SECTION_NAME' => $sectionName !== '' ? $sectionName : 'General',
                'PRICE' => $priceVal,
                'QUANTITY' => $quantityVal,
                'TAGS' => $row['TAGS'] ?? '',
                'DETAIL_PAGE_URL' => $row['DETAIL_PAGE_URL'] ?? '',
                'PREVIEW_PICTURE' => $row['PREVIEW_PICTURE'] ?? null,
                'TIMESTAMP_X' => $row['TIMESTAMP_X'] ?? '',
            ];
        }

        return [
            'items' => $items,
            'total' => $total,
        ];
    }
}
