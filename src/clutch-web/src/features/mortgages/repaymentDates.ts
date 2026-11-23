export type PaymentFrequency = 'Weekly' | 'Fortnightly' | 'Monthly'

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const
const DAY_MS = 86_400_000
const MAX_YEAR = 9999

interface DateParts {
  year: number
  month: number
  day: number
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

// Exactly yyyy-MM-dd, a real calendar date, year 1 to 9999.
export function parseDate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return null
  }
  return { year, month, day }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

function toIso({ year, month, day }: DateParts): string {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

// Never `new Date(y, m, d)`, which maps years 0 to 99 to the 1900s.
function utcMilliseconds({ year, month, day }: DateParts): number {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return date.getTime()
}

function fromUtcMilliseconds(milliseconds: number): DateParts {
  const date = new Date(milliseconds)
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

// "1 Jan 2000"; years below 1000 keep four digits ("1 Jan 0001").
export function formatMessageDate(value: string): string {
  const parts = parseDate(value)
  if (!parts) {
    return value
  }
  return `${parts.day} ${MONTH_NAMES[parts.month - 1] ?? ''} ${pad(parts.year, 4)}`
}

// Date of repayment `periods` (the last of `periods` repayments) as yyyy-MM-dd: the disbursal date plus
// `periods` payment intervals, so repayment 1 is one interval after disbursal. Null when later than
// 31 Dec 9999 or the inputs are invalid. Monthly dates are anchored on the disbursal day, clamped to month end.
export function finalRepaymentDate(
  disbursalDate: string,
  periods: number,
  frequency: PaymentFrequency,
): string | null {
  const first = parseDate(disbursalDate)
  if (!first || !Number.isInteger(periods) || periods < 1) {
    return null
  }

  const steps = periods
  if (frequency === 'Monthly') {
    const maxMonthIndex = MAX_YEAR * 12 + 11
    const firstMonthIndex = first.year * 12 + (first.month - 1)
    if (steps > maxMonthIndex - firstMonthIndex) {
      return null
    }
    const monthIndex = firstMonthIndex + steps
    const year = Math.floor(monthIndex / 12)
    const month = (monthIndex % 12) + 1
    return toIso({ year, month, day: Math.min(first.day, daysInMonth(year, month)) })
  }

  const daysPerPeriod = frequency === 'Weekly' ? 7 : 14
  const startMs = utcMilliseconds(first)
  const maxMs = utcMilliseconds({ year: MAX_YEAR, month: 12, day: 31 })
  const availableSteps = Math.floor((maxMs - startMs) / DAY_MS / daysPerPeriod)
  if (steps > availableSteps) {
    return null
  }
  return toIso(fromUtcMilliseconds(startMs + steps * daysPerPeriod * DAY_MS))
}

// Whole UTC calendar days from `from` to `to` (negative when `to` is earlier); NaN for an unreadable date.
export function daysBetween(from: string, to: string): number {
  const start = parseDate(from)
  const end = parseDate(to)
  if (!start || !end) {
    return Number.NaN
  }
  return Math.round((utcMilliseconds(end) - utcMilliseconds(start)) / DAY_MS)
}
