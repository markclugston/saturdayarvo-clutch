import { render, screen } from '@testing-library/react'
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
})
