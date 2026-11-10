import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { AccountDetails } from '@/features/accounts/AccountDetails'
import { AccountsPage } from '@/features/accounts/AccountsPage'
import { ImportLimitsPage } from '@/features/admin/ImportLimitsPage'
import { AuthPage } from '@/features/auth/AuthPage'
import { StartupLoadingDialog } from '@/features/auth/StartupLoadingDialog'
import { signOut, getSession } from '@/features/auth/api'
import { ImportPage } from '@/features/imports/ImportPage'
import { ApiError } from '@/lib/api/client'
import { ThemeSelector } from '@/components/theme/ThemeSelector'
import { useTheme } from '@/components/theme/ThemeProvider'

export default function App() {
  const queryClient = useQueryClient()
  const { setMode } = useTheme()
  const sessionAttemptActive = useRef(false)
  const sessionAttemptStartedAt = useRef(performance.now())
  const mainRef = useRef<HTMLElement>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [showAdminSettings, setShowAdminSettings] = useState(false)
  const sessionQuery = useQuery({
    queryKey: ['session'],
    queryFn: async ({ signal }) => {
      if (!sessionAttemptActive.current) {
        sessionAttemptStartedAt.current = performance.now()
        sessionAttemptActive.current = true
      }

      try {
        const session = await getSession(signal)
        sessionAttemptActive.current = false
        return session
      } catch (error) {
        if (signal.aborted) {
          sessionAttemptActive.current = false
        }
        throw error
      }
    },
    retry: (_failureCount, error) => {
      const shouldRetry =
        performance.now() - sessionAttemptStartedAt.current < 30_000
        && isTransientSessionError(error)
      if (!shouldRetry) {
        sessionAttemptActive.current = false
      }
      return shouldRetry
    },
    retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2000),
  })
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      setSelectedAccountId(null)
      setIsImporting(false)
      setShowAdminSettings(false)
      setMode('Light')
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'session',
      })
      await queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })

  useEffect(() => {
    mainRef.current?.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus()
  }, [isImporting, selectedAccountId, showAdminSettings])

  useEffect(() => {
    if (sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401) {
      document.getElementById('auth-heading')?.focus()
    }
  }, [sessionQuery.error])

  if (sessionQuery.isPending || sessionQuery.isFetching) {
    return (
      <>
        <AuthPage />
        <StartupLoadingDialog open />
      </>
    )
  }

  if (sessionQuery.isError) {
    if (sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401) {
      return <AuthPage />
    }

    return (
      <>
        <AuthPage />
        <section className="mx-auto max-w-4xl px-5 py-6">
          <p role="alert">Unable to load your session. Please try again.</p>
          <button
            className="mt-4 rounded-md border border-border px-4 py-2"
            onClick={() => {
              sessionAttemptActive.current = false
              sessionAttemptStartedAt.current = performance.now()
              void sessionQuery.refetch()
            }}
            type="button"
          >
            Try again
          </button>
        </section>
      </>
    )
  }

  return (
    <div className="min-h-svh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <p className="font-semibold">SaturdayArvo Clutch</p>
          <div className="flex flex-wrap items-center gap-3">
            {sessionQuery.data.id && <ThemeSelector userId={sessionQuery.data.id} />}
            {sessionQuery.data.roles?.includes('Administrator') && (
              <button
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
                onClick={() => setShowAdminSettings(true)}
                type="button"
              >
                Import limits
              </button>
            )}
            <button
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              disabled={signOutMutation.isPending}
              onClick={() => signOutMutation.mutate()}
              type="button"
            >
              {signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8" ref={mainRef}>
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
        ) : (
          <AccountsPage onSelectAccount={setSelectedAccountId} />
        )}
      </main>
    </div>
  )
}

function isTransientSessionError(error: unknown): boolean {
  return error instanceof TypeError
    || error instanceof DOMException && error.name === 'TimeoutError'
    || error instanceof ApiError && [502, 503, 504].includes(error.status)
}
