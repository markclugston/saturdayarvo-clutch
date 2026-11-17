import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderTree, Wallet } from 'lucide-react'
import { useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { AccountDetails } from '@/features/accounts/AccountDetails'
import { AccountsPage } from '@/features/accounts/AccountsPage'
import { ImportLimitsPage } from '@/features/admin/ImportLimitsPage'
import { AuthPage } from '@/features/auth/AuthPage'
import { StartupLoadingDialog } from '@/features/auth/StartupLoadingDialog'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { signOut, getSession } from '@/features/auth/api'
import { ImportPage } from '@/features/imports/ImportPage'
import { ApiError } from '@/lib/api/client'
import { ThemeSelector } from '@/components/theme/ThemeSelector'
import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'

export default function App() {
  const queryClient = useQueryClient()
  const { setMode } = useTheme()
  const sessionAttemptActive = useRef(false)
  const sessionAttemptStartedAt = useRef(performance.now())
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [showAdminSettings, setShowAdminSettings] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
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
      setShowCategories(false)
      setMode('Light')
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'session',
      })
      await queryClient.resetQueries({ queryKey: ['session'], exact: true })
    },
  })

  if (sessionQuery.isPending || (sessionQuery.isFetching && !sessionQuery.data)) {
    return (
      <>
        <AuthPage inert />
        <StartupLoadingDialog open />
      </>
    )
  }

  if (sessionQuery.isError && (!sessionQuery.data
    || sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401)) {
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
    <SignedInShell>
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
      <div className="flex min-w-0">
        <PrimaryNavigation
          accountsCurrent={!showCategories && !showAdminSettings}
          categoriesCurrent={showCategories && !showAdminSettings}
          onAccounts={() => {
            setShowCategories(false)
            setShowAdminSettings(false)
            setSelectedAccountId(null)
            setIsImporting(false)
          }}
          onCategories={() => {
            setShowCategories(true)
            setShowAdminSettings(false)
          }}
        />
      {/* Keep keyboard focus visible while the pointer holds the overlay open. */}
      <main className={cn(
        'mx-auto min-w-0 w-full max-w-5xl px-5 py-8',
        '[&_:is(button,input,select,textarea):not(.sr-only):focus-visible]:relative [&_:is(button,input,select,textarea):not(.sr-only):focus-visible]:z-20',
        '[&_:focus-visible:not(.sr-only)]:outline-2 [&_:focus-visible:not(.sr-only)]:outline-offset-2 [&_:focus-visible:not(.sr-only)]:outline-primary',
      )}>
        {sessionQuery.isError && (
          <div className="mb-5" role="alert">
            Unable to refresh your session. Please try again.
            <button
              className="ml-3 rounded-md border border-border px-3 py-1"
              onClick={() => void sessionQuery.refetch()}
              type="button"
            >
              Retry session check
            </button>
          </div>
        )}
        {signOutMutation.isError && (
          <p className="mb-5" role="alert">Unable to sign out. Please try again.</p>
        )}
        {showAdminSettings ? (
          <ImportLimitsPage onBack={() => setShowAdminSettings(false)} />
        ) : showCategories ? (
          <CategoriesPage />
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
    </SignedInShell>
  )
}

function SignedInShell({ children }: PropsWithChildren) {
  return <div className="min-h-svh">{children}</div>
}

type PrimaryNavigationProps = {
  accountsCurrent: boolean
  categoriesCurrent: boolean
  onAccounts: () => void
  onCategories: () => void
}

function PrimaryNavigation({
  accountsCurrent,
  categoriesCurrent,
  onAccounts,
  onCategories,
}: PrimaryNavigationProps) {
  const [hovered, setHovered] = useState(false)
  const [keyboardFocused, setKeyboardFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const pointerFocus = useRef(false)
  const expanded = (hovered || keyboardFocused) && !dismissed
  const buttonClass = 'flex w-full cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground'

  useEffect(() => {
    if (!expanded) return

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) setDismissed(true)
    }
    window.addEventListener('keydown', dismissOnEscape)
    return () => window.removeEventListener('keydown', dismissOnEscape)
  }, [expanded])

  return (
    <div className="relative w-14 shrink-0">
      <nav
        aria-label="Primary"
        className={cn(
          'absolute inset-y-0 left-0 z-10 flex flex-col gap-2 border-r border-border bg-background p-2',
          expanded ? 'w-36' : 'w-14',
        )}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') {
            setHovered(true)
            setDismissed(false)
          }
        }}
        onPointerLeave={(event) => {
          pointerFocus.current = false
          if (event.pointerType === 'mouse') setHovered(false)
        }}
        onPointerDownCapture={() => {
          pointerFocus.current = true
          setKeyboardFocused(false)
        }}
        onPointerUpCapture={() => { pointerFocus.current = false }}
        onPointerCancelCapture={() => { pointerFocus.current = false }}
        onFocusCapture={() => {
          if (!pointerFocus.current) {
            setKeyboardFocused(true)
            setDismissed(false)
          }
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocused(false)
        }}
      >
      <button
        aria-current={accountsCurrent ? 'page' : undefined}
        aria-label="Accounts"
        className={buttonClass}
        onClick={onAccounts}
        type="button"
      >
        <Wallet aria-hidden="true" className="size-4 shrink-0" />
        <span hidden={!expanded}>Accounts</span>
      </button>
      <button
        aria-current={categoriesCurrent ? 'page' : undefined}
        aria-label="Categories"
        className={buttonClass}
        onClick={onCategories}
        type="button"
      >
        <FolderTree aria-hidden="true" className="size-4 shrink-0" />
        <span hidden={!expanded}>Categories</span>
      </button>
      </nav>
    </div>
  )
}

function isTransientSessionError(error: unknown): boolean {
  return error instanceof TypeError
    || error instanceof DOMException && error.name === 'TimeoutError'
    || error instanceof ApiError && [502, 503, 504].includes(error.status)
}
