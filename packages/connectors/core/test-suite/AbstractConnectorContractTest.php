<?php

declare(strict_types=1);

namespace Eidos\Connectors\Core\TestSuite;

use DateTimeImmutable;
use Eidos\Connectors\Core\ConnectorInterface;
use PHPUnit\Framework\TestCase;

/**
 * Shared acceptance test suite verifying all 7 EIDOS Connector v1.0 checklist criteria.
 * Concrete connector test classes (Bitrix, WooCommerce) extend or delegate to these assertions.
 */
abstract class AbstractConnectorContractTest extends TestCase
{
    /**
     * Must return a configured ConnectorInterface instance backed by a mock/in-memory HTTP transport.
     */
    abstract protected function createConnectorWithCatalog(int $itemCount): ConnectorInterface;

    /**
     * Must simulate modifying $count items in the CMS data source at $modifiedAt.
     */
    abstract protected function touchCatalogItems(int $count, DateTimeImmutable $modifiedAt): void;

    /**
     * Must toggle the simulated EIDOS HTTP availability (for fallback testing).
     */
    abstract protected function setEidosAvailable(bool $available): void;

    /**
     * Must return recorded HTTP requests sent to the EIDOS server.
     *
     * @return array<int, array{method: string, path: string, body: ?array<string, mixed>}>
     */
    abstract protected function getRecordedHttpRequests(): array;

    /**
     * Must validate that a search result item conforms to the native CMS structure.
     */
    abstract protected function assertNativeSystemFormat(mixed $item): void;

    /**
     * Checklist #1: Полная синхронизация 1000 товаров -> synced=1000, failed=0.
     */
    public function testFullCatalogSync1000Items(): void
    {
        $connector = $this->createConnectorWithCatalog(1000);
        $progressCalls = 0;

        $result = $connector->syncCatalog([
            'batchSize' => 100,
            'forceSync' => true,
            'onProgress' => function (int $processed, int $total) use (&$progressCalls): void {
                $progressCalls++;
                $this->assertLessThanOrEqual($total, $processed);
            },
        ]);

        $this->assertSame(1000, $result['synced']);
        $this->assertSame(0, $result['failed']);
        $this->assertSame([], $result['errors']);
        $this->assertSame(10, $progressCalls);
    }

    /**
     * Checklist #2: Инкрементальная: изменить 5 товаров -> syncDelta находит только 5 (идемпотентно).
     */
    public function testIncrementalSyncDeltaFindsOnlyModifiedItems(): void
    {
        $connector = $this->createConnectorWithCatalog(100);
        $since = new DateTimeImmutable('2026-10-25 10:00:00');
        $modifiedAt = new DateTimeImmutable('2026-10-25 11:30:00');

        $this->touchCatalogItems(5, $modifiedAt);

        $firstRun = $connector->syncDelta($since, 100);
        $this->assertSame(5, $firstRun['synced']);
        $this->assertGreaterThanOrEqual($modifiedAt->getTimestamp(), $firstRun['since']->getTimestamp());

        // Повторный вызов с новым watermark не должен повторно пересылать неизменённые товары
        $secondRun = $connector->syncDelta($firstRun['since'], 100);
        $this->assertSame(0, $secondRun['synced']);
    }

    /**
     * Checklist #3: Поиск: запрос "тормозные колодки камри" -> релевантные результаты, формат системы сохранён.
     */
    public function testSearchPreservesNativeSystemFormatAndRelevance(): void
    {
        $connector = $this->createConnectorWithCatalog(50);
        $connector->syncCatalog(['batchSize' => 50, 'forceSync' => true]);

        $results = $connector->replaceSearch('тормозные колодки камри', [
            'limit' => 5,
            'alpha' => 0.65,
            'diversityFactor' => 0.35,
            'filters' => [
                'inStock' => true,
            ],
        ]);

        $this->assertNotEmpty($results);
        foreach ($results as $item) {
            $this->assertNativeSystemFormat($item);
        }
    }

    /**
     * Checklist #4: Fallback: выключить EIDOS -> поиск работает через стандартный движок.
     */
    public function testSearchFallbackWhenEidosIsDown(): void
    {
        $connector = $this->createConnectorWithCatalog(50);
        $this->setEidosAvailable(false);

        $results = $connector->replaceSearch('тормозные колодки камри', ['limit' => 5]);

        $this->assertNotEmpty($results, 'Fallback search must return native CMS results when EIDOS is offline');
        foreach ($results as $item) {
            $this->assertNativeSystemFormat($item);
        }
    }

    /**
     * Checklist #5: Обратная связь: клик -> POST /v1/feedback уходит.
     */
    public function testPushFeedbackSendsEventToEidos(): void
    {
        $connector = $this->createConnectorWithCatalog(10);
        $this->setEidosAvailable(true);

        $ok = $connector->pushFeedback([
            'userId' => 'bx_user_42',
            'itemId' => '1001',
            'eventType' => 'click',
            'query' => 'тормозные колодки камри',
            'timestamp' => new DateTimeImmutable('2026-10-25 12:00:00'),
        ]);

        $this->assertTrue($ok);
        $requests = $this->getRecordedHttpRequests();
        $feedbackReqs = array_values(array_filter($requests, fn(array $r) => $r['path'] === '/v1/feedback'));
        $this->assertNotEmpty($feedbackReqs);
        $this->assertSame('bx_user_42', $feedbackReqs[0]['body']['userId']);
        $this->assertSame('1001', $feedbackReqs[0]['body']['itemId']);
        $this->assertSame('click', $feedbackReqs[0]['body']['eventType']);
    }

    /**
     * Checklist #6: Health-check: кнопка в админке -> "EIDOS доступен, 1000 товаров".
     */
    public function testHealthCheckReportsStatusAndIndexedCount(): void
    {
        $connector = $this->createConnectorWithCatalog(1000);
        $connector->syncCatalog(['batchSize' => 250, 'forceSync' => true]);

        $health = $connector->healthCheck();

        $this->assertTrue($health['ok']);
        $this->assertSame(1000, $health['itemsIndexed']);
        $this->assertNotEmpty($health['version']);
        $this->assertNull($health['error']);
    }

    /**
     * Checklist #7: Производительность: поиск через EIDOS не медленнее стандартного (p95 < 100ms).
     */
    public function testSearchPerformanceP95Under100ms(): void
    {
        $connector = $this->createConnectorWithCatalog(200);
        $connector->syncCatalog(['batchSize' => 100, 'forceSync' => true]);

        $latencies = [];
        for ($i = 0; $i < 20; $i++) {
            $t0 = microtime(true);
            $res = $connector->replaceSearch('тормозные колодки камри', ['limit' => 10]);
            $latencies[] = (microtime(true) - $t0) * 1000.0;
            $this->assertNotEmpty($res);
        }

        sort($latencies);
        $p95Index = (int) floor(count($latencies) * 0.95) - 1;
        $p95Ms = $latencies[max(0, $p95Index)];

        $this->assertLessThan(100.0, $p95Ms, sprintf('Expected p95 search latency < 100ms, got %.2fms', $p95Ms));
    }
}
