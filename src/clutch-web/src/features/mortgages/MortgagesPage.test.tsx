import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  conflictError,
  fillForm,
  installFakeApi,
  listedRates,
  makeMortgage,
  problem,
  renderWithProviders,
  setDate,
  validValues,
  type FakeServer,
} from './testSupport'
import { MortgagesPage } from './MortgagesPage'

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiRequest: vi.fn(),
  clearCsrfToken: vi.fn(),
}))

const PLEASE_ENTER = 'Please enter your mortgage details'

describe('MortgagesPage', () => {
  let server: FakeServer

  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('loading states', () => {
    it('shows a loading status with the spinner and "Loading..." while loading', async () => {
      server = installFakeApi([])
      const release = server.hold('GET')
      renderWithProviders(<MortgagesPage />)

      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Loading...')
      expect(status.querySelector('svg')).not.toBeNull()
      await act(async () => release())
      expect(await screen.findByRole('heading', { name: 'Loan Details' })).toBeInTheDocument()
    })

    it('shows a generic alert with Retry and no form when loading fails, and Retry shows Loading... at once', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      server.failNext('GET', new Error('internal details'))
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('We couldn’t load your mortgages. Please try again.')
      expect(alert).not.toHaveTextContent('internal details')
      expect(screen.queryByRole('heading', { name: 'Loan Details' })).not.toBeInTheDocument()

      const release = server.hold('GET')
      await user.click(screen.getByRole('button', { name: 'Retry' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Loading...')
      await act(async () => release())
      expect(await screen.findByRole('heading', { name: 'Loan Details' })).toBeInTheDocument()
    })

    it('returns to the sign-in screen without an alert when loading returns 401', async () => {
      server = installFakeApi([])
      server.failNext('GET', problem(401))
      const { queryClient } = renderWithProviders(<MortgagesPage />)
      const reset = vi.spyOn(queryClient, 'resetQueries')

      await waitFor(() => expect(reset).toHaveBeenCalledWith({ queryKey: ['session'], exact: true }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('lays out the tab strip, Loan Details, then the Burndown and Schedule groups', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      renderWithProviders(<MortgagesPage />)

      const strip = await screen.findByRole('navigation', { name: 'Mortgages' })
      const details = screen.getByRole('heading', { name: 'Loan Details' })
      const burndown = screen.getByRole('heading', { name: 'Mortgage Burndown' })
      const schedule = screen.getByRole('heading', { name: 'Amortization Schedule' })
      const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      expect(follows(strip, details)).toBe(true)
      expect(follows(details, burndown)).toBe(true)
      expect(follows(burndown, schedule)).toBe(true)
    })
  })

  describe('empty and new states', () => {
    it('shows both groups with the prompt when there are no mortgages', async () => {
      server = installFakeApi([])
      renderWithProviders(<MortgagesPage />)

      await screen.findByRole('heading', { name: 'Loan Details' })
      const burndown = screen.getByRole('heading', { name: 'Mortgage Burndown' }).closest('section')
      const schedule = screen.getByRole('heading', { name: 'Amortization Schedule' }).closest('section')
      expect(within(burndown as HTMLElement).getByText(PLEASE_ENTER)).toBeInTheDocument()
      expect(within(schedule as HTMLElement).getByText(PLEASE_ENTER)).toBeInTheDocument()
    })

    it('shows the prompt again when Add mortgage is selected', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      expect(screen.queryByText(PLEASE_ENTER)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Add mortgage' }))

      expect(screen.getAllByText(PLEASE_ENTER)).toHaveLength(2)
      expect(screen.getByLabelText('Name')).toHaveValue('')
    })
  })

  describe('saving a new mortgage', () => {
    it('saves, shows the "Mortgage saved" toast, selects the new tab and keeps rate changes in the response order', async () => {
      server = installFakeApi([])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('heading', { name: 'Loan Details' })

      await fillForm(user, {
        ...validValues,
        rates: [['5.25', '2000-01-01'], ['6', '2000-06-01']],
      })
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('Mortgage saved')).toBeInTheDocument()
      const tab = await screen.findByRole('button', { name: 'Home loan' })
      expect(tab).toHaveAttribute('aria-current', 'true')
      const post = server.requests.find((request) => request.method === 'POST')
      expect(post?.body).toMatchObject({
        name: 'Home loan',
        startingBalance: 500000,
        numberOfPeriods: 360,
        firstRepaymentDate: '2000-01-01',
        repaymentFrequency: 'Monthly',
        interestRateChanges: [
          { newInterestRate: 5.25, effectiveDate: '2000-01-01' },
          { newInterestRate: 6, effectiveDate: '2000-06-01' },
        ],
      })
    })

    it('lists the rate changes in the order the response gives them', async () => {
      server = installFakeApi([makeMortgage({
        name: 'Ordered',
        interestRateChanges: [
          { newInterestRate: 9, effectiveDate: '2000-01-01' },
          { newInterestRate: 7, effectiveDate: '2000-02-01' },
          { newInterestRate: 8, effectiveDate: '2000-03-01' },
        ],
      })])
      renderWithProviders(<MortgagesPage />)

      const user = userEvent.setup()
      await screen.findByRole('button', { name: 'Ordered' })
      await user.click(screen.getByRole('button', { name: 'Change Interest Rate' }))
      await screen.findByRole('dialog', { name: 'Change Interest Rate' })
      expect(listedRates()).toEqual(['9.00% 1 Jan 2000', '7.00% 1 Feb 2000', '8.00% 1 Mar 2000'])
    })

    it('disables Add mortgage at 20 mortgages without making it unfocusable, and ignores activation', async () => {
      server = installFakeApi(Array.from({ length: 20 }, (_, index) => makeMortgage({ name: `Loan ${index + 1}` })))
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)

      const add = await screen.findByRole('button', { name: 'Add mortgage' })
      expect(add).toHaveAttribute('aria-disabled', 'true')
      expect(add).not.toBeDisabled()
      expect(add).toHaveAttribute('title', 'You can save up to 20 mortgages')
      expect(add).toHaveAccessibleDescription('You can save up to 20 mortgages')
      const selected = screen.getByRole('button', { name: 'Loan 1' })
      expect(selected).toHaveAttribute('aria-current', 'true')

      await user.click(add)
      add.focus()
      await user.keyboard('{Enter}')
      await user.keyboard(' ')

      expect(add).toHaveFocus()
      expect(selected).toHaveAttribute('aria-current', 'true')
      expect(add).not.toHaveAttribute('aria-current')
    })
  })

  describe('switching and editing', () => {
    it('shows the other mortgage when a tab is chosen and updates the label on rename', async () => {
      server = installFakeApi([
        makeMortgage({ name: 'Home', startingBalance: 1000 }),
        makeMortgage({ name: 'Car', startingBalance: 2000 }),
      ])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      expect(screen.getByLabelText('Starting Balance')).toHaveValue('$1,000.00')

      await user.click(screen.getByRole('button', { name: 'Car' }))
      expect(screen.getByLabelText('Starting Balance')).toHaveValue('$2,000.00')

      await user.clear(screen.getByLabelText('Name'))
      await user.type(screen.getByLabelText('Name'), 'Car loan')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('button', { name: 'Car loan' })).toHaveAttribute('aria-current', 'true')
      expect(screen.queryByRole('button', { name: 'Car' })).not.toBeInTheDocument()
    })

    it('asks before switching away from unsaved changes: Stay keeps them, Discard switches', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' }), makeMortgage({ name: 'Car' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')

      await user.click(screen.getByRole('button', { name: 'Car' }))
      expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Stay on this page' }))
      expect(screen.getByLabelText('Name')).toHaveValue('Home edited')

      await user.click(screen.getByRole('button', { name: 'Add mortgage' }))
      expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Discard changes' }))
      expect(screen.getByLabelText('Name')).toHaveValue('')
    })

    it('values typed in the dialog but not added leave the form clean, so switching tabs does not ask', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' }), makeMortgage({ name: 'Car' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      await user.click(screen.getByRole('button', { name: 'Change Interest Rate' }))
      const dialog = await screen.findByRole('dialog', { name: 'Change Interest Rate' })
      await user.type(within(dialog).getByLabelText('New Interest Rate'), '7')
      setDate('Effective Date', '2001-01-01')
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Car' }))

      expect(screen.queryByText('Discard unsaved changes?')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Car' })).toHaveAttribute('aria-current', 'true')
    })

    it('asks before switching away after a dialog remove (the unsaved-changes prompt covers dialog edits)', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' }), makeMortgage({ name: 'Car' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      await user.click(screen.getByRole('button', { name: 'Change Interest Rate' }))
      const dialog = await screen.findByRole('dialog', { name: 'Change Interest Rate' })
      await user.click(within(dialog).getByRole('button', { name: 'Remove 5.25% from 1 Jan 2000' }))
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Car' }))

      expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument()
    })

    it('Cancel restores the saved values', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.getByLabelText('Name')).toHaveValue('Home')
    })

    it('a background refetch with a newer version leaves entered values and the next save gets the 409', async () => {
      const home = makeMortgage({ name: 'Home' })
      server = installFakeApi([home])
      const user = userEvent.setup()
      const { queryClient } = renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')

      server.mortgages[0] = { ...home, name: 'Elsewhere', version: 2 }
      await act(async () => { await queryClient.invalidateQueries({ queryKey: ['mortgages'] }) })

      expect(screen.getByLabelText('Name')).toHaveValue('Home edited')
      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByText('This mortgage was changed elsewhere; reload to see the latest')).toBeInTheDocument()
    })

    it('keeps the tab and entered values when a dirty mortgage disappears from a refetch; the next save (404) removes it', async () => {
      const home = makeMortgage({ name: 'Home' })
      const car = makeMortgage({ name: 'Car' })
      server = installFakeApi([home, car])
      const user = userEvent.setup()
      const { queryClient } = renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')

      server.mortgages = [car]
      await act(async () => { await queryClient.invalidateQueries({ queryKey: ['mortgages'] }) })
      expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveValue('Home edited')

      await user.click(screen.getByRole('button', { name: 'Save' }))
      expect(await screen.findByText('This mortgage was deleted elsewhere')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Car' })).toHaveAttribute('aria-current', 'true')
    })

    it('a failed background refetch after a successful load changes nothing and shows no load alert', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const { queryClient } = renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })

      server.failNext('GET', new Error('network'))
      await act(async () => { await queryClient.invalidateQueries({ queryKey: ['mortgages'] }) })

      expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveValue('Home')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('conflicts and session', () => {
    it('Reload after a 409 passes through the guard, shows Reloading… with values kept, then the latest version', async () => {
      const home = makeMortgage({ name: 'Home' })
      server = installFakeApi([home])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')
      server.mortgages[0] = { ...home, name: 'Elsewhere', version: 2 }
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByText('This mortgage was changed elsewhere; reload to see the latest')

      await user.click(screen.getByRole('button', { name: 'Reload' }))
      expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument()
      const release = server.hold('GET')
      await user.click(screen.getByRole('button', { name: 'Discard changes' }))

      const busy = await screen.findByRole('button', { name: 'Reloading…' })
      expect(busy).toBeDisabled()
      expect(screen.getByLabelText('Name')).toHaveValue('Home edited')
      await act(async () => release())
      await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Elsewhere'))
      expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
    })

    it('a failed Reload keeps the form, the conflict alert and Reload, and adds a reload-failed alert', async () => {
      const home = makeMortgage({ name: 'Home' })
      server = installFakeApi([home])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      server.mortgages[0] = { ...home, version: 2 }
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByText('This mortgage was changed elsewhere; reload to see the latest')

      server.failNext('GET', new Error('boom'))
      await user.click(screen.getByRole('button', { name: 'Reload' }))

      expect(await screen.findByText('The latest version could not be loaded. Please try again.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled()
      expect(screen.getByRole('heading', { name: 'Loan Details' })).toBeInTheDocument()
      expect(screen.queryByText(/couldn.t load your mortgages/)).not.toBeInTheDocument()
    })

    it('Reload removes the tab with the deleted-elsewhere toast when the mortgage is gone', async () => {
      const home = makeMortgage({ name: 'Home' })
      const car = makeMortgage({ name: 'Car' })
      server = installFakeApi([home, car])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await screen.findByRole('button', { name: 'Home' })
      server.mortgages = [{ ...car }]
      server.failNext('PUT', conflictError())
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByText('This mortgage was changed elsewhere; reload to see the latest')

      await user.click(screen.getByRole('button', { name: 'Reload' }))

      expect(await screen.findByText('This mortgage was deleted elsewhere')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument()
    })

    it('a 404 on save removes the tab, selects the first tab and toasts', async () => {
      const home = makeMortgage({ name: 'Home' })
      const car = makeMortgage({ name: 'Car' })
      server = installFakeApi([home, car])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await user.click(await screen.findByRole('button', { name: 'Car' }))
      server.mortgages = [home]

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('This mortgage was deleted elsewhere')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Car' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'true')
    })

    it('401 while dirty asks Stay / Sign in again; Stay keeps the values', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      const { queryClient } = renderWithProviders(<MortgagesPage />)
      const reset = vi.spyOn(queryClient, 'resetQueries')
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')
      server.failNext('PUT', problem(401))

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('Your sign-in has expired')).toBeInTheDocument()
      expect(reset).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Stay on this page' }))
      expect(screen.getByLabelText('Name')).toHaveValue('Home edited')
    })

    it('Sign in again resets the session; 401 while clean goes straight to sign-in with no dialog', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      const { queryClient } = renderWithProviders(<MortgagesPage />)
      const reset = vi.spyOn(queryClient, 'resetQueries')
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')
      server.failNext('PUT', problem(401))
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await user.click(await screen.findByRole('button', { name: 'Sign in again' }))
      await waitFor(() => expect(reset).toHaveBeenCalledWith({ queryKey: ['session'], exact: true }))

      reset.mockClear()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      server.failNext('PUT', problem(401))
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(reset).toHaveBeenCalled())
      expect(screen.queryByText('Your sign-in has expired')).not.toBeInTheDocument()
    })
  })

  describe('deleting', () => {
    it('removes the tab and selects the first remaining tab', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' }), makeMortgage({ name: 'Car' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage />)
      await user.click(await screen.findByRole('button', { name: 'Car' }))

      await user.click(screen.getByRole('button', { name: 'Delete Car' }))
      await user.click(await screen.findByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(screen.queryByRole('button', { name: 'Car' })).not.toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'true')
    })
  })

  it('selects the first remaining tab after deleting the last mortgage', async () => {
    server = installFakeApi([
      makeMortgage({ name: 'Home' }),
      makeMortgage({ name: 'Car' }),
      makeMortgage({ name: 'Boat' }),
    ])
    const user = userEvent.setup()
    renderWithProviders(<MortgagesPage />)
    await user.click(await screen.findByRole('button', { name: 'Boat' }))

    await user.click(screen.getByRole('button', { name: 'Delete Boat' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Boat' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByLabelText('Name')).toHaveValue('Home')
  })

  it('setDate helper is exercised by the form (sanity)', async () => {
    server = installFakeApi([])
    renderWithProviders(<MortgagesPage />)
    await screen.findByRole('heading', { name: 'Loan Details' })
    setDate('First Repayment Date', '2000-01-01')
    expect(screen.getByLabelText('First Repayment Date')).toHaveValue('2000-01-01')
  })
})
