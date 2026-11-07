import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

type AuthenticatedFixtures = {
  authenticatedPage: Page
}

export const test = base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ page }, use) => {
    if (!process.env.PLAYWRIGHT_STORAGE_STATE) {
      throw new Error('Set PLAYWRIGHT_STORAGE_STATE to a secured authenticated browser state file.')
    }

    await use(page)
  },
})

export { expect }
