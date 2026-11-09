import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures.js'

test.describe('theme selector', () => {
  test.skip(
    !process.env.PLAYWRIGHT_STORAGE_STATE,
    'Provide an authenticated browser state for the theme preference journey.',
  )

  test('restores the saved mode after reload and in another authenticated client', async ({
    browser,
    authenticatedPage,
  }) => {
    const storageState = await authenticatedPage.context().storageState()
    const selector = authenticatedPage.getByRole('combobox', { name: 'Theme' })
    await authenticatedPage.goto('/')
    await expect(selector).toBeVisible()
    const originalMode = await selector.inputValue()
    const selectedMode = originalMode === 'Dark' ? 'Light' : 'Dark'
    let otherContext: Awaited<ReturnType<typeof browser.newContext>> | undefined

    try {
      const saveResponse = authenticatedPage.waitForResponse((response) =>
        response.url().endsWith('/api/preferences/theme')
        && response.request().method() === 'PUT')
      await selector.selectOption(selectedMode)
      await expect(selector).toHaveValue(selectedMode)
      expect((await saveResponse).ok()).toBeTruthy()
      await expect.poll(() => authenticatedPage.locator('html').evaluate((element) =>
        element.classList.contains('dark'))).toBe(selectedMode === 'Dark')

      const desktopAccessibility = await new AxeBuilder({ page: authenticatedPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(desktopAccessibility.violations).toEqual([])

      await authenticatedPage.reload()
      await expect(authenticatedPage.getByRole('combobox', { name: 'Theme' }))
        .toHaveValue(selectedMode)

      otherContext = await browser.newContext({
        storageState,
        viewport: { width: 320, height: 812 },
      })
      const otherPage = await otherContext.newPage()
      await otherPage.goto('/')
      const otherSelector = otherPage.getByRole('combobox', { name: 'Theme' })
      await expect(otherSelector).toHaveValue(selectedMode)
      await expect.poll(() => otherPage.locator('html').evaluate((element) =>
        element.scrollWidth <= element.clientWidth))
        .toBe(true)
      const narrowMode = selectedMode === 'Dark' ? 'Light' : 'Dark'
      const narrowSaveResponse = otherPage.waitForResponse((response) =>
        response.url().endsWith('/api/preferences/theme')
        && response.request().method() === 'PUT')
      await otherSelector.selectOption(narrowMode)
      await expect(otherSelector).toHaveValue(narrowMode)
      expect((await narrowSaveResponse).ok()).toBeTruthy()

      const accessibility = await new AxeBuilder({ page: otherPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(accessibility.violations).toEqual([])
      await otherContext.close()
      otherContext = undefined
    } finally {
      await otherContext?.close()
      if (await selector.isVisible()) {
        await selector.selectOption(originalMode)
      }
    }
  })

  test('keeps a local selection and displays an error when saving fails', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/')
    const selector = authenticatedPage.getByRole('combobox', { name: 'Theme' })
    await expect(selector).toBeVisible()
    const originalMode = await selector.inputValue()
    const selectedMode = originalMode === 'Dark' ? 'Light' : 'Dark'
    await authenticatedPage.route('**/api/preferences/theme', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            status: 503,
            title: 'Preference service unavailable.',
          }),
        })
        return
      }

      await route.continue()
    })

    await selector.selectOption(selectedMode)
    await expect(selector).toHaveValue(selectedMode)
    await expect(authenticatedPage.getByRole('alert'))
      .toContainText('Your selection remains active for this visit.')
    await expect.poll(() => authenticatedPage.locator('html').evaluate((element) =>
      element.classList.contains('dark'))).toBe(selectedMode === 'Dark')
  })
})
