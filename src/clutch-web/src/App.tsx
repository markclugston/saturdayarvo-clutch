import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderTree, Gem, Landmark, Menu, Wallet } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useNavigationPreference, useSaveNavigationPreference } from '@/features/preferences/api'
import { AccountDetails } from '@/features/accounts/AccountDetails'
import { AccountsPage } from '@/features/accounts/AccountsPage'
import { ImportLimitsPage } from '@/features/admin/ImportLimitsPage'
import { AssetPage } from '@/features/assets/AssetPage'
import { AssetsPage } from '@/features/assets/AssetsPage'
import { assetPath, parseAssetRoute, pushPath, type AssetRoute } from '@/features/assets/assetRoute'
import { AuthPage } from '@/features/auth/AuthPage'
import { StartupLoadingDialog } from '@/features/auth/StartupLoadingDialog'
import { AddCategoryForm } from '@/features/categories/AddCategoryForm'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { signOut, getSession } from '@/features/auth/api'
import { ImportPage } from '@/features/imports/ImportPage'
import { MortgagesPage } from '@/features/mortgages/MortgagesPage'
import { ApiError } from '@/lib/api/client'
import { AppErrorBoundary, PageErrorBoundary } from '@/components/error-boundary/PageErrorBoundary'
import { ThemeSelector } from '@/components/theme/ThemeSelector'
import { useTheme } from '@/components/theme/ThemeProvider'
import { AppShell } from '@/components/ui/app-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ContentPanel } from '@/components/ui/content-panel'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { UnsavedChangesProvider, useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { ErrorMessage } from '@/components/ui/error-message'
import { SideNav, SideNavItem } from '@/components/ui/side-nav'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'

export default function App() {
  return (
    <AppErrorBoundary>
      <UnsavedChangesProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </UnsavedChangesProvider>
    </AppErrorBoundary>
  )
}

function AppContent() {
  const queryClient = useQueryClient()
  const { isDirty, run } = useUnsavedChanges()
  const { setMode } = useTheme()
  const sessionAttemptActive = useRef(false)
  const sessionAttemptStartedAt = useRef(performance.now())
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [showAdminSettings, setShowAdminSettings] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showMortgages, setShowMortgages] = useState(false)
  // Null outside Assets. Only the Assets pages have URLs of their own.
  const [assetRoute, setAssetRoute] = useState<AssetRoute | null>(
    () => parseAssetRoute(window.location.pathname),
  )
  const shownPath = useRef(window.location.pathname)
  useEffect(() => {
    shownPath.current = assetRoute ? assetPath(assetRoute) : '/'
  }, [assetRoute])

  function openAssets(route: AssetRoute) {
    setShowCategories(false)
    setShowMortgages(false)
    setShowAdminSettings(false)
    setSelectedAccountId(null)
    setIsImporting(false)
    pushPath(assetPath(route))
    setAssetRoute(route)
  }

  /** Every other destination is plain state at the root URL. */
  function leaveAssets() {
    if (assetRoute) {
      pushPath('/')
      setAssetRoute(null)
    }
  }

  // Back and Forward. While there are unsaved edits the shown URL is restored, and the change is
  // followed only if the user discards them.
  useEffect(() => {
    const follow = () => {
      const target = window.location.pathname
      let followed = false
      run(() => {
        followed = true
        pushPath(target)
        const route = parseAssetRoute(target)
        if (route) {
          setShowCategories(false)
          setShowMortgages(false)
          setShowAdminSettings(false)
          setSelectedAccountId(null)
          setIsImporting(false)
        }
        setAssetRoute(route)
      })
      if (!followed) {
        pushPath(shownPath.current)
      }
    }
    window.addEventListener('popstate', follow)
    return () => window.removeEventListener('popstate', follow)
  }, [run])

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
    // While there are unsaved edits an expired sign-in must be found by a mortgage request (and its
    // session-expired dialog), not by this query replacing the page with the sign-in screen.
    refetchOnWindowFocus: !isDirty,
    refetchOnReconnect: !isDirty,
  })
  const userId = sessionQuery.data?.id
  const navigationPreference = useNavigationPreference(userId)
  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      setSelectedAccountId(null)
      setIsImporting(false)
      setShowAdminSettings(false)
      setShowCategories(false)
      setShowMortgages(false)
      pushPath('/')
      setAssetRoute(null)
      setMode('Light')
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== 'session',
      })
      await queryClient.resetQueries({ queryKey: ['session'], exact: true })
    },
  })

  // A persistent notice can name an asset, so it never outlives the sign-in it belongs to.
  const { clearPersistent } = useToast()
  const signedOut = !userId
    || (sessionQuery.error instanceof ApiError && sessionQuery.error.status === 401)
  useEffect(() => {
    if (signedOut) {
      clearPersistent()
    }
  }, [signedOut, clearPersistent])

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
            Try Again
          </Button>
        </Card>
      </>
    )
  }

  // Hold the startup dialog until the saved navigation state has loaded (or failed / timed out
  // after 2 s), so the shell renders once in its final state with no compact-to-pinned jump.
  if (userId && navigationPreference.isPending) {
    return (
      <>
        <AuthPage inert />
        <StartupLoadingDialog open />
      </>
    )
  }

  // Identifies the page on show, so choosing another destination clears a page's error.
  const pageKey = showAdminSettings ? 'admin'
    : assetRoute ? assetPath(assetRoute)
      : showMortgages ? 'mortgages'
        : showCategories ? 'categories'
          : selectedAccountId ? `${isImporting ? 'import' : 'account'}:${selectedAccountId}`
            : 'accounts'
  const showAssets = assetRoute !== null && !showAdminSettings

  return (
    <SignedInShell
      key={userId ?? 'anonymous'}
      userId={userId}
      initialPinned={navigationPreference.data?.state === 'Pinned'}
      accountsCurrent={!showAssets && !showCategories && !showMortgages && !showAdminSettings}
      assetsCurrent={showAssets}
      categoriesCurrent={showCategories && !showMortgages && !showAdminSettings}
      mortgagesCurrent={showMortgages && !showAdminSettings}
      onAccounts={() => run(() => {
        leaveAssets()
        setShowCategories(false)
        setShowMortgages(false)
        setShowAdminSettings(false)
        setSelectedAccountId(null)
        setIsImporting(false)
      })}
      onAssets={() => run(() => openAssets({ page: 'list' }))}
      onCategories={() => run(() => {
        leaveAssets()
        setShowCategories(true)
        setShowMortgages(false)
        setShowAdminSettings(false)
      })}
      onMortgages={() => run(() => {
        leaveAssets()
        setShowMortgages(true)
        setShowCategories(false)
        setShowAdminSettings(false)
      })}
      header={(
        <header className="flex flex-wrap items-center justify-end gap-4 px-5 pb-2.5 pt-[18px] lg:pb-1.5">
          <div className="flex flex-wrap items-center gap-3">
            {sessionQuery.data.id && <ThemeSelector userId={sessionQuery.data.id} />}
            {sessionQuery.data.roles?.includes('Administrator') && (
              <Button
                onClick={() => run(() => {
                  leaveAssets()
                  setShowAdminSettings(true)
                })}
                type="button"
                variant="secondary"
              >
                Import Limits
              </Button>
            )}
            <Button
              disabled={signOutMutation.isPending}
              onClick={() => run(() => {
                // Leaving an open asset first releases its edit while still signed in.
                if (assetRoute?.page === 'asset') {
                  openAssets({ page: 'list' })
                }
                signOutMutation.mutate()
              })}
              type="button"
              variant="secondary"
            >
              {signOutMutation.isPending ? 'Signing Out…' : 'Sign Out'}
            </Button>
          </div>
        </header>
      )}
    >
      {/* Keep keyboard focus visible while the pointer holds the overlay open below md: */}
      {/* the focused control must sit above the navigation (z-40). */}
      <ContentPanel wide={(showAssets || showCategories || showMortgages) && !showAdminSettings} className={cn(
        'ml-0 lg:ml-0',
        '[&_:is(button,input,select,textarea):not(.sr-only):focus-visible]:relative [&_:is(button,input,select,textarea):not(.sr-only):focus-visible]:z-50',
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
              Retry Session Check
            </Button>
          </div>
        )}
        {signOutMutation.isError && (
          <ErrorMessage className="mb-5">Unable to sign out. Please try again.</ErrorMessage>
        )}
        <PageErrorBoundary key={pageKey}>
          {showAdminSettings ? (
            <ImportLimitsPage onBack={() => setShowAdminSettings(false)} />
          ) : assetRoute?.page === 'list' ? (
            <AssetsPage
              onAdd={() => openAssets({ page: 'new' })}
              onOpen={(assetId) => openAssets({ page: 'asset', assetId })}
            />
          ) : assetRoute ? (
            <AssetPage
              assetId={assetRoute.page === 'asset' ? assetRoute.assetId : undefined}
              onExit={() => openAssets({ page: 'list' })}
            />
          ) : showMortgages ? (
            <MortgagesPage userId={sessionQuery.data.id} />
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
        </PageErrorBoundary>
      </ContentPanel>
      {showCategories && !showAssets && !showMortgages && !showAdminSettings && (
        <PageErrorBoundary panel>
          <AddCategoryForm />
        </PageErrorBoundary>
      )}
    </SignedInShell>
  )
}

type SignedInShellProps = {
  userId: string | undefined
  initialPinned: boolean
  header: ReactNode
  children: ReactNode
} & Omit<PrimaryNavigationProps, 'navigation'>

/**
 * Owns the navigation state for one signed-in user. It mounts only after the saved preference
 * has settled and is keyed by user ID, so it starts in its final state and sign-out discards it.
 */
function SignedInShell({
  userId,
  initialPinned,
  header,
  children,
  ...destinations
}: SignedInShellProps) {
  const navigation = useNavigationExpansion(initialPinned)
  const savePreference = useSaveNavigationPreference(userId)
  const toast = useToast()

  const toggle = () => {
    const next = navigation.pinned ? 'Unpinned' : 'Pinned'
    navigation.toggle()
    if (userId) {
      // Per-call onError is skipped once the shell unmounts, so a save pending at sign-out
      // never shows a toast to the next user.
      savePreference.mutate(next, {
        onError: () => toast.show(
          'Your navigation setting could not be saved. It stays as you set it for this visit.',
        ),
      })
    }
  }

  return (
    <AppShell
      title="Clutch"
      navExpanded={navigation.expanded}
      nav={<PrimaryNavigation navigation={{ ...navigation, toggle }} {...destinations} />}
      header={header}
    >
      {children}
    </AppShell>
  )
}

// 768px is the breakpoint at which the expanded navigation starts shrinking the page (015).
const HOVER_EXPANDS_QUERY = '(min-width: 768px)'

type NavigationExpansion = ReturnType<typeof useNavigationExpansion>

/**
 * The navigation expands while a mouse hovers it at 768px and wider. Clicking the hamburger pins it open until
 * the hamburger is clicked again; unpinning while the pointer is still over the navigation
 * collapses it until the pointer leaves and re-enters. Only the pinned choice is saved, per user;
 * `initialPinned` is the saved value, applied before the first render.
 */
function useNavigationExpansion(initialPinned: boolean) {
  const [pinned, setPinned] = useState(initialPinned)
  const [hovered, setHovered] = useState(false)
  const [hoverSuppressed, setHoverSuppressed] = useState(false)
  // Below 768px the expanded navigation covers the page, so hover must not open it: content that
  // appears on hover and hides other content has to be dismissible (WCAG 2.2 SC 1.4.13), and the
  // hamburger is the deliberate, reversible way to open it there.
  const hoverExpands = useMediaQuery(HOVER_EXPANDS_QUERY, true)
  const expanded = pinned || (hoverExpands && hovered && !hoverSuppressed)

  return {
    expanded,
    pinned,
    toggle: () => {
      if (pinned) {
        setPinned(false)
        setHoverSuppressed(true)
      } else {
        setPinned(true)
      }
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
  assetsCurrent: boolean
  categoriesCurrent: boolean
  mortgagesCurrent: boolean
  onAccounts: () => void
  onAssets: () => void
  onCategories: () => void
  onMortgages: () => void
}

function PrimaryNavigation({
  navigation: { expanded, toggle, handlers },
  accountsCurrent,
  assetsCurrent,
  categoriesCurrent,
  mortgagesCurrent,
  onAccounts,
  onAssets,
  onCategories,
  onMortgages,
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
        current={assetsCurrent}
        expanded={expanded}
        icon={Gem}
        label="Assets"
        onClick={onAssets}
      />
      <SideNavItem
        current={mortgagesCurrent}
        expanded={expanded}
        icon={Landmark}
        label="Mortgages"
        onClick={onMortgages}
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
