import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/lib/api/client'
import { AmortizationSchedule, BALANCES_FAILED_MESSAGE, ENTER_DETAILS_MESSAGE } from './AmortizationSchedule'
import { installFakeApi, problem, renderWithProviders, type FakeServer } from './testSupport'

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiRequest: vi.fn(),
}))

describe('AmortizationSchedule with a Mortgage Account', () => {
  const account = { id: '11111111-1111-4111-8111-111111111111', description: 'Offset Account', currencyCode: 'AUD' }
  const saved = { disbursalDate: '2026-01-01', paymentFrequency: 'Monthly' as const }
  let server: FakeServer

  beforeEach(() => {
    vi.resetAllMocks()
    server = installFakeApi([])
    server.accounts = [account]
  })

  it('adds a balance column right of Bank Schedule headed with the account description', async () => {
    server.balances = { currencyCode: 'AUD', periodCount: 4, balances: [null, '1000.50', '980.00'] }
    renderWithProviders(<AmortizationSchedule accountId={account.id} duration={3} {...saved} />)

    expect(await screen.findByRole('columnheader', { name: 'Offset Account Balance' })).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent))
      .toEqual(['Period', 'Date', 'Bank Schedule', 'Offset Account Balance'])
    await waitFor(() => expect(within(table).getAllByRole('row')[2]).toHaveTextContent('$1,000.50'))
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(4)
    expect(within(rows[0] as HTMLElement).getAllByRole('cell')[3]).toHaveTextContent('')
    expect(within(rows[2] as HTMLElement).getAllByRole('cell')[3]).toHaveTextContent('$980.00')
    expect(within(rows[3] as HTMLElement).getAllByRole('cell')[3]).toHaveTextContent('')
    expect(table.querySelectorAll('input, select, textarea')).toHaveLength(0)
  })

  it('sends all three of disbursal date, frequency and duration', async () => {
    renderWithProviders(<AmortizationSchedule accountId={account.id} duration={3} {...saved} />)

    await waitFor(() => expect(server.balanceRequests).toHaveLength(1))
    const params = new URLSearchParams(server.balanceRequests[0])
    expect(params.get('accountId')).toBe(account.id)
    expect(params.get('disbursalDate')).toBe('2026-01-01')
    expect(params.get('frequency')).toBe('Monthly')
    expect(params.get('duration')).toBe('3')
  })

  it('has no column and no balances request without an account', () => {
    renderWithProviders(<AmortizationSchedule duration={3} {...saved} />)

    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    expect(server.balanceRequests).toHaveLength(0)
  })

  it('treats an account missing from the list as none', async () => {
    renderWithProviders(
      <AmortizationSchedule accountId="99999999-9999-4999-8999-999999999999" duration={3} {...saved} />,
    )

    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalled())
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    expect(server.balanceRequests).toHaveLength(0)
  })

  it('shows a busy table while loading with no layout shift', async () => {
    const release = server.holdBalances()
    renderWithProviders(<AmortizationSchedule accountId={account.id} duration={3} {...saved} />)

    await waitFor(() => expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true'))
    expect(screen.getByRole('status')).toHaveTextContent('Loading account balances')
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '5')
    await act(async () => release())
    await waitFor(() => expect(screen.getByRole('table')).not.toHaveAttribute('aria-busy'))
  })

  it('shows a generic message and blank cells when balances fail to load', async () => {
    server.balancesError = problem(500, { detail: 'secret server detail' })
    renderWithProviders(<AmortizationSchedule accountId={account.id} duration={3} {...saved} />)

    expect(await screen.findByText(BALANCES_FAILED_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByText(/secret server detail/)).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '5')
  })

  it('shows monthly fallback rows with only Period and the balance filled when details are incomplete', async () => {
    server.balances = { currencyCode: 'AUD', periodCount: 2, balances: ['500.00', '400.00'] }
    renderWithProviders(<AmortizationSchedule accountId={account.id} />)

    const table = await screen.findByRole('table')
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(3))
    const params = new URLSearchParams(server.balanceRequests[0])
    expect([...params.keys()]).toEqual(['accountId'])
    const first = within(within(table).getAllByRole('row')[1] as HTMLElement).getAllByRole('cell')
    expect(first.map((cell) => cell.textContent)).toEqual(['1', '', '', '$500.00'])
    const second = within(within(table).getAllByRole('row')[2] as HTMLElement).getAllByRole('cell')
    expect(second.map((cell) => cell.textContent)).toEqual(['2', '', '', '$400.00'])
  })

  it('shows the enter-details prompt when the fallback has no balance-bearing transactions', async () => {
    server.balances = { currencyCode: 'AUD', periodCount: 0, balances: [] }
    renderWithProviders(<AmortizationSchedule accountId={account.id} />)

    expect(await screen.findByText(ENTER_DETAILS_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('switches from fallback rows to the mortgage periods once its details are saved', async () => {
    server.balances = { currencyCode: 'AUD', periodCount: 1, balances: ['500.00'] }
    function Harness() {
      const [isSaved, setSaved] = useState(false)
      return (
        <>
          <button onClick={() => setSaved(true)} type="button">Save details</button>
          {isSaved
            ? <AmortizationSchedule accountId={account.id} duration={3} {...saved} />
            : <AmortizationSchedule accountId={account.id} />}
        </>
      )
    }
    renderWithProviders(<Harness />)
    await waitFor(() => expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '2'))

    server.balances = { currencyCode: 'AUD', periodCount: 4, balances: [null, '1.00'] }
    await userEvent.click(screen.getByRole('button', { name: 'Save details' }))

    await waitFor(() => expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '5'))
    expect(within(screen.getByRole('table')).getAllByRole('row')[1]).toHaveTextContent('Not yet calculated')
  })
})
