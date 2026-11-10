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
    expect(screen.getByText('Possible duplicate')).toBeInTheDocument()
  })

  it('shows right-aligned Amount and Balance columns, with Warning last, using a plain $ symbol', () => {
    const withBalance: ImportReview = {
      ...review,
      rows: [{ ...review.rows[0]!, balance: '1000.00' }],
    }
    render(<ImportReviewTable review={withBalance} currencyCode="AUD" />)

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers.slice(-3)).toEqual(['Amount', 'Balance', 'Warning'])
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toHaveClass('text-right')
    expect(screen.getByRole('columnheader', { name: 'Balance' })).toHaveClass('text-right')
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell')
    expect(cells.at(-3)).toHaveClass('text-right')
    expect(cells.at(-2)).toHaveClass('text-right')
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
  })

  it('omits the Balance column when no row has a balance', () => {
    render(<ImportReviewTable review={review} currencyCode="AUD" />)

    expect(screen.queryByRole('columnheader', { name: 'Balance' })).not.toBeInTheDocument()
  })
})
