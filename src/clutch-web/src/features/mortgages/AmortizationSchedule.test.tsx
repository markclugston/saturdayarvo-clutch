import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
    // The content area scrolls (not the schedule): 500 rows have moved above its top edge.
    render(
      <div data-testid="scroller" style={{ overflowY: 'auto' }}>
        <AmortizationSchedule duration={1000} />
      </div>,
    )
    const scroller = screen.getByTestId('scroller')
    const rect = (top: number) => ({ top }) as DOMRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mock(this: HTMLElement) {
      return this === scroller ? rect(0) : rect(-40 * 500)
    })

    fireEvent.scroll(scroller)
    vi.restoreAllMocks()

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
