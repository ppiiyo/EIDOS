<?php

declare(strict_types=1);

/**
 * Страница настроек модуля eidos.connector в административной панели 1С-Битрикс.
 * Путь: Настройки -> Настройки продукта -> Настройки модулей -> EIDOS: Гибридный поиск и рекомендации
 */

require_once dirname(__DIR__) . '/include.php';

use Eidos\Connectors\Bitrix\Connector;
use Eidos\Connectors\Bitrix\HttpClient;
use Eidos\Connectors\Bitrix\Settings;

$module_id = 'eidos.connector';

if (function_exists('IncludeModuleLangFile')) {
    IncludeModuleLangFile(__FILE__);
}

$requestMethod = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$csrfValid = !function_exists('check_bitrix_sessid') || check_bitrix_sessid();

// Сохранение настроек
if ($requestMethod === 'POST' && isset($_POST['save']) && $csrfValid) {
    $rawUrl = trim((string) ($_POST['eidos_api_url'] ?? ''));
    $rawKey = trim((string) ($_POST['eidos_api_key'] ?? ''));
    $rawIblockId = (string) ((int) ($_POST['eidos_iblock_id'] ?? 0));

    if (class_exists('\COption')) {
        \COption::SetOptionString($module_id, 'api_url', $rawUrl);
        if ($rawKey !== '') {
            \COption::SetOptionString($module_id, 'api_key', $rawKey);
        }
        \COption::SetOptionInt($module_id, 'iblock_id', (int) $rawIblockId);
    }

    Settings::setOption('api_url', $rawUrl);
    Settings::setOption(Settings::OPT_API_URL, $rawUrl);
    if ($rawKey !== '') {
        Settings::setOption('api_key', $rawKey);
        Settings::setOption(Settings::OPT_API_KEY, $rawKey);
    }
    Settings::setOption('iblock_id', $rawIblockId);
    Settings::setOption(Settings::OPT_IBLOCK_ID, $rawIblockId);
}

$apiUrl = class_exists('\COption')
    ? (string) \COption::GetOptionString($module_id, 'api_url', Settings::getOption(Settings::OPT_API_URL, 'https://localhost:3000'))
    : Settings::getOption('api_url', Settings::getOption(Settings::OPT_API_URL, 'https://localhost:3000'));

$apiKey = class_exists('\COption')
    ? (string) \COption::GetOptionString($module_id, 'api_key', Settings::getOption(Settings::OPT_API_KEY, ''))
    : Settings::getOption('api_key', Settings::getOption(Settings::OPT_API_KEY, ''));

$iblockId = class_exists('\COption')
    ? (int) \COption::GetOptionInt($module_id, 'iblock_id', (int) Settings::getOption(Settings::OPT_IBLOCK_ID, '0'))
    : (int) Settings::getOption('iblock_id', Settings::getOption(Settings::OPT_IBLOCK_ID, '0'));

$enforceHttps = str_starts_with(strtolower($apiUrl), 'https://');
$httpClient = new HttpClient($apiUrl !== '' ? $apiUrl : 'https://localhost:3000', $apiKey, 3.0, 1, $enforceHttps);
$connector = new Connector($httpClient);

$syncBannerHtml = '';

// Кнопка «Синхронизировать сейчас»
if ($requestMethod === 'POST' && isset($_POST['sync_now']) && $csrfValid) {
    $result = $connector->syncCatalog(['batchSize' => 100]);
    if (!empty($result['queued'])) {
        $msg = 'В каталоге более 500 товаров. Синхронизация поставлена в фоновый агент (CAgent).';
    } else {
        $msg = sprintf('Синхронизировано: %d, ошибок: %d', $result['synced'], $result['failed']);
    }

    if (class_exists('\CAdminMessage')) {
        \CAdminMessage::ShowMessage([
            'MESSAGE' => $msg,
            'TYPE' => ($result['failed'] ?? 0) === 0 ? 'OK' : 'ERROR',
        ]);
    } else {
        $syncBannerHtml = '<div class="adm-info-message">' . htmlspecialchars($msg, ENT_QUOTES, 'UTF-8') . '</div>';
    }
}

// Автоматический или ручной Health-check (таймаут 3 секунды)
$health = $connector->healthCheck();
?>
<?= $syncBannerHtml ?>
<div style="padding: 12px; margin-bottom: 16px; border-radius: 4px; background: <?= $health['ok'] ? '#e8f5e9' : '#ffebee' ?>;">
    <?php if ($health['ok']): ?>
        <span style="color: #1b5e20; font-weight: 600;">
            ✅ EIDOS доступен (товаров в индексе: <?= (int) $health['itemsIndexed'] ?>, версия: <?= htmlspecialchars($health['version'], ENT_QUOTES, 'UTF-8') ?>, задержка: <?= (float) $health['latencyMs'] ?> мс)
        </span>
    <?php else: ?>
        <span style="color: #b71c1c; font-weight: 600;">
            ❌ EIDOS недоступен (поиск работает через стандартный Битрикс)
        </span>
    <?php endif; ?>
</div>

<form method="post" action="">
    <?php if (function_exists('bitrix_sessid_post')): ?>
        <?= bitrix_sessid_post() ?>
    <?php endif; ?>
    <table class="adm-detail-content-table edit-table">
        <tr>
            <td width="40%">URL сервера EIDOS:</td>
            <td width="60%">
                <input type="text" name="eidos_api_url" value="<?= htmlspecialchars($apiUrl, ENT_QUOTES, 'UTF-8') ?>" size="50" />
            </td>
        </tr>
        <tr>
            <td>API-ключ EIDOS:</td>
            <td>
                <input type="password" name="eidos_api_key" value="<?= htmlspecialchars($apiKey, ENT_QUOTES, 'UTF-8') ?>" size="50" />
            </td>
        </tr>
        <tr>
            <td>ID инфоблока товаров:</td>
            <td>
                <input type="number" name="eidos_iblock_id" value="<?= (int) $iblockId ?>" min="0" />
            </td>
        </tr>
    </table>
    <div style="margin-top: 12px;">
        <input type="submit" name="save" value="Сохранить" class="adm-btn-save" />
        <input type="submit" name="sync_now" value="Синхронизировать сейчас" class="adm-btn" />
        <input type="submit" name="health_check" value="Проверить связь" class="adm-btn" />
    </div>
</form>
