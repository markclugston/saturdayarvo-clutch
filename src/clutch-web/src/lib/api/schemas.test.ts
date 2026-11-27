import { describe, expect, it } from 'vitest'
import {
  AccountSchema,
  AssetInputSchema,
  AssetListSchema,
  ConfirmImportResponseSchema,
  CurrencySchema,
  EditLeaseSchema,
  EditStatusSchema,
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

describe('asset schemas', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000'
  const input = (value: number) => ({
    name: 'House',
    description: null,
    currencyCode: 'AUD',
    valuations: [{ value, valuationDate: '2026-01-01' }],
  })

  it('round-trips the value cap exactly and rejects one cent more', () => {
    const parsed = AssetInputSchema.parse(input(999999999999.99))

    expect(JSON.stringify(parsed)).toContain('999999999999.99')
    expect(parsed.valuations[0]?.value.toFixed(2)).toBe('999999999999.99')
    expect(AssetInputSchema.safeParse(input(1000000000000)).success).toBe(false)
  })

  it('keeps a total beyond exact number range as the exact string', () => {
    const list = AssetListSchema.parse({
      assets: [],
      totals: [
        { currencyCode: 'USD', totalValue: '109999999999998900.01' },
        { currencyCode: 'JPY', totalValue: '5000' },
      ],
    })

    expect(list.totals.map((total) => total.totalValue)).toEqual(['109999999999998900.01', '5000'])
  })

  it('rejects a numeric total', () => {
    expect(AssetListSchema.safeParse({
      assets: [], totals: [{ currencyCode: 'AUD', totalValue: 5 }],
    }).success).toBe(false)
  })

  it('needs an asset currency on list items and inputs', () => {
    const item = {
      id, name: 'House', description: null, latestValuation: { value: 1, valuationDate: '2026-01-01' },
    }

    expect(AssetListSchema.safeParse({ assets: [item], totals: [] }).success).toBe(false)
    expect(AssetListSchema.safeParse({ assets: [{ ...item, currencyCode: 'AUD' }], totals: [] }).success).toBe(true)
    expect(AssetInputSchema.safeParse({ ...input(1), currencyCode: '' }).success).toBe(false)
  })

  it('reads an edit lease with server timestamps', () => {
    expect(EditLeaseSchema.safeParse({
      editId: id,
      expiresAtUtc: '2026-11-27T12:05:00.1234567+00:00',
      serverTimeUtc: '2026-11-27T12:00:00.1234567+00:00',
      asset: { id, name: 'House', description: null, currencyCode: 'AUD', valuations: [] },
    }).success).toBe(true)
  })

  it('reads each edit status shape, with no end-eligibility flag', () => {
    const blocked = EditStatusSchema.parse({
      assetId: id,
      availability: 'Blocked',
      activeEdit: { id, expiresAtUtc: '2026-11-27T12:05:00+00:00' },
      watchedEdit: null,
    })
    expect(blocked.activeEdit).toEqual({ id, expiresAtUtc: '2026-11-27T12:05:00+00:00' })

    for (const state of ['Saved', 'Released', 'Expired', 'Unavailable']) {
      expect(EditStatusSchema.safeParse({
        assetId: id, availability: 'Available', activeEdit: null, watchedEdit: { id, state },
      }).success).toBe(true)
    }
    // An ended edit must say who ended it.
    expect(EditStatusSchema.safeParse({
      assetId: id, availability: 'Available', activeEdit: null, watchedEdit: { id, state: 'Ended' },
    }).success).toBe(false)
  })

  it('requires minor units on a currency', () => {
    expect(CurrencySchema.safeParse({
      code: 'JPY',
      name: 'Japanese Yen',
      amountFormats: [{
        id: 'dot', decimalSeparator: '.', groupSeparator: ',', reference: 'r', version: '1',
      }],
    }).success).toBe(false)
  })
})
