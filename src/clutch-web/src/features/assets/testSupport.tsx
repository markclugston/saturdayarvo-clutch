import type { ReactElement } from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { UnsavedChangesProvider } from '@/components/unsaved-changes/UnsavedChangesProvider'
import { ApiError } from '@/lib/api/client'
import type { AssetDetail, AssetList, Currency, EditLease, EditStatus } from '@/lib/api/schemas'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'

export const assetId = '550e8400-e29b-41d4-a716-446655440000'
export const editId = '550e8400-e29b-41d4-a716-446655440002'
export const otherEditId = '550e8400-e29b-41d4-a716-446655440003'

const formats = [{
  id: 'dot', decimalSeparator: '.', groupSeparator: ',', reference: 'r', version: '1',
}]

export const currencies: Currency[] = [
  { code: 'AUD', name: 'Australian Dollar', minorUnits: 2, amountFormats: formats },
  { code: 'JPY', name: 'Japanese Yen', minorUnits: 0, amountFormats: formats },
  { code: 'USD', name: 'US Dollar', minorUnits: 2, amountFormats: formats },
]

/** The app's own formatting, so expectations follow the test machine's locale. */
export function money(value: number | bigint, code: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency: code, currencyDisplay: 'narrowSymbol',
  }).format(value)
}

export const detail: AssetDetail = {
  id: assetId,
  name: 'House',
  description: 'Family home',
  currencyCode: 'AUD',
  valuations: [
    { id: '550e8400-e29b-41d4-a716-446655440010', value: 12000, valuationDate: '2026-01-01' },
    { id: '550e8400-e29b-41d4-a716-446655440011', value: 10000.5, valuationDate: '2025-01-01' },
  ],
}

export const assetList: AssetList = {
  assets: [
    {
      id: assetId, name: 'House', description: 'Family home', currencyCode: 'AUD',
      latestValuation: { value: 12000, valuationDate: '2026-01-01' },
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440020', name: 'Bond', description: null, currencyCode: 'JPY',
      latestValuation: { value: 5000, valuationDate: '2026-02-01' },
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440021', name: 'Shares', description: 'x'.repeat(300), currencyCode: 'USD',
      latestValuation: { value: 2000, valuationDate: '2026-03-01' },
    },
  ],
  totals: [
    { currencyCode: 'AUD', totalValue: '12000.00' },
    { currencyCode: 'JPY', totalValue: '5000' },
    { currencyCode: 'USD', totalValue: '2000.00' },
  ],
}

export function lease(secondsLeft = 300, id = editId): EditLease {
  const now = Date.now()
  return {
    editId: id,
    serverTimeUtc: new Date(now).toISOString(),
    expiresAtUtc: new Date(now + secondsLeft * 1000).toISOString(),
    asset: detail,
  }
}

const expiresAtUtc = '2026-11-27T12:05:00Z'

export const holding: EditStatus = {
  assetId,
  availability: 'Blocked',
  activeEdit: { id: editId, expiresAtUtc },
  watchedEdit: { id: editId, state: 'Active', expiresAtUtc },
}

export const blockedBy = (id: string): EditStatus =>
  ({ assetId, availability: 'Blocked', activeEdit: { id, expiresAtUtc }, watchedEdit: null })

export const free: EditStatus = { assetId, availability: 'Available', activeEdit: null, watchedEdit: null }

export const watching = (watchedEdit: NonNullable<EditStatus['watchedEdit']>): EditStatus =>
  ({ assetId, availability: 'Available', activeEdit: null, watchedEdit })

export function refusal(status: number, code?: string, extra: Record<string, unknown> = {}): ApiError {
  return new ApiError(status, {
    title: 'Refused', status, ...(code ? { errors: { code: [code] } } : {}), ...extra,
  })
}

export function renderAssets(ui: ReactElement) {
  return renderWithQueryClient(
    <UnsavedChangesProvider>
      <ToastProvider>{ui}</ToastProvider>
    </UnsavedChangesProvider>,
  )
}
