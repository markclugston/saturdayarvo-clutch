import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '@/lib/api/client'
import { createAccount, getAccounts, getCurrencies } from './api'

type AccountsPageProps = {
  onSelectAccount: (accountId: string) => void
}

export function AccountsPage({ onSelectAccount }: AccountsPageProps) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState('')
  const [currencyCode, setCurrencyCode] = useState('')
  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  })
  const currenciesQuery = useQuery({
    queryKey: ['currencies'],
    queryFn: getCurrencies,
  })
  const createMutation = useMutation({
    mutationFn: () => createAccount(description, currencyCode),
    onError: (error) => {
      if (error instanceof ApiError && error.problem.errors?.description) {
        setDescription('')
      }
    },
    onSuccess: async (account) => {
      setDescription('')
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
      onSelectAccount(account.id)
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    createMutation.mutate()
  }

  if (accountsQuery.isPending || currenciesQuery.isPending) {
    return <p role="status">Loading accounts…</p>
  }

  if (accountsQuery.isError) {
    return <p role="alert">{getErrorMessage(accountsQuery.error)}</p>
  }

  if (currenciesQuery.isError) {
    return <p role="alert">{getErrorMessage(currenciesQuery.error)}</p>
  }

  const accountRows = accountsQuery.data.flatMap((account) => {
    const currency = currenciesQuery.data.find(
      (supportedCurrency) => supportedCurrency.code === account.currencyCode,
    )
    return currency ? [{ account, currency }] : []
  })

  if (accountRows.length !== accountsQuery.data.length) {
    return <p role="alert">An account has a currency that is not supported.</p>
  }

  return (
    <section aria-labelledby="accounts-heading" className="space-y-8">
      <div>
        <h1 id="accounts-heading" className="text-2xl font-semibold">Your accounts</h1>
        <p className="mt-2 text-muted-foreground">Each account keeps its own currency and transactions.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {accountRows.map(({ account, currency }) => (
          <li key={account.id}>
            <button
              className="w-full rounded-lg border border-border bg-card p-4 text-left hover:bg-muted"
              onClick={() => onSelectAccount(account.id)}
            >
              <span className="block font-medium">{account.description}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {currency.name} ({account.currencyCode})
              </span>
            </button>
          </li>
        ))}
      </ul>

      <form className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={submit}>
        <h2 className="text-lg font-semibold">Add an account</h2>
        <div className="space-y-2">
          <label htmlFor="account-description" className="block text-sm font-medium">Account description</label>
          <input
            id="account-description"
            autoComplete="off"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            maxLength={200}
            required
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="account-currency" className="block text-sm font-medium">Currency</label>
          <select
            id="account-currency"
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            required
            value={currencyCode}
            onChange={(event) => setCurrencyCode(event.currentTarget.value)}
          >
            <option value="">Select a currency</option>
            {currenciesQuery.data.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.name} ({currency.code})
              </option>
            ))}
          </select>
        </div>
        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          disabled={createMutation.isPending}
          type="submit"
        >
          {createMutation.isPending ? 'Saving…' : 'Add account'}
        </button>
        {createMutation.isError && <p role="alert">{getErrorMessage(createMutation.error)}</p>}
      </form>
    </section>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
