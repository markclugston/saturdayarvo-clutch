/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

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
  name: 'Australian Dollar',
  amountFormats: [{
    id: 'dot-decimal-comma-grouping',
    decimalSeparator: '.',
    groupSeparator: ',',
    reference: 'CLDR',
    version: '44.0',
  }],
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
  startingBalance: 500000.5,
  numberOfPeriods: 360,
  firstRepaymentDate: '2000-01-01',
  repaymentFrequency: 'Monthly',
  interestRateChanges: [
    { newInterestRate: 5.25, effectiveDate: '2000-01-01' },
    { newInterestRate: 6, effectiveDate: '2005-06-01' },
  ],
  version: 1,
})
// Mortgage 1 has one change, Mortgage 2 has 60 (monthly from the first repayment date).
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
}

async function mockApi(page: Page, options: Partial<Mock> = {}): Promise<Mock> {
  const mock: Mock = {
    theme: 'Light', session: 'ok', themeLoadFails: false, failWrites: false, ended: false, mortgages: 'ok', ...options,
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
    if (path === '/api/preferences/navigation') return route.fulfill({ json: { state: 'Unpinned' } })
    if (path === '/api/preferences/theme') {
      if (mock.themeLoadFails) return route.fulfill({ status: 500, json: { title: 'Preference failure' } })
      return route.fulfill({ json: { mode: mock.theme } })
    }
    if (path === '/api/mortgages' && method === 'GET') {
      if (mock.mortgages === 'hang') return new Promise<void>(() => {})
      if (mock.mortgages === 'error') return route.fulfill({ status: 500, json: { title: 'Server error' } })
      if (mock.mortgages === 'rates') return route.fulfill({ json: rateFixtures() })
      const count = mock.mortgages === 'empty' ? 0 : mock.mortgages === 'many' ? 10 : 3
      return route.fulfill({ json: Array.from({ length: count }, (_, index) => mortgageFixture(index)) })
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
    if (path === '/api/accounts') return route.fulfill({ json: accounts })
    if (path === '/api/currencies') return route.fulfill({ json: [currency] })
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
  await page.getByLabel('Starting Balance').fill('250000')
  await page.getByLabel('Number of Periods').fill('120')
  await page.getByLabel('First Repayment Date').fill('2020-01-01')
  await page.getByLabel('Repayment Frequency').selectOption('Monthly')
  await page.getByRole('button', { name: 'Change Interest Rate' }).click()
  const dialog = page.getByRole('dialog', { name: 'Change Interest Rate' })
  await dialog.getByLabel('New Interest Rate').fill('4.5')
  await dialog.getByLabel('Effective Date').fill('2020-01-01')
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
}

const rateDialog = (page: Page) => page.getByRole('dialog', { name: 'Change Interest Rate' })

async function openRateDialog(page: Page) {
  await page.getByRole('button', { name: 'Change Interest Rate' }).click()
  await expect(rateDialog(page)).toBeVisible()
  await page.mouse.move(5, 5)
}

type StateDef = {
  name: string
  /** Pre-auth states and the theme-load failure never receive the theme from the API. */
  manualDark?: boolean
  mock?: Partial<Mock>
  reach: (page: Page, mock: Mock) => Promise<void>
}

const signedIn = { session: 'ok' } as const

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
      await page.getByRole('navigation', { name: 'Primary' }).getByRole('button', { name: 'Accounts' }).focus()
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
      await expect(page.getByRole('list', { name: 'Groups and categories' })).toBeVisible()
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
      await expect(page.getByText('Please enter your mortgage details')).toHaveCount(2)
    },
  },
  {
    name: 'mortgages-loaded', mock: signedIn,
    reach: async (page) => {
      await openMortgages(page)
      await expect(page.getByRole('table')).toBeVisible()
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
      await rateDialog(page).getByRole('button', { name: 'Remove 5.25% from 1 Jan 2000' }).click()
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
      const background = (selector: string) => {
        const element = document.querySelector(selector)
        return element ? luminance(getComputedStyle(element).backgroundColor) : Number.NaN
      }
      return {
        canvas: background('nav[aria-label="Primary"]'),
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

  test('Burndown sits above the schedule at 320 px and to its left on desktop (FR-011)', async ({ page }) => {
    await mockApi(page, { theme: 'Light' })
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await openMortgages(page)
      const chart = await page.getByRole('heading', { name: 'Mortgage Burndown' }).locator('xpath=ancestor::section').boundingBox()
      const schedule = await page.getByRole('heading', { name: 'Amortization Schedule' }).locator('xpath=ancestor::section').boundingBox()
      expect(chart).not.toBeNull()
      expect(schedule).not.toBeNull()
      if (width < 768) {
        expect(chart!.y + chart!.height).toBeLessThanOrEqual(schedule!.y + 1)
      } else {
        expect(chart!.x + chart!.width).toBeLessThanOrEqual(schedule!.x + 1)
        expect(Math.abs(chart!.y - schedule!.y)).toBeLessThan(2)
      }
    }
  })

  for (const width of [320, 1280]) {
    test(`Change Interest Rate: value and button layout, 60-row dialog scrolling and focus at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 })
      await mockApi(page, { theme: 'Light', mortgages: 'rates' })
      await page.goto('/')
      await openMortgages(page)
      const form = page.getByRole('form', { name: 'Loan Details' })

      // SC-001: the Loan Details group is the same height with 1 and 60 changes.
      await page.getByRole('button', { name: 'One rate', exact: true }).click()
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue('One rate')
      const oneHeight = (await form.boundingBox())!.height
      await page.getByRole('button', { name: 'Sixty rates', exact: true }).click()
      await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Sixty rates')
      expect((await form.boundingBox())!.height).toBeCloseTo(oneHeight, 0)

      // FR-001: stacked under 768 px, side by side from 768 px; neither clipped.
      const value = page.getByText('Current Interest Rate', { exact: true })
      const button = page.getByRole('button', { name: 'Change Interest Rate' })
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
      await removes.first().click()
      await expect(dialog).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(close).toBeFocused()

      // Escape closes and returns focus to Change Interest Rate.
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(button).toBeFocused()
    })
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`System theme: the Change Interest Rate dialog passes the checks with an emulated ${scheme} scheme`, async ({ page }) => {
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
      await expect(page.getByRole('heading', { name: 'Loan Details' })).toBeVisible()
      await expectTheme(page, scheme === 'dark' ? 'Dark' : 'Light')
      await runChecks(page, `mortgages-system-${scheme}`, scheme === 'dark' ? 'Dark' : 'Light')
    })
  }
})
