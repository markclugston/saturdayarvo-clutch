import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mortgage } from '@/lib/api/schemas'
import { LoanDetailsForm } from './LoanDetailsForm'
import {
  addRates,
  fillForm,
  installFakeApi,
  makeMortgage,
  problem,
  renderWithProviders,
  setDate,
  validValues,
  type FakeServer,
  type FormValues,
} from './testSupport'

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiRequest: vi.fn(),
}))

type Handlers = {
  mortgage?: Mortgage
  onSaved?: (mortgage: Mortgage, created: boolean) => void
  onGone?: () => void
  onUnauthorized?: () => void
  onReload?: () => Promise<Mortgage | null>
}

function renderForm(handlers: Handlers = {}) {
  return renderWithProviders(
    <LoanDetailsForm
      mortgage={handlers.mortgage}
      onDeleted={() => {}}
      onGone={handlers.onGone ?? (() => {})}
      onReload={handlers.onReload ?? (async () => null)}
      onReloadAll={async () => {}}
      onSaved={handlers.onSaved ?? (() => {})}
      onUnauthorized={handlers.onUnauthorized ?? (() => {})}
    />,
  )
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Save' }))
}

function currentRate(): string {
  const term = screen.getByText('Current Interest Rate', { selector: 'dt' })
  return term.nextElementSibling?.textContent ?? ''
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Change Interest Rate' }))
  return screen.findByRole('dialog', { name: 'Change Interest Rate' })
}

async function closeDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('LoanDetailsForm (new mortgage)', () => {
  let server: FakeServer

  beforeEach(() => {
    vi.resetAllMocks()
    server = installFakeApi([])
  })

  it('uses floating labels and native date inputs, and a Payment Frequency select', () => {
    renderForm()

    for (const label of ['Name', 'Opening Balance', 'Drawdown Date', 'Duration', 'Payment Frequency']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('Drawdown Date')).toHaveAttribute('type', 'date')
    expect(within(screen.getByLabelText('Payment Frequency')).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Choose…', 'Weekly', 'Fortnightly', 'Monthly'])
    expect(screen.getByRole('heading', { name: 'Details' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
  })

  describe('current interest rate', () => {
    it('shows "Not set" and a neutral "Change Interest Rate" button with no rate rows', () => {
      renderForm()

      expect(currentRate()).toBe('Not set')
      const button = screen.getByRole('button', { name: 'Change Interest Rate' })
      expect(button.className).toContain('bg-raised')
      expect(button.className).not.toMatch(/primary|secondary/)
      expect(screen.queryByLabelText('New Interest Rate')).not.toBeInTheDocument()
    })

    it('disables Change Interest Rate while saving', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, validValues)
      const release = server.hold('POST')

      await submit(user)
      expect(screen.getByRole('button', { name: 'Change Interest Rate' })).toBeDisabled()
      await act(async () => release())
    })
  })
  describe('on-screen checks (same messages and first-row-wins order as the API)', () => {
    type Case = [string, FormValues, string, string]
    const cases: Case[] = [
      ['name blank', { name: ' ' }, 'Name', 'Enter a name'],
      ['name too long', { name: 'a'.repeat(101) }, 'Name', 'Enter a name of up to 100 characters'],
      ['balance zero', { balance: '0' }, 'Opening Balance', 'Enter a opening balance greater than 0'],
      ['balance too large', { balance: '1000000000000' }, 'Opening Balance', 'Enter a opening balance up to 999,999,999,999.99'],
      ['periods fractional', { periods: '1.5' }, 'Duration', 'Enter a whole number of 1 or more'],
      ['periods zero', { periods: '0' }, 'Duration', 'Enter a whole number of 1 or more'],
      ['periods negative', { periods: '-1' }, 'Duration', 'Enter a whole number of 1 or more'],
      ['periods past 9999', { periods: '3000000000' }, 'Duration', 'The final repayment date would be later than 31 Dec 9999'],
      ['frequency not chosen', { frequency: '' }, 'Payment Frequency', 'Choose Weekly, Fortnightly or Monthly'],
    ]

    it.each(cases)('%s', async (_label, patch, field, message) => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, validValues)
      await fillForm(user, patch)
      await submit(user)

      expect(screen.getByLabelText(field)).toHaveAccessibleDescription(message)
      expect(screen.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true')
      expect(server.requests.filter((request) => request.method === 'POST')).toHaveLength(0)
    })

    it('flags a missing or future Drawdown Date before any request is sent', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, validValues)
      setDate('Drawdown Date', '')
      await submit(user)
      expect(screen.getByLabelText('Drawdown Date')).toHaveAccessibleDescription('Enter a valid date')

      const future = new Date()
      future.setDate(future.getDate() + 2)
      const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`
      setDate('Drawdown Date', iso)
      await submit(user)
      expect(screen.getByLabelText('Drawdown Date')).toHaveAccessibleDescription('Enter a date that is not in the future')
      expect(server.requests.filter((request) => request.method === 'POST')).toHaveLength(0)
    })

    it('sends a duplicate name and shows the server message under Name', async () => {
      const user = userEvent.setup()
      renderForm()
      server.failNext('POST', problem(400, { errors: { name: ['A mortgage with this name already exists'] } }))
      await fillForm(user, validValues)
      await submit(user)

      expect(await screen.findByText('A mortgage with this name already exists')).toBeInTheDocument()
      expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
      expect(server.requests.filter((request) => request.method === 'POST')).toHaveLength(1)
    })
  })

  describe('saving', () => {
    it('shows Saving… and disables Save at once, then reports the saved mortgage', async () => {
      const onSaved = vi.fn()
      const user = userEvent.setup()
      renderForm({ onSaved })
      await fillForm(user, validValues)
      const release = server.hold('POST')

      await submit(user)
      expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
      await act(async () => release())

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
      expect(onSaved.mock.calls[0]?.[1]).toBe(true)
    })

    it('shows server field errors with aria-invalid, aria-describedby and an alert summary, keeping values', async () => {
      const user = userEvent.setup()
      renderForm()
      server.failNext('POST', problem(400, {
        errors: {
          openingBalance: ['Enter a opening balance greater than 0'],
          mortgages: ['You can save up to 20 mortgages'],
          'interestRateChanges[0].effectiveDate': ['Enter a valid date'],
        },
      }))
      await fillForm(user, validValues)
      await submit(user)

      expect(await screen.findByLabelText('Opening Balance')).toHaveAccessibleDescription('Enter a opening balance greater than 0')
      const summary = screen.getByRole('alert')
      expect(summary).toHaveTextContent('You can save up to 20 mortgages')
      expect(summary).toHaveTextContent('Correct the highlighted fields and try again.')
      expect(screen.getByLabelText('Name')).toHaveValue('Home loan')
      const dialog = await openDialog(user)
      expect(within(dialog).getByRole('listitem')).toHaveTextContent('Enter a valid date')
    })

    it('shows server row errors in the dialog and points the summary at Change Interest Rate', async () => {
      const user = userEvent.setup()
      renderForm()
      server.failNext('POST', problem(400, {
        errors: { 'interestRateChanges[0].newInterestRate': ['Enter an interest rate from 0 to 100'] },
      }))
      await fillForm(user, validValues)
      await submit(user)

      const summary = await screen.findByRole('alert')
      expect(summary).toHaveTextContent('Correct the interest rate changes in Change Interest Rate and try again.')
      expect(summary).not.toHaveTextContent('Correct the highlighted fields')
      const dialog = await openDialog(user)
      expect(within(dialog).getByRole('listitem')).toHaveTextContent('Enter an interest rate from 0 to 100')
    })

    it('shows a set-level interestRateChanges error in the dialog and the summary, with no "Correct" line', async () => {
      const user = userEvent.setup()
      renderForm()
      server.failNext('POST', problem(400, {
        errors: { interestRateChanges: ['Add the opening interest rate, effective on the drawdown date'] },
      }))
      await fillForm(user, validValues)
      await submit(user)

      const summary = await screen.findByRole('alert')
      expect(summary).toHaveTextContent('Add the opening interest rate, effective on the drawdown date')
      expect(summary).not.toHaveTextContent('Correct')
      const dialog = await openDialog(user)
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Add the opening interest rate, effective on the drawdown date')
    })
    it.each([
      ['500', problem(500)],
      ['413', problem(413)],
      ['network failure', new TypeError('Failed to fetch')],
    ])('a %s shows a generic alert, keeps values and shows no details', async (_label, error) => {
      const user = userEvent.setup()
      renderForm()
      server.failNext('POST', error)
      await fillForm(user, validValues)
      await submit(user)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('The mortgage could not be saved. Please try again.')
      expect(alert).not.toHaveTextContent('Failed to fetch')
      expect(screen.getByLabelText('Name')).toHaveValue('Home loan')
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    })

    it('Cancel clears a new form', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, validValues)

      await user.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.getByLabelText('Name')).toHaveValue('')
      expect(screen.queryByLabelText('New Interest Rate')).not.toBeInTheDocument()
    })
  })
})

describe('LoanDetailsForm (editing)', () => {
  it('shows the delete trash in the header for a saved mortgage only', () => {
    const { unmount } = renderForm({ mortgage: makeMortgage({ name: 'Home' }) })
    expect(screen.getByRole('button', { name: 'Delete Home' })).toBeInTheDocument()
    unmount()

    renderForm()
    expect(screen.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument()
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('loads the saved values and sends the version on save', async () => {
    const mortgage = makeMortgage({ name: 'Car', version: 3 })
    const server = installFakeApi([{ ...mortgage }])
    const onSaved = vi.fn()
    const user = userEvent.setup()
    renderForm({ mortgage, onSaved })

    expect(screen.getByLabelText('Name')).toHaveValue('Car')
    expect(screen.getByLabelText('Opening Balance')).toHaveValue('$500,000.00')
    await user.type(screen.getByLabelText('Name'), ' loan')
    await submit(user)

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(server.requests.find((request) => request.method === 'PUT')?.body).toMatchObject({ version: 3, name: 'Car loan' })
    expect(onSaved.mock.calls[0]?.[1]).toBe(false)
  })

  describe('background refetch', () => {
    function Refetching({ initial, newer }: { initial: Mortgage; newer: Mortgage }) {
      const [current, setCurrent] = useState(initial)
      return (
        <>
          <button onClick={() => setCurrent(newer)} type="button">Refetch</button>
          <LoanDetailsForm
            mortgage={current}
            onDeleted={() => {}}
            onGone={() => {}}
            onReload={async () => null}
            onReloadAll={async () => {}}
            onSaved={() => {}}
            onUnauthorized={() => {}}
          />
        </>
      )
    }

    it('never re-initialises a dirty form', async () => {
      const mortgage = makeMortgage({ name: 'Car' })
      installFakeApi([mortgage])
      const user = userEvent.setup()
      renderWithProviders(<Refetching initial={mortgage} newer={{ ...mortgage, name: 'Elsewhere', version: 2 }} />)
      await user.type(screen.getByLabelText('Name'), ' typed')

      await user.click(screen.getByRole('button', { name: 'Refetch' }))

      expect(screen.getByLabelText('Name')).toHaveValue('Car typed')
    })

    it('does update a clean form', async () => {
      const mortgage = makeMortgage({ name: 'Car' })
      installFakeApi([mortgage])
      const user = userEvent.setup()
      renderWithProviders(<Refetching initial={mortgage} newer={{ ...mortgage, name: 'Elsewhere', version: 2 }} />)

      await user.click(screen.getByRole('button', { name: 'Refetch' }))

      expect(screen.getByLabelText('Name')).toHaveValue('Elsewhere')
    })
  })

  it('a 409 shows the conflict alert with Reload; Reload replaces the values with the latest version', async () => {
    const mortgage = makeMortgage({ name: 'Car' })
    const server = installFakeApi([mortgage])
    server.failNext('PUT', problem(409, { type: '/problems/mortgage-changed' }))
    const latest = { ...mortgage, name: 'Latest', version: 2 }
    const onReload = vi.fn(async () => latest)
    const user = userEvent.setup()
    renderForm({ mortgage, onReload })
    await submit(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('This mortgage was changed elsewhere; reload to see the latest')
    await user.click(screen.getByRole('button', { name: 'Reload' }))

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Latest'))
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
  })

  it('Cancel restores the saved values after edits, including dialog edits', async () => {
    const mortgage = makeMortgage({ name: 'Car' })
    installFakeApi([mortgage])
    const user = userEvent.setup()
    renderForm({ mortgage })
    await user.type(screen.getByLabelText('Name'), ' edited')
    const dialog = await openDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Remove 5.25% from 1 Jan 2000' }))
    await closeDialog(user)
    expect(currentRate()).toBe('Not set')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Car')
    expect(currentRate()).toBe('5.25%')
  })

  describe('interest rate changes through the dialog', () => {
    const rates = [
      { newInterestRate: 5.25, effectiveDate: '2000-01-01' },
      { newInterestRate: 6, effectiveDate: '2001-01-01' },
      { newInterestRate: 7, effectiveDate: '2029-01-01' },
    ]

    it('shows the rate in force today, ignoring a future change', () => {
      renderForm({ mortgage: makeMortgage({ interestRateChanges: rates }) })
      expect(currentRate()).toBe('6.00%')
    })

    it.each([1, 60])('shows no rate rows in Details with %i change(s)', (count) => {
      const changes = Array.from({ length: count }, (_, index) => ({
        newInterestRate: 5,
        effectiveDate: `${2000 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`,
      }))
      renderForm({ mortgage: makeMortgage({ interestRateChanges: changes }) })

      expect(screen.queryByLabelText('New Interest Rate')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Effective Date')).not.toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Interest Rate Changes' })).not.toBeInTheDocument()
      expect(screen.queryAllByRole('button', { name: /^Remove / })).toHaveLength(0)
    })

    it('updates Current Interest Rate after a dialog add and remove, before Save', async () => {
      const mortgage = makeMortgage()
      const server = installFakeApi([mortgage])
      const user = userEvent.setup()
      renderForm({ mortgage })

      await addRates(user, [['6.5', '2010-01-01']])
      expect(currentRate()).toBe('6.50%')
      const dialog = await openDialog(user)
      await user.click(within(dialog).getByRole('button', { name: 'Remove 6.50% from 1 Jan 2010' }))
      await closeDialog(user)
      expect(currentRate()).toBe('5.25%')
      expect(server.requests.filter((request) => request.method === 'PUT')).toHaveLength(0)
    })

    it('Save sends the dialog edits', async () => {
      const mortgage = makeMortgage()
      const server = installFakeApi([mortgage])
      const onSaved = vi.fn()
      const user = userEvent.setup()
      renderForm({ mortgage, onSaved })

      await addRates(user, [['6', '2001-01-01']])
      await submit(user)

      await waitFor(() => expect(onSaved).toHaveBeenCalled())
      expect(server.requests.find((request) => request.method === 'PUT')?.body).toMatchObject({
        interestRateChanges: [
          { newInterestRate: 5.25, effectiveDate: '2000-01-01' },
          { newInterestRate: 6, effectiveDate: '2001-01-01' },
        ],
      })
    })

    it('a 409 after dialog edits shows the conflict alert and keeps the edits', async () => {
      const mortgage = makeMortgage()
      const server = installFakeApi([mortgage])
      server.failNext('PUT', problem(409, { type: '/problems/mortgage-changed' }))
      const user = userEvent.setup()
      renderForm({ mortgage })

      await addRates(user, [['6', '2001-01-01']])
      await submit(user)

      expect(await screen.findByRole('alert')).toHaveTextContent('This mortgage was changed elsewhere; reload to see the latest')
      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
      expect(currentRate()).toBe('6.00%')
    })

    it('removing the opening rate refuses Save and shows the message in the dialog, not beside Current Interest Rate', async () => {
      const mortgage = makeMortgage()
      const server = installFakeApi([mortgage])
      const user = userEvent.setup()
      renderForm({ mortgage })
      let dialog = await openDialog(user)
      await user.click(within(dialog).getByRole('button', { name: 'Remove 5.25% from 1 Jan 2000' }))
      await closeDialog(user)

      await submit(user)

      expect(server.requests.filter((request) => request.method === 'PUT')).toHaveLength(0)
      const summary = screen.getByRole('alert')
      expect(summary).toHaveTextContent('Add the opening interest rate, effective on the drawdown date')
      expect(summary).not.toHaveTextContent('Correct')
      const valueGroup = screen.getByRole('button', { name: 'Change Interest Rate' }).parentElement as HTMLElement
      expect(valueGroup).not.toHaveTextContent('Add the opening')
      dialog = await openDialog(user)
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Add the opening interest rate, effective on the drawdown date')
    })

    it('moving Drawdown Date after the rates refuses Save and flags the out-of-range row in the dialog', async () => {
      const mortgage = makeMortgage({ interestRateChanges: rates.slice(0, 2) })
      const server = installFakeApi([mortgage])
      const user = userEvent.setup()
      renderForm({ mortgage })
      setDate('Drawdown Date', '2000-06-01')

      await submit(user)

      expect(server.requests.filter((request) => request.method === 'PUT')).toHaveLength(0)
      expect(screen.getByRole('alert')).toHaveTextContent('Correct the interest rate changes in Change Interest Rate and try again.')
      const dialog = await openDialog(user)
      const [first, second] = within(within(dialog).getByRole('list')).getAllByRole('listitem')
      expect(first).toHaveTextContent('Choose a date from 1 Jun 2000 to 1 May 2030')
      expect(second).not.toHaveTextContent('Choose a date')
    })

    it('uses the generic summary line when another field is also invalid', async () => {
      const mortgage = makeMortgage({ interestRateChanges: rates.slice(0, 2) })
      installFakeApi([mortgage])
      const user = userEvent.setup()
      renderForm({ mortgage })
      setDate('Drawdown Date', '2000-06-01')
      await user.clear(screen.getByLabelText('Name'))

      await submit(user)

      const summary = screen.getByRole('alert')
      expect(summary).toHaveTextContent('Correct the highlighted fields and try again.')
      expect(summary).not.toHaveTextContent('Change Interest Rate')
    })
  })
})
