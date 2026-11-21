import AxeBuilder from '@axe-core/playwright'
import type { BrowserContext, Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { test, expect } from './fixtures.js'

const testPassword = 'Clutch-E2e!Password-2026'

async function signIn(context: BrowserContext, email: string) {
  const csrfResponse = await context.request.get('/api/security/csrf-token')
  expect(csrfResponse.ok(), `${csrfResponse.status()} ${await csrfResponse.text()}`).toBeTruthy()
  const { requestToken } = await csrfResponse.json() as { requestToken: string }
  const response = await context.request.post('/api/security/login', {
    headers: { 'X-CSRF-TOKEN': requestToken },
    data: { email, password: testPassword },
  })
  expect(response.status(), await response.text()).toBe(204)
}

async function registerAndSignIn(context: BrowserContext, email: string) {
  const csrfResponse = await context.request.get('/api/security/csrf-token')
  expect(csrfResponse.ok(), `${csrfResponse.status()} ${await csrfResponse.text()}`).toBeTruthy()
  const { requestToken } = await csrfResponse.json() as { requestToken: string }
  const headers = { 'X-CSRF-TOKEN': requestToken }

  const registration = await context.request.post('/api/security/register', {
    headers,
    data: { email, password: testPassword },
  })
  expect(registration.status(), await registration.text()).toBe(201)

  await signIn(context, email)
}

async function importDeleteJourneyStatement(page: Page, { reimport = false } = {}) {
  await page.getByRole('button', { name: 'Import Transactions' }).click()
  await expect(page.getByRole('button', { name: 'Choose CSV File' })).toBeEnabled()
  await page.locator('#csv-file').setInputFiles({
    name: 'delete-journey.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Date,Description,Amount\n2025-01-15,Delete me first,10.00\n2025-01-16,Keep me second,20.00',
    ),
  })
  if (reimport) {
    // A repeat import reuses the account's saved column mapping.
    await page.getByRole('button', { name: 'Review Import with Saved Settings' }).click()
  } else {
    await page.getByLabel('Transaction Date Column').selectOption('0')
    await page.getByLabel('Description Column').selectOption('1')
    await page.getByLabel('Date Format').selectOption('yyyy-MM-dd')
    await page.getByLabel('Signed Amount Column').selectOption('2')
    await page.getByLabel('Incoming Transactions Use').selectOption('Positive')
    await page.getByLabel('Number Format Used in This File')
      .selectOption('dot-decimal-comma-grouping')
    await page.getByRole('button', { name: 'Review Import' }).click()
  }
  const confirm = page.getByRole('button', { name: 'Confirm Import' })
  await expect(confirm).toBeVisible()
  const duplicateAck = page.getByRole('checkbox', { name: /possible duplicates/ })
  if (await duplicateAck.count() > 0) {
    await duplicateAck.check()
  }
  await confirm.click()
  await expect(page.getByRole('status').filter({ hasText: 'transactions imported successfully' }))
    .toBeVisible()
  await page.getByRole('button', { name: 'Return to Account' }).click()
}

async function createAccountWithTransactions(page: Page, description: string) {
  await page.getByLabel('Account Description').fill(description)
  await page.getByLabel('Currency').selectOption('AUD')
  await page.getByRole('button', { name: 'Add Account' }).click()
  await expect(page.getByRole('heading', { name: 'Account Details' })).toBeVisible()

  await importDeleteJourneyStatement(page)
  await expect(page.getByText('Delete me first')).toBeVisible()
}

async function openAccountFromList(page: Page, description: string) {
  await page.getByRole('button', { name: description }).click()
  await expect(page.getByRole('heading', { name: 'Account Details' })).toBeVisible()
}

async function selectAndExpectTheme(page: Page, mode: 'Light' | 'Dark') {
  await page.getByLabel('Theme').selectOption(mode)
  await expect.poll(
    () => page.evaluate<boolean>('document.documentElement.classList.contains("dark")'),
  ).toBe(mode === 'Dark')
}

function deleteButtonFor(page: Page, description: string) {
  return page.getByRole('row').filter({ hasText: description })
    .getByRole('button', { name: 'Delete transaction' })
}

// Tab from the current focus until the delete action in the given row is focused.
async function tabToDeleteButtonFor(page: Page, description: string) {
  for (let press = 0; press < 40; press += 1) {
    const focusedInRow = await page.evaluate<boolean>(
      `(() => {
        const element = document.activeElement;
        return element?.getAttribute("aria-label") === "Delete transaction"
          && (element.closest("tr")?.textContent ?? "").includes(${JSON.stringify(description)});
      })()`,
    )
    if (focusedInRow) {
      return
    }
    await page.keyboard.press('Tab')
  }
  throw new Error(`Tab did not reach the delete action for "${description}" within 40 presses`)
}

async function expectNoAxeViolations(page: Page) {
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
}

type ContrastProbe = {
  focus: { outlineStyle: string; ratio: number }
  icons: number[]
}

// Runs in the browser. Colors are resolved through a canvas so oklch and alpha values are handled.
const nonTextContrastProbe = `(() => {
  const resolve = (css) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const data = context.getImageData(0, 0, 1, 1).data;
    return [data[0] / 255, data[1] / 255, data[2] / 255, data[3] / 255];
  };
  const luminance = ([r, g, b]) => {
    const linear = (channel) => channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const contrast = (foreground, background) => {
    const a = luminance(foreground);
    const b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const backdrop = (element) => {
    for (let node = element.parentElement; node; node = node.parentElement) {
      const color = resolve(getComputedStyle(node).backgroundColor);
      if (color[3] > 0) return color;
    }
    return resolve('#ffffff');
  };
  const focused = document.activeElement;
  const focusStyle = getComputedStyle(focused);
  const icons = Array.from(document.querySelectorAll('[aria-label="Delete transaction"]'))
    .map((element) => contrast(resolve(getComputedStyle(element).color), backdrop(element)));
  return {
    focus: {
      outlineStyle: focusStyle.outlineStyle,
      ratio: contrast(resolve(focusStyle.outlineColor), backdrop(focused)),
    },
    icons,
  };
})()`

// Colour transitions on buttons animate the outline from currentColor, so measure after they settle.
async function probeNonTextContrast(page: Page) {
  await page.evaluate('Promise.all(document.getAnimations().map((animation) => animation.finished))')
  return page.evaluate<ContrastProbe>(nonTextContrastProbe)
}

function expectNonTextContrast(probe: ContrastProbe) {
  expect(probe.focus.outlineStyle).not.toBe('none')
  expect(probe.focus.ratio).toBeGreaterThanOrEqual(3)
  expect(probe.icons.length).toBeGreaterThan(0)
  for (const ratio of probe.icons) {
    expect(ratio).toBeGreaterThanOrEqual(3)
  }
}

test.describe('delete imported transaction', () => {
  test('deletes one transaction after confirmation and keeps the rest', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(context, `delete-${randomUUID()}@example.test`)
    const page = await context.newPage()
    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await createAccountWithTransactions(page, `Delete journey ${Date.now()}`)

    const deleteButtons = page.getByRole('button', { name: 'Delete transaction' })
    await expect(deleteButtons).toHaveCount(2)
    const targetRow = page.getByRole('row').filter({ hasText: 'Delete me first' })
    await targetRow.getByRole('button', { name: 'Delete transaction' }).click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expectNoAxeViolations(page)

    const deleteResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'DELETE'
      && response.url().includes('/api/accounts/'),
    )
    const deleteStartedAt = Date.now()
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    const deleteResponse = await deleteResponsePromise
    expect(deleteResponse.status()).toBe(204)
    const durationMs = Date.now() - deleteStartedAt
    expect(durationMs).toBeLessThanOrEqual(500)

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByText('Delete me first')).toHaveCount(0)
    await expect(page.getByText('Keep me second')).toBeVisible()
    await expect(deleteButtons).toHaveCount(1)

    await context.close()
  })

  test('cancel leaves the transaction in place and shows no error at mobile width', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({
      baseURL: baseUrl,
      viewport: { width: 390, height: 844 },
    })
    await registerAndSignIn(context, `cancel-${randomUUID()}@example.test`)
    const page = await context.newPage()
    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await createAccountWithTransactions(page, `Cancel journey ${Date.now()}`)

    await page.getByRole('button', { name: 'Delete transaction' }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByText('Delete me first')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expectNoAxeViolations(page)

    await context.close()
  })

  test('escape closes the dialog without deleting and returns focus to the row', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(context, `escape-${randomUUID()}@example.test`)
    const page = await context.newPage()
    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await createAccountWithTransactions(page, `Escape journey ${Date.now()}`)

    await page.getByRole('button', { name: 'Delete transaction' }).first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByText('Delete me first')).toBeVisible()
    await expect(page.getByText('Keep me second')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete transaction' }).first()).toBeFocused()

    await context.close()
  })

  test('every row is deletable, no bulk control exists, and the last delete shows the empty state', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(context, `empty-${randomUUID()}@example.test`)
    const page = await context.newPage()
    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await createAccountWithTransactions(page, `Empty journey ${Date.now()}`)

    await expect(page.getByRole('checkbox')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /select|bulk|delete selected/i })).toHaveCount(0)

    for (const remaining of [2, 1]) {
      await expect(page.getByRole('button', { name: 'Delete transaction' })).toHaveCount(remaining)
      await page.getByRole('button', { name: 'Delete transaction' }).first().click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
      await expect(page.getByRole('alertdialog')).toHaveCount(0)
    }

    await expect(page.getByText('No transactions have been imported to this account.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete transaction' })).toHaveCount(0)

    await context.close()
  })

  test('shows the deleting state while a slow delete is pending', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(context, `busy-${randomUUID()}@example.test`)
    const page = await context.newPage()
    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await createAccountWithTransactions(page, `Busy journey ${Date.now()}`)

    await page.route('**/api/accounts/*/transactions/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.fallback()
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })

    await deleteButtonFor(page, 'Delete me first').click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Deleting…' })).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Delete me first')).toHaveCount(0)

    await context.close()
  })

  test('re-importing the same statement restores a deleted transaction', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(context, `reimport-${randomUUID()}@example.test`)
    const page = await context.newPage()
    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await createAccountWithTransactions(page, `Reimport journey ${Date.now()}`)

    await deleteButtonFor(page, 'Delete me first').click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByText('Delete me first')).toHaveCount(0)

    await importDeleteJourneyStatement(page, { reimport: true })
    await expect(page.getByText('Delete me first')).toBeVisible()

    await context.close()
  })

  test('closing the browser before confirming deletes nothing', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const email = `close-${randomUUID()}@example.test`
    const context = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(context, email)
    const page = await context.newPage()
    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    const description = `Close journey ${Date.now()}`
    await createAccountWithTransactions(page, description)

    await page.getByRole('button', { name: 'Delete transaction' }).first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await context.close()

    const reopened = await browser.newContext({ baseURL: baseUrl })
    await signIn(reopened, email)
    const reopenedPage = await reopened.newPage()
    await reopenedPage.goto(baseUrl)
    await expect(reopenedPage.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await openAccountFromList(reopenedPage, description)
    await expect(reopenedPage.getByText('Delete me first')).toBeVisible()
    await expect(reopenedPage.getByText('Keep me second')).toBeVisible()

    await reopened.close()
  })

  test('a transaction deleted in another tab shows not found and leaves the other rows', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(context, `concurrent-${randomUUID()}@example.test`)
    const page = await context.newPage()
    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    const description = `Concurrent journey ${Date.now()}`
    await createAccountWithTransactions(page, description)

    await deleteButtonFor(page, 'Delete me first').click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()

    const otherTab = await context.newPage()
    await otherTab.goto(baseUrl)
    await expect(otherTab.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await openAccountFromList(otherTab, description)
    await expect(otherTab.getByText('Delete me first')).toBeVisible()
    await otherTab.getByRole('row').filter({ hasText: 'Delete me first' })
      .getByRole('button', { name: 'Delete transaction' }).click()
    await otherTab.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(otherTab.getByText('Delete me first')).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText('This transaction no longer exists.')
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Keep me second')).toBeVisible()

    await context.close()
  })

  test('keyboard Tab, Enter, Space, and Shift+Tab operate the delete dialog at desktop and mobile widths', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({ baseURL: baseUrl })
    await registerAndSignIn(context, `keyboard-${randomUUID()}@example.test`)
    const page = await context.newPage()

    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      await page.goto(baseUrl)
      await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
      await createAccountWithTransactions(page, `Keyboard ${viewport.width} ${Date.now()}`)

      const trashButton = deleteButtonFor(page, 'Delete me first')
      // Tabbing before the rows render walks past them and exhausts the press budget.
      await expect(trashButton).toBeVisible()
      await tabToDeleteButtonFor(page, 'Delete me first')
      await expect(trashButton).toBeFocused()

      await page.keyboard.press('Enter')
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()

      await page.keyboard.press('Space')
      await expect(dialog).toHaveCount(0)
      await expect(trashButton).toBeFocused()
      await expect(page.getByText('Delete me first')).toBeVisible()

      await page.keyboard.press('Space')
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Shift+Tab')
      await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(dialog).toHaveCount(0)
      await expect(page.getByText('Delete me first')).toHaveCount(0)
      await expect(page.getByText('Keep me second')).toBeVisible()
    }

    await context.close()
  })

  test('system theme follows OS colour scheme changes and the dialog passes axe', async ({ browser }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
    const context = await browser.newContext({ baseURL: baseUrl, colorScheme: 'light' })
    await registerAndSignIn(context, `system-${randomUUID()}@example.test`)
    const page = await context.newPage()
    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
    await createAccountWithTransactions(page, `System theme ${Date.now()}`)

    const isDark = () => page.evaluate<boolean>('document.documentElement.classList.contains("dark")')
    await page.getByLabel('Theme').selectOption('System')
    await expect.poll(isDark).toBe(false)

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect.poll(isDark).toBe(true)
    await page.getByRole('button', { name: 'Delete transaction' }).first().click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await expectNoAxeViolations(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(isDark).toBe(false)

    await context.close()
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`dialog passes axe checks at desktop and mobile widths in ${scheme} mode`, async ({ browser }) => {
      const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
      const context = await browser.newContext({ baseURL: baseUrl, colorScheme: scheme })
      await registerAndSignIn(context, `axe-${scheme}-${randomUUID()}@example.test`)
      const page = await context.newPage()

      for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport)
        await page.goto(baseUrl)
        await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
        await selectAndExpectTheme(page, scheme === 'dark' ? 'Dark' : 'Light')
        await createAccountWithTransactions(page, `Axe ${scheme} ${viewport.width} ${Date.now()}`)

        await page.getByRole('button', { name: 'Delete transaction' }).first().click()
        await expect(page.getByRole('alertdialog')).toBeVisible()
        await expectNoAxeViolations(page)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('alertdialog')).toHaveCount(0)
      }

      await context.close()
    })
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`trash icons and focus indicators meet 3:1 non-text contrast in ${scheme} mode`, async ({ browser }) => {
      const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'
      const context = await browser.newContext({ baseURL: baseUrl, colorScheme: scheme })
      await registerAndSignIn(context, `contrast-${scheme}-${randomUUID()}@example.test`)
      const page = await context.newPage()
      await page.goto(baseUrl)
      await expect(page.getByRole('heading', { name: 'Your Accounts' })).toBeVisible()
      await selectAndExpectTheme(page, scheme === 'dark' ? 'Dark' : 'Light')
      await createAccountWithTransactions(page, `Contrast ${scheme} ${Date.now()}`)

      // A key press first puts Chromium in keyboard modality so :focus-visible matches programmatic focus.
      await page.keyboard.press('Shift')
      const trashButtons = page.getByRole('button', { name: 'Delete transaction' })
      await trashButtons.first().focus()
      await expect(trashButtons.first()).toBeFocused()
      expectNonTextContrast(await probeNonTextContrast(page))

      await trashButtons.first().click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
      await page.keyboard.press('Shift')
      expectNonTextContrast(await probeNonTextContrast(page))

      const deleteButton = dialog.getByRole('button', { name: 'Delete', exact: true })
      await page.keyboard.press('Shift')
      await deleteButton.focus()
      await expect(deleteButton).toBeFocused()
      expectNonTextContrast(await probeNonTextContrast(page))

      await context.close()
    })
  }
})
