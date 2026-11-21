import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogBackdrop, DialogDescription, DialogPopup,
  DialogPortal, DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/error-message'

export const DELETE_FAILED_MESSAGE = 'The mortgage could not be deleted. Please try again.'
export const DELETE_RELOAD_FAILED_MESSAGE = 'The latest version could not be loaded. Please try again.'
export const DELETE_CONFLICT_MESSAGE = 'This mortgage was changed elsewhere; reload to see the latest'

type DeleteMortgageDialogProps = {
  name: string
  deleting: boolean
  conflict: boolean
  reloading: boolean
  deleteFailed: boolean
  reloadFailed: boolean
  onDelete: () => void
  onReload: () => void
  onCancel: () => void
}

export function DeleteMortgageDialog({
  name,
  deleting,
  conflict,
  reloading,
  deleteFailed,
  reloadFailed,
  onDelete,
  onReload,
  onCancel,
}: DeleteMortgageDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null)
  const busy = deleting || reloading
  return (
    <Dialog
      open
      modal
      onOpenChange={(_open, details) => {
        details.cancel()
        if (!busy) {
          onCancel()
        }
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="space-y-4 p-6" initialFocus={cancel}>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the mortgage and its interest rate changes. This cannot be undone.
          </DialogDescription>
          {conflict && (
            <div className="flex flex-wrap items-center gap-3" role="alert">
              <ErrorMessage role="presentation">{DELETE_CONFLICT_MESSAGE}</ErrorMessage>
              <Button disabled={reloading} onClick={onReload} type="button" variant="secondary">
                {reloading ? 'Reloading…' : 'Reload'}
              </Button>
            </div>
          )}
          {reloadFailed && <ErrorMessage>{DELETE_RELOAD_FAILED_MESSAGE}</ErrorMessage>}
          {deleteFailed && <ErrorMessage>{DELETE_FAILED_MESSAGE}</ErrorMessage>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || conflict} onClick={onDelete} type="button" variant="danger">
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
            <Button disabled={deleting} onClick={onCancel} ref={cancel} type="button" variant="secondary">
              Cancel
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
