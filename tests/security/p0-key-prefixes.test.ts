import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApiKeyManager } from '../../apps/api/src/services/api-key-manager';
import { resetPersistenceStoreForTests } from '../../apps/api/src/services/persistence-store';

describe('Patch 13: Canonical v4 API Key Prefixes', () => {
  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-keys-prefix-'));
    resetPersistenceStoreForTests(tmp);
    ApiKeyManager.resetInstance();
  });

  it('issues distinct canonical prefixes for master, admin, search, and merchandiser roles', () => {
    const km = ApiKeyManager.getInstance();

    const masterKey = km.generateKey({ role: 'master', tenantId: 'default' });
    const adminKey = km.generateKey({ role: 'admin', tenantId: 'default' });
    const searchKey = km.generateKey({ role: 'search', tenantId: 'default' });
    const merchKey = km.generateKey({ role: 'merchandiser', tenantId: 'default' });

    expect(masterKey.key.startsWith('eidos_mk_')).toBe(true);
    expect(adminKey.key.startsWith('eidos_ak_')).toBe(true);
    expect(searchKey.key.startsWith('eidos_pk_')).toBe(true);
    expect(merchKey.key.startsWith('eidos_merch_')).toBe(true);
  });
});
