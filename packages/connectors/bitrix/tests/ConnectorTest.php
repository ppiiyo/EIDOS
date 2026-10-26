<?php

declare(strict_types=1);

namespace Eidos\Connectors\Bitrix\Tests;

use DateTimeImmutable;
use DateTimeInterface;
use Eidos\Connectors\Bitrix\Connector;
use Eidos\Connectors\Bitrix\HttpClient;
use Eidos\Connectors\Bitrix\Mapper;
use Eidos\Connectors\Bitrix\SearchReplacer;
use Eidos\Connectors\Bitrix\Settings;
use Eidos\Connectors\Core\ConnectorInterface;
use Eidos\Connectors\Core\TestSuite\AbstractConnectorContractTest;

/**
 * PHPUnit Acceptance Test Suite for the 1C-Bitrix EIDOS Connector v1.0.
 * Covers all 7 mandatory acceptance checklist scenarios plus security and HTML sanitization checks.
 */
final class ConnectorTest extends AbstractConnectorContractTest
{
    /** @var array<int, array<string, mixed>> */
    private array $bitrixIBlockItems = [];

    /** @var array<string, array<string, mixed>> */
    private array $eidosIndexedStore = [];

    /** @var array<int, array{method: string, path: string, body: ?array<string, mixed>}> */
    private array $recordedRequests = [];

    private bool $eidosAvailable = true;

    protected function createConnectorWithCatalog(int $itemCount): ConnectorInterface
    {
        $this->bitrixIBlockItems = [];
        $this->eidosIndexedStore = [];
        $this->recordedRequests = [];
        $this->eidosAvailable = true;

        $baseTimestamp = new DateTimeImmutable('2026-10-25 08:00:00');

        for ($i = 1; $i <= $itemCount; $i++) {
            $isCamryBrakePads = ($i <= 3);
            $this->bitrixIBlockItems[$i] = [
                'ID' => (string) (1000 + $i),
                'NAME' => $isCamryBrakePads
                    ? sprintf('Тормозные колодки керамические Toyota Camry XV70 #%d', $i)
                    : sprintf('Масляный фильтр двигателя универсальный #%d', $i),
                'DETAIL_TEXT' => $isCamryBrakePads
                    ? '<p>Оригинальные передние <b>тормозные колодки</b> для <i>Тойота Камри</i> XV50/XV70. Не пылят, без скрипа.</p>'
                    : '<p>Стандартный расходник для технического обслуживания автомобиля.</p>',
                'SECTION_NAME' => $isCamryBrakePads ? 'Тормозная система' : 'Фильтры',
                'PRICE' => $isCamryBrakePads ? 4500.0 + ($i * 100) : 850.0,
                'QUANTITY' => 15,
                'TAGS' => $isCamryBrakePads ? 'тормозные колодки, камри, toyota, camry' : 'фильтр, масло',
                'DETAIL_PAGE_URL' => sprintf('/catalog/auto/%d/', 1000 + $i),
                'PREVIEW_PICTURE' => sprintf('/upload/iblock/eidos/item_%d.jpg', 1000 + $i),
                'TIMESTAMP_X' => $baseTimestamp->format('Y-m-d H:i:s'),
            ];
        }

        $httpClient = new HttpClient(
            'https://eidos.internal.example.com',
            'test-secret-api-key',
            2.5,
            1,
            true,
            function (string $method, string $path, ?array $body, float $timeoutSec): array {
                $this->recordedRequests[] = [
                    'method' => $method,
                    'path' => $path,
                    'body' => $body,
                ];

                if (!$this->eidosAvailable) {
                    return [
                        'status' => 503,
                        'body' => ['error' => 'Service Unavailable'],
                        'error' => 'timeout',
                        'latencyMs' => min(3000.0, $timeoutSec * 1000.0),
                    ];
                }

                if ($path === '/v1/catalog/upsert' && $method === 'POST' && $body !== null) {
                    $id = (string) $body['id'];
                    $this->eidosIndexedStore[$id] = $body;
                    return [
                        'status' => 200,
                        'body' => [
                            'success' => true,
                            'item' => [
                                'id' => $id,
                                'title' => $body['title'],
                                'category' => $body['category'] ?? 'General',
                            ],
                        ],
                        'error' => null,
                        'latencyMs' => 2.1,
                    ];
                }

                if ($path === '/v1/search' && $method === 'POST' && $body !== null) {
                    $q = mb_strtolower((string) ($body['query'] ?? ''), 'UTF-8');
                    $limit = (int) ($body['limit'] ?? 10);
                    $hits = [];

                    foreach ($this->eidosIndexedStore as $stored) {
                        $haystack = mb_strtolower(
                            $stored['title'] . ' ' . ($stored['description'] ?? '') . ' ' . implode(' ', $stored['tags'] ?? []),
                            'UTF-8'
                        );
                        $score = (mb_strpos($haystack, 'колодки', 0, 'UTF-8') !== false || mb_strpos($haystack, 'камри', 0, 'UTF-8') !== false || mb_strpos($haystack, $q, 0, 'UTF-8') !== false)
                            ? 0.94
                            : 0.31;

                        if ($score > 0.5) {
                            $hits[] = [
                                'id' => $stored['id'],
                                'title' => $stored['title'],
                                'description' => $stored['description'] ?? '',
                                'category' => $stored['category'] ?? 'General',
                                'tags' => $stored['tags'] ?? [],
                                'price' => $stored['price'] ?? 0.0,
                                'score' => $score,
                                'source' => 'hybrid',
                            ];
                        }
                    }

                    usort($hits, static fn(array $a, array $b): int => $b['score'] <=> $a['score']);

                    return [
                        'status' => 200,
                        'body' => [
                            'query' => $body['query'],
                            'mode' => 'hybrid',
                            'results' => array_slice($hits, 0, $limit),
                            'count' => min($limit, count($hits)),
                            'latencyMs' => 4.2,
                            'cacheHit' => false,
                        ],
                        'error' => null,
                        'latencyMs' => 4.8,
                    ];
                }

                if ($path === '/v1/feedback' && $method === 'POST') {
                    return [
                        'status' => 200,
                        'body' => ['accepted' => true],
                        'error' => null,
                        'latencyMs' => 1.5,
                    ];
                }

                if ($path === '/v1/health' && $method === 'GET') {
                    return [
                        'status' => 200,
                        'body' => [
                            'status' => 'healthy',
                            'version' => '3.2.0',
                            'checks' => [
                                'vectorStore' => [
                                    'status' => 'ok',
                                    'itemCount' => count($this->eidosIndexedStore),
                                ],
                            ],
                        ],
                        'error' => null,
                        'latencyMs' => 3.4,
                    ];
                }

                return [
                    'status' => 404,
                    'body' => [],
                    'error' => 'Not Found',
                    'latencyMs' => 1.0,
                ];
            }
        );

        $mapper = new Mapper();
        $searchReplacer = new SearchReplacer($httpClient, $mapper);

        return new Connector(
            $httpClient,
            $mapper,
            $searchReplacer,
            function (int $offset, int $limit, ?DateTimeInterface $since): array {
                $filtered = array_values(array_filter(
                    $this->bitrixIBlockItems,
                    static function (array $item) use ($since): bool {
                        if ($since === null) {
                            return true;
                        }
                        $itemTs = strtotime((string) $item['TIMESTAMP_X']);
                        return $itemTs > $since->getTimestamp();
                    }
                ));

                return [
                    'items' => array_slice($filtered, $offset, $limit),
                    'total' => count($filtered),
                ];
            }
        );
    }

    protected function touchCatalogItems(int $count, DateTimeImmutable $modifiedAt): void
    {
        $touched = 0;
        foreach ($this->bitrixIBlockItems as $idx => &$item) {
            if ($touched >= $count) {
                break;
            }
            $item['PRICE'] = (float) $item['PRICE'] + 150.0;
            $item['TIMESTAMP_X'] = $modifiedAt->format('Y-m-d H:i:s');
            $touched++;
        }
        unset($item);
    }

    protected function setEidosAvailable(bool $available): void
    {
        $this->eidosAvailable = $available;
    }

    protected function getRecordedHttpRequests(): array
    {
        return $this->recordedRequests;
    }

    protected function assertNativeSystemFormat(mixed $item): void
    {
        $this->assertIsArray($item);
        $this->assertArrayHasKey('ID', $item);
        $this->assertArrayHasKey('NAME', $item);
        $this->assertArrayHasKey('DETAIL_PAGE_URL', $item);
        $this->assertArrayHasKey('URL', $item);
        $this->assertArrayHasKey('BODY_FORMATED', $item);
        $this->assertArrayHasKey('PRICE', $item);
        $this->assertArrayHasKey('PREVIEW_PICTURE', $item);
        $this->assertNotEmpty($item['ID']);
        $this->assertStringContainsString('Тормозные колодки', (string) $item['NAME']);
    }

    /**
     * Дополнительно проверяет:
     * - очистку HTML и обрезку описания до 5000 символов в mapFields()
     * - постановку в фоновую очередь при > 500 товаров из веб-админки
     * - кнопку Health-check в Settings::handleAdminAction -> "EIDOS доступен, 1000 товаров"
     * - возврат точного TIMESTAMP_X последнего товара в syncDelta (не now())
     * - работу tools/eidos_feedback.php (sendBeacon) и include.php
     */
    public function testBitrixAdminHealthButtonAndHtmlSanitization(): void
    {
        require_once dirname(__DIR__) . '/include.php';

        $connector = $this->createConnectorWithCatalog(1000);

        // В веб-режиме (forceSync = false) при 1000 товаров (> 500) синхронизация ставится в очередь
        $queuedRes = $connector->syncCatalog(['forceSync' => false]);
        $this->assertTrue($queuedRes['queued'] ?? false);

        // Выполняем синхронизацию 1000 товаров и проверяем кнопку "Проверить связь" в админке
        $connector->syncCatalog(['batchSize' => 250, 'forceSync' => true]);
        $adminResp = Settings::handleAdminAction(['action_health_check' => '1'], $connector);
        $this->assertSame('ok', $adminResp['status']);
        $this->assertStringContainsString('EIDOS доступен, 1000 товаров', $adminResp['message']);

        // Проверяем, что syncDelta возвращает точный TIMESTAMP_X последнего товара, а не now()
        $since = new DateTimeImmutable('2026-10-25 10:00:00');
        $exactItemModifiedAt = new DateTimeImmutable('2026-10-25 11:45:12');
        $this->touchCatalogItems(3, $exactItemModifiedAt);
        $deltaRes = $connector->syncDelta($since, 100);
        $this->assertSame(3, $deltaRes['synced']);
        $this->assertSame($exactItemModifiedAt->getTimestamp(), $deltaRes['since']->getTimestamp());

        // Проверяем обработчик sendBeacon (tools/eidos_feedback.php)
        $GLOBALS['__EIDOS_TEST_CONNECTOR'] = $connector;
        $GLOBALS['__EIDOS_TEST_RAW_BODY'] = json_encode([
            'itemId' => '1001',
            'query' => 'тормозные колодки камри',
            'eventType' => 'click',
        ]);
        require dirname(__DIR__) . '/tools/eidos_feedback.php';
        unset($GLOBALS['__EIDOS_TEST_CONNECTOR'], $GLOBALS['__EIDOS_TEST_RAW_BODY']);

        // Проверяем mapFields: удаление HTML, обрезку до 5000 символов и извлечение PROPERTIES
        $longHtml = '<div><p>Тестовое описание</p>' . str_repeat('<span>АБВГД</span>', 1200) . '</div>';
        $mapped = $connector->mapFields([
            'ID' => '777',
            'NAME' => '<b>Диск тормозной</b>',
            'DETAIL_TEXT' => $longHtml,
            'SECTION_NAME' => 'Тормоза',
            'PRICE' => 3200,
            'QUANTITY' => 4,
            'DETAIL_PAGE_URL' => '/catalog/777/',
            'PROPERTIES' => [
                'BRAND' => ['VALUE' => 'Brembo'],
                'CML2_ARTICLE' => ['VALUE' => 'BR-777-X'],
            ],
        ]);

        $this->assertSame('Диск тормозной', $mapped['title']);
        $this->assertStringNotContainsString('<', $mapped['description']);
        $this->assertSame(5000, mb_strlen($mapped['description'], 'UTF-8'));
        $this->assertTrue($mapped['inStock']);
        $this->assertContains('Brembo', $mapped['tags']);
        $this->assertContains('BR-777-X', $mapped['tags']);

        // Проверяем реальную замену поиска 1С-Битрикс (arResult, searchFilter, arrFilter и OnBeforeProlog)
        $arResult = [];
        $items = $connector->applySearchToComponent($arResult, 'тормозные колодки камри', ['limit' => 5]);
        $this->assertNotEmpty($items);
        $this->assertTrue($arResult['EIDOS_REPLACED']);
        $this->assertFalse($arResult['FALLBACK_USED']);
        $this->assertSame($items, $arResult['ITEMS']);
        $this->assertSame($items, $arResult['SEARCH']);
        $this->assertNotEmpty($arResult['ELEMENTS']);
        $this->assertNotEmpty($GLOBALS['searchFilter']['=ID'] ?? []);
        $this->assertNotEmpty($GLOBALS['arrFilter']['=ID'] ?? []);
    }
}
