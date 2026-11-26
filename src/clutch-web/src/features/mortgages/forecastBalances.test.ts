import { describe, expect, it } from 'vitest'
import { forecastBalances } from './forecastBalances'

/** 2-decimal balances starting at `start` dollars and falling by each reduction in turn. */
function falling(start: number, reductions: number[]): string[] {
  const balances = [start]
  for (const reduction of reductions) {
    balances.push((balances.at(-1) as number) - reduction)
  }
  return balances.map((balance) => balance.toFixed(2))
}

/** The first forecast value, or undefined without a forecast. */
function firstForecast(result: (string | null)[]) {
  return result.find((value) => value !== null)
}

describe('forecastBalances', () => {
  it.each([
    ['Monthly', 12],
    ['Fortnightly', 26],
    ['Weekly', 52],
  ] as const)('uses only the newest %s window of %i reductions', (frequency, window) => {
    // Inside the window: half 10 and half 20, median 15. One more (older) 10 would make the median 10.
    const reductions = [10, ...Array<number>(window / 2).fill(10), ...Array<number>(window / 2).fill(20)]
    const balances = falling(10000, reductions)
    const last = Number(balances.at(-1))

    const result = forecastBalances(balances, frequency, balances.length + 2)

    expect(result).toHaveLength(balances.length + 2)
    expect(result.slice(0, balances.length)).toEqual(Array(balances.length).fill(null))
    expect(result.slice(balances.length)).toEqual([(last - 15).toFixed(2), (last - 30).toFixed(2)])
  })

  it('projects 13 monthly balances by the median of their 12 reductions', () => {
    const balances = falling(5000, [10, 90, 20, 80, 30, 70, 40, 60, 50, 50, 45, 55])

    const result = forecastBalances(balances, 'Monthly', 15)

    // 600 repaid leaves 4,400; the median is 50.
    expect(result.slice(13)).toEqual(['4350.00', '4300.00'])
  })

  it('uses every reduction when fewer than the window holds, even only one', () => {
    expect(forecastBalances(['1000.00', '900.00'], 'Weekly', 4)).toEqual([null, null, '800.00', '700.00'])
  })

  it('takes the middle reduction of an odd count', () => {
    expect(firstForecast(forecastBalances(falling(1000, [10, 40, 20]), 'Monthly', 5))).toBe('910.00')
  })

  it('rounds the mean of the two middle reductions half up to the minor unit', () => {
    // Reductions 0.01 and 0.02: the mean 0.015 rounds to 0.02.
    expect(forecastBalances(['1.00', '0.99', '0.97'], 'Monthly', 4)).toEqual([null, null, null, '0.95'])
    // Reductions 0.00 and 0.01: the mean 0.005 rounds to 0.01.
    expect(forecastBalances(['1.00', '1.00', '0.99'], 'Monthly', 4)).toEqual([null, null, null, '0.98'])
  })

  it('counts negative and zero reductions in a positive median', () => {
    // Median of -50, 0, 10, 20, 30 is 10; without the first two it would be 20.
    expect(firstForecast(forecastBalances(falling(1000, [-50, 0, 10, 20, 30]), 'Monthly', 7))).toBe('980.00')
  })

  it.each([
    ['zero', ['100.00', '100.00', '100.00', '90.00']],
    ['negative', ['100.00', '110.00', '120.00', '115.00']],
  ])('has no forecast when the median is %s', (_, balances) => {
    expect(forecastBalances(balances, 'Monthly', 12)).toEqual([])
  })

  it('has no forecast for mostly repeated balances, such as weekly rows with monthly repayments', () => {
    const balances = ['1000.00', '1000.00', '1000.00', '1000.00', '900.00', '900.00', '900.00', '900.00', '800.00']

    expect(forecastBalances(balances, 'Weekly', 52)).toEqual([])
  })

  it('excludes pairs with a blank', () => {
    // Only 900 to 890 is a reduction.
    expect(forecastBalances(['1000.00', null, '900.00', '890.00'], 'Monthly', 5))
      .toEqual([null, null, null, null, '880.00'])
  })

  it('starts after the last non-blank row, ignoring trailing blanks', () => {
    expect(forecastBalances(['100.00', '90.00', null, null], 'Monthly', 4)).toEqual([null, null, '80.00', '70.00'])
  })

  it('ignores balances beyond the row count and adds no row', () => {
    expect(forecastBalances(['1000.00', '990.00', null, '1.00'], 'Monthly', 3)).toEqual([null, null, '980.00'])
    expect(forecastBalances(['1000.00', '990.00', '500.00'], 'Monthly', 2)).toEqual([])
  })

  it.each([
    ['no balances', []],
    ['only blanks', [null, null]],
    ['a single balance', ['100.00']],
    ['no pair of adjacent balances', ['100.00', null, '90.00']],
  ])('has no forecast with %s', (_, balances) => {
    expect(forecastBalances(balances, 'Monthly', 12)).toEqual([])
  })

  it('shows one zero when the forecast reaches it exactly, then ends', () => {
    expect(forecastBalances(['30.00', '20.00'], 'Monthly', 8)).toEqual([null, null, '10.00', '0.00'])
  })

  it('shows zero for the first result below zero, then ends', () => {
    expect(forecastBalances(['25.00', '15.00'], 'Monthly', 8)).toEqual([null, null, '5.00', '0.00'])
  })

  it('stops at the final row while still above zero', () => {
    expect(forecastBalances(['1000.00', '900.00'], 'Monthly', 3)).toEqual([null, null, '800.00'])
  })

  it('has no forecast when the last balance is on the final row', () => {
    expect(forecastBalances(['1000.00', '900.00'], 'Monthly', 2)).toEqual([])
  })

  it.each([
    ['zero', ['10.00', '0.00']],
    ['negative', ['0.00', '-5.00']],
    ['negative, under one unit', ['0.00', '-0.50']],
  ])('shows zero on the next row after a %s last balance with a positive median', (_, balances) => {
    expect(forecastBalances(balances, 'Monthly', 8)).toEqual([null, null, '0.00'])
  })

  it('keeps 0-decimal amounts whole', () => {
    // Reductions 5 and 6: the mean 5.5 rounds to 6.
    expect(forecastBalances(['20', '15', '9'], 'Monthly', 8)).toEqual([null, null, null, '3', '0'])
  })

  it('keeps 3-decimal amounts exact', () => {
    expect(forecastBalances(['10.000', '9.995'], 'Monthly', 4)).toEqual([null, null, '9.990', '9.985'])
  })

  it('is exact to the cent for large amounts', () => {
    expect(forecastBalances(['99999999999999.99', '99999999999999.98'], 'Monthly', 3))
      .toEqual([null, null, '99999999999999.97'])
  })
})
