import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addRates,
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
import { periodBalancesQueryKey } from './api'
import { MortgagesPage } from './MortgagesPage'

/** Unmounts and remounts its children, like leaving Mortgages and returning. */
function LeaveAndReturn({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(true)
  return (
    <>
      <button onClick={() => setShown((current) => !current)} type="button">Toggle Page</button>
      {shown && children}
    </>
  )
}

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiRequest: vi.fn(),
  clearCsrfToken: vi.fn(),
}))

const PLEASE_ENTER = 'Please enter your mortgage details'

const timeline = () => screen.getByRole('region', { name: 'Loan Payoff Timeline' })
// The timeline's own view announcer, not the chart's hover announcer inside "Burndown Values".
const timelineStatus = () => {
  const [status] = within(timeline()).getAllByRole('status').filter((element) => !element.closest('[aria-label="Burndown Values"]'))
  if (!status) throw new Error('No timeline status')
  return status
}

function expectOnlyChart() {
  expect(within(timeline()).getByRole('img', { name: /balance over time/i })).toBeInTheDocument()
  expect(within(timeline()).queryByRole('table')).not.toBeInTheDocument()
}

function expectOnlySchedule() {
  expect(within(timeline()).getByRole('table')).toBeInTheDocument()
  expect(within(timeline()).queryByRole('img', { name: /balance over time/i })).not.toBeInTheDocument()
}

describe('MortgagesPage', () => {
  let server: FakeServer

  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('loading states', () => {
    it('shows a loading status with the spinner and "Loading..." while loading', async () => {
      server = installFakeApi([])
      const release = server.hold('GET')
      renderWithProviders(<MortgagesPage userId="user-1" />)

      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('Loading...')
      expect(status.querySelector('svg')).not.toBeNull()
      await act(async () => release())
      expect(await screen.findByRole('heading', { name: 'Details' })).toBeInTheDocument()
    })

    it('shows a generic alert with Retry and no form when loading fails, and Retry shows Loading... at once', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      server.failNext('GET', new Error('internal details'))
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('We couldn’t load your mortgages. Please try again.')
      expect(alert).not.toHaveTextContent('internal details')
      expect(screen.queryByRole('heading', { name: 'Details' })).not.toBeInTheDocument()

      const release = server.hold('GET')
      await user.click(screen.getByRole('button', { name: 'Retry' }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Loading...')
      await act(async () => release())
      expect(await screen.findByRole('heading', { name: 'Details' })).toBeInTheDocument()
    })

    it('returns to the sign-in screen without an alert when loading returns 401', async () => {
      server = installFakeApi([])
      server.failNext('GET', problem(401))
      const { queryClient } = renderWithProviders(<MortgagesPage userId="user-1" />)
      const reset = vi.spyOn(queryClient, 'resetQueries')

      await waitFor(() => expect(reset).toHaveBeenCalledWith({ queryKey: ['session'], exact: true }))
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('lays out the tab strip, Details, then one Loan Payoff Timeline group showing only the chart', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      renderWithProviders(<MortgagesPage userId="user-1" />)

      const strip = await screen.findByRole('navigation', { name: 'Mortgages' })
      const details = screen.getByRole('heading', { name: 'Details' })
      const timeline = screen.getByRole('region', { name: 'Loan Payoff Timeline' })
      const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
      expect(follows(strip, details)).toBe(true)
      expect(follows(details, timeline)).toBe(true)
      expect(screen.getAllByRole('region', { name: 'Loan Payoff Timeline' })).toHaveLength(1)
      expect(screen.queryByRole('heading', { name: 'Mortgage Burndown' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Amortization Schedule' })).not.toBeInTheDocument()
      expectOnlyChart()
    })
  })

  describe('loan payoff timeline view', () => {
    it('switches between the chart and the schedule within 500 ms, never showing both, and announces each view', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })
      expect(timelineStatus()).toHaveTextContent('Showing Burndown Chart')

      act(() => { screen.getByRole('button', { name: 'Show Amortization Schedule' }).click() })
      await within(timeline()).findByRole('table', undefined, { timeout: 500 })
      expectOnlySchedule()
      expect(timelineStatus()).toHaveTextContent('Showing Amortization Schedule')

      await user.click(screen.getByRole('button', { name: 'Show Burndown Chart' }))
      expectOnlyChart()
      expect(timelineStatus()).toHaveTextContent('Showing Burndown Chart')
    })

    it('keeps the chosen view across mortgage tabs and Add mortgage', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' }), makeMortgage({ name: 'Car' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })

      await user.click(screen.getByRole('button', { name: 'Show Amortization Schedule' }))
      await user.click(screen.getByRole('button', { name: 'Car' }))
      expectOnlySchedule()

      await user.click(screen.getByRole('button', { name: 'Add Mortgage' }))
      expect(within(timeline()).getByText(PLEASE_ENTER)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Show Burndown Chart' })).toBeInTheDocument()
    })

    it('shows the prompt in both views for an unsaved mortgage and the switch still works', async () => {
      server = installFakeApi([])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('heading', { name: 'Details' })
      expect(within(timeline()).getByText(PLEASE_ENTER)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Show Amortization Schedule' }))

      expect(within(timeline()).getByText(PLEASE_ENTER)).toBeInTheDocument()
      expect(timelineStatus()).toHaveTextContent('Showing Amortization Schedule')
    })
  })

  describe('saved loan payoff timeline view', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    /** Records whether the burndown chart was ever added to the page. */
    function watchForChart() {
      const seen = { chart: false, loading: false }
      const check = () => {
        if (document.querySelector('svg[aria-label^="Line chart of the mortgage balance"]')) {
          seen.chart = true
        }
        if (screen.queryByText('Loading...')) {
          seen.loading = true
        }
      }
      const observer = new MutationObserver(check)
      observer.observe(document.body, { childList: true, subtree: true })
      return { seen, stop: () => observer.disconnect() }
    }

    it('stays in Loading... until the saved view arrives, then shows the saved schedule without the chart first', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })], 'Schedule')
      const release = server.holdPreference('GET')
      const watcher = watchForChart()
      renderWithProviders(<MortgagesPage userId="user-1" />)

      await waitFor(() => expect(server.requests.some((request) => request.method === 'GET')).toBe(true))
      expect(server.preferenceRequests).toHaveLength(1)
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(screen.getByRole('status')).toHaveTextContent('Loading...')
      expect(screen.queryByRole('region', { name: 'Loan Payoff Timeline' })).not.toBeInTheDocument()

      await act(async () => release())

      await screen.findByRole('region', { name: 'Loan Payoff Timeline' })
      expectOnlySchedule()
      watcher.stop()
      expect(watcher.seen.chart).toBe(false)
    })

    it('shows the chart when loading the saved view fails', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })], 'Schedule')
      server.failPreference('GET', new Error('boom'))
      renderWithProviders(<MortgagesPage userId="user-1" />)

      await screen.findByRole('region', { name: 'Loan Payoff Timeline' })
      expectOnlyChart()
    })

    it('shows the chart 2 s after the saved view was requested when it does not answer, and ignores a late answer', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      server = installFakeApi([makeMortgage({ name: 'Home' })], 'Schedule')
      const release = server.holdPreference('GET')
      renderWithProviders(<MortgagesPage userId="user-1" />)

      await waitFor(() => expect(server.preferenceRequests).toHaveLength(1))
      await act(async () => { await vi.advanceTimersByTimeAsync(1900) })
      expect(screen.queryByRole('region', { name: 'Loan Payoff Timeline' })).not.toBeInTheDocument()
      await act(async () => { await vi.advanceTimersByTimeAsync(150) })

      expect(await screen.findByRole('region', { name: 'Loan Payoff Timeline' })).toBeInTheDocument()
      expectOnlyChart()
      expect(server.preferenceRequests[0]?.signal?.aborted).toBe(true)

      await act(async () => release())
      expectOnlyChart()
    })

    it('shows the view last chosen at once when returning to the page in the same visit', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      renderWithProviders(<LeaveAndReturn><MortgagesPage userId="user-1" /></LeaveAndReturn>)
      await screen.findByRole('button', { name: 'Home' })
      await user.click(screen.getByRole('button', { name: 'Show Amortization Schedule' }))

      await user.click(screen.getByRole('button', { name: 'Toggle Page' }))
      expect(screen.queryByRole('region', { name: 'Loan Payoff Timeline' })).not.toBeInTheDocument()
      const watcher = watchForChart()
      await user.click(screen.getByRole('button', { name: 'Toggle Page' }))

      await screen.findByRole('region', { name: 'Loan Payoff Timeline' })
      expectOnlySchedule()
      watcher.stop()
      expect(watcher.seen.chart).toBe(false)
      expect(watcher.seen.loading).toBe(false)
      expect(server.preferenceRequests.filter((request) => request.method === 'GET')).toHaveLength(1)
    })

    it('a switch updates the cache at once and saves with an increasing sequence', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      const { queryClient } = renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })

      await user.click(screen.getByRole('button', { name: 'Show Amortization Schedule' }))
      expect(queryClient.getQueryData(['loanPayoffTimelinePreference', 'user-1'])).toEqual({ view: 'Schedule' })
      await user.click(screen.getByRole('button', { name: 'Show Burndown Chart' }))

      await waitFor(() => expect(server.preferenceRequests.filter((request) => request.method === 'PUT')).toHaveLength(2))
      const [first, second] = server.preferenceRequests
        .filter((request) => request.method === 'PUT')
        .map((request) => request.body as { view: string; clientId: string; clientSequence: number })
      expect(first?.view).toBe('Schedule')
      expect(second?.view).toBe('Burndown')
      expect(second?.clientId).toBe(first?.clientId)
      expect(second?.clientSequence).toBe((first?.clientSequence ?? 0) + 1)
    })

    it('an older save answering last does not change the view', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const releases = server.holdAllPreference('PUT')
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })

      await user.click(screen.getByRole('button', { name: 'Show Amortization Schedule' }))
      await user.click(screen.getByRole('button', { name: 'Show Burndown Chart' }))
      await waitFor(() => expect(releases).toHaveLength(2))

      await act(async () => {
        releases[1]?.()
        releases[0]?.()
      })

      expectOnlyChart()
    })

    it('a save that never answers still switches the view within 500 ms', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      server.holdPreference('PUT')
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })

      act(() => { screen.getByRole('button', { name: 'Show Amortization Schedule' }).click() })

      await within(timeline()).findByRole('table', undefined, { timeout: 500 })
      expectOnlySchedule()
    })

    it('a failed save shows no toast and keeps the chosen view', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      server.failPreference('PUT', problem(500))
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })

      await user.click(screen.getByRole('button', { name: 'Show Amortization Schedule' }))
      await waitFor(() => expect(server.preferenceRequests.some((request) => request.method === 'PUT')).toBe(true))
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(screen.queryByRole('status', { name: /save/i })).not.toBeInTheDocument()
      expect(screen.queryByText(/couldn.t save/i)).not.toBeInTheDocument()
      expect(screen.getAllByRole('status').map((status) => status.textContent)).toEqual(['Showing Amortization Schedule'])
      expectOnlySchedule()
    })
  })

  describe('empty and new states', () => {
    it('shows the group with the prompt when there are no mortgages', async () => {
      server = installFakeApi([])
      renderWithProviders(<MortgagesPage userId="user-1" />)

      await screen.findByRole('heading', { name: 'Details' })
      expect(within(timeline()).getByText(PLEASE_ENTER)).toBeInTheDocument()
    })

    it('shows the prompt again when Add mortgage is selected', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })
      expect(screen.queryByText(PLEASE_ENTER)).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Add Mortgage' }))

      expect(screen.getAllByText(PLEASE_ENTER)).toHaveLength(1)
      expect(screen.getByLabelText('Name')).toHaveValue('')
    })
  })

  describe('schedule of an unsaved mortgage', () => {
    it('sizes the schedule from the valid Duration, Disbursal Date and Payment Frequency typed in the form', async () => {
      server = installFakeApi([], 'Schedule')
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('heading', { name: 'Details' })
      expect(within(timeline()).getByText(PLEASE_ENTER)).toBeInTheDocument()

      await fillForm(user, { periods: '360', first: '2024-01-01', frequency: 'Monthly' })

      await waitFor(() => expect(within(timeline()).getByRole('table')).toHaveAttribute('aria-rowcount', '361'))
    })

    it('shows the prompt again when the Duration becomes invalid', async () => {
      server = installFakeApi([], 'Schedule')
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('heading', { name: 'Details' })
      await fillForm(user, { periods: '360', first: '2024-01-01', frequency: 'Monthly' })
      await waitFor(() => expect(within(timeline()).getByRole('table')).toBeInTheDocument())

      await user.clear(screen.getByLabelText('Duration'))

      await waitFor(() => expect(within(timeline()).getByText(PLEASE_ENTER)).toBeInTheDocument())
    })
  })

  describe('saving a new mortgage', () => {
    it('saves, shows the "Mortgage saved" toast, selects the new tab and keeps rate changes in the response order', async () => {
      server = installFakeApi([])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('heading', { name: 'Details' })

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
        openingBalance: 500000,
        duration: 360,
        disbursalDate: '2000-01-01',
        paymentFrequency: 'Monthly',
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
      renderWithProviders(<MortgagesPage userId="user-1" />)

      const user = userEvent.setup()
      await screen.findByRole('button', { name: 'Ordered' })
      await user.click(screen.getByRole('button', { name: 'Interest Rates' }))
      await screen.findByRole('dialog', { name: 'Interest Rates' })
      expect(listedRates()).toEqual(['9.00% 1 Jan 2000', '7.00% 1 Feb 2000', '8.00% 1 Mar 2000'])
    })

    it('disables Add mortgage at 20 mortgages without making it unfocusable, and ignores activation', async () => {
      server = installFakeApi(Array.from({ length: 20 }, (_, index) => makeMortgage({ name: `Loan ${index + 1}` })))
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)

      const add = await screen.findByRole('button', { name: 'Add Mortgage' })
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
        makeMortgage({ name: 'Home', openingBalance: 1000 }),
        makeMortgage({ name: 'Car', openingBalance: 2000 }),
      ])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })
      expect(screen.getByLabelText('Opening Balance')).toHaveValue('$1,000.00')

      await user.click(screen.getByRole('button', { name: 'Car' }))
      expect(screen.getByLabelText('Opening Balance')).toHaveValue('$2,000.00')

      await user.clear(screen.getByLabelText('Name'))
      await user.type(screen.getByLabelText('Name'), 'Car loan')
      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByRole('button', { name: 'Car loan' })).toHaveAttribute('aria-current', 'true')
      expect(screen.queryByRole('button', { name: 'Car' })).not.toBeInTheDocument()
    })

    it('asks before switching away from unsaved changes: Stay keeps them, Discard switches', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' }), makeMortgage({ name: 'Car' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')

      await user.click(screen.getByRole('button', { name: 'Car' }))
      expect(await screen.findByText('Discard Unsaved Changes?')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Stay on This Page' }))
      expect(screen.getByLabelText('Name')).toHaveValue('Home edited')

      await user.click(screen.getByRole('button', { name: 'Add Mortgage' }))
      expect(await screen.findByText('Discard Unsaved Changes?')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Discard Changes' }))
      expect(screen.getByLabelText('Name')).toHaveValue('')
    })

    it('values typed in the dialog but not added leave the form clean, so switching tabs does not ask', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' }), makeMortgage({ name: 'Car' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })
      await user.click(screen.getByRole('button', { name: 'Interest Rates' }))
      const dialog = await screen.findByRole('dialog', { name: 'Interest Rates' })
      await user.type(within(dialog).getByLabelText('New Interest Rate'), '7')
      setDate('Effective Date', '2001-01-01')
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Car' }))

      expect(screen.queryByText('Discard Unsaved Changes?')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Car' })).toHaveAttribute('aria-current', 'true')
    })

    it('asks before switching away after a dialog remove (the unsaved-changes prompt covers dialog edits)', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' }), makeMortgage({ name: 'Car' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })
      await user.click(screen.getByRole('button', { name: 'Interest Rates' }))
      const dialog = await screen.findByRole('dialog', { name: 'Interest Rates' })
      await user.click(within(dialog).getByRole('button', { name: 'Remove 5.25% from 1 Jan 2000' }))
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      await user.click(screen.getByRole('button', { name: 'Car' }))

      expect(await screen.findByText('Discard Unsaved Changes?')).toBeInTheDocument()
    })

    it('Cancel restores the saved values', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.getByLabelText('Name')).toHaveValue('Home')
    })

    it('a background refetch with a newer version leaves entered values and the next save gets the 409', async () => {
      const home = makeMortgage({ name: 'Home' })
      server = installFakeApi([home])
      const user = userEvent.setup()
      const { queryClient } = renderWithProviders(<MortgagesPage userId="user-1" />)
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
      const { queryClient } = renderWithProviders(<MortgagesPage userId="user-1" />)
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
      const { queryClient } = renderWithProviders(<MortgagesPage userId="user-1" />)
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
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')
      server.mortgages[0] = { ...home, name: 'Elsewhere', version: 2 }
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByText('This mortgage was changed elsewhere; reload to see the latest')

      await user.click(screen.getByRole('button', { name: 'Reload' }))
      expect(await screen.findByText('Discard Unsaved Changes?')).toBeInTheDocument()
      const release = server.hold('GET')
      await user.click(screen.getByRole('button', { name: 'Discard Changes' }))

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
      renderWithProviders(<MortgagesPage userId="user-1" />)
      await screen.findByRole('button', { name: 'Home' })
      server.mortgages[0] = { ...home, version: 2 }
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await screen.findByText('This mortgage was changed elsewhere; reload to see the latest')

      server.failNext('GET', new Error('boom'))
      await user.click(screen.getByRole('button', { name: 'Reload' }))

      expect(await screen.findByText('The latest version could not be loaded. Please try again.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reload' })).toBeEnabled()
      expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
      expect(screen.queryByText(/couldn.t load your mortgages/)).not.toBeInTheDocument()
    })

    it('Reload removes the tab with the deleted-elsewhere toast when the mortgage is gone', async () => {
      const home = makeMortgage({ name: 'Home' })
      const car = makeMortgage({ name: 'Car' })
      server = installFakeApi([home, car])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
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
      renderWithProviders(<MortgagesPage userId="user-1" />)
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
      const { queryClient } = renderWithProviders(<MortgagesPage userId="user-1" />)
      const reset = vi.spyOn(queryClient, 'resetQueries')
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')
      server.failNext('PUT', problem(401))

      await user.click(screen.getByRole('button', { name: 'Save' }))

      expect(await screen.findByText('Your Sign-In Has Expired')).toBeInTheDocument()
      expect(reset).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Stay on This Page' }))
      expect(screen.getByLabelText('Name')).toHaveValue('Home edited')
    })

    it('Sign in again resets the session; 401 while clean goes straight to sign-in with no dialog', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' })])
      const user = userEvent.setup()
      const { queryClient } = renderWithProviders(<MortgagesPage userId="user-1" />)
      const reset = vi.spyOn(queryClient, 'resetQueries')
      await screen.findByRole('button', { name: 'Home' })
      await user.type(screen.getByLabelText('Name'), ' edited')
      server.failNext('PUT', problem(401))
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await user.click(await screen.findByRole('button', { name: 'Sign In Again' }))
      await waitFor(() => expect(reset).toHaveBeenCalledWith({ queryKey: ['session'], exact: true }))

      reset.mockClear()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      server.failNext('PUT', problem(401))
      await user.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(reset).toHaveBeenCalled())
      expect(screen.queryByText('Your Sign-In Has Expired')).not.toBeInTheDocument()
    })
  })

  describe('deleting', () => {
    it('removes the tab and selects the first remaining tab', async () => {
      server = installFakeApi([makeMortgage({ name: 'Home' }), makeMortgage({ name: 'Car' })])
      const user = userEvent.setup()
      renderWithProviders(<MortgagesPage userId="user-1" />)
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
    renderWithProviders(<MortgagesPage userId="user-1" />)
    await user.click(await screen.findByRole('button', { name: 'Boat' }))

    await user.click(screen.getByRole('button', { name: 'Delete Boat' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Boat' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByLabelText('Name')).toHaveValue('Home')
  })

  it('setDate helper is exercised by the form (sanity)', async () => {
    server = installFakeApi([])
    renderWithProviders(<MortgagesPage userId="user-1" />)
    await screen.findByRole('heading', { name: 'Details' })
    setDate('Disbursal Date', '2000-01-01')
    expect(screen.getByLabelText('Disbursal Date')).toHaveValue('2000-01-01')
  })
})

describe('MortgagesPage Bank Schedule values', () => {
  const bankCell = (row: number) => {
    const rows = within(timeline()).getAllByRole('row')
    return within(rows[row] as HTMLElement).getAllByRole('cell')[2]?.textContent ?? ''
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows calculated balances for a saved mortgage, updates them on edit without saving, hides them when invalid', async () => {
    const server = installFakeApi([makeMortgage({ name: 'Home', openingBalance: 100000, duration: 12 })], 'Schedule')
    const user = userEvent.setup()
    renderWithProviders(<MortgagesPage userId="user-1" />)

    await screen.findByRole('table')
    await waitFor(() => expect(bankCell(1)).toMatch(/^\$\d{2},\d{3}\.\d{2}$/))
    const first = bankCell(1)
    expect(bankCell(12)).toBe('$0.00')

    await user.clear(screen.getByLabelText('Opening Balance'))
    await user.type(screen.getByLabelText('Opening Balance'), '200000')
    await waitFor(() => expect(bankCell(1)).not.toBe(first))
    expect(bankCell(1)).toMatch(/^\$1\d{2},\d{3}\.\d{2}$/)
    expect(server.requests.some((request) => request.method === 'PUT')).toBe(false)

    await user.clear(screen.getByLabelText('Duration'))
    await waitFor(() => expect(bankCell(1)).toBe('Not yet calculated'))

    await user.type(screen.getByLabelText('Duration'), '24')
    await waitFor(() => expect(bankCell(1)).toMatch(/^\$/))
    expect(within(timeline()).getByRole('table')).toHaveAttribute('aria-rowcount', '25')

    // An invalid Name alone keeps the values.
    await user.clear(screen.getByLabelText('Name'))
    expect(bankCell(1)).toMatch(/^\$/)
  })

  it('shows values for a valid unsaved form', async () => {
    installFakeApi([], 'Schedule')
    const user = userEvent.setup()
    renderWithProviders(<MortgagesPage userId="user-1" />)

    await screen.findByRole('heading', { name: 'Details' })
    await fillForm(user, { balance: '120000', periods: '12', first: '2000-01-01', frequency: 'Monthly', rates: [['0', '2000-01-01']] })

    await waitFor(() => expect(bankCell(1)).toBe('$110,000.00'))
  })

  it('updates the values when a rate change is added, edited and removed, without saving', async () => {
    const server = installFakeApi([makeMortgage({ name: 'Home', openingBalance: 100000, duration: 12 })], 'Schedule')
    const user = userEvent.setup()
    renderWithProviders(<MortgagesPage userId="user-1" />)
    await screen.findByRole('table')
    await waitFor(() => expect(bankCell(12)).toBe('$0.00'))
    const before = bankCell(8)

    await addRates(user, [['9', '2000-04-01']])
    await waitFor(() => expect(bankCell(8)).not.toBe(before))
    expect(bankCell(12)).toBe('$0.00')
    expect(server.requests.some((request) => request.method === 'PUT')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Interest Rates' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^Remove 9/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(bankCell(8)).toBe(before))
  })
})

describe('MortgagesPage Actual Balance line', () => {
  const accountA = { id: '11111111-1111-4111-8111-111111111111', description: 'Offset A', currencyCode: 'AUD' }
  const accountB = { id: '22222222-2222-4222-8222-222222222222', description: 'Offset B', currencyCode: 'AUD' }
  const chart = () => within(timeline()).getByRole('img', { name: /balance over time/i })
  const actualLine = () => chart().querySelector('path[data-series="actual"][data-part="line"]')
  const lastActualY = () => Number((actualLine()?.getAttribute('d') ?? '').trim().split(' ').at(-1)?.split(',')[1])

  beforeEach(() => {
    vi.resetAllMocks()
  })

  async function renderWithAccount() {
    const server = installFakeApi([makeMortgage({ name: 'Home', openingBalance: 100000, duration: 12, accountId: accountA.id })])
    server.accounts = [accountA, accountB]
    server.balances = { currencyCode: 'AUD', periodCount: 12, balances: ['90000.00', '80000.00'] }
    const { queryClient } = renderWithProviders(<MortgagesPage userId="user-1" />)
    await waitFor(() => expect(actualLine()).not.toBeNull())
    return { server, queryClient }
  }

  it('redraws for another account and removes the line and legend entry for None', async () => {
    const { server } = await renderWithAccount()
    const user = userEvent.setup()
    const before = actualLine()?.getAttribute('d')

    server.balances = { currencyCode: 'AUD', periodCount: 12, balances: ['70000.00', '60000.00'] }
    await user.selectOptions(screen.getByLabelText('Mortgage Account'), accountB.id)
    await waitFor(() => expect(actualLine()?.getAttribute('d')).not.toBe(before))

    await user.selectOptions(screen.getByLabelText('Mortgage Account'), '')
    await waitFor(() => expect(actualLine()).toBeNull())
    expect(chart()).not.toHaveTextContent('Actual Balance')
  })

  it('updates the line without a reload when the period balances are invalidated', async () => {
    const { server, queryClient } = await renderWithAccount()
    const before = lastActualY()

    server.balances = { currencyCode: 'AUD', periodCount: 12, balances: ['90000.00', '50000.00'] }
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: periodBalancesQueryKey })
    })

    await waitFor(() => expect(lastActualY()).not.toBe(before))
  })

  it('redraws both lines when a Detail is edited', async () => {
    await renderWithAccount()
    const user = userEvent.setup()
    const bank = () => chart().querySelector('path[data-series="schedule"][data-part="line"]')?.getAttribute('d')
    const before = bank()
    const actualBefore = actualLine()?.getAttribute('d')

    await user.clear(screen.getByLabelText('Opening Balance'))
    await user.type(screen.getByLabelText('Opening Balance'), '200000')

    await waitFor(() => expect(bank()).not.toBe(before))
    await waitFor(() => expect(actualLine()?.getAttribute('d')).not.toBe(actualBefore))
  })
})
