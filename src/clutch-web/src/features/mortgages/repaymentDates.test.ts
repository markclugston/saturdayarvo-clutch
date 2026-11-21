import { describe, expect, it } from 'vitest'
import { finalRepaymentDate, formatMessageDate, parseDate } from './repaymentDates'

describe('finalRepaymentDate (shared vectors with the API)', () => {
  it.each([
    ['2000-01-01', 360, 'Monthly', '2029-12-01'],
    ['2001-01-31', 2, 'Monthly', '2001-02-28'],
    ['2001-01-31', 3, 'Monthly', '2001-03-31'],
    ['2000-01-01', 3, 'Weekly', '2000-01-15'],
    ['2000-01-01', 3, 'Fortnightly', '2000-01-29'],
    ['0001-01-01', 1, 'Monthly', '0001-01-01'],
    ['0004-02-29', 13, 'Monthly', '0005-02-28'],
    ['0050-01-01', 2, 'Weekly', '0050-01-08'],
    ['9999-12-31', 1, 'Monthly', '9999-12-31'],
  ] as const)('%s x %i %s -> %s', (first, periods, frequency, expected) => {
    expect(finalRepaymentDate(first, periods, frequency)).toBe(expected)
  })

  it.each(['Weekly', 'Fortnightly', 'Monthly'] as const)(
    'returns null when %s runs past 31 Dec 9999',
    (frequency) => {
      expect(finalRepaymentDate('2000-01-01', 3_000_000_000, frequency)).toBeNull()
    },
  )

  it('accepts a weekly schedule ending exactly on 31 Dec 9999 and rejects one more period', () => {
    expect(finalRepaymentDate('9999-12-17', 3, 'Weekly')).toBe('9999-12-31')
    expect(finalRepaymentDate('9999-12-17', 4, 'Weekly')).toBeNull()
  })

  it('returns null for unreadable input', () => {
    expect(finalRepaymentDate('01/01/2000', 1, 'Monthly')).toBeNull()
    expect(finalRepaymentDate('2000-01-01', 1.5, 'Monthly')).toBeNull()
    expect(finalRepaymentDate('2000-01-01', 0, 'Monthly')).toBeNull()
  })
})

describe('formatMessageDate', () => {
  it.each([
    ['2000-01-01', '1 Jan 2000'],
    ['0001-01-01', '1 Jan 0001'],
    ['0050-12-09', '9 Dec 0050'],
    ['2029-12-01', '1 Dec 2029'],
  ])('%s -> %s', (value, expected) => {
    expect(formatMessageDate(value)).toBe(expected)
  })
})

describe('parseDate', () => {
  it('rejects impossible and badly shaped dates', () => {
    expect(parseDate('2000-13-45')).toBeNull()
    expect(parseDate('01/01/2000')).toBeNull()
    expect(parseDate('2001-02-29')).toBeNull()
    expect(parseDate('0000-01-01')).toBeNull()
    expect(parseDate('2000-02-29')).toEqual({ year: 2000, month: 2, day: 29 })
  })
})
