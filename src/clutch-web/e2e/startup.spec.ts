import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('shows a blocking startup dialog until the session check completes', async ({ page }) => {
  let releaseSession: (() => void) | undefined
  await page.route('**/api/security/session', async (route) => {
    await new Promise<void>((resolve) => {
      releaseSession = resolve
    })
    await route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'Authentication required', status: 401 }),
    })
  })

  await page.goto('/')
  const dialog = page.getByRole('dialog', { name: 'Checking your session' })
  await expect(dialog).toBeVisible()
  await expect(page.locator('h1')).toHaveText('Sign in')
  await expect(dialog).toHaveAttribute('aria-describedby')
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  const backdrop = await page.locator('[data-slot="dialog-backdrop"]').boundingBox()
  expect(backdrop).toMatchObject({ x: 0, y: 0, width: 1280, height: 720 })
  await expect(dialog).toBeFocused()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  await expect(dialog).toBeVisible()
  await expect(dialog).toBeFocused()

  releaseSession?.()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(dialog).toBeHidden()
})

test('recovers automatically from a temporary session failure', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/security/session', async (route) => {
    attempts += 1
    await route.fulfill(
      attempts === 1
        ? {
            status: 503,
            contentType: 'application/problem+json',
            body: JSON.stringify({ title: 'Unavailable', status: 503 }),
          }
        : {
            status: 401,
            contentType: 'application/problem+json',
            body: JSON.stringify({ title: 'Authentication required', status: 401 }),
          },
    )
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 5000 })
  expect(attempts).toBe(2)
})

test('keeps sign-in buttons keyboard-accessible and responsive across themes and viewports', async ({
  page,
}) => {
  await page.route('**/api/security/session', (route) => route.fulfill({
    status: 401,
    contentType: 'application/problem+json',
    body: JSON.stringify({ title: 'Authentication required', status: 401 }),
  }))
  await page.goto('/')

  const switchButton = page.getByRole('button', { name: 'New here? Create an account' })
  await expect(switchButton).toBeVisible()
  await expect(page.locator('a[href]')).toHaveCount(0)
  await switchButton.hover()
  await expect.poll(() => switchButton.evaluate((button) =>
    button.ownerDocument.defaultView?.getComputedStyle(button).cursor))
    .toBe('pointer')

  await switchButton.focus()
  await expect(switchButton).toBeFocused()
  const startedAt = await page.evaluate(() => performance.now())
  await page.keyboard.press('Space')
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  const responseTime = await page.evaluate((start) => performance.now() - start, startedAt)
  expect(responseTime).toBeLessThan(500)

  for (const viewport of [{ width: 320, height: 812 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport)
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme })
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(results.violations).toEqual([])
    }
  }
})

test('allows retry after a non-transient startup error without reloading', async ({ page }) => {
  let attempts = 0
  let retrying = false
  await page.route('**/api/security/session', async (route) => {
    attempts += 1
    await route.fulfill(retrying
      ? {
          status: 401,
          contentType: 'application/problem+json',
          body: JSON.stringify({ title: 'Authentication required', status: 401 }),
        }
      : {
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({ title: 'Server error', status: 500 }),
        })
  })

  await page.goto('/')
  await expect(page.getByRole('alert')).toHaveText('Unable to load your session. Please try again.')
  const currentUrl = page.url()
  retrying = true
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  expect(attempts).toBeGreaterThanOrEqual(2)
  expect(page.url()).toBe(currentUrl)
})

test('keeps startup loading accessible across supported viewport and color modes', async ({ page }) => {
  let releaseSession: (() => void) | undefined
  await page.route('**/api/security/session', async (route) => {
    await new Promise<void>((resolve) => {
      releaseSession = resolve
    })
    await route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ title: 'Authentication required', status: 401 }),
    })
  })
  await page.goto('/')

  for (const viewport of [{ width: 320, height: 812 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport)
    for (const mode of ['light', 'dark', 'system'] as const) {
      const colorScheme = mode === 'light' ? 'light' : 'dark'
      await page.emulateMedia({ colorScheme })
      await page.locator('html').evaluate((html, scheme) => {
        html.classList.toggle('dark', scheme !== 'light')
      }, mode)
      await expect(page.getByRole('dialog', { name: 'Checking your session' })).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    }
  }

  releaseSession?.()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('keeps the retryable startup error accessible across supported viewport and color modes', async ({ page }) => {
  await page.route('**/api/security/session', (route) => route.fulfill({
    status: 500,
    contentType: 'application/problem+json',
    body: JSON.stringify({ title: 'Server error', status: 500 }),
  }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toHaveText('Unable to load your session. Please try again.')

  for (const viewport of [{ width: 320, height: 812 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport)
    for (const mode of ['light', 'dark', 'system'] as const) {
      const colorScheme = mode === 'light' ? 'light' : 'dark'
      await page.emulateMedia({ colorScheme })
      await page.locator('html').evaluate((html, scheme) => {
        html.classList.toggle('dark', scheme !== 'light')
      }, mode)
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    }
  }
})
