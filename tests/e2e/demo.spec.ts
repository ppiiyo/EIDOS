import { test, expect } from '@playwright/test';

test.describe('EIDOS Demo App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads the catalog', async ({ page }) => {
    await expect(page.locator('[data-testid="catalog"]')).toBeVisible();
    const items = page.locator('[data-testid="item-card"]');
    await expect(items.first()).toBeVisible();
  });

  test('builds semantic graph on button click', async ({ page }) => {
    await page.click('[data-testid="btn-build-graph"]');
    await expect(page.locator('[data-testid="graph-preview"]')).toContainText('%', {
      timeout: 60000,
    });
  });

  test('semantic search returns results', async ({ page }) => {
    await page.click('[data-testid="btn-build-graph"]');
    await page.waitForTimeout(1000);
    await page.fill('[data-testid="search-input"]', 'cyberpunk');
    await page.press('[data-testid="search-input"]', 'Enter');
    await expect(page.locator('[data-testid="rec-item"]').first()).toBeVisible({ timeout: 20000 });
  });

  test('clicking item shows recommendations', async ({ page }) => {
    await page.click('[data-testid="btn-build-graph"]');
    await page.waitForTimeout(1000);
    await page.click('[data-testid="item-card"]', { position: { x: 10, y: 10 } });
    await expect(page.locator('[data-testid="rec-item"]').first()).toBeVisible({ timeout: 20000 });
  });
});
