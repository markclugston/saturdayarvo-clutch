import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures.js'

test.describe('administrator import limits', () => {
  test.skip(
    !process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE,
    'Provide an administrator storage state for the limit-management journey.',
  )

  test('updates shared limits immediately and restores the original value', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({
      storageState: process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE,
    })
    const page = await context.newPage()
    await page.goto(baseUrl)

    try {
      await page.getByRole('button', { name: 'Import limits' }).click()
      await expect(page.getByRole('heading', { name: 'Import limits' })).toBeVisible()
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(accessibility.violations).toEqual([])

      const rowLimit = page.getByLabel('Maximum rows per import')
      const originalLimit = Number(await rowLimit.inputValue())
      await rowLimit.fill(String(originalLimit + 1))
      await page.getByRole('button', { name: 'Save limits' }).click()
      await expect(rowLimit).toHaveValue(String(originalLimit + 1))

      await rowLimit.fill(String(originalLimit))
      await page.getByRole('button', { name: 'Save limits' }).click()
      await expect(rowLimit).toHaveValue(String(originalLimit))
    } finally {
      await context.close()
    }
  })
})
