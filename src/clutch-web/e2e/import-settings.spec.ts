import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures.js'

test.describe('account import settings', () => {
  test('saves, reuses, edits, and exposes defaults in another browser context', async ({
    browser,
  }) => {
    const storageState = process.env.PLAYWRIGHT_STORAGE_STATE
    test.skip(
      !storageState,
      'Provide an authenticated owner storage state for the import-settings journey.',
    )

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({ storageState: storageState! })
    const page = await context.newPage()
    await page.goto(baseUrl)
    const createFamily = page.getByRole('button', { name: 'Create Family' })
    if (await createFamily.isVisible()) {
      await createFamily.click()
    } else {
      await page.getByRole('button', { name: 'View accounts' }).click()
    }

    await expect(page.getByRole('heading', { name: 'Your accounts' })).toBeVisible()
    const description = `Import settings ${Date.now()}`
    await page.getByLabel('Account description').fill(description)
    await page.getByLabel('Currency').selectOption('AUD')
    const accountCreation = page.waitForResponse((response) =>
      response.url().endsWith('/api/accounts')
      && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Add account' }).click()
    const accountResponse = await accountCreation
    expect(accountResponse.ok()).toBeTruthy()
    const account = await accountResponse.json() as { id: string }
    const accountId = account.id
    await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible()

    await page.getByRole('button', { name: 'Import transactions' }).click()
    await page.locator('#csv-file').setInputFiles({
      name: 'first-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Date,Description,Amount\n2025-01-15,Market first,10.00'),
    })
    await page.getByLabel('Transaction date column').selectOption('0')
    await page.getByLabel('Description column').selectOption('1')
    await page.getByLabel('Date format').selectOption('yyyy-MM-dd')
    await page.getByLabel('Signed amount column').selectOption('2')
    await page.getByLabel('Incoming transactions use').selectOption('Positive')
    await page.getByLabel('Number format used in this file')
      .selectOption('dot-decimal-comma-grouping')
    await page.getByRole('button', { name: 'Review import' }).click()
    await page.getByRole('button', { name: 'Confirm import' }).click()
    await expect(page.getByRole('status')).toContainText('1 transactions imported successfully')

    await page.getByRole('button', { name: 'Return to account' }).click()
    await page.getByRole('button', { name: 'Import transactions' }).click()
    await page.locator('#csv-file').setInputFiles({
      name: 'second-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Date,Description,Amount\n2025-01-16,Market second,20.00'),
    })

    await expect(page.getByRole('status')).toContainText(
      'Using this account’s saved import settings.',
    )
    await expect(page.getByRole('heading', { name: 'Map CSV columns' })).toHaveCount(0)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.emulateMedia({ colorScheme: 'dark' })
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => page.locator('html').evaluate((element) =>
      element.classList.contains('dark'))).toBe(false)

    const reviewWithSettingsButton = page.getByRole('button', {
      name: 'Review import with saved settings',
    })
    await reviewWithSettingsButton.focus()
    await page.keyboard.press('Enter')
    const confirmSavedImport = page.getByRole('button', { name: 'Confirm import' })
    await confirmSavedImport.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('1 transactions imported successfully')

    await page.getByRole('button', { name: 'Return to account' }).click()
    await page.getByRole('button', { name: 'Import transactions' }).click()
    await page.locator('#csv-file').setInputFiles({
      name: 'edited-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Date,Description,Amount\n2025-01-17,Market third,30.00'),
    })

    const changeSettingsButton = page.getByRole('button', { name: 'View or change settings' })
    await changeSettingsButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Transaction date column')).toHaveValue('0')
    await expect(page.getByLabel('Description column')).toHaveValue('1')
    await page.getByLabel('Incoming transactions use').selectOption('Negative')
    await page.getByRole('button', { name: 'Review import' }).click()
    const confirmButton = page.getByRole('button', { name: 'Confirm import' })
    await confirmButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status')).toContainText('1 transactions imported successfully')

    const browserContext = await browser.newContext({
      storageState: await page.context().storageState(),
      viewport: { width: 375, height: 812 },
    })
    try {
      const settingsResponse = await browserContext.request.get(
        new URL(`/api/accounts/${accountId}/import-settings`, baseUrl).toString(),
      )
      expect(settingsResponse.ok()).toBeTruthy()
      const settings = await settingsResponse.json() as {
        mapping: {
          dateColumn: number
          descriptionColumn: number
          incomingSign: 'Positive' | 'Negative' | null
        } | null
      }
      expect(settings.mapping).toMatchObject({
        dateColumn: 0,
        descriptionColumn: 1,
        incomingSign: 'Negative',
      })

      const otherPage = await browserContext.newPage()
      await otherPage.goto(baseUrl)
      await otherPage.setViewportSize({ width: 375, height: 812 })
      await otherPage.emulateMedia({ colorScheme: 'dark' })
      await expect.poll(() => otherPage.locator('html').evaluate((element) =>
        element.classList.contains('dark'))).toBe(true)
      await otherPage.emulateMedia({ colorScheme: 'light' })
      await expect.poll(() => otherPage.locator('html').evaluate((element) =>
        element.classList.contains('dark'))).toBe(false)
    } finally {
      await browserContext.close()
    }
  })

  test('first-import and saved-settings screens are accessible with mocked API responses', async ({
    page,
  }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const familyId = '550e8400-e29b-41d4-a716-446655440010'
    const accountId = '550e8400-e29b-41d4-a716-446655440011'
    const account = {
      id: accountId,
      familyId,
      description: 'Browser test account',
      currencyCode: 'AUD',
      lastSuccessfulImportAtUtc: null,
    }
    const currency = {
      code: 'AUD',
      name: 'Australian Dollar',
      amountFormats: [
        {
          id: 'dot-decimal-comma-grouping',
          decimalSeparator: '.',
          groupSeparator: ',',
          reference: 'CLDR',
          version: '44.0',
        },
      ],
    }
    const mapping = {
      dateColumn: 0,
      descriptionColumn: 1,
      dateFormat: 'yyyy-MM-dd',
      amountMode: 'Signed',
      signedAmountColumn: 2,
      incomingSign: 'Positive',
      numberFormat: 'dot-decimal-comma-grouping',
    }
    let accountCreated = false
    let savedMapping: typeof mapping | null = null
    let reviewNumber = 0
    let currentReviewId = ''

    await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (path === '/api/security/session') {
        await route.fulfill({ json: { id: 'browser-test-owner' } })
      } else if (path === '/api/security/csrf-token') {
        await route.fulfill({ json: { requestToken: 'test-token' } })
      } else if (path === '/api/families') {
        await route.fulfill({ json: [{ id: familyId, ownerUserId: 'browser-test-owner' }] })
      } else if (path === '/api/accounts' && request.method() === 'GET') {
        await route.fulfill({ json: accountCreated ? [account] : [] })
      } else if (path === '/api/accounts' && request.method() === 'POST') {
        accountCreated = true
        await route.fulfill({ status: 201, json: account })
      } else if (path === '/api/currencies') {
        await route.fulfill({ json: [currency] })
      } else if (path === `/api/accounts/${accountId}`) {
        await route.fulfill({ json: account })
      } else if (path === `/api/accounts/${accountId}/transactions`) {
        await route.fulfill({ json: { items: [], nextCursor: null } })
      } else if (path === `/api/accounts/${accountId}/import-settings`) {
        await route.fulfill({ json: { mapping: savedMapping } })
      } else if (path === `/api/accounts/${accountId}/import-reviews`) {
        reviewNumber += 1
        currentReviewId = `550e8400-e29b-41d4-a716-44665544001${reviewNumber}`
        await route.fulfill({
          status: 201,
          json: {
            id: currentReviewId,
            accountId,
            currencyCode: 'AUD',
            rowCount: 1,
            duplicateConfirmationRequired: false,
            expiresAtUtc: '2025-01-15T14:00:00.000Z',
            rows: [{
              sourceRowNumber: 2,
              transactionDate: '2025-01-15',
              description: 'Market',
              amount: '10.00',
              direction: 'Outgoing',
              isPossibleDuplicate: false,
            }],
          },
        })
      } else if (path === `/api/import-reviews/${currentReviewId}/confirm`) {
        savedMapping = mapping
        await route.fulfill({
          json: {
            importedCount: 1,
            completedAtUtc: '2025-01-15T14:00:00.000Z',
            settingsSaved: true,
          },
        })
      } else {
        await route.fulfill({
          status: 404,
          contentType: 'application/problem+json',
          body: JSON.stringify({ status: 404, title: 'Unexpected test API request' }),
        })
      }
    })

    await page.goto(baseUrl)
    await page.getByRole('button', { name: 'View accounts' }).click()
    await page.getByLabel('Account description').fill(account.description)
    await page.getByLabel('Currency').selectOption('AUD')
    await page.getByRole('button', { name: 'Add account' }).click()
    await page.getByRole('button', { name: 'Import transactions' }).click()
    await page.locator('#csv-file').setInputFiles({
      name: 'first-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Date,Description,Amount\n2025-01-15,Market,10.00'),
    })
    await page.getByLabel('Transaction date column').selectOption('0')
    await page.getByLabel('Description column').selectOption('1')
    await page.getByLabel('Date format').selectOption('yyyy-MM-dd')
    await page.getByLabel('Signed amount column').selectOption('2')
    await page.getByLabel('Incoming transactions use').selectOption('Positive')
    await page.getByLabel('Number format used in this file')
      .selectOption('dot-decimal-comma-grouping')
    await page.getByRole('button', { name: 'Review import' }).click()
    await page.getByRole('button', { name: 'Confirm import' }).click()
    await expect(page.getByRole('status')).toContainText('1 transactions imported successfully')

    await page.getByRole('button', { name: 'Return to account' }).click()
    await page.getByRole('button', { name: 'Import transactions' }).click()
    await page.locator('#csv-file').setInputFiles({
      name: 'second-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Date,Description,Amount\n2025-01-16,Market second,20.00'),
    })
    await expect(page.getByRole('status')).toContainText(
      'Using this account’s saved import settings.',
    )
    await expect(page.getByRole('heading', { name: 'Map CSV columns' })).toHaveCount(0)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.emulateMedia({ colorScheme: 'dark' })
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => page.locator('html').evaluate((element) =>
      element.classList.contains('dark'))).toBe(false)
  })
})
