import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: __dirname,
  testMatch: 'payment-flow.spec.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../output/playwright/report' }]],
  outputDir: '../output/playwright/test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
});
