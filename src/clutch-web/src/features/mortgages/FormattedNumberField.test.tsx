import { describe, expect, it } from 'vitest'
import { formatCurrency, formatPercent } from './FormattedNumberField'

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
