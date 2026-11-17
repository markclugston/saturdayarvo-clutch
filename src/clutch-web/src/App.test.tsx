import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { focusManager, useQuery } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAccount, getCurrencies } from '@/features/accounts/api'
import { getSession, signIn, signOut } from '@/features/auth/api'
import { confirmImportReview, createImportReview, getAccountImportSettings } from '@/features/imports/api'
import { ApiError } from '@/lib/api/client'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import App from './App'

vi.mock('@/features/auth/api', () => ({
  getSession: vi.fn(),
  register: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/features/preferences/api', () => ({
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
        <h1>Your accounts</h1>
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
    <button onClick={onImport} type="button">Import transactions</button>
  ),
}))

vi.mock('@/features/accounts/api', () => ({
  getAccount: vi.fn(),
  getCurrencies: vi.fn(),
}))

vi.mock('@/features/imports/api', () => ({
  createImportReview: vi.fn(),
  getAccountImportSettings: vi.fn(),
  confirmImportReview: vi.fn(),
  cancelImportReview: vi.fn(),
  cancelActiveImportReview: vi.fn(),
}))

vi.mock('@/features/categories/CategoriesPage', () => ({
  CategoriesPage: () => <h1>Categories and groups</h1>,
}))

async function startImportReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Open account' }))
  await user.click(screen.getByRole('button', { name: 'Import transactions' }))
  await user.upload(
    await screen.findByLabelText('CSV file'),
    new File(['Date,Description,Amount\n2025-01-15,Market,10.00'], 'transactions.csv', {
      type: 'text/csv',
    }),
  )
  await user.click(await screen.findByRole('button', { name: 'Review import with saved settings' }))
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
    vi.mocked(getAccount).mockResolvedValue({
      id: 'account-1',
      description: 'Everyday spending',
      currencyCode: 'AUD',
      lastSuccessfulImportAtUtc: null,
    })
    vi.mocked(getCurrencies).mockResolvedValue([{
      code: 'AUD',
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
      duplicateConfirmationRequired: false,
      expiresAtUtc: '2025-01-15T14:00:00.000Z',
      rows: [{
        sourceRowNumber: 2,
        transactionDate: '2025-01-15',
        description: 'Market',
        amount: '10.00',
        direction: 'Outgoing',
        isPossibleDuplicate: false,
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

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(document.querySelector('h1')).toHaveTextContent('Sign in')
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
    expect(await screen.findByRole('heading', { name: 'Sign in' }, { timeout: 3000 }))
      .toBeInTheDocument()
    expect(getSession).toHaveBeenCalledTimes(2)
  })

  it('shows an error and allows retry for a non-transient server error', async () => {
    vi.mocked(getSession)
      .mockRejectedValueOnce(new ApiError(500, { title: 'Server error' }))
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
    const user = userEvent.setup()
    renderWithQueryClient(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load your session')
    expect(getSession).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('does not retry a signed-out response and unlocks the sign-in page', async () => {
    vi.mocked(getSession).mockRejectedValue(new ApiError(401, { title: 'Authentication required' }))

    renderWithQueryClient(<App />)

    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
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
    const user = userEvent.setup()

    renderWithQueryClient(<App />)
    await screen.findByRole('alert')
    const retryStartedAt = performance.now()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(performance.now() - retryStartedAt).toBeLessThan(500)
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(getSession).toHaveBeenCalledTimes(2)
  })

  it('shows the theme selector in the authenticated top banner', async () => {
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })

    renderWithQueryClient(<App />)

    expect(await screen.findByRole('combobox', { name: 'Theme' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your accounts' })).toBeInTheDocument()
  })

  it('keeps the import review mounted while the session refreshes on returning to the browser', async () => {
    let resolveRefresh: ((value: { id: string; roles: string[] }) => void) | undefined
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveRefresh = resolve
      }))
    const user = userEvent.setup()

    renderWithQueryClient(<App />)
    await startImportReview(user)
    expect(screen.getByRole('heading', { name: 'Review transactions' })).toBeInTheDocument()

    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('heading', { name: 'Review transactions' })).toBeInTheDocument()
    expect(screen.queryByText('Checking your session')).not.toBeInTheDocument()

    await act(async () => resolveRefresh?.({ id: 'user-1', roles: [] }))
    expect(screen.getByRole('heading', { name: 'Review transactions' })).toBeInTheDocument()
    expect(screen.getByText('Market')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm import' }))
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
    const user = userEvent.setup()

    renderWithQueryClient(<App />)
    await startImportReview(user)
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to refresh your session')
    expect(screen.getByRole('heading', { name: 'Review transactions' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry session check' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Review transactions' })).toBeInTheDocument()
  })

  it('hides the review when a background session refresh returns unauthorized', async () => {
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
    const user = userEvent.setup()

    renderWithQueryClient(<App />)
    await startImportReview(user)
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Review transactions' })).not.toBeInTheDocument()
  })

  it('exposes application actions as named buttons without hyperlink controls', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'user-1',
      roles: ['Administrator'],
    })

    renderWithQueryClient(<App />)

    const importLimitsButton = await screen.findByRole('button', { name: 'Import limits' })
    const signOutButton = screen.getByRole('button', { name: 'Sign out' })
    expect(importLimitsButton.tagName).toBe('BUTTON')
    expect(signOutButton.tagName).toBe('BUTTON')
    expect(document.querySelectorAll('a[href]')).toHaveLength(0)
  })

  it('navigates between Accounts and Categories using buttons', async () => {
    const user = userEvent.setup()
    vi.mocked(getSession).mockResolvedValue({ id: 'user-1', roles: [] })

    renderWithQueryClient(<App />)

    const categoriesButton = await screen.findByRole('button', { name: 'Categories' })
    const accountsButton = screen.getByRole('button', { name: 'Accounts' })
    expect(accountsButton).toHaveAttribute('aria-current', 'page')
    expect(accountsButton).toHaveClass('cursor-pointer')
    expect(categoriesButton).toHaveClass('cursor-pointer')
    await user.click(categoriesButton)
    expect(screen.getByRole('heading', { name: 'Categories and groups' })).toBeInTheDocument()
    expect(categoriesButton).toHaveAttribute('aria-current', 'page')

    await user.click(accountsButton)
    expect(screen.getByRole('heading', { name: 'Your accounts' })).toBeInTheDocument()
  })

  it('does not show the theme selector in the signed-out view', async () => {
    vi.mocked(getSession).mockRejectedValue(new ApiError(401, { title: 'Authentication required' }))

    renderWithQueryClient(<App />)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Theme' })).not.toBeInTheDocument()
  })

  it('resets the applied theme on sign-out', async () => {
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'user-1', roles: [] })
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
    vi.mocked(signOut).mockResolvedValue()
    const user = userEvent.setup()

    renderWithQueryClient(<App />)
    const selector = await screen.findByRole<HTMLSelectElement>('combobox', { name: 'Theme' })
    await user.selectOptions(selector, 'Dark')
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).not.toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Sign in' })).not.toHaveAttribute('tabindex')
  })

  it('does not expose cached account or import data after another user signs in', async () => {
    vi.mocked(getSession)
      .mockResolvedValueOnce({ id: 'owner', roles: [] })
      .mockRejectedValueOnce(new ApiError(401, { title: 'Authentication required' }))
      .mockResolvedValueOnce({ id: 'other-user', roles: [] })
    vi.mocked(signOut).mockResolvedValue()
    vi.mocked(signIn).mockResolvedValue()
    const user = userEvent.setup()

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

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText('Owner private account')).not.toBeInTheDocument()
    expect(screen.queryByText('Owner private import settings')).not.toBeInTheDocument()
    expect(queryClient.getQueryData(['account', 'account-1'])).toBeUndefined()
    expect(queryClient.getQueryData(['transactions', 'account-1'])).toBeUndefined()
    expect(queryClient.getQueryData(['accountImportSettings', 'account-1'])).toBeUndefined()
    expect(queryClient.getQueryData(['admin', 'import-limits'])).toBeUndefined()

    await user.type(screen.getByLabelText('Email'), 'other@example.test')
    await user.type(screen.getByLabelText('Password'), 'Other-user!Password-123')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Your accounts' })).toBeInTheDocument()
    expect(screen.queryByText('Owner private account')).not.toBeInTheDocument()
    expect(screen.queryByText('Owner private import settings')).not.toBeInTheDocument()
  })
})
