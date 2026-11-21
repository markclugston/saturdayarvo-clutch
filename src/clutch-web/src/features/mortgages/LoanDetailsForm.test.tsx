import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mortgage } from '@/lib/api/schemas'
import { LoanDetailsForm } from './LoanDetailsForm'
import {
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

describe('LoanDetailsForm (new mortgage)', () => {
  let server: FakeServer

  beforeEach(() => {
    vi.resetAllMocks()
    server = installFakeApi([])
  })

  it('uses floating labels and native date inputs, and a Repayment Frequency select', () => {
    renderForm()

    for (const label of ['Name', 'Starting Balance', 'Number of Periods', 'First Repayment Date', 'Repayment Frequency']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText('First Repayment Date')).toHaveAttribute('type', 'date')
    expect(within(screen.getByLabelText('Repayment Frequency')).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Choose…', 'Weekly', 'Fortnightly', 'Monthly'])
    expect(screen.getByRole('heading', { name: 'Loan Details' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument()
  })

  describe('interest rate changes', () => {
    it('disables Add interest rate change with a hint until date, periods and frequency are valid', async () => {
      const user = userEvent.setup()
      renderForm()
      const add = screen.getByRole('button', { name: 'Add interest rate change' })

      expect(add).toBeDisabled()
      expect(add).toHaveAccessibleDescription('Enter the first repayment date, number of periods and repayment frequency first')

      await fillForm(user, { periods: '12', first: '2000-01-01' })
      expect(add).toBeDisabled()
      await fillForm(user, { frequency: 'Monthly' })
      expect(add).toBeEnabled()
    })

    it('adds Effective Date rows as native date inputs, removes them, and caps at 60', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, { periods: '120', first: '2000-01-01', frequency: 'Monthly' })
      const add = screen.getByRole('button', { name: 'Add interest rate change' })

      await user.click(add)
      expect(screen.getByLabelText('Effective Date')).toHaveAttribute('type', 'date')
      await user.click(screen.getByRole('button', { name: 'Remove interest rate change 1' }))
      expect(screen.queryByLabelText('Effective Date')).not.toBeInTheDocument()

      for (let index = 0; index < 60; index += 1) {
        fireEvent.click(add)
      }
      expect(screen.getAllByLabelText('New Interest Rate')).toHaveLength(60)
      expect(add).toBeDisabled()
    }, 30_000)

    it('keeps rows when a header field is cleared, disables add and refuses Save with errors on those fields only', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, validValues)
      await user.clear(screen.getByLabelText('Number of Periods'))

      expect(screen.getByLabelText('New Interest Rate')).toHaveValue('5.25%')
      expect(screen.getByRole('button', { name: 'Add interest rate change' })).toBeDisabled()
      await submit(user)

      expect(screen.getByLabelText('Number of Periods')).toHaveAccessibleDescription('Enter a whole number of 1 or more')
      expect(screen.getByLabelText('New Interest Rate')).not.toHaveAttribute('aria-invalid')
      expect(server.requests.filter((request) => request.method === 'POST')).toHaveLength(0)
    })

    it('drops completely empty rows when sending and flags partly filled rows', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, { ...validValues, rates: [['5.25', '2000-01-01']] })
      await user.click(screen.getByRole('button', { name: 'Add interest rate change' }))
      await submit(user)

      await waitFor(() => expect(server.requests.some((request) => request.method === 'POST')).toBe(true))
      expect((server.requests.find((request) => request.method === 'POST')?.body as { interestRateChanges: unknown[] })
        .interestRateChanges).toHaveLength(1)
    })

    it('flags a partly filled row under its missing field', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, { ...validValues, rates: [['5.25', '2000-01-01']] })
      await user.click(screen.getByRole('button', { name: 'Add interest rate change' }))
      await user.type(screen.getAllByLabelText('New Interest Rate')[1] as HTMLElement, '6')
      await submit(user)

      expect(screen.getAllByLabelText('Effective Date')[1]).toHaveAccessibleDescription('Enter a valid date')
    })
  })

  describe('on-screen checks (same messages and first-row-wins order as the API)', () => {
    type Case = [string, FormValues, string, string]
    const cases: Case[] = [
      ['name blank', { name: ' ' }, 'Name', 'Enter a name'],
      ['name too long', { name: 'a'.repeat(101) }, 'Name', 'Enter a name of up to 100 characters'],
      ['balance zero', { balance: '0' }, 'Starting Balance', 'Enter a starting balance greater than 0'],
      ['balance negative', { balance: '-5' }, 'Starting Balance', 'Enter a starting balance greater than 0'],
      ['balance too large', { balance: '1000000000000' }, 'Starting Balance', 'Enter a starting balance up to 999,999,999,999.99'],
      ['balance 3 decimals', { balance: '10.005' }, 'Starting Balance', 'Enter a starting balance with up to 2 decimal places'],
      ['periods fractional', { periods: '1.5' }, 'Number of Periods', 'Enter a whole number of 1 or more'],
      ['periods zero', { periods: '0' }, 'Number of Periods', 'Enter a whole number of 1 or more'],
      ['periods negative', { periods: '-1' }, 'Number of Periods', 'Enter a whole number of 1 or more'],
      ['periods past 9999', { periods: '3000000000' }, 'Number of Periods', 'The final repayment date would be later than 31 Dec 9999'],
      ['frequency not chosen', { frequency: '' }, 'Repayment Frequency', 'Choose Weekly, Fortnightly or Monthly'],
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

    it('flags a missing or future First Repayment Date before any request is sent', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, validValues)
      setDate('First Repayment Date', '')
      await submit(user)
      expect(screen.getByLabelText('First Repayment Date')).toHaveAccessibleDescription('Enter a valid date')

      const future = new Date()
      future.setDate(future.getDate() + 2)
      const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`
      setDate('First Repayment Date', iso)
      await submit(user)
      expect(screen.getByLabelText('First Repayment Date')).toHaveAccessibleDescription('Enter a date that is not in the future')
      expect(server.requests.filter((request) => request.method === 'POST')).toHaveLength(0)
    })

    it('flags an Effective Date outside the range with the formatted first and final dates', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, { ...validValues, rates: [['5', '2000-01-01'], ['6', '2030-01-01']] })
      await submit(user)

      expect(screen.getAllByLabelText('Effective Date')[1])
        .toHaveAccessibleDescription('Choose a date from 1 Jan 2000 to 1 Dec 2029')
    })

    it('flags every row sharing a date and a missing opening rate', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, { ...validValues, rates: [['6', '2000-02-01'], ['7', '2000-02-01']] })
      await submit(user)

      const dates = screen.getAllByLabelText('Effective Date')
      expect(dates[0]).toHaveAccessibleDescription('This effective date is already used')
      expect(dates[1]).toHaveAccessibleDescription('This effective date is already used')
      expect(screen.getByRole('alert')).toHaveTextContent('Add the opening interest rate, effective on the first repayment date')
    })

    it('flags unreadable, out of range and 3-decimal interest rates', async () => {
      const user = userEvent.setup()
      renderForm()
      await fillForm(user, {
        ...validValues,
        rates: [['101', '2000-02-01'], ['5.005', '2000-03-01'], ['', '2000-04-01']],
      })
      await submit(user)

      const rates = screen.getAllByLabelText('New Interest Rate')
      expect(rates[0]).toHaveAccessibleDescription('Enter an interest rate from 0 to 100')
      expect(rates[1]).toHaveAccessibleDescription('Enter an interest rate with up to 2 decimal places')
      expect(rates[2]).toHaveAccessibleDescription('Enter an interest rate')
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
          startingBalance: ['Enter a starting balance greater than 0'],
          mortgages: ['You can save up to 20 mortgages'],
          'interestRateChanges[0].effectiveDate': ['Enter a valid date'],
        },
      }))
      await fillForm(user, validValues)
      await submit(user)

      expect(await screen.findByLabelText('Starting Balance')).toHaveAccessibleDescription('Enter a starting balance greater than 0')
      expect(screen.getByLabelText('Effective Date')).toHaveAccessibleDescription('Enter a valid date')
      expect(screen.getByRole('alert')).toHaveTextContent('You can save up to 20 mortgages')
      expect(screen.getByLabelText('Name')).toHaveValue('Home loan')
    })

    it('shows set-level interestRateChanges errors under the group and in the summary', async () => {
      const user = userEvent.setup()
      renderForm()
      server.failNext('POST', problem(400, {
        errors: { interestRateChanges: ['Add the opening interest rate, effective on the first repayment date'] },
      }))
      await fillForm(user, validValues)
      await submit(user)

      const group = await screen.findByRole('group', { name: 'Interest Rate Changes' })
      expect(within(group).getByText('Add the opening interest rate, effective on the first repayment date')).toBeInTheDocument()
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
    expect(screen.getByLabelText('Starting Balance')).toHaveValue('$500,000.00')
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

  it('Cancel restores the saved values after edits', async () => {
    const mortgage = makeMortgage({ name: 'Car' })
    installFakeApi([mortgage])
    const user = userEvent.setup()
    renderForm({ mortgage })
    await user.type(screen.getByLabelText('Name'), ' edited')
    await user.click(screen.getByRole('button', { name: 'Remove interest rate change 1' }))

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Car')
    expect(screen.getByLabelText('New Interest Rate')).toHaveValue('5.25%')
  })
})
