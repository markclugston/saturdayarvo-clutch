import { z } from 'zod'
import { apiRequest } from '@/lib/api/client'
import { FamilySchema } from '@/lib/api/schemas'

const FamiliesSchema = z.array(FamilySchema)

export function getFamilies() {
  return apiRequest('/api/families', FamiliesSchema)
}

export function createFamily() {
  return apiRequest('/api/families', FamilySchema, { method: 'POST' })
}
