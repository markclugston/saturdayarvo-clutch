import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { ApiError } from '@/lib/api/client'
import { getTransactions } from '@/features/imports/api'
import { deleteTransaction } from './api'
import { TransactionsTable } from './TransactionsTable'

vi.mock('@/features/imports/api', () => ({
  getTransactions: vi.fn(),
}))

vi.mock('./api', () => ({
  deleteTransaction: vi.fn(),
}))

const transactionId = '550e8400-e29b-41d4-a716-446655440020'

function mockOneTransaction() {
  vi.mocked(getTransactions).mockResolvedValue({
    items: [{
      id: transactionId,
      transactionDate: '2025-01-15',
      description: 'Market',
      amount: '12.30',
      direction: 'Outgoing',
    }],
    nextCursor: null,
  })
}

describe('TransactionsTable delete action', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('opens a confirmation dialog and deletes only after confirmation', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    vi.mocked(deleteTransaction).mockResolvedValue(undefined)

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    await user.click(await screen.findByRole('button', { name: 'Delete transaction' }))
    const dialog = screen.getByRole('alertdialog')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(deleteTransaction).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(deleteTransaction).toHaveBeenCalledWith('account-id', transactionId),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(dialog).not.toBeInTheDocument()
  })

  it('cancels without calling the API', async () => {
    const user = userEvent.setup()
    mockOneTransaction()

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    await user.click(await screen.findByRole('button', { name: 'Delete transaction' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteTransaction).not.toHaveBeenCalled()
  })

  it('closes on Escape without calling the API', async () => {
    const user = userEvent.setup()
    mockOneTransaction()

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    await user.click(await screen.findByRole('button', { name: 'Delete transaction' }))
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteTransaction).not.toHaveBeenCalled()
  })

  it('shows a fixed error message and keeps the dialog open when delete fails', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    vi.mocked(deleteTransaction).mockRejectedValue(
      new ApiError(500, { title: 'Internal', detail: 'SQL exploded' }),
    )

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    await user.click(await screen.findByRole('button', { name: 'Delete transaction' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The transaction could not be deleted.',
    )
    expect(screen.queryByText(/SQL exploded/)).not.toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('shows a no-longer-exists message and refreshes the list on 404', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    vi.mocked(deleteTransaction).mockRejectedValue(
      new ApiError(404, { title: 'Transaction not found', detail: 'The transaction could not be found.' }),
    )

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    await user.click(await screen.findByRole('button', { name: 'Delete transaction' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This transaction no longer exists.')
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await waitFor(() => expect(getTransactions).toHaveBeenCalledTimes(2))
  })

  it('shows the generic message for a timeout and allows retry from the same row', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    vi.mocked(deleteTransaction)
      .mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))
      .mockResolvedValueOnce(undefined)

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    await user.click(await screen.findByRole('button', { name: 'Delete transaction' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The transaction could not be deleted.')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteTransaction).toHaveBeenCalledTimes(2)
  })

  it('sends only one request when Delete is clicked twice while busy', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    let resolveDelete: () => void = () => undefined
    vi.mocked(deleteTransaction).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve
      }),
    )

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    await user.click(await screen.findByRole('button', { name: 'Delete transaction' }))
    const deleteButton = screen.getByRole('button', { name: 'Delete' })
    await user.click(deleteButton)
    await user.click(deleteButton)

    expect(deleteTransaction).toHaveBeenCalledTimes(1)
    resolveDelete()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
})
