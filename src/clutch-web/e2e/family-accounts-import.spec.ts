import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures.js'

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

test.describe('family accounts and transaction import', () => {
  test.skip(
    !process.env.PLAYWRIGHT_STORAGE_STATE || !process.env.PLAYWRIGHT_OTHER_STORAGE_STATE,
    'Provide owner and other-user storage states for the authenticated journey.',
  )

  test('keeps account access private and supports accessible duplicate confirmation', async ({
    authenticatedPage: page,
    browser,
  }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    await page.goto(baseUrl)
    await expect(page.getByRole('button', { name: 'Import limits' })).toHaveCount(0)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeFocused()

    const createFamily = page.getByRole('button', { name: 'Create Family' })
    if (await createFamily.isVisible()) {
      await createFamily.click()
    } else {
      await page.getByRole('button', { name: 'View accounts' }).click()
    }

    await expect(page.getByRole('heading', { name: 'Your accounts' })).toBeVisible()
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

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(() => page.locator('html').evaluate((element) =>
      element.classList.contains('dark'))).toBe(true)
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => page.locator('html').evaluate((element) =>
      element.classList.contains('dark'))).toBe(false)
  })
})
