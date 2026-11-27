import { defineConfig, devices } from '@playwright/test'
import { ownerState, useIntegrationEnvironment } from './e2e/integration-auth'

useIntegrationEnvironment()

// One disposable SQL Server and API serve every browser journey that needs a real backend, so
// the container, certificate and migrations are set up once instead of once per config.
// Run with: npm run test:e2e:integration (needs Docker, the .NET SDK and ports 5173 and 7180).
export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'accounts-import.spec.ts',
    'accounts-transaction-delete.spec.ts',
    'active-import.spec.ts',
    'admin-import-limits.spec.ts',
    'asset-edit-lease.spec.ts',
    'categories-groups.spec.ts',
    'import-settings.spec.ts',
    'mortgages.spec.ts',
    'theme-selector.spec.ts',
  ],
  globalSetup: './e2e/integration-setup.ts',
  globalTeardown: './e2e/cleanup-test-api.mjs',
  // The journeys share one database, the administrator changes global limits and several assert
  // response times, so they run one at a time.
  workers: 1,
  timeout: 60_000,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    reducedMotion: 'reduce',
    // Pages opened with the plain `page` fixture start signed in as the owner.
    storageState: ownerState,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/start-test-api.mjs',
      url: 'https://localhost:7180/health/ready',
      timeout: 240_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGINT', timeout: 10_000 },
      ignoreHTTPSErrors: true,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: 'https://localhost:7180' },
    },
  ],
})
