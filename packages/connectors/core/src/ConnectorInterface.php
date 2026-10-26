<?php

declare(strict_types=1);

namespace Eidos\Connectors\Core;

use DateTimeInterface;

/**
 * EIDOS Connector v1.0 Contract Interface.
 * Every CMS connector (Bitrix, WooCommerce, etc.) MUST implement these 6 methods.
 */
interface ConnectorInterface
{
    /**
     * 1. Full catalog synchronization in batches.
     * If catalog size > 500 and running in web admin context, schedules background queue/cron.
     *
     * @param array<string, mixed> $options ['batchSize' => int, 'onProgress' => ?callable, 'forceSync' => ?bool]
     * @return array{synced: int, failed: int, errors: array<int, string>, queued?: bool}
     */
    public function syncCatalog(array $options = []): array;

    /**
     * 2. Idempotent incremental delta synchronization for items modified since $since.
     *
     * @param DateTimeInterface $since
     * @param int $batchSize
     * @return array{synced: int, since: DateTimeInterface}
     */
    public function syncDelta(DateTimeInterface $since, int $batchSize = 100): array;

    /**
     * 3. Hybrid search replacement returning results in native CMS format,
     * with automatic fallback to native CMS search if EIDOS is unreachable.
     *
     * @param string $query
     * @param array<string, mixed> $options ['limit' => int, 'filters' => array, 'alpha' => float, 'diversityFactor' => float]
     * @return array<int, mixed>
     */
    public function replaceSearch(string $query, array $options = []): array;

    /**
     * 4. Non-blocking user feedback ingestion (click, like, purchase, dislike).
     * Never throws to user; logs and returns false on error.
     *
     * @param array{userId: string, itemId: string, eventType: string, query?: ?string, timestamp: DateTimeInterface} $event
     * @return bool
     */
    public function pushFeedback(array $event): bool;

    /**
     * 5. EIDOS cluster health check with strict 3-second timeout.
     *
     * @return array{ok: bool, version: string, itemsIndexed: int, latencyMs: float, error: ?string}
     */
    public function healthCheck(): array;

    /**
     * 6. Transforms native CMS item into canonical EIDOS Connector v1.0 schema.
     * Strips HTML and truncates description to 5000 characters.
     *
     * @param mixed $systemItem
     * @return array{id: string, title: string, description: string, category: string, price: float, inStock: bool, tags: array<int, string>, url: string, imageUrl?: ?string}
     */
    public function mapFields(mixed $systemItem): array;
}
