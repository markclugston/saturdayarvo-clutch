import { describe, expect, it } from 'vitest'
import { formatCurrencyAmount } from './formatCurrencyAmount'

describe('formatCurrencyAmount', () => {
  it('uses the currency and locale precision', () => {
    expect(formatCurrencyAmount('1234.5', 'AUD', 'en-AU')).toBe(
      new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
      }).format(1234.5),
    )
    expect(formatCurrencyAmount('1234', 'JPY', 'ja-JP')).toBe(
      new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
      }).format(1234),
    )
  })

  it('preserves integer precision beyond the JavaScript safe integer range', () => {
    expect(formatCurrencyAmount('9007199254740993.25', 'USD', 'en-US')).toBe(
      '$9,007,199,254,740,993.25',
    )
  })
})
