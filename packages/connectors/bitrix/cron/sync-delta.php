<?php

declare(strict_types=1);

/**
 * Ежечасный cron-скрипт / агент 1С-Битрикс для инкрементальной синхронизации (syncDelta).
 * Запуск из crontab:
 * 0 * * * * /usr/bin/php /var/www/bitrix/local/packages/connectors/bitrix/cron/sync-delta.php >> /var/log/eidos-sync.log 2>&1
 */

namespace Eidos\Connectors\Bitrix\Cron;

use DateTimeImmutable;
use Eidos\Connectors\Bitrix\Connector;
use Eidos\Connectors\Bitrix\HttpClient;
use Eidos\Connectors\Bitrix\Settings;
use Throwable;

$autoloadPath = dirname(__DIR__) . '/vendor/autoload.php';
if (file_exists($autoloadPath)) {
    require_once $autoloadPath;
}

/**
 * Функция для запуска через штатный механизм агентов 1С-Битрикс (CAgent) или CLI cron.
 */
function runHourlySyncDelta(): string
{
    $lockFile = sys_get_temp_dir() . '/eidos_bitrix_sync_delta.lock';
    $fp = @fopen($lockFile, 'c+');
    if ($fp === false || !flock($fp, LOCK_EX | LOCK_NB)) {
        return '\\Eidos\\Connectors\\Bitrix\\Cron\\runHourlySyncDelta();';
    }

    try {
        $apiUrl = Settings::getOption(Settings::OPT_API_URL, '');
        $apiKey = Settings::getOption(Settings::OPT_API_KEY, '');

        if ($apiUrl === '') {
            return '\\Eidos\\Connectors\\Bitrix\\Cron\\runHourlySyncDelta();';
        }

        $lastSyncIso = Settings::getOption(Settings::OPT_LAST_DELTA_SYNC, '');
        $since = $lastSyncIso !== ''
            ? new DateTimeImmutable($lastSyncIso)
            : new DateTimeImmutable('-1 hour');

        $httpClient = new HttpClient($apiUrl, $apiKey);
        $connector = new Connector($httpClient);

        $result = $connector->syncDelta($since, 100);
        Settings::setOption(Settings::OPT_LAST_DELTA_SYNC, $result['since']->format(DATE_ATOM));
    } catch (Throwable $e) {
        if (function_exists('AddMessage2Log')) {
            AddMessage2Log('[EIDOS] syncDelta ' . $e->getMessage(), 'eidos.connector');
        } else {
            error_log('[EIDOS] syncDelta ' . $e->getMessage());
        }
    } finally {
        flock($fp, LOCK_UN);
        fclose($fp);
    }

    return '\\Eidos\\Connectors\\Bitrix\\Cron\\runHourlySyncDelta();';
}

// Автозапуск при вызове напрямую из CLI (crontab)
if (PHP_SAPI === 'cli' && isset($_SERVER['SCRIPT_FILENAME']) && realpath((string) $_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    runHourlySyncDelta();
}
