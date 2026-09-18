import { test, expect } from '@playwright/test';

test.describe('EIDOS Interactive Demo Workflow', () => {
  test('executes catalog loading, graph rendering, recommendation selection and search', async ({ page }) => {
    // Navigate to local demo application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // 1. Verify Catalog renders
    const catalogHeader = page.locator('#catalog-section');
    await expect(catalogHeader).toBeVisible();

    // 2. Select an item for semantic recommendations
    const firstProductCard = page.locator('.product-card').first();
    await firstProductCard.click();

    // 3. Inspect semantic recommendations list
    const recSection = page.locator('#recommendations-section');
    await expect(recSection).toBeVisible();

    // 4. Test Semantic Search
    const searchInput = page.locator('#semantic-search-input');
    await searchInput.fill('ergonomic workspace mechanical typing');
    await page.keyboard.press('Enter');

    // Verify search results appear
    const searchResults = page.locator('.search-result-item');
    await expect(searchResults.first()).toBeVisible({ timeout: 10000 });

    // 5. Toggle Graph View
    const graphTab = page.locator('#tab-graph');
    if (await graphTab.isVisible()) {
      await graphTab.click();
      const canvas = page.locator('#semantic-graph-canvas');
      await expect(canvas).toBeVisible();
    }
  });
});
