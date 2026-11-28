import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { getTransactions } from '@/features/imports/api'
import { TransactionsTable } from './TransactionsTable'

vi.mock('@/features/imports/api', () => ({
  getTransactions: vi.fn(),
}))
// What the hook does with the elements is covered by its own tests.
const pinned = vi.hoisted(() => ({ trackRef: vi.fn(), listRef: vi.fn(), spacerRef: vi.fn() }))
vi.mock('@/lib/usePinnedList', () => ({ usePinnedList: () => pinned }))

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

    await user.click(screen.getByRole('button', { name: 'Load More' }))
    await waitFor(() => expect(screen.getByText('Salary')).toBeInTheDocument())
    expect(screen.getByText('Incoming')).toBeInTheDocument()
    expect(getTransactions).toHaveBeenNthCalledWith(2, 'account-id', 'next-page')
  })
  it('shows Balance as the right-most column only when a loaded transaction has a balance', async () => {
    vi.mocked(getTransactions).mockResolvedValueOnce({
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          transactionDate: '2025-01-15',
          description: 'Market',
          amount: '12.30',
          direction: 'Outgoing',
          balance: '-20.25',
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          transactionDate: '2025-01-14',
          description: 'Salary',
          amount: '1234.50',
          direction: 'Incoming',
          balance: null,
        },
      ],
      nextCursor: null,
    })

    renderWithQueryClient(
      <TransactionsTable accountId="account-id" currencyCode="AUD" />,
    )

    expect(await screen.findByText('Market')).toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers.at(-2)).toBe('Balance')
    expect(headers.at(-1)).toBe('Actions')
    expect(headers.indexOf('Balance')).toBe(headers.indexOf('Amount') + 1)
    expect(screen.getByRole('row', { name: /Market/ })).toHaveTextContent(
      formatCurrencyAmount('-20.25', 'AUD'),
    )
    const salaryCells = within(screen.getByRole('row', { name: /Salary/ })).getAllByRole('cell')
    expect(salaryCells.at(-1)).toHaveTextContent('')
  })

  it('shows a loading state at once while the list loads', () => {
    vi.mocked(getTransactions).mockReturnValue(new Promise(() => {}))

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Loading transactions…')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status.querySelector('svg')).toHaveClass('animate-spin')
  })

  it('offers a retry when the list fails to load', async () => {
    const user = userEvent.setup()
    vi.mocked(getTransactions)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ items: [], nextCursor: null })

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('The request could not be completed.')
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('No transactions yet. Import transactions to see them here.'))
      .toHaveClass('text-fg-secondary')
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('truncates a long description, keeps it in the title and never wraps dates or amounts', async () => {
    const description = 'x'.repeat(300)
    vi.mocked(getTransactions).mockResolvedValueOnce({
      items: [{
        id: '550e8400-e29b-41d4-a716-446655440022',
        transactionDate: '2025-01-15',
        description,
        amount: '5.00',
        direction: 'Outgoing',
        balance: '10.00',
      }],
      nextCursor: null,
    })

    renderWithQueryClient(<TransactionsTable accountId="account-id" currencyCode="AUD" />)

    expect(await screen.findByTitle(description)).toHaveClass('block', 'max-w-72', 'truncate', 'text-fg-secondary')
    const cells = within(screen.getByRole('row', { name: /Outgoing/ })).getAllByRole('cell')
    expect(cells[0]).toHaveClass('whitespace-nowrap')
    expect(cells[3]).toHaveClass('whitespace-nowrap', 'text-right', 'tabular-nums')
    expect(cells[4]).toHaveClass('whitespace-nowrap', 'text-right', 'tabular-nums')
  })

  it('gives each row an icon-only delete button named for its description and date', async () => {
    vi.mocked(getTransactions).mockResolvedValueOnce({
      items: [
        {
          id: '550e8400-e29b-41d4-a716-446655440020',
          transactionDate: '2025-01-15',
          description: 'First row',
          amount: '5.00',
          direction: 'Outgoing',
          balance: null,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440021',
          transactionDate: '2025-01-14',
          description: 'Second row',
          amount: '6.00',
          direction: 'Incoming',
          balance: null,
        },
      ],
      nextCursor: null,
    })

    renderWithQueryClient(
      <TransactionsTable accountId="account-id" currencyCode="AUD" />,
    )

    expect(await screen.findByText('First row')).toBeInTheDocument()
    const deleteButtons = screen.getAllByRole('button', { name: /^Delete / })
    expect(deleteButtons.map((button) => button.getAttribute('aria-label'))).toEqual([
      `Delete First row, ${formatLocalDate('2025-01-15')}`,
      `Delete Second row, ${formatLocalDate('2025-01-14')}`,
    ])
    for (const button of deleteButtons) {
      expect(button.textContent).toBe('')
    }
  })

  it('stops its card while the list scrolls, with the column header held in the list', async () => {
    vi.mocked(getTransactions).mockResolvedValueOnce({
      items: [{
        id: '550e8400-e29b-41d4-a716-446655440030',
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '12.30',
        direction: 'Outgoing',
        balance: '80.00',
      }],
      nextCursor: null,
    })

    renderWithQueryClient(
      <TransactionsTable accountId="account-id" currencyCode="AUD" />,
    )

    const table = await screen.findByRole('table', { name: 'Transactions for this account' })
    const header = table.querySelector('thead')!
    const region = table.closest('[role="region"]')!
    const card = region.closest('[data-slot="card"]')!
    const track = card.parentElement!
    const spacer = card.nextElementSibling!
    expect(pinned.trackRef).toHaveBeenCalledWith(track)
    expect(pinned.listRef).toHaveBeenCalledWith(region)
    expect(pinned.spacerRef).toHaveBeenCalledWith(spacer)
    expect(track).toHaveClass('min-w-0', '[overflow-anchor:none]')
    expect(track.firstElementChild).toBe(card)
    expect(card).toHaveClass('sticky', 'top-0')
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(header).toHaveClass('sticky', 'top-0', 'z-10', 'bg-raised')
    expect(table.querySelector('tbody')).toHaveClass('isolate')

    expect(region).toHaveAccessibleName('Transactions')
    expect(region).toHaveClass('overflow-x-auto', 'overflow-y-hidden', '[overflow-anchor:none]')
    expect(region).toHaveAttribute('tabindex', '0')
    // With nothing after the rows, the region is no wider than before.
    expect(region).not.toHaveClass('px-1')
    expect(card).toContainElement(screen.getByRole('heading', { name: 'Transactions' }))
    expect(region).not.toContainElement(screen.getByRole('heading', { name: 'Transactions' }))

    const headers = within(header).getAllByRole('columnheader')
    expect(headers.map((cell) => cell.textContent))
      .toEqual(['Date', 'Description', 'Direction', 'Amount', 'Balance', 'Actions'])
    for (const cell of headers) {
      expect(cell).toHaveAttribute('scope', 'col')
    }
    for (const cell of headers.slice(3)) {
      expect(cell).toHaveClass('text-right')
    }
  })

  it('puts Load More and its error at the end of the list, not under the stopped card', async () => {
    const user = userEvent.setup()
    vi.mocked(getTransactions)
      .mockResolvedValueOnce({
        items: [{
          id: '550e8400-e29b-41d4-a716-446655440031',
          transactionDate: '2025-01-15',
          description: 'Market',
          amount: '12.30',
          direction: 'Outgoing',
        }],
        nextCursor: 'next-page',
      })
      .mockRejectedValue(new Error('offline'))

    renderWithQueryClient(
      <TransactionsTable accountId="account-id" currencyCode="AUD" />,
    )

    const table = await screen.findByRole('table')
    const region = table.closest('[role="region"]')!
    const loadMore = screen.getByRole('button', { name: 'Load More' })
    expect(region).toContainElement(loadMore)
    expect(table.compareDocumentPosition(loadMore)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    // Stays at the left while the table scrolls sideways, with room for its focus ring.
    expect(loadMore.parentElement).toHaveClass('sticky', 'left-0', 'w-fit')
    expect(table.parentElement).toHaveClass('w-fit', 'min-w-full', 'pb-1')
    expect(table.parentElement).toContainElement(loadMore)
    expect(region).toHaveClass('-mx-1', '-mb-1', 'px-1')

    await user.click(loadMore)

    expect(region).toContainElement(await screen.findByRole('alert'))
  })

  it('omits the Balance column when no loaded transaction has a balance', async () => {
    vi.mocked(getTransactions).mockResolvedValueOnce({
      items: [{
        id: '550e8400-e29b-41d4-a716-446655440012',
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '12.30',
        direction: 'Outgoing',
      }],
      nextCursor: null,
    })

    renderWithQueryClient(
      <TransactionsTable accountId="account-id" currencyCode="AUD" />,
    )

    expect(await screen.findByText('Market')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Balance' })).not.toBeInTheDocument()
  })
})

function formatLocalDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
    .format(new Date(`${date}T00:00:00`))
}
