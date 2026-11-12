<?php

use Bitrix\Main\ModuleManager;

class eidos_connector extends CModule
{
    public $MODULE_ID = 'eidos.connector';
    public $MODULE_VERSION;
    public $MODULE_VERSION_DATE;
    public $MODULE_NAME;
    public $MODULE_DESCRIPTION;
    public $PARTNER_NAME;
    public $PARTNER_URI;

    public function __construct()
    {
        $arModuleVersion = [];
        include __DIR__ . '/version.php';
        $this->MODULE_VERSION = $arModuleVersion['VERSION'] ?? '1.0.0';
        $this->MODULE_VERSION_DATE = $arModuleVersion['VERSION_DATE'] ?? '';
        $this->MODULE_NAME = 'EIDOS Search Connector';
        $this->MODULE_DESCRIPTION = 'Hybrid search connector for EIDOS (HNSW + BM25)';
        $this->PARTNER_NAME = 'EIDOS';
        $this->PARTNER_URI = 'https://github.com/ppiiyo/EIDOS';
    }

    public function DoInstall()
    {
        ModuleManager::registerModule($this->MODULE_ID);
        $this->InstallEvents();
        $this->InstallAgents();
        return true;
    }

    public function DoUninstall()
    {
        $this->UnInstallAgents();
        $this->UnInstallEvents();
        ModuleManager::unRegisterModule($this->MODULE_ID);
        return true;
    }

    public function InstallEvents(): void
    {
        if (function_exists('RegisterModuleDependences')) {
            RegisterModuleDependences(
                'main',
                'OnBeforeProlog',
                $this->MODULE_ID,
                'EidosConnector',
                'onBeforeProlog',
                100
            );
            RegisterModuleDependences(
                'iblock',
                'OnAfterIBlockElementDelete',
                $this->MODULE_ID,
                'EidosConnector',
                'onAfterIBlockElementDelete',
                100
            );
            RegisterModuleDependences(
                'iblock',
                'OnAfterIBlockElementUpdate',
                $this->MODULE_ID,
                'EidosConnector',
                'onAfterIBlockElementUpdate',
                100
            );
        }
    }

    public function UnInstallEvents(): void
    {
        if (function_exists('UnRegisterModuleDependences')) {
            UnRegisterModuleDependences(
                'main',
                'OnBeforeProlog',
                $this->MODULE_ID,
                'EidosConnector',
                'onBeforeProlog'
            );
            UnRegisterModuleDependences(
                'iblock',
                'OnAfterIBlockElementDelete',
                $this->MODULE_ID,
                'EidosConnector',
                'onAfterIBlockElementDelete'
            );
            UnRegisterModuleDependences(
                'iblock',
                'OnAfterIBlockElementUpdate',
                $this->MODULE_ID,
                'EidosConnector',
                'onAfterIBlockElementUpdate'
            );
        }
    }

    public function InstallAgents(): void
    {
        if (class_exists('\CAgent')) {
            \CAgent::AddAgent(
                'EidosConnector::syncDeltaAgent();',
                $this->MODULE_ID,
                'N',
                3600,
                '',
                'Y'
            );
        }
    }

    public function UnInstallAgents(): void
    {
        if (class_exists('\CAgent')) {
            \CAgent::RemoveModuleAgents($this->MODULE_ID);
        }
    }
}
