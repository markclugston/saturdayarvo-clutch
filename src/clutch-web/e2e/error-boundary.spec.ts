/// <reference lib="dom" />
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

/*
 * Page error boundary (specs/028-page-error-boundary). Every API call is mocked. A render fault is
 * injected by serving a failing module in place of a page, so the app carries no test-only hooks.
 */

const marker = 'secret-marker balance 482913.07'

type FaultFlag = 'failPage' | 'failForm' | 'failFrame' | 'failSignIn'
type FaultWindow = Window & Partial<Record<FaultFlag, boolean>>

async function injectFault(
  page: Page, path: string, exportName: string, flag: FaultFlag, healthy = "'Recovered Content'",
) {
  await page.route((url) => url.pathname === path, (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `export function ${exportName}(props) {
      if (window.${flag}) throw new Error('${marker}')
      return ${healthy}
    }`,
  }))
}

async function mockApi(page: Page, mode: 'Light' | 'Dark', signedIn = true) {
  const responses: Record<string, unknown> = {
    '/api/security/session': { id: 'browser-user', roles: ['Administrator'] },
    '/api/preferences/navigation': { state: 'Pinned' },
    '/api/preferences/theme': { mode },
    '/api/security/csrf-token': { requestToken: 'test-token' },
    '/api/accounts': [],
    '/api/currencies': [],
    '/api/category-nodes': [{ id: 'group-1', parentId: null, name: 'Food', depth: 0 }],
  }
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const path = new URL(route.request().url()).pathname
    if (!signedIn && path === '/api/security/session') {
      return route.fulfill({ status: 401, json: { title: 'Authentication required', status: 401 } })
    }
    return path in responses
      ? route.fulfill({ json: responses[path] })
      : route.fulfill({ status: 404, json: { title: 'Unexpected request' } })
  })
}

/** Everything the page prints or throws, so a leak of the underlying error is visible. */
function collectOutput(page: Page) {
  const output: string[] = []
  page.on('console', (message) => output.push(message.text()))
  page.on('pageerror', (error) => output.push(`pageerror: ${error.message}`))
  return output
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(results.violations).toEqual([])
}

async function expectKeyboardFocusRing(page: Page) {
  const retry = page.getByRole('button', { name: 'Try Again' })
  // Arrive by keyboard, wherever the page's own initial focus went.
  await retry.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(retry).toBeFocused()
  const outline = await retry.evaluate((element) => {
    const style = getComputedStyle(element)
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
  })
  expect(outline.style).not.toBe('none')
  expect(outline.width).toBeGreaterThanOrEqual(2)
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled' })
}

for (const mode of ['Light', 'Dark'] as const) {
  test.describe(`${mode} theme`, () => {
    test.use({ viewport: { width: 1280, height: 800 } })

    test('a failed page keeps navigation usable and can be retried', async ({ page }, testInfo) => {
      const output = collectOutput(page)
      await page.addInitScript(() => { (window as FaultWindow).failPage = true })
      await mockApi(page, mode)
      await injectFault(page, '/src/features/mortgages/MortgagesPage.tsx', 'MortgagesPage', 'failPage')
      await page.goto('/')

      await page.getByRole('button', { name: 'Mortgages' }).click()

      const alert = page.getByRole('main').getByRole('alert')
      const retry = page.getByRole('button', { name: 'Try Again' })
      await expect(alert).toContainText('This content could not be displayed.')
      await expect(retry).toBeFocused()
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeEnabled()
      await expect(page.locator('html')).toHaveClass(mode === 'Dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/)
      await expect(page.locator('body')).not.toContainText('secret-marker')
      await expectKeyboardFocusRing(page)
      await expectAccessible(page)
      await capture(page, testInfo, `page-failed-${mode}`)

      await page.keyboard.press('Enter')
      await expect(alert).toContainText('This content failed to display again.')
      await expect(retry).toBeFocused()

      await page.getByRole('button', { name: 'Accounts' }).click()
      await expect(page.getByRole('heading', { name: 'Add an Account' })).toBeVisible()
      await expect(page.getByRole('alert')).toHaveCount(0)

      await page.getByRole('button', { name: 'Mortgages' }).click()
      await expect(alert).toContainText('This content could not be displayed.')
      await page.evaluate(() => { (window as FaultWindow).failPage = false })
      await retry.click()
      await expect(page.getByRole('main')).toContainText('Recovered Content')
      await expect(page.getByRole('alert')).toHaveCount(0)

      expect(output).toContain('Part of the page could not be displayed.')
      expect(output.filter((line) => /secret-marker|482913|pageerror:|MortgagesPage/.test(line))).toEqual([])
    })

    test('a failure in the app frame shows a message in the applied theme and can be retried', async ({ page }, testInfo) => {
      const output = collectOutput(page)
      let sessionRequests = 0
      await mockApi(page, mode)
      page.on('request', (request) => {
        if (new URL(request.url()).pathname === '/api/security/session') sessionRequests += 1
      })
      // The stand-in frame shows only the header, so the theme applies before the fault is switched on.
      await injectFault(page, '/src/components/ui/app-shell.tsx', 'AppShell', 'failFrame', 'props.header')
      await page.goto('/')
      await expect(page.getByRole('combobox', { name: 'Theme' })).toHaveValue(mode)

      await page.evaluate(() => { (window as FaultWindow).failFrame = true })
      await page.getByRole('button', { name: 'Import Limits' }).click()

      const alert = page.getByRole('main').getByRole('alert')
      const retry = page.getByRole('button', { name: 'Try Again' })
      await expect(alert).toContainText('Clutch could not be displayed.')
      await expect(retry).toBeFocused()
      await expect(page.locator('html')).toHaveClass(mode === 'Dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/)
      await expect(page.locator('body')).not.toContainText('secret-marker')
      await expectKeyboardFocusRing(page)
      await expectAccessible(page)
      await capture(page, testInfo, `app-failed-${mode}`)

      await page.keyboard.press('Enter')
      await expect(alert).toContainText('Clutch failed to display again.')

      const requestsBeforeRetry = sessionRequests
      await page.evaluate(() => { (window as FaultWindow).failFrame = false })
      await retry.click()
      await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible()
      await expect(page.getByRole('alert')).toHaveCount(0)
      expect(sessionRequests).toBeGreaterThan(requestsBeforeRetry)
      expect(output.filter((line) => /secret-marker|482913|pageerror:|AppShell/.test(line))).toEqual([])
    })

    test('a failed sign-in screen shows a message instead of a blank window', async ({ page }) => {
      const output = collectOutput(page)
      await page.addInitScript(() => { (window as FaultWindow).failSignIn = true })
      await mockApi(page, mode, false)
      await injectFault(page, '/src/features/auth/AuthPage.tsx', 'AuthPage', 'failSignIn')
      await page.goto('/')

      await expect(page.getByRole('main').getByRole('alert')).toContainText('Clutch could not be displayed.')
      await expectAccessible(page)
      await page.evaluate(() => { (window as FaultWindow).failSignIn = false })
      await page.getByRole('button', { name: 'Try Again' }).click()
      await expect(page.locator('body')).toContainText('Recovered Content')
      expect(output.filter((line) => /secret-marker|482913|pageerror:|AuthPage/.test(line))).toEqual([])
    })

    test('a failed add form leaves the category list usable', async ({ page }, testInfo) => {
      const output = collectOutput(page)
      await page.addInitScript(() => { (window as FaultWindow).failForm = true })
      await mockApi(page, mode)
      await injectFault(page, '/src/features/categories/AddCategoryForm.tsx', 'AddCategoryForm', 'failForm')
      await page.goto('/')

      await page.getByRole('button', { name: 'Categories' }).click()

      await expect(page.getByText('Food', { exact: true })).toBeVisible()
      await expect(page.getByRole('alert')).toContainText('This content could not be displayed.')
      await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
      await expectKeyboardFocusRing(page)
      await expectAccessible(page)
      await capture(page, testInfo, `add-form-failed-${mode}`)
      expect(output.filter((line) => /secret-marker|482913|pageerror:|AddCategoryForm/.test(line))).toEqual([])
    })
  })
}
