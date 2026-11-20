import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
import { PageHeading } from '@/components/ui/page-heading'
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
    return <p className="text-fg-secondary" role="status">Loading accounts…</p>
  }

  if (accountsQuery.isError) {
    return <ErrorMessage>{getErrorMessage(accountsQuery.error)}</ErrorMessage>
  }

  if (currenciesQuery.isError) {
    return <ErrorMessage>{getErrorMessage(currenciesQuery.error)}</ErrorMessage>
  }

  const accountRows = accountsQuery.data.flatMap((account) => {
    const currency = currenciesQuery.data.find(
      (supportedCurrency) => supportedCurrency.code === account.currencyCode,
    )
    return currency ? [{ account, currency }] : []
  })

  if (accountRows.length !== accountsQuery.data.length) {
    return <ErrorMessage>An account has a currency that is not supported.</ErrorMessage>
  }

  return (
    <section aria-labelledby="accounts-heading" className="space-y-4">
      <div>
        <PageHeading id="accounts-heading">
          Your accounts
        </PageHeading>
        <p className="mt-2 text-fg-secondary">Each account keeps its own currency and transactions.</p>
      </div>

      <Card>
        <ul className="grid gap-3 sm:grid-cols-2">
          {accountRows.map(({ account, currency }) => (
            <li className="min-w-0" key={account.id}>
              <button
                className="w-full cursor-pointer rounded-control bg-raised p-4 text-left transition-colors hover:bg-hover focus-visible:focus-ring"
                onClick={() => onSelectAccount(account.id)}
                type="button"
              >
                <span className="block break-words font-medium">{account.description}</span>
                <span className="mt-1 block break-words text-sm text-fg-secondary">
                  {currency.name} ({account.currencyCode})
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card as="form" className="max-w-xl space-y-4" onSubmit={submit}>
        <CardTitle as="h2">Add an account</CardTitle>
        <FloatingField
          autoComplete="off"
          id="account-description"
          label="Account description"
          maxLength={200}
          onChange={(event) => setDescription(event.currentTarget.value)}
          required
          value={description}
        />
        <FloatingField
          as="select"
          id="account-currency"
          label="Currency"
          onChange={(event) => setCurrencyCode(event.currentTarget.value)}
          required
          value={currencyCode}
        >
          <option value="">Select a currency</option>
          {currenciesQuery.data.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.name} ({currency.code})
            </option>
          ))}
        </FloatingField>
        <Button disabled={createMutation.isPending} type="submit">
          {createMutation.isPending ? 'Saving…' : 'Add account'}
        </Button>
        {createMutation.isError && <ErrorMessage>{getErrorMessage(createMutation.error)}</ErrorMessage>}
      </Card>
    </section>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
