import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173' },
    },
  ],
  webServer: [
    {
      command: 'PORT=4173 npx tsx server.ts',
      url: 'http://127.0.0.1:4173/v1/health/live',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
