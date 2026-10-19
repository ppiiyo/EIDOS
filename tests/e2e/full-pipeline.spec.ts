import { test, expect } from '@playwright/test';

test.describe('Full EIDOS Pipeline', () => {
  test('ingest → search → recommend → feedback', async ({ page }) => {
    // 1. Open workspace
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('EIDOS');

    // 2. Navigate to Catalog
    await page.click('text=Catalog');
    await expect(page.locator('[data-testid="catalog-table"]')).toBeVisible();

    // 3. Search
    await page.click('text=Search');
    await page.fill('[data-testid="search-input"]', 'mechanical keyboard');
    await page.click('button:has-text("Search")');

    const results = page.locator('[data-testid="search-result"]');
    await expect(results.first()).toBeVisible();
    await expect(results).toHaveCount(await results.count());

    // 4. Get recommendations for first result
    await page.click('text=Recommendations');
    await page.selectOption('[data-testid="item-select"]', { index: 1 });
    await page.click('button:has-text("Get Recommendations")');

    const recommendations = page.locator('[data-testid="recommendation-card"]');
    await expect(recommendations.first()).toBeVisible();

    // 5. Verify analytics tracked the events
    await page.click('text=Analytics');
    await expect(page.locator('text=Searches')).toBeVisible();
    await expect(page.locator('[data-testid="search-count"]')).not.toHaveText('0');
  });
});
