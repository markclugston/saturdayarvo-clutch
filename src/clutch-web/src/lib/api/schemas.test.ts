import { describe, expect, it } from 'vitest'
import {
  AccountSchema,
  ConfirmImportResponseSchema,
  ImportReviewSchema,
  ProblemDetailsSchema,
} from './schemas'

describe('API schemas', () => {
  it('accepts a valid account response with an optional import timestamp', () => {
    const account = AccountSchema.parse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      familyId: '550e8400-e29b-41d4-a716-446655440001',
      description: 'Everyday spending',
      currencyCode: 'AUD',
      lastSuccessfulImportAtUtc: null,
    })

    expect(account.currencyCode).toBe('AUD')
  })

  it('rejects malformed or unsupported account currency data', () => {
    const result = AccountSchema.safeParse({
      id: 'not-a-guid',
      familyId: '550e8400-e29b-41d4-a716-446655440001',
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
        familyId: '550e8400-e29b-41d4-a716-446655440001',
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
      }).success).toBe(true)
    },
  )

  it('rejects import timestamps without a timezone', () => {
    expect(ConfirmImportResponseSchema.safeParse({
      importedCount: 1,
      completedAtUtc: '2025-01-15T14:00:00',
    }).success).toBe(false)
  })
})
