import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { focusManager, useQuery } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccount, getCurrencies } from '@/features/accounts/api'
import { getSession, signIn, signOut } from '@/features/auth/api'
import { acquireEdit, getEditStatus, listAssets, releaseEdit } from '@/features/assets/api'
import { confirmImportReview, createImportReview, getAccountImportSettings, getImportStatus } from '@/features/imports/api'
import { ApiError, apiRequest } from '@/lib/api/client'
import { useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import App from './App'

vi.mock('@/features/auth/api', () => ({
  getSession: vi.fn(),
  register: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/features/preferences/api', async (importActual) => ({
  ...await importActual<typeof import('@/features/preferences/api')>(),
  useThemePreference: () => ({
    data: { mode: 'Light' },
    isError: false,
    isSuccess: true,
  }),
  useSaveThemePreference: () => ({
    isError: false,
    mutate: vi.fn(),
  }),
}))

// The navigation preference hooks are real; only the HTTP boundary is replaced.
vi.mock('@/lib/api/client', async (importActual) => ({
  ...await importActual<typeof import('@/lib/api/client')>(),
  apiRequest: vi.fn(),
}))

// No timer wait between simulated keystrokes, which otherwise dominates the typing tests.
function setupUser() {
  return userEvent.setup({ delay: null })
}

type ApiRequestInit = RequestInit | undefined

function navigationRequests(method: 'GET' | 'PUT') {
  return vi.mocked(apiRequest).mock.calls.filter(([path, , init]) =>
    path === '/api/preferences/navigation' && ((init as ApiRequestInit)?.method ?? 'GET') === method)
}

function respondToNavigation(handlers: {
  get?: (signal: AbortSignal | null | undefined) => Promise<unknown>
  put?: (state: string) => Promise<unknown>
} = {}) {
  vi.mocked(apiRequest).mockImplementation((async (
    path: string,
    _schema: unknown,
    init?: RequestInit,
  ) => {
    if (path !== '/api/preferences/navigation') {
      // Anything else was never reachable in these tests (no network), so it still fails.
      throw new TypeError('Failed to fetch')
    }
    if (init?.method === 'PUT') {
      const { state } = JSON.parse(String(init.body)) as { state: string }
      return handlers.put ? handlers.put(state) : { state }
    }
    return handlers.get ? handlers.get(init?.signal) : { state: 'Unpinned' }
  }) as never)
}

function abortable(signal: AbortSignal | null | undefined, value?: unknown) {
  return new Promise<unknown>((resolve, reject) => {
    const fail = () => reject(new DOMException('Aborted', 'AbortError'))
    if (signal?.aborted) {
      fail()
      return
    }
    signal?.addEventListener('abort', fail)
    if (value !== undefined) {
      resolve(value)
    }
  })
}

vi.mock('@/features/accounts/AccountsPage', () => ({
  AccountsPage: ({ onSelectAccount }: { onSelectAccount: (id: string) => void }) => {
    const accountsQuery = useQuery({
      queryKey: ['accounts'],
      queryFn: async (): Promise<Array<{ description: string }>> => [],
    })
    const importSettingsQuery = useQuery({
      queryKey: ['accountImportSettings', 'account-1'],
      queryFn: async (): Promise<{ marker: string } | null> => null,
    })
    return (
      <>
        <h1>Your Accounts</h1>
        <button onClick={() => onSelectAccount('account-1')} type="button">Open account</button>
        {accountsQuery.data?.map((account) =>
          <p key={account.description}>{account.description}</p>)}
        {importSettingsQuery.data && <p>{importSettingsQuery.data.marker}</p>}
      </>
    )
  },
}))

vi.mock('@/features/accounts/AccountDetails', () => ({
  AccountDetails: ({ onImport }: { onImport: () => void }) => (
    <button onClick={onImport} type="button">Import Transactions</button>
  ),
}))

vi.mock('@/features/accounts/api', () => ({
  getAccount: vi.fn(),
  getCurrencies: vi.fn(),
}))

vi.mock('@/features/imports/api', () => ({
  createImportReview: vi.fn(),
  getAccountImportSettings: vi.fn(),
  getImportStatus: vi.fn(),
  confirmImportReview: vi.fn(),
  cancelImportReview: vi.fn(),
  cancelActiveImportReview: vi.fn(),
}))

// The Assets pages are real; only their requests are replaced.
vi.mock('@/features/assets/api', async (importActual) => ({
  ...await importActual<typeof import('@/features/assets/api')>(),
  listAssets: vi.fn(),
  acquireEdit: vi.fn(),
  getEditStatus: vi.fn(),
  releaseEdit: vi.fn(),
}))

vi.mock('@/features/categories/CategoriesPage', () => ({
  CategoriesPage: () => <h1>Categories and Groups</h1>,
}))

vi.mock('@/features/mortgages/MortgagesPage', () => ({
  MortgagesPage: () => {
    const { setDirty } = useUnsavedChanges()
    return (
      <>
        <h1>Mortgages page</h1>
        <button onClick={() => setDirty(true)} type="button">Make dirty</button>
        <button onClick={() => setDirty(false)} type="button">Make clean</button>
      </>
    )
  },
}))

async function startImportReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Open account' }))
  await user.click(screen.getByRole('button', { name: 'Import Transactions' }))
  await user.upload(
    await screen.findByLabelText('CSV File'),
    new File(['Date,Description,Amount\n2025-01-15,Market,10.00'], 'transactions.csv', {
      type: 'text/csv',
    }),
  )
  await user.click(await screen.findByRole('button', { name: 'Review Import with Saved Settings' }))
  expect(await screen.findByText('Market')).toBeInTheDocument()
}

describe('session loading', () => {
  afterEach(() => {
    focusManager.setFocused(undefined)
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.resetAllMocks()
    window.history.replaceState(null, '', '/')
    respondToNavigation()
    vi.mocked(listAssets).mockResolvedValue({ assets: [], totals: [] })
    vi.mocked(releaseEdit).mockResolvedValue(undefined)
    vi.mocked(getImportStatus).mockImplementation(async (accountId, reviewId) => reviewId ? ({
      accountId, availability: 'Blocked',
      activeImport: { id: reviewId, stage: 'Preview', canEnd: true, expiresAtUtc: '2027-01-15T14:00:00Z' },
      watchedImport: { id: reviewId, state: 'Ready', expiresAtUtc: '2027-01-15T14:00:00Z' },
    }) : ({
      accountId, availability: 'Available', activeImport: null, watchedImport: null,
    }))
    vi.mocked(getAccount).mockResolvedValue({
      id: 'account-1',
      description: 'Everyday spending',
      currencyCode: 'AUD',
      lastSuccessfulImportAtUtc: null,
    })
    vi.mocked(getCurrencies).mockResolvedValue([{
      code: 'AUD',
      minorUnits: 2,
      name: 'Australian Dollar',
      amountFormats: [{
        id: 'dot-decimal-comma-grouping',
        decimalSeparator: '.',
        groupSeparator: ',',
        reference: 'CLDR',
        version: '44.0',
      }],
    }])
    vi.mocked(getAccountImportSettings).mockResolvedValue({
      mapping: {
        dateColumn: 0,
        descriptionColumn: 1,
        dateFormat: 'yyyy-MM-dd',
        amountMode: 'Signed',
        signedAmountColumn: 2,
        incomingSign: 'Positive',
        numberFormat: 'dot-decimal-comma-grouping',
      },
    })
    vi.mocked(createImportReview).mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440002',
      accountId: 'account-1',
      currencyCode: 'AUD',
      rowCount: 1,
      importRowCount: 1,
      duplicateConfirmationRequired: false,
      expiresAtUtc: '2025-01-15T14:00:00.000Z',
      rows: [{
        sourceRowNumber: 2,
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '10.00',
        direction: 'Outgoing',
        isPossibleDuplicate: false,
        isExcluded: false,
      }],
    })
    vi.mocked(confirmImportReview).mockResolvedValue({
      importedCount: 1,
      completedAtUtc: '2025-01-15T13:50:00.000Z',
      settingsSaved: true,
    })
  })

  it('keeps the sign-in page inert behind a blocking status until session discovery completes', async () => {
    let resolveSession: ((value: { id: string; roles: string[] }) => void) | undefined
    vi.mocked(getSession).mockImplementation(() => new Promise((resolve) => {
      resolveSession = resolve
    }))

    renderWithQueryClient(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Checking Your Session')
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(document.querySelector('h1')).toHaveTextContent('Sign In')
    expect(document.querySelector('main')).toHaveAttribute('inert')
    expect(screen.queryByRole('combobox', { name: 'Theme' })).not.toBeInTheDocument()

    resolveSession?.({ id: 'user-1', roles: [] })
    expect(await screen.findByRole('combobox', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps loading during a temporary gateway failure and shows sign-in when the API is ready', async () => {
    vi.mocked(getSession)
      .mockRejectedValueOnce(new ApiError(502, { title: 'Bad gateway' }))
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))

    renderWithQueryClient(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Please wait while we check your session.')
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 3000 })
    expect(await screen.findByRole('heading', { name: 'Sign In' }, { timeout: 3000 }))
      .toBeInTheDocument()
    expect(getSession).toHaveBeenCalledTimes(2)
  })

  it('shows an error and allows retry for a non-transient server error', async () => {
    vi.mocked(getSession)
      .mockRejectedValueOnce(new ApiError(500, { title: 'Server error' }))
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
    const user = setupUser()
    renderWithQueryClient(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your session')
    expect(getSession).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('does not retry a signed-out response and unlocks the sign-in page', async () => {
    vi.mocked(getSession).mockRejectedValue(new ApiError(401, { title: 'Authentication required' }))

    renderWithQueryClient(<App />)

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('ends transient retries when the recovery window expires', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    let rejectSession: ((error: Error) => void) | undefined
    vi.mocked(getSession).mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectSession = reject
    }))

    renderWithQueryClient(<App />)
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1))

    await act(async () => {
      now.mockReturnValue(31_000)
      rejectSession?.(new ApiError(503, { title: 'Unavailable' }))
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your session')
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('settles timed-out transient requests within the 45-second startup bound', async () => {
    vi.useFakeTimers()
    vi.mocked(getSession).mockImplementation(() => new Promise((_resolve, reject) => {
      setTimeout(() => reject(new DOMException('Timed out', 'TimeoutError')), 8000)
    }))

    renderWithQueryClient(<App />)
    await act(async () => {
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(45_000)
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load your session')
    expect(vi.mocked(getSession).mock.calls.length).toBeGreaterThan(1)
  })

  it('shows the blocking status immediately when a failed startup check is retried', async () => {
    vi.mocked(getSession)
      .mockRejectedValueOnce(new ApiError(500, { title: 'Server error' }))
      .mockImplementationOnce(() => new Promise(() => {}))
    const user = setupUser()

    renderWithQueryClient(<App />)
    await screen.findByRole('alert')
    const retryStartedAt = performance.now()
    await user.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(performance.now() - retryStartedAt).toBeLessThan(500)
    expect(screen.getByRole('status')).toHaveTextContent('Checking Your Session')
    expect(getSession).toHaveBeenCalledTimes(2)
  })

  it('shows the theme selector in the authenticated top banner', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })

    renderWithQueryClient(<App />)

    expect(await screen.findByRole('combobox', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your Accounts' })).toBeInTheDocument()
  })

  it('keeps the import review mounted while the session refreshes on returning to the browser', async () => {
    let resolveRefresh: ((value: { id: string; roles: string[] }) => void) | undefined
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveRefresh = resolve
      }))
    const user = setupUser()

    renderWithQueryClient(<App />)
    await startImportReview(user)
    expect(screen.getByRole('heading', { name: 'Review Transactions' })).toBeInTheDocument()

    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('heading', { name: 'Review Transactions' })).toBeInTheDocument()
    expect(screen.queryByText('Checking Your Session')).not.toBeInTheDocument()

    await act(async () => resolveRefresh?.({ id: 'user-1', roles: [] }))
    expect(screen.getByRole('heading', { name: 'Review Transactions' })).toBeInTheDocument()
    expect(screen.getByText('Market')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm Import' }))
    await waitFor(() => expect(confirmImportReview).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440002',
      false,
    ))
  })

  it('keeps the review and reports a failed background session refresh', async () => {
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      .mockRejectedValueOnce(new ApiError(500, { title: 'Server error' }))
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
    const user = setupUser()

    renderWithQueryClient(<App />)
    await startImportReview(user)
    await user.click(screen.getByRole('button', { name: 'Toggle navigation' }))
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to refresh your session')
    expect(within(screen.getByRole('button', { name: 'Categories' })).getByText('Categories')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Review Transactions' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry Session Check' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Review Transactions' })).toBeInTheDocument()
  })

  it('hides the review when a background session refresh returns unauthorized', async () => {
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
    const user = setupUser()

    renderWithQueryClient(<App />)
    await startImportReview(user)
    await user.click(screen.getByRole('button', { name: 'Toggle navigation' }))
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Review Transactions' })).not.toBeInTheDocument()
  })

  it('exposes application actions as named buttons without hyperlink controls', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'user-1',
      roles: ['Administrator'],
    })

    renderWithQueryClient(<App />)

    const importLimitsButton = await screen.findByRole('button', { name: 'Import Limits' })
    const signOutButton = screen.getByRole('button', { name: 'Sign Out' })
    expect(importLimitsButton.tagName).toBe('BUTTON')
    expect(signOutButton.tagName).toBe('BUTTON')
    expect(document.querySelectorAll('a[href]')).toHaveLength(0)
  })

  it('navigates between Accounts and Categories using buttons', async () => {
    const user = setupUser()
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })

    renderWithQueryClient(<App />)

    const categoriesButton = await screen.findByRole('button', { name: 'Categories' })
    const accountsButton = screen.getByRole('button', { name: 'Accounts' })
    expect(accountsButton).toHaveAttribute('aria-current', 'page')
    expect(accountsButton).toHaveClass('cursor-pointer')
    expect(categoriesButton).toHaveClass('cursor-pointer')
    await user.click(categoriesButton)
    expect(screen.getByRole('heading', { name: 'Categories and Groups' })).toBeInTheDocument()
    expect(categoriesButton).toHaveAttribute('aria-current', 'page')

    await user.click(accountsButton)
    expect(screen.getByRole('heading', { name: 'Your Accounts' })).toBeInTheDocument()
  })

  it('lists Mortgages directly above Categories and marks it current when shown', async () => {
    const user = setupUser()
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })

    renderWithQueryClient(<App />)

    const mortgages = await screen.findByRole('button', { name: 'Mortgages' })
    const categories = screen.getByRole('button', { name: 'Categories' })
    expect(mortgages.compareDocumentPosition(categories) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mortgages.nextElementSibling).toBe(categories)
    await user.click(mortgages)
    expect(screen.getByRole('heading', { name: 'Mortgages page' })).toBeInTheDocument()
    expect(mortgages).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Accounts' })).not.toHaveAttribute('aria-current')
  })

  it('asks before leaving the Mortgages screen with unsaved changes (navigation and Sign out)', async () => {
    const user = setupUser()
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
    vi.mocked(signOut).mockResolvedValue()
    renderWithQueryClient(<App />)
    await user.click(await screen.findByRole('button', { name: 'Mortgages' }))
    await user.click(screen.getByRole('button', { name: 'Make dirty' }))

    await user.click(screen.getByRole('button', { name: 'Accounts' }))
    expect(await screen.findByText('Discard Unsaved Changes?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stay on This Page' }))
    expect(screen.getByRole('heading', { name: 'Mortgages page' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign Out' }))
    expect(await screen.findByText('Discard Unsaved Changes?')).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Discard Changes' }))
    await waitFor(() => expect(signOut).toHaveBeenCalled())
  })

  it('does not refetch the session on focus or reconnect while the form is dirty, but does once clean', async () => {
    const user = setupUser()
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
    renderWithQueryClient(<App />)
    await user.click(await screen.findByRole('button', { name: 'Mortgages' }))
    await user.click(screen.getByRole('button', { name: 'Make dirty' }))
    expect(getSession).toHaveBeenCalledTimes(1)

    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      window.dispatchEvent(new Event('online'))
    })
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'Mortgages page' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Make clean' }))
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
  })

  it('keeps primary navigation outside the header across signed-in screens', async () => {
    const user = setupUser()
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
    renderWithQueryClient(<App />)

    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    expect(screen.getByRole('banner')).not.toContainElement(nav)
    const accounts = within(nav).getByRole('button', { name: 'Accounts' })
    const categories = within(nav).getByRole('button', { name: 'Categories' })
    expect(accounts).toHaveAttribute('aria-current', 'page')
    await user.click(screen.getByRole('button', { name: 'Open account' }))
    expect(accounts).toHaveAttribute('aria-current', 'page')
    await user.click(categories)
    expect(categories).toHaveAttribute('aria-current', 'page')
    await user.click(accounts)
    expect(screen.getByRole('heading', { name: 'Your Accounts' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Import Limits' })).not.toBeInTheDocument()
  })

  it('expands on toggle across screens and starts compact after sign-out', async () => {
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
    vi.mocked(signOut).mockResolvedValue()
    vi.mocked(signIn).mockResolvedValue()
    const user = setupUser()
    renderWithQueryClient(<App />)

    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    const label = within(nav).getByText('Categories')
    expect(label).not.toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Toggle navigation' }))
    expect(label).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Categories' }))
    expect(label).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))
    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'user@example.test')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    const newNav = await screen.findByRole('navigation', { name: 'Primary' })
    expect(within(newNav).getByText('Categories')).not.toBeVisible()
  })

  it('keeps expanded navigation available when sign-out fails', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
    vi.mocked(signOut).mockRejectedValue(new ApiError(500, { title: 'Server error' }))
    const user = setupUser()
    renderWithQueryClient(<App />)

    await screen.findByRole('navigation', { name: 'Primary' })
    await user.click(screen.getByRole('button', { name: 'Toggle navigation' }))
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to sign out')
    expect(within(screen.getByRole('button', { name: 'Categories' })).getByText('Categories')).toBeVisible()
  })

  it('removes navigation after sign-out even if the session check fails and resets it on sign-in', async () => {
    let rejectSession: ((error: Error) => void) | undefined
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      .mockImplementationOnce(() => new Promise((_resolve, reject) => {
        rejectSession = reject
      }))
      .mockResolvedValueOnce({ id: 'user-2', roles: [] })
    vi.mocked(signOut).mockResolvedValue()
    vi.mocked(signIn).mockResolvedValue()
    const user = setupUser()
    renderWithQueryClient(<App />)

    await screen.findByRole('navigation', { name: 'Primary' })
    await user.click(screen.getByRole('button', { name: 'Toggle navigation' }))
    await user.click(screen.getByRole('button', { name: 'Sign Out' }))
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    await act(async () => rejectSession?.(new ApiError(500, { title: 'Server error' })))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your session')
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'user@example.test')
    await user.type(screen.getByLabelText('Password'), 'password')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    expect(within(nav).getByText('Categories')).not.toBeVisible()
  })

  it('expands on hover and the hamburger pins it open until clicked again', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
    const user = setupUser()
    renderWithQueryClient(<App />)

    const nav = await screen.findByRole('navigation', { name: 'Primary' })
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' })
    const label = within(nav).getByText('Accounts')
    expect(screen.queryByText('SaturdayArvo Clutch')).not.toBeInTheDocument()
    await waitFor(() => expect(label).not.toBeVisible())
    await user.hover(nav)
    expect(label).toBeVisible()
    await user.unhover(nav)
    await waitFor(() => expect(label).not.toBeVisible())

    await user.hover(nav)
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.unhover(nav)
    expect(label).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Categories' }))
    expect(label).toBeVisible()

    await user.hover(nav)
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(label).not.toBeVisible())
    await user.unhover(nav)
    await user.hover(nav)
    expect(label).toBeVisible()
  })

  describe('hover expansion below 768px', () => {
    // WCAG 2.2 SC 1.4.13: hover must not open content that covers the page and cannot be dismissed.
    // Below 768px the expanded navigation overlays the page, so only the hamburger opens it there.
    function stubViewport(initiallyWide: boolean) {
      const listeners = new Set<() => void>()
      const viewport = { wide: initiallyWide }
      vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
        matches: query === '(min-width: 768px)' ? viewport.wide : false,
        media: query,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
      })))
      return {
        resize: (wide: boolean) => act(() => {
          viewport.wide = wide
          listeners.forEach((listener) => listener())
        }),
      }
    }

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('does not expand on hover, and the hamburger still pins and unpins', async () => {
      stubViewport(false)
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      const user = setupUser()
      renderWithQueryClient(<App />)

      const nav = await screen.findByRole('navigation', { name: 'Primary' })
      const toggle = screen.getByRole('button', { name: 'Toggle navigation' })
      const label = within(nav).getByText('Accounts')
      await user.hover(nav)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await waitFor(() => expect(label).not.toBeVisible())

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(label).toBeVisible()
      await user.unhover(nav)
      expect(label).toBeVisible()

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await waitFor(() => expect(label).not.toBeVisible())
    })

    it('collapses a hover expansion when the viewport narrows and hover works again once it widens', async () => {
      const viewport = stubViewport(true)
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      const user = setupUser()
      renderWithQueryClient(<App />)

      const nav = await screen.findByRole('navigation', { name: 'Primary' })
      const label = within(nav).getByText('Accounts')
      await user.hover(nav)
      expect(label).toBeVisible()

      await viewport.resize(false)
      await waitFor(() => expect(label).not.toBeVisible())
      await user.unhover(nav)
      await user.hover(nav)
      await waitFor(() => expect(label).not.toBeVisible())

      // The pointer is still over the navigation, which no longer covers content at this width.
      await viewport.resize(true)
      expect(label).toBeVisible()
    })
  })

  it('operates destinations by keyboard', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
    const user = setupUser()
    renderWithQueryClient(<App />)

    const accounts = await screen.findByRole('button', { name: 'Accounts' })
    const categories = screen.getByRole('button', { name: 'Categories' })
    const mortgages = screen.getByRole('button', { name: 'Mortgages' })
    accounts.focus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Assets' })).toHaveFocus()
    await user.tab()
    expect(mortgages).toHaveFocus()
    await user.tab()
    expect(categories).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(categories).toHaveAttribute('aria-current', 'page')
  })

  it('does not show the theme selector in the signed-out view', async () => {
    vi.mocked(getSession).mockRejectedValue(new ApiError(401, { title: 'Authentication required' }))

    renderWithQueryClient(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Theme' })).not.toBeInTheDocument()
  })

  it('resets the applied theme on sign-out', async () => {
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
    vi.mocked(signOut).mockResolvedValue()
    const user = setupUser()

    renderWithQueryClient(<App />)
    const selector = await screen.findByRole<HTMLSelectElement>('combobox', { name: 'Theme' })
    await user.selectOptions(selector, 'Dark')
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))

    await user.click(screen.getByRole('button', { name: 'Sign Out' }))

    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))
    expect(await screen.findByRole('heading', { name: 'Sign In' })).not.toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Sign In' })).not.toHaveAttribute('tabindex')
  })

  it('does not expose cached account or import data after another user signs in', async () => {
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'owner', roles: [] })
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
      .mockResolvedValueOnce({ id: 'other-user', roles: [] })
    vi.mocked(signOut).mockResolvedValue()
    vi.mocked(signIn).mockResolvedValue()
    const user = setupUser()

    const { queryClient } = renderWithQueryClient(<App />)
    queryClient.setQueryData(['accounts'], [{ description: 'Owner private account' }])
    queryClient.setQueryData(['account', 'account-1'], { description: 'Owner private account' })
    queryClient.setQueryData(['transactions', 'account-1'], [{ description: 'Owner private transaction' }])
    queryClient.setQueryData(['accountImportSettings', 'account-1'], {
      marker: 'Owner private import settings',
    })
    queryClient.setQueryData(['admin', 'import-limits'], { maxRowsPerImport: 10 })

    expect(await screen.findByText('Owner private account')).toBeInTheDocument()
    expect(screen.getByText('Owner private import settings')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign Out' }))
    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.queryByText('Owner private account')).not.toBeInTheDocument()
    expect(screen.queryByText('Owner private import settings')).not.toBeInTheDocument()
    expect(queryClient.getQueryData(['account', 'account-1'])).toBeUndefined()
    expect(queryClient.getQueryData(['transactions', 'account-1'])).toBeUndefined()
    expect(queryClient.getQueryData(['accountImportSettings', 'account-1'])).toBeUndefined()
    expect(queryClient.getQueryData(['admin', 'import-limits'])).toBeUndefined()

    await user.type(screen.getByLabelText('Email'), 'other@example.test')
    await user.type(screen.getByLabelText('Password'), 'Other-user!Password-123')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByRole('heading', { name: 'Your Accounts' })).toBeInTheDocument()
    expect(screen.queryByText('Owner private account')).not.toBeInTheDocument()
    expect(screen.queryByText('Owner private import settings')).not.toBeInTheDocument()
  })

  describe('Assets pages and their URLs', () => {
    const assetId = '550e8400-e29b-41d4-a716-446655440000'
    const editId = '550e8400-e29b-41d4-a716-446655440002'

    function holdEdit(secondsLeft = 300) {
      const now = Date.now()
      vi.mocked(acquireEdit).mockResolvedValue({
        editId,
        serverTimeUtc: new Date(now).toISOString(),
        expiresAtUtc: new Date(now + secondsLeft * 1000).toISOString(),
        asset: {
          id: assetId, name: 'House', description: null, currencyCode: 'AUD',
          valuations: [{ id: editId, value: 100, valuationDate: '2026-01-01' }],
        },
      })
      vi.mocked(getEditStatus).mockResolvedValue({
        assetId,
        availability: 'Blocked',
        activeEdit: { id: editId, expiresAtUtc: '2027-01-01T00:00:00Z' },
        watchedEdit: { id: editId, state: 'Active', expiresAtUtc: '2027-01-01T00:00:00Z' },
      })
    }

    // The browser changes the URL, then reports it.
    const traverseTo = (path: string) => act(() => {
      window.history.replaceState(null, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    async function signedIn(path = '/') {
      window.history.replaceState(null, '', path)
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      const user = setupUser()
      renderWithQueryClient(<App />)
      await screen.findByRole('navigation', { name: 'Primary' })
      return user
    }

    const nav = (name: string) => screen.getByRole('button', { name })
    const heading = (name: string) => screen.findByRole('heading', { name })

    it('lists Assets directly below Accounts and shows it at its own URL', async () => {
      const user = await signedIn()
      expect(nav('Accounts').nextElementSibling).toBe(nav('Assets'))

      await user.click(nav('Assets'))

      expect(await heading('Assets')).toBeInTheDocument()
      expect(window.location.pathname).toBe('/assets')
      expect(nav('Assets')).toHaveAttribute('aria-current', 'page')
      expect(nav('Accounts')).not.toHaveAttribute('aria-current')
    })

    it('moves between the list and a new asset', async () => {
      const user = await signedIn('/assets')

      await user.click(await screen.findByRole('button', { name: 'Add Asset' }))
      expect(await heading('Add Asset')).toBeInTheDocument()
      expect(window.location.pathname).toBe('/assets/new')

      await user.click(await screen.findByRole('button', { name: 'Cancel' }))
      expect(await heading('Assets')).toBeInTheDocument()
      expect(window.location.pathname).toBe('/assets')
    })

    it.each([
      ['/assets', 'Assets'],
      ['/assets/new', 'Add Asset'],
    ])('opens %s from the URL at startup', async (path, title) => {
      await signedIn(path)

      expect(await heading(title)).toBeInTheDocument()
      expect(nav('Assets')).toHaveAttribute('aria-current', 'page')
      expect(acquireEdit).not.toHaveBeenCalled()
    })

    it('opens the asset named in the URL at startup', async () => {
      holdEdit()
      await signedIn(`/assets/${assetId}`)

      expect(await screen.findByLabelText('Name')).toHaveValue('House')
      expect(acquireEdit).toHaveBeenCalledWith(assetId)
    })

    it.each(['Accounts', 'Mortgages', 'Categories'])('returns to the root URL for %s', async (destination) => {
      const user = await signedIn('/assets')

      await user.click(nav(destination))

      expect(window.location.pathname).toBe('/')
      expect(nav(destination)).toHaveAttribute('aria-current', 'page')
      expect(nav('Assets')).not.toHaveAttribute('aria-current')
    })

    it('follows Back and Forward while there is nothing to lose', async () => {
      await signedIn('/assets/new')

      await traverseTo('/assets')
      expect(await heading('Assets')).toBeInTheDocument()

      await traverseTo('/')
      expect(await heading('Your Accounts')).toBeInTheDocument()

      await traverseTo('/assets/new')
      expect(await heading('Add Asset')).toBeInTheDocument()
    })

    it.each([['/assets', 'Assets'], ['/', 'Your Accounts']])(
      'asks before Back to %s discards an unsaved asset',
      async (target, title) => {
        const user = await signedIn('/assets/new')
        await user.type(await screen.findByLabelText('Name'), 'Car')

        await traverseTo(target)
        expect(await screen.findByText('Discard Unsaved Changes?')).toBeInTheDocument()
        expect(window.location.pathname).toBe('/assets/new')
        await user.click(nav('Stay on This Page'))
        expect(screen.getByLabelText('Name')).toHaveValue('Car')
        expect(window.location.pathname).toBe('/assets/new')

        await traverseTo(target)
        await user.click(await screen.findByRole('button', { name: 'Discard Changes' }))
        expect(await heading(title)).toBeInTheDocument()
        expect(window.location.pathname).toBe(target)
      },
    )

    it('asks before navigation discards an unsaved asset', async () => {
      const user = await signedIn('/assets/new')
      await user.type(await screen.findByLabelText('Name'), 'Car')

      await user.click(nav('Mortgages'))
      await user.click(await screen.findByRole('button', { name: 'Stay on This Page' }))

      expect(screen.getByLabelText('Name')).toHaveValue('Car')
      expect(window.location.pathname).toBe('/assets/new')
    })

    it.each(['Accounts', 'Sign Out'])('releases the held edit on %s', async (destination) => {
      holdEdit()
      vi.mocked(signOut).mockReturnValue(new Promise(() => {}))
      const user = await signedIn(`/assets/${assetId}`)
      await screen.findByLabelText('Name')

      await user.click(nav(destination))

      await waitFor(() => expect(releaseEdit).toHaveBeenCalledWith(assetId, editId))
    })

    it('never carries an expiry notice past sign-out', async () => {
      holdEdit(0.2)
      vi.mocked(signOut).mockResolvedValue()
      window.history.replaceState(null, '', `/assets/${assetId}`)
      vi.mocked(getSession)
        .mockResolvedValueOnce({ id: 'user-1', roles: [] })
        .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
      const user = setupUser()
      renderWithQueryClient(<App />)
      expect(await screen.findByText('Your edit of House expired.')).toBeInTheDocument()

      await user.click(nav('Sign Out'))

      expect(await heading('Sign In')).toBeInTheDocument()
      await waitFor(() =>
        expect(screen.queryByText('Your edit of House expired.')).not.toBeInTheDocument())
      expect(window.location.pathname).toBe('/')
    })
  })

  describe('saved navigation state', () => {
    it('holds the startup dialog while the preference is pending, then renders pinned first', async () => {
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      let resolvePreference: ((value: unknown) => void) | undefined
      respondToNavigation({
        get: () => new Promise((resolve) => { resolvePreference = resolve }),
      })
      const expandedAtMount: boolean[] = []
      const observer = new MutationObserver(() => {
        const toggle = screen.queryByRole('button', { name: 'Toggle navigation' })
        if (toggle) {
          expandedAtMount.push(toggle.getAttribute('aria-expanded') === 'true')
        }
      })
      observer.observe(document.body, { childList: true, subtree: true })
      renderWithQueryClient(<App />)

      await waitFor(() => expect(navigationRequests('GET')).toHaveLength(1))
      expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()

      await act(async () => resolvePreference?.({ state: 'Pinned' }))

      const toggle = await screen.findByRole('button', { name: 'Toggle navigation' })
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      observer.disconnect()
      expect(expandedAtMount.length).toBeGreaterThan(0)
      expect(expandedAtMount.every(Boolean)).toBe(true)
    })

    it('does not request the preference until the session has loaded', async () => {
      vi.mocked(getSession).mockRejectedValue(new ApiError(401, { title: 'Authentication required' }))
      renderWithQueryClient(<App />)

      expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
      expect(navigationRequests('GET')).toHaveLength(0)
    })

    it('starts pinned after signing in from the sign-in screen', async () => {
      vi.mocked(getSession)
        .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
        .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      vi.mocked(signIn).mockResolvedValue()
      respondToNavigation({ get: async () => ({ state: 'Pinned' }) })
      const user = setupUser()
      renderWithQueryClient(<App />)

      await user.type(await screen.findByLabelText('Email'), 'user@example.test')
      await user.type(screen.getByLabelText('Password'), 'password')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      expect(await screen.findByRole('button', { name: 'Toggle navigation' }))
        .toHaveAttribute('aria-expanded', 'true')
    })

    it('starts compact when the preference request fails', async () => {
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      respondToNavigation({ get: async () => { throw new ApiError(500, { title: 'Server error' }) } })
      renderWithQueryClient(<App />)

      expect(await screen.findByRole('button', { name: 'Toggle navigation' }))
        .toHaveAttribute('aria-expanded', 'false')
    })

    it('gives up after 2 s, starts compact and ignores a late response', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      respondToNavigation({ get: (signal) => abortable(signal) })
      renderWithQueryClient(<App />)

      await waitFor(() => expect(navigationRequests('GET')).toHaveLength(1))
      expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(2000) })

      const toggle = await screen.findByRole('button', { name: 'Toggle navigation' })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    it('flips aria-expanded at once and sends one PUT per toggle; hover and focus send none', async () => {
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      const user = setupUser()
      renderWithQueryClient(<App />)

      const toggle = await screen.findByRole('button', { name: 'Toggle navigation' })
      const nav = screen.getByRole('navigation', { name: 'Primary' })
      await user.hover(nav)
      await user.unhover(nav)
      await user.tab()
      expect(navigationRequests('PUT')).toHaveLength(0)

      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await waitFor(() => expect(navigationRequests('PUT')).toHaveLength(1))
      expect(JSON.parse(String(navigationRequests('PUT')[0]?.[2]?.body))).toEqual({ state: 'Pinned' })
    })

    it('shows a toast and keeps the chosen state when the save fails', async () => {
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      respondToNavigation({ put: async () => { throw new ApiError(503, { title: 'Unavailable' }) } })
      const user = setupUser()
      renderWithQueryClient(<App />)

      const toggle = await screen.findByRole('button', { name: 'Toggle navigation' })
      await user.click(toggle)

      expect(await screen.findByText(/could not be saved/)).toBeInTheDocument()
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })

    it('responds to the hamburger at once while a save never completes (FR-010)', async () => {
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      respondToNavigation({ put: () => new Promise(() => {}) })
      const user = setupUser()
      renderWithQueryClient(<App />)

      const toggle = await screen.findByRole('button', { name: 'Toggle navigation' })
      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument()
    })

    it('saves rapid toggles in order so the last request carries the final state', async () => {
      vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })
      const user = setupUser()
      renderWithQueryClient(<App />)

      const toggle = await screen.findByRole('button', { name: 'Toggle navigation' })
      await user.click(toggle)
      await user.click(toggle)
      await user.click(toggle)

      await waitFor(() => expect(navigationRequests('PUT')).toHaveLength(3))
      const states = navigationRequests('PUT').map(([, , init]) =>
        (JSON.parse(String((init as RequestInit).body)) as { state: string }).state)
      expect(states).toEqual(['Pinned', 'Unpinned', 'Pinned'])
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })

    it('shows the next user their own state and nothing from a save left pending at sign-out', async () => {
      vi.mocked(getSession)
        .mockResolvedValueOnce({ id: 'user-1', roles: [] })
        .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
        .mockResolvedValueOnce({ id: 'user-2', roles: [] })
      vi.mocked(signOut).mockResolvedValue()
      vi.mocked(signIn).mockResolvedValue()
      let failPendingSave: (() => void) | undefined
      respondToNavigation({
        get: async () => ({ state: 'Unpinned' }),
        put: () => new Promise((_resolve, reject) => {
          failPendingSave = () => reject(new ApiError(503, { title: 'Unavailable' }))
        }),
      })
      const user = setupUser()
      renderWithQueryClient(<App />)

      await user.click(await screen.findByRole('button', { name: 'Toggle navigation' }))
      await waitFor(() => expect(navigationRequests('PUT')).toHaveLength(1))
      respondToNavigation({ get: async () => ({ state: 'Unpinned' }) })
      await user.click(screen.getByRole('button', { name: 'Sign Out' }))
      expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument()

      await act(async () => failPendingSave?.())
      expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument()

      await user.type(screen.getByLabelText('Email'), 'two@example.test')
      await user.type(screen.getByLabelText('Password'), 'password')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      const toggle = await screen.findByRole('button', { name: 'Toggle navigation' })
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByText(/could not be saved/)).not.toBeInTheDocument()
    })

    it('shows a different user their own saved state after sign-in', async () => {
      vi.mocked(getSession)
        .mockResolvedValueOnce({ id: 'user-1', roles: [] })
        .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
        .mockResolvedValueOnce({ id: 'user-2', roles: [] })
      vi.mocked(signOut).mockResolvedValue()
      vi.mocked(signIn).mockResolvedValue()
      respondToNavigation({ get: async () => ({ state: 'Pinned' }) })
      const user = setupUser()
      renderWithQueryClient(<App />)

      expect(await screen.findByRole('button', { name: 'Toggle navigation' }))
        .toHaveAttribute('aria-expanded', 'true')
      await user.click(screen.getByRole('button', { name: 'Sign Out' }))
      expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument()

      respondToNavigation({ get: async () => ({ state: 'Unpinned' }) })
      await user.type(screen.getByLabelText('Email'), 'two@example.test')
      await user.type(screen.getByLabelText('Password'), 'password')
      await user.click(screen.getByRole('button', { name: 'Sign In' }))

      expect(await screen.findByRole('button', { name: 'Toggle navigation' }))
        .toHaveAttribute('aria-expanded', 'false')
    })
  })
})
