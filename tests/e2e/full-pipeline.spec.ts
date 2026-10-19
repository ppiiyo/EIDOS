import { test, expect } from '@playwright/test';

test.describe('Full EIDOS Pipeline', () => {
  test('ingest → search → recommend → feedback', async ({ page }) => {
    // 1. Open workspace
    await page.goto('/');
    await expect(page.locator('h1').first()).toContainText('EIDOS');

    // 2. Navigate to Catalog
    await page.locator('aside button:has-text("Catalog")').first().click();
    await expect(page.locator('[data-testid="catalog-table"]')).toBeVisible();

    // 3. Search
    await page.locator('aside button:has-text("Search")').first().click();
    await page.fill('[data-testid="search-input"]', 'mechanical keyboard');
    await page.locator('form button[type="submit"]').first().click();

    const results = page.locator('[data-testid="search-result"]');
    await expect(results.first()).toBeVisible();
    await expect(results).toHaveCount(await results.count());

    // 4. Get recommendations for first result
    await page.locator('aside button:has-text("Recommendations")').first().click();
    await page.selectOption('[data-testid="item-select"]', { index: 1 });
    await page.locator('button:has-text("Get Recommendations")').first().click();

    const recommendations = page.locator('[data-testid="recommendation-card"]');
    await expect(recommendations.first()).toBeVisible();

    // 5. Verify analytics tracked the events
    await page.locator('aside button:has-text("Analytics")').first().click();
    await expect(page.locator('text=Searches').first()).toBeVisible();
    await expect(page.locator('[data-testid="search-count"]')).not.toHaveText('0');
  });
});
