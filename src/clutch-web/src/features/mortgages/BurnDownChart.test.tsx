import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BurnDownChart } from './BurnDownChart'

describe('BurnDownChart', () => {
  it('has the heading, a text-alternative image, labelled axes, the single legend entry and the message', () => {
    render(<BurnDownChart saved />)

    expect(screen.getByRole('heading', { name: 'Mortgage Burndown' })).toBeInTheDocument()
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
