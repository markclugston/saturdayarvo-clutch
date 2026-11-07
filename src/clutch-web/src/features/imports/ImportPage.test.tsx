import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccount, getCurrencies } from '@/features/accounts/api'
import { ApiError } from '@/lib/api/client'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { cancelActiveImportReview, cancelImportReview, confirmImportReview, createImportReview } from './api'
import { ImportPage } from './ImportPage'

vi.mock('@/features/accounts/api', () => ({
  getAccount: vi.fn(),
  getCurrencies: vi.fn(),
}))

vi.mock('./api', () => ({
  cancelActiveImportReview: vi.fn(),
  cancelImportReview: vi.fn(),
  confirmImportReview: vi.fn(),
  createImportReview: vi.fn(),
}))

const account = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  familyId: '550e8400-e29b-41d4-a716-446655440001',
  description: 'Everyday spending',
  currencyCode: 'AUD',
  lastSuccessfulImportAtUtc: null,
}

const currency = {
  code: 'AUD',
  name: 'Australian Dollar',
  amountFormats: [
    {
      id: 'dot-decimal-comma-grouping',
      decimalSeparator: '.',
      groupSeparator: ',',
      reference: 'CLDR',
      version: '44.0',
    },
    {
      id: 'comma-decimal-dot-grouping',
      decimalSeparator: ',',
      groupSeparator: '.',
      reference: 'CLDR',
      version: '44.0',
    },
  ],
}

describe('ImportPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getAccount).mockResolvedValue(account)
    vi.mocked(getCurrencies).mockResolvedValue([currency])
    vi.mocked(createImportReview).mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440002',
      accountId: account.id,
      currencyCode: 'AUD',
      rowCount: 1,
      duplicateConfirmationRequired: false,
      expiresAtUtc: '2025-01-15T14:00:00.000Z',
      rows: [{
        sourceRowNumber: 2,
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '1234.50',
        direction: 'Outgoing',
        isPossibleDuplicate: false,
      }],
    })
    vi.mocked(cancelImportReview).mockResolvedValue(undefined)
    vi.mocked(cancelActiveImportReview).mockResolvedValue(undefined)
    vi.mocked(confirmImportReview).mockResolvedValue({
      importedCount: 1,
      completedAtUtc: '2025-01-15T13:50:00.000Z',
    })
  })

  it('only discards a conflicting review after the user chooses recovery', async () => {
    vi.mocked(createImportReview).mockRejectedValue(new ApiError(409, {
      detail: 'An import is already active for this account.',
    }))
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV file'),
      new File(['Date,Description,Amount\n2025-01-15,Market,10.00'], 'transactions.csv', {
        type: 'text/csv',
      }),
    )
    await user.selectOptions(await screen.findByLabelText('Transaction date column'), '0')
    await user.selectOptions(screen.getByLabelText('Description column'), '1')
    await user.selectOptions(screen.getByLabelText('Date format'), 'yyyy-MM-dd')
    await user.selectOptions(screen.getByLabelText('Signed amount column'), '2')
    await user.selectOptions(screen.getByLabelText('Incoming transactions use'), 'Positive')
    await user.selectOptions(screen.getByLabelText('Number format used in this file'), 'dot-decimal-comma-grouping')
    await user.click(screen.getByRole('button', { name: 'Review import' }))
    const discard = await screen.findByRole('button', { name: 'Discard active review' })
    expect(cancelActiveImportReview).not.toHaveBeenCalled()
    await user.click(discard)
    await waitFor(() => expect(cancelActiveImportReview).toHaveBeenCalledWith(account.id))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Discard active review' })).not.toBeInTheDocument())
  })

  it('displays the safe row and field from an import validation error', async () => {
    vi.mocked(createImportReview).mockRejectedValue(new ApiError(400, {
      detail: 'A transaction date does not match the selected date format.',
      errors: { rowNumber: ['2'], field: ['TransactionDate'] },
    }))
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV file'),
      new File(['Date,Description,Amount\n15/01/2025,Market,10.00'], 'transactions.csv', {
        type: 'text/csv',
      }),
    )
    await user.selectOptions(await screen.findByLabelText('Transaction date column'), '0')
    await user.selectOptions(screen.getByLabelText('Description column'), '1')
    await user.selectOptions(screen.getByLabelText('Date format'), 'yyyy-MM-dd')
    await user.selectOptions(screen.getByLabelText('Signed amount column'), '2')
    await user.selectOptions(screen.getByLabelText('Incoming transactions use'), 'Positive')
    await user.selectOptions(
      screen.getByLabelText('Number format used in this file'),
      'dot-decimal-comma-grouping',
    )
    await user.click(screen.getByRole('button', { name: 'Review import' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A transaction date does not match the selected date format. (Row 2, field: TransactionDate)',
    )
  })

  it('maps, reviews, and explicitly confirms a CSV import', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)

    await user.upload(
      await screen.findByLabelText('CSV file'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-1234.50'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )

    await user.selectOptions(await screen.findByLabelText('Transaction date column'), '0')
    await user.selectOptions(screen.getByLabelText('Description column'), '1')
    await user.selectOptions(screen.getByLabelText('Date format'), 'yyyy-MM-dd')
    await user.selectOptions(screen.getByLabelText('Signed amount column'), '2')
    await user.selectOptions(screen.getByLabelText('Incoming transactions use'), 'Positive')
    await user.selectOptions(
      screen.getByLabelText('Number format used in this file'),
      'dot-decimal-comma-grouping',
    )
    await user.click(screen.getByRole('button', { name: 'Review import' }))

    await waitFor(() =>
      expect(createImportReview).toHaveBeenCalledWith(
        account.id,
        expect.any(File),
        {
          dateColumn: 0,
          descriptionColumn: 1,
          dateFormat: 'yyyy-MM-dd',
          amountMode: 'Signed',
          numberFormat: 'dot-decimal-comma-grouping',
          signedAmountColumn: 2,
          incomingSign: 'Positive',
        },
      ),
    )
    expect(await screen.findByText('Market')).toBeInTheDocument()
    expect(screen.getByText(formatCurrencyAmount('1234.50', 'AUD'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm import' }))

    await waitFor(() =>
      expect(confirmImportReview).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440002',
        false,
      ),
    )
    expect(await screen.findByText('1 transactions imported successfully.'))
      .toBeInTheDocument()
  })

  it('requires explicit confirmation to import flagged rows and keeps cancellation available', async () => {
    vi.mocked(createImportReview).mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440003',
      accountId: account.id,
      currencyCode: 'AUD',
      rowCount: 1,
      duplicateConfirmationRequired: true,
      expiresAtUtc: '2025-01-15T14:00:00.000Z',
      rows: [{
        sourceRowNumber: 2,
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '1234.50',
        direction: 'Outgoing',
        isPossibleDuplicate: true,
      }],
    })

    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={vi.fn()} />)
    await user.upload(
      await screen.findByLabelText('CSV file'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-1234.50'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )
    await user.selectOptions(await screen.findByLabelText('Transaction date column'), '0')
    await user.selectOptions(screen.getByLabelText('Description column'), '1')
    await user.selectOptions(screen.getByLabelText('Date format'), 'yyyy-MM-dd')
    await user.selectOptions(screen.getByLabelText('Signed amount column'), '2')
    await user.selectOptions(screen.getByLabelText('Incoming transactions use'), 'Positive')
    await user.selectOptions(
      screen.getByLabelText('Number format used in this file'),
      'dot-decimal-comma-grouping',
    )
    await user.click(screen.getByRole('button', { name: 'Review import' }))

    expect(await screen.findByText(/Confirming will import every valid row/))
      .toBeInTheDocument()
    const confirmButton = screen.getByRole('button', { name: 'Confirm import' })
    expect(confirmButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel review' })).toBeEnabled()

    await user.click(screen.getByLabelText(
      /I reviewed the possible duplicates and want to import every valid row/,
    ))
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)
    await waitFor(() =>
      expect(confirmImportReview).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440003',
        true,
      ),
    )
  })

  it('cancels a duplicate review without confirming it', async () => {
    vi.mocked(createImportReview).mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440004',
      accountId: account.id,
      currencyCode: 'AUD',
      rowCount: 1,
      duplicateConfirmationRequired: true,
      expiresAtUtc: '2025-01-15T14:00:00.000Z',
      rows: [{
        sourceRowNumber: 2,
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '1234.50',
        direction: 'Outgoing',
        isPossibleDuplicate: true,
      }],
    })

    const onBack = vi.fn()
    const user = userEvent.setup()
    renderWithQueryClient(<ImportPage accountId={account.id} onBack={onBack} />)
    await user.upload(
      await screen.findByLabelText('CSV file'),
      new File(
        ['Date,Description,Amount\n2025-01-15,Market,-1234.50'],
        'transactions.csv',
        { type: 'text/csv' },
      ),
    )
    await user.selectOptions(await screen.findByLabelText('Transaction date column'), '0')
    await user.selectOptions(screen.getByLabelText('Description column'), '1')
    await user.selectOptions(screen.getByLabelText('Date format'), 'yyyy-MM-dd')
    await user.selectOptions(screen.getByLabelText('Signed amount column'), '2')
    await user.selectOptions(screen.getByLabelText('Incoming transactions use'), 'Positive')
    await user.selectOptions(
      screen.getByLabelText('Number format used in this file'),
      'dot-decimal-comma-grouping',
    )
    await user.click(screen.getByRole('button', { name: 'Review import' }))
    await screen.findByText(/Confirming will import every valid row/)
    await user.click(screen.getByRole('button', { name: 'Cancel review' }))

    await waitFor(() =>
      expect(cancelImportReview).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440004',
      ),
    )
    expect(onBack).toHaveBeenCalledOnce()
    expect(confirmImportReview).not.toHaveBeenCalled()
  })
})
