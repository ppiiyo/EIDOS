import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const widgetScript = fs.readFileSync(path.resolve(process.cwd(), 'public/widget.js'), 'utf8');

test.describe('Storefront Widget v4.0.0 Security & ARIA E2E', () => {
  test('refuses to mount when given a privileged master/admin key (eidos_mk_ / eidos_ak_ / eidos_dev_key)', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <input type="search" id="store-search" />
        </body>
      </html>
    `);
    await page.addScriptTag({ content: widgetScript });

    const mountedWithMaster = await page.evaluate(() => {
      return (window as any).EidosSearchWidget.init({
        apiUrl: 'http://localhost:8080',
        apiKey: 'eidos_mk_secret_master_key',
        inputSelector: '#store-search',
      });
    });
    expect(mountedWithMaster).toBeNull();

    const mountedWithDev = await page.evaluate(() => {
      return (window as any).EidosSearchWidget.init({
        apiUrl: 'http://localhost:8080',
        apiKey: 'eidos_dev_key',
        inputSelector: '#store-search',
      });
    });
    expect(mountedWithDev).toBeNull();
  });

  test('mounts with public key (eidos_pk_*), sanitizes javascript: URLs and <script> in highlights, and supports ARIA keyboard navigation', async ({ page }) => {
    await page.route('**/v1/suggest', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 'xss-1',
              title: 'Sony WH-1000XM5',
              category: 'Наушники',
              brand: 'Sony',
              price: 29990,
              url: 'javascript:window.__xssTriggered=true',
              imageUrl: 'javascript:alert(1)',
              highlights: {
                title: '<em>Sony</em> <img src=x onerror="window.__xssTriggered=true"> WH-1000XM5',
              },
            },
            {
              id: 'safe-2',
              title: 'Bose QuietComfort Ultra',
              category: 'Наушники',
              brand: 'Bose',
              price: 32990,
              url: '/product/safe-2',
              highlights: {
                title: '<em>Bose</em> QuietComfort Ultra',
              },
            },
          ],
          meta: { latencyMs: 1.8 },
        }),
      });
    });

    await page.setContent(`
      <html>
        <body>
          <input type="search" id="store-search" />
        </body>
      </html>
    `);
    await page.addScriptTag({ content: widgetScript });

    await page.evaluate(() => {
      (window as any).EidosSearchWidget.init({
        apiUrl: 'http://localhost:8080',
        apiKey: 'eidos_pk_public_storefront_key_123456',
        inputSelector: '#store-search',
        minChars: 2,
      });
    });

    const input = page.locator('#store-search');
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-expanded', 'false');

    await input.fill('sony');
    const listbox = page.locator('[role="listbox"]');
    await expect(listbox).toBeVisible();
    await expect(input).toHaveAttribute('aria-expanded', 'true');

    const firstOption = listbox.locator('[role="option"]').first();
    // javascript: URL must be neutralized to safe fallback
    await expect(firstOption).toHaveAttribute('href', '/product/xss-1');

    // <img onerror> inside highlights.title must be rendered as inert text, never as an element
    const injectedImgCount = await firstOption.locator('.eidos-widget-title img').count();
    expect(injectedImgCount).toBe(0);
    await expect(firstOption.locator('em.eidos-hl')).toHaveText('Sony');

    const xssTriggered = await page.evaluate(() => Boolean((window as any).__xssTriggered));
    expect(xssTriggered).toBe(false);

    // Keyboard navigation: ArrowDown selects first option, Escape closes dropdown
    await input.press('ArrowDown');
    await expect(firstOption).toHaveAttribute('aria-selected', 'true');

    await input.press('Escape');
    await expect(listbox).toBeHidden();
    await expect(input).toHaveAttribute('aria-expanded', 'false');
  });
});
