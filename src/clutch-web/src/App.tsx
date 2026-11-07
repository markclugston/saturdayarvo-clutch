import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AccountDetails } from '@/features/accounts/AccountDetails'
import { AccountsPage } from '@/features/accounts/AccountsPage'
import { ImportLimitsPage } from '@/features/admin/ImportLimitsPage'
import { AuthPage } from '@/features/auth/AuthPage'
import { signOut, getSession } from '@/features/auth/api'
import { FamilyPage } from '@/features/families/FamilyPage'
import { ImportPage } from '@/features/imports/ImportPage'
import { ApiError } from '@/lib/api/client'

export default function App() {
  const queryClient = useQueryClient()
  const [showAccounts, setShowAccounts] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [showAdminSettings, setShowAdminSettings] = useState(false)
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: getSession,
    retry: (failureCount, error) =>
      failureCount < 5
      && (error instanceof TypeError
        || error instanceof ApiError && [502, 503, 504].includes(error.status)),
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2000),
  })
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      setSelectedAccountId(null)
      setShowAccounts(false)
      setIsImporting(false)
      setShowAdminSettings(false)
      await queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })

  if (sessionQuery.isPending || sessionQuery.isError && sessionQuery.isFetching) {
    return <main className="mx-auto max-w-4xl px-5 py-10"><p role="status">Loading…</p></main>
  }

  if (sessionQuery.isError) {
    if (sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401) {
      return <AuthPage />
    }

    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <p role="alert">Unable to load your session. Please try again.</p>
        <button
          className="mt-4 rounded-md border border-border px-4 py-2"
          onClick={() => void sessionQuery.refetch()}
          type="button"
        >
          Try again
        </button>
      </main>
    )
  }

  return (
    <div className="min-h-svh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <p className="font-semibold">SaturdayArvo Clutch</p>
          <div className="flex items-center gap-3">
            {sessionQuery.data.roles?.includes('Administrator') && (
              <button
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                onClick={() => setShowAdminSettings(true)}
              >
                Import limits
              </button>
            )}
            <button
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              disabled={signOutMutation.isPending}
              onClick={() => signOutMutation.mutate()}
            >
              {signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">
        {signOutMutation.isError && (
          <p className="mb-5" role="alert">Unable to sign out. Please try again.</p>
        )}
        {showAdminSettings ? (
          <ImportLimitsPage onBack={() => setShowAdminSettings(false)} />
        ) : selectedAccountId ? (
            isImporting ? (
              <ImportPage
                accountId={selectedAccountId}
                onBack={() => setIsImporting(false)}
              />
            ) : (
              <AccountDetails
                accountId={selectedAccountId}
                onBack={() => setSelectedAccountId(null)}
                onImport={() => setIsImporting(true)}
              />
            )
        ) : showAccounts ? (
          <AccountsPage onSelectAccount={setSelectedAccountId} />
        ) : (
          <FamilyPage onReady={() => setShowAccounts(true)} />
        )}
      </main>
    </div>
  )
}
