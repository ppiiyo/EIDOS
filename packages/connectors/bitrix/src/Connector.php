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

            foreach ($items as $rawItem) {
                try {
                    $mapped = $this->mapFields($rawItem);
                    $this->searchReplacer->registerLocalItemMetadata($mapped);
                    $wirePayload = $this->mapper->toUpsertPayload($mapped);

                    $resp = $this->httpClient->request(
                        'POST',
                        '/v1/catalog/upsert',
                        $wirePayload,
                        5.0,
                        'syncCatalog'
                    );

                    if ($resp['ok']) {
                        $synced++;
                    } else {
                        $failed++;
                        $errors[] = sprintf('Item %s: %s', $mapped['id'], $resp['error'] ?? 'upsert_failed');
                    }
                } catch (Throwable $e) {
                    $failed++;
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
                    $wirePayload = $this->mapper->toUpsertPayload($mapped);

                    $resp = $this->httpClient->request(
                        'POST',
                        '/v1/catalog/upsert',
                        $wirePayload,
                        5.0,
                        'syncDelta'
                    );

                    if ($resp['ok']) {
                        $synced++;
                        $this->syncedDeltaFingerprints[$mapped['id']] = $fingerprint;
                        if ($itemTimestamp > $maxTimestamp) {
                            $maxTimestamp = $itemTimestamp;
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

        // Сдвигаем watermark на +1 секунду от максимального TIMESTAMP_X при наличии изменений
        $nextSince = $synced > 0
            ? (new DateTimeImmutable())->setTimestamp($maxTimestamp + 1)
            : DateTimeImmutable::createFromInterface($since);

        return [
            'synced' => $synced,
            'since' => $nextSince,
        ];
    }

    /**
     * 3. Гибридный поиск с возвратом в формате 1С-Битрикс и автоматическим fallback.
     *
     * @param string $query
     * @param array<string, mixed> $options
     * @return array<int, array{ID: string, NAME: string, DETAIL_PAGE_URL: string, PRICE: float, PREVIEW_PICTURE: ?string}>
     */
    public function replaceSearch(string $query, array $options = []): array
    {
        return $this->searchReplacer->replaceSearch($query, $options);
    }

    /**
     * 4. Неблокирующая отправка сигнала обратной связи (click, like, purchase, dislike) в POST /v1/feedback.
     *
     * @param array{userId: string, itemId: string, eventType: string, query?: ?string, timestamp: DateTimeInterface} $event
     * @return bool
     */
    public function pushFeedback(array $event): bool
    {
        try {
            $userId = $this->mapper->cleanPlainText((string) ($event['userId'] ?? ''), 100);
            $itemId = $this->mapper->cleanPlainText((string) ($event['itemId'] ?? ''), 100);
            $eventType = strtolower(trim((string) ($event['eventType'] ?? '')));

            $allowedEvents = ['click', 'like', 'purchase', 'dislike', 'ignore'];
            if ($userId === '' || $itemId === '' || !in_array($eventType, $allowedEvents, true)) {
                $this->httpClient->logError('pushFeedback', 'Invalid feedback event parameters');
                return false;
            }

            $ts = $event['timestamp'] instanceof DateTimeInterface
                ? $event['timestamp']->getTimestamp() * 1000
                : (int) round(microtime(true) * 1000);

            $payload = [
                'userId' => $userId,
                'itemId' => $itemId,
                'eventType' => $eventType,
                'timestamp' => $ts,
            ];

            if (!empty($event['query'])) {
                $payload['context'] = [
                    'sessionId' => $this->mapper->cleanPlainText((string) $event['query'], 200),
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
     * Чтение элементов инфоблока 1С-Битрикс (b_iblock_element.TIMESTAMP_X).
     *
     * @param int $offset
     * @param int $limit
     * @param DateTimeInterface|null $since
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    private function fetchFromBitrixIBlock(int $offset, int $limit, ?DateTimeInterface $since): array
    {
        if (!class_exists('\CIBlockElement')) {
            return ['items' => [], 'total' => 0];
        }

        $arFilter = ['ACTIVE' => 'Y'];
        if ($since !== null) {
            $arFilter['>=TIMESTAMP_X'] = $since->format('d.m.Y H:i:s');
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
            ['ID', 'NAME', 'DETAIL_TEXT', 'PREVIEW_TEXT', 'DETAIL_PAGE_URL', 'PREVIEW_PICTURE', 'TAGS', 'TIMESTAMP_X', 'CATALOG_PRICE_1', 'CATALOG_QUANTITY']
        );

        $items = [];
        while ($row = $rsElements->GetNext()) {
            $items[] = [
                'ID' => $row['ID'],
                'NAME' => $row['NAME'],
                'DETAIL_TEXT' => $row['DETAIL_TEXT'] ?: $row['PREVIEW_TEXT'],
                'SECTION_NAME' => $row['IBLOCK_SECTION_NAME'] ?? 'General',
                'PRICE' => $row['CATALOG_PRICE_1'] ?? 0,
                'QUANTITY' => $row['CATALOG_QUANTITY'] ?? 0,
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
