import { defineConfig, devices } from '@playwright/test';
import { API_URL } from './e2e/support/env';

/**
 * Browser tests against the production shape: the built API serves the built web app on one
 * origin, and a mock Telegram Bot API stands in for Telegram (e2e/support/start-stack.ts).
 * Run `npm run build` first.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: API_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', testIgnore: /mobile\.spec\.ts/, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testMatch: /mobile\.spec\.ts/, use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node e2e/support/start-stack.ts',
    url: `${API_URL}/api/v1/health/ready`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
  },
});
