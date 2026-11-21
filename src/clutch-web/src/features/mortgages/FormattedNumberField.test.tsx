import { describe, expect, it } from 'vitest'
import { clean, formatCurrency, formatPercent } from './FormattedNumberField'

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
