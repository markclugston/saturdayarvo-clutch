/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

/*
 * 029 Asset Register journeys against a mocked API that keeps its own register. The real-API
 * lease journey is asset-edit-lease.spec.ts.
 */

type Valuation = { id: string; value: number; valuationDate: string }
type Asset = {
  id: string
  name: string
  description: string | null
  currencyCode: string
  valuations: Valuation[]
}
type Input = Omit<Asset, 'id' | 'valuations'> & {
  valuations: Array<{ id?: string; value: number; valuationDate: string }>
}

let counter = 0
const uuid = () => `550e8400-e29b-41d4-a716-${String(++counter).padStart(12, '0')}`

const format = { id: 'dot', decimalSeparator: '.', groupSeparator: ',', reference: 'CLDR', version: '44.0' }
const currencies = [
  { code: 'AUD', name: 'Australian Dollar', minorUnits: 2, amountFormats: [format] },
  { code: 'JPY', name: 'Japanese Yen', minorUnits: 0, amountFormats: [format] },
  { code: 'USD', name: 'US Dollar', minorUnits: 2, amountFormats: [format] },
]

function asset(name: string, currencyCode: string, ...valuations: Array<[number, string]>): Asset {
  return {
    id: uuid(),
    name,
    description: null,
    currencyCode,
    valuations: valuations.map(([value, valuationDate]) => ({ id: uuid(), value, valuationDate })),
  }
}

const newestFirst = (valuations: Valuation[]) =>
  [...valuations].sort((left, right) => right.valuationDate.localeCompare(left.valuationDate))

function listOf(assets: Asset[]) {
  const sums = new Map<string, number>()
  for (const item of assets) {
    const latest = newestFirst(item.valuations)[0]!
    // Whole cents, so the mock never adds fractions.
    sums.set(item.currencyCode, (sums.get(item.currencyCode) ?? 0) + Math.round(latest.value * 100))
  }
  return {
    assets: assets.map(({ valuations, ...item }) => {
      const { value, valuationDate } = newestFirst(valuations)[0]!
      return { ...item, latestValuation: { value, valuationDate } }
    }),
    totals: [...sums].sort(([left], [right]) => left.localeCompare(right)).map(([currencyCode, cents]) => ({
      currencyCode,
      totalValue: (cents / 100).toFixed(currencyCode === 'JPY' ? 0 : 2),
    })),
  }
}

async function mockApi(page: Page, assets: Asset[] = []) {
  const register = { assets, writes: [] as string[], releases: 0 }
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    const [, assetId, tail] = /^\/api\/assets\/([^/]+)(?:\/(.*))?$/.exec(path) ?? []
    const found = register.assets.find((item) => item.id === assetId)
    const detail = (item: Asset) => ({ ...item, valuations: newestFirst(item.valuations) })
    const stored = (input: Input, id: string): Asset => ({
      id,
      name: input.name,
      description: input.description,
      currencyCode: input.currencyCode,
      valuations: input.valuations.map((item) => ({ ...item, id: item.id ?? uuid() })),
    })

    if (path === '/api/security/session') return route.fulfill({ json: { id: 'browser-user', roles: [] } })
    if (path === '/api/security/csrf-token') return route.fulfill({ json: { requestToken: 'test-token' } })
    if (path === '/api/preferences/navigation') return route.fulfill({ json: { state: 'Unpinned' } })
    if (path === '/api/preferences/theme') return route.fulfill({ json: { mode: 'Light' } })
    if (path === '/api/accounts') return route.fulfill({ json: [] })
    if (path === '/api/currencies') return route.fulfill({ json: currencies })
    if (method !== 'GET') register.writes.push(`${method} ${path}`)
    if (path === '/api/assets' && method === 'GET') return route.fulfill({ json: listOf(register.assets) })
    if (path === '/api/assets' && method === 'POST') {
      const created = stored(request.postDataJSON() as Input, uuid())
      register.assets.push(created)
      return route.fulfill({ status: 201, json: detail(created) })
    }
    if (!found) {
      return route.fulfill({ status: 404, json: { title: 'Asset not found.', errors: { code: ['AssetNotFound'] } } })
    }
    if (tail === 'edits' && method === 'POST') {
      const now = Date.now()
      return route.fulfill({ status: 201, json: {
        editId: uuid(),
        serverTimeUtc: new Date(now).toISOString(),
        expiresAtUtc: new Date(now + 300_000).toISOString(),
        asset: detail(found),
      } })
    }
    if (tail === 'edit-status') {
      const editId = new URL(request.url()).searchParams.get('editId')!
      const expiresAtUtc = '2099-01-01T00:00:00Z'
      return route.fulfill({ json: {
        assetId,
        availability: 'Blocked',
        activeEdit: { id: editId, expiresAtUtc },
        watchedEdit: { id: editId, state: 'Active', expiresAtUtc },
      } })
    }
    if (tail?.startsWith('edits/') && method === 'DELETE') {
      register.releases += 1
      return route.fulfill({ status: 204 })
    }
    if (!tail && method === 'PUT') {
      const saved = stored(request.postDataJSON() as Input, found.id)
      register.assets.splice(register.assets.indexOf(found), 1, saved)
      return route.fulfill({ json: detail(saved) })
    }
    if (!tail && method === 'DELETE') {
      register.assets.splice(register.assets.indexOf(found), 1)
      return route.fulfill({ status: 204 })
    }
    return route.fulfill({ status: 404, json: { title: `Unexpected request: ${path}` } })
  })
  return register
}

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Primary' })
const dataRows = (page: Page) => page.locator('tbody tr')
const row = (page: Page, name: string) =>
  dataRows(page).filter({ has: page.getByRole('button', { name, exact: true }) })
const total = (page: Page, code: string) => page.getByRole('row', { name: new RegExp(`^Total ${code} `) })
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true })
const field = (page: Page, name: string) => page.getByLabel(name, { exact: true })
const valuationDialog = (page: Page) => page.getByRole('dialog', { name: 'Add Valuation' })
const discardDialog = (page: Page) => page.getByRole('dialog', { name: 'Discard Unsaved Changes?' })

async function openAssets(page: Page) {
  await page.goto('/')
  await navigation(page).getByRole('button', { name: 'Assets' }).click()
  await page.mouse.move(600, 400)
  await expect(heading(page, 'Assets')).toBeVisible()
}

async function enterValuation(page: Page, value: string, date: string) {
  await page.getByRole('button', { name: 'Add Valuation' }).click()
  const dialog = valuationDialog(page)
  await dialog.getByLabel('Value', { exact: true }).fill(value)
  await dialog.getByLabel('Valuation Date').fill(date)
  await dialog.getByRole('button', { name: 'OK' }).click()
}

test('Assets sits directly below Accounts and an empty register has no total', async ({ page }) => {
  await mockApi(page)
  await openAssets(page)

  const names = await navigation(page).getByRole('button').allInnerTexts()
  const labels = names.map((name) => name.trim()).filter(Boolean)
  expect(labels.indexOf('Assets')).toBe(labels.indexOf('Accounts') + 1)
  await expect(page).toHaveURL(/\/assets$/)
  await expect(page.getByText('No assets yet.')).toBeVisible()
  await expect(page.getByText(/^Total /)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add Asset' })).toBeEnabled()
})

test('a list of 100 assets renders within 2 s of selecting Assets (SC-002)', async ({ page }) => {
  await mockApi(page, Array.from({ length: 100 }, (_, index) =>
    asset(`Asset ${String(index + 1).padStart(3, '0')}`, 'AUD', [index + 1, '2026-01-01'])))
  await page.goto('/')
  const assets = navigation(page).getByRole('button', { name: 'Assets' })
  await expect(assets).toBeVisible()

  const started = Date.now()
  await assets.click()
  await expect(total(page, 'AUD')).toContainText('$5,050.00')
  await expect(dataRows(page)).toHaveCount(100)

  expect(Date.now() - started).toBeLessThan(2000)
})

test('adds an asset, storing nothing until Save, and it appears last', async ({ page }) => {
  const register = await mockApi(page, [asset('House', 'AUD', [12000, '2026-01-01'])])
  await openAssets(page)

  await page.getByRole('button', { name: 'Add Asset' }).click()
  await expect(page).toHaveURL(/\/assets\/new$/)
  await field(page, 'Name').fill('Car')
  await field(page, 'Currency').selectOption('AUD')

  await page.getByRole('button', { name: 'Add Valuation' }).click()
  await valuationDialog(page).getByLabel('Value', { exact: true }).fill('999')
  await valuationDialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText('No valuations yet.')).toBeVisible()

  await enterValuation(page, '3500', '2026-02-01')
  await expect(page.locator('tbody tr')).toContainText(['$3,500.00'])
  expect(register.writes).toEqual([])

  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page).toHaveURL(/\/assets$/)
  await expect(dataRows(page)).toHaveCount(2)
  await expect(dataRows(page).last()).toContainText('Car')
  await expect(total(page, 'AUD')).toContainText('$15,500.00')
  await expect(page.getByText('Car was saved.')).toBeVisible()
})

test('cancelling a new asset stores nothing', async ({ page }) => {
  const register = await mockApi(page)
  await openAssets(page)
  await page.getByRole('button', { name: 'Add Asset' }).click()
  await field(page, 'Name').fill('Car')

  await page.getByRole('button', { name: 'Cancel' }).click()
  await discardDialog(page).getByRole('button', { name: 'Discard Changes' }).click()

  await expect(page).toHaveURL(/\/assets$/)
  await expect(page.getByText('No assets yet.')).toBeVisible()
  expect(register.writes).toEqual([])
})

test('shows a field error for every invalid entry', async ({ page }) => {
  const register = await mockApi(page)
  await openAssets(page)
  await page.getByRole('button', { name: 'Add Asset' }).click()

  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Enter a name')).toBeVisible()
  await expect(field(page, 'Currency')).toHaveAccessibleDescription('Select a currency')
  await expect(page.getByText('Add at least one valuation')).toBeVisible()

  await field(page, 'Currency').selectOption('AUD')
  await enterValuation(page, '1', '2026-01-01')
  await page.getByRole('button', { name: 'Add Valuation' }).click()
  const dialog = valuationDialog(page)
  const value = dialog.getByLabel('Value', { exact: true })
  const date = dialog.getByLabel('Valuation Date')
  // A negative value cannot be entered at all: the sign never appears.
  await value.pressSequentially('-5')
  await expect(value).toHaveValue('5')
  await date.fill('9999-01-01')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(dialog.getByText('Enter a date that is not in the future')).toBeVisible()
  await date.fill('2026-01-01')
  await dialog.getByRole('button', { name: 'OK' }).click()
  await expect(dialog.getByText('This valuation date is already used')).toBeVisible()
  expect(register.writes).toEqual([])
})

test('a yen value takes no decimals', async ({ page }) => {
  await mockApi(page)
  await openAssets(page)
  await page.getByRole('button', { name: 'Add Asset' }).click()
  await field(page, 'Currency').selectOption('JPY')
  await page.getByRole('button', { name: 'Add Valuation' }).click()
  const value = valuationDialog(page).getByLabel('Value', { exact: true })

  await value.pressSequentially('5000.75')
  await expect(value).toHaveValue('500075')
  await value.blur()

  await expect(value).toHaveValue('¥500,075')
})

test('editing adds and deletes valuations, and each currency keeps its own total', async ({ page }) => {
  const register = await mockApi(page, [
    asset('House', 'AUD', [12000, '2026-01-01'], [10000, '2025-01-01']),
    asset('Car', 'AUD', [3500, '2026-01-01']),
    asset('Shares', 'USD', [2000, '2026-01-01']),
  ])
  await openAssets(page)
  await expect(total(page, 'AUD')).toContainText('$15,500.00')
  await expect(total(page, 'USD')).toContainText('$2,000.00')

  await page.getByRole('button', { name: 'House', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/assets/${register.assets[0]!.id}$`))
  await expect(field(page, 'Name')).toHaveValue('House')
  await expect(page.getByText('Currency: Australian Dollar (AUD)')).toBeVisible()
  await expect(page.getByLabel('Currency')).toHaveCount(0)
  await enterValuation(page, '20000', '2026-03-01')
  await page.getByRole('button', { name: 'Delete valuation dated 1 Jan 2025' }).click()
  expect(register.assets[0]!.valuations).toHaveLength(2)
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page).toHaveURL(/\/assets$/)
  await expect(row(page, 'House')).toContainText('$20,000.00')
  await expect(row(page, 'House')).toContainText('1 Mar 2026')
  await expect(total(page, 'AUD')).toContainText('$23,500.00')
  await expect(total(page, 'USD')).toContainText('$2,000.00')
  expect(register.assets[0]!.valuations.map((item) => item.valuationDate).sort())
    .toEqual(['2026-01-01', '2026-03-01'])
})

test('asks before browser Back discards unsaved edits', async ({ page }) => {
  const register = await mockApi(page, [asset('House', 'AUD', [1, '2026-01-01'])])
  await openAssets(page)
  await page.getByRole('button', { name: 'House', exact: true }).click()
  await field(page, 'Name').fill('Home')
  const editUrl = page.url()

  await page.goBack()
  await expect(discardDialog(page)).toBeVisible()
  await expect(page).toHaveURL(editUrl)
  await discardDialog(page).getByRole('button', { name: 'Stay on This Page' }).click()
  await expect(field(page, 'Name')).toHaveValue('Home')
  expect(register.releases).toBe(0)

  await page.goBack()
  await discardDialog(page).getByRole('button', { name: 'Discard Changes' }).click()

  await expect(page).toHaveURL(/\/assets$/)
  await expect(row(page, 'House')).toBeVisible()
  await expect.poll(() => register.releases).toBe(1)
  expect(register.assets[0]!.name).toBe('House')
})

test('reloading an asset URL reopens the asset, and an unknown one returns to the list', async ({ page }) => {
  const register = await mockApi(page, [asset('House', 'AUD', [1, '2026-01-01'])])
  await page.goto(`/assets/${register.assets[0]!.id}`)
  await expect(field(page, 'Name')).toHaveValue('House')
  await page.reload()
  await expect(field(page, 'Name')).toHaveValue('House')

  await page.goto('/assets/550e8400-e29b-41d4-a716-999999999999')

  await expect(page.getByText('This asset no longer exists.')).toBeVisible()
  await expect(page).toHaveURL(/\/assets$/)
})

test('deletes an asset only once confirmed, and its total drops', async ({ page }) => {
  const register = await mockApi(page, [
    asset('House', 'AUD', [12000, '2026-01-01']),
    asset('Car', 'AUD', [3500, '2026-01-01']),
  ])
  await openAssets(page)

  await page.getByRole('button', { name: 'Delete Car' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Delete Asset' })
  await expect(dialog).toContainText('Car')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dataRows(page)).toHaveCount(2)
  expect(register.writes).toEqual([])

  await page.getByRole('button', { name: 'Delete Car' }).click()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(dataRows(page)).toHaveCount(1)
  await expect(total(page, 'AUD')).toContainText('$12,000.00')
  await expect(page.getByText('Car was deleted.')).toBeVisible()
  await expect(page).toHaveURL(/\/assets$/)
})
