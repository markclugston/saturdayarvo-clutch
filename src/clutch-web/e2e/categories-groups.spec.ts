import AxeBuilder from '@axe-core/playwright'
import { randomUUID } from 'node:crypto'
import { test, expect } from './fixtures.js'

const testPassword = 'Clutch-E2e!Password-2026'

test('categories journey: create, nest, rename, reload, themes and delete', async ({ browser }) => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
  const context = await browser.newContext({ baseURL })

  try {
    const csrfResponse = await context.request.get('/api/security/csrf-token')
    expect(csrfResponse.ok()).toBeTruthy()
    const { requestToken } = await csrfResponse.json() as { requestToken: string }
    const headers = { 'X-CSRF-TOKEN': requestToken }
    const email = `categories-${randomUUID()}@example.test`
    const registration = await context.request.post('/api/security/register', {
      headers,
      data: { email, password: testPassword },
    })
    expect(registration.status(), await registration.text()).toBe(201)
    const signIn = await context.request.post('/api/security/login', {
      headers,
      data: { email, password: testPassword },
    })
    expect(signIn.status(), await signIn.text()).toBe(204)

    const page = await context.newPage()
    const list = () => page.getByRole('list', { name: 'Groups and categories' })
    const item = (name: string) => list().getByText(name, { exact: true })

    await page.goto('/')
    await page.getByRole('button', { name: 'Categories' }).click()
    await expect(page.getByRole('heading', { name: 'Categories and groups' })).toBeVisible()
    await expect(page.getByText(/no groups or categories yet/i)).toBeVisible()

    const addNode = async (name: string, parent: string | null) => {
      await page.getByLabel('Name', { exact: true }).fill(name)
      await page.getByLabel('Parent').selectOption(parent === null ? { value: '' } : { label: parent })
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(item(name)).toBeVisible()
    }

    await addNode('Food', null)
    await addNode('Home', null)
    await addNode('Groceries', 'Food')
    await addNode('Produce', 'Groceries')

    const names = await list().getByRole('listitem').evaluateAll((elements) =>
      elements.map((element) => element.querySelector('span')?.textContent))
    expect(names).toEqual(['Food', 'Groceries', 'Produce', 'Home'])

    await page.getByLabel('Name', { exact: true }).fill('food')
    await page.getByLabel('Parent').selectOption({ value: '' })
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('same place')
    await page.getByLabel('Name', { exact: true }).fill('')

    const fontSize = (text: string) => item(text)
      .evaluate((element) => parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element).fontSize ?? '0'))
    expect(await fontSize('Food')).toBeGreaterThan(await fontSize('Groceries'))

    await expect(page.getByRole('button', { name: /move|reorder/i })).toHaveCount(0)

    await page.getByRole('button', { name: 'Rename Groceries' }).click()
    await page.getByLabel('New name for Groceries').fill('Supermarket')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(item('Supermarket')).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Categories' }).click()
    await expect(item('Supermarket')).toBeVisible()
    await expect(item('Produce')).toBeVisible()

    for (const mode of ['Dark', 'Light']) {
      await page.getByRole('combobox', { name: 'Theme' }).selectOption(mode)
      await expect.poll(() => page.locator('html').evaluate((element) =>
        element.classList.contains('dark'))).toBe(mode === 'Dark')
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze()
      expect(accessibility.violations).toEqual([])
    }

    await page.getByRole('button', { name: 'Delete Food' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('and 2 categories inside it')
    await expect(dialog).toContainText('Do you want to continue?')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(item('Supermarket')).toBeVisible()

    for (const group of ['Food', 'Home']) {
      await page.getByRole('button', { name: `Delete ${group}` }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click()
      await expect(page.getByRole('alertdialog')).toHaveCount(0)
    }

    await expect(page.getByText(/no groups or categories yet/i)).toBeVisible()
  } finally {
    await context.close()
  }
})
