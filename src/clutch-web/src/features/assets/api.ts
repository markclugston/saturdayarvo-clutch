import { z } from 'zod'
import { ApiError, apiRequest } from '@/lib/api/client'
import {
  AssetDetailSchema,
  AssetListSchema,
  EditLeaseSchema,
  EditStatusSchema,
  type AssetDetail,
  type AssetInput,
  type AssetList,
  type EditLease,
  type EditStatus,
} from '@/lib/api/schemas'

export const assetsQueryKey = ['assets'] as const

const assetPathOf = (assetId: string) => `/api/assets/${encodeURIComponent(assetId)}`

export function listAssets(): Promise<AssetList> {
  return apiRequest('/api/assets', AssetListSchema)
}

export function createAsset(input: AssetInput): Promise<AssetDetail> {
  return apiRequest('/api/assets', AssetDetailSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function acquireEdit(assetId: string): Promise<EditLease> {
  return apiRequest(`${assetPathOf(assetId)}/edits`, EditLeaseSchema, { method: 'POST' })
}

export function getEditStatus(assetId: string, editId?: string, signal?: AbortSignal): Promise<EditStatus> {
  const query = editId ? `?${new URLSearchParams({ editId })}` : ''
  return apiRequest(
    `${assetPathOf(assetId)}/edit-status${query}`,
    EditStatusSchema.refine((status) =>
      status.assetId === assetId
      && (editId ? status.watchedEdit?.id === editId : status.watchedEdit === null)),
    { signal, cache: 'no-store' },
  )
}

export function saveAsset(assetId: string, editId: string, input: AssetInput): Promise<AssetDetail> {
  return apiRequest(assetPathOf(assetId), AssetDetailSchema, {
    method: 'PUT',
    body: JSON.stringify({ ...input, editId }),
  })
}

/** `keepalive` lets a release sent while the page unloads still reach the server. */
export function releaseEdit(assetId: string, editId: string, options: { keepalive?: boolean } = {}): Promise<void> {
  return apiRequest(
    `${assetPathOf(assetId)}/edits/${encodeURIComponent(editId)}`,
    z.undefined(),
    { method: 'DELETE', keepalive: options.keepalive },
  )
}

export function endOtherEdit(assetId: string, editId: string): Promise<void> {
  return apiRequest(
    `${assetPathOf(assetId)}/active-edit?${new URLSearchParams({ editId })}`,
    z.undefined(),
    { method: 'DELETE' },
  )
}

export function deleteAsset(assetId: string): Promise<void> {
  return apiRequest(assetPathOf(assetId), z.undefined(), { method: 'DELETE' })
}

/** The machine-readable code of a refused request, such as `AssetEditExpired`. */
export function assetErrorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.problem.errors?.code?.[0] : undefined
}

/** The asset is deleted, unknown or someone else's: the server answers all three the same way. */
export function isAssetGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

/** The edit that blocked an open; null for any other failure. */
export function blockedEditStatus(error: unknown): EditStatus | null {
  if (!(error instanceof ApiError) || assetErrorCode(error) !== 'AssetEditActive') {
    return null
  }
  const parsed = EditStatusSchema.safeParse(error.problem.editStatus)
  return parsed.success ? parsed.data : null
}

/** The first message per field of a 400; null for any other failure. */
export function assetFieldErrors(error: unknown): Record<string, string> | null {
  if (!(error instanceof ApiError) || error.status !== 400 || !error.problem.errors) {
    return null
  }
  const fieldErrors: Record<string, string> = {}
  for (const [key, messages] of Object.entries(error.problem.errors)) {
    const first = messages[0]
    if (key !== 'code' && first) {
      fieldErrors[key] = first
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}
