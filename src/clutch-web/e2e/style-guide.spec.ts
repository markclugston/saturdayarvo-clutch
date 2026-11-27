/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

/*
 * Style-guide compliance states (specs/014-style-guide-compliance/contracts/visual-states.md).
 * Run only through playwright.style-guide.config.ts. Every API call is mocked.
 */

type Theme = 'Light' | 'Dark'

const accountId = '550e8400-e29b-41d4-a716-446655440011'
const otherAccountId = '550e8400-e29b-41d4-a716-446655440012'
const reviewId = '550e8400-e29b-41d4-a716-446655440099'
const longName = 'Household savings and everyday spending account for the whole family including holidays'
const accounts = [
  { id: accountId, description: longName, currencyCode: 'AUD', lastSuccessfulImportAtUtc: null },
  { id: otherAccountId, description: 'Everyday', currencyCode: 'AUD', lastSuccessfulImportAtUtc: null },
]
const currency = {
  code: 'AUD',
  minorUnits: 2,
  name: 'Australian Dollar',
  amountFormats: [{
    id: 'dot-decimal-comma-grouping',
    decimalSeparator: '.',
    groupSeparator: ',',
    reference: 'CLDR',
    version: '44.0',
  }],
}
// 029: Assets in two currencies, with long text that must truncate.
const usd = { ...currency, code: 'USD', name: 'US Dollar' }
const assetId = '550e8400-e29b-41d4-a716-446655440301'
const assetEditId = '550e8400-e29b-41d4-a716-446655440302'
const longAssetName = 'Family home on the corner block with the granny flat and the workshop'
const assetList = {
  assets: [
    {
      id: assetId, name: longAssetName, currencyCode: 'AUD',
      description: 'Valued by a local agent after the renovation of the kitchen, bathroom and rear deck',
      latestValuation: { value: 999999999999.99, valuationDate: '2026-01-01' },
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440303', name: 'Car', description: null, currencyCode: 'AUD',
      latestValuation: { value: 18500, valuationDate: '2025-06-30' },
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440304', name: 'Shares', description: 'Brokerage account', currencyCode: 'USD',
      latestValuation: { value: 2000, valuationDate: '2026-03-01' },
    },
  ],
  totals: [
    { currencyCode: 'AUD', totalValue: '1000000018499.99' },
    { currencyCode: 'USD', totalValue: '2000.00' },
  ],
}
const assetDetail = {
  id: assetId, name: longAssetName, description: 'Brick and tile', currencyCode: 'AUD',
  valuations: [
    { id: '550e8400-e29b-41d4-a716-446655440311', value: 850000, valuationDate: '2026-01-01' },
    { id: '550e8400-e29b-41d4-a716-446655440312', value: 790000.5, valuationDate: '2025-01-01' },
  ],
}
const transactions = Array.from({ length: 8 }, (_, index) => ({
  id: `550e8400-e29b-41d4-a716-4466554401${String(index).padStart(2, '0')}`,
  transactionDate: `2024-03-${String(index + 10).padStart(2, '0')}`,
  description: `Card purchase ${index + 1} at a merchant with an exceptionally long trading name and location reference`,
  amount: `${(index + 1) * 12}.50`,
  direction: index % 2 === 0 ? 'Outgoing' : 'Incoming',
  balance: `${1000 - index * 12}.00`,
}))
const categoryNodes = [
  { id: 'group-1', parentId: null, name: 'Food and household running costs for the entire year', depth: 0 },
  { id: 'category-1', parentId: 'group-1', name: 'Groceries', depth: 1 },
  { id: 'group-2', parentId: null, name: 'Transport', depth: 0 },
]
const importReview = {
  id: reviewId,
  accountId,
  currencyCode: 'AUD',
  rowCount: 2,
  duplicateConfirmationRequired: true,
  expiresAtUtc: '2099-01-01T00:00:00Z',
  rows: [
    {
      sourceRowNumber: 2, transactionDate: '2024-01-02', description: 'Coffee', amount: '4.50',
      direction: 'Outgoing', isPossibleDuplicate: true, balance: '95.50',
    },
    {
      sourceRowNumber: 3, transactionDate: '2024-01-03', description: 'Salary', amount: '2000.00',
      direction: 'Incoming', isPossibleDuplicate: false, balance: '2095.50',
    },
  ],
}
const csv = {
  name: 'bank.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from('Date,Description,Amount,Balance\n2024-01-02,Coffee,-4.50,95.50\n'),
}

type Session = 'ok' | 'unauthorized' | 'error' | 'hang'
type MortgagesMode = 'ok' | 'empty' | 'many' | 'rates' | 'error' | 'hang'

const longMortgageName = 'Family home loan with the offset account and the fixed rate period'
const mortgageFixture = (index: number) => ({
  id: `550e8400-e29b-41d4-a716-4466554402${String(index).padStart(2, '0')}`,
  name: index === 0 ? longMortgageName : `Mortgage ${index + 1}`,
  openingBalance: 500000.5,
  duration: 360,
  disbursalDate: '2000-01-01',
  paymentFrequency: 'Monthly',
  interestRateChanges: [
    { newInterestRate: 5.25, effectiveDate: '2000-01-01' },
    { newInterestRate: 6, effectiveDate: '2005-06-01' },
  ],
  version: 1,
})
// 024: 360 balances following the schedule with a wave on top; every 50th is blank and the last is below $0.
const actualBalancesFixture = () => ({
  currencyCode: 'AUD',
  periodCount: 360,
  balances: Array.from({ length: 360 }, (_, index) => {
    const period = index + 1
    return period % 50 === 0 ? null : (500000 - period * 1388.89 + 8000 * Math.sin(period / 20)).toFixed(2)
  }),
})
// 027: 120 balances falling $2,000 a month, so the forecast starts at row 121, is $0.00 at row 250 and blank after.
const forecastBalancesFixture = () => ({
  currencyCode: 'AUD',
  periodCount: 360,
  balances: Array.from({ length: 120 }, (_, index) => (500000 - (index + 1) * 2000).toFixed(2)),
})
// Mortgage 1 has one change, Mortgage 2 has 60 (monthly from the disbursal date).
const rateFixtures = () => [
  { ...mortgageFixture(1), name: 'One rate', interestRateChanges: [{ newInterestRate: 5.25, effectiveDate: '2000-01-01' }] },
  {
    ...mortgageFixture(2),
    name: 'Sixty rates',
    interestRateChanges: Array.from({ length: 60 }, (_, index) => ({
      newInterestRate: 5 + (index % 4) / 4,
      effectiveDate: `${2000 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`,
    })),
  },
]

type Mock = {
  theme: Theme | 'System'
  session: Session
  themeLoadFails: boolean
  failWrites: boolean
  ended: boolean
  mortgages: MortgagesMode
  /** The saved Amortization Schedule view, or 'delay' to answer only after 5 s. */
  loanPayoffTimeline: 'Burndown' | 'Schedule' | 'delay'
  /** Link the first mortgage to an account whose balances (some blank, the last below $0) are plotted (024). */
  actualBalances: boolean
  /** With `actualBalances`, answer with balances that stop early, so a forecast follows them (027). */
  forecast: boolean
  /** What opening an asset finds (029); 'expiring' gives an edit that lasts 1.5 s. */
  asset: 'open' | 'blocked' | 'ended' | 'expiring'
  /** When the mocked route received the saved-view request (ms since epoch). */
  loanPayoffTimelineRequestedAt?: number
}

async function mockApi(page: Page, options: Partial<Mock> = {}): Promise<Mock> {
  const mock: Mock = {
    theme: 'Light',
    session: 'ok',
    themeLoadFails: false,
    failWrites: false,
    ended: false,
    mortgages: 'ok',
    loanPayoffTimeline: 'Burndown',
    actualBalances: false,
    forecast: false,
    asset: 'open',
    ...options,
  }
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const search = new URL(request.url()).searchParams

    if (path === '/api/security/session') {
      if (mock.session === 'hang') return new Promise<void>(() => {})
      if (mock.session === 'unauthorized') return route.fulfill({ status: 401, json: { title: 'Unauthorized' } })
      if (mock.session === 'error') return route.fulfill({ status: 500, json: { title: 'Server error' } })
      return route.fulfill({ json: { id: 'browser-user', roles: ['Administrator'] } })
    }
    if (path === '/api/security/csrf-token') return route.fulfill({ json: { requestToken: 'test-token' } })
    if (path === '/api/assets' && method === 'GET') return route.fulfill({ json: assetList })
    if (path === `/api/assets/${assetId}/edits` && method === 'POST') {
      const now = Date.now()
      if (mock.asset === 'blocked') {
        return route.fulfill({ status: 409, json: {
          title: 'This asset is being edited in another session.',
          status: 409,
          errors: { code: ['AssetEditActive'] },
          editStatus: {
            assetId, availability: 'Blocked',
            activeEdit: { id: assetEditId, expiresAtUtc: '2099-01-01T00:00:00Z' }, watchedEdit: null,
          },
        } })
      }
      const lifetime = mock.asset === 'expiring' ? 1500 : 300_000
      return route.fulfill({ status: 201, json: {
        editId: assetEditId,
        serverTimeUtc: new Date(now).toISOString(),
        expiresAtUtc: new Date(now + lifetime).toISOString(),
        asset: assetDetail,
      } })
    }
    if (path === `/api/assets/${assetId}/edit-status`) {
      const activeEdit = { id: assetEditId, expiresAtUtc: '2099-01-01T00:00:00Z' }
      if (!search.get('editId')) {
        return route.fulfill({ json: { assetId, availability: 'Blocked', activeEdit, watchedEdit: null } })
      }
      if (mock.asset === 'ended') {
        return route.fulfill({ json: {
          assetId, availability: 'Available', activeEdit: null,
          watchedEdit: {
            id: assetEditId, state: 'Ended', endedAtUtc: '2026-01-01T00:00:00Z',
            endedBy: { userId: 'browser-user', userName: 'owner@example.test' },
          },
        } })
      }
      return route.fulfill({ json: {
        assetId, availability: 'Blocked', activeEdit,
        watchedEdit: { id: assetEditId, state: 'Active', expiresAtUtc: '2099-01-01T00:00:00Z' },
      } })
    }
    if (path === '/api/preferences/navigation') return route.fulfill({ json: { state: 'Unpinned' } })
    if (path === '/api/preferences/loan-payoff-timeline') {
      if (method === 'PUT') {
        const body = request.postDataJSON() as { view: 'Burndown' | 'Schedule' }
        return route.fulfill({ json: { view: body.view } })
      }
      mock.loanPayoffTimelineRequestedAt = Date.now()
      if (mock.loanPayoffTimeline === 'delay') {
        await new Promise((resolve) => setTimeout(resolve, 5000))
        return route.fulfill({ json: { view: 'Schedule' } }).catch(() => undefined)
      }
      return route.fulfill({ json: { view: mock.loanPayoffTimeline } })
    }
    if (path === '/api/preferences/theme') {
      if (mock.themeLoadFails) return route.fulfill({ status: 500, json: { title: 'Preference failure' } })
      return route.fulfill({ json: { mode: mock.theme } })
    }
    if (path === '/api/mortgages' && method === 'GET') {
      if (mock.mortgages === 'hang') return new Promise<void>(() => {})
      if (mock.mortgages === 'error') return route.fulfill({ status: 500, json: { title: 'Server error' } })
      if (mock.mortgages === 'rates') return route.fulfill({ json: rateFixtures() })
      const count = mock.mortgages === 'empty' ? 0 : mock.mortgages === 'many' ? 10 : 3
      return route.fulfill({
        json: Array.from({ length: count }, (_, index) => (
          mock.actualBalances && index === 0 ? { ...mortgageFixture(index), accountId: otherAccountId } : mortgageFixture(index)
        )),
      })
    }
    if (path === '/api/mortgages' && method === 'POST' && !mock.failWrites) {
      const body = request.postDataJSON() as Record<string, unknown>
      return route.fulfill({ status: 201, json: { ...mortgageFixture(5), ...body, id: '550e8400-e29b-41d4-a716-446655440299', version: 1 } })
    }
    if (method !== 'GET') {
      if (mock.failWrites) {
        return route.fulfill({
          status: 400,
          json: { title: 'Validation failed', detail: 'The request could not be saved. Check the values and try again.' },
        })
      }
      if (path === `/api/accounts/${accountId}/import-reviews`) return route.fulfill({ status: 201, json: importReview })
      if (method === 'PUT' && path === '/api/admin/import-limits') return route.fulfill({ json: limits })
      return route.fulfill({ status: 204 })
    }
    if (path === '/api/mortgages/period-balances') {
      return route.fulfill({ json: mock.forecast ? forecastBalancesFixture() : actualBalancesFixture() })
    }
    if (path === '/api/accounts') return route.fulfill({ json: accounts })
    if (path === '/api/currencies') return route.fulfill({ json: [currency, usd] })
    if (path === `/api/accounts/${accountId}`) return route.fulfill({ json: accounts[0] })
    if (path === `/api/accounts/${accountId}/transactions`) {
      return route.fulfill({ json: { items: transactions, nextCursor: null } })
    }
    if (path === `/api/accounts/${accountId}/import-settings`) return route.fulfill({ json: { mapping: null } })
    if (path === `/api/accounts/${accountId}/import-status`) {
      const watching = search.get('reviewId')
      if (!watching) {
        return route.fulfill({ json: { accountId, availability: 'Available', activeImport: null, watchedImport: null } })
      }
      if (mock.ended) {
        return route.fulfill({ json: {
          accountId,
          availability: 'Available',
          activeImport: null,
          watchedImport: {
            id: watching,
            state: 'Ended',
            endedAtUtc: '2024-01-01T00:00:00Z',
            endedBy: { userId: 'other-user', userName: 'Another User' },
          },
        } })
      }
      return route.fulfill({ json: {
        accountId,
        availability: 'Blocked',
        activeImport: { id: watching, stage: 'Preview', canEnd: true, expiresAtUtc: '2099-01-01T00:00:00Z' },
        watchedImport: { id: watching, state: 'Ready', expiresAtUtc: '2099-01-01T00:00:00Z' },
      } })
    }
    if (path === '/api/category-nodes') return route.fulfill({ json: categoryNodes })
    if (/^\/api\/category-nodes\/[^/]+\/deletion-impact$/.test(path)) return route.fulfill({ json: { itemCount: 1 } })
    if (path === '/api/admin/import-limits') return route.fulfill({ json: limits })
    return route.fulfill({ status: 404, json: { title: `Unexpected request: ${path}` } })
  })
  return mock
}

const limits = { maxFileSizeBytes: 1000000, maxRowsPerImport: 1000, maxImportAttemptsPerUserPerMinute: 5 }

async function forceDark(page: Page) {
  await page.evaluate(() => document.documentElement.classList.add('dark'))
}

async function expectTheme(page: Page, theme: Theme) {
  await expect(page.locator('html')).toHaveClass(theme === 'Dark' ? /dark/ : /^(?!.*dark)/)
}

async function openAccountDetails(page: Page) {
  await page.getByRole('button', { name: new RegExp(longName) }).click()
  await expect(page.getByRole('heading', { name: 'Account Details' })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
}

async function openImportMapping(page: Page) {
  await openAccountDetails(page)
  await page.getByRole('button', { name: 'Import Transactions' }).click()
  await expect(page.getByRole('heading', { name: 'Import Transactions' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled()
  await page.locator('#csv-file').setInputFiles(csv)
  await expect(page.getByRole('heading', { name: 'Map CSV Columns' })).toBeVisible()
}

async function fillMapping(page: Page) {
  await page.getByLabel('Transaction Date Column').selectOption('0')
  await page.getByLabel('Description Column').selectOption('1')
  await page.getByLabel('Date Format').selectOption('yyyy-MM-dd')
  await page.getByLabel('Signed Amount Column').selectOption('2')
  await page.getByLabel('Incoming Transactions Use').selectOption('Positive')
  await page.getByLabel('Number Format Used in This File').selectOption('dot-decimal-comma-grouping')
}

async function openImportReview(page: Page) {
  await openImportMapping(page)
  await fillMapping(page)
  await page.getByRole('button', { name: 'Review Import' }).click()
  await expect(page.getByRole('heading', { name: 'Review Transactions' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel Review' })).toBeEnabled()
}

async function openMortgages(page: Page) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Mortgages' }).click()
  await page.mouse.move(600, 400)
}

async function fillNewMortgage(page: Page) {
  await page.getByLabel('Name', { exact: true }).fill('Holiday house')
  await page.getByLabel('Opening Balance').fill('250000')
  await page.getByLabel('Duration').fill('120')
  await page.getByLabel('Disbursal Date').fill('2020-01-01')
  await page.getByLabel('Payment Frequency').selectOption('Monthly')
  await page.getByRole('button', { name: 'Interest Rates' }).click()
  const dialog = page.getByRole('dialog', { name: 'Interest Rates' })
  await dialog.getByLabel('New Interest Rate').fill('4.5')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
}

const rateDialog = (page: Page) => page.getByRole('dialog', { name: 'Interest Rates' })

const timelineGroup = (page: Page) => page.getByRole('region', { name: 'Amortization Schedule' })

const timelineTooltip = (page: Page) => page.locator('[data-slot="tooltip-popup"]')

async function openRateDialog(page: Page) {
  await page.getByRole('button', { name: 'Interest Rates' }).click()
  await expect(rateDialog(page)).toBeVisible()
  await page.mouse.move(5, 5)
}

async function openAssets(page: Page) {
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Assets' }).click()
  await page.mouse.move(600, 400)
  await expect(page.getByRole('row', { name: /^Total USD/ })).toBeVisible()
}

async function openAsset(page: Page) {
  await openAssets(page)
  await page.getByRole('button', { name: longAssetName, exact: true }).click()
}

const regularToasts = (page: Page) => page.getByRole('region', { name: 'Notifications', exact: true })
const persistentToasts = (page: Page) => page.getByRole('region', { name: 'Persistent notifications' })

/** Lets an edit expire, then deletes an asset so a regular toast joins the persistent one. */
async function showBothToastStacks(page: Page) {
  await openAsset(page)
  await expect(persistentToasts(page).getByRole('status')).toContainText('expired')
  await page.getByRole('button', { name: 'Delete Car' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(regularToasts(page).getByRole('status')).toContainText('Car was deleted.')
}

type StateDef = {
  name: string
  /** Pre-auth states and the theme-load failure never receive the theme from the API. */
  manualDark?: boolean
  mock?: Partial<Mock>
  reach: (page: Page, mock: Mock) => Promise<void>
}

const signedIn = { session: 'ok' } as const

/** Scrolls the content panel until the schedule's row for `period` sits just below the sticky header. */
async function scrollScheduleTo(page: Page, period: number) {
  const table = timelineGroup(page).getByRole('table')
  await expect(table).toBeVisible()
  const row = table.locator(`[role="row"][aria-rowindex="${period + 1}"]`)
  await table.evaluate((element, rowsAbove) => {
    let scroller = element.parentElement
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
    if (!scroller) return
    // The header and every body row are 40 px tall.
    scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + rowsAbove * 40
  }, period - 2)
  // Any part: at 320 px most of the row's width is off screen.
  await expect(row).toBeInViewport()
}

const states: StateDef[] = [
  {
    name: 'sign-in', manualDark: true, mock: { session: 'unauthorized' },
    reach: async (page) => { await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible() },
  },
  {
    name: 'sign-in-errors', manualDark: true, mock: { session: 'unauthorized' },
    reach: async (page, mock) => {
      await page.getByLabel('Email').fill('person@example.com')
      await page.getByLabel('Password').fill('not-a-real-password')
      mock.failWrites = true
      await page.getByRole('button', { name: 'Sign In' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
  },
  {
    name: 'sign-in-field-focused', manualDark: true, mock: { session: 'unauthorized' },
    reach: async (page) => {
      await page.getByLabel('Email').focus()
      await expect(page.getByLabel('Email')).toBeFocused()
    },
  },
  {
    name: 'sign-in-field-filled', manualDark: true, mock: { session: 'unauthorized' },
    reach: async (page) => {
      await page.getByLabel('Email').fill('person@example.com')
      await page.getByRole('heading', { name: 'Sign In' }).click()
    },
  },
  {
    name: 'startup-loading', manualDark: true, mock: { session: 'hang' },
    reach: async (page) => { await expect(page.getByRole('status')).toContainText('Checking Your Session') },
  },
  {
    name: 'accounts', mock: signedIn,
    reach: async (page) => { await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible() },
  },
  {
    name: 'accounts-create-errors', mock: signedIn,
    reach: async (page, mock) => {
      await page.getByLabel('Account Description').fill('Savings')
      await page.getByLabel('Currency').selectOption('AUD')
      mock.failWrites = true
      await page.getByRole('button', { name: 'Add Account' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
  },
  {
    name: 'nav-expanded', mock: signedIn,
    reach: async (page) => {
      await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
      // The rail expands on mouse hover (keyboard focus no longer expands it; see layout-navigation.md).
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Accounts' }).hover()
      await expect(page.getByRole('navigation', { name: 'Primary' }).getByText('Categories')).toBeVisible()
    },
  },
  {
    name: 'account-details', mock: signedIn,
    reach: async (page) => { await openAccountDetails(page) },
  },
  {
    name: 'account-details-errors', mock: signedIn,
    reach: async (page, mock) => {
      await openAccountDetails(page)
      await page.getByLabel('Account Description').fill('Renamed account')
      mock.failWrites = true
      await page.getByRole('button', { name: 'Save Description' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
  },
  {
    name: 'delete-transaction-dialog', mock: signedIn,
    reach: async (page) => {
      await openAccountDetails(page)
      await page.getByRole('button', { name: 'Delete transaction' }).first().click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'import-mapping', mock: signedIn,
    reach: async (page) => { await openImportMapping(page) },
  },
  {
    name: 'import-mapping-errors', mock: signedIn,
    reach: async (page, mock) => {
      await openImportMapping(page)
      await fillMapping(page)
      mock.failWrites = true
      await page.getByRole('button', { name: 'Review Import' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
  },
  {
    name: 'import-review', mock: signedIn,
    reach: async (page) => {
      await openImportReview(page)
      await expect(page.getByText('Possible Duplicate', { exact: true })).toBeVisible()
      await expect(page.getByRole('checkbox')).toBeVisible()
    },
  },
  {
    name: 'import-ended-dialog', mock: signedIn,
    reach: async (page, mock) => {
      await openImportReview(page)
      mock.ended = true
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(page.getByRole('dialog', { name: 'Import Ended' })).toBeVisible({ timeout: 10_000 })
    },
  },
  {
    name: 'categories', mock: signedIn,
    reach: async (page) => {
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Categories' }).click()
      await expect(page.getByRole('group', { name: 'Groups and categories' })).toBeVisible()
      await page.mouse.move(600, 400)
    },
  },
  {
    name: 'categories-errors', mock: signedIn,
    reach: async (page, mock) => {
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Categories' }).click()
      await page.mouse.move(600, 400)
      await page.getByLabel('Name', { exact: true }).fill('Utilities')
      mock.failWrites = true
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await page.mouse.move(600, 400)
    },
  },
  {
    name: 'delete-category-panel', mock: signedIn,
    reach: async (page) => {
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Categories' }).click()
      await page.mouse.move(600, 400)
      await page.getByRole('button', { name: 'Delete Groceries' }).click()
      await expect(page.getByRole('alertdialog')).toContainText('This will permanently delete Groceries')
      await page.mouse.move(600, 400)
    },
  },
  {
    name: 'mortgages-loading', mock: { ...signedIn, mortgages: 'hang' },
    reach: async (page) => {
      await openMortgages(page)
      await expect(page.getByRole('status')).toContainText('Loading...')
    },
  },
  {
    name: 'mortgages-failed', mock: { ...signedIn, mortgages: 'error' },
    reach: async (page) => {
      await openMortgages(page)
      await expect(page.getByRole('alert')).toContainText('load your mortgages')
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
    },
  },
  {
    name: 'mortgages-empty', mock: { ...signedIn, mortgages: 'empty' },
    reach: async (page) => {
      await openMortgages(page)
      await expect(page.getByText('Please enter your mortgage details')).toHaveCount(1)
    },
  },
  {
    name: 'mortgages-loaded', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await expect(timelineGroup(page).getByRole('img', { name: /balance over time/i })).toBeVisible()
    },
  },
  {
    name: 'mortgages-field-errors', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await page.getByLabel('Name', { exact: true }).fill('')
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await page.mouse.move(600, 400)
    },
  },
  {
    name: 'mortgages-delete-dialog', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await page.getByRole('button', { name: 'Mortgage 2', exact: true }).click()
      await page.getByRole('button', { name: 'Delete Mortgage 2' }).click()
      await expect(page.getByRole('dialog', { name: 'Delete Mortgage 2?' })).toBeVisible()
    },
  },
  {
    name: 'mortgages-rate-dialog', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await openRateDialog(page)
    },
  },
  {
    name: 'mortgages-rate-dialog-60', mock: { ...signedIn, mortgages: 'rates' },
    reach: async (page) => {
      await openMortgages(page)
      await page.getByRole('button', { name: 'Sixty rates', exact: true }).click()
      await openRateDialog(page)
    },
  },
  {
    name: 'mortgages-rate-dialog-errors', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await openRateDialog(page)
      await rateDialog(page).getByLabel('New Interest Rate').fill('100.5')
      await rateDialog(page).getByLabel('Effective Date').fill('2005-06-01')
      await rateDialog(page).getByRole('button', { name: 'Add', exact: true }).click()
      await expect(rateDialog(page).getByText('Enter an interest rate from 0 to 100')).toBeVisible()
    },
  },
  {
    name: 'mortgages-discard-dialog', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await page.getByLabel('Name', { exact: true }).fill('Edited name')
      await page.getByRole('button', { name: 'Mortgage 2', exact: true }).click()
      await expect(page.getByRole('dialog', { name: 'Discard Unsaved Changes?' })).toBeVisible()
    },
  },
  {
    name: 'mortgages-saved-toast', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await page.getByRole('button', { name: 'Add Mortgage' }).click()
      await fillNewMortgage(page)
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Mortgage saved' })).toBeVisible()
    },
  },
  {
    name: 'mortgages-timeline-burndown', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await expect(timelineGroup(page).getByRole('img', { name: /balance over time/i })).toBeVisible()
      // 023: the Bank Schedule line is plotted.
      await expect(timelineGroup(page).locator('path[data-series="schedule"][data-part="line"]')).toBeVisible()
    },
  },
  {
    name: 'mortgages-burndown-actual', mock: { ...signedIn, actualBalances: true },
    reach: async (page) => {
      await openMortgages(page)
      const chart = timelineGroup(page).getByRole('img', { name: /Actual Balance/ })
      await expect(chart).toBeVisible()
      await expect(chart.locator('path[data-series="actual"][data-part="line"]')).toBeVisible()
    },
  },
  {
    name: 'mortgages-burndown-forecast', mock: { ...signedIn, actualBalances: true, forecast: true },
    reach: async (page) => {
      await openMortgages(page)
      const chart = timelineGroup(page).getByRole('img', { name: /Forecast Balance/ })
      await expect(chart).toBeVisible()
      await expect(chart.locator('path[data-series="forecast"][data-part="line"]')).toBeVisible()
    },
  },
  {
    name: 'mortgages-schedule-forecast',
    mock: { ...signedIn, loanPayoffTimeline: 'Schedule', actualBalances: true, forecast: true },
    reach: async (page) => {
      await openMortgages(page)
      await expect(timelineGroup(page).getByRole('columnheader', { name: 'Forecast Balance' })).toBeVisible()
      await scrollScheduleTo(page, 121)
    },
  },
  {
    name: 'mortgages-timeline-schedule', mock: { ...signedIn, loanPayoffTimeline: 'Schedule' },
    reach: async (page) => {
      await openMortgages(page)
      await expect(timelineGroup(page).getByRole('table')).toBeVisible()
    },
  },
  {
    name: 'mortgages-timeline-tooltip-hover', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await page.getByRole('button', { name: 'Show Amortization Schedule' }).hover()
      await expect(timelineTooltip(page)).toBeVisible()
    },
  },
  {
    name: 'mortgages-timeline-tooltip-focus', mock: { ...signedIn, loanPayoffTimeline: 'Schedule' },
    reach: async (page) => {
      await openMortgages(page)
      const button = page.getByRole('button', { name: 'Show Burndown Chart' })
      await button.focus()
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Tab')
      await expect(button).toBeFocused()
      await expect(timelineTooltip(page)).toBeVisible()
    },
  },
  {
    name: 'assets', mock: signedIn,
    reach: async (page) => { await openAssets(page) },
  },
  {
    name: 'assets-delete-dialog', mock: signedIn,
    reach: async (page) => {
      await openAssets(page)
      await page.getByRole('button', { name: 'Delete Car' }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
    },
  },
  {
    name: 'asset-new-errors', mock: signedIn,
    reach: async (page) => {
      await openAssets(page)
      await page.getByRole('button', { name: 'Add Asset' }).click()
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByText('Add at least one valuation')).toBeVisible()
    },
  },
  {
    name: 'asset-valuation-dialog-errors', mock: signedIn,
    reach: async (page) => {
      await openAsset(page)
      await page.getByRole('button', { name: 'Add Valuation' }).click()
      const dialog = page.getByRole('dialog', { name: 'Add Valuation' })
      await dialog.getByRole('button', { name: 'OK' }).click()
      await expect(dialog.getByText('Enter a value')).toBeVisible()
    },
  },
  {
    name: 'asset-edit', mock: signedIn,
    reach: async (page) => {
      await openAsset(page)
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue(longAssetName)
    },
  },
  {
    name: 'asset-blocked', mock: { ...signedIn, asset: 'blocked' },
    reach: async (page) => {
      await openAsset(page)
      await expect(page.getByRole('button', { name: 'End Other Edit' })).toBeVisible()
    },
  },
  {
    name: 'asset-edit-ended', mock: { ...signedIn, asset: 'ended' },
    reach: async (page) => {
      await openAsset(page)
      await expect(page.getByRole('alertdialog', { name: 'Edit Ended' })).toBeVisible()
    },
  },
  {
    name: 'assets-persistent-toast', mock: { ...signedIn, asset: 'expiring' },
    reach: async (page) => {
      await showBothToastStacks(page)
      // Holding the pointer over the regular toast keeps it open while the checks run.
      await regularToasts(page).getByRole('status').hover()
    },
  },
  {
    name: 'import-limits', mock: signedIn,
    reach: async (page) => {
      await page.getByRole('button', { name: 'Import Limits' }).click()
      await expect(page.getByRole('heading', { name: 'Import Limits', level: 1 })).toBeVisible()
    },
  },
  {
    name: 'import-limits-errors', mock: signedIn,
    reach: async (page, mock) => {
      await page.getByRole('button', { name: 'Import Limits' }).click()
      await page.getByLabel('Maximum Rows per Import').fill('2000')
      mock.failWrites = true
      await page.getByRole('button', { name: 'Save Limits' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
  },
  {
    name: 'theme-selector-error', manualDark: true, mock: { themeLoadFails: true },
    reach: async (page) => {
      await expect(page.getByRole('alert')).toContainText('Your saved theme could not be loaded')
    },
  },
  {
    name: 'sign-up', manualDark: true, mock: { session: 'unauthorized' },
    reach: async (page) => {
      await page.getByRole('button', { name: 'New Here? Create an Account' }).click()
      await expect(page.getByLabel('Password')).toHaveAccessibleDescription(/at least 12 characters/)
    },
  },
  {
    name: 'session-error', manualDark: true, mock: { session: 'error' },
    reach: async (page) => {
      await expect(page.getByRole('alert')).toContainText('Unable to load your session')
      await expect(page.getByRole('button', { name: 'Try Again' })).toBeVisible()
    },
  },
]

const axeTags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']

/** Lets colour transitions (0.01ms under reduced motion) finish before computed styles are read. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
  await page.waitForTimeout(50)
}

async function expectSurfaces(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const problems: string[] = []
    const resolve = (token: string) => {
      const probe = document.createElement('div')
      probe.style.backgroundColor = `rgb(var(--${token}))`
      document.body.appendChild(probe)
      const value = getComputedStyle(probe).backgroundColor
      probe.remove()
      return value
    }
    const hasZeroBorder = (element: Element) => {
      const style = getComputedStyle(element)
      return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
        .every((width) => width === '0px')
    }
    const rgb = (value: string) => (value.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
    const luminance = (value: string) => {
      const [r = 0, g = 0, b = 0] = rgb(value).map((channel) => {
        const v = channel / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    const canvas = resolve('surface-canvas')
    const content = resolve('surface-content')
    const card = resolve('surface-card')

    const nav = document.querySelector('nav[aria-label="Primary"]')
    // The navigation sits on a canvas backing layer (its previous sibling); the nav element itself is transparent.
    const backing = nav?.previousElementSibling
    if (backing && getComputedStyle(backing).backgroundColor !== canvas) problems.push('nav is not canvas')
    const main = document.querySelector('main')
    if (!main) {
      problems.push('no main')
    } else {
      const style = getComputedStyle(main)
      if (style.backgroundColor !== content) problems.push(`main is ${style.backgroundColor}, not content`)
      if (style.borderTopLeftRadius !== '22px') problems.push(`main radius ${style.borderTopLeftRadius}`)
    }
    for (const element of document.querySelectorAll('nav[aria-label="Primary"], main, header')) {
      if (!hasZeroBorder(element)) problems.push(`${element.tagName.toLowerCase()} has a border`)
    }
    for (const element of document.querySelectorAll('[data-slot="card"]')) {
      const style = getComputedStyle(element)
      if (style.backgroundColor !== card) problems.push(`card is ${style.backgroundColor}, not card`)
      if (style.borderTopLeftRadius !== '16px') problems.push(`card radius ${style.borderTopLeftRadius}`)
      if (!hasZeroBorder(element)) problems.push('card has a border')
    }
    const current = nav?.querySelector('[aria-current="page"]')
    if (current) {
      // The selected item is a tint over the canvas, so judge its label against the blended tint.
      const style = getComputedStyle(current)
      const [tr = 0, tg = 0, tb = 0, ta = 1] = (style.backgroundColor.match(/[\d.]+/g) ?? []).map(Number)
      const [cr = 0, cg = 0, cb = 0] = rgb(canvas)
      const blended = `rgb(${tr * ta + cr * (1 - ta)}, ${tg * ta + cg * (1 - ta)}, ${tb * ta + cb * (1 - ta)})`
      const a = luminance(style.color)
      const b = luminance(blended)
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      if (ratio < 3) problems.push(`current nav item contrast ${ratio.toFixed(2)}`)
    }
    return problems
  }), { timeout: 3000 }).toEqual([])
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

async function expectFocusRings(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const problems: string[] = []
  const seen = new Set<string>()
  for (let step = 0; step < 60; step += 1) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const element = document.activeElement
      if (!element || element === document.body) return null
      if (element.hasAttribute('data-base-ui-focus-guard') || element.closest('[data-base-ui-focus-guard]')) return { skip: true, marker: '', already: false, label: '', outlineStyle: '', outlineWidth: 0 }
      const style = getComputedStyle(element)
      const marker = element.getAttribute('data-sweep') ?? `sweep-${Math.random().toString(36).slice(2)}`
      const already = element.hasAttribute('data-sweep')
      element.setAttribute('data-sweep', marker)
      const label = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} ${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 30)}`
      return {
        marker, already, label, skip: false,
        outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth),
      }
    })
    if (!info) continue
    if (info.skip) continue
    if (info.already || seen.has(info.marker)) break
    seen.add(info.marker)
    if (info.outlineStyle === 'none' || info.outlineWidth < 2) {
      problems.push(`${info.label}: outline ${info.outlineStyle} ${info.outlineWidth}px`)
    }
  }
  expect(problems).toEqual([])
}

async function expectNoPureBlackOrWhite(page: Page) {
  const offenders = await page.evaluate(() => {
    const found: string[] = []
    for (const element of document.querySelectorAll('body, body *')) {
      const style = getComputedStyle(element)
      if (style.backgroundColor === 'rgb(0, 0, 0)') found.push(`${element.tagName} background`)
      if (style.color === 'rgb(255, 255, 255)') found.push(`${element.tagName} text`)
    }
    return found.slice(0, 10)
  })
  expect(offenders).toEqual([])
}

async function runChecks(page: Page, name: string, theme: Theme) {
  await settle(page)
  await expectSurfaces(page)
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze()
  expect(results.violations, JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([])
  await expectNoHorizontalScroll(page)
  if (theme === 'Dark') await expectNoPureBlackOrWhite(page)
  if (process.env.STYLE_SCREENSHOTS === '1') {
    await expect(page).toHaveScreenshot(`${name}-${theme}.png`, { fullPage: true, mask: [page.locator('.animate-spin')] })
  }
  await expectFocusRings(page)
}

async function reachState(page: Page, state: StateDef, theme: Theme) {
  const mock = await mockApi(page, { ...state.mock, theme })
  await page.goto('/')
  await state.reach(page, mock)
  if (state.manualDark && theme === 'Dark') await forceDark(page)
  else if (!state.manualDark) await expectTheme(page, theme)
  return mock
}

for (const theme of ['Light', 'Dark'] as const) {
  for (const state of states) {
    test(`${state.name} [${theme}]`, async ({ page }) => {
      await reachState(page, state, theme)
      await runChecks(page, state.name, theme)
    })
  }
}

// 023: the Bank Schedule line, framed on the chart itself (the page screenshots clip it below the fold).
for (const theme of ['Light', 'Dark'] as const) {
  test(`mortgages burndown line [${theme}]`, async ({ page }) => {
    await reachState(page, states.find((state) => state.name === 'mortgages-timeline-burndown')!, theme)
    const chart = timelineGroup(page).getByRole('img', { name: /falling from/i })
    await chart.scrollIntoViewIfNeeded()
    await expect(chart.locator('path[data-series="schedule"][data-part="line"]')).toBeVisible()
    await settle(page)
    await expect(chart).toHaveScreenshot(`mortgages-burndown-line-${theme}.png`)
  })
}

// 024: the two-line chart (solid Actual Balance over Bank Schedule, axis below $0), on the chart itself and at 320 px.
for (const theme of ['Light', 'Dark'] as const) {
  test(`mortgages burndown actual balance line [${theme}]`, async ({ page }) => {
    await reachState(page, states.find((state) => state.name === 'mortgages-burndown-actual')!, theme)
    const chart = timelineGroup(page).getByRole('img', { name: /Actual Balance/ })
    await chart.scrollIntoViewIfNeeded()
    await settle(page)
    await expect(chart).toHaveScreenshot(`mortgages-burndown-actual-${theme}.png`)
  })

  test(`mortgages burndown actual balance line at 320 px has no sideways scroll [${theme}]`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await reachState(page, states.find((state) => state.name === 'mortgages-burndown-actual')!, theme)
    const chart = timelineGroup(page).getByRole('img', { name: /Actual Balance/ })
    await chart.scrollIntoViewIfNeeded()
    await settle(page)
    await expectNoHorizontalScroll(page)
    await expect(chart).toHaveScreenshot(`mortgages-burndown-actual-${theme}-320.png`)
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze()
    expect(results.violations).toEqual([])
  })
}

// 026: the hover label, band and rings. The style-guide config runs with reduced motion.
async function reachBurndownValues(page: Page, theme: Theme) {
  await reachState(page, states.find((state) => state.name === 'mortgages-burndown-actual')!, theme)
  const values = timelineGroup(page).getByRole('group', { name: 'Burndown Values' })
  await values.scrollIntoViewIfNeeded()
  await expect(values.locator('path[data-series="actual"][data-part="line"]')).toBeVisible()
  return values
}

const burndownLabel = (page: Page) => timelineGroup(page).locator('[data-slot="burndown-label"]')

/** The label's box lies within the chart group's box, and its text has 4.5:1 against its surface. */
async function expectLabelInsideAndReadable(page: Page) {
  const values = timelineGroup(page).getByRole('group', { name: 'Burndown Values' })
  const label = burndownLabel(page)
  await expect(label).toBeVisible()
  const chartBox = await values.boundingBox()
  const labelBox = await label.boundingBox()
  if (!chartBox || !labelBox) throw new Error('No chart or label box')
  expect(labelBox.x).toBeGreaterThanOrEqual(chartBox.x - 0.5)
  expect(labelBox.y).toBeGreaterThanOrEqual(chartBox.y - 0.5)
  expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(chartBox.x + chartBox.width + 0.5)
  expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(chartBox.y + chartBox.height + 0.5)
  const ratios = await label.evaluate((element) => {
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
    const luminance = (value: string) => {
      const [r = 0, g = 0, b = 0] = parse(value).map((channel) => {
        const v = channel / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const background = luminance(getComputedStyle(element).backgroundColor)
    return Array.from(element.querySelectorAll('p, dt, dd')).map((text) => {
      const foreground = luminance(getComputedStyle(text).color)
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
    })
  })
  expect(ratios.length).toBeGreaterThan(0)
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5)
}

for (const theme of ['Light', 'Dark'] as const) {
  test(`mortgages burndown hover label stays inside the chart and is readable [${theme}]`, async ({ page }) => {
    const values = await reachBurndownValues(page, theme)
    const area = values.locator('rect[data-part="pointer-area"]')
    const box = await area.boundingBox()
    if (!box) throw new Error('No plot area')

    // First and last dates, where the label is most likely to spill out (FR-010, SC-005).
    await page.mouse.move(box.x + 1, box.y + box.height / 2)
    await expect(burndownLabel(page)).toContainText('Bank Schedule')
    await expectLabelInsideAndReadable(page)
    await page.mouse.move(box.x + box.width - 1, box.y + box.height / 2)
    await expectLabelInsideAndReadable(page)

    // A date with both series, for the screenshot and axe with the label shown.
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2)
    await expect(burndownLabel(page)).toContainText('Actual Balance')
    await expectLabelInsideAndReadable(page)
    // No motion on the overlay under reduced motion (FR-010): it declares none, so only the app-wide
    // reduced-motion rule's 0.01ms applies.
    const durationMs = (value: string) => (value.trim().endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000)
    const durations = await values.evaluate((element) => Array.from(
      element.querySelectorAll('[data-slot="burndown-label"], rect[data-part="band"], circle[data-part="ring"]'),
    ).map((part) => {
      const style = getComputedStyle(part)
      return [style.transitionDuration, style.animationDuration]
    }))
    expect(durations.length).toBeGreaterThanOrEqual(3)
    for (const [transition = '', animation = ''] of durations) {
      expect(transition.split(',').every((value) => durationMs(value) <= 0.01)).toBe(true)
      expect(animation.split(',').every((value) => durationMs(value) <= 0.01)).toBe(true)
    }
    await settle(page)
    const results = await new AxeBuilder({ page }).withTags(axeTags).analyze()
    expect(results.violations, JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([])
    await expect(values).toHaveScreenshot(`mortgages-burndown-hover-${theme}.png`)
  })

  test(`mortgages burndown hover label at 320 px stays inside the chart [${theme}]`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    const values = await reachBurndownValues(page, theme)
    await values.focus()
    for (const key of ['Home', 'End']) {
      await page.keyboard.press(key)
      await expectLabelInsideAndReadable(page)
    }
    await expectNoHorizontalScroll(page)
    await settle(page)
    await expect(values).toHaveScreenshot(`mortgages-burndown-hover-${theme}-320.png`)
  })

  test(`mortgages burndown values group shows a focus ring [${theme}]`, async ({ page }) => {
    const values = await reachBurndownValues(page, theme)
    await page.keyboard.press('Shift+Tab')
    await values.focus()
    await page.keyboard.press('ArrowRight')
    await expect(burndownLabel(page)).toBeVisible()
    const outline = await values.evaluate((element) => {
      const style = getComputedStyle(element)
      return { focusVisible: element.matches(':focus-visible'), style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
    })
    expect(outline.focusVisible).toBe(true)
    expect(outline.style).not.toBe('none')
    expect(outline.width).toBeGreaterThanOrEqual(2)
    await settle(page)
    await expect(timelineGroup(page)).toHaveScreenshot(`mortgages-burndown-focus-${theme}.png`)
  })
}

// 027: the Forecast Balance series and column.
const stateNamed = (name: string) => states.find((state) => state.name === name)!

async function reachForecastValues(page: Page, theme: Theme) {
  await reachState(page, stateNamed('mortgages-burndown-forecast'), theme)
  const values = timelineGroup(page).getByRole('group', { name: 'Burndown Values' })
  await values.scrollIntoViewIfNeeded()
  await expect(values.locator('path[data-series="forecast"][data-part="line"]')).toBeVisible()
  return values
}

/** Points at row 180 of 360, a forecast date, and waits for its label. */
async function hoverForecastDate(page: Page, values: Locator) {
  const box = await values.locator('rect[data-part="pointer-area"]').boundingBox()
  if (!box) throw new Error('No plot area')
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2)
  await expect(burndownLabel(page)).toContainText('Forecast Balance')
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(axeTags).analyze()
  expect(results.violations, JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))).toEqual([])
}

/** Header and cell of the Forecast Balance column are on screen, unclipped and clear of Actual Balance. */
async function expectForecastColumnReadable(page: Page, period: number) {
  const table = timelineGroup(page).getByRole('table')
  const row = table.locator(`[role="row"][aria-rowindex="${period + 1}"]`)
  const header = table.getByRole('columnheader', { name: 'Forecast Balance' })
  const cell = row.getByRole('cell').nth(4)
  await cell.evaluate((element) => element.scrollIntoView({ block: 'nearest', inline: 'end' }))
  for (const [forecast, actual] of [
    [header, table.getByRole('columnheader', { name: 'Actual Balance' })],
    [cell, row.getByRole('cell').nth(3)],
  ] as const) {
    await expect(forecast).toBeInViewport({ ratio: 1 })
    expect(await forecast.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
    const [forecastBox, actualBox] = [await forecast.boundingBox(), await actual.boundingBox()]
    if (!forecastBox || !actualBox) throw new Error('No column box')
    expect(forecastBox.x).toBeGreaterThanOrEqual(actualBox.x + actualBox.width - 0.5)
  }
}

for (const theme of ['Light', 'Dark'] as const) {
  test(`mortgages burndown forecast contrast and distinct colours [${theme}]`, async ({ page }) => {
    const values = await reachForecastValues(page, theme)
    const chart = values.getByRole('img', { name: /Forecast Balance/ })
    await hoverForecastDate(page, values)
    await settle(page)
    const result = await chart.evaluate((svg) => {
      type Rgb = [number, number, number]
      const parse = (value: string): Rgb => {
        const [r = 0, g = 0, b = 0] = (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
        return [r, g, b]
      }
      const resolve = (token: string) => {
        const probe = document.createElement('div')
        probe.style.color = `rgb(var(--${token}))`
        document.body.appendChild(probe)
        const value = getComputedStyle(probe).color
        probe.remove()
        return value
      }
      const linear = (colour: Rgb) => colour.map((channel) => {
        const v = channel / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }) as Rgb
      const luminance = (colour: Rgb) => {
        const [r, g, b] = linear(colour)
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const contrast = (a: Rgb, b: Rgb) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
        return (high + 0.05) / (low + 0.05)
      }
      const oklab = (colour: Rgb): Rgb => {
        const [r, g, b] = linear(colour)
        const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        return [
          0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
        ]
      }
      const distance = (a: Rgb, b: Rgb) => {
        const [x, y] = [oklab(a), oklab(b)]
        return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
      }
      const mix = (from: Rgb, to: Rgb, amount: number): Rgb =>
        [0, 1, 2].map((index) => from[index]! * (1 - amount) + to[index]! * amount) as Rgb
      const stops = (series: string) => Array.from(
        svg.querySelectorAll(`linearGradient[data-series="${series}"]:not([data-part]) stop`),
      ).map((stop) => parse(getComputedStyle(stop).stopColor))
      // Stops at 0, 0.5 and 1: interpolate within the half that holds t.
      const along = ([start, mid, end]: Rgb[], t: number) =>
        t <= 0.5 ? mix(start!, mid!, t * 2) : mix(mid!, end!, (t - 0.5) * 2)

      const problems: string[] = []
      const [schedule, actual, forecast] = [stops('schedule'), stops('actual'), stops('forecast')]
      if ([schedule, actual, forecast].some((series) => series.length !== 3)) return ['expected three stops per series']
      const card = resolve('surface-card')
      const statuses = ['danger', 'warning', 'success', 'info']
        .map((name) => [name, parse(resolve(`status-${name}`))] as const)
      const steps = 401
      for (let step = 0; step < steps; step += 1) {
        const t = step / (steps - 1)
        const colour = along(forecast, t)
        const ratio = contrast(colour, parse(card))
        if (ratio < 3) problems.push(`step ${step} contrast ${ratio.toFixed(2)}`)
        for (const [name, other] of [['schedule', along(schedule, t)], ['actual', along(actual, t)], ...statuses] as const) {
          const gap = distance(colour, other)
          if (gap < 0.1) problems.push(`step ${step} is ${gap.toFixed(3)} from ${name}`)
        }
      }

      return problems
    })
    expect(result).toEqual([])
  })

  test(`mortgages burndown forecast chart and hover label [${theme}]`, async ({ page }) => {
    const values = await reachForecastValues(page, theme)
    await settle(page)
    await expect(values).toHaveScreenshot(`mortgages-burndown-forecast-${theme}.png`)

    await hoverForecastDate(page, values)
    await expectLabelInsideAndReadable(page)
    await settle(page)
    await expectNoViolations(page)
    await expect(values).toHaveScreenshot(`mortgages-burndown-forecast-hover-${theme}.png`)
  })

  test(`mortgages burndown forecast at 320 px stays inside the chart [${theme}]`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    const values = await reachForecastValues(page, theme)
    const chart = values.getByRole('img', { name: /Forecast Balance/ })
    const outside = await chart.evaluate((svg) => {
      const bounds = svg.getBoundingClientRect()
      const selectors = [
        'path[data-series="forecast"][data-part="line"]',
        'path[data-series="forecast"][data-part="area"]',
        '[data-part="legend"][data-series="schedule"]',
        '[data-part="legend"][data-series="actual"]',
        '[data-part="legend"][data-series="forecast"]',
      ]
      const boxes = selectors.map((selector) => [selector, svg.querySelector(selector)!.getBoundingClientRect()] as const)
      const problems = boxes
        .filter(([, box]) => box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5
          || box.top < bounds.top - 0.5 || box.bottom > bounds.bottom + 0.5)
        .map(([selector]) => `${selector} is outside the chart`)
      const legends = boxes.slice(2)
      legends.slice(1).forEach(([selector, box], index) => {
        if (box.left < legends[index]![1].right) problems.push(`${selector} overlaps the entry before it`)
      })
      return problems
    })
    expect(outside).toEqual([])
    await settle(page)
    await expect(values).toHaveScreenshot(`mortgages-burndown-forecast-${theme}-320.png`)

    await hoverForecastDate(page, values)
    await expectLabelInsideAndReadable(page)
    await expectNoHorizontalScroll(page)
    await settle(page)
    await expectNoViolations(page)
    await expect(values).toHaveScreenshot(`mortgages-burndown-forecast-hover-${theme}-320.png`)
  })

  for (const narrow of [false, true]) {
    const suffix = narrow ? '-320' : ''
    test(`mortgages schedule forecast rows${narrow ? ' at 320 px' : ''} [${theme}]`, async ({ page }) => {
      if (narrow) await page.setViewportSize({ width: 320, height: 800 })
      await reachState(page, stateNamed('mortgages-schedule-forecast'), theme)
      const table = timelineGroup(page).getByRole('table')
      const cell = (period: number) => table.locator(`[role="row"][aria-rowindex="${period + 1}"]`).getByRole('cell').nth(4)

      // The first forecast row, then the last positive value, $0.00 and a blank cell.
      for (const [name, period] of [['start', 121], ['end', 249]] as const) {
        await scrollScheduleTo(page, period)
        if (narrow) await expectForecastColumnReadable(page, period)
        await expectNoHorizontalScroll(page)
        await settle(page)
        await expectNoViolations(page)
        await expect(page).toHaveScreenshot(`mortgages-schedule-forecast-${name}-${theme}${suffix}.png`)
      }
      await expect(cell(249)).toHaveText('$2,000.00')
      await expect(cell(250)).toHaveText('$0.00')
      await expect(cell(251)).toHaveText('')
    })
  }
}

// 027: every step of every series gradient reaches 3:1 against the card (WCAG 2.2 SC 1.4.11). Contrast against the
// series fills is not required for the Burndown: an accepted exception (specs/027-forecast-balance/plan.md).
for (const theme of ['Light', 'Dark'] as const) {
  test(`mortgages burndown lines reach 3:1 on the card [${theme}]`, async ({ page }) => {
    const values = await reachForecastValues(page, theme)
    const problems = await values.getByRole('img').evaluate((svg) => {
      const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      const luminance = (colour: number[]) => {
        const [r = 0, g = 0, b = 0] = colour.map((channel) => {
          const v = channel / 255
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const probe = document.createElement('div')
      probe.style.color = 'rgb(var(--surface-card))'
      document.body.appendChild(probe)
      const card = luminance(parse(getComputedStyle(probe).color))
      probe.remove()
      return ['schedule', 'actual', 'forecast'].flatMap((series) => {
        const [start, mid, end] = Array.from(
          svg.querySelectorAll(`linearGradient[data-series="${series}"]:not([data-part]) stop`),
        ).map((stop) => parse(getComputedStyle(stop).stopColor))
        if (!start || !mid || !end) return [`${series} has no three stops`]
        let lowest = Number.POSITIVE_INFINITY
        for (let step = 0; step <= 400; step += 1) {
          const t = step / 400
          const [from, to, amount] = t <= 0.5 ? [start, mid, t * 2] : [mid, end, t * 2 - 1]
          const line = luminance(from.map((channel, index) => channel + (to[index]! - channel) * amount))
          lowest = Math.min(lowest, (Math.max(line, card) + 0.05) / (Math.min(line, card) + 0.05))
        }
        return lowest < 3 ? [`${series} ${lowest.toFixed(2)}`] : []
      })
    })
    expect(problems).toEqual([])
  })
}

// 027: the blue stripes are faint on the dark card, so Dark draws them solid and wider.
for (const [theme, expected] of [['Light', { opacity: 0.6, width: 1.2 }], ['Dark', { opacity: 1, width: 2.2 }]] as const) {
  test(`mortgages burndown stripe strength [${theme}]`, async ({ page }) => {
    const values = await reachForecastValues(page, theme)
    const stripes = await values.getByRole('img').evaluate((svg) => ({
      opacity: Number(getComputedStyle(svg.querySelector('path[data-series="schedule"][data-part="area"]')!).fillOpacity),
      width: parseFloat(getComputedStyle(svg.querySelector('pattern line')!).strokeWidth),
    }))
    expect(stripes).toEqual(expected)
  })
}

// The schedule renders only the rows in view; replacing them must never move the content panel by itself.
test('mortgages schedule stays where it is scrolled to', async ({ page }) => {
  await reachState(page, stateNamed('mortgages-timeline-schedule'), 'Light')
  const main = page.locator('main')
  await expect(timelineGroup(page).getByRole('table')).toBeVisible()
  await settle(page)
  await main.evaluate((element) => {
    const positions: number[] = []
    Object.assign(window, { positions })
    element.addEventListener('scroll', () => positions.push(Math.round(element.scrollTop)))
  })
  const positions = () => page.evaluate(() => (window as unknown as { positions: number[] }).positions.splice(0))
  const scrollTop = () => main.evaluate((element) => Math.round(element.scrollTop))

  // Ordinary wheel steps only ever move down, and end where they add up to.
  await main.hover()
  for (let step = 1; step <= 20; step += 1) {
    await page.mouse.wheel(0, 100)
    await expect.poll(scrollTop).toBeGreaterThanOrEqual(step * 100)
    await settle(page)
  }
  await page.waitForTimeout(500)
  const wheeled = await positions()
  expect(wheeled).toEqual([...wheeled].sort((a, b) => a - b))
  expect(await scrollTop()).toBe(2000)

  // A jump well past the rendered rows, as dragging the scrollbar makes, holds its position.
  await main.evaluate((element) => { element.scrollTop = 8000 })
  await page.waitForTimeout(500)
  expect(await positions()).toEqual([8000])
  await expect(timelineGroup(page).locator('[role="row"][aria-rowindex="200"]')).toBeInViewport()
})

for (const theme of ['Light', 'Dark'] as const) {
  test(`surface lightness [${theme}]`, async ({ page }) => {
    await mockApi(page, { theme })
    await page.goto('/')
    await expectTheme(page, theme)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await settle(page)
    const lightness = await page.evaluate(() => {
      const luminance = (value: string) => {
        const [r = 0, g = 0, b = 0] = (value.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number).map((channel) => {
          const v = channel / 255
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const backgroundOf = (element: Element | null | undefined) =>
        element ? luminance(getComputedStyle(element).backgroundColor) : Number.NaN
      const background = (selector: string) => backgroundOf(document.querySelector(selector))
      return {
        // The navigation is transparent; its canvas comes from the backing layer rendered just before it.
        canvas: backgroundOf(document.querySelector('nav[aria-label="Primary"]')?.previousElementSibling),
        content: background('main'),
        card: background('[data-slot="card"]'),
        raised: background('#account-description')
          || luminance(getComputedStyle(document.querySelector('#account-description')!.parentElement!).backgroundColor),
      }
    })
    expect(Object.values(lightness).every((value) => Number.isFinite(value))).toBe(true)
    if (theme === 'Dark') {
      expect(lightness.canvas).toBeLessThan(lightness.content)
      expect(lightness.content).toBeLessThan(lightness.card)
      expect(lightness.card).toBeLessThan(lightness.raised)
    } else {
      expect(lightness.content).toBeLessThan(lightness.canvas)
      expect(lightness.raised).toBeLessThan(lightness.canvas)
      expect(lightness.canvas).toBeCloseTo(lightness.card, 5)
    }
  })
}

test('account screens are left aligned: accounts capped, details and import full width', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 })
  await mockApi(page)
  await page.goto('/')

  const expectLeftAligned = async (name: string, width: 'readable' | 'full') => {
    const panel = page.getByRole('main')
    const section = panel.getByRole('region', { name })
    await expect(section).toBeVisible()
    await settle(page)
    const sectionBox = (await section.boundingBox())!
    // The panel's inner edges: clientWidth leaves out any scrollbar.
    const inner = await panel.evaluate((element) => {
      const style = getComputedStyle(element)
      const left = parseFloat(style.paddingLeft)
      return {
        x: element.getBoundingClientRect().x + left,
        width: element.clientWidth - left - parseFloat(style.paddingRight),
      }
    })
    expect(sectionBox.x).toBeCloseTo(inner.x, 0)
    expect(sectionBox.width).toBeCloseTo(width === 'full' ? inner.width : 1024, 0)
  }

  await expectLeftAligned('Your Accounts', 'readable')
  await openAccountDetails(page)
  await expectLeftAligned('Account Details', 'full')
  await page.getByRole('button', { name: 'Import Transactions' }).click()
  await expectLeftAligned('Import Transactions', 'full')
})

// WEB-001 reflow (WCAG 2.2 SC 1.4.10): the logo and the header controls never cover each other.
for (const theme of ['Light', 'Dark'] as const) {
  // The last case makes the header taller and wider with the theme load error.
  for (const { width, themeLoadFails } of [
    ...[320, 480, 768, 1024].map((width) => ({ width, themeLoadFails: false })),
    { width: 1024, themeLoadFails: true },
  ]) {
    const suffix = themeLoadFails ? ' with a theme error' : ''
    test(`header logo and controls do not overlap at ${width} px${suffix} [${theme}]`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await mockApi(page, { theme, themeLoadFails })
      await page.goto('/')
      if (themeLoadFails) {
        // A failed load leaves Light active, so Dark is applied by hand.
        await expect(page.getByText('Your saved theme could not be loaded.')).toBeVisible()
        if (theme === 'Dark') await forceDark(page)
      } else {
        await expectTheme(page, theme)
      }
      await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
      await settle(page)

      const parts: Array<[string, Locator]> = [
        ['logo', page.getByRole('img', { name: 'Clutch' })],
        ['Theme', page.getByRole('combobox', { name: 'Theme' })],
        ['Import Limits', page.getByRole('button', { name: 'Import Limits' })],
        ['Sign Out', page.getByRole('button', { name: 'Sign Out' })],
        ['Toggle navigation', page.getByRole('button', { name: 'Toggle navigation' })],
      ]
      const boxes = await Promise.all(parts.map(async ([name, locator]) => ({ name, ...(await locator.boundingBox())! })))
      const contentTop = (await page.getByRole('main').boundingBox())!.y

      const problems = boxes.flatMap((box, index) => [
        ...(box.x < 0 || box.x + box.width > width + 0.5 ? [`${box.name} is cut off sideways`] : []),
        ...(box.name !== 'Toggle navigation' && box.y + box.height > contentTop + 0.5 ? [`${box.name} covers the content panel`] : []),
        ...boxes.slice(index + 1)
          .filter((other) => box.x < other.x + other.width - 0.5 && other.x < box.x + box.width - 0.5
            && box.y < other.y + other.height - 0.5 && other.y < box.y + box.height - 0.5)
          .map((other) => `${box.name} overlaps ${other.name}`),
      ])
      expect(problems).toEqual([])
      await expectNoHorizontalScroll(page)
    })
  }
}

test('switching theme while the delete dialog is open updates its surface', async ({ page }) => {
  const state = states.find((candidate) => candidate.name === 'delete-transaction-dialog')!
  await reachState(page, state, 'Light')
  const popup = page.locator('[data-slot="dialog-popup"]')
  const before = await popup.evaluate((element) => getComputedStyle(element).backgroundColor)
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await expect.poll(() => popup.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(before)
})

function firstDurationMs(value: string): number {
  const first = value.split(',')[0]?.trim() ?? '0s'
  return first.endsWith('ms') ? parseFloat(first) : parseFloat(first) * 1000
}

test('navigation and dialog transitions are short with reduced motion', async ({ page }) => {
  const state = states.find((candidate) => candidate.name === 'delete-transaction-dialog')!
  await reachState(page, state, 'Light')
  const nav = page.locator('nav[aria-label="Primary"]')
  const popup = page.locator('[data-slot="dialog-popup"]')
  expect(firstDurationMs(await nav.evaluate((element) => getComputedStyle(element).transitionDuration))).toBeLessThan(50)
  expect(firstDurationMs(await popup.evaluate((element) => getComputedStyle(element).transitionDuration))).toBeLessThan(50)
})

test('navigation and dialog transitions last 150 to 250ms without reduced motion', async ({ browser }, testInfo) => {
  const viewport = testInfo.project.use.viewport ?? { width: 1280, height: 720 }
  const context = await browser.newContext({ reducedMotion: 'no-preference', viewport, baseURL: testInfo.project.use.baseURL })
  const page = await context.newPage()
  try {
    const state = states.find((candidate) => candidate.name === 'delete-transaction-dialog')!
    await reachState(page, state, 'Light')
    const nav = page.locator('nav[aria-label="Primary"]')
    const popup = page.locator('[data-slot="dialog-popup"]')
    for (const duration of [
      firstDurationMs(await nav.evaluate((element) => getComputedStyle(element).transitionDuration)),
      firstDurationMs(await popup.evaluate((element) => getComputedStyle(element).transitionDuration)),
    ]) {
      expect(duration).toBeGreaterThanOrEqual(150)
      expect(duration).toBeLessThanOrEqual(250)
    }
  } finally {
    await context.close()
  }
})

test.describe('Persistent toasts (029)', () => {
  for (const width of [320, 1280]) {
    test(`regular toasts sit above the persistent one at the toast edge at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await mockApi(page, { theme: 'Light', asset: 'expiring' })
      await page.goto('/')
      await showBothToastStacks(page)

      const regular = (await regularToasts(page).getByRole('status').boundingBox())!
      const persistent = (await persistentToasts(page).getByRole('status').boundingBox())!
      expect(regular.y + regular.height).toBeLessThanOrEqual(persistent.y)
      expect(persistent.y + persistent.height).toBeGreaterThan(800 * 0.8)
      expect(persistent.y + persistent.height).toBeLessThanOrEqual(800)
      const centre = (persistent.x + persistent.width / 2) / width
      if (width >= 768) expect(centre).toBeGreaterThan(0.7)
      else expect(Math.abs(centre - 0.5)).toBeLessThan(0.05)
      await expectNoHorizontalScroll(page)

      // The regular toast leaves on its own; the persistent one stays until dismissed.
      await page.mouse.move(5, 5)
      await expect(regularToasts(page).getByRole('status')).toHaveCount(0, { timeout: 10_000 })
      await expect(persistentToasts(page).getByRole('status')).toBeVisible()
      await persistentToasts(page).getByRole('button', { name: 'Dismiss' }).click()
      await expect(persistentToasts(page).getByRole('status')).toHaveCount(0)
    })
  }
})

test.describe('Mortgages layout and motion', () => {
  test('the toast is bottom-right on desktop and bottom-centre at 320 px, with no animation under reduced motion', async ({ page }) => {
    await mockApi(page, { theme: 'Light' })
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await openMortgages(page)
      await page.getByRole('button', { name: 'Add Mortgage' }).click()
      await fillNewMortgage(page)
      await page.getByRole('button', { name: 'Save' }).click()
      const toast = page.getByRole('status').filter({ hasText: 'Mortgage saved' })
      await expect(toast).toBeVisible()
      const box = await toast.boundingBox()
      expect(box).not.toBeNull()
      const viewport = page.viewportSize()!
      const centre = (box!.x + box!.width / 2) / viewport.width
      if (width >= 768) {
        expect(box!.x + box!.width).toBeGreaterThan(viewport.width * 0.8)
        expect(centre).toBeGreaterThan(0.7)
      } else {
        expect(Math.abs(centre - 0.5)).toBeLessThan(0.05)
      }
      expect(box!.y + box!.height).toBeGreaterThan(viewport.height * 0.8)
      const styles = await toast.evaluate((element) => {
        const style = getComputedStyle(element)
        return { transition: style.transitionDuration, animation: style.animationName }
      })
      expect(firstDurationMs(styles.transition)).toBeLessThan(50)
      expect(styles.animation).toBe('none')
      expect(await page.evaluate(() => document.querySelectorAll('.animate-spin').length)).toBe(0)
    }
  })

  for (const width of [320, 1280]) {
    test(`with 10 mortgages the tab strip scrolls within itself at ${width} px and the page does not scroll sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await mockApi(page, { theme: 'Light', mortgages: 'many' })
      await page.goto('/')
      await openMortgages(page)
      const strip = page.getByRole('navigation', { name: 'Mortgages' }).getByRole('list')
      await expect(page.getByRole('button', { name: 'Add Mortgage' })).toBeAttached()
      if (width < 768) {
        expect(await strip.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
      }
      await strip.evaluate((element) => { element.scrollLeft = element.scrollWidth })
      await expect(page.getByRole('button', { name: 'Add Mortgage' })).toBeInViewport()
      await expectNoHorizontalScroll(page)
    })
  }

  test('one Amortization Schedule group spans the content width with its switch top right at 320 px and 1280 px (019 FR-001, FR-003, SC-001)', async ({ page }) => {
    await mockApi(page, { theme: 'Light' })
    for (const width of [320, 1280]) {
      // Taller than before: the locked Disbursal Date shows a hint (021), which lengthens Details.
      await page.setViewportSize({ width, height: 1000 })
      await page.goto('/')
      await openMortgages(page)
      const group = timelineGroup(page)
      await expect(group).toHaveCount(1)
      await expect(page.getByRole('heading', { name: 'Mortgage Burndown' })).toHaveCount(0)

      // Full content width: the same width as the Details group above it.
      const groupBox = (await group.boundingBox())!
      const detailsBox = (await page.getByRole('form', { name: 'Details' }).boundingBox())!
      expect(Math.abs(groupBox.width - detailsBox.width)).toBeLessThan(2)
      expect(Math.abs(groupBox.x - detailsBox.x)).toBeLessThan(2)
      expect(groupBox.y).toBeGreaterThan(detailsBox.y + detailsBox.height - 1)

      // The switch is the trash button's size, at the group's top right, level with the title.
      for (const name of ['Show Amortization Schedule', 'Show Burndown Chart']) {
        const button = page.getByRole('button', { name })
        await expect(button).toBeInViewport()
        const buttonBox = (await button.boundingBox())!
        const trashBox = (await page.getByRole('button', { name: /^Delete / }).boundingBox())!
        const titleBox = (await group.getByRole('heading', { name: 'Amortization Schedule' }).boundingBox())!
        expect(buttonBox.width).toBeCloseTo(trashBox.width, 0)
        expect(buttonBox.height).toBeCloseTo(trashBox.height, 0)
        expect(groupBox.x + groupBox.width - (buttonBox.x + buttonBox.width)).toBeLessThanOrEqual(24)
        expect(buttonBox.y - groupBox.y).toBeLessThanOrEqual(24)
        expect(Math.abs((buttonBox.y + buttonBox.height / 2) - (titleBox.y + titleBox.height / 2))).toBeLessThan(2)

        // Never both views.
        const charts = await group.getByRole('img', { name: /balance over time/i }).count()
        const tables = await group.getByRole('table').count()
        expect(charts + tables).toBe(1)
        await expectNoHorizontalScroll(page)
        await button.click()
      }
    }
  })

  test('the switch tooltip stays while the pointer is over it and Escape dismisses it (SC 1.4.13)', async ({ page }) => {
    await mockApi(page, { theme: 'Light' })
    await page.goto('/')
    await openMortgages(page)
    const button = page.getByRole('button', { name: 'Show Amortization Schedule' })
    await button.hover()
    const tooltip = timelineTooltip(page)
    await expect(tooltip).toHaveText('Show Amortization Schedule')

    const box = (await tooltip.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
    await page.waitForTimeout(500)
    await expect(tooltip).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(tooltip).toHaveCount(0)
  })

  test('the tooltip has no motion under reduced motion', async ({ page }) => {
    await mockApi(page, { theme: 'Light' })
    await page.goto('/')
    await openMortgages(page)
    await page.getByRole('button', { name: 'Show Amortization Schedule' }).hover()
    const tooltip = timelineTooltip(page)
    await expect(tooltip).toBeVisible()
    expect(firstDurationMs(await tooltip.evaluate((element) => getComputedStyle(element).transitionDuration))).toBeLessThan(50)
  })

  test('waits 2 s for a saved view that does not answer, then shows Burndown within 250 ms (019 SC-006)', async ({ page }) => {
    const mock = await mockApi(page, { theme: 'Light', loanPayoffTimeline: 'delay' })
    await page.addInitScript(() => {
      const record = () => {
        if (!('timelineShownAt' in window) && document.querySelector('svg[aria-label^="Line chart of the mortgage balance"]')) {
          Object.assign(window, { timelineShownAt: Date.now() })
        }
      }
      new MutationObserver(record).observe(document, { childList: true, subtree: true })
    })
    await page.goto('/')
    await openMortgages(page)

    await expect(timelineGroup(page).getByRole('img', { name: /balance over time/i })).toBeVisible({ timeout: 4000 })
    const shownAt = await page.evaluate(() => (window as unknown as { timelineShownAt: number }).timelineShownAt)
    expect(mock.loanPayoffTimelineRequestedAt).toBeDefined()
    // The request is abandoned 2,000 ms after it starts (it reaches the route a few ms later);
    // the chart then renders within the 250 ms allowance.
    const elapsed = shownAt - mock.loanPayoffTimelineRequestedAt!
    expect(elapsed).toBeGreaterThanOrEqual(1950)
    expect(elapsed).toBeLessThanOrEqual(2250)
    await expect(timelineGroup(page).getByRole('table')).toHaveCount(0)
  })

  for (const width of [320, 1280]) {
    test(`Interest Rates: value and button layout, 60-row dialog scrolling and focus at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 })
      await mockApi(page, { theme: 'Light', mortgages: 'rates' })
      await page.goto('/')
      await openMortgages(page)
      const form = page.getByRole('form', { name: 'Details' })

      // SC-001: the Details group is the same height with 1 and 60 changes.
      await page.getByRole('button', { name: 'One rate', exact: true }).click()
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue('One rate')
      const oneHeight = (await form.boundingBox())!.height
      await page.getByRole('button', { name: 'Sixty rates', exact: true }).click()
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Sixty rates')
      expect((await form.boundingBox())!.height).toBeCloseTo(oneHeight, 0)

      // FR-001: stacked under 768 px, side by side from 768 px; neither clipped.
      const value = page.getByText('Current Interest Rate', { exact: true })
      const button = page.getByRole('button', { name: 'Interest Rates' })
      const valueBox = (await value.boundingBox())!
      const buttonBox = (await button.boundingBox())!
      for (const box of [valueBox, buttonBox]) {
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width)
      }
      expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
      if (width < 768) {
        expect(buttonBox.y).toBeGreaterThanOrEqual(valueBox.y + valueBox.height - 1)
      } else {
        expect(buttonBox.x).toBeGreaterThanOrEqual(valueBox.x + valueBox.width - 1)
      }

      // 60 rows: the list scrolls inside the dialog and the add inputs stay visible.
      await button.click()
      const dialog = rateDialog(page)
      await expect(dialog).toBeVisible()
      const list = dialog.getByRole('list', { name: 'Interest Rate Changes' })
      expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
      await list.evaluate((element) => { element.scrollTop = element.scrollHeight })
      await expect(dialog.getByLabel('New Interest Rate')).toBeInViewport()
      await expect(dialog.getByRole('button', { name: 'Add', exact: true })).toBeInViewport()
      await expect(dialog.getByRole('button', { name: 'Close' })).toBeInViewport()
      await expectNoHorizontalScroll(page)

      // Focus trap wraps both ways (FR-004).
      const close = dialog.getByRole('button', { name: 'Close' })
      const removes = dialog.getByRole('button', { name: /^Remove / })
      await removes.last().focus()
      await page.keyboard.press('Tab')
      await expect(close).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(removes.last()).toBeFocused()

      // After a remove focus is on the dialog itself; the next Tab reaches Close (FR-005).
      // The Opening Rate (first row) cannot be removed while other rows exist.
      await removes.nth(1).click()
      await expect(dialog).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(close).toBeFocused()

      // Escape closes and returns focus to Interest Rates.
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(button).toBeFocused()
    })
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`System theme: the Interest Rates dialog passes the checks with an emulated ${scheme} scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await mockApi(page, { theme: 'System' })
      await page.goto('/')
      await openMortgages(page)
      await openRateDialog(page)
      await expectTheme(page, scheme === 'dark' ? 'Dark' : 'Light')
      await runChecks(page, `mortgages-rate-dialog-system-${scheme}`, scheme === 'dark' ? 'Dark' : 'Light')
    })
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`System theme follows an emulated ${scheme} colour scheme on the Mortgages screen`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await mockApi(page, { theme: 'System' })
      await page.goto('/')
      await openMortgages(page)
      await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible()
      await expectTheme(page, scheme === 'dark' ? 'Dark' : 'Light')
      await runChecks(page, `mortgages-system-${scheme}`, scheme === 'dark' ? 'Dark' : 'Light')
    })
  }
})
