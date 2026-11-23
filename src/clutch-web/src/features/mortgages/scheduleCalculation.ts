import { daysBetween, finalRepaymentDate, type PaymentFrequency } from './repaymentDates'

export type ScheduleInputs = {
  openingBalanceCents: number
  /** yyyy-MM-dd */
  disbursalDate: string
  duration: number
  paymentFrequency: PaymentFrequency
  rateChanges: { annualRatePercent: number; effectiveDate: string }[]
}

export type ScheduledPeriod = {
  period: number
  /** yyyy-MM-dd */
  date: string
  openingCents: number
  interestCents: number
  repaymentCents: number
  closingCents: number
}

const PERIODS_PER_YEAR: Record<PaymentFrequency, number> = { Weekly: 52, Fortnightly: 26, Monthly: 12 }
const AFTER_ALL_DATES = '9999-99-99'

/** Half away from zero (FR-007). */
function roundCents(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

/** Level principal and interest repayment of `balance` over `periods` at the periodic rate `rate`. */
function levelRepayment(balance: number, rate: number, periods: number): number {
  return rate === 0
    ? roundCents(balance / periods)
    : roundCents((balance * rate) / (1 - (1 + rate) ** -periods))
}

/**
 * Principal and interest schedule in integer cents: a level repayment recalculated at the first period that
 * accrues wholly at a newly effective rate, interest blended by days in a period that contains a rate change,
 * and a last repayment that closes the balance at 0 (research R1-R3). Null when it cannot be calculated;
 * never throws.
 */
export function calculateSchedule(inputs: ScheduleInputs): ScheduledPeriod[] | null {
  const { openingBalanceCents, disbursalDate, duration, paymentFrequency, rateChanges } = inputs
  if (!Number.isFinite(openingBalanceCents) || openingBalanceCents <= 0
    || !Number.isInteger(duration) || duration < 1 || rateChanges.length === 0) {
    return null
  }
  const perYear = PERIODS_PER_YEAR[paymentFrequency]
  const changes = [...rateChanges].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))

  const dates: string[] = [disbursalDate]
  for (let period = 1; period <= duration; period += 1) {
    const date = finalRepaymentDate(disbursalDate, period, paymentFrequency)
    if (date === null) {
      return null
    }
    dates.push(date)
  }

  const periodicRate = (annualPercent: number) => annualPercent / 100 / perYear
  const result: ScheduledPeriod[] = []
  let rateIndex = -1
  let opening = openingBalanceCents
  let repayment = 0
  // Start date of the period in which the repayment was last calculated.
  let calculatedFrom = disbursalDate

  for (let period = 1; period <= duration; period += 1) {
    const start = dates[period - 1] ?? ''
    const end = dates[period] ?? ''
    while (rateIndex + 1 < changes.length && (changes[rateIndex + 1]?.effectiveDate ?? '') <= start) {
      rateIndex += 1
    }
    const startRate = changes[rateIndex]
    if (!startRate) {
      return null
    }

    // Day-weighted periodic rate over [start, end).
    let weighted = periodicRate(startRate.annualRatePercent)
    let wholePeriod = true
    let next = rateIndex + 1
    if ((changes[next]?.effectiveDate ?? AFTER_ALL_DATES) < end) {
      wholePeriod = false
      let segmentStart = start
      let segmentRate = startRate.annualRatePercent
      let sum = 0
      while (next < changes.length && (changes[next]?.effectiveDate ?? AFTER_ALL_DATES) < end) {
        const change = changes[next]
        if (!change) {
          return null
        }
        sum += periodicRate(segmentRate) * daysBetween(segmentStart, change.effectiveDate)
        segmentStart = change.effectiveDate
        segmentRate = change.annualRatePercent
        next += 1
      }
      sum += periodicRate(segmentRate) * daysBetween(segmentStart, end)
      weighted = sum / daysBetween(start, end)
    }

    const interest = roundCents(opening * weighted)
    if (period === 1 || (wholePeriod && calculatedFrom < startRate.effectiveDate)) {
      repayment = levelRepayment(opening, periodicRate(startRate.annualRatePercent), duration - period + 1)
      calculatedFrom = start
    }
    const owed = opening + interest
    const paid = period === duration ? owed : Math.min(repayment, owed)
    const closing = owed - paid
    if (![interest, paid, closing].every(Number.isFinite)) {
      return null
    }
    result.push({ period, date: end, openingCents: opening, interestCents: interest, repaymentCents: paid, closingCents: closing })
    opening = closing
  }
  return result
}
