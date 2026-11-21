import { randomUUID } from 'node:crypto'
import type { BrowserContext, Page } from '@playwright/test'
import { test, expect } from './fixtures.js'

const testPassword = 'Clutch-E2e!Password-2026'

async function registerAndSignIn(context: BrowserContext, email: string) {
  const csrfResponse = await context.request.get('/api/security/csrf-token')
  expect(csrfResponse.ok()).toBeTruthy()
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

async function openMortgages(page: Page) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Mortgages' }).click()
  await page.mouse.move(700, 500)
  await expect(page.getByRole('heading', { name: 'Loan Details' })).toBeVisible()
}

async function fillHeader(page: Page, name: string, balance: string, periods: string) {
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Starting Balance').fill(balance)
  await page.getByLabel('Number of Periods').fill(periods)
  await page.getByLabel('First Repayment Date').fill('2000-01-01')
  await page.getByLabel('Repayment Frequency').selectOption('Monthly')
}

const rateDialog = (page: Page) => page.getByRole('dialog', { name: 'Change Interest Rate' })

/** Opens "Change Interest Rate", adds each [rate, date] pair, then closes it. */
async function addRates(page: Page, rates: Array<[string, string]>) {
  await page.getByRole('button', { name: 'Change Interest Rate' }).click()
  const dialog = rateDialog(page)
  for (const [rate, date] of rates) {
    await dialog.getByLabel('New Interest Rate').fill(rate)
    await dialog.getByLabel('Effective Date').fill(date)
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  }
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
}

/** The listed changes in the dialog, read from their remove buttons ("5.25% 1 Jan 2000"). */
async function listedRates(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'Change Interest Rate' }).click()
  const labels = await rateDialog(page).getByRole('button', { name: /^Remove / }).evaluateAll(
    (buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''),
  )
  await rateDialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(rateDialog(page)).toHaveCount(0)
  return labels.map((label) => label.replace(/^Remove /, '').replace(' from ', ' '))
}

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Mortgages' }).getByRole('button', { name, exact: true })

test('mortgages journey: add, reload, sign out and in, switch, rename, guard and delete', async ({ browser }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
  const context = await browser.newContext({ baseURL })

  try {
    const email = `mortgages-${randomUUID()}@example.test`
    await registerAndSignIn(context, email)

    const page = await context.newPage()
    await page.goto('/')
    await openMortgages(page)
    await expect(page.getByText('Please enter your mortgage details')).toHaveCount(2)

    // Add a mortgage with two rate changes entered latest-first (US2-AS6).
    await fillHeader(page, 'Home loan', '500000.50', '360')
    await addRates(page, [['6', '2005-06-01'], ['5.25', '2000-01-01']])
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Mortgage saved' })).toBeVisible()
    await expect(tab(page, 'Home loan')).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('table')).toHaveAttribute('aria-rowcount', '362')

    // Reload: persisted, and the rate changes come back in effective-date order.
    await page.reload()
    await openMortgages(page)
    await expect(page.getByLabel('Starting Balance')).toHaveValue('$500,000.50')
    expect(await listedRates(page)).toEqual(['5.25% 1 Jan 2000', '6.00% 1 Jun 2005'])

    // Sign out and back in: the values are unchanged (SC-002).
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(testPassword)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await openMortgages(page)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Home loan')
    await expect(page.getByLabel('Starting Balance')).toHaveValue('$500,000.50')

    // A second mortgage, then switch.
    await page.getByRole('button', { name: 'Add mortgage' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('')
    await fillHeader(page, 'Car loan', '20000', '48')
    await addRates(page, [['7.5', '2000-01-01']])
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(tab(page, 'Car loan')).toHaveAttribute('aria-current', 'true')
    await tab(page, 'Home loan').click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Home loan')
    await expect(page.getByRole('table')).toHaveAttribute('aria-rowcount', '362')
    await tab(page, 'Car loan').click()
    await expect(page.getByRole('table')).toHaveAttribute('aria-rowcount', '50')

    // With five mortgages a tab switch shows the details within one second (SC-003).
    const freshToken = await (await context.request.get('/api/security/csrf-token')).json() as { requestToken: string }
    for (const name of ['Boat', 'Land', 'Shed']) {
      const created = await context.request.post('/api/mortgages', {
        headers: { 'X-CSRF-TOKEN': freshToken.requestToken },
        data: {
          name,
          startingBalance: 1000,
          numberOfPeriods: 12,
          firstRepaymentDate: '2000-01-01',
          repaymentFrequency: 'Weekly',
          interestRateChanges: [{ newInterestRate: 4, effectiveDate: '2000-01-01' }],
        },
      })
      expect(created.status(), await created.text()).toBe(201)
    }
    await page.reload()
    await openMortgages(page)
    await expect(page.getByRole('navigation', { name: 'Mortgages' }).getByRole('listitem')).toHaveCount(6)
    const started = Date.now()
    await tab(page, 'Shed').click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Shed', { timeout: 1000 })
    expect(Date.now() - started).toBeLessThan(1000)

    // Change Interest Rate: add one change and remove another, Save, reload, reopen (SC-005).
    await tab(page, 'Home loan').click()
    await page.getByRole('button', { name: 'Change Interest Rate' }).click()
    await rateDialog(page).getByLabel('New Interest Rate').fill('6.5')
    await rateDialog(page).getByLabel('Effective Date').fill('2010-01-01')
    await rateDialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await rateDialog(page).getByRole('button', { name: 'Remove 6.00% from 1 Jun 2005' }).click()
    await rateDialog(page).getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Mortgage saved' }).first()).toBeVisible()
    await page.reload()
    await openMortgages(page)
    expect(await listedRates(page)).toEqual(['5.25% 1 Jan 2000', '6.50% 1 Jan 2010'])

    // Cancel discards dialog edits.
    await addRates(page, [['7', '2012-01-01']])
    await expect(page.getByText('7.00%', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    expect(await listedRates(page)).toEqual(['5.25% 1 Jan 2000', '6.50% 1 Jan 2010'])

    // One add journey in exactly 6 actions: open, New Interest Rate, Effective Date, Add, Close, Save (SC-002).
    await page.getByRole('button', { name: 'Change Interest Rate' }).click()
    await rateDialog(page).getByLabel('New Interest Rate').fill('7.25')
    await rateDialog(page).getByLabel('Effective Date').fill('2015-01-01')
    await rateDialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await rateDialog(page).getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Mortgage saved' }).first()).toBeVisible()
    await page.reload()
    await openMortgages(page)
    expect(await listedRates(page)).toEqual(['5.25% 1 Jan 2000', '6.50% 1 Jan 2010', '7.25% 1 Jan 2015'])

    // Rename.
    await tab(page, 'Car loan').click()
    await page.getByLabel('Name', { exact: true }).fill('Vehicle loan')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(tab(page, 'Vehicle loan')).toHaveAttribute('aria-current', 'true')
    await expect(tab(page, 'Car loan')).toHaveCount(0)

    // Unsaved changes: Stay, then Discard.
    await page.getByLabel('Name', { exact: true }).fill('Edited but not saved')
    await tab(page, 'Home loan').click()
    const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?' })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Stay on this page' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Edited but not saved')
    await tab(page, 'Home loan').click()
    await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Home loan')

    // Delete (from the Loan Details header): cancel, then confirm.
    await tab(page, 'Shed').click()
    await page.getByRole('button', { name: 'Delete Shed' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete Shed?' })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(tab(page, 'Shed')).toBeVisible()
    await page.getByRole('button', { name: 'Delete Shed' }).click()
    await page.getByRole('dialog', { name: 'Delete Shed?' }).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(tab(page, 'Shed')).toHaveCount(0)

    // 320 px: nothing scrolls sideways at the page level.
    await page.setViewportSize({ width: 320, height: 700 })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  } finally {
    await context.close()
  }
})
