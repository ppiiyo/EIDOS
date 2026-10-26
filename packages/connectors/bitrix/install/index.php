<?php

declare(strict_types=1);

use Bitrix\Main\Localization\Loc;

if (class_exists('\Bitrix\Main\Localization\Loc')) {
    Loc::loadMessages(__FILE__);
}

/**
 * Установщик модуля eidos.connector для 1С-Битрикс.
 * Регистрирует модуль, копирует компонент eidos:search.page, обработчик /bitrix/tools/eidos_feedback.php
 * и регистрирует ежечасный агент CAgent для инкрементальной синхронизации (syncDelta).
 */
class eidos_connector extends CModule
{
    public $MODULE_ID = 'eidos.connector';
    public $MODULE_VERSION;
    public $MODULE_VERSION_DATE;
    public $MODULE_NAME = 'EIDOS: Гибридный поиск и рекомендации';
    public $MODULE_DESCRIPTION = 'Коннектор гибридного поиска и рекомендаций EIDOS (BM25 + векторный поиск + переранжирование) с автоматическим fallback на поиск 1С-Битрикс.';
    public $PARTNER_NAME = 'EIDOS';
    public $PARTNER_URI = 'https://github.com/ppiiyo/EIDOS';

    public function __construct()
    {
        $arModuleVersion = [];
        include __DIR__ . '/version.php';

        $this->MODULE_VERSION = $arModuleVersion['VERSION'] ?? '1.0.0';
        $this->MODULE_VERSION_DATE = $arModuleVersion['VERSION_DATE'] ?? '2026-10-26 12:00:00';
    }

    public function DoInstall(): bool
    {
        if (function_exists('RegisterModule')) {
            RegisterModule($this->MODULE_ID);
        }

        $this->InstallFiles();
        $this->InstallEvents();
        $this->InstallAgents();

        return true;
    }

    public function DoUninstall(): bool
    {
        $this->UnInstallAgents();
        $this->UnInstallEvents();
        $this->UnInstallFiles();

        if (function_exists('UnRegisterModule')) {
            UnRegisterModule($this->MODULE_ID);
        }

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

    public function InstallFiles(): bool
    {
        $docRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
        if ($docRoot === '' || !function_exists('CopyDirFiles')) {
            return true;
        }

        $moduleRoot = dirname(__DIR__);

        // Копируем кастомный компонент поиска eidos:search.page
        CopyDirFiles(
            $moduleRoot . '/components',
            $docRoot . '/bitrix/components',
            true,
            true
        );

        // Копируем endpoint для неблокирующего приёма кликов (navigator.sendBeacon)
        CopyDirFiles(
            $moduleRoot . '/tools',
            $docRoot . '/bitrix/tools',
            true,
            true
        );

        return true;
    }

    public function UnInstallFiles(): bool
    {
        $docRoot = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/');
        if ($docRoot === '') {
            return true;
        }

        $feedbackTool = $docRoot . '/bitrix/tools/eidos_feedback.php';
        if (is_file($feedbackTool)) {
            @unlink($feedbackTool);
        }

        return true;
    }
}
