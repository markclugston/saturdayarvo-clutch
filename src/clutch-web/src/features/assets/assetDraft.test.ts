import { describe, expect, it } from 'vitest'
import {
  addValuation,
  assetToDraft,
  draftsEqual,
  draftToInput,
  emptyAssetDraft,
  formatAssetValue,
  mapServerErrors,
  newestFirst,
  removeValuation,
  validateAssetDraft,
  validateNewValuation,
  type AssetDraft,
} from './assetDraft'

const today = '2026-11-27'
const currencies = [
  { code: 'AUD', minorUnits: 2 },
  { code: 'JPY', minorUnits: 0 },
]

function draft(overrides: Partial<AssetDraft> = {}): AssetDraft {
  return addValuation({ ...emptyAssetDraft(), name: 'House', currencyCode: 'AUD', ...overrides }, '100', '2026-01-01')
}

const errorsOf = (value: AssetDraft) => validateAssetDraft(value, currencies, today)
const valuationError = (value: string, field: 'value' | 'date', date = '2026-01-01', currencyCode = 'AUD') =>
  validateNewValuation({ ...emptyAssetDraft(), currencyCode }, value, date, currencies, today)[field]

describe('asset draft', () => {
  it('adds and removes valuations without touching the original', () => {
    const empty = emptyAssetDraft()
    const added = addValuation(empty, ' 5 ', '2026-01-01')

    expect(empty.valuations).toHaveLength(0)
    expect(added.valuations).toMatchObject([{ value: '5', date: '2026-01-01' }])
    expect(removeValuation(added, added.valuations[0]!.key).valuations).toHaveLength(0)
  })

  it('lists valuations newest first', () => {
    const value = addValuation(draft(), '2', '2026-03-01')

    expect(newestFirst(value.valuations).map((row) => row.date)).toEqual(['2026-03-01', '2026-01-01'])
  })

  it('reads a stored asset', () => {
    const value = assetToDraft({
      id: 'a', name: 'House', description: null, currencyCode: 'AUD',
      valuations: [{ id: 'v', value: 999999999999.99, valuationDate: '2026-01-01' }],
    })

    expect(value).toMatchObject({
      name: 'House', description: '', currencyCode: 'AUD',
      valuations: [{ id: 'v', value: '999999999999.99', date: '2026-01-01' }],
    })
  })

  it.each([
    ['name', { name: 'Other' }],
    ['description', { description: 'Words' }],
    ['currency', { currencyCode: 'JPY' }],
  ])('is dirty after a %s change', (_label, change) => {
    const loaded = draft()

    expect(draftsEqual(loaded, { ...loaded })).toBe(true)
    expect(draftsEqual(loaded, { ...loaded, ...change })).toBe(false)
  })

  it('is dirty while its valuations differ, and clean again when an addition is removed', () => {
    const loaded = draft()
    const added = addValuation(loaded, '2', '2026-03-01')

    expect(draftsEqual(loaded, added)).toBe(false)
    expect(draftsEqual(loaded, removeValuation(added, added.valuations.at(-1)!.key))).toBe(true)
    expect(draftsEqual(loaded, removeValuation(loaded, loaded.valuations[0]!.key))).toBe(false)
  })

  it('accepts a complete draft', () => expect(errorsOf(draft())).toEqual({}))

  it.each(['', '   '])('requires a name (%j)', (name) => {
    expect(errorsOf(draft({ name })).name).toBe('Enter a name')
  })

  it('limits the name to 100 characters after trimming', () => {
    expect(errorsOf(draft({ name: `  ${'n'.repeat(100)}  ` })).name).toBeUndefined()
    expect(errorsOf(draft({ name: 'n'.repeat(101) })).name).toBe('Enter a name of up to 100 characters')
  })

  it('limits the description to 500 characters', () => {
    expect(errorsOf(draft({ description: 'd'.repeat(500) })).description).toBeUndefined()
    expect(errorsOf(draft({ description: 'd'.repeat(501) })).description)
      .toBe('Enter a description of up to 500 characters')
  })

  it.each(['', 'XXX'])('requires a supported currency (%j)', (currencyCode) => {
    expect(errorsOf(draft({ currencyCode })).currencyCode).toBe('Select a currency')
  })

  it('requires at least one valuation', () => {
    expect(errorsOf({ ...draft(), valuations: [] }).valuations).toBe('Add at least one valuation')
  })

  it.each([
    ['', 'Enter a value'],
    ['.', 'Enter a value'],
    ['-1', 'Enter a value of 0 or more'],
    ['1000000000000', 'Enter a value up to 999,999,999,999.99'],
    ['1.001', 'Enter at most 2 decimal places'],
  ])('rejects the value %j', (value, message) => {
    expect(valuationError(value, 'value')).toBe(message)
  })

  it.each(['0', '999999999999.99', '1.2500', '.5', '12.'])('accepts the value %j', (value) => {
    expect(valuationError(value, 'value')).toBeUndefined()
  })

  it('rejects decimals for yen', () => {
    expect(valuationError('5000.5', 'value', '2026-01-01', 'JPY')).toBe('JPY values have no decimal places')
    expect(valuationError('5000.00', 'value', '2026-01-01', 'JPY')).toBeUndefined()
  })

  it.each([
    ['', 'Enter a valid date'],
    ['2026-02-30', 'Enter a valid date'],
    ['2026-11-28', 'Enter a date that is not in the future'],
  ])('rejects the date %j', (date, message) => {
    expect(valuationError('1', 'date', date)).toBe(message)
  })

  it('accepts today', () => expect(valuationError('1', 'date', today)).toBeUndefined())

  it('rejects a date already used', () => {
    const found = validateNewValuation(draft(), '2', '2026-01-01', currencies, today)

    expect(found.date).toBe('This valuation date is already used')
  })

  it('flags each valuation with decimals after a change to yen', () => {
    let value = addValuation(emptyAssetDraft(), '1.50', '2026-01-01')
    value = addValuation(value, '2', '2026-02-01')
    value = addValuation(value, '3.25', '2026-03-01')
    const [first, second, third] = value.valuations

    const errors = errorsOf({ ...value, name: 'House', currencyCode: 'JPY' })

    expect(errors).toEqual({
      [`${first!.key}.value`]: 'JPY values have no decimal places',
      [`${third!.key}.value`]: 'JPY values have no decimal places',
    })
    expect(errors[`${second!.key}.value`]).toBeUndefined()
  })

  it('builds the request, keeping ids and trimming text', () => {
    const value = addValuation(
      assetToDraft({
        id: 'a', name: 'House', description: null, currencyCode: 'AUD',
        valuations: [{ id: 'v', value: 10, valuationDate: '2026-01-01' }],
      }),
      '20.5',
      '2026-02-01',
    )

    const { input, rowKeys } = draftToInput({ ...value, name: ' Home ', description: '  ' })

    expect(input).toEqual({
      name: 'Home',
      description: null,
      currencyCode: 'AUD',
      valuations: [
        { id: 'v', value: 10, valuationDate: '2026-01-01' },
        { value: 20.5, valuationDate: '2026-02-01' },
      ],
    })
    expect(rowKeys).toEqual(value.valuations.map((row) => row.key))
  })

  it('maps server errors back to the row they name', () => {
    expect(mapServerErrors(
      {
        name: 'Enter a name',
        'valuations[1].valuationDate': 'Enter a valid date',
        'valuations[0].id': 'Gone',
        'valuations[9].value': 'Enter a value',
      },
      ['k1', 'k2'],
    )).toEqual({
      name: 'Enter a name',
      'k2.date': 'Enter a valid date',
      'k1.value': 'Gone',
      valuations: 'Enter a value',
    })
  })

  it.each([
    ['', 'AUD', 2, ''],
    ['1234.5', 'AUD', 2, '$1,234.50'],
    ['.5', 'AUD', 2, '$0.50'],
    ['5000', 'JPY', 0, '¥5,000'],
    // Decimals the currency cannot hold are shown as entered, never rounded.
    ['10.50', 'JPY', 0, '10.50'],
  ])('formats %j in %s', (raw, code, minorUnits, expected) => {
    expect(formatAssetValue(raw, code, minorUnits, 'en-AU')).toBe(
      expected.startsWith('$') || expected.startsWith('¥')
        ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
          .format(Number(raw))
        : expected,
    )
  })
})
