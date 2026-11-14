import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:8788',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npx wrangler pages dev dist --port 8788',
    url: 'http://127.0.0.1:8788/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
