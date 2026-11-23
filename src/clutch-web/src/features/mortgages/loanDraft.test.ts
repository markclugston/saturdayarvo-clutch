import { describe, expect, it } from 'vitest'
import {
  currentInterestRate,
  draftToInput,
  draftsEqual,
  emptyDraft,
  formatDisplayDate,
  mapServerErrors,
  mortgageToDraft,
  newRow,
  canEditDisbursalDate,
  openingRowKey,
  validateDraft,
  validateNewRateChange,
  type LoanDraft,
} from './loanDraft'

const today = '2025-06-15'

describe('currentInterestRate', () => {
  it('is the rate with the latest Effective Date on or before today, ignoring future changes', () => {
    const rows = [newRow('5', '2020-01-01'), newRow('6', '2024-01-01'), newRow('7', '2030-01-01')]
    expect(currentInterestRate(rows, today)).toBe('6')
  })

  it('counts a change effective today', () => {
    const rows = [newRow('5', '2020-01-01'), newRow('6.5', today)]
    expect(currentInterestRate(rows, today)).toBe('6.5')
  })

  it('does not depend on row order', () => {
    const rows = [newRow('6', '2024-01-01'), newRow('7', '2030-01-01'), newRow('5', '2020-01-01')]
    expect(currentInterestRate(rows, today)).toBe('6')
  })

  it('ignores rows with an unparseable rate or date', () => {
    const rows = [newRow('5', '2020-01-01'), newRow('abc', '2024-01-01'), newRow('9', '2024-13-01'), newRow('', '')]
    expect(currentInterestRate(rows, today)).toBe('5')
  })

  it('is null when no change is effective on or before today', () => {
    expect(currentInterestRate([], today)).toBeNull()
    expect(currentInterestRate([newRow('7', '2030-01-01')], today)).toBeNull()
  })
})

describe('formatDisplayDate', () => {
  it('formats as day, short month and year without a UTC day shift', () => {
    expect(formatDisplayDate('2025-01-01')).toBe('1 Jan 2025')
    expect(formatDisplayDate('2025-12-31')).toBe('31 Dec 2025')
  })
})

describe('validateNewRateChange', () => {
  function draft(rows = [newRow('5.25', '2000-01-01')]): LoanDraft {
    return {
      ...emptyDraft(),
      name: 'Home',
      openingBalance: '500000',
      duration: '120',
      disbursalDate: '2000-01-01',
      paymentFrequency: 'Monthly',
      rows,
    }
  }

  it.each([
    ['rate above 100', '100.5', '2001-01-01', { newInterestRate: 'Enter an interest rate from 0 to 100' }],
    ['negative rate', '-1', '2001-01-01', { newInterestRate: 'Enter an interest rate from 0 to 100' }],
    ['3 decimal places', '5.005', '2001-01-01', { newInterestRate: 'Enter an interest rate with up to 2 decimal places' }],
    ['missing rate', '', '2001-01-01', { newInterestRate: 'Enter an interest rate' }],
    ['invalid date', '5', '', { effectiveDate: 'Enter a valid date' }],
    ['both empty', '', '', { newInterestRate: 'Enter an interest rate', effectiveDate: 'Enter a valid date' }],
    ['date before disbursal', '5', '1999-12-01', { effectiveDate: 'Choose a date from 1 Jan 2000 to 1 Jan 2010' }],
    ['date after final repayment', '5', '2010-01-02', { effectiveDate: 'Choose a date from 1 Jan 2000 to 1 Jan 2010' }],
    ['duplicate date', '6', '2000-01-01', { effectiveDate: 'This effective date is already used' }],
  ])('%s is refused with the 016 message', (_label, rate, date, expected) => {
    expect(validateNewRateChange(draft(), rate, date, today)).toEqual(expected)
  })

  it('accepts a valid change', () => {
    expect(validateNewRateChange(draft(), '6', '2001-01-01', today)).toEqual({})
  })

  it('does not check the opening rate', () => {
    expect(validateNewRateChange(draft([]), '6', '2001-01-01', today)).toEqual({})
  })

  it('ignores problems on existing rows', () => {
    expect(validateNewRateChange(draft([newRow('101', '2000-01-01')]), '6', '2001-01-01', today)).toEqual({})
  })
})

// Same vectors as MortgageValidatorTests and the integration tests (022 FR-007, SC-006).
describe('final repayment date boundary (disbursal date plus Duration intervals)', () => {
  function header(overrides: Partial<LoanDraft>): LoanDraft {
    return {
      ...emptyDraft(),
      name: 'Home',
      openingBalance: '500000',
      duration: '360',
      disbursalDate: '2000-01-01',
      paymentFrequency: 'Monthly',
      rows: [newRow('5', overrides.disbursalDate ?? '2000-01-01')],
      ...overrides,
    }
  }

  it('accepts the Duration whose last payment is 31 Dec 9999 and refuses the next', () => {
    const lateToday = '9999-12-20'
    const weekly = { disbursalDate: '9999-12-10', paymentFrequency: 'Weekly' as const }

    expect(validateDraft(header({ ...weekly, duration: '3' }), lateToday)).toEqual({})
    expect(validateDraft(header({ ...weekly, duration: '4' }), lateToday).duration)
      .toBe('The final repayment date would be later than 31 Dec 9999')
  })

  it.each([
    ['2029-12-31', {}],
    ['2030-01-01', {}],
    ['2030-01-02', { effectiveDate: 'Choose a date from 1 Jan 2000 to 1 Jan 2030' }],
  ])('Effective Date %s against a 360 Monthly final repayment of 1 Jan 2030', (date, expected) => {
    expect(validateNewRateChange(header({}), '4', date, today)).toEqual(expected)
  })
})

describe('accountId in the draft', () => {
  const mortgage = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Home',
    openingBalance: 100,
    duration: 12,
    disbursalDate: '2000-01-01',
    paymentFrequency: 'Monthly' as const,
    interestRateChanges: [{ newInterestRate: 5, effectiveDate: '2000-01-01' }],
    version: 1,
  }
  const accountId = '11111111-1111-4111-8111-111111111111'

  it('is empty for a new draft and for a mortgage without an account', () => {
    expect(emptyDraft().accountId).toBe('')
    expect(mortgageToDraft(mortgage).accountId).toBe('')
    expect(mortgageToDraft({ ...mortgage, accountId: null }).accountId).toBe('')
  })

  it('is read from the saved mortgage', () => {
    expect(mortgageToDraft({ ...mortgage, accountId }).accountId).toBe(accountId)
  })

  it('takes part in the dirty comparison', () => {
    const saved = mortgageToDraft(mortgage)

    expect(draftsEqual(saved, { ...saved, accountId })).toBe(false)
    expect(draftsEqual(saved, { ...saved })).toBe(true)
  })

  it('maps to the input as the id, or null for none', () => {
    const saved = mortgageToDraft(mortgage)

    expect(draftToInput({ ...saved, accountId }).input.accountId).toBe(accountId)
    expect(draftToInput(saved).input.accountId).toBeNull()
  })

  it('keeps the server accountId error under its own key', () => {
    expect(mapServerErrors({ accountId: 'Choose one of your accounts' }, []))
      .toEqual({ accountId: 'Choose one of your accounts' })
  })
})

describe('openingRowKey', () => {
  it('is the key of the row dated on the Disbursal Date', () => {
    const opening = newRow('5', '2020-01-01')
    const draft = { ...emptyDraft(), disbursalDate: '2020-01-01', rows: [newRow('6', '2021-01-01'), opening] }
    expect(openingRowKey(draft)).toBe(opening.key)
  })

  it('is undefined with no matching row or an empty Disbursal Date', () => {
    expect(openingRowKey({ ...emptyDraft(), disbursalDate: '2020-01-01', rows: [newRow('6', '2021-01-01')] })).toBeUndefined()
    expect(openingRowKey({ ...emptyDraft(), rows: [newRow('6', '')] })).toBeUndefined()
  })
})

describe('canEditDisbursalDate', () => {
  it('is true only when there are no rows', () => {
    expect(canEditDisbursalDate(emptyDraft())).toBe(true)
    expect(canEditDisbursalDate({ ...emptyDraft(), rows: [newRow('5', '2020-01-01')] })).toBe(false)
  })
})
