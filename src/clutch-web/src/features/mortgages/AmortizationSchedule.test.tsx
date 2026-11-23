import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AmortizationSchedule } from './AmortizationSchedule'

const monthly = { disbursalDate: '2023-11-29', paymentFrequency: 'Monthly' as const }

function cells(row: number): string[] {
  const table = screen.getByRole('table')
  const element = within(table).getAllByRole('row').find((item) => item.getAttribute('aria-rowindex') === String(row + 1))
  return within(element as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent ?? '')
}

/** Puts the window over the last rows of a schedule of `rowCount` rows. */
function scrollToRow(row: number) {
  const scroller = screen.getByTestId('scroller')
  const rect = (top: number) => ({ top }) as DOMRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function mock(this: HTMLElement) {
    return this === scroller ? rect(0) : rect(-40 * row)
  })
  fireEvent.scroll(scroller)
  vi.restoreAllMocks()
}

describe('AmortizationSchedule', () => {
  it('is a read-only table with Period, Date and Bank Schedule headers and Duration rows', () => {
    render(<AmortizationSchedule duration={360} {...monthly} />)

    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('aria-rowcount', '361')
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent))
      .toEqual(['Period', 'Date', 'Bank Schedule'])
    expect(cells(1)).toEqual(['1', '29 Dec 2023', 'Not yet calculated'])
    expect(cells(2)).toEqual(['2', '29 Jan 2024', 'Not yet calculated'])
    expect(cells(3)).toEqual(['3', '29 Feb 2024', 'Not yet calculated'])
    expect(within(table).queryAllByRole('textbox')).toHaveLength(0)
    expect(table.querySelectorAll('input, select, textarea, [contenteditable]')).toHaveLength(0)
  })

  it('dates the last row, period Duration, on the final repayment', () => {
    render(
      <div data-testid="scroller" style={{ overflowY: 'auto' }}>
        <AmortizationSchedule duration={360} {...monthly} />
      </div>,
    )

    scrollToRow(350)

    expect(cells(360)).toEqual(['360', '29 Nov 2053', 'Not yet calculated'])
    expect(screen.queryByText('361', { selector: '[role="cell"]' })).not.toBeInTheDocument()
  })

  it('keeps the disbursal day and clamps to the month end', () => {
    render(<AmortizationSchedule disbursalDate="2024-01-31" duration={3} paymentFrequency="Monthly" />)

    expect([cells(1)[1], cells(2)[1], cells(3)[1]]).toEqual(['29 Feb 2024', '31 Mar 2024', '30 Apr 2024'])
  })

  it.each([
    ['Weekly', ['8 Jan 2024', '15 Jan 2024']],
    ['Fortnightly', ['15 Jan 2024', '29 Jan 2024']],
  ] as const)('steps %s periods by whole weeks from the disbursal date', (paymentFrequency, expected) => {
    render(<AmortizationSchedule disbursalDate="2024-01-01" duration={2} paymentFrequency={paymentFrequency} />)

    expect([cells(1)[1], cells(2)[1]]).toEqual(expected)
  })

  it('follows changes to the form values', () => {
    const { rerender } = render(<AmortizationSchedule duration={2} {...monthly} />)
    expect(cells(1)[1]).toBe('29 Dec 2023')

    rerender(<AmortizationSchedule disbursalDate="2024-03-15" duration={2} paymentFrequency="Weekly" />)

    expect([cells(1)[1], cells(2)[1]]).toEqual(['22 Mar 2024', '29 Mar 2024'])
  })

  it('shows a blank Date for a row whose date would pass 31 Dec 9999', () => {
    render(<AmortizationSchedule disbursalDate="9999-12-10" duration={4} paymentFrequency="Weekly" />)

    expect(cells(3)).toEqual(['3', '31 Dec 9999', 'Not yet calculated'])
    expect(cells(4)).toEqual(['4', '', 'Not yet calculated'])
  })

  it.each([
    ['disbursal date', { paymentFrequency: 'Monthly' as const }],
    ['payment frequency', { disbursalDate: '2023-11-29' }],
  ])('leaves the Date blank but keeps Duration rows without a %s', (_label, props) => {
    render(<AmortizationSchedule duration={3} {...props} />)

    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '4')
    expect(cells(1)).toEqual(['1', '', 'Not yet calculated'])
  })

  it('renders only a small window of a very large schedule', () => {
    render(<AmortizationSchedule duration={522_000} {...monthly} />)

    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('aria-rowcount', '522001')
    expect(within(table).getAllByRole('row').length).toBeLessThan(60)
  })

  it('renders later rows after scrolling and keeps the header', () => {
    // The content area scrolls (not the schedule): 500 rows have moved above its top edge.
    render(
      <div data-testid="scroller" style={{ overflowY: 'auto' }}>
        <AmortizationSchedule duration={1000} {...monthly} />
      </div>,
    )

    scrollToRow(500)

    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows[0]).toHaveAttribute('aria-rowindex', '1')
    expect(rows[0]?.className).toContain('sticky')
    expect(screen.getByText('501')).toBeInTheDocument()
    expect(cells(501)[1]).toBe('29 Aug 2065')
    expect(screen.queryByText('2', { selector: '[role="cell"]' })).not.toBeInTheDocument()
  })

  it('redraws with the new row count when the saved duration changes', () => {
    const { rerender } = render(<AmortizationSchedule duration={5} {...monthly} />)
    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '6')

    rerender(<AmortizationSchedule duration={12} {...monthly} />)

    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '13')
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.queryByText('13', { selector: '[role="cell"]' })).not.toBeInTheDocument()
  })

  it('shows the prompt instead of a table for a new mortgage', () => {
    const { container } = render(<AmortizationSchedule />)

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(container.querySelector('section')).toBeNull()
    expect(screen.getByText('Please enter your mortgage details')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
