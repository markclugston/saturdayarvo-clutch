import { z } from 'zod'
import { apiRequest } from '@/lib/api/client'
import {
  CategoryNodeSchema,
  DeletionImpactSchema,
  type CategoryNode,
  type DeletionImpact,
} from '@/lib/api/schemas'

const CategoryNodesSchema = z.array(CategoryNodeSchema)

export const categoryNodesQueryKey = ['category-nodes'] as const

export function getCategoryNodes(): Promise<CategoryNode[]> {
  return apiRequest('/api/category-nodes', CategoryNodesSchema)
}

export function createCategoryNode(name: string, parentId: string | null): Promise<CategoryNode> {
  return apiRequest('/api/category-nodes', CategoryNodeSchema, {
    method: 'POST',
    body: JSON.stringify({ name, parentId }),
  })
}

export function renameCategoryNode(id: string, name: string): Promise<CategoryNode> {
  return apiRequest(`/api/category-nodes/${encodeURIComponent(id)}`, CategoryNodeSchema, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
}

export function getDeletionImpact(id: string): Promise<DeletionImpact> {
  return apiRequest(
    `/api/category-nodes/${encodeURIComponent(id)}/deletion-impact`,
    DeletionImpactSchema,
  )
}

export function deleteCategoryNode(id: string): Promise<void> {
  return apiRequest(`/api/category-nodes/${encodeURIComponent(id)}`, z.undefined(), {
    method: 'DELETE',
  })
}
