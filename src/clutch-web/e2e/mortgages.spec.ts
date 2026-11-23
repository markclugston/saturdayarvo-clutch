import { randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
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
  await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible()
}

async function fillHeader(page: Page, name: string, balance: string, periods: string) {
  await page.getByLabel('Name', { exact: true }).fill(name)
  await page.getByLabel('Opening Balance').fill(balance)
  await page.getByLabel('Duration').fill(periods)
  await page.getByLabel('Disbursal Date').fill('2000-01-01')
  await page.getByLabel('Payment Frequency').selectOption('Monthly')
}

const rateDialog = (page: Page) => page.getByRole('dialog', { name: 'Interest Rates' })

/** Opens "Interest Rates", adds each [rate, date] pair, then closes it. */
async function addRates(page: Page, rates: Array<[string, string]>) {
  await page.getByRole('button', { name: 'Interest Rates' }).click()
  const dialog = rateDialog(page)
  for (const [rate, date] of rates) {
    await dialog.getByLabel('New Interest Rate').fill(rate)
    // The opening rate's date is the Disbursal Date, prefilled and disabled.
    if (await dialog.getByLabel('Effective Date').isEnabled()) {
      await dialog.getByLabel('Effective Date').fill(date)
    }
    await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  }
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
}

/** The listed changes in the dialog, read from their remove buttons ("5.25% 1 Jan 2000"). */
async function listedRates(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'Interest Rates' }).click()
  const labels = await rateDialog(page).getByRole('button', { name: /^Remove / }).evaluateAll(
    (buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''),
  )
  await rateDialog(page).getByRole('button', { name: 'Close' }).click()
  await expect(rateDialog(page)).toHaveCount(0)
  return labels.map((label) => label.replace(/^Remove /, '').replace(' from ', ' '))
}

const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Mortgages' }).getByRole('button', { name, exact: true })

const PREFERENCE_PATH = '/api/preferences/loan-payoff-timeline'

const timeline = (page: Page) => page.getByRole('region', { name: 'Loan Payoff Timeline' })

/** Clicks the switch and waits for that switch's save to be answered. */
async function switchView(page: Page, name: 'Show Amortization Schedule' | 'Show Burndown Chart') {
  const saved = page.waitForResponse((response) =>
    new URL(response.url()).pathname === PREFERENCE_PATH && response.request().method() === 'PUT')
  await timeline(page).getByRole('button', { name }).click()
  expect((await saved).status()).toBe(200)
}

/** Asserts the group shows only `view`, and that the other view never appeared since the last load. */
async function expectView(page: Page, view: 'Burndown' | 'Schedule') {
  const chart = timeline(page).getByRole('img', { name: /balance over time/i })
  const schedule = timeline(page).getByRole('table')
  if (view === 'Burndown') {
    await expect(timeline(page).getByRole('button', { name: 'Show Amortization Schedule' })).toBeVisible()
    await expect(chart).toBeVisible()
    await expect(schedule).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { scheduleSeen?: boolean }).scheduleSeen ?? false)).toBe(false)
  } else {
    await expect(timeline(page).getByRole('button', { name: 'Show Burndown Chart' })).toBeVisible()
    await expect(schedule).toBeVisible()
    await expect(chart).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { chartSeen?: boolean }).chartSeen ?? false)).toBe(false)
  }
}

/** Records, per page load, whether the chart or schedule was ever on the page (to catch a swap). */
async function watchForSwap(context: BrowserContext) {
  await context.addInitScript(() => {
    new MutationObserver(() => {
      const state = window as unknown as { chartSeen?: boolean; scheduleSeen?: boolean }
      if (document.querySelector('svg[aria-label^="Line chart of the mortgage balance"]')) state.chartSeen = true
      if (document.querySelector('[role="table"]')) state.scheduleSeen = true
    }).observe(document, { childList: true, subtree: true })
  })
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign Out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
}

async function signInThroughUi(page: Page, email: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(testPassword)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

test('loan payoff timeline view is saved per user and shown on every load without a swap', async ({ browser }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
  const context = await browser.newContext({ baseURL })
  const otherContext = await browser.newContext({ baseURL })

  try {
    const email = `timeline-${randomUUID()}@example.test`
    const otherEmail = `timeline-other-${randomUUID()}@example.test`
    await registerAndSignIn(otherContext, otherEmail)
    await registerAndSignIn(context, email)
    // A saved mortgage, so the chart and the schedule table both render and a swap would show.
    const token = await (await context.request.get('/api/security/csrf-token')).json() as { requestToken: string }
    const created = await context.request.post('/api/mortgages', {
      headers: { 'X-CSRF-TOKEN': token.requestToken },
      data: {
        name: 'Home',
        openingBalance: 1000,
        duration: 12,
        disbursalDate: '2000-01-01',
        paymentFrequency: 'Monthly',
        interestRateChanges: [{ newInterestRate: 4, effectiveDate: '2000-01-01' }],
      },
    })
    expect(created.status(), await created.text()).toBe(201)
    await watchForSwap(context)

    const page = await context.newPage()
    await page.goto('/')
    await openMortgages(page)
    await expectView(page, 'Burndown')

    // US2-1: switch to the schedule, reload → schedule, with no chart first (US2-3).
    await switchView(page, 'Show Amortization Schedule')
    await page.reload()
    await openMortgages(page)
    await expectView(page, 'Schedule')

    // Sign out and in → schedule.
    await signOut(page)
    await signInThroughUi(page, email)
    await openMortgages(page)
    await expectView(page, 'Schedule')

    // SC-004: a second user in the same tab, without a reload, never sees the first user's view.
    await signOut(page)
    await signInThroughUi(page, otherEmail)
    await openMortgages(page)
    await expect(timeline(page).getByRole('button', { name: 'Show Amortization Schedule' })).toBeVisible()
    await expect(timeline(page).getByRole('table')).toHaveCount(0)

    // US2-4: each user sees their own view.
    await signOut(page)
    await signInThroughUi(page, email)
    await openMortgages(page)
    await expect(timeline(page).getByRole('button', { name: 'Show Burndown Chart' })).toBeVisible()

    // US2-2: switch back, reload → chart.
    await switchView(page, 'Show Burndown Chart')
    await page.reload()
    await openMortgages(page)
    await expectView(page, 'Burndown')

    // US2-6, SC-007: three quick switches, then reload without waiting for any answer → the last view.
    await timeline(page).getByRole('button', { name: 'Show Amortization Schedule' }).click()
    await timeline(page).getByRole('button', { name: 'Show Burndown Chart' }).click()
    await timeline(page).getByRole('button', { name: 'Show Amortization Schedule' }).click()
    await page.reload()
    await openMortgages(page)
    await expectView(page, 'Schedule')

    // SC-003: leaving Mortgages and returning shows the view last chosen; a switch then persists.
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Accounts' }).click()
    await expect(timeline(page)).toHaveCount(0)
    await openMortgages(page)
    await expectView(page, 'Schedule')
    await switchView(page, 'Show Burndown Chart')
    await page.reload()
    await openMortgages(page)
    await expectView(page, 'Burndown')
  } finally {
    await context.close()
    await otherContext.close()
  }
})

test('mortgages journey: add, reload, sign out and in, switch, rename, guard and delete', async ({ browser }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
  const context = await browser.newContext({ baseURL })

  try {
    const email = `mortgages-${randomUUID()}@example.test`
    await registerAndSignIn(context, email)

    const page = await context.newPage()
    await page.goto('/')
    await openMortgages(page)
    await expect(page.getByText('Please enter your mortgage details')).toHaveCount(1)
    // The schedule's row count is checked below; the view is saved, so it stays after reloads.
    await switchView(page, 'Show Amortization Schedule')

    // Add a mortgage with two rate changes. Since 021 the first one added is the opening rate, dated on
    // the Disbursal Date, so it is entered first.
    await fillHeader(page, 'Home loan', '500000.50', '360')
    await addRates(page, [['5.25', '2000-01-01'], ['6', '2005-06-01']])
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Mortgage saved' })).toBeVisible()
    await expect(tab(page, 'Home loan')).toHaveAttribute('aria-current', 'true')
    // Duration rows; period 1 is one month after the 1 Jan 2000 Disbursal Date (022 FR-001, FR-002).
    await expect(page.getByRole('table')).toHaveAttribute('aria-rowcount', '361')
    await expect(page.getByRole('row').nth(1).getByRole('cell')).toHaveText(['1', '1 Feb 2000', 'Not yet calculated'])

    // Reload: persisted, and the rate changes come back in effective-date order.
    await page.reload()
    await openMortgages(page)
    await expect(page.getByLabel('Opening Balance')).toHaveValue('$500,000.50')
    expect(await listedRates(page)).toEqual(['5.25% 1 Jan 2000', '6.00% 1 Jun 2005'])

    // Sign out and back in: the values are unchanged (SC-002).
    await page.getByRole('button', { name: 'Sign Out' }).click()
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(testPassword)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await openMortgages(page)
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Home loan')
    await expect(page.getByLabel('Opening Balance')).toHaveValue('$500,000.50')

    // A second mortgage, then switch.
    await page.getByRole('button', { name: 'Add Mortgage' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('')
    await fillHeader(page, 'Car loan', '20000', '48')
    await addRates(page, [['7.5', '2000-01-01']])
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(tab(page, 'Car loan')).toHaveAttribute('aria-current', 'true')
    await tab(page, 'Home loan').click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Home loan')
    await expect(page.getByRole('table')).toHaveAttribute('aria-rowcount', '361')
    await tab(page, 'Car loan').click()
    await expect(page.getByRole('table')).toHaveAttribute('aria-rowcount', '49')

    // With five mortgages a tab switch shows the details within one second (SC-003).
    const freshToken = await (await context.request.get('/api/security/csrf-token')).json() as { requestToken: string }
    for (const name of ['Boat', 'Land', 'Shed']) {
      const created = await context.request.post('/api/mortgages', {
        headers: { 'X-CSRF-TOKEN': freshToken.requestToken },
        data: {
          name,
          openingBalance: 1000,
          duration: 12,
          disbursalDate: '2000-01-01',
          paymentFrequency: 'Weekly',
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

    // Interest Rates: add one change and remove another, Save, reload, reopen (SC-005).
    await tab(page, 'Home loan').click()
    await page.getByRole('button', { name: 'Interest Rates' }).click()
    await rateDialog(page).getByLabel('New Interest Rate').fill('6.5')
    // The range ends on the final repayment: 1 Jan 2000 plus 360 months (022 FR-007).
    await rateDialog(page).getByLabel('Effective Date').fill('2030-01-02')
    await rateDialog(page).getByRole('button', { name: 'Add', exact: true }).click()
    await expect(rateDialog(page).getByText('Choose a date from 1 Jan 2000 to 1 Jan 2030')).toBeVisible()
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
    await page.getByRole('button', { name: 'Interest Rates' }).click()
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
    const discard = page.getByRole('dialog', { name: 'Discard Unsaved Changes?' })
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: 'Stay on This Page' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Edited but not saved')
    await tab(page, 'Home loan').click()
    await page.getByRole('dialog', { name: 'Discard Unsaved Changes?' }).getByRole('button', { name: 'Discard Changes' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Home loan')

    // Delete (from the Details header): cancel, then confirm.
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

async function importBalanceStatement(page: Page) {
  await page.getByRole('button', { name: 'Import Transactions' }).click()
  await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled()
  await page.locator('#csv-file').setInputFiles({
    name: 'balances.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      ['Date,Description,Amount,Balance', '2000-01-15,First,10.00,1000.00', '2000-02-15,Second,20.00,1020.00'].join('\n'),
    ),
  })
  await page.getByLabel('Transaction Date Column').selectOption('0')
  await page.getByLabel('Description Column').selectOption('1')
  await page.getByLabel('Date Format').selectOption('yyyy-MM-dd')
  await page.getByLabel('Signed Amount Column').selectOption('2')
  await page.getByLabel('Incoming Transactions Use').selectOption('Positive')
  await page.getByLabel('Number Format Used in This File').selectOption('dot-decimal-comma-grouping')
  await page.getByLabel('Balance Column (Optional)').selectOption('3')
  await page.getByRole('button', { name: 'Review Import' }).click()
  await page.getByRole('button', { name: 'Confirm Import' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'transactions imported successfully' })).toBeVisible()
  await page.getByRole('button', { name: 'Return to Account' }).click()
}

test('mortgage account: linking shows a balance column right of Bank Schedule and clearing removes it', async ({ browser }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
  const context = await browser.newContext({ baseURL })

  try {
    await registerAndSignIn(context, `mortgage-account-${randomUUID()}@example.test`)
    const page = await context.newPage()
    await page.goto('/')

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Accounts' }).click()
    await page.getByLabel('Account Description').fill('Offset Journey')
    await page.getByLabel('Currency').selectOption('AUD')
    await page.getByRole('button', { name: 'Add Account' }).click()
    await expect(page.getByRole('heading', { name: 'Account Details' })).toBeVisible()
    await importBalanceStatement(page)

    await openMortgages(page)
    await fillHeader(page, 'Linked Home', '500000', '12')
    await addRates(page, [['5.25', '2000-01-01']])
    await page.getByLabel('Mortgage Account').selectOption({ label: 'Offset Journey' })
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Mortgage saved')).toBeVisible()

    await timeline(page).getByRole('button', { name: 'Show Amortization Schedule' }).click()
    const headers = timeline(page).getByRole('columnheader')
    await expect(headers).toHaveText(['Period', 'Date', 'Bank Schedule', 'Offset Journey Balance'])
    await expect(timeline(page).getByRole('cell', { name: '$1,020.00' }).first()).toBeVisible()

    for (const mode of ['Light', 'Dark']) {
      await page.getByLabel('Theme').selectOption(mode)
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(accessibility.violations).toEqual([])
      // WEB-001 evidence: set CLUTCH_SHOT_DIR to keep a screenshot per theme.
      if (process.env.CLUTCH_SHOT_DIR) {
        await page.screenshot({ path: `${process.env.CLUTCH_SHOT_DIR}/mortgage-account-${mode.toLowerCase()}.png`, fullPage: true })
      }
    }

    await page.getByLabel('Mortgage Account').selectOption({ label: 'None' })
    await expect(timeline(page).getByRole('columnheader')).toHaveText(['Period', 'Date', 'Bank Schedule'])
    // Wait for the save itself: the headers already show three columns before it completes.
    const saved = page.waitForResponse((response) =>
      response.url().includes('/api/mortgages/') && response.request().method() === 'PUT' && response.ok())
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await saved
    await expect(timeline(page).getByRole('columnheader')).toHaveCount(3)
    await page.reload()
    await openMortgages(page)
    await expect(page.getByLabel('Mortgage Account')).toHaveValue('')
  } finally {
    await context.close()
  }
})
