import { CardTitle } from '@/components/ui/card'
import {
  ListBody, ListCard, ListCell, ListHead, ListHeaderCell, ListRow, ListTable,
} from '@/components/ui/list'
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
    <ListCard
      aria-labelledby="import-review-heading"
      as="section"
      className="space-y-4"
      label="Validated transactions"
      title={(
        <>
          <div>
            <CardTitle as="h2" id="import-review-heading">Review Transactions</CardTitle>
            <p>
              {review.importRowCount} transactions will be imported into this account in {currencyCode}.
            </p>
          </div>
          {review.duplicateConfirmationRequired && (
            <p className="rounded-control bg-warning-bg p-3 text-warning" role="status">
              Possible duplicates are highlighted. Confirming will import these possible duplicates.
            </p>
          )}
        </>
      )}
    >
      <ListTable caption="Validated transactions for review">
        <ListHead>
          <tr>
            <ListHeaderCell>Date</ListHeaderCell>
            <ListHeaderCell>Description</ListHeaderCell>
            <ListHeaderCell>Direction</ListHeaderCell>
            <ListHeaderCell numeric>Amount</ListHeaderCell>
            {showBalance && <ListHeaderCell numeric>Balance</ListHeaderCell>}
            <ListHeaderCell>Warning</ListHeaderCell>
          </tr>
        </ListHead>
        <ListBody>
          {review.rows.map((row) => (
            <ListRow key={row.sourceRowNumber}>
              <ListCell className="whitespace-nowrap">
                {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
                  .format(new Date(`${row.transactionDate}T00:00:00`))}
              </ListCell>
              <ListCell>
                <span className="block max-w-72 truncate text-fg-secondary" title={row.description}>
                  {row.description}
                </span>
              </ListCell>
              <ListCell>{row.direction}</ListCell>
              <ListCell numeric>
                {formatCurrencyAmount(row.amount, currencyCode)}
              </ListCell>
              {showBalance && (
                <ListCell numeric>
                  {row.balance == null ? '' : formatCurrencyAmount(row.balance, currencyCode)}
                </ListCell>
              )}
              <ListCell className="whitespace-nowrap">
                {row.isPossibleDuplicate && <StatusChip status="warning">Possible Duplicate</StatusChip>}
                {row.isExcluded && <StatusChip status="warning">Will Not Be Imported</StatusChip>}
              </ListCell>
            </ListRow>
          ))}
        </ListBody>
      </ListTable>
    </ListCard>
  )
}
