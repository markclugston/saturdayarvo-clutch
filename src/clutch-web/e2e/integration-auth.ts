import os from 'node:os'
import path from 'node:path'

// Disposable credentials for the throwaway SQL Server and API that start-test-api.mjs creates.
// They never reach a real environment. Values are fixed because the config is loaded again in
// every worker and must resolve to the same paths and accounts each time.
export const testPassword = 'Clutch-E2e!Password-2026'
export const ownerEmail = 'integration-owner@example.test'
export const otherEmail = 'integration-other@example.test'
export const adminEmail = 'integration-admin@example.test'

const authDirectory = path.join(os.tmpdir(), 'clutch-e2e-integration-auth')
export const ownerState = path.join(authDirectory, 'owner.json')
export const otherState = path.join(authDirectory, 'other.json')
export const adminState = path.join(authDirectory, 'admin.json')

/** Points the specs that expect saved sign-in state at the files global setup writes. */
export function useIntegrationEnvironment() {
  process.env.CLUTCH_E2E_RESOURCE_NAME ??= 'integration'
  process.env.CLUTCH_E2E_ADMIN_EMAIL = adminEmail
  process.env.CLUTCH_E2E_ADMIN_PASSWORD = testPassword
  process.env.PLAYWRIGHT_STORAGE_STATE = ownerState
  process.env.PLAYWRIGHT_OTHER_STORAGE_STATE = otherState
  process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE = adminState
}
