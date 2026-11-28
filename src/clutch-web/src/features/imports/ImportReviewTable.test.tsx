import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ImportReview } from '@/lib/api/schemas'
import { ImportReviewTable } from './ImportReviewTable'

const review: ImportReview = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  accountId: '550e8400-e29b-41d4-a716-446655440000',
  currencyCode: 'AUD',
  rowCount: 1,
  duplicateConfirmationRequired: true,
  expiresAtUtc: '2025-01-15T14:00:00.000Z',
  rows: [{
    sourceRowNumber: 2,
    transactionDate: '2025-01-15',
    description: 'Market',
    amount: '10.00',
    direction: 'Outgoing',
    isPossibleDuplicate: true,
  }],
}

describe('ImportReviewTable', () => {
  it('announces duplicate warnings and explains that flagged rows are still imported', () => {
    render(<ImportReviewTable review={review} currencyCode="AUD" />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Confirming will import every valid row, including these possible duplicates.',
    )
    expect(screen.getByText('Possible Duplicate')).toBeInTheDocument()
  })

  it('shows right-aligned Amount and Balance columns, with Warning last, using a plain $ symbol', () => {
    const withBalance: ImportReview = {
      ...review,
      rows: [{ ...review.rows[0]!, balance: '1000.00' }],
    }
    render(<ImportReviewTable review={withBalance} currencyCode="AUD" />)

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers.slice(-3)).toEqual(['Amount', 'Balance', 'Warning'])
    expect(headers).not.toContain('Row')
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toHaveClass('text-right')
    expect(screen.getByRole('columnheader', { name: 'Balance' })).toHaveClass('text-right')
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell')
    expect(cells.at(-3)).toHaveClass('text-right')
    expect(cells.at(-2)).toHaveClass('text-right')
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
  })

  it('lists rows in a card that stops while they scroll under a held header', () => {
    render(<ImportReviewTable review={review} currencyCode="AUD" />)

    const table = screen.getByRole('table', { name: 'Validated transactions for review' })
    const region = screen.getByRole('region', { name: 'Validated transactions' })
    const card = region.closest('[data-slot="card"]')!
    expect(region).toContainElement(table)
    expect(region).toHaveClass('overflow-x-auto', 'overflow-y-hidden')
    expect(region).toHaveAttribute('tabindex', '0')
    expect(card).toHaveClass('sticky', 'top-0')
    expect(card).toContainElement(screen.getByRole('heading', { name: 'Review Transactions' }))
    expect(card).toContainElement(screen.getByRole('status'))
    expect(region).not.toContainElement(screen.getByRole('status'))
    expect(table.querySelector('thead')).toHaveClass('sticky', 'top-0', 'z-10', 'bg-raised')
    expect(table.querySelector('tbody')).toHaveClass('isolate')
  })

  it('truncates a long description, keeping it in the title', () => {
    const description = 'x'.repeat(300)
    render(
      <ImportReviewTable currencyCode="AUD" review={{ ...review, rows: [{ ...review.rows[0]!, description }] }} />,
    )

    expect(screen.getByTitle(description)).toHaveClass('block', 'max-w-72', 'truncate', 'text-fg-secondary')
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell')
    expect(cells[0]).toHaveClass('whitespace-nowrap')
    expect(cells[3]).toHaveClass('whitespace-nowrap', 'text-right', 'tabular-nums')
  })

  it('leaves the Warning cell empty when there is no warning', () => {
    render(
      <ImportReviewTable
        currencyCode="AUD"
        review={{ ...review, rows: [{ ...review.rows[0]!, isPossibleDuplicate: false }] }}
      />,
    )

    expect(within(screen.getAllByRole('row')[1]!).getAllByRole('cell').at(-1)).toBeEmptyDOMElement()
  })

  it('omits the Balance column when no row has a balance', () => {
    render(<ImportReviewTable review={review} currencyCode="AUD" />)

    expect(screen.queryByRole('columnheader', { name: 'Balance' })).not.toBeInTheDocument()
  })
})
