import { randomUUID } from 'node:crypto'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.skip(!process.env.CLUTCH_E2E_RESOURCE_NAME, 'Run with playwright.active-import.config.ts for isolated API/SQL Server.')

const mapping = {
  dateColumn: 0, descriptionColumn: 1, dateFormat: 'yyyy-MM-dd',
  amountMode: 'Signed', signedAmountColumn: 2, incomingSign: 'Positive',
  numberFormat: 'dot-decimal-comma-grouping',
}

async function csrf(context: BrowserContext) {
  const response = await context.request.get('/api/security/csrf-token')
  expect(response.ok(), await response.text()).toBeTruthy()
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('requestToken' in body) || typeof body.requestToken !== 'string') {
    throw new Error('Invalid CSRF response.')
  }
  return { 'X-CSRF-TOKEN': body.requestToken }
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

async function createPreview(context: BrowserContext, accountId: string) {
  const response = await context.request.post(`/api/accounts/${accountId}/import-reviews`, {
    headers: await csrf(context),
    multipart: {
      mapping: JSON.stringify(mapping),
      file: { name: 'transactions.csv', mimeType: 'text/csv', buffer: Buffer.from('Date,Description,Amount\n2026-01-15,Market,12.50') },
    },
  })
  expect(response.status(), await response.text()).toBe(201)
  const body: unknown = await response.json()
  if (!body || typeof body !== 'object' || !('id' in body) || typeof body.id !== 'string') {
    throw new Error('Invalid created preview.')
  }
  return body.id
}

for (const restored of [false, true]) {
  test(`ended preview requires actor acknowledgement${restored ? ' after reconnect with a replacement' : ' in the foreground'}`, async ({ browser, baseURL }) => {
    const owner = await browser.newContext({ baseURL, viewport: restored ? { width: 390, height: 844 } : { width: 1280, height: 900 } })
    const second = await browser.newContext({ baseURL })
    try {
      const email = `owner-${randomUUID()}@example.test`
      const password = `Clutch!${randomUUID()}Aa9`
      await signIn(owner, email, password, true)
      await signIn(second, email, password, false)
      const description = `Ended ${randomUUID()}`
      const accountResponse = await owner.request.post('/api/accounts', {
        headers: await csrf(owner), data: { description, currencyCode: 'AUD' },
      })
      expect(accountResponse.status()).toBe(201)
      const account: unknown = await accountResponse.json()
      if (!account || typeof account !== 'object' || !('id' in account) || typeof account.id !== 'string') {
        throw new Error('Invalid account.')
      }
      const affected = await owner.newPage()
      await openImport(affected, description)
      if (restored) {
        await affected.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('System')
      }
      await expect(affected.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled()
      await affected.locator('#csv-file').setInputFiles({
        name: 'transactions.csv', mimeType: 'text/csv',
        buffer: Buffer.from('Date,Description,Amount\n2026-01-15,Market,12.50'),
      })
      await affected.getByLabel('Transaction Date Column').selectOption('0')
      await affected.getByLabel('Description Column').selectOption('1')
      await affected.getByLabel('Date Format').selectOption('yyyy-MM-dd')
      await affected.getByLabel('Signed Amount Column').selectOption('2')
      await affected.getByLabel('Incoming Transactions Use').selectOption('Positive')
      await affected.getByLabel('Number Format Used in This File').selectOption('dot-decimal-comma-grouping')
      await affected.getByRole('button', { name: 'Review Import', exact: true }).click()
      await expect(affected.getByRole('button', { name: 'Confirm Import' })).toBeEnabled()
      if (restored) {
        await owner.setOffline(true)
        await expect(affected.getByRole('button', { name: 'Confirm Import' })).toBeDisabled()
      }
      const waiting = await second.newPage()
      await openImport(waiting, description)
      const endResponse = waiting.waitForResponse((response) =>
        response.request().method() === 'DELETE' && response.url().includes('/active-import-review'))
      await waiting.getByRole('button', { name: 'End Other Import', exact: true }).click()
      expect((await endResponse).status()).toBe(204)
      const endedAt = Date.now()
      if (restored) {
        await expect(waiting.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled()
        await createPreview(second, account.id)
        await owner.setOffline(false)
      }
      const modal = affected.getByRole('dialog', { name: 'Import Ended', exact: true })
      await expect(modal).toBeVisible({ timeout: 5000 })
      if (!restored) expect(Date.now() - endedAt).toBeLessThanOrEqual(5000)
      await expect(modal).toContainText(email)
      await expect(modal).toContainText('another session')
      await expect(affected.getByRole('button', { name: 'Confirm Import' })).toHaveCount(0)
      const acknowledge = modal.getByRole('button', { name: 'Return to Transactions', exact: true })
      await expect(acknowledge).toBeFocused()
      await affected.keyboard.press('Tab')
      await expect(acknowledge).toBeFocused()
      await affected.keyboard.press('Shift+Tab')
      await expect(acknowledge).toBeFocused()
      await affected.keyboard.press('Escape')
      await affected.mouse.click(5, 5)
      await expect(modal).toBeVisible()
      for (const scheme of ['light', 'dark'] as const) {
        await affected.emulateMedia({ colorScheme: scheme })
        await expect.poll(() => affected.locator('html').evaluate((element) => element.classList.contains('dark')))
          .toBe(restored && scheme === 'dark')
        const accessibility = await new AxeBuilder({ page: affected })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
        expect(accessibility.violations).toEqual([])
      }
      const transactions = await second.request.get(`/api/accounts/${account.id}/transactions`)
      expect(transactions.status()).toBe(200)
      expect(await transactions.json()).toMatchObject({ items: [] })
      await acknowledge.focus()
      await affected.keyboard.press('Enter')
      await expect(affected.getByRole('heading', { name: 'Account Details', exact: true })).toBeVisible()
      await expect(affected.getByLabel('Account Description')).toHaveValue(description)
      await expect(affected.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible()
      const preference = await second.request.get('/api/preferences/theme')
      expect(await preference.json()).toMatchObject({ mode: restored ? 'System' : 'Light' })
    } finally {
      await second.close()
      await owner.close()
    }
  })
}
async function openImport(page: Page, description: string) {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(description) }).click()
  const actionAt = Date.now()
  await page.getByRole('button', { name: 'Import Transactions', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Import Transactions' })).toBeVisible()
  return actionAt
}

test('preflight blocks before a file, isolates owners, and clears within five seconds without submitting', async ({ browser, baseURL }) => {
  const owner = await browser.newContext({ baseURL })
  const otherSession = await browser.newContext({ baseURL })
  const unrelated = await browser.newContext({ baseURL })
  try {
    const email = `owner-${randomUUID()}@example.test`
    const password = `Clutch!${randomUUID()}Aa9`
    await signIn(owner, email, password, true)
    await signIn(otherSession, email, password, false)
    await signIn(unrelated, `other-${randomUUID()}@example.test`, `Clutch!${randomUUID()}Aa9`, true)
    const description = `Coordination ${randomUUID()}`
    const accountResponse = await owner.request.post('/api/accounts', {
      headers: await csrf(owner), data: { description, currencyCode: 'AUD' },
    })
    expect(accountResponse.status()).toBe(201)
    const account: unknown = await accountResponse.json()
    if (!account || typeof account !== 'object' || !('id' in account) || typeof account.id !== 'string') {
      throw new Error('Invalid account response.')
    }
    const page = await otherSession.newPage()
    let creates = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/import-reviews')) creates++
    })
    let releaseStatus = () => {}
    const firstStatus = new Promise<void>((resolve) => { releaseStatus = resolve })
    await page.route(/\/import-status(?:\?.*)?$/, async (route) => {
      await firstStatus
      await route.continue()
    })
    const actionAt = await openImport(page, description)
    await expect(page.getByText('Checking Import Availability…')).toBeVisible({ timeout: 500 })
    expect(Date.now() - actionAt).toBeLessThanOrEqual(500)
    releaseStatus()
    await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled()
    let failRefresh = true
    let releaseRetry = () => {}
    const retryGate = new Promise<void>((resolve) => { releaseRetry = resolve })
    await page.route(/\/import-status(?:\?.*)?$/, async (route) => {
      if (failRefresh) {
        failRefresh = false
        await route.fulfill({ status: 503, json: { title: 'Status temporarily unavailable.' } })
      } else {
        await retryGate
        await route.fallback()
      }
    })
    await page.evaluate('window.dispatchEvent(new Event("focus"))')
    const retry = page.getByRole('button', { name: 'Retry Availability Check' })
    await expect(retry).toBeVisible()
    await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
    const retryAt = Date.now()
    await retry.click()
    await expect(page.getByText('Checking Import Availability…', { exact: true })).toBeVisible({ timeout: 500 })
    expect(Date.now() - retryAt).toBeLessThanOrEqual(500)
    releaseRetry()
    await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled()
    await page.unrouteAll({ behavior: 'wait' })
    const reviewId = await createPreview(owner, account.id)
    await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled({ timeout: 5000 })
    await expect(page.getByText('Another import is active', { exact: false })).toBeVisible()
    const status = await unrelated.request.get(`/api/accounts/${account.id}/import-status?reviewId=${reviewId}`)
    expect(status.status()).toBe(404)
    expect(await status.text()).not.toContain(email)
    const cancelled = await owner.request.delete(`/api/import-reviews/${reviewId}`, { headers: await csrf(owner) })
    expect(cancelled.status(), await cancelled.text()).toBe(204)
    const started = Date.now()
    await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled({ timeout: 5000 })
    expect(Date.now() - started).toBeLessThanOrEqual(5000)
    expect(creates).toBe(0)

    const nextReview = await createPreview(owner, account.id)
    await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled({ timeout: 5000 })
    const confirmed = await owner.request.post(`/api/import-reviews/${nextReview}/confirm`, {
      headers: await csrf(owner), data: { confirmPossibleDuplicates: false },
    })
    expect(confirmed.status(), await confirmed.text()).toBe(200)
    const completed = Date.now()
    await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled({ timeout: 5000 })
    expect(Date.now() - completed).toBeLessThanOrEqual(5000)
    expect(creates).toBe(0)

    const target = await createPreview(owner, account.id)
    const end = page.getByRole('button', { name: 'End Other Import', exact: true })
    await expect(end).toBeVisible({ timeout: 5000 })
    let releaseEnd = () => {}
    const endingGate = new Promise<void>((resolve) => { releaseEnd = resolve })
    await page.route(/\/active-import-review\?reviewId=/, async (route) => {
      expect(new URL(route.request().url()).searchParams.get('reviewId')).toBe(target)
      await endingGate
      await route.continue()
    })
    const endingAt = Date.now()
    await end.click()
    await expect(page.getByRole('button', { name: 'Ending Other Import…' })).toBeVisible({ timeout: 500 })
    expect(Date.now() - endingAt).toBeLessThanOrEqual(500)
    await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeDisabled()
    const endResponse = page.waitForResponse((response) =>
      response.request().method() === 'DELETE' && response.url().includes('/active-import-review'))
    releaseEnd()
    expect((await endResponse).status()).toBe(204)
    await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled({ timeout: 5000 })
    expect(creates).toBe(0)
    const watched = await owner.request.get(`/api/accounts/${account.id}/import-status?reviewId=${target}`)
    expect(watched.status()).toBe(200)
    expect(await watched.json()).toMatchObject({
      availability: 'Available', watchedImport: { id: target, state: 'Ended', endedBy: { userName: email } },
    })
  } finally {
    await unrelated.close()
    await otherSession.close()
    await owner.close()
  }
})
