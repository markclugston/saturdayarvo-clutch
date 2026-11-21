import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { ApiError } from '@/lib/api/client'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { DeleteTransactionDialog } from './DeleteTransactionDialog'
import { useTransactions } from './useTransactions'

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

  if (transactionsQuery.isPending) {
    return <p className="text-fg-secondary" role="status">Loading transactions…</p>
  }

  if (transactionsQuery.isError && !transactionsQuery.isFetchNextPageError) {
    return <ErrorMessage>{getErrorMessage(transactionsQuery.error)}</ErrorMessage>
  }

  const transactions = transactionsQuery.data.pages.flatMap((page) => page.items)
  const showBalance = transactions.some((transaction) => transaction.balance != null)
  if (transactions.length === 0) {
    return (
      <Card aria-labelledby="transactions-heading" as="section" className="space-y-3">
        <CardTitle as="h2" id="transactions-heading">Transactions</CardTitle>
        <p>No transactions have been imported to this account.</p>
      </Card>
    )
  }

  return (
    <Card aria-labelledby="transactions-heading" as="section" className="min-w-0 space-y-3">
      <CardTitle as="h2" id="transactions-heading">Transactions</CardTitle>
      {pendingDelete && (
        <DeleteTransactionDialog
          accountId={accountId}
          onClose={() => setPendingDelete(null)}
          transaction={pendingDelete}
        />
      )}
      <div className="overflow-x-auto rounded-control">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Transactions for this account</caption>
          <thead className="bg-raised">
            <tr>
              <th className="px-3 py-2" scope="col">Date</th>
              <th className="px-3 py-2" scope="col">Description</th>
              <th className="px-3 py-2" scope="col">Direction</th>
              <th className="px-3 py-2 text-right" scope="col">Amount</th>
              {showBalance && <th className="px-3 py-2 text-right" scope="col">Balance</th>}
              <th className="px-3 py-2 text-right" scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr className="hairline-b" key={transaction.id}>
                <td className="px-3 py-2">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
                    .format(new Date(`${transaction.transactionDate}T00:00:00`))}
                </td>
                <td className="px-3 py-2">{transaction.description}</td>
                <td className="px-3 py-2">{transaction.direction}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrencyAmount(transaction.amount, currencyCode)}
                </td>
                {showBalance && (
                  <td className="px-3 py-2 text-right tabular-nums">
                    {transaction.balance == null
                      ? ''
                      : formatCurrencyAmount(transaction.balance, currencyCode)}
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  <Button
                    aria-label="Delete transaction"
                    onClick={() => setPendingDelete({
                      id: transaction.id,
                      description: transaction.description,
                    })}
                    size="icon"
                    type="button"
                    variant="tertiary"
                  >
                    <Trash2 aria-hidden="true" className="size-4 text-danger" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
    </Card>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
