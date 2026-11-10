import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useQuery } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession, signIn, signOut } from '@/features/auth/api'
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
  AccountsPage: () => {
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
        {accountsQuery.data?.map((account) =>
          <p key={account.description}>{account.description}</p>)}
        {importSettingsQuery.data && <p>{importSettingsQuery.data.marker}</p>}
      </>
    )
  },
}))

describe('session loading', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.resetAllMocks()
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
