import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { request, type APIRequestContext, type FullConfig } from '@playwright/test'
import {
  adminEmail, adminState, otherEmail, otherState, ownerEmail, ownerState, testPassword,
} from './integration-auth'

async function csrfHeaders(api: APIRequestContext) {
  const response = await api.get('/api/security/csrf-token')
  if (!response.ok()) throw new Error(`CSRF token request failed (${response.status()}).`)
  const { requestToken } = await response.json() as { requestToken: string }
  return { 'X-CSRF-TOKEN': requestToken }
}

async function signIn(api: APIRequestContext, email: string, register: boolean) {
  if (register) {
    const response = await api.post('/api/security/register', {
      headers: await csrfHeaders(api), data: { email, password: testPassword },
    })
    if (response.status() !== 201) {
      throw new Error(`Registering ${email} failed (${response.status()}): ${await response.text()}`)
    }
  }
  const response = await api.post('/api/security/login', {
    headers: await csrfHeaders(api), data: { email, password: testPassword },
  })
  if (response.status() !== 204) {
    throw new Error(`Signing in ${email} failed (${response.status()}): ${await response.text()}`)
  }
}

/**
 * The journeys share a few users, and together they start more import previews in a minute than
 * the production default allows. The limiter has its own backend tests, so lift it for this run.
 */
async function raiseImportAttemptLimit(api: APIRequestContext) {
  const current = await api.get('/api/admin/import-limits')
  if (!current.ok()) throw new Error(`Reading import limits failed (${current.status()}).`)
  const limits = await current.json() as Record<string, number>
  const response = await api.put('/api/admin/import-limits', {
    headers: await csrfHeaders(api),
    data: { ...limits, maxImportAttemptsPerUserPerMinute: 1000 },
  })
  if (!response.ok()) throw new Error(`Raising the import attempt limit failed (${response.status()}).`)
}

/**
 * Runs once after the API and web server are up. Creates the owner, a second user and the
 * bootstrapped administrator through the real API and saves each one's browser state.
 */
export default async function integrationSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) throw new Error('The integration config must set a baseURL.')
  mkdirSync(path.dirname(ownerState), { recursive: true })

  for (const [email, state, register] of [
    [ownerEmail, ownerState, true],
    [otherEmail, otherState, true],
    [adminEmail, adminState, false],
  ] as const) {
    const api = await request.newContext({ baseURL })
    try {
      await signIn(api, email, register)
      if (email === adminEmail) await raiseImportAttemptLimit(api)
      await api.storageState({ path: state })
    } finally {
      await api.dispose()
    }
  }
}
