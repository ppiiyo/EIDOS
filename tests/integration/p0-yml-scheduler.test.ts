import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYmlOrCommerceMl } from '../../apps/api/src/services/yml-parser';
import { YmlSyncScheduler } from '../../apps/api/src/services/yml-sync-scheduler';
import { resetPersistenceStoreForTests } from '../../apps/api/src/services/persistence-store';

describe('Patch 12: YML Parser & Background Scheduler', () => {
  beforeEach(() => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eidos-yml-sched-'));
    resetPersistenceStoreForTests(tmp);
    YmlSyncScheduler.resetInstanceForTests();
  });

  it('parses Yandex.Market YML offers including picture, url, vendorCode, and available attribute', () => {
    const sampleYml = `<?xml version="1.0" encoding="UTF-8"?>
      <yml_catalog date="2026-04-01 12:00">
        <shop>
          <categories>
            <category id="10">Наушники и аудио</category>
          </categories>
          <offers>
            <offer id="sku-900" available="true">
              <name>WH-1000XM5</name>
              <vendor>Sony</vendor>
              <vendorCode>SNY-XM5</vendorCode>
              <price>29990</price>
              <categoryId>10</categoryId>
              <url>https://shop.example.com/item/900</url>
              <picture>https://shop.example.com/img/900.jpg</picture>
              <description><![CDATA[Флагманские наушники с ANC]]></description>
            </offer>
          </offers>
        </shop>
      </yml_catalog>`;

    const items = parseYmlOrCommerceMl(sampleYml);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'sku-900',
      title: 'Sony WH-1000XM5',
      brand: 'Sony',
      sku: 'SNY-XM5',
      category: 'Наушники и аудио',
      price: 29990,
      inStock: true,
      url: 'https://shop.example.com/item/900',
      imageUrl: 'https://shop.example.com/img/900.jpg',
    });
  });

  it('persists YML schedule config across scheduler restarts and blocks SSRF feed URLs on runNow', async () => {
    const sched1 = YmlSyncScheduler.getInstance();
    sched1.upsertConfig({
      tenantId: 'pilot-store',
      indexName: 'default',
      feedUrl: 'http://127.0.0.1:8080/internal-secret.xml',
      enabled: true,
      intervalMinutes: 60,
      authoritativeDelete: true,
    });

    // Simulate restart
    const sched2 = YmlSyncScheduler.resetInstanceForTests();
    const restored = sched2.getConfig('pilot-store', 'default');
    expect(restored.enabled).toBe(true);
    expect(restored.intervalMinutes).toBe(60);
    expect(restored.authoritativeDelete).toBe(true);

    // Running against loopback URL must be blocked by safeFetchText
    await expect(sched2.runNow('pilot-store', 'default')).rejects.toThrow(/SSRF_BLOCKED/);

    const afterError = sched2.getConfig('pilot-store', 'default');
    expect(afterError.lastStatus).toBe('error');
    expect(afterError.lastError).toMatch(/SSRF_BLOCKED/);
  });
});
