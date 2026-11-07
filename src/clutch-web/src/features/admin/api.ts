import { apiRequest } from '@/lib/api/client'
import {
  ImportLimitsSchema,
  type ImportLimits,
} from '@/lib/api/schemas'

export function getImportLimits(): Promise<ImportLimits> {
  return apiRequest('/api/admin/import-limits', ImportLimitsSchema)
}

export function updateImportLimits(limits: ImportLimits): Promise<ImportLimits> {
  return apiRequest('/api/admin/import-limits', ImportLimitsSchema, {
    method: 'PUT',
    body: JSON.stringify(limits),
  })
}
