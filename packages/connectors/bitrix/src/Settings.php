<?php

declare(strict_types=1);

namespace Eidos\Connectors\Bitrix;

/**
 * Административная страница настроек коннектора EIDOS для 1С-Битрикс.
 * Хранит настройки в таблице b_option (COption / Bitrix\Main\Config\Option) — никогда в коде.
 * Содержит поля URL EIDOS, API-ключ и кнопки:
 * - "Синхронизировать"
 * - "Проверить связь"
 * - "Переиндексировать"
 */
class Settings
{
    public const MODULE_ID = 'eidos.connector';
    public const OPT_API_URL = 'eidos_api_url';
    public const OPT_API_KEY = 'eidos_api_key';
    public const OPT_IBLOCK_ID = 'eidos_iblock_id';
    public const OPT_LAST_DELTA_SYNC = 'eidos_last_delta_sync';

    /**
     * In-memory fallback store when running outside Bitrix kernel (e.g. PHPUnit).
     *
     * @var array<string, string>
     */
    private static array $memoryOptions = [];

    public static function getOption(string $name, string $default = ''): string
    {
        if (class_exists('\Bitrix\Main\Config\Option')) {
            /** @phpstan-ignore-next-line */
            return (string) \Bitrix\Main\Config\Option::get(self::MODULE_ID, $name, $default);
        }
        if (class_exists('\COption')) {
            /** @phpstan-ignore-next-line */
            return (string) \COption::GetOptionString(self::MODULE_ID, $name, $default);
        }
        return self::$memoryOptions[$name] ?? $default;
    }

    public static function setOption(string $name, string $value): void
    {
        self::$memoryOptions[$name] = $value;
        if (class_exists('\Bitrix\Main\Config\Option')) {
            /** @phpstan-ignore-next-line */
            \Bitrix\Main\Config\Option::set(self::MODULE_ID, $name, $value);
            return;
        }
        if (class_exists('\COption')) {
            /** @phpstan-ignore-next-line */
            \COption::SetOptionString(self::MODULE_ID, $name, $value);
        }
    }

    /**
     * Обрабатывает POST-действия из административной панели 1С-Битрикс.
     *
     * @param array<string, mixed> $postData
     * @param Connector $connector
     * @return array{message: string, status: 'ok'|'error'|'queued', details?: array<string, mixed>}
     */
    public static function handleAdminAction(array $postData, Connector $connector): array
    {
        if (function_exists('check_bitrix_sessid') && !check_bitrix_sessid()) {
            return [
                'status' => 'error',
                'message' => 'Ошибка проверки сессии (CSRF). Обновите страницу.',
            ];
        }

        if (isset($postData['save_settings'])) {
            $url = trim((string) ($postData['eidos_api_url'] ?? ''));
            $apiKey = trim((string) ($postData['eidos_api_key'] ?? ''));
            $iblockId = (string) ((int) ($postData['eidos_iblock_id'] ?? 0));

            if ($url !== '' && !str_starts_with(strtolower($url), 'https://')) {
                return [
                    'status' => 'error',
                    'message' => 'URL EIDOS должен использовать защищённый протокол https://',
                ];
            }

            self::setOption(self::OPT_API_URL, $url);
            if ($apiKey !== '') {
                self::setOption(self::OPT_API_KEY, $apiKey);
            }
            self::setOption(self::OPT_IBLOCK_ID, $iblockId);

            return [
                'status' => 'ok',
                'message' => 'Настройки коннектора EIDOS успешно сохранены.',
            ];
        }

        // Кнопка "Проверить связь" (Health-check)
        if (isset($postData['action_health_check'])) {
            $health = $connector->healthCheck();
            if ($health['ok']) {
                return [
                    'status' => 'ok',
                    'message' => sprintf(
                        'EIDOS доступен, %d товаров (версия %s, задержка %.1f мс)',
                        $health['itemsIndexed'],
                        $health['version'],
                        $health['latencyMs']
                    ),
                    'details' => $health,
                ];
            }

            return [
                'status' => 'error',
                'message' => sprintf('EIDOS недоступен (%s). Поиск работает через резервный движок Битрикс.', $health['error'] ?? 'error'),
                'details' => $health,
            ];
        }

        // Кнопки "Синхронизировать" и "Переиндексировать"
        if (isset($postData['action_sync_catalog']) || isset($postData['action_reindex'])) {
            $result = $connector->syncCatalog([
                'batchSize' => 100,
                'forceSync' => false,
            ]);

            if (!empty($result['queued'])) {
                return [
                    'status' => 'queued',
                    'message' => 'В каталоге более 500 товаров. Полная синхронизация запущена в фоновом агенте (CAgent), чтобы не блокировать админку.',
                    'details' => $result,
                ];
            }

            return [
                'status' => $result['failed'] === 0 ? 'ok' : 'error',
                'message' => sprintf(
                    'Синхронизация завершена: синхронизировано %d, ошибок %d.',
                    $result['synced'],
                    $result['failed']
                ),
                'details' => $result,
            ];
        }

        return [
            'status' => 'ok',
            'message' => '',
        ];
    }

    /**
     * Генерирует HTML-разметку страницы настроек для админки 1С-Битрикс.
     */
    public static function renderAdminPage(?string $statusMessage = null): string
    {
        $apiUrl = htmlspecialchars(self::getOption(self::OPT_API_URL, 'https://api.eidos-search.example.com'), ENT_QUOTES, 'UTF-8');
        $iblockId = htmlspecialchars(self::getOption(self::OPT_IBLOCK_ID, '1'), ENT_QUOTES, 'UTF-8');
        $hasKey = self::getOption(self::OPT_API_KEY, '') !== '';
        $bannerHtml = $statusMessage !== null && $statusMessage !== ''
            ? '<div class="adm-info-message">' . htmlspecialchars($statusMessage, ENT_QUOTES, 'UTF-8') . '</div>'
            : '';

        return <<<HTML
<div class="adm-detail-content-wrap">
    {$bannerHtml}
    <form method="post" action="">
        <div class="adm-detail-title">Настройки гибридного поиска EIDOS (v1.0)</div>
        <table class="adm-detail-content-table edit-table">
            <tr>
                <td width="40%" class="adm-detail-content-cell-l">URL сервера EIDOS (HTTPS):</td>
                <td width="60%" class="adm-detail-content-cell-r">
                    <input type="url" name="eidos_api_url" value="{$apiUrl}" size="50" required placeholder="https://eidos.company.ru" />
                </td>
            </tr>
            <tr>
                <td class="adm-detail-content-cell-l">API-ключ EIDOS:</td>
                <td class="adm-detail-content-cell-r">
                    <input type="password" name="eidos_api_key" value="" size="50" placeholder="Оставьте пустым, чтобы сохранить текущий ключ" />
                    <span>(Ключ установлен: {$hasKey})</span>
                </td>
            </tr>
            <tr>
                <td class="adm-detail-content-cell-l">ID инфоблока каталога:</td>
                <td class="adm-detail-content-cell-r">
                    <input type="number" name="eidos_iblock_id" value="{$iblockId}" min="1" />
                </td>
            </tr>
        </table>
        <div class="adm-detail-content-btns">
            <input type="submit" name="save_settings" value="Сохранить" class="adm-btn-save" />
            <input type="submit" name="action_health_check" value="Проверить связь" class="adm-btn" />
            <input type="submit" name="action_sync_catalog" value="Синхронизировать" class="adm-btn" />
            <input type="submit" name="action_reindex" value="Переиндексировать" class="adm-btn" />
        </div>
    </form>
</div>
HTML;
    }
}
