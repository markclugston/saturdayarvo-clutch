import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeading } from '@/components/ui/page-heading'
import { ApiError } from '@/lib/api/client'
import { createFamily, getFamilies } from './api'

type FamilyPageProps = {
  onReady: () => void
}

export function FamilyPage({ onReady }: FamilyPageProps) {
  const queryClient = useQueryClient()
  const familiesQuery = useQuery({
    queryKey: ['families'],
    queryFn: getFamilies,
  })
  const createMutation = useMutation({
    mutationFn: createFamily,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['families'] })
      onReady()
    },
  })

  if (familiesQuery.isPending) {
    return <p role="status">Loading your Family…</p>
  }

  if (familiesQuery.isError) {
    return <p role="alert">{getErrorMessage(familiesQuery.error)}</p>
  }

  if (familiesQuery.data.length > 0) {
    return (
      <section aria-labelledby="family-heading" className="space-y-4">
        <PageHeading id="family-heading" className="text-2xl font-semibold">Your Family</PageHeading>
        <p>Your accounts are private to you.</p>
        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
          onClick={onReady}
          type="button"
        >
          View accounts
        </button>
      </section>
    )
  }

  return (
    <section aria-labelledby="family-heading" className="space-y-4">
      <PageHeading id="family-heading" className="text-2xl font-semibold">
        Create your Family
      </PageHeading>
      <p>Your Family holds your accounts. Only you can access them.</p>
      <button
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        disabled={createMutation.isPending}
        onClick={() => createMutation.mutate()}
        type="button"
      >
        {createMutation.isPending ? 'Creating…' : 'Create Family'}
      </button>
      {createMutation.isError && <p role="alert">{getErrorMessage(createMutation.error)}</p>}
    </section>
  )
}

function getErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
