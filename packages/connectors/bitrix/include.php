<?php

declare(strict_types=1);

/**
 * Автозагрузка классов модуля eidos.connector для 1С-Битрикс.
 * Работает как через Composer PSR-4, так и через нативный CModule::AddAutoloadClasses без Composer.
 */

$coreInterfacePath = dirname(__DIR__) . '/core/src/ConnectorInterface.php';
if (!interface_exists(\Eidos\Connectors\Core\ConnectorInterface::class) && is_file($coreInterfacePath)) {
    require_once $coreInterfacePath;
}

if (!interface_exists(\Eidos\Connectors\Core\ConnectorInterface::class)) {
    // Fallback-объявление интерфейса, если модуль скопирован автономно в /local/modules/eidos.connector/
    namespace Eidos\Connectors\Core {
        use DateTimeInterface;

        if (!interface_exists(ConnectorInterface::class)) {
            interface ConnectorInterface
            {
                public function syncCatalog(array $options = []): array;
                public function syncDelta(DateTimeInterface $since, int $batchSize = 100): array;
                public function replaceSearch(string $query, array $options = []): array;
                public function pushFeedback(array $event): bool;
                public function healthCheck(): array;
                public function mapFields(mixed $systemItem): array;
            }
        }
    }
}

namespace {
    $srcDir = __DIR__ . '/src';
    require_once $srcDir . '/HttpClient.php';
    require_once $srcDir . '/Mapper.php';
    require_once $srcDir . '/SearchReplacer.php';
    require_once $srcDir . '/Settings.php';
    require_once $srcDir . '/Connector.php';

    if (class_exists('\CModule')) {
        \CModule::AddAutoloadClasses(
            'eidos.connector',
            [
                'Eidos\\Connectors\\Bitrix\\HttpClient' => 'src/HttpClient.php',
                'Eidos\\Connectors\\Bitrix\\Mapper' => 'src/Mapper.php',
                'Eidos\\Connectors\\Bitrix\\SearchReplacer' => 'src/SearchReplacer.php',
                'Eidos\\Connectors\\Bitrix\\Settings' => 'src/Settings.php',
                'Eidos\\Connectors\\Bitrix\\Connector' => 'src/Connector.php',
            ]
        );
    }

    // Регистрируем глобальные алиасы классов для вызовов из CAgent и шаблонов Битрикс
    if (!class_exists('EidosConnector', false)) {
        class_alias(\Eidos\Connectors\Bitrix\Connector::class, 'EidosConnector');
    }
    if (!class_exists('EidosHttpClient', false)) {
        class_alias(\Eidos\Connectors\Bitrix\HttpClient::class, 'EidosHttpClient');
    }
    if (!class_exists('EidosMapper', false)) {
        class_alias(\Eidos\Connectors\Bitrix\Mapper::class, 'EidosMapper');
    }
}
