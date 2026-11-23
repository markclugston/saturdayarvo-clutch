import { describe, expect, it } from 'vitest'
import { daysBetween, finalRepaymentDate, formatMessageDate, parseDate } from './repaymentDates'

// Payment N is the disbursal date plus N intervals (022 FR-007).
describe('finalRepaymentDate (shared vectors with the API)', () => {
  it.each([
    ['2023-11-29', 1, 'Monthly', '2023-12-29'],
    ['2023-11-29', 360, 'Monthly', '2053-11-29'],
    ['2000-01-01', 360, 'Monthly', '2030-01-01'],
    ['2024-01-31', 1, 'Monthly', '2024-02-29'],
    ['2024-01-31', 2, 'Monthly', '2024-03-31'],
    ['2024-01-31', 3, 'Monthly', '2024-04-30'],
    ['2000-01-01', 3, 'Weekly', '2000-01-22'],
    ['2000-01-01', 3, 'Fortnightly', '2000-02-12'],
    ['0001-01-01', 1, 'Monthly', '0001-02-01'],
    ['0004-02-29', 12, 'Monthly', '0005-02-28'],
    ['0050-01-01', 1, 'Weekly', '0050-01-08'],
    ['9999-10-31', 2, 'Monthly', '9999-12-31'],
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
    expect(finalRepaymentDate('9999-12-10', 3, 'Weekly')).toBe('9999-12-31')
    expect(finalRepaymentDate('9999-12-10', 4, 'Weekly')).toBeNull()
    expect(finalRepaymentDate('9999-12-17', 3, 'Weekly')).toBeNull()
  })

  it('returns null one month past December 9999', () => {
    expect(finalRepaymentDate('9999-12-01', 1, 'Monthly')).toBeNull()
    expect(finalRepaymentDate('9999-10-31', 3, 'Monthly')).toBeNull()
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

describe('daysBetween', () => {
  it.each([
    ['2023-12-29', '2024-01-29', 31],
    ['2024-02-28', '2024-03-01', 2],
    ['2023-02-28', '2023-03-01', 1],
    ['2024-05-05', '2024-05-05', 0],
    ['0050-01-01', '0050-01-08', 7],
    ['2024-01-08', '2024-01-01', -7],
  ])('%s to %s is %i days', (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected)
  })
})
