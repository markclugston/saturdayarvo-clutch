import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUnsavedChanges } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { getSession } from '@/features/auth/api'
import { ApiError } from '@/lib/api/client'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import App from './App'

const failing = vi.hoisted(() => ({ accounts: false, addForm: false, header: false, signIn: false }))

vi.mock('@/components/theme/ThemeSelector', () => ({
  ThemeSelector: () => {
    if (failing.header) throw new Error('secret-marker')
    return <select aria-label="Theme" />
  },
}))

vi.mock('@/features/auth/AuthPage', () => ({
  AuthPage: ({ inert }: { inert?: boolean }) => {
    // Only the sign-in screen proper fails, not the inert page behind the startup dialog.
    if (failing.signIn && !inert) throw new Error('secret-marker')
    return <h1>Sign In</h1>
  },
}))

vi.mock('@/features/auth/api', () => ({
  getSession: vi.fn(),
  register: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('@/features/preferences/api', async (importActual) => ({
  ...await importActual<typeof import('@/features/preferences/api')>(),
  useThemePreference: () => ({ data: { mode: 'Light' }, isError: false, isSuccess: true }),
  useSaveThemePreference: () => ({ isError: false, mutate: vi.fn() }),
}))

vi.mock('@/lib/api/client', async (importActual) => ({
  ...await importActual<typeof import('@/lib/api/client')>(),
  apiRequest: vi.fn(async () => ({ state: 'Unpinned' })),
}))

vi.mock('@/features/accounts/AccountsPage', () => ({
  AccountsPage: () => {
    if (failing.accounts) throw new Error('secret-marker')
    return <h1>Your Accounts</h1>
  },
}))

vi.mock('@/features/categories/CategoriesPage', () => ({
  CategoriesPage: () => <h1>Categories and Groups</h1>,
}))

vi.mock('@/features/categories/AddCategoryForm', () => ({
  AddCategoryForm: () => {
    if (failing.addForm) throw new Error('secret-marker')
    return <form aria-label="Add a Group or Category" />
  },
}))

// Mirrors the unsaved-changes contract of LoanDetailsForm: report dirty, clear it on unmount.
vi.mock('@/features/mortgages/MortgagesPage', () => ({
  MortgagesPage: () => {
    const { setDirty } = useUnsavedChanges()
    const [crashed, setCrashed] = useState(false)
    useEffect(() => () => setDirty(false), [setDirty])
    return (
      <>
        <h1>Mortgages page</h1>
        <button onClick={() => setDirty(true)} type="button">Make dirty</button>
        <button onClick={() => setCrashed(true)} type="button">Crash</button>
        {crashed && <Crash />}
      </>
    )
  },
}))

function Crash(): never {
  throw new Error('secret-marker')
}

async function renderSignedIn() {
  const user = userEvent.setup()
  renderWithQueryClient(<App />)
  await screen.findByRole('navigation', { name: 'Primary' })
  return user
}

function expectShell() {
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Theme' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign Out' })).toBeEnabled()
}

describe('page content failures', () => {
  beforeEach(() => {
    failing.accounts = false
    failing.addForm = false
    failing.header = false
    failing.signIn = false
    vi.mocked(getSession).mockReset().mockResolvedValue({ id: 'user-1', roles: [] })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('keeps the header and navigation when a page fails', async () => {
    failing.accounts = true
    await renderSignedIn()

    expect(within(screen.getByRole('main')).getByRole('alert'))
      .toHaveTextContent('This content could not be displayed.')
    expectShell()
    expect(document.body.innerHTML).not.toContain('secret-marker')
  })

  it('clears the error when another destination is chosen, and shows it again on return', async () => {
    failing.accounts = true
    const user = await renderSignedIn()

    await user.click(screen.getByRole('button', { name: 'Mortgages' }))
    expect(screen.getByRole('heading', { name: 'Mortgages page' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Accounts' }))
    expect(screen.getByRole('alert')).toHaveTextContent('This content could not be displayed.')
  })

  it('keeps the category list usable when the add form fails', async () => {
    failing.addForm = true
    const user = await renderSignedIn()

    await user.click(screen.getByRole('button', { name: 'Categories' }))

    expect(screen.getByRole('heading', { name: 'Categories and Groups' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('This content could not be displayed.')
    expectShell()

    failing.addForm = false
    await user.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(screen.getByRole('form', { name: 'Add a Group or Category' })).toBeInTheDocument()
  })

  it('shows a message instead of a blank window when the header fails, and recovers with a fresh session', async () => {
    failing.header = true
    const user = userEvent.setup()
    renderWithQueryClient(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Clutch could not be displayed.')
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('secret-marker')
    expect(getSession).toHaveBeenCalledTimes(1)

    failing.header = false
    await user.click(screen.getByRole('button', { name: 'Try Again' }))

    await screen.findByRole('navigation', { name: 'Primary' })
    expectShell()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getSession).toHaveBeenCalledTimes(2)
  })

  it('shows a message when the sign-in screen fails', async () => {
    failing.signIn = true
    vi.mocked(getSession).mockRejectedValue(new ApiError(401, { title: 'Authentication required' }))
    const user = userEvent.setup()
    renderWithQueryClient(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Clutch could not be displayed.')

    failing.signIn = false
    await user.click(screen.getByRole('button', { name: 'Try Again' }))

    expect(await screen.findByRole('heading', { name: 'Sign In' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('navigates without a discard prompt after a page with unsaved changes fails', async () => {
    const user = await renderSignedIn()

    await user.click(screen.getByRole('button', { name: 'Mortgages' }))
    await user.click(screen.getByRole('button', { name: 'Make dirty' }))
    await user.click(screen.getByRole('button', { name: 'Crash' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Unsaved changes in it may be lost.')

    await user.click(screen.getByRole('button', { name: 'Accounts' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your Accounts' })).toBeInTheDocument()
  })
})
