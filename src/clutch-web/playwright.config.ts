import { defineConfig, devices } from '@playwright/test'

const webPort = process.env.CLUTCH_E2E_WEB_PORT ?? '5173'

export default defineConfig({
  testDir: './e2e',
  // The style guide has its own config. The live-backend journeys run in playwright.integration.config.ts.
  testIgnore: [
    'style-guide.spec.ts',
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
  fullyParallel: true,
  // Several journeys are animation- and layout-heavy; more workers starve them and break the wall-clock assertions.
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${webPort}`,
    storageState: process.env.PLAYWRIGHT_STORAGE_STATE,
    trace: 'retain-on-failure',
    // Journeys must not depend on animation timing (FR-012 transitions are checked in style-guide.spec.ts).
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
    url: `http://127.0.0.1:${webPort}`,
    reuseExistingServer: !process.env.CI && !process.env.CLUTCH_E2E_WEB_PORT,
  },
})
