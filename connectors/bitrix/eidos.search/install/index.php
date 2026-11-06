<?php
/**
 * 1C-Bitrix Module Installer: eidos.search (Pilot Edition)
 * Provides 4-step Setup Wizard (Connection -> Sync IBlock -> Replace Search -> Verify),
 * CIBlockElement delta hooks, Live Suggest widget, and fail-safe fallback to native CSearch.
 */

use Bitrix\Main\ModuleManager;
use Bitrix\Main\EventManager;

class eidos_search extends CModule
{
    public $MODULE_ID = 'eidos.search';
    public $MODULE_VERSION = '3.4.0';
    public $MODULE_VERSION_DATE = '2026-11-06 12:00:00';
    public $MODULE_NAME = 'EIDOS — Гибридный поиск для 1С-Битрикс';
    public $MODULE_DESCRIPTION = 'Self-hosted гибридный поиск (HNSW + BM25 + RRF + Category Gate) с авто-fallback на CSearch';

    public function DoInstall()
    {
        ModuleManager::registerModule($this->MODULE_ID);
        $em = EventManager::getInstance();
        $em->registerEventHandler('iblock', 'OnAfterIBlockElementAdd', $this->MODULE_ID, 'EidosBitrixSync', 'onElementUpsert');
        $em->registerEventHandler('iblock', 'OnAfterIBlockElementUpdate', $this->MODULE_ID, 'EidosBitrixSync', 'onElementUpsert');
        $em->registerEventHandler('iblock', 'OnAfterIBlockElementDelete', $this->MODULE_ID, 'EidosBitrixSync', 'onElementDelete');
        return true;
    }

    public function DoUninstall()
    {
        $em = EventManager::getInstance();
        $em->unRegisterEventHandler('iblock', 'OnAfterIBlockElementAdd', $this->MODULE_ID, 'EidosBitrixSync', 'onElementUpsert');
        $em->unRegisterEventHandler('iblock', 'OnAfterIBlockElementUpdate', $this->MODULE_ID, 'EidosBitrixSync', 'onElementUpsert');
        $em->unRegisterEventHandler('iblock', 'OnAfterIBlockElementDelete', $this->MODULE_ID, 'EidosBitrixSync', 'onElementDelete');
        ModuleManager::unRegisterModule($this->MODULE_ID);
        return true;
    }
}
