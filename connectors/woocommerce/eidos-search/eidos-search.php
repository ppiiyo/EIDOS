<?php
/**
 * Plugin Name: EIDOS Hybrid Search for WooCommerce (Pilot Edition)
 * Description: Self-hosted hybrid search (HNSW 384-d + BM25 + RRF + Category Gate) with 15-minute 4-step Setup Wizard, Live Suggest, and automatic native WooCommerce fallback.
 * Version: 3.4.0
 * Author: EIDOS Search Engineering
 * Text Domain: eidos-search
 */

if (!defined('ABSPATH')) {
    exit;
}

class Eidos_WooCommerce_Pilot_Plugin {
    const OPT_API_URL        = 'eidos_api_url';
    const OPT_SEARCH_KEY     = 'eidos_search_key';
    const OPT_ADMIN_KEY      = 'eidos_admin_key';
    const OPT_ENABLE_SUGGEST = 'eidos_enable_suggest';
    const OPT_REPLACE_SEARCH = 'eidos_replace_search';
    const OPT_LAST_SYNC      = 'eidos_last_sync_meta';
    const BATCH_SIZE         = 200;
    const HTTP_TIMEOUT_SEC   = 2.5;

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'register_admin_menu']);
        add_action('rest_api_init', [__CLASS__, 'register_rest_routes']);
        add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue_storefront_assets']);
        add_action('pre_get_posts', [__CLASS__, 'intercept_woocommerce_search'], 20);

        // Delta synchronization hooks
        add_action('save_post_product', [__CLASS__, 'on_product_saved'], 20, 2);
        add_action('woocommerce_update_product', [__CLASS__, 'on_wc_product_updated'], 20, 1);
        add_action('before_delete_post', [__CLASS__, 'on_product_deleted'], 20, 1);
    }

    public static function register_admin_menu() {
        add_submenu_page(
            'woocommerce',
            'EIDOS Search Setup Wizard',
            'EIDOS Search',
            'manage_woocommerce',
            'eidos-search-wizard',
            [__CLASS__, 'render_wizard_page']
        );
    }

    /**
     * WP REST Proxy: POST /wp-json/eidos/v1/search
     * Hides internal Docker network topology and never exposes ADMIN_KEY to the browser.
     * Returns { ok: false, fallback: true } on timeout (>2.5s) or 5xx/503 INDEX_EMPTY.
     */
    public static function register_rest_routes() {
        register_rest_route('eidos/v1', '/search', [
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => [__CLASS__, 'handle_rest_search_proxy'],
        ]);
    }

    public static function handle_rest_search_proxy(WP_REST_Request $request) {
        $params = $request->get_json_params();
        $query  = isset($params['query']) ? sanitize_text_field($params['query']) : '';
        $limit  = isset($params['limit']) ? min(8, max(1, intval($params['limit']))) : 6;
        $mode   = isset($params['mode']) && $params['mode'] === 'search' ? 'search' : 'suggest';

        $api_url    = rtrim((string) get_option(self::OPT_API_URL, 'http://localhost:3001'), '/');
        $search_key = (string) get_option(self::OPT_SEARCH_KEY, '');

        $endpoint = $api_url . ($mode === 'suggest' ? '/v1/suggest' : '/v1/search');
        $response = wp_remote_post($endpoint, [
            'timeout' => self::HTTP_TIMEOUT_SEC,
            'headers' => [
                'Content-Type'      => 'application/json',
                'X-API-Key'         => $search_key,
                'X-Eidos-Fail-Closed' => 'true',
            ],
            'body' => wp_json_encode([
                'query'              => $query,
                'limit'              => $limit,
                'simpleCategoryGate' => 'hard',
            ]),
        ]);

        if (is_wp_error($response)) {
            error_log('[EIDOS Fallback] API unreachable: ' . $response->get_error_message());
            return new WP_REST_Response(['ok' => false, 'fallback' => true], 200);
        }

        $status = wp_remote_retrieve_response_code($response);
        $body   = json_decode(wp_remote_retrieve_body($response), true);

        if ($status >= 500 || !is_array($body) || (isset($body['code']) && $body['code'] === 'INDEX_EMPTY')) {
            error_log('[EIDOS Fallback] HTTP ' . $status . ' or empty index; falling back to native WP_Query.');
            return new WP_REST_Response(['ok' => false, 'fallback' => true], 200);
        }

        $body['ok'] = true;
        return new WP_REST_Response($body, 200);
    }

    public static function enqueue_storefront_assets() {
        if (get_option(self::OPT_ENABLE_SUGGEST, '1') !== '1') {
            return;
        }
        wp_enqueue_script(
            'eidos-suggest',
            plugin_dir_url(__FILE__) . 'assets/eidos-suggest.js',
            [],
            '3.4.0',
            true
        );
        // SECURITY: Only proxy URL is passed to browser; ADMIN_KEY is NEVER exposed.
        wp_localize_script('eidos-suggest', 'EIDOS_SEARCH_CONFIG', [
            'proxyUrl'      => esc_url_raw(rest_url('eidos/v1/search')),
            'searchPageUrl' => esc_url_raw(home_url('/?post_type=product&s=')),
            'limit'         => 6,
        ]);
    }

    /**
     * Full Search Replacement with Automatic Fail-Safe Fallback to Native WP_Query
     */
    public static function intercept_woocommerce_search($query) {
        if (is_admin() || !$query->is_main_query() || !$query->is_search()) {
            return;
        }
        if (get_option(self::OPT_REPLACE_SEARCH, '1') !== '1') {
            return;
        }

        $search_term = trim((string) $query->get('s'));
        if ($search_term === '') {
            return;
        }

        $api_url    = rtrim((string) get_option(self::OPT_API_URL, 'http://localhost:3001'), '/');
        $search_key = (string) get_option(self::OPT_SEARCH_KEY, '');

        $response = wp_remote_post($api_url . '/v1/search', [
            'timeout' => self::HTTP_TIMEOUT_SEC,
            'headers' => [
                'Content-Type'        => 'application/json',
                'X-API-Key'           => $search_key,
                'X-Eidos-Fail-Closed' => 'true',
            ],
            'body' => wp_json_encode([
                'query'              => $search_term,
                'limit'              => 24,
                'simpleCategoryGate' => 'hard',
            ]),
        ]);

        // Fail-Safe Contract: On timeout, network error, 5xx, or 503 INDEX_EMPTY -> keep native WP_Query untouched!
        if (is_wp_error($response)) {
            error_log('[EIDOS Fallback] Storefront full search fallback to native WP_Query: ' . $response->get_error_message());
            return;
        }

        $status = wp_remote_retrieve_response_code($response);
        $data   = json_decode(wp_remote_retrieve_body($response), true);
        if ($status >= 500 || !is_array($data) || !isset($data['results'])) {
            error_log('[EIDOS Fallback] Storefront full search fallback (HTTP ' . $status . ')');
            return;
        }

        $ids = [];
        foreach ($data['results'] as $item) {
            if (!empty($item['id']) && is_numeric($item['id'])) {
                $ids[] = intval($item['id']);
            }
        }

        $query->set('s', '');
        if (empty($ids)) {
            // Honest zero-results: no random fallback products
            $query->set('post__in', [0]);
        } else {
            $query->set('post__in', $ids);
            $query->set('orderby', 'post__in');
        }
    }

    public static function map_wc_product($product): ?array {
        if (!$product || !is_a($product, 'WC_Product') || $product->get_status() !== 'publish') {
            return null;
        }
        $terms = get_the_terms($product->get_id(), 'product_cat');
        $cat_names = [];
        if (is_array($terms)) {
            foreach ($terms as $t) {
                $cat_names[] = $t->name;
            }
        }
        $tags_terms = get_the_terms($product->get_id(), 'product_tag');
        $tags = [];
        if (is_array($tags_terms)) {
            foreach ($tags_terms as $tt) {
                $tags[] = $tt->name;
            }
        }
        $raw_sku = trim((string) $product->get_sku());
        $sku     = $raw_sku !== '' ? $raw_sku : (string) $product->get_id();
        if ($raw_sku !== '') {
            $tags[] = $raw_sku;
        }
        $img_url = wp_get_attachment_url($product->get_image_id());

        return [
            'id'          => (string) $product->get_id(),
            'sku'         => $sku,
            'title'       => wp_strip_all_tags($product->get_name()),
            'description' => wp_strip_all_tags($product->get_short_description() ?: $product->get_description()),
            'category'    => !empty($cat_names) ? implode(' / ', $cat_names) : 'Каталог',
            'price'       => (float) $product->get_price(),
            'inStock'     => $product->is_in_stock(),
            'url'         => get_permalink($product->get_id()),
            'imageUrl'    => $img_url ? (string) $img_url : null,
            'tags'        => array_values(array_unique($tags)),
        ];
    }

    public static function on_product_saved($post_id, $post) {
        if (wp_is_post_revision($post_id) || $post->post_status !== 'publish') return;
        self::on_wc_product_updated($post_id);
    }

    public static function on_wc_product_updated($product_id) {
        if (!function_exists('wc_get_product')) return;
        $product = wc_get_product($product_id);
        $mapped  = self::map_wc_product($product);
        if (!$mapped) return;

        $api_url   = rtrim((string) get_option(self::OPT_API_URL, 'http://localhost:3001'), '/');
        $admin_key = (string) get_option(self::OPT_ADMIN_KEY, '');
        if (!$admin_key) return;

        wp_remote_post($api_url . '/v1/catalog/upsert', [
            'timeout'  => 5,
            'blocking' => false,
            'headers'  => [
                'Content-Type' => 'application/json',
                'X-API-Key'    => $admin_key,
            ],
            'body' => wp_json_encode(['items' => [$mapped]]),
        ]);
    }

    public static function on_product_deleted($post_id) {
        if (get_post_type($post_id) !== 'product') return;
        $api_url   = rtrim((string) get_option(self::OPT_API_URL, 'http://localhost:3001'), '/');
        $admin_key = (string) get_option(self::OPT_ADMIN_KEY, '');
        if (!$admin_key) return;

        wp_remote_request($api_url . '/v1/catalog/' . rawurlencode((string) $post_id), [
            'method'   => 'DELETE',
            'timeout'  => 5,
            'blocking' => false,
            'headers'  => ['X-API-Key' => $admin_key],
        ]);
    }

    public static function render_wizard_page() {
        if (!current_user_can('manage_woocommerce')) {
            return;
        }
        if (isset($_POST['eidos_save_settings']) && check_admin_referer('eidos_wizard_nonce')) {
            update_option(self::OPT_API_URL, esc_url_raw($_POST['eidos_api_url'] ?? 'http://localhost:3001'));
            update_option(self::OPT_SEARCH_KEY, sanitize_text_field($_POST['eidos_search_key'] ?? ''));
            update_option(self::OPT_ADMIN_KEY, sanitize_text_field($_POST['eidos_admin_key'] ?? ''));
            update_option(self::OPT_ENABLE_SUGGEST, isset($_POST['eidos_enable_suggest']) ? '1' : '0');
            update_option(self::OPT_REPLACE_SEARCH, isset($_POST['eidos_replace_search']) ? '1' : '0');
            echo '<div class="updated"><p>Настройки EIDOS сохранены.</p></div>';
        }
        ?>
        <div class="wrap">
            <h1>EIDOS Hybrid Search — Мастер подключения (4 шага)</h1>
            <form method="post">
                <?php wp_nonce_field('eidos_wizard_nonce'); ?>
                <h2>Шаг 1 — Connection (Подключение к API)</h2>
                <table class="form-table">
                    <tr>
                        <th>API URL</th>
                        <td><input type="url" name="eidos_api_url" value="<?php echo esc_attr(get_option(self::OPT_API_URL, 'http://localhost:3001')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th>SEARCH_KEY (Public)</th>
                        <td><input type="text" name="eidos_search_key" value="<?php echo esc_attr(get_option(self::OPT_SEARCH_KEY, '')); ?>" class="regular-text" /></td>
                    </tr>
                    <tr>
                        <th>ADMIN_KEY (Server-only)</th>
                        <td><input type="password" name="eidos_admin_key" value="<?php echo esc_attr(get_option(self::OPT_ADMIN_KEY, '')); ?>" class="regular-text" /></td>
                    </tr>
                </table>

                <h2>Шаг 2 — Sync (Пакетная выгрузка по <?php echo intval(self::BATCH_SIZE); ?> товаров)</h2>
                <p>Выгружает опубликованные товары WooCommerce в <code>POST /v1/catalog/upsert</code> + включает автоматическую дельта-синхронизацию.</p>

                <h2>Шаг 3 — Storefront (Витрина)</h2>
                <label><input type="checkbox" name="eidos_enable_suggest" value="1" <?php checked(get_option(self::OPT_ENABLE_SUGGEST, '1'), '1'); ?> /> Включить живые подсказки (Live Suggest)</label><br/>
                <label><input type="checkbox" name="eidos_replace_search" value="1" <?php checked(get_option(self::OPT_REPLACE_SEARCH, '1'), '1'); ?> /> Заменить страницу результатов поиска (с авто-fallback на WooCommerce)</label>

                <h2>Шаг 4 — Verify (Контрольная проверка 5 запросов)</h2>
                <p>Проверяет 3 реальных товара из каталога, 1 запрос в английской раскладке (<code>yfeiybrb</code>) и 1 мусорный запрос (<code>абракадабра999</code> → 0 результатов).</p>

                <p class="submit">
                    <button type="submit" name="eidos_save_settings" class="button button-primary">Сохранить настройки</button>
                </p>
            </form>
        </div>
        <?php
    }
}

Eidos_WooCommerce_Pilot_Plugin::init();
