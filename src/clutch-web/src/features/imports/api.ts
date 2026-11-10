import { z } from 'zod'
import { ApiError, apiRequest } from '@/lib/api/client'
import {
  ConfirmImportResponseSchema,
  AccountImportSettingsSchema,
  ImportReviewSchema,
  TransactionPageSchema,
  type ImportReview,
  type TransactionPage,
} from '@/lib/api/schemas'

export type ImportMapping = {
  dateColumn: number
  descriptionColumn: number
  dateFormat: string
  amountMode: 'Signed' | 'SeparateIncomingOutgoing' | 'AmountWithDirection'
  signedAmountColumn?: number | null
  incomingAmountColumn?: number | null
  outgoingAmountColumn?: number | null
  amountColumn?: number | null
  directionColumn?: number | null
  incomingSign?: 'Positive' | 'Negative' | null
  incomingDirectionValue?: string | null
  outgoingDirectionValue?: string | null
  numberFormat: string
  balanceColumn?: number | null
}

const EmptyResponseSchema = z.undefined()

export async function createImportReview(
  accountId: string,
  file: File,
  mapping: ImportMapping,
): Promise<ImportReview> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('mapping', JSON.stringify(mapping))
  try {
    return await apiRequest(
      `/api/accounts/${encodeURIComponent(accountId)}/import-reviews`,
      ImportReviewSchema,
      { method: 'POST', body: formData },
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 201) {
      const match = error.location?.match(
        /^\/api\/import-reviews\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
      )
      const reviewId = match?.[1]
      if (reviewId) {
        try {
          await cancelImportReview(reviewId)
        } catch {
          throw new ApiError(201, {
            title: 'The review response was invalid and the review could not be cancelled. Use the recovery option below.',
            status: 201,
          })
        }
      }
    }
    throw error
  }
}

export function getAccountImportSettings(accountId: string) {
  return apiRequest(
    `/api/accounts/${encodeURIComponent(accountId)}/import-settings`,
    AccountImportSettingsSchema,
  )
}

export function confirmImportReview(
  reviewId: string,
  confirmPossibleDuplicates: boolean,
) {
  return apiRequest(
    `/api/import-reviews/${encodeURIComponent(reviewId)}/confirm`,
    ConfirmImportResponseSchema,
    {
      method: 'POST',
      body: JSON.stringify({ confirmPossibleDuplicates }),
    },
  )
}

export function cancelImportReview(reviewId: string): Promise<void> {
  return apiRequest(
    `/api/import-reviews/${encodeURIComponent(reviewId)}`,
    EmptyResponseSchema,
    { method: 'DELETE' },
  )
}

export function cancelActiveImportReview(accountId: string): Promise<void> {
  return apiRequest(
    `/api/accounts/${encodeURIComponent(accountId)}/active-import-review`,
    EmptyResponseSchema,
    { method: 'DELETE' },
  )
}

export function getTransactions(
  accountId: string,
  cursor?: string,
  pageSize = 50,
): Promise<TransactionPage> {
  const query = new URLSearchParams({ pageSize: String(pageSize) })
  if (cursor) {
    query.set('cursor', cursor)
  }

  return apiRequest(
    `/api/accounts/${encodeURIComponent(accountId)}/transactions?${query.toString()}`,
    TransactionPageSchema,
  )
}
