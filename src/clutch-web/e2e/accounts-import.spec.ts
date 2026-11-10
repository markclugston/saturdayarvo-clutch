import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures.js'
import { randomUUID } from 'node:crypto'

const testPassword = 'Clutch-E2e!Password-2026'

async function registerAndSignIn(
  context: import('@playwright/test').BrowserContext,
  email: string,
) {
  const csrfResponse = await context.request.get('/api/security/csrf-token')
  expect(csrfResponse.ok(), `${csrfResponse.status()} ${await csrfResponse.text()}`).toBeTruthy()
  const { requestToken } = await csrfResponse.json() as { requestToken: string }
  const headers = { 'X-CSRF-TOKEN': requestToken }

  const registration = await context.request.post('/api/security/register', {
    headers,
    data: { email, password: testPassword },
  })
  expect(registration.status(), await registration.text()).toBe(201)

  const signIn = await context.request.post('/api/security/login', {
    headers,
    data: { email, password: testPassword },
  })
  expect(signIn.status(), await signIn.text()).toBe(204)
}

test('waits for the API to become available before showing sign-in', async ({ page }) => {
  let requests = 0
  await page.route('**/api/security/session', (route) => {
    requests++
    return route.fulfill({
      status: requests === 1 ? 502 : 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: requests === 1 ? 502 : 401 }),
    })
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  expect(requests).toBe(2)
})

test('sign-in journey supports keyboard navigation and keeps the Light default', async ({ page }) => {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
  await page.route('**/api/security/session', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 401, title: 'Authentication required' }),
    }))
  await page.goto(baseUrl)
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.locator('a[href]')).toHaveCount(0)

  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Email')).toBeFocused()

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])

  expect(await page.locator('html').evaluate((element) =>
    element.classList.contains('dark'))).toBe(false)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(() => page.locator('html').evaluate((element) =>
    element.classList.contains('dark'))).toBe(false)
  await page.emulateMedia({ colorScheme: 'light' })
  await expect.poll(() => page.locator('html').evaluate((element) =>
    element.classList.contains('dark'))).toBe(false)
})

test('switches to account creation using a button without hyperlink controls', async ({ page }) => {
  await page.route('**/api/security/session', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ status: 401, title: 'Authentication required' }),
    }))
  await page.goto('/')

  const createAccountButton = page.getByRole('button', { name: 'New here? Create an account' })
  await expect(createAccountButton).toBeVisible()
  await expect(createAccountButton).toHaveJSProperty('tagName', 'BUTTON')
  await expect(page.locator('a[href]')).toHaveCount(0)
  await createAccountButton.click()
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
})

test('provisions two real API sessions and denies cross-user account access', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
    const ownerContext = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(ownerContext, `owner-${randomUUID()}@example.test`)
    const ownerPage = await ownerContext.newPage()
    await ownerPage.goto(baseUrl)
    await expect(ownerPage.getByRole('heading', { name: 'Your accounts' })).toBeVisible()

    const description = 'Private browser test account'
    await ownerPage.getByLabel('Account description').fill(description)
    await ownerPage.getByLabel('Currency').selectOption('AUD')
    await ownerPage.getByRole('button', { name: 'Add account' }).click()
    await expect(ownerPage.getByRole('heading', { name: 'Account details' })).toBeVisible()

    const ownerAccountsResponse = await ownerContext.request.get('/api/accounts')
    expect(ownerAccountsResponse.ok()).toBeTruthy()
    const [account] = await ownerAccountsResponse.json() as Array<{ id: string; description: string }>
    if (!account) {
      throw new Error('Expected the owner to have one account.')
    }
    expect(account.description).toBe(description)

    const otherContext = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(otherContext, `other-${randomUUID()}@example.test`)
    const otherPage = await otherContext.newPage()
    await otherPage.goto(baseUrl)
    await expect(otherPage.getByRole('heading', { name: 'Your accounts' })).toBeVisible()

    const otherUserResponse = await otherContext.request.get(`/api/accounts/${account.id}`)
    expect(otherUserResponse.status()).toBe(404)
    expect(await otherUserResponse.text()).not.toContain(description)

    await otherContext.close()
    await ownerContext.close()
  })

test.describe('authenticated personal accounts and transaction import', () => {
  test.skip(
    !process.env.PLAYWRIGHT_STORAGE_STATE || !process.env.PLAYWRIGHT_OTHER_STORAGE_STATE,
    'Provide owner and other-user storage states for the live import journey.',
  )

  test('signed-in account pages remain accessible and support duplicate confirmation', async ({
    authenticatedPage: page,
    browser,
  }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    await page.goto(baseUrl)
    await expect(page.locator('a[href]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Import limits' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Your accounts' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your accounts' })).not.toBeFocused()
    const description = `Playwright ${Date.now()}`
    await page.getByLabel('Account description').fill(description)
    await page.getByLabel('Currency').selectOption('AUD')
    const accountCreation = page.waitForResponse((response) =>
      response.url().endsWith('/api/accounts')
      && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Add account' }).click()
    const accountResponse = await accountCreation
    expect(accountResponse.ok()).toBeTruthy()
    const account = await accountResponse.json() as { id: string }
    await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back to accounts' })).toBeFocused()

    const otherContext = await browser.newContext({
      storageState: process.env.PLAYWRIGHT_OTHER_STORAGE_STATE,
    })
    try {
      const otherResponse = await otherContext.request.get(
        new URL(`/api/accounts/${account.id}`, baseUrl).toString(),
      )
      expect(otherResponse.status()).toBe(404)
    } finally {
      await otherContext.close()
    }

    await page.getByRole('button', { name: 'Import transactions' }).click()
    await expect(page.getByRole('button', { name: 'Back to account' })).toBeFocused()
    await page.locator('#csv-file').setInputFiles({
      name: 'duplicate-transactions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        `Date,Description,Amount\n2025-01-15,Duplicate ${description},12.50\n2025-01-15,Duplicate ${description},12.50`,
      ),
    })
    await page.getByLabel('Transaction date column').selectOption('0')
    await page.getByLabel('Description column').selectOption('1')
    await page.getByLabel('Date format').selectOption('yyyy-MM-dd')
    await page.getByLabel('Signed amount column').selectOption('2')
    await page.getByLabel('Incoming transactions use').selectOption('Positive')
    await page.getByLabel('Number format used in this file')
      .selectOption('dot-decimal-comma-grouping')
    await page.getByRole('button', { name: 'Review import' }).click()

    await expect(page.getByRole('status')).toContainText('Possible duplicates are highlighted')
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])

    const confirmButton = page.getByRole('button', { name: 'Confirm import' })
    await expect(confirmButton).toBeDisabled()
    await page.getByLabel(/I reviewed the possible duplicates/).check()
    await expect(confirmButton).toBeEnabled()
    await confirmButton.click()
    await expect(page.getByRole('status')).toContainText('2 transactions imported successfully')
    await page.getByRole('button', { name: 'Return to account' }).click()
    await expect(page.getByRole('button', { name: 'Back to accounts' })).toBeFocused()

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => page.locator('html').evaluate((element) =>
      element.classList.contains('dark'))).toBe(true)
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => page.locator('html').evaluate((element) =>
      element.classList.contains('dark'))).toBe(false)
  })
})
