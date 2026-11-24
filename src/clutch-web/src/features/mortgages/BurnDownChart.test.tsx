import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from '@/lib/api/client'
import type { PeriodBalances } from '@/lib/api/schemas'
import { BurnDownChart } from './BurnDownChart'
import { formatCents } from './formatCents'
import { calculateSchedule, type ScheduledPeriod } from './scheduleCalculation'
import { installFakeApi, renderWithProviders, type FakeServer } from './testSupport'

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  apiRequest: vi.fn(),
}))

type Vertex = [number, number]

function pairOf(token: string | undefined): Vertex {
  const [x, y] = (token ?? '').split(',').map(Number)
  return [x ?? Number.NaN, y ?? Number.NaN]
}

/** The points a line `d` passes through: its start and every segment's end. */
function lineVertices(d: string | null | undefined): Vertex[] {
  const tokens = (d ?? '').trim().split(/\s+/).filter(Boolean)
  const vertices: Vertex[] = []
  for (let index = 0; index < tokens.length; index += 1) {
    const command = tokens[index]
    if (command === 'M' || command === 'L') {
      vertices.push(pairOf(tokens[index + 1]))
      index += 1
    } else if (command === 'C') {
      vertices.push(pairOf(tokens[index + 3]))
      index += 3
    }
  }
  return vertices
}

/** Every coordinate a path names, control points included. */
function allCoordinates(d: string | null | undefined): Vertex[] {
  return (d ?? '').split(/\s+/).filter((token) => token.includes(',')).map(pairOf)
}

const seriesPath = (root: Element, series: string, part: string) =>
  root.querySelector(`path[data-series="${series}"][data-part="${part}"]`)
const seriesLines = (root: Element) => root.querySelectorAll('path[data-part="line"]')

/** Replaces generated ids so two renders compare equal. */
const withoutIds = (html: string | undefined) => (html ?? '').replace(/_r_[0-9a-z]+_|:r[0-9a-z]+:|«r[0-9a-z]+»/g, 'ID')

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

  it('draws the Bank Schedule line through a point at the disbursal date and one per period', () => {
    renderPlotted()

    const svg = screen.getByRole('img')
    expect(seriesLines(svg)).toHaveLength(1)
    const points = lineVertices(seriesPath(svg, 'schedule', 'line')?.getAttribute('d'))
    expect(points).toHaveLength(361)
    expect(points[0]).toEqual([70, 30])
    // Closing balance k plots at y = 260 - 230 * closing / $500,000.
    expect(points[1]?.[1]).toBeCloseTo(260 - (230 * 499502.25) / 500000, 5)
    expect(points[360]).toEqual([580, 260])
  })

  it('defines each series gradient across the plot with the token stops (FR-002)', () => {
    renderPlotted()

    const gradient = screen.getByRole('img').querySelector('linearGradient[data-series="schedule"]:not([data-part])')
    expect(gradient).toHaveAttribute('gradientUnits', 'userSpaceOnUse')
    expect(gradient).toHaveAttribute('x1', '0')
    expect(gradient).toHaveAttribute('x2', '0')
    expect(gradient).toHaveAttribute('y1', '30')
    expect(gradient).toHaveAttribute('y2', '260')
    const stops = Array.from(gradient?.querySelectorAll('stop') ?? [])
    expect(stops.map((stop) => stop.getAttribute('class')))
      .toEqual(['text-chart-schedule-start', 'text-chart-schedule-mid', 'text-chart-schedule-end'])
    expect(stops.map((stop) => stop.getAttribute('offset'))).toEqual(['0', '0.5', '1'])
    for (const stop of stops) {
      expect(stop).toHaveAttribute('stop-color', 'currentColor')
    }
    const id = gradient?.getAttribute('id')
    expect(seriesPath(screen.getByRole('img'), 'schedule', 'line')).toHaveAttribute('stroke', `url(#${id})`)
    expect(seriesPath(screen.getByRole('img'), 'schedule', 'area')).toHaveAttribute('fill', `url(#${id})`)
  })

  it('gives two charts different gradient ids', () => {
    render(
      <>
        <BurnDownChart disbursalDate="2023-11-29" openingBalanceCents={50000000} saved schedule={schedule} />
        <BurnDownChart disbursalDate="2023-11-29" openingBalanceCents={50000000} saved schedule={schedule} />
      </>,
    )

    const ids = Array.from(document.querySelectorAll('linearGradient')).map((gradient) => gradient.id)
    expect(ids.length).toBeGreaterThanOrEqual(4)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('fills the Bank Schedule area down to $0, inside the axes (FR-003, SC-005)', () => {
    renderPlotted()

    const area = seriesPath(screen.getByRole('img'), 'schedule', 'area')
    expect(area).toHaveAttribute('fill-opacity', '0.6')
    const d = area?.getAttribute('d') ?? ''
    expect(d.endsWith('L 580,260 L 70,260 Z')).toBe(true)
    const line = seriesPath(screen.getByRole('img'), 'schedule', 'line')?.getAttribute('d') ?? ''
    expect(d.startsWith(line)).toBe(true)
    for (const [x, y] of allCoordinates(d)) {
      expect(x).toBeGreaterThanOrEqual(70 - 1e-6)
      expect(x).toBeLessThanOrEqual(580 + 1e-6)
      expect(y).toBeGreaterThanOrEqual(30 - 1e-6)
      expect(y).toBeLessThanOrEqual(260 + 1e-6)
    }
  })

  it('draws the Bank Schedule line solid, unfilled and above the guides (FR-003, FR-004)', () => {
    renderPlotted()

    const svg = screen.getByRole('img')
    const line = seriesPath(svg, 'schedule', 'line')
    expect(line).not.toHaveAttribute('stroke-dasharray')
    expect(line).toHaveAttribute('fill', 'none')
    expect(line).toHaveAttribute('stroke-width', '2')
    const area = seriesPath(svg, 'schedule', 'area')
    const guide = svg.querySelector('line.opacity-30')
    expect(area?.compareDocumentPosition(guide as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(guide?.compareDocumentPosition(line as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
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

  it('keeps the empty frame without a schedule, with no series or fill (FR-011)', () => {
    render(<BurnDownChart saved />)

    const svg = screen.getByRole('img')
    expect(svg.querySelector('path[data-series]')).toBeNull()
    expect(svg.querySelector('[data-part="area"]')).toBeNull()
    expect(screen.getByText('The burn down will appear once the schedule is calculated.')).toBeInTheDocument()
  })

  it('renders no buttons, menus or selects (FR-012)', () => {
    renderPlotted()

    for (const role of ['button', 'menu', 'combobox', 'listbox']) {
      expect(screen.queryByRole(role)).not.toBeInTheDocument()
    }
  })

  describe('in a box wider than 2:1', () => {
    function sizeBox(width: number, height: number) {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width)
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height)
      vi.stubGlobal('ResizeObserver', class {
        observe() {}
        disconnect() {}
      })
    }

    afterEach(() => {
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    })

    it('widens the drawing to fill the box, keeping the plot 20 units from the right edge', () => {
      sizeBox(1200, 300)
      renderPlotted()

      const svg = screen.getByRole('img')
      expect(svg).toHaveAttribute('viewBox', '0 0 1200 300')
      const points = lineVertices(seriesPath(svg, 'schedule', 'line')?.getAttribute('d'))
      expect(points[0]).toEqual([70, 30])
      expect(points[360]).toEqual([1180, 260])
      expect(svg.querySelector('[data-part="legend"][data-series="schedule"] rect')).toHaveAttribute('x', '1000')
      expect(screen.getByText('Repayment Date')).toHaveAttribute('x', '625')
    })

    it('keeps the 2:1 drawing in a box narrower than 2:1', () => {
      sizeBox(400, 300)
      renderPlotted()

      expect(screen.getByRole('img')).toHaveAttribute('viewBox', '0 0 600 300')
    })
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
  const lines = () => seriesLines(svg())
  const dot = () => svg().querySelector('circle[data-series="actual"][data-part="dot"]')
  const guides = () => svg().querySelectorAll('line.opacity-30')
  const legend = (series: string) => svg().querySelector(`[data-part="legend"][data-series="${series}"]`)
  const gradientId = (series: string) =>
    svg().querySelector(`linearGradient[data-series="${series}"]:not([data-part])`)?.getAttribute('id')

  it('draws no Actual Balance and keeps the 023 output without an account', async () => {
    const plain = render(
      <BurnDownChart disbursalDate={inputs.disbursalDate} openingBalanceCents={inputs.openingBalanceCents} saved schedule={schedule} />,
    )

    expect(lines()).toHaveLength(1)
    expect(svg().querySelector('path[data-series="actual"], circle[data-series="actual"]')).toBeNull()
    expect(svg()).not.toHaveTextContent('Actual Balance')
    expect(legend('actual')).toBeNull()
    expect(legend('schedule')?.querySelector('rect')).toHaveAttribute('x', '400')
    expect(svg()).toHaveAccessibleName(
      'Line chart of the mortgage balance over time for the Bank Schedule, falling from $500,000.00 on 29 Nov 2023 to $0.00 on 29 Nov 2053.',
    )
    const html = plain.container.firstElementChild?.outerHTML
    plain.unmount()

    // An account missing from the accounts list behaves as none.
    server.accounts = []
    const { container } = renderChart('99999999-9999-4999-8999-999999999999')
    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalledWith('/api/accounts', expect.anything()))
    expect(withoutIds(container.firstElementChild?.outerHTML)).toBe(withoutIds(html))
  })

  it('draws no line, no message and both legend entries while loading and after a failure', async () => {
    server.holdBalances()
    const loading = renderChart()

    await waitFor(() => expect(svg()).toHaveTextContent('Actual Balance'))
    expect(lines()).toHaveLength(1)
    expect(dot()).toBeNull()
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
    expect(dot()).toBeNull()
    expect(svg()).toHaveTextContent('Actual Balance')
  })

  it('draws a single balance as a dot at the end of a line from the starting balance, and describes it', async () => {
    setBalances([null, '480000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    expect(dot()).not.toBeNull()
    expect(lineVertices(seriesPath(svg(), 'actual', 'line')?.getAttribute('d'))).toHaveLength(2)
    expect(svg().getAttribute('aria-label')).toMatch(/ Actual Balance: \$480,000\.00 on 29 Jan 2024\.$/)
  })

  it('draws a solid Actual Balance line through each non-blank balance, after the Bank Schedule line', async () => {
    setBalances([null, '480000.00', '470000.00', null, '450000.50'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    const [bank, actual] = Array.from(lines())
    expect(bank).toHaveAttribute('data-series', 'schedule')
    expect(bank).not.toHaveAttribute('stroke-dasharray')
    expect(actual).toHaveAttribute('data-series', 'actual')
    expect(actual).toHaveAttribute('stroke', `url(#${gradientId('actual')})`)
    expect(actual).toHaveAttribute('stroke-width', '2')
    expect(actual).not.toHaveAttribute('stroke-dasharray')
    expect(actual).toHaveAttribute('fill', 'none')
    const actualPoints = lineVertices(actual?.getAttribute('d'))
    expect(actualPoints).toHaveLength(4)
    // Starts at the Bank Schedule's opening point, then each balance at its row's x and the y of the balance.
    const bankPoints = lineVertices(bank?.getAttribute('d'))
    expect(actualPoints[0]).toEqual(bankPoints[0])
    expect(actualPoints[1]?.[0]).toBe(bankPoints[2]?.[0])
    expect(actualPoints[1]?.[1]).toBeCloseTo(260 - (230 * 480000) / 500000, 5)
    expect(actualPoints[3]?.[0]).toBe(bankPoints[5]?.[0])
    expect(svg().getAttribute('aria-label')).toMatch(
      / Actual Balance: from \$480,000\.00 on 29 Jan 2024 to \$450,000\.50 on 29 Apr 2024\.$/,
    )
  })

  it('defines the Actual Balance gradient with its token stops', async () => {
    setBalances(['480000.00', '470000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    const gradient = svg().querySelector('linearGradient[data-series="actual"]:not([data-part])')
    expect(gradient).toHaveAttribute('gradientUnits', 'userSpaceOnUse')
    expect(gradient).toHaveAttribute('x1', '0')
    expect(gradient).toHaveAttribute('x2', '0')
    expect(gradient).toHaveAttribute('y1', '30')
    expect(gradient).toHaveAttribute('y2', '260')
    expect(Array.from(gradient?.querySelectorAll('stop') ?? []).map((stop) => stop.getAttribute('class')))
      .toEqual(['text-chart-actual-start', 'text-chart-actual-mid', 'text-chart-actual-end'])
  })

  it('does not name the Actual Balance line or dot inside the plot; the legend names it', async () => {
    setBalances(['480000.00', '470000.00', '460000.00'])
    const { unmount } = renderChart()
    await waitFor(() => expect(lines()).toHaveLength(2))
    expect(svg().querySelector('text[data-part="series-name"]')).toBeNull()
    expect(svg().querySelector('[data-part="legend"][data-series="actual"]')).toHaveTextContent('Actual Balance')
    unmount()

    setBalances(['480000.00'])
    renderChart()
    await waitFor(() => expect(svg().querySelector('circle[data-part="dot"]')).not.toBeNull())
    expect(svg().querySelector('text[data-part="series-name"]')).toBeNull()
  })

  it('draws fills under the guides and lines in order: Bank area, Actual area, guides, Bank line, Actual line (R3)', async () => {
    setBalances(['480000.00', '470000.00', '460000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    const order = [
      seriesPath(svg(), 'schedule', 'area'),
      seriesPath(svg(), 'actual', 'area'),
      guides()[0],
      seriesPath(svg(), 'schedule', 'line'),
      seriesPath(svg(), 'actual', 'line'),
    ]
    order.slice(1).forEach((element, index) => {
      expect(order[index]?.compareDocumentPosition(element as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })
    expect(seriesPath(svg(), 'actual', 'area')).toHaveAttribute('fill-opacity', '0.5')
    expect(seriesPath(svg(), 'actual', 'area')).toHaveAttribute('fill', `url(#${gradientId('actual')})`)
    expect(seriesPath(svg(), 'schedule', 'area')).toHaveAttribute('fill-opacity', '0.6')
  })

  it('lays out both legend entries, each sampling its full gradient and line style (FR-006)', async () => {
    setBalances(['480000.00', '470000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    const bank = legend('schedule')
    const bankSample = bank?.querySelector('rect')
    expect(bankSample).toHaveAttribute('x', '270')
    expect(bankSample).toHaveAttribute('width', '24')
    expect(bank?.querySelector('text')).toHaveAttribute('x', '300')
    expect(bank).toHaveTextContent('Bank Schedule')
    expect(bankSample).not.toHaveAttribute('clip-path')
    const actual = legend('actual')
    const actualSample = actual?.querySelector('rect')
    expect(actualSample).toHaveAttribute('x', '400')
    expect(actualSample).toHaveAttribute('width', '24')
    expect(actualSample).not.toHaveAttribute('clip-path')
    expect(actual?.querySelector('text')).toHaveAttribute('x', '430')
    expect(actual).toHaveTextContent('Actual Balance')

    for (const [series, sample] of [['schedule', bankSample], ['actual', actualSample]] as const) {
      const gradient = svg().querySelector(`linearGradient[data-part="legend-gradient"][data-series="${series}"]`)
      expect(gradient).toHaveAttribute('gradientUnits', 'objectBoundingBox')
      expect(Array.from(gradient?.querySelectorAll('stop') ?? []).map((stop) => stop.getAttribute('class')))
        .toEqual([`text-chart-${series}-start`, `text-chart-${series}-mid`, `text-chart-${series}-end`])
      expect(sample).toHaveAttribute('fill', `url(#${gradient?.getAttribute('id')})`)
    }
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

    await waitFor(() => expect(dot()).not.toBeNull())
    for (const tick of ['$0', '$250K', '$500K', '$750K', '$1M']) {
      expect(svg()).toHaveTextContent(tick)
    }
    expect(Number(dot()?.getAttribute('cy'))).toBeGreaterThanOrEqual(30)
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

  it('fills a negative Actual Balance above and below $0, closing at y($0)', async () => {
    setBalances(['480000.00', '-1000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    // Axis -$125K to $500K: $0 sits one step of five above the bottom.
    const zeroY = 260 - 230 / 5
    const area = seriesPath(svg(), 'actual', 'area')?.getAttribute('d') ?? ''
    const vertices = lineVertices(area)
    const actualLine = lineVertices(seriesPath(svg(), 'actual', 'line')?.getAttribute('d'))
    expect(vertices.slice(0, actualLine.length)).toEqual(actualLine)
    expect(actualLine[1]?.[1]).toBeLessThan(zeroY)
    expect(actualLine[2]?.[1]).toBeGreaterThan(zeroY)
    const [down, back] = vertices.slice(actualLine.length)
    expect(down?.[0]).toBe(actualLine[2]?.[0])
    expect(down?.[1]).toBeCloseTo(zeroY, 5)
    expect(back?.[0]).toBe(actualLine[0]?.[0])
    expect(back?.[1]).toBeCloseTo(zeroY, 5)
    expect(area.endsWith('Z')).toBe(true)
  })

  it('keeps every point and fill of both series inside the plot (SC-005)', async () => {
    setBalances(['700000.00', '480000.00', '-90000.00', '-1000.00'])
    renderChart()

    await waitFor(() => expect(lines()).toHaveLength(2))
    for (const path of Array.from(svg().querySelectorAll('path[data-series]'))) {
      for (const [x, y] of allCoordinates(path.getAttribute('d'))) {
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
    expect(svg().querySelector('[data-part="area"]')).toBeNull()
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

    expect(lineVertices(lines()[1]?.getAttribute('d'))).toHaveLength(1561)
    expect(performance.now() - start).toBeLessThan(500)
  })
})

describe('BurnDownChart hover label', () => {
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
    // The chart box is exactly the viewBox, so clientX equals the viewBox x.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      { left: 0, top: 0, right: 600, bottom: 300, width: 600, height: 300, x: 0, y: 0, toJSON: () => ({}) },
    )
    // The hover label measures 180 × 60.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(180)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(60)
  })

  function renderChart(options: { accountId?: string, plotted?: boolean, periods?: ScheduledPeriod[] } = {}) {
    const rows = options.periods ?? schedule
    return renderWithProviders(
      <BurnDownChart
        accountId={options.accountId}
        disbursalDate={inputs.disbursalDate}
        duration={rows.length}
        openingBalanceCents={inputs.openingBalanceCents}
        paymentFrequency={rows === schedule ? inputs.paymentFrequency : 'Weekly'}
        saved
        schedule={options.plotted === false ? undefined : rows}
      />,
    )
  }

  function setBalances(balances: PeriodBalances['balances']) {
    server.balances = { currencyCode: 'AUD', periodCount: 360, balances }
  }

  const svg = () => screen.getByRole('img')
  const group = () => screen.getByRole('group', { name: 'Burndown Values' })
  const plotArea = () => svg().querySelector('rect[data-part="pointer-area"]') as Element
  const label = () => document.querySelector('[data-slot="burndown-label"]')
  const band = () => svg().querySelector('rect[data-part="band"]')
  const rings = () => Array.from(svg().querySelectorAll('circle[data-part="ring"]'))
  const status = () => screen.getByRole('status')
  /** x of the plotted date at `index` (0 = Disbursal Date), read from the Bank Schedule line. */
  const xOf = (index: number) => lineVertices(seriesPath(svg(), 'schedule', 'line')?.getAttribute('d'))[index]?.[0] ?? 0
  const hover = (index: number) => fireEvent.pointerMove(plotArea(), { clientX: xOf(index), clientY: 150 })
  const amounts = () => Array.from(label()?.querySelectorAll('dd') ?? []).map((cell) => cell.textContent)
  const names = () => Array.from(label()?.querySelectorAll('dt') ?? []).map((cell) => cell.textContent)
  const key = (name: string) => fireEvent.keyDown(group(), { key: name })

  it('shows the band, a ring per series and the date and amounts at the nearest plotted date (FR-007, SC-001)', async () => {
    setBalances([null, '480000.00'])
    renderChart({ accountId: account.id })
    await waitFor(() => expect(svg().querySelector('circle[data-part="dot"]')).not.toBeNull())

    expect(label()).toBeNull()
    expect(band()).toBeNull()
    hover(2)

    expect(label()).toHaveAttribute('aria-hidden', 'true')
    expect(label()).toHaveTextContent('29 Jan 2024')
    expect(names()).toEqual(['Bank Schedule', 'Actual Balance'])
    expect(amounts()).toEqual([formatCents(schedule[1]?.closingCents ?? 0), '$480,000.00'])
    expect(band()).not.toBeNull()
    expect(Number(band()?.getAttribute('width'))).toBeGreaterThanOrEqual(6)
    expect(band()).toHaveAttribute('fill-opacity', '0.05')
    expect(band()).toHaveClass('fill-fg')
    expect(rings().map((ring) => ring.getAttribute('data-series'))).toEqual(['schedule', 'actual'])
    for (const ring of rings()) {
      expect(Number(ring.getAttribute('cx'))).toBeCloseTo(xOf(2), 5)
    }

    // A pointer between two dates picks the nearer.
    // Monthly dates are about 1.4 units apart here.
    fireEvent.pointerMove(plotArea(), { clientX: xOf(1) + 0.3, clientY: 150 })
    expect(label()).toHaveTextContent('29 Dec 2023')
    expect(amounts()).toEqual(['$499,502.25'])
  })

  it('right aligns the amounts with tabular figures (FR-007, WEB-001)', () => {
    renderChart()
    hover(1)

    for (const cell of Array.from(label()?.querySelectorAll('dd') ?? [])) {
      expect(cell).toHaveClass('text-right', 'tabular-nums')
    }
    expect(label()).toHaveClass('rounded-control', 'bg-raised', 'text-fg', 'shadow-float', 'pointer-events-none')
  })

  it('shows the Opening Balance and no Actual Balance at the Disbursal Date (FR-007)', async () => {
    setBalances(['480000.00', '470000.00'])
    renderChart({ accountId: account.id })
    await waitFor(() => expect(seriesLines(svg())).toHaveLength(2))

    hover(0)
    expect(label()).toHaveTextContent('29 Nov 2023')
    expect(names()).toEqual(['Bank Schedule'])
    expect(amounts()).toEqual(['$500,000.00'])
    expect(rings().map((ring) => ring.getAttribute('data-series'))).toEqual(['schedule'])
  })

  it('omits the Actual Balance on blank rows (FR-008)', async () => {
    setBalances([null, '480000.00'])
    renderChart({ accountId: account.id })
    await waitFor(() => expect(svg().querySelector('circle[data-part="dot"]')).not.toBeNull())

    hover(1)
    expect(names()).toEqual(['Bank Schedule'])
    expect(rings()).toHaveLength(1)
  })

  const labelStyle = () => (label() as HTMLElement).style
  const px = (value: string) => Number(value.replace('px', ''))

  it('follows the hovered date, beside the band at the height of the rings (FR-010, R5)', () => {
    renderChart()

    for (const index of [0, 1, 60, 120, 180]) {
      hover(index)
      const ringY = Number(rings()[0]?.getAttribute('cy'))
      expect(label()).toHaveAttribute('data-side', 'right')
      expect(px(labelStyle().left)).toBeCloseTo(xOf(index) + 12, 5)
      expect(px(labelStyle().top)).toBeCloseTo(Math.min(Math.max(ringY - 30, 0), 240), 5)
    }
  })

  it('moves the label to the left of the date where the right has no room, still beside it', () => {
    renderChart()

    hover(360)
    expect(label()).toHaveAttribute('data-side', 'left')
    expect(px(labelStyle().left)).toBeCloseTo(580 - 12 - 180, 5)
  })

  it('stays beside the hovered date when the rings straddle the middle, centred between them (R5)', async () => {
    // Bank Schedule near the top, Actual Balance well below the middle.
    setBalances(['480000.00', '100000.00', '100000.00'])
    renderChart({ accountId: account.id })
    await waitFor(() => expect(seriesLines(svg())).toHaveLength(2))

    hover(2)
    const [bankRing = 0, actualRing = 0] = rings().map((ring) => Number(ring.getAttribute('cy')))
    expect(bankRing).toBeLessThan(145)
    expect(actualRing).toBeGreaterThan(145)
    expect(label()).toHaveAttribute('data-side', 'right')
    expect(px(labelStyle().left)).toBeCloseTo(xOf(2) + 12, 5)
    expect(px(labelStyle().top)).toBeCloseTo((bankRing + actualRing) / 2 - 30, 5)
  })

  it('shows nothing on focus, then Right, Home or Page Down show the first date and Left, End or Page Up the last (FR-009)', () => {
    renderChart()

    group().focus()
    expect(group()).toHaveFocus()
    expect(group()).toHaveAttribute('tabindex', '0')
    expect(label()).toBeNull()

    for (const [name, date] of [
      ['ArrowRight', '29 Nov 2023'], ['Home', '29 Nov 2023'], ['PageDown', '29 Nov 2023'],
      ['ArrowLeft', '29 Nov 2053'], ['End', '29 Nov 2053'], ['PageUp', '29 Nov 2053'],
    ] as const) {
      key('Escape')
      expect(label()).toBeNull()
      key(name)
      expect(label()).toHaveTextContent(date)
    }
  })

  it('moves by date, to the ends and by about a year with the keys, and Escape hides it keeping focus (FR-009, SC-004)', () => {
    renderChart()
    group().focus()

    key('ArrowRight')
    key('ArrowRight')
    expect(label()).toHaveTextContent('29 Dec 2023')
    key('ArrowLeft')
    expect(label()).toHaveTextContent('29 Nov 2023')
    key('ArrowLeft')
    expect(label()).toHaveTextContent('29 Nov 2023')
    key('PageDown')
    expect(label()).toHaveTextContent('29 Nov 2024')
    key('PageDown')
    expect(label()).toHaveTextContent('29 Nov 2025')
    key('PageUp')
    expect(label()).toHaveTextContent('29 Nov 2024')
    key('End')
    expect(label()).toHaveTextContent('29 Nov 2053')
    key('ArrowRight')
    expect(label()).toHaveTextContent('29 Nov 2053')
    key('PageDown')
    expect(label()).toHaveTextContent('29 Nov 2053')
    key('Home')
    expect(label()).toHaveTextContent('29 Nov 2023')

    key('Escape')
    expect(label()).toBeNull()
    expect(group()).toHaveFocus()
  })

  it('prevents the default action of handled keys only', () => {
    renderChart()
    group().focus()

    for (const name of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'PageUp', 'PageDown', 'Escape']) {
      expect(fireEvent.keyDown(group(), { key: name })).toBe(false)
    }
    expect(fireEvent.keyDown(group(), { key: 'Tab' })).toBe(true)
    expect(fireEvent.keyDown(group(), { key: 'a' })).toBe(true)
  })

  it('describes the keys to screen readers', () => {
    renderChart()

    expect(group()).toHaveAccessibleDescription(
      'Use the arrow keys, Home, End, Page Up and Page Down to read values; Escape hides them.',
    )
    expect(group()).toHaveClass('focus-visible:focus-ring', 'rounded-control')
    expect(svg()).toHaveAccessibleName(/^Line chart of the mortgage balance over time/)
  })

  it('announces keyboard moves only (FR-009, SC 4.1.3)', async () => {
    setBalances([null, '480000.00'])
    renderChart({ accountId: account.id })
    await waitFor(() => expect(svg().querySelector('circle[data-part="dot"]')).not.toBeNull())

    expect(status()).toHaveAttribute('aria-live', 'polite')
    expect(status()).toHaveTextContent('')
    group().focus()
    key('End')
    key('Home')
    key('ArrowRight')
    key('ArrowRight')
    expect(status()).toHaveTextContent('29 Jan 2024. Bank Schedule')
    expect(status()).toHaveTextContent('Actual Balance $480,000.00.')

    hover(5)
    expect(label()).toHaveTextContent('29 Apr 2024')
    expect(status()).toHaveTextContent(/^$/)

    key('ArrowRight')
    expect(status()).toHaveTextContent('29 May 2024')
    key('Escape')
    expect(status()).toHaveTextContent(/^$/)
  })

  it('shares one label between pointer and keyboard: the last input moves it (FR-009a)', () => {
    renderChart()
    group().focus()

    // Pointer then key continues from the pointer's date.
    hover(5)
    key('ArrowRight')
    expect(label()).toHaveTextContent('29 May 2024')
    // A keyboard-moved label survives the pointer leaving.
    fireEvent.pointerLeave(plotArea())
    expect(label()).toHaveTextContent('29 May 2024')
    // A pointer-moved label hides when it leaves.
    hover(3)
    fireEvent.pointerLeave(plotArea())
    expect(label()).toBeNull()
    // Blur hides.
    key('Home')
    expect(label()).not.toBeNull()
    fireEvent.blur(group())
    expect(label()).toBeNull()
    expect(band()).toBeNull()
    expect(rings()).toHaveLength(0)
  })

  it('draws the band above both fills and below the guides, lines and rings (FR-004, R3)', async () => {
    setBalances(['480000.00', '470000.00'])
    renderChart({ accountId: account.id })
    await waitFor(() => expect(seriesLines(svg())).toHaveLength(2))

    hover(1)
    const order = [
      seriesPath(svg(), 'schedule', 'area'),
      seriesPath(svg(), 'actual', 'area'),
      band(),
      svg().querySelector('line.opacity-30'),
      seriesPath(svg(), 'schedule', 'line'),
      seriesPath(svg(), 'actual', 'line'),
      rings()[0],
    ]
    order.slice(1).forEach((element, index) => {
      expect(order[index]?.compareDocumentPosition(element as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })
  })

  it('never takes the pointer: band, rings and label pass it through, and every date stays reachable (FR-010)', () => {
    renderChart()

    hover(10)
    expect(band()).toHaveClass('pointer-events-none')
    for (const ring of rings()) {
      expect(ring).toHaveClass('pointer-events-none')
    }
    expect(label()).toHaveClass('pointer-events-none')
    // The pointer area is drawn last, above everything it could otherwise lose the pointer to.
    expect(svg().lastElementChild).toBe(plotArea())
    for (const index of [0, 1, 180, 359, 360]) {
      hover(index)
      expect(label()).not.toBeNull()
    }
    expect(label()).toHaveTextContent('29 Nov 2053')
  })

  it('has no label, band, rings or keyboard stop for invalid Details', () => {
    renderChart({ plotted: false })

    expect(screen.queryByRole('group', { name: 'Burndown Values' })).not.toBeInTheDocument()
    expect(svg().querySelector('rect[data-part="pointer-area"]')).toBeNull()
    expect(label()).toBeNull()
  })

  it('shows the Bank Schedule only while balances load or after they fail', async () => {
    server.holdBalances()
    const loading = renderChart({ accountId: account.id })
    await waitFor(() => expect(svg()).toHaveTextContent('Actual Balance'))
    hover(2)
    expect(names()).toEqual(['Bank Schedule'])
    loading.unmount()

    server.balancesError = new Error('boom')
    renderChart({ accountId: account.id })
    await waitFor(() => expect(server.balanceRequests.length).toBeGreaterThan(1))
    hover(2)
    expect(names()).toEqual(['Bank Schedule'])
  })

  it('updates the label on a 1,560-period schedule within 100 ms (SC-003 early warning)', () => {
    const weekly = calculateSchedule({ ...inputs, duration: 1560, paymentFrequency: 'Weekly' }) ?? []
    renderChart({ periods: weekly })
    hover(10)

    const start = performance.now()
    hover(1200)
    expect(label()).not.toBeNull()
    expect(performance.now() - start).toBeLessThan(100)
    expect(amounts()).toEqual([formatCents(weekly[1199]?.closingCents ?? 0)])
  })
})