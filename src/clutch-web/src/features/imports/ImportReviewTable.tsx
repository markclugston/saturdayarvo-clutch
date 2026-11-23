import { Card, CardTitle } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import type { ImportReview } from '@/lib/api/schemas'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'

type ImportReviewTableProps = {
  review: ImportReview
  currencyCode: string
}

export function ImportReviewTable({ review, currencyCode }: ImportReviewTableProps) {
  const showBalance = review.rows.some((row) => row.balance != null)
  return (
    <Card aria-labelledby="import-review-heading" as="section" className="min-w-0 space-y-4">
      <div>
        <CardTitle as="h2" id="import-review-heading">Review Transactions</CardTitle>
        <p>
          {review.rowCount} transactions will be imported into this account in {currencyCode}.
        </p>
      </div>
      {review.duplicateConfirmationRequired && (
        <p className="rounded-control bg-warning-bg p-3 text-warning" role="status">
          Possible duplicates are highlighted. Confirming will import every valid row,
          including these possible duplicates.
        </p>
      )}
      <div
        aria-label="Validated transactions"
        className="overflow-x-auto rounded-control focus-visible:focus-ring"
        role="region"
        tabIndex={0}
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Validated transactions for review</caption>
          <thead className="bg-raised">
            <tr>
              <th className="px-3 py-2" scope="col">Date</th>
              <th className="px-3 py-2" scope="col">Description</th>
              <th className="px-3 py-2" scope="col">Direction</th>
              <th className="px-3 py-2 text-right" scope="col">Amount</th>
              {showBalance && <th className="px-3 py-2 text-right" scope="col">Balance</th>}
              <th className="px-3 py-2" scope="col">Warning</th>
            </tr>
          </thead>
          <tbody>
            {review.rows.map((row) => (
              <tr className="hairline-b" key={row.sourceRowNumber}>
                <td className="px-3 py-2">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
                    .format(new Date(`${row.transactionDate}T00:00:00`))}
                </td>
                <td className="px-3 py-2">{row.description}</td>
                <td className="px-3 py-2">{row.direction}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrencyAmount(row.amount, currencyCode)}
                </td>
                {showBalance && (
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.balance == null ? '' : formatCurrencyAmount(row.balance, currencyCode)}
                  </td>
                )}
                <td className="px-3 py-2">
                  {row.isPossibleDuplicate
                    ? <StatusChip status="warning">Possible Duplicate</StatusChip>
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
