import { defineConfig } from '@playwright/test';

// PW_PORT lets parallel checkouts (git worktrees) each serve their own dist without reusing another's server.
const PORT = process.env.PW_PORT ?? '8788';

export default defineConfig({
  testDir: './e2e',
  // Spread individual tests (not whole files) across workers and CI shards: the sweep specs are heavy.
  fullyParallel: true,
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npx wrangler pages dev dist --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      XDG_CONFIG_HOME: '.wrangler/config',
      WRANGLER_LOG_PATH: '.wrangler/logs',
    },
  },
});
