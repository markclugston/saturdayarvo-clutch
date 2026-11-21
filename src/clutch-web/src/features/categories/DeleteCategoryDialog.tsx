import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/error-message'
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
    <Dialog
      modal
      open
      disablePointerDismissal
      onOpenChange={(open) => {
        if (!open && !deleteMutation.isPending) {
          onClose()
        }
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup
          className="space-y-4 break-words p-6"
          finalFocus={false}
          initialFocus={cancelRef}
          role="alertdialog"
        >
          <DialogTitle>
            Delete {kind} “{node.name}”?
          </DialogTitle>
          {impactQuery.isPending && (
            <p className="text-fg-secondary" role="status">Checking what will be deleted…</p>
          )}
          {impactQuery.isError && (
            <ErrorMessage>{getMessage(impactQuery.error)}</ErrorMessage>
          )}
          {itemCount !== undefined && (
            <DialogDescription className="flex items-start gap-2 text-base text-fg">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>
                This will permanently delete {node.name}
                {descendants > 0
                  ? ` and ${descendants} ${descendants === 1 ? 'category' : 'categories'} inside it`
                  : ''}
                . This cannot be undone. Do you want to continue?
              </span>
            </DialogDescription>
          )}
          {deleteMutation.isError && <ErrorMessage>{getMessage(deleteMutation.error)}</ErrorMessage>}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={itemCount === undefined || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              type="button"
              variant="danger"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
            <Button
              disabled={deleteMutation.isPending}
              onClick={onClose}
              ref={cancelRef}
              type="button"
              variant="secondary"
            >
              Cancel
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

function getMessage(error: Error): string {
  return error instanceof ApiError
    ? error.problem.detail ?? error.problem.title ?? 'The request could not be completed.'
    : 'The request could not be completed.'
}
