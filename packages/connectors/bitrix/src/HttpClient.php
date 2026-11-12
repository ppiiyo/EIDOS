<?php

declare(strict_types=1);

namespace Eidos\Connectors\Bitrix;

use RuntimeException;

/**
 * Isolated cURL HTTP wrapper for communicating with EIDOS REST API (/v1/*).
 * Enforces HTTPS scheme in production, handles timeouts, retries, and logs errors via Bitrix AddMessage2Log.
 */
class HttpClient
{
    private string $baseUrl;
    private string $apiKey;
    private string $searchKey;
    private float $defaultTimeoutSec;
    private int $maxRetries;
    private bool $enforceHttps;

    /**
     * Optional custom transport handler for unit testing without live network sockets:
     * callable(string $method, string $path, ?array $body, float $timeoutSec): array{status: int, body: array<string, mixed>, error: ?string, latencyMs: float}
     *
     * @var callable|null
     */
    private $transportHandler = null;

    /**
     * Recorded log entries in format "[EIDOS] <method> <error>" for diagnostics and testing.
     *
     * @var array<int, string>
     */
    private array $errorLogs = [];

    public function __construct(
        string $baseUrl,
        string $apiKey,
        float $defaultTimeoutSec = 2.5,
        int $maxRetries = 1,
        bool $enforceHttps = true,
        ?callable $transportHandler = null,
        ?string $searchKey = null
    ) {
        $trimmed = rtrim(trim($baseUrl), '/');
        $this->enforceHttps = $enforceHttps;
        $this->validateBaseUrl($trimmed);

        $this->baseUrl = $trimmed;
        $this->apiKey = trim($apiKey);
        $this->searchKey = $searchKey !== null && trim($searchKey) !== '' ? trim($searchKey) : $this->apiKey;
        $this->defaultTimeoutSec = $defaultTimeoutSec;
        $this->maxRetries = max(0, $maxRetries);
        $this->transportHandler = $transportHandler;
    }

    /**
     * Sets a dedicated read-only SEARCH_KEY for storefront /v1/search requests,
     * keeping ADMIN_KEY ($apiKey) strictly for /v1/catalog/upsert mutations.
     */
    public function setSearchKey(string $searchKey): void
    {
        $trimmed = trim($searchKey);
        if ($trimmed !== '') {
            $this->searchKey = $trimmed;
        }
    }

    /**
     * Resolves the appropriate API key for a given endpoint path:
     * - /v1/search, /v1/recommend, /v1/feedback -> SEARCH_KEY
     * - /v1/catalog/upsert, /v1/catalog/* -> ADMIN_KEY
     */
    public function getEffectiveKeyForPath(string $path): string
    {
        $cleanPath = '/' . ltrim($path, '/');
        if (
            str_starts_with($cleanPath, '/v1/search')
            || str_starts_with($cleanPath, '/v1/suggest')
            || str_starts_with($cleanPath, '/v1/recommend')
            || str_starts_with($cleanPath, '/v1/feedback')
            || str_starts_with($cleanPath, '/v1/events')
        ) {
            return $this->searchKey !== '' ? $this->searchKey : $this->apiKey;
        }
        return $this->apiKey;
    }

    /**
     * Бизнес-правило безопасности: все внешние запросы к EIDOS должны идти по HTTPS.
     */
    private function validateBaseUrl(string $url): void
    {
        $parts = parse_url($url);
        if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
            $this->logError('HttpClient::__construct', 'Invalid EIDOS base URL');
            throw new RuntimeException('Invalid EIDOS base URL');
        }

        $scheme = strtolower((string) $parts['scheme']);
        if ($this->enforceHttps && $scheme !== 'https') {
            $this->logError('HttpClient::__construct', 'Insecure HTTP scheme rejected; HTTPS is required');
            throw new RuntimeException('EIDOS URL must use https:// scheme');
        }
    }

    /**
     * Запись ошибки в системный журнал 1С-Битрикс (AddMessage2Log) в формате:
     * [EIDOS] <method> <error>
     */
    public function logError(string $method, string $error): void
    {
        $cleanError = trim(preg_replace('/\s+/', ' ', $error) ?? $error);
        $entry = sprintf('[EIDOS] %s %s', $method, $cleanError);
        $this->errorLogs[] = $entry;

        if (function_exists('AddMessage2Log')) {
            AddMessage2Log($entry, 'eidos.connector');
        } else {
            error_log($entry);
        }
    }

    /**
     * @return array<int, string>
     */
    public function getErrorLogs(): array
    {
        return $this->errorLogs;
    }

    /**
     * Convenience wrapper for POST requests (e.g. batch catalog upsert with 60s timeout).
     *
     * @param string $path
     * @param array<string, mixed> $payload
     * @param float $timeoutSec
     * @param string $callerMethod
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
     * @param string $httpMethod 'GET' | 'POST'
     * @param string $path e.g. '/v1/search'
     * @param array<string, mixed>|null $payload
     * @param float|null $timeoutSec
     * @param string $callerMethod Logical connector method name for structured logging
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
        $lastError = 'unknown_error';
        $lastStatus = 0;
        $latencyMs = 0.0;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            $t0 = microtime(true);

            if ($this->transportHandler !== null) {
                $resp = ($this->transportHandler)($httpMethod, $path, $payload, $timeout);
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

            $url = $this->baseUrl . '/' . ltrim($path, '/');
            $ch = curl_init($url);
            if ($ch === false) {
                $lastError = 'curl_init_failed';
                break;
            }

            $headers = [
                'Accept: application/json',
                'Content-Type: application/json; charset=utf-8',
                'User-Agent: EidosBitrixConnector/1.0',
            ];

            $effectiveKey = $this->getEffectiveKeyForPath($path);
            if ($effectiveKey !== '') {
                $headers[] = 'Authorization: Bearer ' . $effectiveKey;
                $headers[] = 'X-API-Key: ' . $effectiveKey;
            }

            $timeoutMs = max(100, (int) round($timeout * 1000));
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST => $httpMethod,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_CONNECTTIMEOUT_MS => min(1500, $timeoutMs),
                CURLOPT_TIMEOUT_MS => $timeoutMs,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
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
            $curlErrno = curl_errno($ch);
            $curlError = curl_error($ch);
            $lastStatus = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($curlErrno === CURLE_OPERATION_TIMEDOUT || $curlErrno === 28) {
                $lastError = 'timeout';
                break;
            }

            if ($curlErrno !== 0) {
                $lastError = $curlError !== '' ? $curlError : sprintf('curl_errno_%d', $curlErrno);
                continue;
            }

            $decoded = is_string($rawResponse) && $rawResponse !== ''
                ? json_decode($rawResponse, true)
                : [];

            if ($lastStatus >= 200 && $lastStatus < 300 && is_array($decoded)) {
                return [
                    'ok' => true,
                    'status' => $lastStatus,
                    'data' => $decoded,
                    'error' => null,
                    'latencyMs' => round($latencyMs, 2),
                ];
            }

            $serverMsg = is_array($decoded) && isset($decoded['message'])
                ? (string) $decoded['message']
                : sprintf('HTTP %d', $lastStatus);
            $lastError = $serverMsg;

            // Do not retry 4xx client validation errors
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
