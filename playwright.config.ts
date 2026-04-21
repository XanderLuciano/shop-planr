import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for Shop Planr e2e tests.
 *
 * Scope: business-critical flows only (auth, job/path/part CRUD, advancement).
 * See TESTING.md for standards.
 *
 * - Isolates from the dev DB by pointing the server at ./data/test.db
 * - Wipes + re-seeds the test DB before the suite via global-setup.ts
 * - Auto-starts `nuxt dev` via webServer
 */
const PORT = Number(process.env.E2E_PORT ?? 3100)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/e2e/global-setup.ts',

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 7_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    env: {
      DB_PATH: './data/test.db',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      NUXT_DEVTOOLS_ENABLED: 'false',
      // e2e fires many logins during the suite — the brute-force limiter
      // (6/15s) would trip. Server honours this flag only in test/dev.
      RATE_LIMIT_DISABLED: 'true',
    },
    // Poll the /api/users endpoint — `/` returns 426 while Nuxt dev is still
    // warming up, but the Nitro server answers API routes as soon as it's
    // ready, which is what the tests actually need.
    url: `${BASE_URL}/api/users`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
