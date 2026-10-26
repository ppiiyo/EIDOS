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
 * Technical: Manages WordPress options (`eidos_wc_api_url`, `eidos_wc_api_key`,
 * `eidos_wc_consumer_key`, `eidos_wc_consumer_secret`), registers the admin menu page,
 * and handles AJAX/POST actions for "Синхронизировать" (Sync Catalog) and "Проверить связь" (Health Check).
 */
class Settings
{
    public const OPTION_API_URL = 'eidos_wc_api_url';
    public const OPTION_API_KEY = 'eidos_wc_api_key';
    public const OPTION_WC_CONSUMER_KEY = 'eidos_wc_consumer_key';
    public const OPTION_WC_CONSUMER_SECRET = 'eidos_wc_consumer_secret';
    public const OPTION_REPLACE_SEARCH = 'eidos_wc_replace_search';
    public const OPTION_LAST_SYNC = 'eidos_wc_last_sync';

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
     * Регистрирует страницу настроек в меню админки WordPress и обработчики кнопок.
     */
    public function registerAdminHooks(): void
    {
        if (function_exists('add_action')) {
            add_action('admin_menu', [$this, 'addSettingsPage']);
            add_action('admin_init', [$this, 'handleAdminFormSubmission']);
        }
    }

    /**
     * Добавляет пункт меню «EIDOS Search» в раздел «Настройки» (Settings) и подменю WooCommerce.
     */
    public function addSettingsPage(): void
    {
        if (function_exists('add_options_page')) {
            add_options_page(
                'EIDOS Semantic Search & Recommendations',
                'EIDOS Search',
                'manage_options',
                'eidos-woocommerce',
                [$this, 'renderSettingsPage']
            );
        }
    }

    /**
     * Возвращает текущие настройки плагина из `wp_options`.
     *
     * @return array{api_url: string, api_key: string, wc_consumer_key: string, wc_consumer_secret: string, replace_search: bool, last_sync: string}
     */
    public static function getConfig(): array
    {
        $getOpt = static function (string $key, mixed $default): mixed {
            return function_exists('get_option') ? get_option($key, $default) : $default;
        };

        return [
            'api_url' => (string) $getOpt(self::OPTION_API_URL, 'http://localhost:3000'),
            'api_key' => (string) $getOpt(self::OPTION_API_KEY, ''),
            'wc_consumer_key' => (string) $getOpt(self::OPTION_WC_CONSUMER_KEY, ''),
            'wc_consumer_secret' => (string) $getOpt(self::OPTION_WC_CONSUMER_SECRET, ''),
            'replace_search' => (bool) $getOpt(self::OPTION_REPLACE_SEARCH, true),
            'last_sync' => (string) $getOpt(self::OPTION_LAST_SYNC, ''),
        ];
    }

    /**
     * Обрабатывает сохранение настроек, нажатие кнопки «Проверить связь» и «Синхронизировать».
     */
    public function handleAdminFormSubmission(): void
    {
        if (empty($_POST['eidos_wc_action'])) {
            return;
        }

        if (function_exists('current_user_can') && !current_user_can('manage_options')) {
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
            $wcKey = isset($_POST['eidos_wc_consumer_key'])
                ? trim(sanitize_text_field(wp_unslash((string) $_POST['eidos_wc_consumer_key'])))
                : '';
            $wcSecret = isset($_POST['eidos_wc_consumer_secret'])
                ? trim(sanitize_text_field(wp_unslash((string) $_POST['eidos_wc_consumer_secret'])))
                : '';
            $replaceSearch = !empty($_POST['eidos_wc_replace_search']);

            if (function_exists('update_option')) {
                update_option(self::OPTION_API_URL, $apiUrl);
                update_option(self::OPTION_API_KEY, $apiKey);
                update_option(self::OPTION_WC_CONSUMER_KEY, $wcKey);
                update_option(self::OPTION_WC_CONSUMER_SECRET, $wcSecret);
                update_option(self::OPTION_REPLACE_SEARCH, $replaceSearch ? '1' : '0');
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
            $result = $this->connector->syncCatalog(['forceSync' => true]);
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
     * Рендерит HTML-шаблон страницы настроек (`admin/settings-page.php`).
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
