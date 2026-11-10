import { ApiError } from '@/lib/api/client'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
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

  if (transactionsQuery.isPending) {
    return <p role="status">Loading transactions…</p>
  }

  if (transactionsQuery.isError && !transactionsQuery.isFetchNextPageError) {
    return <p role="alert">{getErrorMessage(transactionsQuery.error)}</p>
  }

  const transactions = transactionsQuery.data.pages.flatMap((page) => page.items)
  const showBalance = transactions.some((transaction) => transaction.balance != null)
  if (transactions.length === 0) {
    return (
      <section aria-labelledby="transactions-heading" className="space-y-3">
        <h2 id="transactions-heading" className="text-lg font-semibold">Transactions</h2>
        <p>No transactions have been imported to this account.</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="transactions-heading" className="space-y-3">
      <h2 id="transactions-heading" className="text-lg font-semibold">Transactions</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Transactions for this account</caption>
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2" scope="col">Date</th>
              <th className="px-3 py-2" scope="col">Description</th>
              <th className="px-3 py-2" scope="col">Direction</th>
              <th className="px-3 py-2 text-right" scope="col">Amount</th>
              {showBalance && <th className="px-3 py-2 text-right" scope="col">Balance</th>}
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr className="border-t border-border" key={transaction.id}>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {transactionsQuery.hasNextPage && (
        <button
          className="rounded-md border border-border px-4 py-2 disabled:opacity-50"
          disabled={transactionsQuery.isFetchingNextPage}
          onClick={() => void transactionsQuery.fetchNextPage()}
          type="button"
        >
          {transactionsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
      {transactionsQuery.isFetchNextPageError && (
        <p role="alert">Unable to load more transactions. Please try again.</p>
      )}
    </section>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
