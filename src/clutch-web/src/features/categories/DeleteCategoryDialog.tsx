import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { ApiError } from '@/lib/api/client'
import type { CategoryNode } from '@/lib/api/schemas'
import { categoryNodesQueryKey, deleteCategoryNode, getDeletionImpact } from './api'

type DeleteCategoryDialogProps = {
  node: CategoryNode
  onClose: () => void
}

export function DeleteCategoryDialog({ node, onClose }: DeleteCategoryDialogProps) {
  const queryClient = useQueryClient()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.focus()
    return () => {
      // The opener is gone after a successful delete, so fall back to the create form.
      if (opener?.isConnected) {
        opener.focus()
      } else {
        document.getElementById('category-name')?.focus()
      }
    }
  }, [])
  const impactQuery = useQuery({
    queryKey: ['category-deletion-impact', node.id],
    queryFn: () => getDeletionImpact(node.id),
    gcTime: 0,
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteCategoryNode(node.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryNodesQueryKey })
      onClose()
    },
  })
  const itemCount = impactQuery.data?.itemCount
  const descendants = itemCount === undefined ? 0 : itemCount - 1
  const kind = node.parentId === null ? 'group' : 'category'

  return (
    <div
      aria-labelledby={`delete-${node.id}-title`}
      className="mt-2 space-y-3 rounded-lg border border-destructive bg-card p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !deleteMutation.isPending) {
          onClose()
        }
      }}
      role="alertdialog"
    >
      <h3 className="font-semibold" id={`delete-${node.id}-title`}>
        Delete {kind} “{node.name}”?
      </h3>
      {impactQuery.isPending && <p role="status">Checking what will be deleted…</p>}
      {impactQuery.isError && (
        <p role="alert">{getMessage(impactQuery.error)}</p>
      )}
      {itemCount !== undefined && (
        <p>
          This will permanently delete {node.name}
          {descendants > 0
            ? ` and ${descendants} ${descendants === 1 ? 'category' : 'categories'} inside it`
            : ''}
          . This cannot be undone. Do you want to continue?
        </p>
      )}
      {deleteMutation.isError && <p role="alert">{getMessage(deleteMutation.error)}</p>}
      <div className="flex gap-2">
        <button
          className="cursor-pointer rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={itemCount === undefined || deleteMutation.isPending}
          onClick={() => deleteMutation.mutate()}
          type="button"
        >
          {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        </button>
        <button
          className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          disabled={deleteMutation.isPending}
          onClick={onClose}
          ref={cancelRef}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function getMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
