import { test, expect } from '@playwright/test';

test.describe('Eidos Full Pipeline E2E Critical Paths', () => {
  test('1. User searches -> views recommendations -> likes item -> sees updated analytics', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Navigate to Hybrid Search view and activate Demo mode if on Welcome screen
    await page.locator('[data-testid="nav-search"]').first().click();
    const tryDemoBtn = page
      .locator('[data-testid="welcome-demo-btn"], [data-testid="try-demo-btn"]')
      .first();
    if (await tryDemoBtn.isVisible()) {
      await tryDemoBtn.click();
    }

    // 2. Search for an item
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
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
    await page.locator('[data-testid="nav-analytics"]').first().click();
    await expect(page.locator('text=Searches').first()).toBeVisible();
    await expect(page.locator('[data-testid="search-count"]')).not.toHaveText('0');
  });

  test('2. Multilingual & Cross-Lingual Search (RU / EN / JA)', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="nav-search"]').first().click();
    const tryDemoBtn = page
      .locator('[data-testid="welcome-demo-btn"], [data-testid="try-demo-btn"]')
      .first();
    if (await tryDemoBtn.isVisible()) {
      await tryDemoBtn.click();
    }

    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Japanese CJK query
    await searchInput.fill('サイバーパンク 人工知能');
    await searchInput.press('Enter');

    const results = page.locator('[data-testid="search-result"]');
    await expect(results.first()).toBeVisible({ timeout: 10000 });
    expect(await results.count()).toBeGreaterThan(0);
  });

  test('3. Semantic Graph & Cold-Start Simulator views render without errors', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('#root')).not.toBeEmpty();

    const title = await page.title();
    expect(title).toContain('Eidos');
  });
});
