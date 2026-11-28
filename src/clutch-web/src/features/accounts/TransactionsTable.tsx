import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CardTitle } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import {
  DeleteButton, ListActionsCell, ListActionsHeader, ListBody, ListCard, ListCell, ListEmpty, ListHead,
  ListHeaderCell, ListLoadError, ListLoading, ListRow, ListTable,
} from '@/components/ui/list'
import { ApiError } from '@/lib/api/client'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { DeleteTransactionDialog } from './DeleteTransactionDialog'
import { useTransactions } from './useTransactions'

export const EMPTY_MESSAGE = 'No transactions yet. Import transactions to see them here.'

type TransactionsTableProps = {
  accountId: string
  currencyCode: string
}

export function TransactionsTable({
  accountId,
  currencyCode,
}: TransactionsTableProps) {
  const transactionsQuery = useTransactions(accountId)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; description: string } | null>(null)
  const title = <CardTitle as="h2" id="transactions-heading">Transactions</CardTitle>

  function content() {
    if (transactionsQuery.isPending) {
      return <ListLoading>Loading transactions…</ListLoading>
    }

    if (transactionsQuery.isError && !transactionsQuery.isFetchNextPageError) {
      return (
        <ListLoadError onRetry={() => void transactionsQuery.refetch()}>
          {getErrorMessage(transactionsQuery.error)}
        </ListLoadError>
      )
    }

    const transactions = transactionsQuery.data.pages.flatMap((page) => page.items)
    const showBalance = transactions.some((transaction) => transaction.balance != null)
    if (transactions.length === 0) {
      return (
        <ListEmpty aria-labelledby="transactions-heading" as="section" title={title}>
          {EMPTY_MESSAGE}
        </ListEmpty>
      )
    }

    // Anything after the rows is reached at the end of the list, so it scrolls inside the region.
    const hasListEnd = transactionsQuery.hasNextPage || transactionsQuery.isFetchNextPageError

    return (
      <ListCard
        aria-labelledby="transactions-heading"
        as="section"
        end={hasListEnd
          ? (
            <>
              {transactionsQuery.hasNextPage && (
                <Button
                  disabled={transactionsQuery.isFetchingNextPage}
                  onClick={() => void transactionsQuery.fetchNextPage()}
                  type="button"
                  variant="secondary"
                >
                  {transactionsQuery.isFetchingNextPage ? 'Loading…' : 'Load More'}
                </Button>
              )}
              {transactionsQuery.isFetchNextPageError && (
                <ErrorMessage>Unable to load more transactions. Please try again.</ErrorMessage>
              )}
            </>
          )
          : null}
        label="Transactions"
        title={title}
      >
        <ListTable caption="Transactions for this account">
          <ListHead>
            <tr>
              <ListHeaderCell>Date</ListHeaderCell>
              <ListHeaderCell>Description</ListHeaderCell>
              <ListHeaderCell>Direction</ListHeaderCell>
              <ListHeaderCell numeric>Amount</ListHeaderCell>
              {showBalance && <ListHeaderCell numeric>Balance</ListHeaderCell>}
              <ListActionsHeader />
            </tr>
          </ListHead>
          <ListBody>
            {transactions.map((transaction) => {
              const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
                .format(new Date(`${transaction.transactionDate}T00:00:00`))
              return (
                <ListRow key={transaction.id}>
                  <ListCell className="whitespace-nowrap">{date}</ListCell>
                  <ListCell>
                    <span className="block max-w-72 truncate text-fg-secondary" title={transaction.description}>
                      {transaction.description}
                    </span>
                  </ListCell>
                  <ListCell>{transaction.direction}</ListCell>
                  <ListCell numeric>
                    {formatCurrencyAmount(transaction.amount, currencyCode)}
                  </ListCell>
                  {showBalance && (
                    <ListCell numeric>
                      {transaction.balance == null
                        ? ''
                        : formatCurrencyAmount(transaction.balance, currencyCode)}
                    </ListCell>
                  )}
                  <ListActionsCell>
                    <DeleteButton
                      label={`Delete ${transaction.description}, ${date}`}
                      onClick={() => setPendingDelete({
                        id: transaction.id,
                        description: transaction.description,
                      })}
                    />
                  </ListActionsCell>
                </ListRow>
              )
            })}
          </ListBody>
        </ListTable>
      </ListCard>
    )
  }

  return (
    <>
      {content()}
      {/* Outside the list, so it outlives a list that its own deletion empties. */}
      {pendingDelete && (
        <DeleteTransactionDialog
          accountId={accountId}
          onClose={() => setPendingDelete(null)}
          transaction={pendingDelete}
        />
      )}
    </>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
