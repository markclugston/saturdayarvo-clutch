import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
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
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date('2025-01-15T00:00:00'))
const rowButton = `Delete Market, ${date}`

const market = {
  id: transactionId,
  transactionDate: '2025-01-15',
  description: 'Market',
  amount: '12.30',
  direction: 'Outgoing' as const,
}

function mockOneTransaction() {
  vi.mocked(getTransactions).mockResolvedValue({ items: [market], nextCursor: null })
}

function render() {
  return renderWithQueryClient(
    <ToastProvider>
      <TransactionsTable accountId="account-id" currencyCode="AUD" />
    </ToastProvider>,
  )
}

/** Opens the dialog for the one transaction. */
async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: rowButton }))
  return screen.getByRole('alertdialog')
}

describe('TransactionsTable delete action', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('names the transaction, says it cannot be undone and deletes only after confirmation', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    vi.mocked(deleteTransaction).mockResolvedValue(undefined)
    render()

    const dialog = await openDialog(user)

    expect(dialog).toHaveAccessibleName('Delete Transaction')
    expect(dialog).toHaveAccessibleDescription('This permanently deletes “Market”. This cannot be undone.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(deleteTransaction).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(deleteTransaction).toHaveBeenCalledWith('account-id', transactionId),
    )
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Market was deleted.')).toBeInTheDocument()
  })

  it('still confirms the deletion of the last transaction, whose list becomes empty', async () => {
    const user = userEvent.setup()
    vi.mocked(getTransactions)
      .mockResolvedValueOnce({ items: [market], nextCursor: null })
      .mockResolvedValue({ items: [], nextCursor: null })
    vi.mocked(deleteTransaction).mockResolvedValue(undefined)
    render()

    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Market was deleted.')).toBeInTheDocument()
    expect(screen.getByText('No transactions yet. Import transactions to see them here.')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('cancels without calling the API', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    render()

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(deleteTransaction).not.toHaveBeenCalled()
  })

  it('closes on Escape without calling the API', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    render()

    await openDialog(user)
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
    render()

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The transaction could not be deleted.',
    )
    expect(screen.queryByText(/SQL exploded/)).not.toBeInTheDocument()
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.queryByText('Market was deleted.')).not.toBeInTheDocument()
  })

  it('shows a no-longer-exists message and refreshes the list on 404', async () => {
    const user = userEvent.setup()
    vi.mocked(getTransactions)
      .mockResolvedValueOnce({ items: [market], nextCursor: null })
      .mockResolvedValue({ items: [], nextCursor: null })
    vi.mocked(deleteTransaction).mockRejectedValue(
      new ApiError(404, { title: 'Transaction not found', detail: 'The transaction could not be found.' }),
    )
    render()

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('This transaction no longer exists.')
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    await waitFor(() => expect(getTransactions).toHaveBeenCalledTimes(2))
    // The dialog stays until closed, even though the refreshed list is empty.
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows the generic message for a timeout and allows retry from the same row', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    vi.mocked(deleteTransaction)
      .mockRejectedValueOnce(new DOMException('Timed out', 'TimeoutError'))
      .mockResolvedValueOnce(undefined)
    render()

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The transaction could not be deleted.')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(deleteTransaction).toHaveBeenCalledTimes(2)
  })

  it('shows Deleting at once, disables both buttons and sends only one request', async () => {
    const user = userEvent.setup()
    mockOneTransaction()
    let resolveDelete: () => void = () => undefined
    vi.mocked(deleteTransaction).mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve
      }),
    )
    render()

    await openDialog(user)
    const deleteButton = screen.getByRole('button', { name: 'Delete' })
    await user.click(deleteButton)
    await user.click(deleteButton)

    expect(await screen.findByRole('button', { name: 'Deleting…' }, { timeout: 300 })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(deleteTransaction).toHaveBeenCalledTimes(1)
    resolveDelete()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
})
