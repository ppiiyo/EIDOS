#!/usr/bin/env python3
"""Add Bitrix element delete/update handlers and deleteCatalogItem to Connector.php."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "packages/connectors/bitrix/src/Connector.php"
s = p.read_text(encoding="utf-8")
if "onAfterIBlockElementDelete" in s:
    print("already applied")
    raise SystemExit(0)

methods = r'''

    /**
     * Bitrix event: element deleted — remove from EIDOS index.
     * @param array<string, mixed> $arFields
     */
    public static function onAfterIBlockElementDelete(array &$arFields): void
    {
        $id = trim((string) ($arFields['ID'] ?? $arFields['id'] ?? ''));
        if ($id === '') {
            return;
        }
        try {
            $connector = isset($GLOBALS['__EIDOS_TEST_CONNECTOR']) && $GLOBALS['__EIDOS_TEST_CONNECTOR'] instanceof self
                ? $GLOBALS['__EIDOS_TEST_CONNECTOR']
                : self::fromBitrixOptions(false);
            $connector->deleteCatalogItem($id);
        } catch (\Throwable $e) {
            if (function_exists('AddMessage2Log')) {
                AddMessage2Log('[EIDOS] onAfterIBlockElementDelete: ' . $e->getMessage(), 'eidos.connector');
            }
        }
    }

    /**
     * Bitrix event: deactivated element removed from EIDOS.
     * @param array<string, mixed> $arFields
     */
    public static function onAfterIBlockElementUpdate(array &$arFields): void
    {
        $id = trim((string) ($arFields['ID'] ?? $arFields['id'] ?? ''));
        if ($id === '') {
            return;
        }
        $active = strtoupper((string) ($arFields['ACTIVE'] ?? 'Y'));
        if ($active !== 'N') {
            return;
        }
        try {
            $connector = isset($GLOBALS['__EIDOS_TEST_CONNECTOR']) && $GLOBALS['__EIDOS_TEST_CONNECTOR'] instanceof self
                ? $GLOBALS['__EIDOS_TEST_CONNECTOR']
                : self::fromBitrixOptions(false);
            $connector->deleteCatalogItem($id);
        } catch (\Throwable $e) {
            if (function_exists('AddMessage2Log')) {
                AddMessage2Log('[EIDOS] onAfterIBlockElementUpdate: ' . $e->getMessage(), 'eidos.connector');
            }
        }
    }

    /**
     * DELETE /v1/catalog/items/:id against EIDOS API.
     */
    public function deleteCatalogItem(string $id): void
    {
        $cleanId = trim($id);
        if ($cleanId === '') {
            return;
        }
        try {
            $this->httpClient->request('DELETE', '/v1/catalog/items/' . rawurlencode($cleanId), null, 10.0);
        } catch (\Throwable $e) {
            $this->httpClient->logError('deleteCatalogItem', $e->getMessage());
            throw $e;
        }
        if (method_exists($this->searchReplacer, 'markItemDeletedInBitrix')) {
            $this->searchReplacer->markItemDeletedInBitrix($cleanId);
        }
    }
'''
idx = s.rstrip().rfind('}')
if idx < 0:
    raise SystemExit('class end not found')
s = s[:idx] + methods + '\n}\n'
p.write_text(s, encoding='utf-8')
print('written', p)
