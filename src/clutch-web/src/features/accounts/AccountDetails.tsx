import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorMessage } from '@/components/ui/error-message'
import { FloatingField } from '@/components/ui/floating-field'
import { PageHeading } from '@/components/ui/page-heading'
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
    return <p className="text-fg-secondary" role="status">Loading account…</p>
  }

  if (accountQuery.isError) {
    return <ErrorMessage>{getErrorMessage(accountQuery.error)}</ErrorMessage>
  }

  if (currenciesQuery.isError) {
    return <ErrorMessage>{getErrorMessage(currenciesQuery.error)}</ErrorMessage>
  }

  const account = accountQuery.data
  const currency = currenciesQuery.data.find(
    (supportedCurrency) => supportedCurrency.code === account.currencyCode,
  )
  if (!currency) {
    return <ErrorMessage>This account has a currency that is not supported.</ErrorMessage>
  }

  const displayedDescription = description ?? account.description

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateMutation.mutate(displayedDescription)
  }

  return (
    <section aria-labelledby="account-details-heading" className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button onClick={onBack} type="button" variant="secondary">
          Back to Accounts
        </Button>
        <Button onClick={onImport} type="button" variant="secondary">
          Import Transactions
        </Button>
      </div>
      <div>
        <PageHeading id="account-details-heading">
          Account Details
        </PageHeading>
        <p className="mt-2 text-fg-secondary">
          Currency: {currency.name} ({account.currencyCode})
        </p>
        <p className="mt-1 text-fg-secondary">
          Last successful import:{' '}
          {account.lastSuccessfulImportAtUtc
            ? new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(account.lastSuccessfulImportAtUtc))
            : 'No successful imports'}
        </p>
      </div>
      <Card as="form" className="space-y-4" onSubmit={submit}>
        <FloatingField
          id="edit-account-description"
          label="Account Description"
          maxLength={200}
          onChange={(event) => setDescription(event.currentTarget.value)}
          required
          value={displayedDescription}
        />
        <Button
          disabled={updateMutation.isPending || displayedDescription === account.description}
          type="submit"
        >
          {updateMutation.isPending ? 'Saving…' : 'Save Description'}
        </Button>
        {updateMutation.isError && <ErrorMessage>{getErrorMessage(updateMutation.error)}</ErrorMessage>}
      </Card>
      <TransactionsTable accountId={accountId} currencyCode={account.currencyCode} />
    </section>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
