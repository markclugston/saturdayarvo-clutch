import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['accounts-import.spec.ts', 'categories-groups.spec.ts'],
  grep: /provisions two real API sessions|categories journey/,
  globalTeardown: './e2e/cleanup-test-api.mjs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node e2e/start-test-api.mjs',
      url: 'https://localhost:7180/health/ready',
      timeout: 240_000,
      reuseExistingServer: false,
      gracefulShutdown: {
        signal: 'SIGINT',
        timeout: 10_000,
      },
      ignoreHTTPSErrors: true,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
      env: {
        VITE_API_PROXY_TARGET: 'https://localhost:7180',
      },
    },
  ],
})
