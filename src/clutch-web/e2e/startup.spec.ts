import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('shows a blocking startup status without focusing non-interactive content', async ({ page }) => {
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
  const status = page.getByRole('status')
  await expect(status).toContainText('Checking Your Session')
  await expect(page.locator('h1')).toHaveText('Sign In')
  await expect(page.locator('main')).toHaveAttribute('inert')
  const backdrop = await page.locator('[data-slot="startup-backdrop"]').boundingBox()
  expect(backdrop).toMatchObject({ x: 0, y: 0, width: 1280, height: 720 })
  const emailBox = await page.locator('#email').boundingBox()
  expect(emailBox).not.toBeNull()
  if (!emailBox) throw new Error('Email input has no bounding box')
  await page.mouse.click(emailBox.x + emailBox.width / 2, emailBox.y + emailBox.height / 2)
  await page.keyboard.type('blocked')
  await expect(page.locator('#email')).toHaveValue('')
  await expect(status).not.toBeFocused()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')
  await expect(status).toBeVisible()
  await expect(status).not.toBeFocused()
  await expect(page.locator('#email')).not.toBeFocused()

  releaseSession?.()
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  await expect(status).toBeHidden()
  await page.getByRole('heading', { name: 'Sign In' }).evaluate((heading) => heading.focus())
  await expect(page.getByRole('heading', { name: 'Sign In' })).not.toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Email')).toBeFocused()
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
  // The app retries after 500 ms; allow headroom for a loaded machine running many workers.
  await expect(page.getByRole('heading', { name: 'Sign In', exact: true })).toBeVisible({ timeout: 15_000 })
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

  const switchButton = page.getByRole('button', { name: 'New Here? Create an Account' })
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
  await expect(page.getByRole('heading', { name: 'Create Your Account' })).toBeVisible()
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

test('centres the sign-in and sign-up card, and keeps its top reachable on a short screen', async ({ page }) => {
  await page.route('**/api/security/session', (route) => route.fulfill({
    status: 401,
    contentType: 'application/problem+json',
    body: JSON.stringify({ title: 'Authentication required', status: 401 }),
  }))
  await page.goto('/')

  /** How far the card's centre is from the panel's centre, in pixels. */
  const offCentre = async (name: string) => {
    const panel = (await page.getByRole('main').boundingBox())!
    const card = (await page.getByRole('region', { name }).boundingBox())!
    return {
      x: Math.abs((card.x + card.width / 2) - (panel.x + panel.width / 2)),
      y: Math.abs((card.y + card.height / 2) - (panel.y + panel.height / 2)),
    }
  }

  for (const name of ['Sign In', 'Create Your Account']) {
    if (name === 'Create Your Account') {
      await page.getByRole('button', { name: 'New Here? Create an Account' }).click()
    }
    for (const viewport of [{ width: 320, height: 812 }, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport)
      // Polled: the panel and card can be read between two layouts just after a resize.
      await expect.poll(() => offCentre(name), { message: `${name} at ${viewport.width} px is off centre` })
        .toEqual({ x: expect.closeTo(0, 0), y: expect.closeTo(0, 0) })
    }
  }

  await page.setViewportSize({ width: 320, height: 256 })
  await page.evaluate(() => window.scrollTo(0, 0))
  const card = (await page.getByRole('region', { name: 'Create Your Account' }).boundingBox())!
  expect(card.y).toBeGreaterThanOrEqual(0)
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
  await page.getByRole('button', { name: 'Try Again' }).click()
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
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
      await expect(page.getByRole('status')).toContainText('Checking Your Session')
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    }
  }

  releaseSession?.()
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
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
