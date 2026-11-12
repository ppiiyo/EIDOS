<?php
/**
 * DEPRECATED: Legacy 1C-Bitrix installer stub (eidos.search).
 * Use the production module `eidos.connector` located in `packages/connectors/bitrix`.
 */

use Bitrix\Main\ModuleManager;
use Bitrix\Main\Config\Option;

class eidos_search extends CModule
{
    public $MODULE_ID = 'eidos.search';
    public $MODULE_VERSION;
    public $MODULE_VERSION_DATE;
    public $MODULE_NAME = 'EIDOS Search & Merchandising (DEPRECATED — используйте eidos.connector)';
    public $MODULE_DESCRIPTION = 'Устаревший черновик модуля. Используйте актуальный модуль eidos.connector из packages/connectors/bitrix.';
    public $PARTNER_NAME = 'EIDOS';
    public $PARTNER_URI = 'https://eidos.search';

    public function __construct()
    {
        $arModuleVersion = [];
        include __DIR__ . '/version.php';
        $this->MODULE_VERSION = $arModuleVersion['VERSION'] ?? '3.4.0';
        $this->MODULE_VERSION_DATE = $arModuleVersion['VERSION_DATE'] ?? '2026-04-12 00:00:00';
    }

    public function DoInstall(): bool
    {
        ModuleManager::registerModule($this->MODULE_ID);
        return true;
    }

    public function DoUninstall(): bool
    {
        Option::delete($this->MODULE_ID);
        ModuleManager::unRegisterModule($this->MODULE_ID);
        return true;
    }
}
