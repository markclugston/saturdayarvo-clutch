import { describe, expect, it } from 'vitest'
import { calculateSchedule, type ScheduleInputs } from './scheduleCalculation'
import { daysBetween, finalRepaymentDate } from './repaymentDates'

function inputs(patch: Partial<ScheduleInputs> = {}): ScheduleInputs {
  return {
    openingBalanceCents: 50_000_000,
    disbursalDate: '2023-11-29',
    duration: 360,
    paymentFrequency: 'Monthly',
    rateChanges: [{ annualRatePercent: 6, effectiveDate: '2023-11-29' }],
    ...patch,
  }
}

function schedule(patch: Partial<ScheduleInputs> = {}) {
  const result = calculateSchedule(inputs(patch))
  expect(result).not.toBeNull()
  return result ?? []
}

function expectInvariants(periods: ReturnType<typeof schedule>) {
  expect(periods[periods.length - 1]?.closingCents).toBe(0)
  for (const period of periods) {
    expect(period.closingCents).toBeGreaterThanOrEqual(0)
    expect(period.closingCents).toBe(period.openingCents + period.interestCents - period.repaymentCents)
  }
}

describe('calculateSchedule: single rate (US1)', () => {
  it('matches the spec example for $500,000.00, 360 Monthly, 6.00%', () => {
    const periods = schedule()
    expect(periods).toHaveLength(360)
    expect(periods[0]).toMatchObject({
      period: 1,
      date: '2023-12-29',
      openingCents: 50_000_000,
      interestCents: 250_000,
      repaymentCents: 299_775,
      closingCents: 49_950_225,
    })
    expect(periods[1]?.closingCents).toBe(49_900_201)
    expect(periods[359]?.closingCents).toBe(0)
    expect(periods[359]?.repaymentCents).toBe(300_044)
    expectInvariants(periods)
    for (let index = 1; index < periods.length; index += 1) {
      expect(periods[index]?.closingCents).toBeLessThanOrEqual(periods[index - 1]?.closingCents ?? 0)
    }
  })

  it('dates each period like finalRepaymentDate', () => {
    const periods = schedule({ paymentFrequency: 'Weekly', duration: 10 })
    periods.forEach((period, index) => {
      expect(period.date).toBe(finalRepaymentDate('2023-11-29', index + 1, 'Weekly'))
    })
  })

  it.each([
    ['Weekly', 52, 1560],
    ['Fortnightly', 26, 780],
  ] as const)('%s uses annual rate / %i and ends at 0', (paymentFrequency, perYear, duration) => {
    const periods = schedule({ paymentFrequency, duration })
    expect(periods[0]?.interestCents).toBe(Math.round(50_000_000 * 0.06 / perYear))
    expectInvariants(periods)
  })

  it('repays equally at 0%', () => {
    const periods = schedule({
      openingBalanceCents: 120_000,
      duration: 12,
      rateChanges: [{ annualRatePercent: 0, effectiveDate: '2023-11-29' }],
    })
    expect(periods.every((period) => period.interestCents === 0 && period.repaymentCents === 10_000)).toBe(true)
    expect(periods[11]?.closingCents).toBe(0)
  })

  it('handles Duration 1', () => {
    const periods = schedule({ duration: 1 })
    expect(periods).toHaveLength(1)
    expect(periods[0]).toMatchObject({ interestCents: 250_000, repaymentCents: 50_250_000, closingCents: 0 })
  })

  it('handles a 100% rate', () => {
    expectInvariants(schedule({
      duration: 24,
      rateChanges: [{ annualRatePercent: 100, effectiveDate: '2023-11-29' }],
    }))
  })

  it('rounds half away from zero', () => {
    // 1,500 cents * 6% / 12 = 7.5 cents -> 8
    const periods = schedule({ openingBalanceCents: 1_500, duration: 2 })
    expect(periods[0]?.interestCents).toBe(8)
  })

  it('stops at 0 and never goes negative when rounding repays early', () => {
    // $1.80 over 360 periods at 0%: each repayment rounds to 1 cent, so the balance is repaid by period 180.
    const periods = schedule({
      openingBalanceCents: 180,
      rateChanges: [{ annualRatePercent: 0, effectiveDate: '2023-11-29' }],
    })
    expect(periods).toHaveLength(360)
    expectInvariants(periods)
    expect(periods.some((period) => period.closingCents === 0 && period.period < 360)).toBe(true)
  })

  it('returns null for unparseable or non-finite inputs and never throws', () => {
    expect(calculateSchedule(inputs({ disbursalDate: 'nope' }))).toBeNull()
    expect(calculateSchedule(inputs({ openingBalanceCents: Number.NaN }))).toBeNull()
    expect(calculateSchedule(inputs({ duration: 0 }))).toBeNull()
    expect(calculateSchedule(inputs({ rateChanges: [] }))).toBeNull()
    expect(calculateSchedule(inputs({
      rateChanges: [{ annualRatePercent: Number.NaN, effectiveDate: '2023-11-29' }],
    }))).toBeNull()
  })

  it('calculates 1,560 weekly periods well under 500 ms', () => {
    const start = performance.now()
    schedule({ paymentFrequency: 'Weekly', duration: 1560 })
    expect(performance.now() - start).toBeLessThan(500)
  })
})

describe('calculateSchedule: rate changes (US2)', () => {
  const change = (annualRatePercent: number, effectiveDate: string) => ({ annualRatePercent, effectiveDate })

  it('applies 5.50% from period 25 and recalculates the repayment over the remaining 336', () => {
    const date24 = finalRepaymentDate('2023-11-29', 24, 'Monthly') ?? ''
    const periods = schedule({ rateChanges: [change(6, '2023-11-29'), change(5.5, date24)] })
    const single = schedule()
    expect(periods[23]?.closingCents).toBe(single[23]?.closingCents)
    expect(periods[23]?.repaymentCents).toBe(single[23]?.repaymentCents)
    const opening = periods[23]?.closingCents ?? 0
    const r = 0.055 / 12
    expect(periods[24]?.interestCents).toBe(Math.round(opening * r))
    expect(periods[24]?.repaymentCents).toBe(Math.round(opening * r / (1 - (1 + r) ** -336)))
    expectInvariants(periods)
  })

  it('blends interest by days in the period that contains the change', () => {
    const periods = schedule({
      disbursalDate: '2023-12-29',
      duration: 12,
      rateChanges: [change(6, '2023-12-29'), change(5, '2024-01-08')],
    })
    const opening = periods[0]?.openingCents ?? 0
    expect(daysBetween('2023-12-29', '2024-01-29')).toBe(31)
    expect(periods[0]?.interestCents).toBe(Math.round(opening * (0.06 / 12 * 10 / 31 + 0.05 / 12 * 21 / 31)))
    expectInvariants(periods)
  })

  it('uses three segments for two changes in one period', () => {
    const periods = schedule({
      disbursalDate: '2023-12-29',
      duration: 12,
      rateChanges: [change(6, '2023-12-29'), change(5, '2024-01-08'), change(4, '2024-01-18')],
    })
    const opening = periods[0]?.openingCents ?? 0
    const expected = Math.round(opening * (0.06 / 12 * 10 / 31 + 0.05 / 12 * 10 / 31 + 0.04 / 12 * 11 / 31))
    expect(periods[0]?.interestCents).toBe(expected)
    expectInvariants(periods)
  })

  it('handles a change inside period 1: P1 repayment at the Disbursal Date rate, recalculated from P2', () => {
    const periods = schedule({
      disbursalDate: '2023-12-29',
      duration: 12,
      rateChanges: [change(6, '2023-12-29'), change(5, '2024-01-08')],
    })
    const single = schedule({ disbursalDate: '2023-12-29', duration: 12 })
    expect(periods[0]?.repaymentCents).toBe(single[0]?.repaymentCents)
    const opening = periods[1]?.openingCents ?? 0
    const r = 0.05 / 12
    expect(periods[1]?.repaymentCents).toBe(Math.round(opening * r / (1 - (1 + r) ** -11)))
  })

  it('ignores a change on the final repayment date', () => {
    const final = finalRepaymentDate('2023-11-29', 360, 'Monthly') ?? ''
    const periods = schedule({ rateChanges: [change(6, '2023-11-29'), change(9, final)] })
    expect(periods).toEqual(schedule())
  })

  it('lets the balance rise after a mid-period rise above the kept repayment, then recalculates', () => {
    const periods = schedule({
      openingBalanceCents: 1_000_000,
      duration: 12,
      disbursalDate: '2023-12-29',
      rateChanges: [change(0, '2023-12-29'), change(100, '2024-01-10')],
    })
    expect(periods[0]?.interestCents).toBeGreaterThan(0)
    expect(periods[0]?.closingCents).toBeGreaterThan((periods[0]?.openingCents ?? 0) - (periods[0]?.repaymentCents ?? 0))
    expectInvariants(periods)
  })

  it('charges the day-weighted interest in every period (SC-003)', () => {
    const rateChanges = [change(6, '2023-11-29'), change(7.25, '2025-03-15'), change(4.5, '2027-01-01')]
    const periods = schedule({ rateChanges })
    const rateAt = (date: string) =>
      rateChanges.filter((item) => item.effectiveDate <= date).at(-1)?.annualRatePercent ?? 0
    periods.forEach((period, index) => {
      const start = index === 0 ? '2023-11-29' : periods[index - 1]?.date ?? ''
      const length = daysBetween(start, period.date)
      let weighted = 0
      for (let day = 0; day < length; day += 1) {
        const date = new Date(Date.UTC(
          Number(start.slice(0, 4)),
          Number(start.slice(5, 7)) - 1,
          Number(start.slice(8)) + day,
        ))
        weighted += rateAt(date.toISOString().slice(0, 10)) / 100 / 12
      }
      expect(Math.abs(period.interestCents - period.openingCents * (weighted / length))).toBeLessThanOrEqual(1)
    })
    expectInvariants(periods)
  })
})
