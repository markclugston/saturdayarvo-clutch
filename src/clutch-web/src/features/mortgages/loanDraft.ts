import type { Mortgage, MortgageInput } from '@/lib/api/schemas'
import {
  finalRepaymentDate,
  formatMessageDate,
  parseDate,
  type PaymentFrequency,
} from './repaymentDates'

export const MAX_RATE_CHANGES = 60
export const MAX_MORTGAGES = 20
const MAX_BALANCE = 999999999999.99
const MAX_PERIODS = 2147483647

export type RateRowDraft = { key: string; rate: string; date: string }

export type LoanDraft = {
  name: string
  openingBalance: string
  duration: string
  drawdownDate: string
  paymentFrequency: PaymentFrequency | ''
  rows: RateRowDraft[]
}

/** Messages keyed like the API: `name`, `openingBalance`, ..., `interestRateChanges`, `{rowKey}.newInterestRate`. */
export type DraftErrors = Record<string, string>

let rowCounter = 0

export function newRow(rate = '', date = ''): RateRowDraft {
  rowCounter += 1
  return { key: `row-${rowCounter}`, rate, date }
}

export function emptyDraft(): LoanDraft {
  return {
    name: '',
    openingBalance: '',
    duration: '',
    drawdownDate: '',
    paymentFrequency: '',
    rows: [],
  }
}

export function mortgageToDraft(mortgage: Mortgage): LoanDraft {
  return {
    name: mortgage.name,
    openingBalance: String(mortgage.openingBalance),
    duration: String(mortgage.duration),
    drawdownDate: mortgage.drawdownDate,
    paymentFrequency: mortgage.paymentFrequency,
    rows: mortgage.interestRateChanges.map((change) =>
      newRow(String(change.newInterestRate), change.effectiveDate)),
  }
}

export function draftsEqual(left: LoanDraft, right: LoanDraft): boolean {
  return left.name === right.name
    && left.openingBalance === right.openingBalance
    && left.duration === right.duration
    && left.drawdownDate === right.drawdownDate
    && left.paymentFrequency === right.paymentFrequency
    && left.rows.length === right.rows.length
    && left.rows.every((row, index) =>
      row.rate === right.rows[index]?.rate && row.date === right.rows[index]?.date)
}

export function isEmptyRow(row: RateRowDraft): boolean {
  return row.rate.trim() === '' && row.date.trim() === ''
}

export function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${String(now.getFullYear()).padStart(4, '0')}-${month}-${day}`
}

function parseNumber(value: string): number | null {
  const text = value.trim()
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(text)) {
    return null
  }
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function decimalPlaces(value: string): number {
  const fraction = value.trim().split('.')[1] ?? ''
  return fraction.replace(/0+$/, '').length
}

export function validateDraft(draft: LoanDraft, today: string): DraftErrors {
  const errors: DraftErrors = {}

  const name = draft.name.trim()
  if (name === '') {
    errors.name = 'Enter a name'
  } else if (name.length > 100) {
    errors.name = 'Enter a name of up to 100 characters'
  }

  const balance = parseNumber(draft.openingBalance)
  if (balance === null || balance <= 0) {
    errors.openingBalance = 'Enter a opening balance greater than 0'
  } else if (balance > MAX_BALANCE) {
    errors.openingBalance = 'Enter a opening balance up to 999,999,999,999.99'
  } else if (decimalPlaces(draft.openingBalance) > 2) {
    errors.openingBalance = 'Enter a opening balance with up to 2 decimal places'
  }

  if (parseDate(draft.drawdownDate) === null) {
    errors.drawdownDate = 'Enter a valid date'
  } else if (draft.drawdownDate > today) {
    errors.drawdownDate = 'Enter a date that is not in the future'
  }

  if (draft.paymentFrequency === '') {
    errors.paymentFrequency = 'Choose Weekly, Fortnightly or Monthly'
  }

  const periods = parseNumber(draft.duration)
  const tooLate = 'The final repayment date would be later than 31 Dec 9999'
  if (periods === null || !Number.isInteger(periods) || periods < 1) {
    errors.duration = 'Enter a whole number of 1 or more'
  } else if (periods > MAX_PERIODS) {
    errors.duration = tooLate
  } else if (!errors.drawdownDate && draft.paymentFrequency !== ''
    && finalRepaymentDate(draft.drawdownDate, periods, draft.paymentFrequency) === null) {
    errors.duration = tooLate
  }

  const headerValid = !errors.drawdownDate && !errors.duration && !errors.paymentFrequency
  const final = headerValid && periods !== null && draft.paymentFrequency !== ''
    ? finalRepaymentDate(draft.drawdownDate, periods, draft.paymentFrequency)
    : null

  const rows = draft.rows.filter((row) => !isEmptyRow(row))
  if (rows.length > MAX_RATE_CHANGES) {
    errors.interestRateChanges = `A mortgage can have up to ${MAX_RATE_CHANGES} interest rate changes`
  }

  const usedDates = new Map<string, number>()
  for (const row of rows) {
    if (parseDate(row.date) !== null) {
      usedDates.set(row.date, (usedDates.get(row.date) ?? 0) + 1)
    }
  }

  let openingRateFound = false
  for (const row of rows) {
    const rateKey = `${row.key}.newInterestRate`
    const dateKey = `${row.key}.effectiveDate`
    const rate = parseNumber(row.rate)
    if (rate === null) {
      errors[rateKey] = 'Enter an interest rate'
    } else if (rate < 0 || rate > 100) {
      errors[rateKey] = 'Enter an interest rate from 0 to 100'
    } else if (decimalPlaces(row.rate) > 2) {
      errors[rateKey] = 'Enter an interest rate with up to 2 decimal places'
    }

    const dateValid = parseDate(row.date) !== null
    if (!dateValid) {
      errors[dateKey] = 'Enter a valid date'
    } else if ((usedDates.get(row.date) ?? 0) > 1) {
      errors[dateKey] = 'This effective date is already used'
    } else if (final !== null && (row.date < draft.drawdownDate || row.date > final)) {
      errors[dateKey] =
        `Choose a date from ${formatMessageDate(draft.drawdownDate)} to ${formatMessageDate(final)}`
    }

    if (dateValid && rate !== null && row.date === draft.drawdownDate) {
      openingRateFound = true
    }
  }

  if (headerValid && !errors.interestRateChanges && !openingRateFound) {
    errors.interestRateChanges =
      'Add the opening interest rate, effective on the drawdown date'
  }

  return errors
}

/** True when Drawdown Date, Duration and Payment Frequency are all valid. */
export function headerIsValid(draft: LoanDraft, today: string): boolean {
  const errors = validateDraft({ ...draft, rows: [] }, today)
  return !errors.drawdownDate && !errors.duration && !errors.paymentFrequency
}

/** Empty rows are dropped. `rowKeys[i]` is the screen row that became `interestRateChanges[i]`. */
export function draftToInput(draft: LoanDraft): { input: MortgageInput; rowKeys: string[] } {
  const rows = draft.rows.filter((row) => !isEmptyRow(row))
  return {
    input: {
      name: draft.name.trim(),
      openingBalance: Number(draft.openingBalance.trim()),
      duration: Number(draft.duration.trim()),
      drawdownDate: draft.drawdownDate,
      paymentFrequency: draft.paymentFrequency as PaymentFrequency,
      interestRateChanges: rows.map((row) => ({
        newInterestRate: Number(row.rate.trim()),
        effectiveDate: row.date,
      })),
    },
    rowKeys: rows.map((row) => row.key),
  }
}

export function mapServerErrors(
  serverErrors: Record<string, string>,
  rowKeys: string[],
): DraftErrors {
  const mapped: DraftErrors = {}
  for (const [key, message] of Object.entries(serverErrors)) {
    const match = /^interestRateChanges\[(\d+)\]\.(newInterestRate|effectiveDate)$/.exec(key)
    if (match) {
      const rowKey = rowKeys[Number(match[1])]
      mapped[rowKey ? `${rowKey}.${match[2]}` : 'interestRateChanges'] = message
    } else {
      mapped[key] = message
    }
  }
  return mapped
}

/**
 * The rate in force on `today`: the rate of the row with the latest valid Effective Date on or before
 * `today`. Rows with an unreadable rate or date are ignored. Null when none applies.
 */
export function currentInterestRate(rows: RateRowDraft[], today: string): string | null {
  let current: RateRowDraft | null = null
  for (const row of rows) {
    if (parseDate(row.date) === null || parseNumber(row.rate) === null || row.date > today) {
      continue
    }
    if (current === null || row.date > current.date) {
      current = row
    }
  }
  return current ? current.rate.trim() : null
}

/** `2025-01-01` -> `1 Jan 2025`, read as a calendar date (no time zone shift). */
export function formatDisplayDate(date: string): string {
  return formatMessageDate(date)
}

/**
 * Checks a change about to be added with 016's row rules by validating the draft with it appended,
 * returning only the candidate's errors. The 60-change limit is enforced by disabling Add.
 */
export function validateNewRateChange(
  draft: LoanDraft,
  rate: string,
  date: string,
  today: string,
): { newInterestRate?: string; effectiveDate?: string } {
  // validateDraft skips fully empty rows; an unreadable date keeps a blank candidate in the checks.
  const candidate: RateRowDraft = {
    key: '__candidate',
    rate,
    date: rate.trim() === '' && date.trim() === '' ? 'blank' : date,
  }
  const errors = validateDraft({ ...draft, rows: [...draft.rows, candidate] }, today)
  const result: { newInterestRate?: string; effectiveDate?: string } = {}
  const rateError = errors[`${candidate.key}.newInterestRate`]
  const dateError = errors[`${candidate.key}.effectiveDate`]
  if (rateError) {
    result.newInterestRate = rateError
  }
  if (dateError) {
    result.effectiveDate = dateError
  }
  return result
}
