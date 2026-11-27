import { z } from 'zod'
import { parseDate } from '@/features/mortgages/repaymentDates'
import { formatCurrencyAmount } from '@/lib/formatCurrencyAmount'
import { AssetValueSchema, type AssetDetail, type AssetInput, type Currency } from '@/lib/api/schemas'

const MAX_NAME = 100
const MAX_DESCRIPTION = 500

export type ValuationDraft = {
  key: string
  /** Set for a stored valuation; stored valuations are removed or kept, never changed. */
  id?: string
  value: string
  date: string
}

export type AssetDraft = {
  name: string
  description: string
  /** '' until a currency is chosen. */
  currencyCode: string
  valuations: ValuationDraft[]
}

/** Messages keyed `name`, `description`, `currencyCode`, `valuations`, `{rowKey}.value`, `{rowKey}.date`. */
export type AssetDraftErrors = Record<string, string>

export type CurrencyPrecision = Pick<Currency, 'code' | 'minorUnits'>

let rowCounter = 0

function nextKey(): string {
  rowCounter += 1
  return `valuation-${rowCounter}`
}

export function emptyAssetDraft(): AssetDraft {
  return { name: '', description: '', currencyCode: '', valuations: [] }
}

export function assetToDraft(asset: AssetDetail): AssetDraft {
  return {
    name: asset.name,
    description: asset.description ?? '',
    currencyCode: asset.currencyCode,
    valuations: asset.valuations.map((valuation) => ({
      key: nextKey(),
      id: valuation.id,
      value: String(valuation.value),
      date: valuation.valuationDate,
    })),
  }
}

export function addValuation(draft: AssetDraft, value: string, date: string): AssetDraft {
  return { ...draft, valuations: [...draft.valuations, { key: nextKey(), value: value.trim(), date }] }
}

export function removeValuation(draft: AssetDraft, key: string): AssetDraft {
  return { ...draft, valuations: draft.valuations.filter((row) => row.key !== key) }
}

export function newestFirst(rows: ValuationDraft[]): ValuationDraft[] {
  return [...rows].sort((left, right) => right.date.localeCompare(left.date))
}

export function draftsEqual(left: AssetDraft, right: AssetDraft): boolean {
  if (left.name !== right.name
    || left.description !== right.description
    || left.currencyCode !== right.currencyCode
    || left.valuations.length !== right.valuations.length) {
    return false
  }
  const others = newestFirst(right.valuations)
  return newestFirst(left.valuations).every((row, index) =>
    row.id === others[index]?.id && row.value === others[index]?.value && row.date === others[index]?.date)
}

// The rules of FR-007/008/009, with the same messages as the server (SEC-004).
const NameSchema = z.string()
  .trim()
  .min(1, 'Enter a name')
  .max(MAX_NAME, 'Enter a name of up to 100 characters')

const DescriptionSchema = z.string()
  .trim()
  .max(MAX_DESCRIPTION, 'Enter a description of up to 500 characters')

function valueSchema(currencyCode: string, minorUnits: number) {
  return z.string()
    .trim()
    .regex(/^-?(\d+(\.\d*)?|\.\d+)$/, { error: 'Enter a value', abort: true })
    .refine((text) => Number(text) >= 0, { error: 'Enter a value of 0 or more', abort: true })
    .refine((text) => AssetValueSchema.safeParse(Number(text)).success, {
      error: 'Enter a value up to 999,999,999,999.99', abort: true,
    })
    .refine((text) => decimalPlaces(text) <= minorUnits, {
      error: minorUnits === 0
        ? `${currencyCode} values have no decimal places`
        : `Enter at most ${minorUnits} decimal places`,
    })
}

function dateSchema(today: string, usedTwice: ReadonlySet<string>) {
  return z.string()
    .refine((date) => parseDate(date) !== null, { error: 'Enter a valid date', abort: true })
    .refine((date) => date <= today, { error: 'Enter a date that is not in the future', abort: true })
    .refine((date) => !usedTwice.has(date), { error: 'This valuation date is already used' })
}

function decimalPlaces(value: string): number {
  return (value.split('.')[1] ?? '').replace(/0+$/, '').length
}

function firstError(schema: z.ZodType, value: unknown): string | undefined {
  const result = schema.safeParse(value)
  return result.success ? undefined : result.error.issues[0]?.message
}

export function validateAssetDraft(
  draft: AssetDraft,
  currencies: readonly CurrencyPrecision[],
  today: string,
): AssetDraftErrors {
  const errors: AssetDraftErrors = {}
  const add = (key: string, message: string | undefined) => {
    if (message) {
      errors[key] = message
    }
  }

  add('name', firstError(NameSchema, draft.name))
  add('description', firstError(DescriptionSchema, draft.description))
  const currency = currencies.find((candidate) => candidate.code === draft.currencyCode)
  if (!currency) {
    add('currencyCode', 'Select a currency')
  }
  if (draft.valuations.length === 0) {
    add('valuations', 'Add at least one valuation')
  }

  const seen = new Set<string>()
  const usedTwice = new Set<string>()
  for (const row of draft.valuations) {
    (seen.has(row.date) ? usedTwice : seen).add(row.date)
  }
  // Without a currency no value can have more than the two decimals any currency allows.
  const value = valueSchema(draft.currencyCode, currency?.minorUnits ?? 2)
  const date = dateSchema(today, usedTwice)
  for (const row of draft.valuations) {
    add(`${row.key}.value`, firstError(value, row.value))
    add(`${row.key}.date`, firstError(date, row.date))
  }

  return errors
}

/** The errors of a valuation about to be added, judged against the draft with it appended. */
export function validateNewValuation(
  draft: AssetDraft,
  value: string,
  date: string,
  currencies: readonly CurrencyPrecision[],
  today: string,
): { value?: string; date?: string } {
  const candidate = addValuation(draft, value, date)
  const key = candidate.valuations.at(-1)!.key
  const errors = validateAssetDraft(candidate, currencies, today)
  const result: { value?: string; date?: string } = {}
  const valueError = errors[`${key}.value`]
  const dateError = errors[`${key}.date`]
  if (valueError) {
    result.value = valueError
  }
  if (dateError) {
    result.date = dateError
  }
  return result
}

/** `rowKeys[i]` is the screen row that became `valuations[i]`. Call only on a valid draft. */
export function draftToInput(draft: AssetDraft): { input: AssetInput; rowKeys: string[] } {
  const description = draft.description.trim()
  return {
    input: {
      name: draft.name.trim(),
      description: description === '' ? null : description,
      currencyCode: draft.currencyCode,
      valuations: draft.valuations.map((row) => ({
        ...(row.id ? { id: row.id } : {}),
        value: Number(row.value),
        valuationDate: row.date,
      })),
    },
    rowKeys: draft.valuations.map((row) => row.key),
  }
}

export function mapServerErrors(
  serverErrors: Record<string, string>,
  rowKeys: string[],
): AssetDraftErrors {
  const mapped: AssetDraftErrors = {}
  for (const [key, message] of Object.entries(serverErrors)) {
    const match = /^valuations\[(\d+)\]\.(value|valuationDate|id)$/.exec(key)
    if (!match) {
      mapped[key] = message
      continue
    }
    const rowKey = rowKeys[Number(match[1])]
    const field = match[2] === 'valuationDate' ? 'date' : 'value'
    mapped[rowKey ? `${rowKey}.${field}` : 'valuations'] = message
  }
  return mapped
}

/**
 * A value formatted in its asset's currency. Text that is not a number the currency can hold is
 * shown as entered, so a value is never silently rounded.
 */
export function formatAssetValue(
  raw: string,
  currencyCode: string,
  minorUnits: number,
  locale?: string,
): string {
  const text = raw.trim()
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text)
  const whole = match?.[1] ?? ''
  const fraction = match?.[2] ?? ''
  if (!match || (whole === '' && fraction === '') || fraction.length > minorUnits) {
    return raw
  }
  const amount = fraction === '' ? whole || '0' : `${whole || '0'}.${fraction}`
  return formatCurrencyAmount(amount, currencyCode, locale)
}
