<?php
/**
 * WordPress Admin Settings Controller for EIDOS WooCommerce Connector.
 *
 * @package Eidos\Connectors\WooCommerce
 */

declare(strict_types=1);

namespace Eidos\Connectors\WooCommerce;

/**
 * Class Settings
 *
 * Technical: Manages WordPress options (`eidos_wc_api_url`, `eidos_wc_api_key` [ADMIN_KEY],
 * `eidos_wc_search_key` [SEARCH_KEY], `eidos_wc_consumer_key`, `eidos_wc_consumer_secret`,
 * `eidos_wc_simple_category_gate`, `eidos_wc_search_timeout`, `eidos_wc_batch_size`),
 * registers the admin menu page, and handles form actions for Health Check and Full Sync.
 */
class Settings
{
    public const OPTION_API_URL = 'eidos_wc_api_url';
    public const OPTION_API_KEY = 'eidos_wc_api_key';
    public const OPTION_SEARCH_KEY = 'eidos_wc_search_key';
    public const OPTION_WC_CONSUMER_KEY = 'eidos_wc_consumer_key';
    public const OPTION_WC_CONSUMER_SECRET = 'eidos_wc_consumer_secret';
    public const OPTION_REPLACE_SEARCH = 'eidos_wc_replace_search';
    public const OPTION_SIMPLE_CATEGORY_GATE = 'eidos_wc_simple_category_gate';
    public const OPTION_SEARCH_TIMEOUT = 'eidos_wc_search_timeout';
    public const OPTION_BATCH_SIZE = 'eidos_wc_batch_size';
    public const OPTION_LAST_SYNC = 'eidos_wc_last_sync';
    public const OPTION_LAST_SYNC_REPORT = 'eidos_wc_last_sync_report';

    private Connector $connector;

    /**
     * Stores the latest action notice for rendering in `admin/settings-page.php`.
     *
     * @var array{type: string, message: string, details?: array<string, mixed>}|null
     */
    private ?array $adminNotice = null;

    public function __construct(Connector $connector)
    {
        $this->connector = $connector;
    }

    /**
     * Registers the settings page in WordPress Admin and form submission handlers.
     */
    public function registerAdminHooks(): void
    {
        if (function_exists('add_action')) {
            add_action('admin_menu', [$this, 'addSettingsPage']);
            add_action('admin_init', [$this, 'handleAdminFormSubmission']);
        }
    }

    /**
     * Adds "EIDOS Search" under Settings and WooCommerce submenu.
     */
    public function addSettingsPage(): void
    {
        $capability = (function_exists('current_user_can') && current_user_can('manage_woocommerce'))
            ? 'manage_woocommerce'
            : 'manage_options';

        if (function_exists('add_options_page')) {
            add_options_page(
                'EIDOS Semantic Search & Recommendations',
                'EIDOS Search',
                $capability,
                'eidos-woocommerce',
                [$this, 'renderSettingsPage']
            );
        }
    }

    /**
     * Reads current plugin configuration from `wp_options`.
     *
     * @return array{
     *   api_url: string,
     *   api_key: string,
     *   search_key: string,
     *   wc_consumer_key: string,
     *   wc_consumer_secret: string,
     *   replace_search: bool,
     *   simple_category_gate: string,
     *   search_timeout: float,
     *   batch_size: int,
     *   last_sync: string,
     *   last_sync_report: array<string, mixed>
     * }
     */
    public static function getConfig(): array
    {
        $getOpt = static function (string $key, $default) {
            return function_exists('get_option') ? get_option($key, $default) : $default;
        };

        $rawGate = (string) $getOpt(self::OPTION_SIMPLE_CATEGORY_GATE, 'hard');
        $gate = in_array($rawGate, ['hard', 'soft', 'off'], true) ? $rawGate : 'hard';

        $rawTimeout = (float) $getOpt(self::OPTION_SEARCH_TIMEOUT, 2.0);
        $timeout = max(0.5, min(10.0, $rawTimeout > 0 ? $rawTimeout : 2.0));

        $rawBatch = (int) $getOpt(self::OPTION_BATCH_SIZE, 100);
        $batchSize = max(10, min(500, $rawBatch > 0 ? $rawBatch : 100));

        $rawReport = $getOpt(self::OPTION_LAST_SYNC_REPORT, []);

        return [
            'api_url' => (string) $getOpt(self::OPTION_API_URL, 'http://localhost:3000'),
            'api_key' => (string) $getOpt(self::OPTION_API_KEY, ''),
            'search_key' => (string) $getOpt(self::OPTION_SEARCH_KEY, ''),
            'wc_consumer_key' => (string) $getOpt(self::OPTION_WC_CONSUMER_KEY, ''),
            'wc_consumer_secret' => (string) $getOpt(self::OPTION_WC_CONSUMER_SECRET, ''),
            'replace_search' => (bool) $getOpt(self::OPTION_REPLACE_SEARCH, true),
            'simple_category_gate' => $gate,
            'search_timeout' => $timeout,
            'batch_size' => $batchSize,
            'last_sync' => (string) $getOpt(self::OPTION_LAST_SYNC, ''),
            'last_sync_report' => is_array($rawReport) ? $rawReport : [],
        ];
    }

    /**
     * Handles saving settings, running Health Check, and running Full Sync.
     */
    public function handleAdminFormSubmission(): void
    {
        if (empty($_POST['eidos_wc_action'])) {
            return;
        }

        if (
            function_exists('current_user_can')
            && !current_user_can('manage_woocommerce')
            && !current_user_can('manage_options')
        ) {
            return;
        }

        if (function_exists('check_admin_referer')) {
            check_admin_referer('eidos_wc_settings_action', 'eidos_wc_nonce');
        }

        $action = sanitize_key((string) $_POST['eidos_wc_action']);

        if ($action === 'save_settings') {
            $apiUrl = isset($_POST['eidos_wc_api_url'])
                ? trim(sanitize_text_field(wp_unslash((string) $_POST['eidos_wc_api_url'])))
                : 'http://localhost:3000';
            $apiKey = isset($_POST['eidos_wc_api_key'])
                ? trim(sanitize_text_field(wp_unslash((string) $_POST['eidos_wc_api_key'])))
                : '';
            $searchKey = isset($_POST['eidos_wc_search_key'])
                ? trim(sanitize_text_field(wp_unslash((string) $_POST['eidos_wc_search_key'])))
                : '';
            $wcKey = isset($_POST['eidos_wc_consumer_key'])
                ? trim(sanitize_text_field(wp_unslash((string) $_POST['eidos_wc_consumer_key'])))
                : '';
            $wcSecret = isset($_POST['eidos_wc_consumer_secret'])
                ? trim(sanitize_text_field(wp_unslash((string) $_POST['eidos_wc_consumer_secret'])))
                : '';
            $replaceSearch = !empty($_POST['eidos_wc_replace_search']);

            $rawGate = isset($_POST['eidos_wc_simple_category_gate'])
                ? trim(sanitize_text_field(wp_unslash((string) $_POST['eidos_wc_simple_category_gate'])))
                : 'hard';
            $gate = in_array($rawGate, ['hard', 'soft', 'off'], true) ? $rawGate : 'hard';

            $rawTimeout = isset($_POST['eidos_wc_search_timeout'])
                ? (float) $_POST['eidos_wc_search_timeout']
                : 2.0;
            $timeout = max(0.5, min(10.0, $rawTimeout > 0 ? $rawTimeout : 2.0));

            $rawBatch = isset($_POST['eidos_wc_batch_size'])
                ? (int) $_POST['eidos_wc_batch_size']
                : 100;
            $batchSize = max(10, min(500, $rawBatch > 0 ? $rawBatch : 100));

            if (function_exists('update_option')) {
                update_option(self::OPTION_API_URL, $apiUrl);
                // Store sensitive credentials with autoload = false ('no')
                update_option(self::OPTION_API_KEY, $apiKey, false);
                update_option(self::OPTION_SEARCH_KEY, $searchKey, false);
                update_option(self::OPTION_WC_CONSUMER_KEY, $wcKey, false);
                update_option(self::OPTION_WC_CONSUMER_SECRET, $wcSecret, false);
                update_option(self::OPTION_REPLACE_SEARCH, $replaceSearch ? '1' : '0');
                update_option(self::OPTION_SIMPLE_CATEGORY_GATE, $gate);
                update_option(self::OPTION_SEARCH_TIMEOUT, (string) $timeout);
                update_option(self::OPTION_BATCH_SIZE, (string) $batchSize);
            }

            $this->adminNotice = [
                'type' => 'success',
                'message' => 'Настройки EIDOS успешно сохранены.',
            ];
            return;
        }

        if ($action === 'health_check') {
            $health = $this->connector->healthCheck();
            if ($health['ok']) {
                $this->adminNotice = [
                    'type' => 'success',
                    'message' => sprintf(
                        'Связь с EIDOS установлена! Версия: %s | Товаров в индексе: %d | Задержка: %.2f мс',
                        $health['version'],
                        $health['itemsIndexed'],
                        $health['latencyMs']
                    ),
                    'details' => $health,
                ];
            } else {
                $this->adminNotice = [
                    'type' => 'error',
                    'message' => sprintf(
                        'Ошибка подключения к EIDOS: %s (задержка: %.2f мс)',
                        (string) ($health['error'] ?? 'неизвестная ошибка'),
                        $health['latencyMs']
                    ),
                    'details' => $health,
                ];
            }
            return;
        }

        if ($action === 'sync_catalog') {
            $config = self::getConfig();
            $result = $this->connector->syncCatalog([
                'forceSync' => true,
                'batchSize' => $config['batch_size'],
            ]);
            if ($result['failed'] === 0) {
                $this->adminNotice = [
                    'type' => 'success',
                    'message' => sprintf(
                        'Полная синхронизация завершена: синхронизировано %d товаров (ошибок: 0).',
                        $result['synced']
                    ),
                    'details' => $result,
                ];
            } else {
                $this->adminNotice = [
                    'type' => 'warning',
                    'message' => sprintf(
                        'Синхронизация завершена с предупреждениями: синхронизировано %d, ошибок: %d.',
                        $result['synced'],
                        $result['failed']
                    ),
                    'details' => $result,
                ];
            }
        }
    }

    /**
     * Renders `admin/settings-page.php`.
     */
    public function renderSettingsPage(): void
    {
        $config = self::getConfig();
        $notice = $this->adminNotice;
        $templatePath = dirname(__DIR__) . '/admin/settings-page.php';
        if (file_exists($templatePath)) {
            include $templatePath;
        }
    }

    /**
     * @return array{type: string, message: string, details?: array<string, mixed>}|null
     */
    public function getAdminNotice(): ?array
    {
        return $this->adminNotice;
    }
}

if (!function_exists(__NAMESPACE__ . '\sanitize_key')) {
    function sanitize_key(string $key): string
    {
        return \function_exists('\sanitize_key')
            ? (string) \sanitize_key($key)
            : preg_replace('/[^a-z0-9_\-]/', '', strtolower($key)) ?? '';
    }
}

if (!function_exists(__NAMESPACE__ . '\sanitize_text_field')) {
    function sanitize_text_field(string $str): string
    {
        return \function_exists('\sanitize_text_field')
            ? (string) \sanitize_text_field($str)
            : trim(strip_tags($str));
    }
}

if (!function_exists(__NAMESPACE__ . '\wp_unslash')) {
    function wp_unslash(string $str): string
    {
        return \function_exists('\wp_unslash')
            ? (string) \wp_unslash($str)
            : stripslashes($str);
    }
}

if (!class_exists('Eidos_WC_Settings', false)) {
    class_alias(Settings::class, 'Eidos_WC_Settings');
}
