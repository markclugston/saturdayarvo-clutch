import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderTree, Menu, Wallet } from 'lucide-react'
import { useRef, useState, type PointerEvent } from 'react'
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
import { AppShell } from '@/components/ui/app-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ContentPanel } from '@/components/ui/content-panel'
import { ErrorMessage } from '@/components/ui/error-message'
import { SideNav, SideNavItem } from '@/components/ui/side-nav'
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
  const navigation = useNavigationExpansion()
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
      navigation.reset()
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
        <Card as="section" className="mx-auto mb-6 w-full max-w-md space-y-4">
          <ErrorMessage>Unable to load your session. Please try again.</ErrorMessage>
          <Button
            onClick={() => {
              sessionAttemptActive.current = false
              sessionAttemptStartedAt.current = performance.now()
              void sessionQuery.refetch()
            }}
            type="button"
            variant="secondary"
          >
            Try again
          </Button>
        </Card>
      </>
    )
  }

  return (
    <AppShell
      title="Clutch"
      navExpanded={navigation.expanded}
      nav={(
        <PrimaryNavigation
          navigation={navigation}
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
      )}
      header={(
        <header className="flex flex-wrap items-center justify-end gap-4 px-5 pb-2.5 pt-[18px] lg:pb-1.5">
          <div className="flex flex-wrap items-center gap-3">
            {sessionQuery.data.id && <ThemeSelector userId={sessionQuery.data.id} />}
            {sessionQuery.data.roles?.includes('Administrator') && (
              <Button
                onClick={() => setShowAdminSettings(true)}
                type="button"
                variant="secondary"
              >
                Import limits
              </Button>
            )}
            <Button
              disabled={signOutMutation.isPending}
              onClick={() => signOutMutation.mutate()}
              type="button"
              variant="secondary"
            >
              {signOutMutation.isPending ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </header>
      )}
    >
      {/* Keep keyboard focus visible while the pointer holds the overlay open below md. */}
      <ContentPanel className={cn(
        'ml-0 lg:ml-0',
        '[&_:is(button,input,select,textarea):not(.sr-only):focus-visible]:relative [&_:is(button,input,select,textarea):not(.sr-only):focus-visible]:z-20',
        '[&_:focus-visible:not(.sr-only)]:focus-ring',
      )}>
        {sessionQuery.isError && (
          <div className="mb-5 flex flex-wrap items-center gap-3" role="alert">
            Unable to refresh your session. Please try again.
            <Button
              onClick={() => void sessionQuery.refetch()}
              type="button"
              variant="secondary"
            >
              Retry session check
            </Button>
          </div>
        )}
        {signOutMutation.isError && (
          <ErrorMessage className="mb-5">Unable to sign out. Please try again.</ErrorMessage>
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
      </ContentPanel>
    </AppShell>
  )
}

type NavigationExpansion = ReturnType<typeof useNavigationExpansion>

/**
 * The navigation expands while a mouse hovers it. Clicking the hamburger pins it open until
 * the hamburger is clicked again; unpinning while the pointer is still over the navigation
 * collapses it until the pointer leaves and re-enters. Nothing is persisted.
 */
function useNavigationExpansion() {
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [hoverSuppressed, setHoverSuppressed] = useState(false)
  const expanded = pinned || (hovered && !hoverSuppressed)

  return {
    expanded,
    toggle: () => {
      if (pinned) {
        setPinned(false)
        setHoverSuppressed(true)
      } else {
        setPinned(true)
      }
    },
    reset: () => {
      setPinned(false)
      setHovered(false)
      setHoverSuppressed(false)
    },
    handlers: {
      onPointerEnter: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === 'mouse') setHovered(true)
      },
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === 'mouse') {
          setHovered(false)
          setHoverSuppressed(false)
        }
      },
    },
  }
}

type PrimaryNavigationProps = {
  navigation: NavigationExpansion
  accountsCurrent: boolean
  categoriesCurrent: boolean
  onAccounts: () => void
  onCategories: () => void
}

function PrimaryNavigation({
  navigation: { expanded, toggle, handlers },
  accountsCurrent,
  categoriesCurrent,
  onAccounts,
  onCategories,
}: PrimaryNavigationProps) {
  return (
    <SideNav expanded={expanded} {...handlers}>
      <Button
        aria-expanded={expanded}
        aria-label="Toggle navigation"
        className="text-fg"
        onClick={toggle}
        size="icon"
        type="button"
        variant="tertiary"
      >
        <Menu aria-hidden="true" className="size-5" />
      </Button>
      <SideNavItem
        current={accountsCurrent}
        expanded={expanded}
        icon={Wallet}
        label="Accounts"
        onClick={onAccounts}
      />
      <SideNavItem
        current={categoriesCurrent}
        expanded={expanded}
        icon={FolderTree}
        label="Categories"
        onClick={onCategories}
      />
    </SideNav>
  )
}

function isTransientSessionError(error: unknown): boolean {
  return error instanceof TypeError
    || error instanceof DOMException && error.name === 'TimeoutError'
    || error instanceof ApiError && [502, 503, 504].includes(error.status)
}
