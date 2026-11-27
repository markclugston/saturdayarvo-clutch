import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { clean, formatCurrency, formatPercent, FormattedNumberField } from './FormattedNumberField'

function Field({ decimals }: { decimals?: number }) {
  const [value, setValue] = useState('')
  return (
    <FormattedNumberField
      decimals={decimals}
      format={(raw) => raw}
      id="amount"
      inputMode="decimal"
      label="Amount"
      onValueChange={setValue}
      value={value}
    />
  )
}

describe('decimals', () => {
  it('keeps two decimal places by default', async () => {
    const user = userEvent.setup()
    render(<Field />)

    await user.type(screen.getByLabelText('Amount'), '1.239')

    expect(screen.getByLabelText('Amount')).toHaveValue('1.23')
  })

  it('never displays a decimal point or fraction digits with 0 decimals', async () => {
    const user = userEvent.setup()
    render(<Field decimals={0} />)
    const input = screen.getByLabelText('Amount')

    await user.type(input, '12.')
    expect(input).toHaveValue('12')

    await user.clear(input)
    await user.click(input)
    await user.paste('1,234.56')

    expect(input).toHaveValue('1234')
  })

  it('applies the limit when cleaning', () => {
    expect(clean('1,234.56', 0)).toBe('1234')
    expect(clean('.5', 0)).toBe('')
    expect(clean('1.239', 3)).toBe('1.239')
  })
})

describe('clean (restricted entry)', () => {
  it('rejects letters and other invalid characters', () => {
    expect(clean('12abc3')).toBe('123')
    expect(clean('-5')).toBe('5')
  })
  it('strips pasted symbols and separators', () => expect(clean('$1,000.50 %')).toBe('1000.50'))
  it('keeps one decimal point and two decimal places', () => {
    expect(clean('1.2.3')).toBe('1.23')
    expect(clean('5.555')).toBe('5.55')
    expect(clean('.5')).toBe('.5')
  })
})

describe('formatCurrency', () => {
  it('defaults to $0 when empty', () => expect(formatCurrency('')).toBe('$0'))
  it('groups thousands and shows two decimals', () => {
    expect(formatCurrency('500000.5')).toBe('$500,000.50')
    expect(formatCurrency('1000')).toBe('$1,000.00')
  })
  it('leaves invalid input as typed', () => expect(formatCurrency('12.345')).toBe('12.345'))
})

describe('formatPercent', () => {
  it('shows two decimals and a percent sign', () => {
    expect(formatPercent('5.5')).toBe('5.50%')
    expect(formatPercent('6')).toBe('6.00%')
  })
  it('keeps empty and invalid input as typed', () => {
    expect(formatPercent('')).toBe('')
    expect(formatPercent('abc')).toBe('abc')
  })
})
