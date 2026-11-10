import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { getTransactions } from '@/features/imports/api'
import { getAccount, getCurrencies, updateAccountDescription } from './api'
import { AccountDetails } from './AccountDetails'

vi.mock('./api', () => ({
  getAccount: vi.fn(),
  getCurrencies: vi.fn(),
  updateAccountDescription: vi.fn(),
}))

vi.mock('@/features/imports/api', () => ({
  getTransactions: vi.fn(),
}))

const existingAccount = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  description: 'Everyday spending',
  currencyCode: 'AUD',
  lastSuccessfulImportAtUtc: '2025-01-15T13:45:00.000Z',
}

describe('AccountDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getAccount).mockResolvedValue(existingAccount)
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
    vi.mocked(getTransactions).mockResolvedValue({ items: [], nextCursor: null })
    vi.mocked(updateAccountDescription).mockResolvedValue({
      ...existingAccount,
      description: 'Household expenses',
    })
  })

  it('edits the description while retaining currency and showing localized import time', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(
      <AccountDetails accountId={existingAccount.id} onBack={vi.fn()} onImport={vi.fn()} />,
    )

    expect(await screen.findByText('Currency: Australian dollar (AUD)')).toBeInTheDocument()
    const expectedTimestamp = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(existingAccount.lastSuccessfulImportAtUtc))
    expect(screen.getByText(/Last successful import:/)).toHaveTextContent(expectedTimestamp)

    const descriptionInput = screen.getByLabelText('Account description')
    await user.clear(descriptionInput)
    await user.type(descriptionInput, 'Household expenses')
    await user.click(screen.getByRole('button', { name: 'Save description' }))

    await waitFor(() =>
      expect(updateAccountDescription).toHaveBeenCalledWith(
        existingAccount.id,
        'Household expenses',
      ),
    )
    expect(screen.getByText('Currency: Australian dollar (AUD)')).toBeInTheDocument()
  })

  it('uses named buttons to return to accounts or open import for this account', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const onImport = vi.fn()
    renderWithQueryClient(
      <AccountDetails accountId={existingAccount.id} onBack={onBack} onImport={onImport} />,
    )

    expect(await screen.findByRole('heading', { name: 'Account details' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Back to accounts' }))
    await user.click(screen.getByRole('button', { name: 'Import transactions' }))

    expect(onBack).toHaveBeenCalledOnce()
    expect(onImport).toHaveBeenCalledOnce()
  })
})
