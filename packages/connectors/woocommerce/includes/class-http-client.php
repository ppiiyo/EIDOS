<?php
/**
 * Isolated cURL HTTP Client for EIDOS REST API (/v1/*) and WooCommerce REST API (/wp-json/wc/v3/*).
 *
 * @package Eidos\Connectors\WooCommerce
 */

declare(strict_types=1);

namespace Eidos\Connectors\WooCommerce;

use RuntimeException;

/**
 * Class HttpClient
 *
 * Technical: Low-overhead cURL wrapper with configurable timeouts, GET retry logic,
 * Basic Auth support for WooCommerce REST API, Bearer/X-API-Key auth for EIDOS API,
 * and structured error logging to WooCommerce logger (wc_get_logger).
 */
class HttpClient
{
    private string $baseUrl;
    private string $apiKey;
    private float $defaultTimeoutSec;
    private int $maxRetries;
    private bool $enforceHttps;
    private string $wcConsumerKey;
    private string $wcConsumerSecret;
    private string $wcSiteUrl;

    /**
     * Optional custom transport handler for testing without live network sockets:
     * callable(string $method, string $url, ?array $body, float $timeoutSec, array $headers): array
     *
     * @var callable|null
     */
    private $transportHandler = null;

    /**
     * In-memory error log buffer in format "[EIDOS] <method> <error>".
     *
     * @var array<int, string>
     */
    private array $errorLogs = [];

    /**
     * @param string        $baseUrl           EIDOS server base URL (e.g. https://eidos.example.com or http://localhost:3000)
     * @param string        $apiKey            EIDOS API key (sent in X-API-Key and Authorization: Bearer)
     * @param float         $defaultTimeoutSec Default request timeout in seconds
     * @param int           $maxRetries        Number of retries for idempotent GET requests
     * @param bool          $enforceHttps      Require https:// scheme (except localhost/127.0.0.1 in dev)
     * @param callable|null $transportHandler  Optional mock transport callback
     * @param string        $wcConsumerKey     WooCommerce REST API consumer_key
     * @param string        $wcConsumerSecret  WooCommerce REST API consumer_secret
     * @param string        $wcSiteUrl         WordPress site URL for REST API calls
     */
    public function __construct(
        string $baseUrl,
        string $apiKey,
        float $defaultTimeoutSec = 2.5,
        int $maxRetries = 1,
        bool $enforceHttps = false,
        ?callable $transportHandler = null,
        string $wcConsumerKey = '',
        string $wcConsumerSecret = '',
        string $wcSiteUrl = ''
    ) {
        $trimmed = rtrim(trim($baseUrl), '/');
        $this->enforceHttps = $enforceHttps;
        $this->validateBaseUrl($trimmed);

        $this->baseUrl = $trimmed;
        $this->apiKey = trim($apiKey);
        $this->defaultTimeoutSec = $defaultTimeoutSec;
        $this->maxRetries = max(0, $maxRetries);
        $this->transportHandler = $transportHandler;
        $this->wcConsumerKey = trim($wcConsumerKey);
        $this->wcConsumerSecret = trim($wcConsumerSecret);
        $this->wcSiteUrl = rtrim(trim($wcSiteUrl), '/');
    }

    /**
     * Бизнес-логика: проверка корректности базового URL EIDOS.
     * В production-окружении для внешних хостов требуется схема https://.
     */
    private function validateBaseUrl(string $url): void
    {
        $parts = parse_url($url);
        if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
            $this->logError('HttpClient::__construct', 'Invalid EIDOS base URL');
            throw new RuntimeException('Invalid EIDOS base URL');
        }

        $scheme = strtolower((string) $parts['scheme']);
        $host = strtolower((string) $parts['host']);
        $isLocalhost = in_array($host, ['localhost', '127.0.0.1', '::1', 'eidos', 'host.docker.internal'], true);

        if ($this->enforceHttps && !$isLocalhost && $scheme !== 'https') {
            $this->logError('HttpClient::__construct', 'Insecure HTTP scheme rejected; HTTPS is required');
            throw new RuntimeException('EIDOS URL must use https:// scheme');
        }
    }

    /**
     * Бизнес-логика: запись ошибки в журнал WooCommerce (wc_get_logger) или системный error_log
     * в строгом формате контракта: [EIDOS] <method> <error>.
     */
    public function logError(string $method, string $error): void
    {
        $cleanError = trim(preg_replace('/\s+/', ' ', $error) ?? $error);
        $entry = sprintf('[EIDOS] %s %s', $method, $cleanError);
        $this->errorLogs[] = $entry;

        if (function_exists('wc_get_logger')) {
            $logger = wc_get_logger();
            if (is_object($logger) && method_exists($logger, 'error')) {
                $logger->error($entry, ['source' => 'eidos-woocommerce']);
                return;
            }
        }

        error_log($entry);
    }

    /**
     * @return array<int, string>
     */
    public function getErrorLogs(): array
    {
        return $this->errorLogs;
    }

    /**
     * Sends GET request to EIDOS API (/v1/*).
     *
     * @return array{ok: bool, status: int, data: array<string, mixed>, error: ?string, latencyMs: float}
     */
    public function get(
        string $path,
        float $timeoutSec = 3.0,
        string $callerMethod = 'get'
    ): array {
        return $this->request('GET', $path, null, $timeoutSec, $callerMethod);
    }

    /**
     * Sends POST request to EIDOS API (/v1/*).
     *
     * @param array<string, mixed> $payload
     * @return array{ok: bool, status: int, data: array<string, mixed>, error: ?string, latencyMs: float}
     */
    public function post(
        string $path,
        array $payload,
        float $timeoutSec = 60.0,
        string $callerMethod = 'post'
    ): array {
        return $this->request('POST', $path, $payload, $timeoutSec, $callerMethod);
    }

    /**
     * Executes an HTTP request against the EIDOS API (/v1/*).
     *
     * @param string                    $httpMethod   'GET' | 'POST' | 'DELETE'
     * @param string                    $path         Endpoint path, e.g. '/v1/search'
     * @param array<string, mixed>|null $payload      JSON body payload
     * @param float|null                $timeoutSec   Timeout in seconds
     * @param string                    $callerMethod Connector method name for logging
     * @return array{ok: bool, status: int, data: array<string, mixed>, error: ?string, latencyMs: float}
     */
    public function request(
        string $httpMethod,
        string $path,
        ?array $payload = null,
        ?float $timeoutSec = null,
        string $callerMethod = 'request'
    ): array {
        $timeout = $timeoutSec ?? $this->defaultTimeoutSec;
        $attempts = $httpMethod === 'GET' ? ($this->maxRetries + 1) : 1;
        $url = $this->baseUrl . '/' . ltrim($path, '/');

        $headers = [
            'Accept: application/json',
            'Content-Type: application/json; charset=utf-8',
            'User-Agent: EidosWooCommerceConnector/1.0',
        ];

        if ($this->apiKey !== '') {
            $headers[] = 'Authorization: Bearer ' . $this->apiKey;
            $headers[] = 'X-API-Key: ' . $this->apiKey;
        }

        return $this->executeRawRequest($httpMethod, $url, $payload, $timeout, $headers, $attempts, $callerMethod);
    }

    /**
     * Бизнес-логика: запрос к WooCommerce REST API (/wp-json/wc/v3/*) с Basic Auth
     * (consumer_key и consumer_secret) для получения родительских товаров и их вариаций.
     *
     * @param string               $endpointPath e.g. '/wp-json/wc/v3/products'
     * @param array<string, mixed> $queryParams  e.g. ['per_page' => 100, 'page' => 1, 'modified_after' => '...']
     * @param float                $timeoutSec
     * @param string               $callerMethod
     * @return array{ok: bool, status: int, data: array<int|string, mixed>, error: ?string, latencyMs: float}
     */
    public function requestWooCommerceRest(
        string $endpointPath,
        array $queryParams = [],
        float $timeoutSec = 30.0,
        string $callerMethod = 'syncCatalog'
    ): array {
        $siteUrl = $this->wcSiteUrl;
        if ($siteUrl === '' && function_exists('home_url')) {
            $siteUrl = rtrim((string) home_url(), '/');
        }
        if ($siteUrl === '') {
            $siteUrl = 'http://localhost';
        }

        $url = $siteUrl . '/' . ltrim($endpointPath, '/');
        if (!empty($queryParams)) {
            $url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($queryParams);
        }

        $headers = [
            'Accept: application/json',
            'Content-Type: application/json; charset=utf-8',
            'User-Agent: EidosWooCommerceConnector/1.0',
        ];

        if ($this->wcConsumerKey !== '' && $this->wcConsumerSecret !== '') {
            $basicToken = base64_encode($this->wcConsumerKey . ':' . $this->wcConsumerSecret);
            $headers[] = 'Authorization: Basic ' . $basicToken;
        }

        return $this->executeRawRequest('GET', $url, null, $timeoutSec, $headers, 1, $callerMethod);
    }

    /**
     * Technical: Performs the underlying cURL or custom transport HTTP request.
     *
     * @param array<string, mixed>|null $payload
     * @param array<int, string>        $headers
     * @return array{ok: bool, status: int, data: array<int|string, mixed>, error: ?string, latencyMs: float}
     */
    private function executeRawRequest(
        string $httpMethod,
        string $url,
        ?array $payload,
        float $timeout,
        array $headers,
        int $attempts,
        string $callerMethod
    ): array {
        $lastError = 'unknown_error';
        $lastStatus = 0;
        $latencyMs = 0.0;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            $t0 = microtime(true);

            if ($this->transportHandler !== null) {
                $resp = ($this->transportHandler)($httpMethod, $url, $payload, $timeout, $headers);
                $latencyMs = (float) ($resp['latencyMs'] ?? ((microtime(true) - $t0) * 1000.0));
                $lastStatus = (int) ($resp['status'] ?? 0);
                $err = $resp['error'] ?? null;

                if ($err === null && $lastStatus >= 200 && $lastStatus < 300) {
                    return [
                        'ok' => true,
                        'status' => $lastStatus,
                        'data' => is_array($resp['body'] ?? null) ? $resp['body'] : [],
                        'error' => null,
                        'latencyMs' => round($latencyMs, 2),
                    ];
                }

                $lastError = is_string($err) && $err !== '' ? $err : sprintf('HTTP %d', $lastStatus);
                if ($lastError === 'timeout' || $attempt >= $attempts) {
                    break;
                }
                continue;
            }

            $ch = curl_init($url);
            if ($ch === false) {
                $lastError = 'curl_init_failed';
                break;
            }

            $timeoutMs = max(100, (int) round($timeout * 1000));
            $isHttps = stripos($url, 'https://') === 0;

            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST => $httpMethod,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_CONNECTTIMEOUT_MS => min(1500, $timeoutMs),
                CURLOPT_TIMEOUT_MS => $timeoutMs,
                CURLOPT_SSL_VERIFYPEER => $isHttps,
                CURLOPT_SSL_VERIFYHOST => $isHttps ? 2 : 0,
            ]);

            if ($payload !== null && $httpMethod !== 'GET') {
                $jsonBody = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                if ($jsonBody === false) {
                    curl_close($ch);
                    $this->logError($callerMethod, 'json_encode_failed');
                    return [
                        'ok' => false,
                        'status' => 0,
                        'data' => [],
                        'error' => 'json_encode_failed',
                        'latencyMs' => 0.0,
                    ];
                }
                curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonBody);
            }

            $rawResponse = curl_exec($ch);
            $latencyMs = (microtime(true) - $t0) * 1000.0;
            $curlErrNo = curl_errno($ch);
            $curlErrMsg = curl_error($ch);
            $lastStatus = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($rawResponse === false || $curlErrNo !== 0) {
                if ($curlErrNo === CURLE_OPERATION_TIMEDOUT || $curlErrNo === 28) {
                    $lastError = 'timeout';
                } else {
                    $lastError = $curlErrMsg !== '' ? $curlErrMsg : sprintf('curl_error_%d', $curlErrNo);
                }

                if ($lastError === 'timeout' || $attempt >= $attempts) {
                    break;
                }
                continue;
            }

            $decoded = json_decode((string) $rawResponse, true);
            if (!is_array($decoded) && $lastStatus >= 200 && $lastStatus < 300) {
                $lastError = 'invalid_json';
                break;
            }

            if ($lastStatus >= 200 && $lastStatus < 300) {
                return [
                    'ok' => true,
                    'status' => $lastStatus,
                    'data' => is_array($decoded) ? $decoded : [],
                    'error' => null,
                    'latencyMs' => round($latencyMs, 2),
                ];
            }

            $apiMsg = is_array($decoded) && isset($decoded['message'])
                ? (string) $decoded['message']
                : (is_array($decoded) && isset($decoded['error']) ? (string) $decoded['error'] : '');
            $lastError = $apiMsg !== ''
                ? sprintf('HTTP %d: %s', $lastStatus, $apiMsg)
                : sprintf('HTTP %d', $lastStatus);

            if ($lastStatus >= 400 && $lastStatus < 500) {
                break;
            }
        }

        $this->logError($callerMethod, $lastError);

        return [
            'ok' => false,
            'status' => $lastStatus,
            'data' => [],
            'error' => $lastError,
            'latencyMs' => round($latencyMs, 2),
        ];
    }
}

if (!class_exists('Eidos_WC_Http_Client', false)) {
    class_alias(HttpClient::class, 'Eidos_WC_Http_Client');
}
