import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { getTransactions } from '@/features/imports/api'
import { TransactionsTable } from './TransactionsTable'

vi.mock('@/features/imports/api', () => ({
  getTransactions: vi.fn(),
}))

describe('TransactionsTable', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('displays localized dates, exact currency formatting, and clear directions', async () => {
    const user = userEvent.setup()
    vi.mocked(getTransactions)
      .mockResolvedValueOnce({
        items: [{
          id: '550e8400-e29b-41d4-a716-446655440000',
          transactionDate: '2025-01-15',
          description: 'Market',
          amount: '12.3',
          direction: 'Outgoing',
        }],
        nextCursor: 'next-page',
      })
      .mockResolvedValueOnce({
        items: [{
          id: '550e8400-e29b-41d4-a716-446655440001',
          transactionDate: '2025-01-14',
          description: 'Salary',
          amount: '1234.50',
          direction: 'Incoming',
        }],
        nextCursor: null,
      })

    renderWithQueryClient(
      <TransactionsTable accountId="account-id" currencyCode="AUD" />,
    )

    expect(await screen.findByText('Market')).toBeInTheDocument()
    expect(screen.getByText('Outgoing')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /Market/ })).toHaveTextContent(
      formatLocalDate('2025-01-15'),
    )
    expect(screen.getByText(formatCurrencyAmount('12.3', 'AUD'))).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(screen.getByText('Salary')).toBeInTheDocument())
    expect(screen.getByText('Incoming')).toBeInTheDocument()
    expect(getTransactions).toHaveBeenNthCalledWith(2, 'account-id', 'next-page')
  })
})

function formatLocalDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
    .format(new Date(`${date}T00:00:00`))
}
