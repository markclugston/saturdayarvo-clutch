import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CurrentInterestRate } from './CurrentInterestRate'
import { emptyDraft, newRow, type DraftErrors, type LoanDraft, type RateRowDraft } from './loanDraft'
import { listedRates } from './testSupport'

const today = '2025-06-15'

function makeDraft(rows: RateRowDraft[], patch: Partial<LoanDraft> = {}): LoanDraft {
  return {
    ...emptyDraft(),
    name: 'Home',
    openingBalance: '500000',
    duration: '120',
    drawdownDate: '2000-01-01',
    paymentFrequency: 'Monthly',
    rows,
    ...patch,
  }
}

type HarnessProps = { initial: LoanDraft; errors?: DraftErrors; saving?: boolean; onRows?: (rows: RateRowDraft[]) => void }

function Harness({ initial, errors = {}, saving = false, onRows }: HarnessProps) {
  const [draft, setDraft] = useState(initial)
  return (
    <>
      <button type="button">Before</button>
      <CurrentInterestRate
        draft={draft}
        errors={errors}
        onRowsChange={(rows) => {
          setDraft((current) => ({ ...current, rows }))
          onRows?.(rows)
        }}
        saving={saving}
        today={today}
      />
    </>
  )
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Change Interest Rate' }))
  return screen.findByRole('dialog', { name: 'Change Interest Rate' })
}

function addTo(dialog: HTMLElement, rate: string, date: string, user: ReturnType<typeof userEvent.setup>) {
  return (async () => {
    await user.type(within(dialog).getByLabelText('New Interest Rate'), rate)
    fireEvent.change(within(dialog).getByLabelText('Effective Date'), { target: { value: date } })
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
  })()
}

const opening = () => newRow('5.25', '2000-01-01')

describe('InterestRateChangesDialog', () => {
  it('opens titled "Change Interest Rate" with focus on New Interest Rate and no Save or Cancel', async () => {
    const user = userEvent.setup()
    render(<Harness initial={makeDraft([opening()])} />)
    const dialog = await openDialog(user)

    await waitFor(() => expect(within(dialog).getByLabelText('New Interest Rate')).toHaveFocus())
    expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Effective Date')).toHaveAttribute('type', 'date')
  })

  it('lists changes in Effective Date order and marks the opening rate in text', async () => {
    const user = userEvent.setup()
    render(<Harness initial={makeDraft([newRow('7', '2003-01-01'), opening(), newRow('6', '2001-06-01')])} />)
    const dialog = await openDialog(user)

    expect(listedRates()).toEqual(['5.25% 1 Jan 2000', '6.00% 1 Jun 2001', '7.00% 1 Jan 2003'])
    const items = within(within(dialog).getByRole('list', { name: 'Interest Rate Changes' })).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Opening Rate')
    expect(items[1]).not.toHaveTextContent('Opening Rate')
  })

  it('shows "No interest rate changes yet" when empty', async () => {
    const user = userEvent.setup()
    render(<Harness initial={makeDraft([])} />)
    const dialog = await openDialog(user)

    expect(within(dialog).getByText('No interest rate changes yet')).toBeInTheDocument()
    expect(within(dialog).queryByRole('list')).not.toBeInTheDocument()
  })

  it('adds a valid change in date order, clears the inputs and refocuses New Interest Rate', async () => {
    const user = userEvent.setup()
    render(<Harness initial={makeDraft([opening(), newRow('7', '2003-01-01')])} />)
    const dialog = await openDialog(user)

    await addTo(dialog, '6', '2001-06-01', user)

    expect(listedRates()).toEqual(['5.25% 1 Jan 2000', '6.00% 1 Jun 2001', '7.00% 1 Jan 2003'])
    expect(within(dialog).getByLabelText('New Interest Rate')).toHaveValue('')
    expect(within(dialog).getByLabelText('Effective Date')).toHaveValue('')
    expect(within(dialog).getByLabelText('New Interest Rate')).toHaveFocus()
    expect(screen.getByText('7.00%', { selector: 'dd' })).toBeInTheDocument()
  })

  it.each([
    ['duplicate date', '6', '2000-01-01', 'Effective Date', 'This effective date is already used'],
    ['rate above 100', '100.5', '2001-01-01', 'New Interest Rate', 'Enter an interest rate from 0 to 100'],
    ['date out of range', '6', '2010-01-01', 'Effective Date', 'Choose a date from 1 Jan 2000 to 1 Dec 2009'],
  ])('refuses an invalid add (%s) with the field flagged and nothing added', async (_label, rate, date, field, message) => {
    const user = userEvent.setup()
    const rowsSeen: RateRowDraft[][] = []
    render(<Harness initial={makeDraft([opening()])} onRows={(rows) => rowsSeen.push(rows)} />)
    const dialog = await openDialog(user)

    await addTo(dialog, rate, date, user)

    const input = within(dialog).getByLabelText(field)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(message)
    expect(rowsSeen).toHaveLength(0)
    expect(listedRates()).toEqual(['5.25% 1 Jan 2000'])
  })

  it('disables adding with the header hint until the header is valid; removing stays available', async () => {
    const user = userEvent.setup()
    render(<Harness initial={makeDraft([opening()], { duration: '' })} />)
    const dialog = await openDialog(user)

    const add = within(dialog).getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()
    expect(add).toHaveAccessibleDescription('Enter the drawdown date, duration and payment frequency first')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus())
    expect(within(dialog).getByRole('button', { name: 'Remove 5.25% from 1 Jan 2000' })).toBeEnabled()
  })

  it('disables adding at 60 changes with the limit hint; removing stays available', async () => {
    const user = userEvent.setup()
    const rows = Array.from({ length: 60 }, (_, index) =>
      newRow('5', `2000-${String((index % 12) + 1).padStart(2, '0')}-0${Math.floor(index / 12) + 1}`))
    render(<Harness initial={makeDraft(rows)} />)
    const dialog = await openDialog(user)

    const add = within(dialog).getByRole('button', { name: 'Add' })
    expect(add).toBeDisabled()
    expect(add).toHaveAccessibleDescription('You can add up to 60 interest rate changes')
    expect(within(dialog).getAllByRole('button', { name: /^Remove / })[0]).toBeEnabled()
  })

  it('removes a change by its named control, focuses the dialog, and the next Tab reaches Close', async () => {
    const user = userEvent.setup()
    render(<Harness initial={makeDraft([opening(), newRow('6', '2001-06-01')])} />)
    const dialog = await openDialog(user)

    await user.click(within(dialog).getByRole('button', { name: 'Remove 6.00% from 1 Jun 2001' }))

    expect(listedRates()).toEqual(['5.25% 1 Jan 2000'])
    expect(dialog).toHaveFocus()
    await user.tab()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('traps focus: Tab from the last control wraps to the first and Shift+Tab from the first wraps to the last', async () => {
    const user = userEvent.setup()
    render(<Harness initial={makeDraft([opening()])} />)
    const dialog = await openDialog(user)
    const close = within(dialog).getByRole('button', { name: 'Close' })
    const last = within(dialog).getByRole('button', { name: 'Remove 5.25% from 1 Jan 2000' })

    last.focus()
    await user.tab()
    await waitFor(() => expect(close).toHaveFocus())
    await user.tab({ shift: true })
    await waitFor(() => expect(last).toHaveFocus())
  })

  it.each(['Escape', 'Close'])('%s closes it and returns focus to Change Interest Rate', async (how) => {
    const user = userEvent.setup()
    render(<Harness initial={makeDraft([opening()])} />)
    const dialog = await openDialog(user)

    if (how === 'Escape') {
      await user.keyboard('{Escape}')
    } else {
      await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    }

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change Interest Rate' })).toHaveFocus())
  })

  it('discards typed values that were not added and opens with empty inputs', async () => {
    const user = userEvent.setup()
    const rowsSeen: RateRowDraft[][] = []
    render(<Harness initial={makeDraft([opening()])} onRows={(rows) => rowsSeen.push(rows)} />)
    let dialog = await openDialog(user)
    await user.type(within(dialog).getByLabelText('New Interest Rate'), '7')
    fireEvent.change(within(dialog).getByLabelText('Effective Date'), { target: { value: '2001-01-01' } })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    dialog = await openDialog(user)
    expect(within(dialog).getByLabelText('New Interest Rate')).toHaveValue('')
    expect(within(dialog).getByLabelText('Effective Date')).toHaveValue('')
    expect(rowsSeen).toHaveLength(0)
  })

  it('disables the button while saving', () => {
    render(<Harness initial={makeDraft([opening()])} saving />)
    expect(screen.getByRole('button', { name: 'Change Interest Rate' })).toBeDisabled()
  })

  describe('errors after a refused save', () => {
    it('shows row errors under their row and the set-level message above the list as an alert', async () => {
      const user = userEvent.setup()
      const bad = newRow('6', '2001-06-01')
      const errors = {
        [`${bad.key}.effectiveDate`]: 'This effective date is already used',
        [`${bad.key}.newInterestRate`]: 'Enter an interest rate from 0 to 100',
        interestRateChanges: 'Add the opening interest rate, effective on the drawdown date',
      }
      render(<Harness errors={errors} initial={makeDraft([bad, newRow('7', '2002-01-01')])} />)
      const dialog = await openDialog(user)

      expect(within(dialog).getByRole('alert')).toHaveTextContent('Add the opening interest rate, effective on the drawdown date')
      const [first, second] = within(within(dialog).getByRole('list')).getAllByRole('listitem')
      expect(first).toHaveTextContent('This effective date is already used')
      expect(first).toHaveTextContent('Enter an interest rate from 0 to 100')
      expect(second).not.toHaveTextContent('already used')
    })

    it('drops a removed row\'s errors and keeps the set-level message after the problem is fixed until the next Save', async () => {
      const user = userEvent.setup()
      const bad = newRow('6', '2001-06-01')
      const errors = {
        [`${bad.key}.effectiveDate`]: 'This effective date is already used',
        interestRateChanges: 'Add the opening interest rate, effective on the drawdown date',
      }
      render(<Harness errors={errors} initial={makeDraft([bad])} />)
      const dialog = await openDialog(user)

      await user.click(within(dialog).getByRole('button', { name: 'Remove 6.00% from 1 Jun 2001' }))
      expect(within(dialog).queryByText('This effective date is already used')).not.toBeInTheDocument()

      await addTo(dialog, '5.25', '2000-01-01', user)
      expect(listedRates()).toEqual(['5.25% 1 Jan 2000'])
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Add the opening interest rate')
    })
  })
})
