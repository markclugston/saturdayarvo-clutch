import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page } from '@playwright/test'

const accountId = '550e8400-e29b-41d4-a716-446655440011'
const account = { id: accountId, description: 'Browser account', currencyCode: 'AUD' }
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

async function mockApi(page: Page) {
  let mode = 'Light'
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/security/session') {
      await route.fulfill({ json: { id: 'browser-user', roles: ['Administrator'] } })
    } else if (path === '/api/preferences/theme') {
      if (route.request().method() === 'PUT') {
        mode = (route.request().postDataJSON() as { mode: string }).mode
      }
      await route.fulfill({ json: { mode } })
    } else if (path === '/api/security/csrf-token') {
      await route.fulfill({ json: { requestToken: 'test-token' } })
    } else if (path === '/api/accounts') {
      await route.fulfill({ json: [account] })
    } else if (path === '/api/currencies') {
      await route.fulfill({ json: [currency] })
    } else if (path === `/api/accounts/${accountId}`) {
      await route.fulfill({ json: account })
    } else if (path === `/api/accounts/${accountId}/transactions`) {
      await route.fulfill({ json: { items: [], nextCursor: null } })
    } else if (path === `/api/accounts/${accountId}/import-settings`) {
      await route.fulfill({ json: { mapping: null } })
    } else if (path === '/api/category-nodes') {
      await route.fulfill({ json: [
        { id: 'group-1', parentId: null, name: 'Food', depth: 0 },
        { id: 'category-1', parentId: 'group-1', name: 'Groceries', depth: 1 },
      ] })
    } else if (path === '/api/admin/import-limits') {
      await route.fulfill({ json: {
        maxFileSizeBytes: 1000000,
        maxRowsPerImport: 1000,
        maxImportAttemptsPerUserPerMinute: 5,
      } })
    } else {
      await route.fulfill({ status: 404, json: { title: `Unexpected request: ${path}` } })
    }
  })
}

async function setPaneState(page: Page, expanded: boolean) {
  const nav = page.getByRole('navigation', { name: 'Primary' })
  if (expanded) {
    await nav.getByRole('button', { name: 'Accounts' }).hover()
  } else {
    await page.mouse.move(0, 0)
  }
  const label = nav.getByText('Accounts', { exact: true })
  if (expanded) await expect(label).toBeVisible()
  else await expect(label).toBeHidden()
}

test('shows contrasting current and keyboard focus indicators in both themes and pane states', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  const selector = page.getByRole('combobox', { name: 'Theme' })

  for (const mode of ['Light', 'Dark']) {
    await selector.selectOption(mode)
    await expect(page.locator('html')).toHaveClass(mode === 'Dark' ? /dark/ : /^(?!.*dark)/)
    for (const expanded of [false, true]) {
      for (const destination of ['Accounts', 'Categories']) {
        await selector.focus()
        const button = nav.getByRole('button', { name: destination })
        await button.click()
        await expect(button).toHaveAttribute('aria-current', 'page')
        await setPaneState(page, expanded)
        await page.keyboard.press('Tab')
        await button.focus()
        const indicators = await button.evaluate((element) => {
          const doc = element.ownerDocument
          const view = doc.defaultView
          if (!view) throw new Error('Browser window is unavailable')
          const style = view.getComputedStyle(element)
          const background = view.getComputedStyle(doc.body).backgroundColor
          const canvas = doc.createElement('canvas')
          canvas.width = canvas.height = 1
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Canvas is unavailable')
          const luminance = (color: string) => {
            context.clearRect(0, 0, 1, 1)
            context.fillStyle = color
            context.fillRect(0, 0, 1, 1)
            const pixels: Uint8ClampedArray = context.getImageData(0, 0, 1, 1).data
            const channels = Array.from(pixels).slice(0, 3)
              .map((channel) => {
                const value = channel / 255
                return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
              })
            return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722
          }
          const contrast = (first: string, second: string) => {
            const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
            return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05)
          }
          return {
            current: contrast(style.backgroundColor, background),
            focus: contrast(style.outlineColor, background),
            text: contrast(style.color, style.backgroundColor),
            outlineStyle: style.outlineStyle,
            outlineWidth: parseFloat(style.outlineWidth),
          }
        })
        expect(indicators.current).toBeGreaterThanOrEqual(3)
        expect(indicators.focus).toBeGreaterThanOrEqual(3)
        expect(indicators.text).toBeGreaterThanOrEqual(4.5)
        expect(indicators.outlineStyle).not.toBe('none')
        expect(indicators.outlineWidth).toBeGreaterThanOrEqual(2)
      }
    }
  }
})

test('keeps the pane and content usable across viewports and themes', async ({ page }) => {
    test.setTimeout(300_000)
    await mockApi(page)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Primary' })
    const main = page.getByRole('main')
    const selector = page.getByRole('combobox', { name: 'Theme' })
    const checkLayout = async (expanded: boolean) => {
      await setPaneState(page, expanded)
      const pane = await nav.boundingBox()
      const content = await main.boundingBox()
      expect(pane).not.toBeNull()
      expect(content).not.toBeNull()
      if (!pane || !content) throw new Error('Navigation or content has no bounds')
      if (expanded) {
        expect(pane.width).toBeGreaterThan(56)
      }
      else expect(pane.x + pane.width).toBeLessThanOrEqual(content.x + 0.5)
      expect(content.width).toBeGreaterThan(0)
      await setPaneState(page, !expanded)
      const otherContent = await main.boundingBox()
      if (!otherContent) throw new Error('Content has no bounds')
      expect(otherContent.x).toBeCloseTo(content.x, 1)
      expect(otherContent.width).toBeCloseTo(content.width, 1)
      await setPaneState(page, expanded)
      expect(await page.locator('html').evaluate((element) =>
        element.ownerDocument.documentElement.scrollWidth
        <= element.ownerDocument.documentElement.clientWidth)).toBe(true)
      await expect(nav.getByRole('button', { name: 'Accounts' })).toBeVisible()
    }
    const checkAccessibility = async () => {
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(accessibility.violations).toEqual([])
    }
    const checkControl = async (control: Locator) => {
      await expect(control).toBeVisible()
      await control.scrollIntoViewIfNeeded()
      const bounds = await control.boundingBox()
      const viewport = page.viewportSize()
      if (!bounds || !viewport) throw new Error('Control or viewport has no bounds')
      expect(bounds.x).toBeGreaterThanOrEqual(0)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 0.5)
      await control.click({ trial: true })
    }
    for (const viewport of [{ width: 320, height: 812 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport)
      for (const expanded of [false, true]) {
        for (const theme of [
          { mode: 'Light', scheme: 'light' },
          { mode: 'Dark', scheme: 'dark' },
          { mode: 'System', scheme: 'light' },
          { mode: 'System', scheme: 'dark' },
        ] as const) {
          await page.emulateMedia({ colorScheme: theme.scheme })
          await selector.selectOption(theme.mode)
          await expect(page.locator('html')).toHaveClass(theme.scheme === 'dark' ? /dark/ : /^(?!.*dark)/)

          await expect(page.getByRole('heading', { name: 'Your accounts' })).toBeVisible()
          await checkLayout(expanded)
          await checkControl(page.getByLabel('Account description'))
          await page.getByLabel('Account description').fill('Test account')
          await checkControl(page.getByRole('button', { name: 'Add account' }))
          await checkAccessibility()

          await page.getByRole('button', { name: /Browser account/ }).click()
          await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible()
          await checkLayout(expanded)
          await checkControl(page.getByLabel('Account description'))
          await page.getByLabel('Account description').fill('Changed description')
          await checkControl(page.getByRole('button', { name: 'Save description' }))
          await checkAccessibility()

          await page.getByRole('button', { name: 'Import transactions' }).click()
          await expect(page.getByLabel('CSV file')).toBeAttached()
          await checkLayout(expanded)
          await checkControl(page.getByRole('button', { name: 'Choose CSV file' }))
          await page.getByLabel('CSV file').setInputFiles({
            name: 'transactions.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from('Date,Description,Amount\n2025-01-15,Market,10'),
          })
          await checkControl(page.getByLabel('Transaction date column'))
          await page.getByLabel('Transaction date column').selectOption('0')
          await checkControl(page.getByLabel('Date format'))
          await checkAccessibility()

          await nav.getByRole('button', { name: 'Categories' }).click()
          await expect(page.getByRole('heading', { name: 'Categories and groups' })).toBeVisible()
          await checkLayout(expanded)
          await checkControl(page.getByRole('button', { name: 'Rename Groceries' }))
          await page.getByRole('button', { name: 'Rename Groceries' }).click()
          await checkControl(page.getByLabel('New name for Groceries'))
          await page.getByLabel('New name for Groceries').fill('Groceries updated')
          await checkControl(page.getByRole('button', { name: 'Save', exact: true }))
          await checkControl(page.getByRole('button', { name: 'Cancel', exact: true }))
          await checkAccessibility()

          await page.getByRole('button', { name: 'Import limits' }).click()
          await expect(page.getByRole('heading', { name: 'Import limits' })).toBeVisible()
          await checkLayout(expanded)
          await checkControl(page.getByLabel('Maximum rows per import'))
          await page.getByLabel('Maximum rows per import').fill('1200')
          await checkControl(page.getByRole('button', { name: 'Save limits' }))
          await checkAccessibility()
          await nav.getByRole('button', { name: 'Accounts' }).click()
        }
      }
    }
    await page.getByRole('combobox', { name: 'Theme' }).focus()
    await page.mouse.move(0, 0)
    const start = Date.now()
    await nav.getByRole('button', { name: 'Accounts' }).hover()
    await expect(nav.getByText('Accounts', { exact: true })).toBeVisible()
    expect(Date.now() - start).toBeLessThan(500)
    await expect(nav.getByRole('button', { name: 'Accounts' })).toHaveCSS('cursor', 'pointer')
  })

test('keeps deeply nested category actions usable beside navigation', async ({ page }) => {
  await mockApi(page)
  const deepestName = `Level 5 ${'x'.repeat(90)}`
  await page.route('**/api/category-nodes', (route) => route.fulfill({
    json: Array.from({ length: 6 }, (_, depth) => ({
      id: `level-${depth}`,
      parentId: depth === 0 ? null : `level-${depth - 1}`,
      name: depth === 5 ? deepestName : `Level ${depth}`,
      depth,
    })),
  }))
  await page.route('**/api/category-nodes/level-5/deletion-impact', (route) =>
    route.fulfill({ json: { itemCount: 1 } }))
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await nav.getByRole('button', { name: 'Categories' }).click()

  const checkNoPageOverflow = async () => {
    expect(await page.locator('html').evaluate((element) =>
      element.scrollWidth <= element.clientWidth)).toBe(true)
  }
  const checkReachable = async (control: Locator) => {
    await expect(control).toBeVisible()
    await control.scrollIntoViewIfNeeded()
    await control.click({ trial: true })
    const bounds = await control.boundingBox()
    const pane = await nav.boundingBox()
    const viewport = page.viewportSize()
    if (!bounds || !pane || !viewport) throw new Error('Control, pane or viewport has no bounds')
    expect(bounds.x).toBeGreaterThanOrEqual(pane.x + pane.width - 0.5)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 0.5)
  }

  for (const viewport of [{ width: 320, height: 812 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport)
    for (const expanded of [false, true]) {
      await setPaneState(page, expanded)
      const rename = page.getByRole('button', { name: `Rename ${deepestName}` })
      const remove = page.getByRole('button', { name: `Delete ${deepestName}` })
      await checkNoPageOverflow()
      await setPaneState(page, false)
      if (viewport.width === 320 && expanded) {
        const list = page.getByRole('list', { name: 'Groups and categories' })
        await list.evaluate((element) => { element.scrollLeft = 0 })
        await page.keyboard.press('Tab')
        await list.focus()
        await expect(list).toHaveCSS('outline-style', 'solid')
        await page.keyboard.press('ArrowRight')
        await expect.poll(() => list.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
      }
      await checkReachable(rename)
      await rename.click()
      await checkNoPageOverflow()
      const editor = page.getByLabel(`New name for ${deepestName}`)
      await checkReachable(editor)
      await editor.fill('Edited category')
      await checkReachable(page.getByRole('button', { name: 'Save', exact: true }))
      await checkReachable(page.getByRole('button', { name: 'Cancel', exact: true }))
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await checkReachable(remove)
      await remove.click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText(deepestName)
      await checkNoPageOverflow()
      await checkReachable(dialog.getByRole('button', { name: 'Delete', exact: true }))
      await checkReachable(dialog.getByRole('button', { name: 'Cancel', exact: true }))
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    }
  }
})

for (const mode of ['Light', 'Dark'] as const) {
  test(`keeps keyboard focus visible over hovered navigation in ${mode} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 })
    await mockApi(page)
    let groupName = 'Food'
    await page.route('**/api/category-nodes', (route) => route.fulfill({
      json: [{ id: 'group-1', parentId: null, name: groupName, depth: 0 }],
    }))
    await page.route('**/api/category-nodes/group-1', (route) => {
      groupName = (route.request().postDataJSON() as { name: string }).name
      return route.fulfill({ json: { id: 'group-1', parentId: null, name: groupName, depth: 0 } })
    })
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Theme' }).selectOption(mode)

    const nav = page.getByRole('navigation', { name: 'Primary' })
    const categories = nav.getByRole('button', { name: 'Categories' })
    await categories.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Rename Food' })).toBeVisible()

    const pane = await nav.boundingBox()
    if (!pane) throw new Error('Navigation has no bounds')
    await page.mouse.move(pane.x + 25, pane.y + 20)
    await categories.focus()
    await page.keyboard.press('Tab')
    const list = page.getByRole('list', { name: 'Groups and categories' })
    await expect(list).toBeFocused()
    const listOverlay = await list.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hit = element.ownerDocument.elementFromPoint(rect.left + 5, rect.top + 10)
      return hit !== null && hit.closest('nav[aria-label="Primary"]') !== null
    })
    expect(listOverlay).toBe(true)
    const listWithOutline = await page.screenshot()
    await list.evaluate((element) => { element.style.outline = 'none' })
    const listWithoutOutline = await page.screenshot()
    await list.evaluate((element) => { element.style.removeProperty('outline') })
    expect(listWithOutline.equals(listWithoutOutline)).toBe(false)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Rename Food' })).toBeFocused()
    await page.keyboard.press('Enter')
    const editor = page.getByLabel('New name for Food')
    await expect(editor).toBeFocused()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('Food updated')
    await page.keyboard.press('Tab')

    const save = page.getByRole('button', { name: 'Save', exact: true })
    await expect(save).toBeFocused()
    await expect(nav.getByText('Accounts', { exact: true })).toBeVisible()
    const saveBounds = await save.boundingBox()
    const expandedPane = await nav.boundingBox()
    if (!saveBounds || !expandedPane) throw new Error('Navigation or Save button has no bounds')
    expect(saveBounds.x + saveBounds.width).toBeLessThan(expandedPane.x + expandedPane.width)
    const focus = await save.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const doc = element.ownerDocument
      const view = doc.defaultView
      const pane = doc.querySelector('nav[aria-label="Primary"]')
      if (!view || !pane) throw new Error('Navigation or browser window is unavailable')
      const style = view.getComputedStyle(element)
      const hit = doc.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      const canvas = doc.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas is unavailable')
      const background = view.getComputedStyle(pane).backgroundColor
      const luminance = (foreground?: string) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = background
        context.fillRect(0, 0, 1, 1)
        if (foreground) {
          context.fillStyle = foreground
          context.fillRect(0, 0, 1, 1)
        }
        const pixels: Uint8ClampedArray = context.getImageData(0, 0, 1, 1).data
        const channels = Array.from(pixels).slice(0, 3)
          .map((channel) => {
            const value = channel / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
          })
        return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722
      }
      const values = [luminance(), luminance(style.outlineColor)].sort((a, b) => b - a)
      return {
        visible: element.contains(hit),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        contrast: ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05),
      }
    })
    expect(focus.visible).toBe(true)
    expect(focus.outlineStyle).not.toBe('none')
    expect(parseFloat(focus.outlineWidth ?? '0')).toBeGreaterThan(0)
    expect(focus.contrast).toBeGreaterThanOrEqual(3)
    const withOutline = await page.screenshot()
    await save.evaluate((element) => { element.style.outline = 'none' })
    const withoutOutline = await page.screenshot()
    await save.evaluate((element) => { element.style.removeProperty('outline') })
    expect(withOutline.equals(withoutOutline)).toBe(false)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Rename Food updated' })).toBeFocused()
    await expect(nav.getByText('Accounts', { exact: true })).toBeVisible()
  })
}

test('keeps destination controls in the signed-in navigation on every screen', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  const accounts = nav.getByRole('button', { name: 'Accounts' })
  const categories = nav.getByRole('button', { name: 'Categories' })
  await expect(nav).toBeVisible()
  await expect(page.getByRole('banner').getByRole('navigation', { name: 'Primary' })).toHaveCount(0)
  await expect(accounts).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: /Browser account/ }).click()
  await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible()
  await expect(accounts).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Import transactions' }).click()
  await expect(nav).toBeVisible()
  await categories.click()
  await expect(page.getByRole('heading', { name: 'Categories and groups' })).toBeVisible()
  await expect(categories).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: 'Import limits' }).click()
  await expect(page.getByRole('heading', { name: 'Import limits' })).toBeVisible()
  await expect(accounts).not.toHaveAttribute('aria-current', 'page')
  await accounts.click()
  await expect(page.getByRole('heading', { name: 'Your accounts' })).toBeVisible()
})

test('expands on hover and collapses on exit without changing destination behavior', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  const accounts = nav.getByRole('button', { name: 'Accounts' })
  const categories = nav.getByRole('button', { name: 'Categories' })
  await expect(nav.getByRole('button', { name: 'Toggle navigation' })).toHaveCount(0)
  await expect(accounts.getByText('Accounts', { exact: true })).toBeHidden()
  await expect(categories.getByText('Categories', { exact: true })).toBeHidden()
  const icon = await accounts.locator('svg').getAttribute('class')
  await setPaneState(page, true)
  await expect(accounts.getByText('Accounts', { exact: true })).toBeVisible()
  await expect(categories.getByText('Categories', { exact: true })).toBeVisible()
  expect(await accounts.locator('svg').getAttribute('class')).toBe(icon)
  await categories.click()
  await expect(categories.getByText('Categories', { exact: true })).toBeVisible()
  await accounts.click()
  await expect(page.getByRole('heading', { name: 'Your accounts' })).toBeVisible()
  await setPaneState(page, false)
  await categories.click()
  await expect(page.getByRole('heading', { name: 'Categories and groups' })).toBeVisible()
})

test('overlays only intersecting page content without changing its geometry', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  const main = page.getByRole('main')
  const heading = page.getByRole('heading', { name: 'Your accounts' })

  let expandedWidth: number | undefined
  for (const viewport of [
    { width: 320, height: 812 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport)
    await setPaneState(page, false)
    const compactPane = await nav.boundingBox()
    const compactMain = await main.boundingBox()
    const compactHeading = await heading.boundingBox()
    await setPaneState(page, true)
    const pane = await nav.boundingBox()
    const expandedMain = await main.boundingBox()
    const expandedHeading = await heading.boundingBox()
    if (!pane || !compactPane || !compactMain || !compactHeading || !expandedMain || !expandedHeading) {
      throw new Error('Navigation or page content has no bounds')
    }
    expect(pane.width).toBeGreaterThan(compactPane.width)
    if (expandedWidth === undefined) expandedWidth = pane.width
    else expect(pane.width).toBeCloseTo(expandedWidth, 1)
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(expandedMain[key]).toBeCloseTo(compactMain[key], 1)
      expect(expandedHeading[key]).toBeCloseTo(compactHeading[key], 1)
    }

    if (viewport.width === 320) {
      expect(pane.x + pane.width).toBeGreaterThan(expandedHeading.x)
      const coveredByNav = await nav.evaluate((element, { x, y }) =>
        element.contains(element.ownerDocument.elementFromPoint(x, y)),
      { x: expandedHeading.x + 5, y: expandedHeading.y + expandedHeading.height / 2 })
      expect(coveredByNav).toBe(true)
    } else {
      expect(pane.x + pane.width).toBeLessThanOrEqual(expandedHeading.x)
      expect(compactMain.x - compactPane.width)
        .toBeCloseTo(viewport.width - compactMain.x - compactMain.width, 1)
    }
  }
})

test('navigates directly from a compact touch pane', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 812 },
    isMobile: true,
    hasTouch: true,
  })

  try {
    const page = await context.newPage()
    await mockApi(page)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Primary' })
    await expect(nav.getByText('Categories', { exact: true })).toBeHidden()
    await nav.getByRole('button', { name: 'Categories' }).tap()
    await expect(page.getByRole('heading', { name: 'Categories and groups' })).toBeVisible()
    await expect(nav.getByText('Categories', { exact: true })).toBeHidden()
    await nav.getByRole('button', { name: 'Accounts' }).tap()
    await expect(page.getByRole('heading', { name: 'Your accounts' })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('reveals navigation labels on keyboard focus and hides them after focus leaves', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  const accounts = nav.getByRole('button', { name: 'Accounts' })
  const categories = nav.getByRole('button', { name: 'Categories' })
  await page.getByRole('button', { name: 'Sign out' }).focus()
  await page.keyboard.press('Tab')
  await expect(accounts).toBeFocused()
  await expect(nav.getByText('Accounts', { exact: true })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(categories).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Categories and groups' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(nav.getByText('Accounts', { exact: true })).toBeHidden()
})

test('dismisses hover expansion without moving the pointer or focus', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  const label = nav.getByText('Accounts', { exact: true })
  const signOut = page.getByRole('button', { name: 'Sign out' })
  await signOut.focus()
  await nav.getByRole('button', { name: 'Accounts' }).hover()
  await expect(label).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(signOut).toBeFocused()
  await expect(label).toBeHidden()
  await expect(nav).toHaveCSS('width', '56px')
  await page.mouse.move(0, 0)
  await nav.getByRole('button', { name: 'Accounts' }).hover()
  await expect(label).toBeVisible()
})

test('dismisses keyboard expansion without moving focus', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  const accounts = nav.getByRole('button', { name: 'Accounts' })
  const categories = nav.getByRole('button', { name: 'Categories' })
  const label = nav.getByText('Accounts', { exact: true })
  await page.getByRole('button', { name: 'Sign out' }).focus()
  await page.keyboard.press('Tab')
  await expect(accounts).toBeFocused()
  await expect(label).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(accounts).toBeFocused()
  await expect(label).toBeHidden()
  await page.keyboard.press('Tab')
  await expect(categories).toBeFocused()
  await expect(label).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Categories and groups' })).toBeVisible()
})

test('both destinations remain reachable from every signed-in screen', async ({ page }) => {
  await mockApi(page)
  for (const screen of ['overview', 'details', 'import', 'categories', 'admin']) {
    for (const destination of ['Accounts', 'Categories']) {
      await page.goto('/')
      const nav = page.getByRole('navigation', { name: 'Primary' })
      await expect(page.getByRole('heading', { name: 'Your accounts' })).toBeVisible()
      if (screen === 'details' || screen === 'import') {
        await page.getByRole('button', { name: /Browser account/ }).click()
        await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible()
        if (screen === 'import') {
          await page.getByRole('button', { name: 'Import transactions' }).click()
          await expect(page.getByLabel('CSV file')).toBeAttached()
        }
      } else if (screen === 'categories') {
        await nav.getByRole('button', { name: 'Categories' }).click()
      } else if (screen === 'admin') {
        await page.getByRole('button', { name: 'Import limits' }).click()
        await expect(page.getByRole('heading', { name: 'Import limits' })).toBeVisible()
      }
      const start = Date.now()
      await nav.getByRole('button', { name: destination }).click()
      await expect(page.getByRole('heading', {
        name: destination === 'Accounts' ? 'Your accounts' : 'Categories and groups',
      })).toBeVisible()
      expect(Date.now() - start).toBeLessThan(500)
    }
  }
})
