<?php

declare(strict_types=1);

/**
 * Автозагрузчик классов модуля eidos.connector для 1С-Битрикс.
 * Поддерживает как работу внутри ядра Bitrix (CModule::AddAutoloadClasses),
 * так и автономный запуск через Composer PSR-4.
 */

$coreInterfacePath = dirname(__DIR__) . '/core/src/ConnectorInterface.php';
if (is_file($coreInterfacePath)) {
    require_once $coreInterfacePath;
} else {
    require_once __DIR__ . '/lib/Core/ConnectorInterface.php';
}

require_once __DIR__ . '/src/Settings.php';
require_once __DIR__ . '/src/HttpClient.php';
require_once __DIR__ . '/src/Mapper.php';
require_once __DIR__ . '/src/Connector.php';
require_once __DIR__ . '/src/SearchReplacer.php';

if (class_exists('\CModule')) {
    \CModule::AddAutoloadClasses(
        'eidos.connector',
        [
            'Eidos\\Connectors\\Bitrix\\Settings' => 'src/Settings.php',
            'Eidos\\Connectors\\Bitrix\\HttpClient' => 'src/HttpClient.php',
            'Eidos\\Connectors\\Bitrix\\Mapper' => 'src/Mapper.php',
            'Eidos\\Connectors\\Bitrix\\Connector' => 'src/Connector.php',
            'Eidos\\Connectors\\Bitrix\\SearchReplacer' => 'src/SearchReplacer.php',
            'Eidos\\Bitrix\\HttpClient' => 'lib/HttpClient.php',
            'Eidos\\Bitrix\\Mapper' => 'lib/Mapper.php',
            'Eidos\\Bitrix\\Connector' => 'lib/Connector.php',
        ]
    );
}

if (!class_exists('Eidos\\Bitrix\\HttpClient', false)) {
    class_alias(\Eidos\Connectors\Bitrix\HttpClient::class, 'Eidos\\Bitrix\\HttpClient');
}
if (!class_exists('Eidos\\Bitrix\\Mapper', false)) {
    class_alias(\Eidos\Connectors\Bitrix\Mapper::class, 'Eidos\\Bitrix\\Mapper');
}
if (!class_exists('Eidos\\Bitrix\\Connector', false)) {
    class_alias(\Eidos\Connectors\Bitrix\Connector::class, 'Eidos\\Bitrix\\Connector');
}
