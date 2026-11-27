import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'

/* 029: the asset edit lease between two real sessions of one user (FR-020). */

test.skip(!process.env.CLUTCH_E2E_RESOURCE_NAME, 'Run with playwright.integration.config.ts for isolated API/SQL Server.')

async function csrf(context: BrowserContext) {
  const response = await context.request.get('/api/security/csrf-token')
  expect(response.ok(), await response.text()).toBeTruthy()
  const { requestToken } = await response.json() as { requestToken: string }
  return { 'X-CSRF-TOKEN': requestToken }
}

async function signIn(context: BrowserContext, email: string, password: string, register: boolean) {
  const headers = await csrf(context)
  if (register) {
    const response = await context.request.post('/api/security/register', { headers, data: { email, password } })
    expect(response.status(), await response.text()).toBe(201)
  }
  const response = await context.request.post('/api/security/login', { headers, data: { email, password } })
  expect(response.status(), await response.text()).toBe(204)
}

async function createAsset(context: BrowserContext, name: string) {
  const response = await context.request.post('/api/assets', {
    headers: await csrf(context),
    data: {
      name, description: null, currencyCode: 'AUD',
      valuations: [{ value: 1000, valuationDate: '2026-01-01' }],
    },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json() as { id: string }).id
}

/** Moves an asset's active edit past its expiry in the disposable database. */
function expireActiveEdit(assetId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) throw new Error('Invalid asset id.')
  const query = `SET NOCOUNT ON; UPDATE AssetEdits SET ExpiresAtUtc = DATEADD(SECOND, -1, SYSUTCDATETIME()) WHERE AssetId = '${assetId}' AND State = 'Active'; SELECT @@ROWCOUNT;`
  // The container's own password variable is read inside the container, so it never appears here.
  const output = execFileSync('docker', [
    'exec', '--env', `CLUTCH_QUERY=${query}`,
    `clutch-e2e-sql-${process.env.CLUTCH_E2E_RESOURCE_NAME}`,
    'bash', '-c',
    '/opt/mssql-tools18/bin/sqlcmd -C -b -h -1 -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -d ClutchE2E -Q "$CLUTCH_QUERY"',
  ], { encoding: 'utf8' })
  expect(output.trim()).toBe('1')
}

const nameField = (page: Page) => page.getByLabel('Name', { exact: true })

async function openAsset(page: Page, name: string) {
  await page.goto('/assets')
  await page.getByRole('button', { name, exact: true }).click()
}

test('one session edits at a time, and the other can end it', async ({ browser, baseURL }) => {
  const first = await browser.newContext({ baseURL })
  const second = await browser.newContext({ baseURL })
  try {
    const email = `owner-${randomUUID()}@example.test`
    const password = `Clutch!${randomUUID()}Aa9`
    await signIn(first, email, password, true)
    await signIn(second, email, password, false)
    const name = `Leased ${randomUUID().slice(0, 8)}`
    const assetId = await createAsset(first, name)

    const holder = await first.newPage()
    await openAsset(holder, name)
    await expect(nameField(holder)).toHaveValue(name)
    await nameField(holder).fill(`${name} unsaved`)

    const other = await second.newPage()
    await openAsset(other, name)
    await expect(other.getByText('This asset is being edited in another session.')).toBeVisible()
    await expect(nameField(other)).toHaveCount(0)

    await other.getByRole('button', { name: 'End Other Edit' }).click()
    const endedAt = Date.now()
    const ended = holder.getByRole('alertdialog', { name: 'Edit Ended' })
    await expect(ended).toBeVisible({ timeout: 5000 })
    expect(Date.now() - endedAt).toBeLessThanOrEqual(5000)
    await expect(ended).toContainText(email)
    await holder.keyboard.press('Escape')
    await expect(ended).toBeVisible()

    await expect(nameField(other)).toHaveValue(name, { timeout: 5000 })
    await ended.getByRole('button', { name: 'Return To Assets' }).click()
    await expect(holder.getByRole('button', { name, exact: true })).toBeVisible()

    // The ended edit stored nothing, and the new holder's save is stored.
    await nameField(other).fill(`${name} saved`)
    await other.getByRole('button', { name: 'Save' }).click()
    await expect(other.getByRole('button', { name: `${name} saved`, exact: true })).toBeVisible()

    // A reload releases the edit as the page unloads, so the asset opens again.
    await openAsset(other, `${name} saved`)
    await expect(nameField(other)).toHaveValue(`${name} saved`)
    await other.reload()
    await expect(nameField(other)).toHaveValue(`${name} saved`, { timeout: 10_000 })
    await other.getByRole('button', { name: 'Cancel' }).click()

    // Leaving released it, so the first session opens it straight away.
    await openAsset(holder, `${name} saved`)
    await expect(nameField(holder)).toBeVisible({ timeout: 5000 })

    const status = await first.request.get(`/api/assets/${assetId}/edit-status`)
    expect(await status.json()).toMatchObject({ availability: 'Blocked' })
  } finally {
    await first.close()
    await second.close()
  }
})

test('an expired edit returns to the list with a message that stays', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL })
  try {
    const email = `owner-${randomUUID()}@example.test`
    await signIn(context, email, `Clutch!${randomUUID()}Aa9`, true)
    const name = `Expiring ${randomUUID().slice(0, 8)}`
    const assetId = await createAsset(context, name)
    await createAsset(context, 'Spare')

    const page = await context.newPage()
    await openAsset(page, name)
    await expect(nameField(page)).toHaveValue(name)
    await nameField(page).fill(`${name} unsaved`)

    expireActiveEdit(assetId)

    const persistent = page.getByRole('region', { name: 'Persistent notifications' })
    await expect(persistent.getByRole('status'))
      .toContainText(`Your edit of ${name} expired.`, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/assets$/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible()

    // Other toasts come and go above it.
    await page.getByRole('button', { name: 'Delete Spare' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
    const regular = page.getByRole('region', { name: 'Notifications', exact: true })
    await expect(regular.getByRole('status')).toContainText('Spare was deleted.')
    await page.mouse.move(5, 5)
    await expect(regular.getByRole('status')).toHaveCount(0, { timeout: 15_000 })
    await expect(persistent.getByRole('status')).toBeVisible()
    await persistent.getByRole('button', { name: 'Dismiss' }).click()
    await expect(persistent.getByRole('status')).toHaveCount(0)

    // The expired edit no longer blocks.
    await page.getByRole('button', { name, exact: true }).click()
    await expect(nameField(page)).toHaveValue(name)
  } finally {
    await context.close()
  }
})
