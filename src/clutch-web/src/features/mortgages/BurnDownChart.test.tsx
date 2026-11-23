import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/lib/api/client'
import type { PeriodBalances } from '@/lib/api/schemas'
import { BurnDownChart } from './BurnDownChart'
import { calculateSchedule } from './scheduleCalculation'
import { installFakeApi, renderWithProviders, type FakeServer } from './testSupport'

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiRequest: vi.fn(),
}))

describe('BurnDownChart', () => {
  it('has no card or heading of its own, a text-alternative image, labelled axes, the single legend entry and the message', () => {
    const { container } = render(<BurnDownChart saved />)

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(container.querySelector('section')).toBeNull()
    const chart = screen.getByRole('img')
    expect(chart).toHaveAccessibleName(/balance over time.*Bank schedule/i)
    expect(chart).toHaveTextContent('Balance ($)')
    expect(chart).toHaveTextContent('Repayment Date')
    expect(chart).toHaveTextContent('Bank Schedule')
    expect(chart).not.toHaveTextContent('Rapid')
    expect(screen.getByText('The burn down will appear once the schedule is calculated.')).toBeInTheDocument()
  })

  it('shows the prompt instead of the chart for a new mortgage', () => {
    render(<BurnDownChart saved={false} />)

    expect(screen.getByText('Please enter your mortgage details')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText(/burn down will appear/)).not.toBeInTheDocument()
  })
})

describe('BurnDownChart with a schedule', () => {
  const schedule = calculateSchedule({
    openingBalanceCents: 50000000,
    disbursalDate: '2023-11-29',
    duration: 360,
    paymentFrequency: 'Monthly',
    rateChanges: [{ annualRatePercent: 6, effectiveDate: '2023-11-29' }],
  }) ?? []

  function renderPlotted() {
    return render(<BurnDownChart disbursalDate="2023-11-29" openingBalanceCents={50000000} saved schedule={schedule} />)
  }

  it('draws one polyline with a point at the disbursal date and one per period', () => {
    renderPlotted()

    const lines = screen.getByRole('img').querySelectorAll('polyline')
    expect(lines).toHaveLength(1)
    const points = (lines[0]?.getAttribute('points') ?? '').split(' ').map((pair) => pair.split(',').map(Number))
    expect(points).toHaveLength(361)
    expect(points[0]).toEqual([70, 30])
    // Closing balance k plots at y = 260 - 230 * closing / $500,000.
    expect(points[1]?.[1]).toBeCloseTo(260 - (230 * 499502.25) / 500000, 5)
    expect(points[360]).toEqual([580, 260])
    expect(lines[0]).toHaveClass('text-chart-primary')
  })

  it('labels the Y axis in compact dollars, the X axis by year and the legend', () => {
    renderPlotted()

    const chart = screen.getByRole('img')
    for (const tick of ['$0', '$125K', '$250K', '$375K', '$500K', '2023', '2053']) {
      expect(chart).toHaveTextContent(tick)
    }
    expect(chart).toHaveTextContent('Bank Schedule')
  })

  it('describes the values in its text alternative and drops the not-calculated message', () => {
    renderPlotted()

    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Line chart of the mortgage balance over time for the Bank Schedule, falling from $500,000.00 on 29 Nov 2023 to $0.00 on 29 Nov 2053.',
    )
    expect(screen.queryByText('The burn down will appear once the schedule is calculated.')).not.toBeInTheDocument()
  })

  it('keeps the empty frame without a schedule', () => {
    render(<BurnDownChart saved />)

    expect(screen.getByRole('img').querySelector('polyline')).toBeNull()
    expect(screen.getByText('The burn down will appear once the schedule is calculated.')).toBeInTheDocument()
  })
})

describe('BurnDownChart with an Actual Balance', () => {
  const account = { id: '11111111-1111-4111-8111-111111111111', description: 'Offset Account', currencyCode: 'AUD' }
  const inputs = {
    openingBalanceCents: 50000000,
    disbursalDate: '2023-11-29',
    duration: 360,
    paymentFrequency: 'Monthly' as const,
    rateChanges: [{ annualRatePercent: 6, effectiveDate: '2023-11-29' }],
  }
  const schedule = calculateSchedule(inputs) ?? []
  let server: FakeServer

  beforeEach(() => {
    vi.resetAllMocks()
    server = installFakeApi([])
    server.accounts = [account]
  })

  function renderChart(accountId: string | undefined = account.id, plotted = true) {
    return renderWithProviders(
      <BurnDownChart
        accountId={accountId}
        disbursalDate={inputs.disbursalDate}
        duration={inputs.duration}
        openingBalanceCents={inputs.openingBalanceCents}
        paymentFrequency={inputs.paymentFrequency}
        saved
        schedule={plotted ? schedule : undefined}
      />,
    )
  }

  function setBalances(balances: PeriodBalances['balances']) {
    server.balances = { currencyCode: 'AUD', periodCount: 360, balances }
  }

  const svg = () => screen.getByRole('img')
  const lines = () => svg().querySelectorAll('polyline')
  const guides = () => svg().querySelectorAll('line.opacity-30')
  const parsePoints = (element: Element | undefined) =>
    (element?.getAttribute('points') ?? '').split(' ').map((pair) => pair.split(',').map(Number))

  it('draws no Actual Balance and keeps the 023 output without an account', async () => {
    const plain = render(
      <BurnDownChart disbursalDate={inputs.disbursalDate} openingBalanceCents={inputs.openingBalanceCents} saved schedule={schedule} />,
    )

    expect(lines()).toHaveLength(1)
    expect(svg().querySelector('circle')).toBeNull()
    expect(svg()).not.toHaveTextContent('Actual Balance')
    const group = svg().querySelector('g.text-chart-primary')
    expect(group?.querySelector('line')).toHaveAttribute('x1', '400')
    expect(svg()).toHaveAccessibleName(
      'Line chart of the mortgage balance over time for the Bank Schedule, falling from $500,000.00 on 29 Nov 2023 to $0.00 on 29 Nov 2053.',
    )
    const html = plain.container.firstElementChild?.outerHTML
    plain.unmount()

    // An account missing from the accounts list behaves as none.
    server.accounts = []
    const { container } = renderChart('99999999-9999-4999-8999-999999999999')
    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalledWith('/api/accounts', expect.anything()))
    expect(container.firstElementChild?.outerHTML).toBe(html)
  })

  it('draws no line, no message and both legend entries while loading and after a failure', async () => {
    server.holdBalances()
    const loading = renderChart()

    await waitFor(() => expect(svg()).toHaveTextContent('Actual Balance'))
    expect(lines()).toHaveLength(1)
    expect(svg().querySelector('circle')).toBeNull()
    expect(svg().getAttribute('aria-label')).not.toMatch(/Actual Balance/)
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument()
    loading.unmount()

    server.balancesError = new Error('boom')
    renderChart()
    await waitFor(() => expect(svg()).toHaveTextContent('Actual Balance'))
    await waitFor(() => expect(server.balanceRequests.length).toBeGreaterThan(1))
    expect(lines()).toHaveLength(1)
    expect(svg().getAttribute('aria-label')).not.toMatch(/Actual Balance/)
    expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument()
  })

  it('names the legend entries and states there is nothing to plot when no balances exist', async () => {
    setBalances([null, null])
    renderChart()

    await waitFor(() => expect(svg().getAttribute('aria-label')).toMatch(/Actual Balance: there are no actual balances to plot\.$/))
    expect(lines()).toHaveLength(1)
    expect(svg().querySelector('circle')).toBeNull()
    expect(svg()).toHaveTextContent('Actual Balance')
  })

  it('draws a single dot for one point and describes it', async () => {
    setBalances([null, '480000.00'])
    renderChart()

    await waitFor(() => expect(svg().querySelector('circle')).not.toBeNull())
    const dot = svg().querySelector('circle')
    expect(dot).toHaveAttribute('r', '3')
    expect(dot).toHaveAttribute('fill', 'currentColor')
    expect(dot).toHaveClass('text-chart-navy')
    expect(lines()).toHaveLength(1)
    expect(svg().getAttribute('aria-label')).toMatch(/ Actual Balance: \$480,000\.00 on 29 Jan 2024\.$/)
  })

  it('draws a dashed chart-navy polyline through each non-blank balance, after the Bank Schedule line', async () => {
    setBalances([null, '480000.00', '470000.00', null, '450000.50'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    const [bank, actual] = Array.from(lines())
    expect(bank).toHaveClass('text-chart-primary')
    expect(bank).not.toHaveAttribute('stroke-dasharray')
    expect(actual).toHaveClass('text-chart-navy')
    expect(actual).toHaveAttribute('stroke-width', '2')
    expect(actual).toHaveAttribute('stroke-dasharray', '6 4')
    expect(actual).toHaveAttribute('fill', 'none')
    expect(parsePoints(actual)).toHaveLength(3)
    // Same x as the Bank Schedule point of the same row, and the y of the balance.
    const bankPoints = parsePoints(bank)
    expect(parsePoints(actual)[0]?.[0]).toBe(bankPoints[2]?.[0])
    expect(parsePoints(actual)[0]?.[1]).toBeCloseTo(260 - (230 * 480000) / 500000, 5)
    expect(parsePoints(actual)[2]?.[0]).toBe(bankPoints[5]?.[0])
    expect(svg().getAttribute('aria-label')).toMatch(
      / Actual Balance: from \$480,000\.00 on 29 Jan 2024 to \$450,000\.50 on 29 Apr 2024\.$/,
    )
  })

  it('lays out both legend entries', async () => {
    setBalances(['480000.00', '470000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    const bank = svg().querySelector('g.text-chart-primary')
    expect(bank?.querySelector('line')).toHaveAttribute('x1', '270')
    expect(bank?.querySelector('line')).toHaveAttribute('x2', '294')
    expect(bank?.querySelector('text')).toHaveAttribute('x', '300')
    expect(bank).toHaveTextContent('Bank Schedule')
    const actual = svg().querySelector('g.text-chart-navy')
    const sample = actual?.querySelector('line')
    expect(sample).toHaveAttribute('x1', '400')
    expect(sample).toHaveAttribute('x2', '424')
    expect(sample).toHaveAttribute('stroke-dasharray', '6 4')
    expect(sample).toHaveAttribute('stroke-width', '3')
    expect(actual?.querySelector('text')).toHaveAttribute('x', '430')
    expect(actual).toHaveTextContent('Actual Balance')
  })

  it('keeps the axis unchanged when every balance is within $0 and the Opening Balance', async () => {
    setBalances(['480000.00', '470000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    for (const tick of ['$0', '$125K', '$250K', '$375K', '$500K']) {
      expect(svg()).toHaveTextContent(tick)
    }
    expect(Array.from(guides()).map((guide) => guide.getAttribute('y1'))).toEqual(['60', '110', '160', '210'])
  })

  it('raises the top of the axis for a balance above the Opening Balance', async () => {
    setBalances(['600000.00'])
    renderChart()

    await waitFor(() => expect(svg().querySelector('circle')).not.toBeNull())
    for (const tick of ['$0', '$250K', '$500K', '$750K', '$1M']) {
      expect(svg()).toHaveTextContent(tick)
    }
    expect(Number(svg().querySelector('circle')?.getAttribute('cy'))).toBeGreaterThanOrEqual(30)
  })

  it('extends below $0 for a negative balance, keeping a labelled $0 tick and aligned guides', async () => {
    setBalances(['480000.00', '-1000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    for (const tick of ['-$125K', '$0', '$125K', '$250K', '$375K', '$500K']) {
      expect(svg()).toHaveTextContent(tick)
    }
    const tickLabelYs = Array.from(svg().querySelectorAll('text'))
      .filter((text) => /^-?\$/.test(text.textContent ?? '') && text.getAttribute('font-size') === '11')
      .map((text) => Number(text.getAttribute('y')) - 4)
    expect(tickLabelYs).toHaveLength(6)
    const guideYs = Array.from(guides()).map((guide) => Number(guide.getAttribute('y1')))
    expect(guideYs).toHaveLength(6)
    guideYs.forEach((guideY, index) => expect(guideY).toBeCloseTo(tickLabelYs[index] ?? Number.NaN, 5))
  })

  it('keeps every point of both series inside the plot', async () => {
    setBalances(['700000.00', '480000.00', '-90000.00', '-1000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    for (const line of Array.from(lines())) {
      for (const [x, y] of parsePoints(line)) {
        expect(x).toBeGreaterThanOrEqual(70 - 1e-6)
        expect(x).toBeLessThanOrEqual(580 + 1e-6)
        expect(y).toBeGreaterThanOrEqual(30 - 1e-6)
        expect(y).toBeLessThanOrEqual(260 + 1e-6)
      }
    }
  })

  it('draws no Actual Balance line or legend entry when the Bank Schedule is not plotted', () => {
    setBalances(['480000.00', '470000.00'])
    renderChart(account.id, false)

    expect(lines()).toHaveLength(0)
    expect(svg().querySelector('circle')).toBeNull()
    expect(svg()).not.toHaveTextContent('Actual Balance')
    expect(screen.getByText('The burn down will appear once the schedule is calculated.')).toBeInTheDocument()
  })

  it('renders 1,560 periods with balances within 500 ms (SC-004)', async () => {
    const weekly = { ...inputs, duration: 1560, paymentFrequency: 'Weekly' as const }
    const longSchedule = calculateSchedule(weekly) ?? []
    server.balances = {
      currencyCode: 'AUD',
      periodCount: 1560,
      balances: longSchedule.map((period) => (period.closingCents / 100 - 100).toFixed(2)),
    }

    const start = performance.now()
    renderWithProviders(
      <BurnDownChart
        accountId={account.id}
        disbursalDate={weekly.disbursalDate}
        duration={weekly.duration}
        openingBalanceCents={weekly.openingBalanceCents}
        paymentFrequency={weekly.paymentFrequency}
        saved
        schedule={longSchedule}
      />,
    )
    await waitFor(() => expect(lines()).toHaveLength(2))

    expect(parsePoints(lines()[1])).toHaveLength(1560)
    expect(performance.now() - start).toBeLessThan(500)
  })
})
