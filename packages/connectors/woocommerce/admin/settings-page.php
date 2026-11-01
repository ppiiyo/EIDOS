<?php
/**
 * Admin Settings UI Template for EIDOS WooCommerce Connector.
 *
 * @var array<string, mixed> $config
 * @var array{type: string, message: string, details?: array<string, mixed>}|null $notice
 */

declare(strict_types=1);

if (!defined('ABSPATH') && !isset($config)) {
    exit;
}

$escAttr = static function (string $val): string {
    return function_exists('esc_attr')
        ? (string) esc_attr($val)
        : htmlspecialchars($val, ENT_QUOTES, 'UTF-8');
};

$escHtml = static function (string $val): string {
    return function_exists('esc_html')
        ? (string) esc_html($val)
        : htmlspecialchars($val, ENT_QUOTES, 'UTF-8');
};

$hasAdminKey = !empty($config['api_key']);
$hasSearchKey = !empty($config['search_key']);
$lastReport = isset($config['last_sync_report']) && is_array($config['last_sync_report'])
    ? $config['last_sync_report']
    : [];
$currentGate = (string) ($config['simple_category_gate'] ?? 'hard');
?>
<div class="wrap">
    <h1><?php echo $escHtml('EIDOS — Семантический поиск и рекомендации для WooCommerce'); ?></h1>

    <?php if ($hasAdminKey && !$hasSearchKey) : ?>
        <div class="notice notice-warning">
            <p>
                <strong><?php echo $escHtml('Рекомендация безопасности:'); ?></strong>
                <?php echo $escHtml('Задан только ADMIN_KEY без отдельного ключа чтения SEARCH_KEY. Для production-витрины рекомендуется указать отдельный SEARCH_KEY (права только на /v1/search, /v1/recommend, /v1/feedback).'); ?>
            </p>
        </div>
    <?php endif; ?>

    <?php if (!empty($notice) && is_array($notice)) : ?>
        <?php
        $noticeClassMap = [
            'success' => 'notice-success',
            'error'   => 'notice-error',
            'warning' => 'notice-warning',
        ];
        $noticeType = (string) ($notice['type'] ?? 'info');
        $noticeClass = $noticeClassMap[$noticeType] ?? 'notice-info';
        ?>
        <div class="notice <?php echo $escAttr($noticeClass); ?> is-dismissible">
            <p><strong><?php echo $escHtml((string) ($notice['message'] ?? '')); ?></strong></p>
        </div>
    <?php endif; ?>

    <!-- Форма основных настроек подключения -->
    <form method="post" action="">
        <?php
        if (function_exists('wp_nonce_field')) {
            wp_nonce_field('eidos_wc_settings_action', 'eidos_wc_nonce');
        }
        ?>
        <input type="hidden" name="eidos_wc_action" value="save_settings" />

        <table class="form-table" role="presentation">
            <tbody>
                <tr>
                    <th scope="row">
                        <label for="eidos_wc_api_url"><?php echo $escHtml('URL сервера EIDOS'); ?></label>
                    </th>
                    <td>
                        <input
                            name="eidos_wc_api_url"
                            type="url"
                            id="eidos_wc_api_url"
                            value="<?php echo $escAttr((string) ($config['api_url'] ?? 'http://localhost:3000')); ?>"
                            class="regular-text"
                            required
                        />
                        <p class="description">
                            <?php echo $escHtml('Базовый адрес API EIDOS (например, https://search.example.com или http://localhost:3000).'); ?>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="eidos_wc_api_key"><?php echo $escHtml('EIDOS ADMIN_KEY (Выгрузка / Sync)'); ?></label>
                    </th>
                    <td>
                        <input
                            name="eidos_wc_api_key"
                            type="password"
                            id="eidos_wc_api_key"
                            value="<?php echo $escAttr((string) ($config['api_key'] ?? '')); ?>"
                            class="regular-text"
                            autocomplete="off"
                        />
                        <p class="description">
                            <?php echo $escHtml('Административный ключ для пакетной синхронизации каталога (POST /v1/catalog/upsert). Хранится только на сервере (autoload=no).'); ?>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="eidos_wc_search_key"><?php echo $escHtml('EIDOS SEARCH_KEY (Витрина / Поиск)'); ?></label>
                    </th>
                    <td>
                        <input
                            name="eidos_wc_search_key"
                            type="password"
                            id="eidos_wc_search_key"
                            value="<?php echo $escAttr((string) ($config['search_key'] ?? '')); ?>"
                            class="regular-text"
                            autocomplete="off"
                        />
                        <p class="description">
                            <?php echo $escHtml('Ключ только для чтения (/v1/search, /v1/recommend, /v1/feedback). Если не заполнен, используется ADMIN_KEY.'); ?>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="eidos_wc_consumer_key"><?php echo $escHtml('WooCommerce Consumer Key'); ?></label>
                    </th>
                    <td>
                        <input
                            name="eidos_wc_consumer_key"
                            type="text"
                            id="eidos_wc_consumer_key"
                            value="<?php echo $escAttr((string) ($config['wc_consumer_key'] ?? '')); ?>"
                            class="regular-text"
                            placeholder="ck_..."
                        />
                        <p class="description">
                            <?php echo $escHtml('Ключ REST API WooCommerce (/wp-json/wc/v3/products) для выгрузки товаров и вариаций (опционально при локальном запуске).'); ?>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="eidos_wc_consumer_secret"><?php echo $escHtml('WooCommerce Consumer Secret'); ?></label>
                    </th>
                    <td>
                        <input
                            name="eidos_wc_consumer_secret"
                            type="password"
                            id="eidos_wc_consumer_secret"
                            value="<?php echo $escAttr((string) ($config['wc_consumer_secret'] ?? '')); ?>"
                            class="regular-text"
                            placeholder="cs_..."
                            autocomplete="off"
                        />
                    </td>
                </tr>

                <tr>
                    <th scope="row"><?php echo $escHtml('Перехват поиска WooCommerce'); ?></th>
                    <td>
                        <label for="eidos_wc_replace_search">
                            <input
                                name="eidos_wc_replace_search"
                                type="checkbox"
                                id="eidos_wc_replace_search"
                                value="1"
                                <?php echo !empty($config['replace_search']) ? 'checked="checked"' : ''; ?>
                            />
                            <?php echo $escHtml('Заменять стандартный поиск на гибридный поиск EIDOS (с автоматическим fallback при недоступности)'); ?>
                        </label>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="eidos_wc_simple_category_gate"><?php echo $escHtml('Фильтр целевой категории (simpleCategoryGate)'); ?></label>
                    </th>
                    <td>
                        <select name="eidos_wc_simple_category_gate" id="eidos_wc_simple_category_gate">
                            <option value="hard" <?php echo $currentGate === 'hard' ? 'selected="selected"' : ''; ?>>
                                <?php echo $escHtml('hard (По умолчанию — строгий приоритет категории товара)'); ?>
                            </option>
                            <option value="soft" <?php echo $currentGate === 'soft' ? 'selected="selected"' : ''; ?>>
                                <?php echo $escHtml('soft (Мягкое понижение нерелевантных категорий)'); ?>
                            </option>
                            <option value="off" <?php echo $currentGate === 'off' ? 'selected="selected"' : ''; ?>>
                                <?php echo $escHtml('off (Отключено — чистый RRF ранг)'); ?>
                            </option>
                        </select>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="eidos_wc_search_timeout"><?php echo $escHtml('Таймаут поиска (сек)'); ?></label>
                    </th>
                    <td>
                        <input
                            name="eidos_wc_search_timeout"
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="10.0"
                            id="eidos_wc_search_timeout"
                            value="<?php echo $escAttr((string) ($config['search_timeout'] ?? 2.0)); ?>"
                            class="small-text"
                        />
                        <span class="description"><?php echo $escHtml('Рекомендуется 2.0–2.5 сек для мгновенного fallback.'); ?></span>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="eidos_wc_batch_size"><?php echo $escHtml('Размер батча выгрузки (Batch Size)'); ?></label>
                    </th>
                    <td>
                        <input
                            name="eidos_wc_batch_size"
                            type="number"
                            min="10"
                            max="500"
                            id="eidos_wc_batch_size"
                            value="<?php echo $escAttr((string) ($config['batch_size'] ?? 100)); ?>"
                            class="small-text"
                        />
                        <span class="description"><?php echo $escHtml('По умолчанию 100 товаров за один запрос /v1/catalog/upsert.'); ?></span>
                    </td>
                </tr>

                <tr>
                    <th scope="row"><?php echo $escHtml('Последняя синхронизация'); ?></th>
                    <td>
                        <code>
                            <?php
                            echo !empty($config['last_sync'])
                                ? $escHtml((string) $config['last_sync'])
                                : $escHtml('Ещё не выполнялась');
                            ?>
                        </code>
                        <?php if (!empty($lastReport)) : ?>
                            <p class="description">
                                <?php
                                echo $escHtml(sprintf(
                                    'Выгружено: %d | Пропущено (черновики): %d | Ошибок: %d',
                                    (int) ($lastReport['synced'] ?? 0),
                                    (int) ($lastReport['skipped'] ?? 0),
                                    (int) ($lastReport['failed'] ?? 0)
                                ));
                                ?>
                            </p>
                        <?php endif; ?>
                    </td>
                </tr>
            </tbody>
        </table>

        <p class="submit">
            <button type="submit" class="button button-primary">
                <?php echo $escHtml('Сохранить настройки'); ?>
            </button>
        </p>
    </form>

    <hr />

    <h2><?php echo $escHtml('Управление и диагностика'); ?></h2>
    <div style="display: flex; gap: 12px; align-items: center; margin-top: 12px;">
        <!-- Кнопка «Проверить связь» -->
        <form method="post" action="" style="margin: 0;">
            <?php
            if (function_exists('wp_nonce_field')) {
                wp_nonce_field('eidos_wc_settings_action', 'eidos_wc_nonce');
            }
            ?>
            <input type="hidden" name="eidos_wc_action" value="health_check" />
            <button type="submit" class="button button-secondary">
                <?php echo $escHtml('Проверить связь'); ?>
            </button>
        </form>

        <!-- Кнопка «Синхронизировать» -->
        <form method="post" action="" style="margin: 0;">
            <?php
            if (function_exists('wp_nonce_field')) {
                wp_nonce_field('eidos_wc_settings_action', 'eidos_wc_nonce');
            }
            ?>
            <input type="hidden" name="eidos_wc_action" value="sync_catalog" />
            <button type="submit" class="button button-primary">
                <?php echo $escHtml('Синхронизировать'); ?>
            </button>
        </form>
    </div>
</div>
