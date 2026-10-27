<?php
/**
 * Plugin Name:       EIDOS Semantic Search & Recommendations for WooCommerce
 * Plugin URI:        https://github.com/ppiiyo/EIDOS
 * Description:       Integrates WooCommerce with EIDOS hybrid vector + BM25 search, catalog synchronization (including product variations), and click feedback telemetry.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            EIDOS Contributors
 * License:           MIT
 * Text Domain:       eidos-woocommerce
 * WC requires at least: 7.0
 * WC tested up to:   9.0
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

define('EIDOS_WC_VERSION', '1.0.0');
define('EIDOS_WC_PLUGIN_DIR', rtrim(__DIR__, '/\\') . '/');

require_once EIDOS_WC_PLUGIN_DIR . 'includes/class-http-client.php';
require_once EIDOS_WC_PLUGIN_DIR . 'includes/class-mapper.php';
require_once EIDOS_WC_PLUGIN_DIR . 'includes/class-search-replacer.php';
require_once EIDOS_WC_PLUGIN_DIR . 'includes/class-connector.php';
require_once EIDOS_WC_PLUGIN_DIR . 'includes/class-settings.php';

use Eidos\Connectors\WooCommerce\Connector;
use Eidos\Connectors\WooCommerce\HttpClient;
use Eidos\Connectors\WooCommerce\Mapper;
use Eidos\Connectors\WooCommerce\SearchReplacer;
use Eidos\Connectors\WooCommerce\Settings;

/**
 * Создаёт и возвращает singleton-экземпляр коннектора EIDOS для WooCommerce.
 */
function eidos_wc_get_connector(): Connector
{
    static $instance = null;
    if ($instance instanceof Connector) {
        return $instance;
    }

    $config = Settings::getConfig();
    $siteUrl = function_exists('home_url') ? (string) home_url() : 'http://localhost';

    $httpClient = new HttpClient(
        $config['api_url'] !== '' ? $config['api_url'] : 'http://localhost:3000',
        $config['api_key'],
        2.5,
        1,
        false,
        null,
        $config['wc_consumer_key'],
        $config['wc_consumer_secret'],
        $siteUrl
    );

    $mapper = new Mapper();
    $searchReplacer = new SearchReplacer($httpClient);
    $instance = new Connector($httpClient, $mapper, $searchReplacer);

    return $instance;
}

/**
 * Инициализация плагина в окружении WordPress:
 * - Регистрирует хук `pre_get_posts` (если включена опция перехвата поиска).
 * - Регистрирует REST-роут `POST /wp-json/eidos/v1/feedback`.
 * - Подключает `assets/js/feedback.js` (`navigator.sendBeacon`) на витрине магазина.
 * - Регистрирует страницу настроек в админке WordPress.
 * - Настраивает ежечасный WP-Cron (`eidos_wc_cron_sync_delta`) для `syncDelta()`.
 */
function eidos_wc_bootstrap(): void
{
    $connector = eidos_wc_get_connector();
    $config = Settings::getConfig();

    if ($config['replace_search']) {
        $connector->getSearchReplacer()->registerHooks();
    }

    if (function_exists('add_action')) {
        add_action('rest_api_init', [$connector, 'registerFeedbackRestRoute']);
        add_action('eidos_wc_cron_sync_delta', [$connector, 'runScheduledDeltaSync']);

        add_action('wp_enqueue_scripts', static function (): void {
            if (!function_exists('wp_enqueue_script') || !function_exists('plugin_dir_url')) {
                return;
            }

            $scriptUrl = plugin_dir_url(__FILE__) . 'assets/js/feedback.js';
            wp_enqueue_script('eidos-wc-feedback', $scriptUrl, [], EIDOS_WC_VERSION, true);

            if (function_exists('wp_localize_script')) {
                $restUrl = function_exists('rest_url')
                    ? (string) rest_url('eidos/v1/feedback')
                    : '/wp-json/eidos/v1/feedback';
                $isHttps = (function_exists('is_ssl') && is_ssl())
                    || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https');
                if ($isHttps && stripos($restUrl, 'http://') === 0) {
                    $restUrl = 'https://' . substr($restUrl, 7);
                }
                $currentQuery = function_exists('get_search_query') ? (string) get_search_query() : '';
                $userId = function_exists('get_current_user_id') && get_current_user_id() > 0
                    ? (string) get_current_user_id()
                    : '';

                wp_localize_script('eidos-wc-feedback', 'EidosWCConfig', [
                    'endpoint' => $restUrl,
                    'query' => $currentQuery,
                    'userId' => $userId,
                ]);
            }
        });
    }

    $settings = new Settings($connector);
    $settings->registerAdminHooks();
}

if (function_exists('register_activation_hook')) {
    register_activation_hook(__FILE__, static function (): void {
        if (function_exists('wp_next_scheduled') && function_exists('wp_schedule_event')) {
            if (!wp_next_scheduled('eidos_wc_cron_sync_delta')) {
                wp_schedule_event(time() + 300, 'hourly', 'eidos_wc_cron_sync_delta');
            }
        }
    });
}

if (function_exists('register_deactivation_hook')) {
    register_deactivation_hook(__FILE__, static function (): void {
        if (function_exists('wp_clear_scheduled_hook')) {
            wp_clear_scheduled_hook('eidos_wc_cron_sync_delta');
        }
    });
}

if (function_exists('add_action')) {
    add_action('plugins_loaded', 'eidos_wc_bootstrap');
}
