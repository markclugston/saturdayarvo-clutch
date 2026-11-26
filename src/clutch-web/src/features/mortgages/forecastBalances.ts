import type { PaymentFrequency } from './repaymentDates'

/** The reductions in 12 months of each Payment Frequency. */
const WINDOW: Record<PaymentFrequency, number> = { Monthly: 12, Fortnightly: 26, Weekly: 52 }

/**
 * Projects the last Actual Balance forward by the median recent reduction per period.
 * `balances` index i is period i + 1; null or missing is blank. The result is indexed like it, a decimal
 * string on forecast rows and otherwise null. It ends at the first zero or at `rowCount`, and is empty
 * when there is no forecast. Arithmetic is exact, in minor units.
 */
export function forecastBalances(
  balances: readonly (string | null | undefined)[],
  frequency: PaymentFrequency,
  rowCount: number,
): (string | null)[] {
  let last = Math.min(balances.length, rowCount) - 1
  while (last >= 0 && (balances[last] ?? null) === null) {
    last -= 1
  }
  const lastBalance = balances[last]
  if (typeof lastBalance !== 'string' || last === rowCount - 1) {
    return []
  }

  // The newest [previous, current] balance pairs, skipping any pair with a blank.
  const pairs: [string, string][] = []
  for (let index = last; index > 0 && pairs.length < WINDOW[frequency]; index -= 1) {
    const previous = balances[index - 1]
    const current = balances[index]
    if (typeof previous === 'string' && typeof current === 'string') {
      pairs.push([previous, current])
    }
  }
  if (pairs.length === 0) {
    return []
  }

  const scale = Math.max(...[lastBalance, ...pairs.flat()].map(fractionDigits))
  const reduction = median(pairs.map(([previous, current]) => toUnits(previous, scale) - toUnits(current, scale)))
  if (reduction <= 0n) {
    return []
  }

  const forecast: (string | null)[] = new Array<null>(last + 1).fill(null)
  let remaining = toUnits(lastBalance, scale)
  for (let row = last + 1; row < rowCount; row += 1) {
    remaining -= reduction
    if (remaining <= 0n) {
      forecast.push(toAmount(0n, scale))
      break
    }
    forecast.push(toAmount(remaining, scale))
  }
  return forecast
}

function fractionDigits(amount: string): number {
  return amount.split('.')[1]?.length ?? 0
}

function toUnits(amount: string, scale: number): bigint {
  const [whole, fraction = ''] = amount.split('.')
  return BigInt(`${whole}${fraction.padEnd(scale, '0')}`)
}

/** The decimal string of a non-negative number of minor units. */
function toAmount(units: bigint, scale: number): string {
  const digits = units.toString().padStart(scale + 1, '0')
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}

/**
 * The middle value, or the mean of the two middle values rounded half up. Division truncates towards zero,
 * which rounds half up only for a positive mean; a mean of zero or less is never used.
 */
function median(values: bigint[]): bigint {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const upper = sorted[Math.floor(sorted.length / 2)] as bigint
  const lower = sorted[Math.floor((sorted.length - 1) / 2)] as bigint
  return (lower + upper + 1n) / 2n
}
