import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AmortizationSchedule } from './AmortizationSchedule'

describe('AmortizationSchedule', () => {
  it('is a read-only table with Period, Date and Bank schedule headers and N + 1 rows', () => {
    render(<AmortizationSchedule duration={360} />)

    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('aria-rowcount', '362')
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent))
      .toEqual(['Period', 'Date', 'Bank Schedule'])
    const firstRow = within(table).getAllByRole('row')[1] as HTMLElement
    expect(within(firstRow).getAllByRole('cell').map((cell) => cell.textContent))
      .toEqual(['1', 'Not yet calculated', 'Not yet calculated'])
    expect(within(table).queryAllByRole('textbox')).toHaveLength(0)
    expect(table.querySelectorAll('input, select, textarea, [contenteditable]')).toHaveLength(0)
  })

  it('renders only a small window of a very large schedule', () => {
    render(<AmortizationSchedule duration={522_000} />)

    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('aria-rowcount', '522002')
    expect(within(table).getAllByRole('row').length).toBeLessThan(60)
  })

  it('renders later rows after scrolling and keeps the header', () => {
    render(<AmortizationSchedule duration={1000} />)
    const scroller = screen.getByRole('table').parentElement as HTMLElement

    fireEvent.scroll(scroller, { target: { scrollTop: 40 * 500 } })

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows[0]).toHaveAttribute('aria-rowindex', '1')
    expect(rows[0]?.className).toContain('sticky')
    expect(screen.getByText('501')).toBeInTheDocument()
    expect(screen.queryByText('2', { selector: '[role="cell"]' })).not.toBeInTheDocument()
  })

  it('redraws with the new row count when the saved duration changes', () => {
    const { rerender } = render(<AmortizationSchedule duration={5} />)
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '7')

    rerender(<AmortizationSchedule duration={12} />)

    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '14')
    expect(screen.getByText('13')).toBeInTheDocument()
  })

  it('shows the prompt instead of a table for a new mortgage', () => {
    const { container } = render(<AmortizationSchedule />)

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(container.querySelector('section')).toBeNull()
    expect(screen.getByText('Please enter your mortgage details')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
