import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api/client'
import { getAccount, getCurrencies, updateAccountDescription } from './api'
import { TransactionsTable } from './TransactionsTable'

type AccountDetailsProps = {
  accountId: string
  onBack: () => void
  onImport: () => void
}

export function AccountDetails({ accountId, onBack, onImport }: AccountDetailsProps) {
  const queryClient = useQueryClient()
  const accountQuery = useQuery({
    queryKey: ['account', accountId],
    queryFn: () => getAccount(accountId),
  })
  const currenciesQuery = useQuery({
    queryKey: ['currencies'],
    queryFn: getCurrencies,
  })
  const [description, setDescription] = useState<string | null>(null)
  const updateMutation = useMutation({
    mutationFn: (updatedDescription: string) =>
      updateAccountDescription(accountId, updatedDescription),
    onError: (error) => {
      if (error instanceof ApiError && error.problem.errors?.description) {
        setDescription(null)
      }
    },
    onSuccess: async () => {
      setDescription(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['account', accountId] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      ])
    },
  })

  if (accountQuery.isPending || currenciesQuery.isPending) {
    return <p role="status">Loading account…</p>
  }

  if (accountQuery.isError) {
    return <p role="alert">{getErrorMessage(accountQuery.error)}</p>
  }

  if (currenciesQuery.isError) {
    return <p role="alert">{getErrorMessage(currenciesQuery.error)}</p>
  }

  const account = accountQuery.data
  const currency = currenciesQuery.data.find(
    (supportedCurrency) => supportedCurrency.code === account.currencyCode,
  )
  if (!currency) {
    return <p role="alert">This account has a currency that is not supported.</p>
  }

  const displayedDescription = description ?? account.description

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateMutation.mutate(displayedDescription)
  }

  return (
    <section aria-labelledby="account-details-heading" className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <button className="text-sm underline underline-offset-4" onClick={onBack}>
          Back to accounts
        </button>
        <button className="text-sm underline underline-offset-4" onClick={onImport}>
          Import transactions
        </button>
      </div>
      <div>
        <h1 id="account-details-heading" className="text-2xl font-semibold">Account details</h1>
        <p className="mt-2 text-muted-foreground">
          Currency: {currency.name} ({account.currencyCode})
        </p>
        <p className="mt-1 text-muted-foreground">
          Last successful import:{' '}
          {account.lastSuccessfulImportAtUtc
            ? new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(account.lastSuccessfulImportAtUtc))
            : 'No successful imports'}
        </p>
      </div>
      <form className="space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={submit}>
        <div className="space-y-2">
          <label htmlFor="edit-account-description" className="block text-sm font-medium">
            Account description
          </label>
          <input
            id="edit-account-description"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            maxLength={200}
            required
            value={displayedDescription}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </div>
        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          disabled={updateMutation.isPending || displayedDescription === account.description}
          type="submit"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save description'}
        </button>
        {updateMutation.isError && <p role="alert">{getErrorMessage(updateMutation.error)}</p>}
      </form>
      <TransactionsTable accountId={accountId} currencyCode={account.currencyCode} />
    </section>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
