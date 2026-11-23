import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoanPayoffTimeline } from './LoanPayoffTimeline'

describe('LoanPayoffTimeline', () => {
  it('is a section labelled by its Loan Payoff Timeline heading', () => {
    render(<LoanPayoffTimeline duration={12} onSwitch={vi.fn()} saved view="Burndown" />)

    const group = screen.getByRole('region', { name: 'Loan Payoff Timeline' })
    expect(group.tagName).toBe('SECTION')
    expect(screen.getByRole('heading', { level: 2, name: 'Loan Payoff Timeline' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mortgage Burndown' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Amortization Schedule' })).not.toBeInTheDocument()
  })

  it('shows only the burndown chart with a switch to the schedule', () => {
    render(<LoanPayoffTimeline duration={12} onSwitch={vi.fn()} saved view="Burndown" />)

    expect(screen.getByRole('img', { name: /balance over time/i })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Show Amortization Schedule' })
    expect(button).not.toHaveAttribute('aria-pressed')
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Showing Burndown Chart')
  })

  it('shows only the schedule with a switch to the chart', () => {
    render(<LoanPayoffTimeline duration={12} onSwitch={vi.fn()} saved view="Schedule" />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /balance over time/i })).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Show Burndown Chart' })
    expect(button).not.toHaveAttribute('aria-pressed')
    expect(screen.getByRole('status')).toHaveTextContent('Showing Amortization Schedule')
  })

  it('keeps the status line visually hidden', () => {
    render(<LoanPayoffTimeline duration={12} onSwitch={vi.fn()} saved view="Burndown" />)

    expect(screen.getByRole('status')).toHaveClass('sr-only')
  })

  it('shows a tooltip with the same wording as the button on hover', async () => {
    const user = userEvent.setup()
    render(<LoanPayoffTimeline duration={12} onSwitch={vi.fn()} saved view="Burndown" />)

    await user.hover(screen.getByRole('button', { name: 'Show Amortization Schedule' }))

    expect(await screen.findByText('Show Amortization Schedule', { selector: '[data-slot="tooltip-popup"]' }))
      .toBeInTheDocument()
  })

  it('calls onSwitch from a click, Enter and Space', async () => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()
    render(<LoanPayoffTimeline duration={12} onSwitch={onSwitch} saved view="Burndown" />)
    const button = screen.getByRole('button', { name: 'Show Amortization Schedule' })

    await user.click(button)
    button.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onSwitch).toHaveBeenCalledTimes(3)
  })

  it('shows the enter-details prompt in both views for an unsaved mortgage', () => {
    const { rerender } = render(<LoanPayoffTimeline onSwitch={vi.fn()} saved={false} view="Burndown" />)
    expect(screen.getByText('Please enter your mortgage details')).toBeInTheDocument()

    rerender(<LoanPayoffTimeline onSwitch={vi.fn()} saved={false} view="Schedule" />)
    expect(screen.getByText('Please enter your mortgage details')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show Burndown Chart' })).toBeEnabled()
  })
})

describe('LoanPayoffTimeline calculation', () => {
  const calculation = {
    openingBalanceCents: 50000000,
    disbursalDate: '2023-11-29',
    duration: 360,
    paymentFrequency: 'Monthly' as const,
    rateChanges: [{ annualRatePercent: 6, effectiveDate: '2023-11-29' }],
  }

  it('shows the calculated balances in the table', () => {
    render(
      <LoanPayoffTimeline
        calculation={calculation}
        disbursalDate="2023-11-29"
        duration={360}
        onSwitch={vi.fn()}
        paymentFrequency="Monthly"
        saved
        view="Schedule"
      />,
    )

    expect(screen.getByText('$499,502.25')).toBeInTheDocument()
    expect(screen.getByText('$499,002.01')).toBeInTheDocument()
  })

  it('shows Not yet calculated for the table and the existing message for the chart without inputs', () => {
    const { rerender } = render(<LoanPayoffTimeline duration={12} onSwitch={vi.fn()} saved view="Schedule" />)
    expect(screen.getAllByText('Not yet calculated').length).toBeGreaterThan(0)

    rerender(<LoanPayoffTimeline duration={12} onSwitch={vi.fn()} saved view="Burndown" />)
    expect(screen.getByText('The burn down will appear once the schedule is calculated.')).toBeInTheDocument()
  })

  it('draws the same schedule on the chart and redraws when the inputs change', () => {
    const { rerender } = render(<LoanPayoffTimeline calculation={calculation} onSwitch={vi.fn()} saved view="Burndown" />)
    const points = () => screen.getByRole('img').querySelector('polyline')?.getAttribute('points') ?? ''
    expect(points().split(' ')).toHaveLength(361)
    const before = points()

    rerender(<LoanPayoffTimeline calculation={{ ...calculation, duration: 12 }} onSwitch={vi.fn()} saved view="Burndown" />)

    expect(points().split(' ')).toHaveLength(13)
    expect(points()).not.toBe(before)
    expect(screen.queryByText('The burn down will appear once the schedule is calculated.')).not.toBeInTheDocument()
  })
})
