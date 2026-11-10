import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/client'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { createAccount, getAccounts, getCurrencies } from './api'
import { AccountsPage } from './AccountsPage'

vi.mock('./api', () => ({
  createAccount: vi.fn(),
  getAccounts: vi.fn(),
  getCurrencies: vi.fn(),
}))

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getAccounts).mockResolvedValue([])
    vi.mocked(getCurrencies).mockResolvedValue([{
      code: 'AUD',
      name: 'Australian dollar',
      amountFormats: [{
        id: 'dot-decimal-comma-grouping',
        decimalSeparator: '.',
        groupSeparator: ',',
        reference: 'CLDR',
        version: '44.0',
      }],
    }])
  })

  it('creates an account and displays the currency name and code', async () => {
    const user = userEvent.setup()
    const onSelectAccount = vi.fn()
    vi.mocked(createAccount).mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      description: 'Everyday spending',
      currencyCode: 'AUD',
      lastSuccessfulImportAtUtc: null,
    })
    vi.mocked(getAccounts).mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Everyday spending',
        currencyCode: 'AUD',
        lastSuccessfulImportAtUtc: null,
      },
    ])

    renderWithQueryClient(<AccountsPage onSelectAccount={onSelectAccount} />)

    await user.type(await screen.findByLabelText('Account description'), 'Everyday spending')
    await user.selectOptions(screen.getByLabelText('Currency'), 'AUD')
    const submitButton = screen.getByRole('button', { name: 'Add account' })
    await user.tab()
    expect(submitButton).toHaveFocus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(createAccount).toHaveBeenCalledWith('Everyday spending', 'AUD'),
    )
    expect(onSelectAccount).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')
    expect(
      within(screen.getByRole('list')).getByText('Australian dollar (AUD)'),
    ).toBeInTheDocument()
  })

  it('moves focus to the accounts heading after loading', async () => {
    renderWithQueryClient(<AccountsPage onSelectAccount={vi.fn()} />)

    const heading = await screen.findByRole('heading', { name: 'Your accounts' })

    expect(heading).toHaveAttribute('tabindex', '-1')
    expect(heading).toHaveFocus()
    expect(screen.queryByRole('heading', { name: 'Your Family' })).not.toBeInTheDocument()
  })

  it('lists and selects each of multiple owned accounts', async () => {
    const user = userEvent.setup()
    const onSelectAccount = vi.fn()
    vi.mocked(getAccounts).mockResolvedValue([
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Everyday spending',
        currencyCode: 'AUD',
        lastSuccessfulImportAtUtc: null,
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        description: 'Travel savings',
        currencyCode: 'AUD',
        lastSuccessfulImportAtUtc: null,
      },
    ])

    renderWithQueryClient(<AccountsPage onSelectAccount={onSelectAccount} />)

    const everydayAccount = await screen.findByRole('button', { name: /Everyday spending/ })
    const travelAccount = screen.getByRole('button', { name: /Travel savings/ })
    expect(within(screen.getByRole('list')).getAllByRole('button')).toHaveLength(2)

    await user.click(everydayAccount)
    await user.click(travelAccount)

    expect(onSelectAccount).toHaveBeenNthCalledWith(1, '550e8400-e29b-41d4-a716-446655440000')
    expect(onSelectAccount).toHaveBeenNthCalledWith(2, '550e8400-e29b-41d4-a716-446655440001')
  })

  it('clears and does not echo a rejected description', async () => {
    const user = userEvent.setup()
    vi.mocked(createAccount).mockRejectedValue(
      new ApiError(400, {
        status: 400,
        title: 'The request is invalid.',
        detail: 'The account description is invalid.',
        errors: { description: ['The description is invalid.'] },
      }),
    )

    renderWithQueryClient(<AccountsPage onSelectAccount={vi.fn()} />)

    const descriptionInput = await screen.findByLabelText('Account description')
    await user.type(descriptionInput, 'BSB 123456')
    await user.selectOptions(screen.getByLabelText('Currency'), 'AUD')
    await user.click(screen.getByRole('button', { name: 'Add account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The account description is invalid.',
    )
    expect(descriptionInput).toHaveValue('')
    expect(screen.queryByText('BSB 123456')).not.toBeInTheDocument()
  })

  it('opens the selected account with its existing identifier', async () => {
    const user = userEvent.setup()
    const onSelectAccount = vi.fn()
    vi.mocked(getAccounts).mockResolvedValue([{
      id: '550e8400-e29b-41d4-a716-446655440000',
      description: 'Everyday spending',
      currencyCode: 'AUD',
      lastSuccessfulImportAtUtc: null,
    }])

    renderWithQueryClient(<AccountsPage onSelectAccount={onSelectAccount} />)

    const accountButton = await screen.findByRole('button', { name: /Everyday spending/ })
    expect(screen.getByRole('heading', { name: 'Your accounts' })).toHaveFocus()
    expect(accountButton.tagName).toBe('BUTTON')
    await user.click(accountButton)

    expect(onSelectAccount).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000')
  })
})
