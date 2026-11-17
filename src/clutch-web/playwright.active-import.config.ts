import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { defineConfig, devices } from '@playwright/test'

process.env.CLUTCH_E2E_RESOURCE_NAME ??= `active-import-${randomUUID()}`
process.env.CLUTCH_E2E_WEB_PORT ??= String(await availablePort())
process.env.CLUTCH_E2E_API_PORT ??= String(await availablePort())
const webPort = process.env.CLUTCH_E2E_WEB_PORT
const apiPort = process.env.CLUTCH_E2E_API_PORT

export default defineConfig({
  testDir: './e2e',
  testMatch: 'active-import.spec.ts',
  workers: 1,
  timeout: 60_000,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  globalTeardown: './e2e/cleanup-test-api.mjs',
  use: { baseURL: `http://localhost:${webPort}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/start-test-api.mjs',
      url: `https://localhost:${apiPort}/health/ready`,
      timeout: 240_000,
      reuseExistingServer: false,
      ignoreHTTPSErrors: true,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: `https://localhost:${apiPort}` },
    },
  ],
})

async function availablePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  if (!address || typeof address === 'string') throw new Error('No isolated browser-test port available.')
  return address.port
}
