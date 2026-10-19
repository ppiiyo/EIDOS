import { test, expect } from '@playwright/test';

test.describe('Eidos Full Pipeline E2E', () => {
  test('user searches -> views recommendations -> likes item -> sees updated analytics', async ({ page }) => {
    await page.goto('/');

    // 1. Navigate to Hybrid Search view
    await page.locator('aside button:has-text("Hybrid Search")').first().click();

    // 2. Search for an item
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('camera');
    await searchInput.press('Enter');

    // Wait for results
    const results = page.locator('[data-testid="search-result"]');
    await expect(results.first()).toBeVisible({ timeout: 10000 });
    expect(await results.count()).toBeGreaterThan(0);

    // 3. Click first result to open MMR Recommendations
    await results.first().click();
    const recPanel = page.locator('[data-testid="recommendations-panel"]');
    await expect(recPanel).toBeVisible();

    // 4. Like a recommendation
    const likeButton = page.locator('[data-testid="like-button"]').first();
    await expect(likeButton).toBeVisible();
    await likeButton.click();

    // 5. Verify analytics tracked the events
    await page.locator('aside button:has-text("Analytics")').first().click();
    await expect(page.locator('text=Searches').first()).toBeVisible();
    await expect(page.locator('[data-testid="search-count"]')).not.toHaveText('0');
  });
});
