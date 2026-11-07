import type { ImportReview } from '@/lib/api/schemas'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'

type ImportReviewTableProps = {
  review: ImportReview
  currencyCode: string
}

export function ImportReviewTable({ review, currencyCode }: ImportReviewTableProps) {
  return (
    <section aria-labelledby="import-review-heading" className="space-y-4">
      <div>
        <h2 id="import-review-heading" className="text-lg font-semibold">Review transactions</h2>
        <p>
          {review.rowCount} transactions will be imported into this account in {currencyCode}.
        </p>
      </div>
      {review.duplicateConfirmationRequired && (
        <p className="rounded-md border border-amber-500 p-3" role="status">
          Possible duplicates are highlighted. Confirming will import every valid row,
          including these possible duplicates.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Validated transactions for review</caption>
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2" scope="col">Row</th>
              <th className="px-3 py-2" scope="col">Date</th>
              <th className="px-3 py-2" scope="col">Description</th>
              <th className="px-3 py-2" scope="col">Amount</th>
              <th className="px-3 py-2" scope="col">Direction</th>
              <th className="px-3 py-2" scope="col">Warning</th>
            </tr>
          </thead>
          <tbody>
            {review.rows.map((row) => (
              <tr className="border-t border-border" key={row.sourceRowNumber}>
                <th className="px-3 py-2 font-normal" scope="row">{row.sourceRowNumber}</th>
                <td className="px-3 py-2">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
                    .format(new Date(`${row.transactionDate}T00:00:00`))}
                </td>
                <td className="px-3 py-2">{row.description}</td>
                <td className="px-3 py-2">
                  {formatCurrencyAmount(row.amount, currencyCode)}
                </td>
                <td className="px-3 py-2">{row.direction}</td>
                <td className="px-3 py-2">
                  {row.isPossibleDuplicate ? 'Possible duplicate' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
