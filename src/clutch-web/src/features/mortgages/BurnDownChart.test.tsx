import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BurnDownChart } from './BurnDownChart'
import { calculateSchedule } from './scheduleCalculation'

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
    expect(lines[0]).toHaveClass('text-primary')
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
