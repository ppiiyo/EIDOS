<?php

declare(strict_types=1);

namespace Eidos\Connectors\Core;

use DateTimeInterface;

if (!interface_exists(ConnectorInterface::class)) {
    /**
     * EIDOS Connector v1.0 Contract Interface.
     * Every CMS connector (Bitrix, WooCommerce, etc.) MUST implement these 6 methods.
     */
    interface ConnectorInterface
    {
        public function syncCatalog(array $options = []): array;

        public function syncDelta(DateTimeInterface $since, int $batchSize = 100): array;

        public function replaceSearch(string $query, array $options = []): array;

        public function pushFeedback(array $event): bool;

        public function healthCheck(): array;

        public function mapFields(mixed $systemItem): array;
    }
}
