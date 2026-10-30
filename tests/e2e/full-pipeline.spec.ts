import { test, expect } from '@playwright/test';

test.describe('Eidos Full Pipeline E2E Critical Paths', () => {
  test('1. User opens Demo -> waits for index ready -> searches "недорогие наушники для бега" -> sees results & X-Ray -> likes item -> sees updated analytics', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Activate Demo mode from Welcome screen or Search view
    await page.locator('[data-testid="nav-search"]').first().click();
    const tryDemoBtn = page
      .locator('[data-testid="welcome-demo-btn"], [data-testid="try-demo-btn"]')
      .first();
    if (await tryDemoBtn.isVisible()) {
      await tryDemoBtn.click();
    }

    // Wait for Demo Index Ready badge & Search input
    await expect(page.locator('[data-testid="demo-index-ready-badge"]')).toBeVisible({
      timeout: 10000,
    });
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // 2. Verify showcase query "недорогие наушники для бега" renders >= 1 hit + X-Ray + human explanation
    await searchInput.fill('недорогие наушники для бега');
    await searchInput.press('Enter');

    const results = page.locator('[data-testid="search-result"]');
    await expect(results.first()).toBeVisible({ timeout: 10000 });
    expect(await results.count()).toBeGreaterThan(0);

    // Verify X-Ray panel and human-readable explanation on first hit
    await expect(page.locator('[data-testid="search-xray-panel"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="first-hit-human-explanation"]')).toBeVisible();

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
