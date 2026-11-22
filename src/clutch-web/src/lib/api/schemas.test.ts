import { describe, expect, it } from 'vitest'
import {
  AccountSchema,
  ConfirmImportResponseSchema,
  ImportReviewSchema,
  InterestRateChangeSchema,
  MortgageInputSchema,
  MortgageResponseSchema,
  ProblemDetailsSchema,
} from './schemas'

describe('API schemas', () => {
  it('accepts a valid account response with an optional import timestamp', () => {
    const account = AccountSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      description: 'Everyday spending',
      currencyCode: 'AUD',
      lastSuccessfulImportAtUtc: null,
    })

    expect(account.currencyCode).toBe('AUD')
  })

  it('rejects malformed or unsupported account currency data', () => {
    const result = AccountSchema.safeParse({
      id: 'not-a-guid',
      description: 'Everyday spending',
      currencyCode: 'Australian dollars',
    })

    expect(result.success).toBe(false)
  })

  it('accepts standard ProblemDetails extension members', () => {
    const result = ProblemDetailsSchema.parse({
      status: 400,
      title: 'The request is invalid.',
      traceId: 'safe-correlation-value',
    })

    expect(result.status).toBe(400)
    expect(result.traceId).toBe('safe-correlation-value')
  })

  it.each(['2025-01-15T14:00:00Z', '2025-01-15T14:00:00+00:00'])(
    'accepts API timestamp %s across import responses',
    (timestamp) => {
      expect(AccountSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Everyday spending',
        currencyCode: 'AUD',
        lastSuccessfulImportAtUtc: timestamp,
      }).success).toBe(true)
      expect(ImportReviewSchema.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440002',
        accountId: '550e8400-e29b-41d4-a716-446655440000',
        currencyCode: 'AUD',
        rowCount: 1,
        duplicateConfirmationRequired: false,
        expiresAtUtc: timestamp,
        rows: [{
          sourceRowNumber: 2,
          transactionDate: '2025-01-15',
          description: 'Market',
          amount: '10.6',
          direction: 'Outgoing',
          isPossibleDuplicate: false,
        }],
      }).success).toBe(true)
      expect(ConfirmImportResponseSchema.safeParse({
        importedCount: 1,
        completedAtUtc: timestamp,
        settingsSaved: true,
      }).success).toBe(true)
    },
  )

  it('rejects import timestamps without a timezone', () => {
    expect(ConfirmImportResponseSchema.safeParse({
      importedCount: 1,
      completedAtUtc: '2025-01-15T14:00:00',
    }).success).toBe(false)
  })

  describe('mortgage schemas', () => {
    const input = {
      name: 'Home loan',
      openingBalance: 500000.5,
      duration: 360,
      disbursalDate: '2000-01-01',
      paymentFrequency: 'Monthly',
      interestRateChanges: [{ newInterestRate: 5.25, effectiveDate: '2000-01-01' }],
    }

    it('accepts a valid mortgage and response with id and version', () => {
      expect(MortgageInputSchema.safeParse(input).success).toBe(true)
      expect(MortgageResponseSchema.safeParse({
        ...input,
        id: '550e8400-e29b-41d4-a716-446655440000',
        version: 1,
      }).success).toBe(true)
    })

    it('rejects an unknown frequency, bad date, and more than 60 changes', () => {
      expect(MortgageInputSchema.safeParse({ ...input, paymentFrequency: 'Daily' }).success).toBe(false)
      expect(MortgageInputSchema.safeParse({ ...input, disbursalDate: '01/01/2000' }).success).toBe(false)
      expect(InterestRateChangeSchema.safeParse({ newInterestRate: 101, effectiveDate: '2000-01-01' }).success)
        .toBe(false)
      const many = Array.from({ length: 61 }, () => ({ newInterestRate: 1, effectiveDate: '2000-01-01' }))
      expect(MortgageInputSchema.safeParse({ ...input, interestRateChanges: many }).success).toBe(false)
    })

    it('round-trips 999,999,999,999.99 exactly and rejects one cent more', () => {
      const parsed = MortgageInputSchema.parse(
        JSON.parse(JSON.stringify({ ...input, openingBalance: 999999999999.99 })),
      )
      expect(parsed.openingBalance).toBe(999999999999.99)
      expect(String(parsed.openingBalance)).toBe('999999999999.99')
      expect(MortgageInputSchema.safeParse({ ...input, openingBalance: 1000000000000 }).success).toBe(false)
    })
  })
})
