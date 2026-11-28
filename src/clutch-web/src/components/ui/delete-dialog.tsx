import { useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogBackdrop, DialogDescription, DialogPopup,
  DialogPortal, DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/error-message'

type DeleteDialogProps = {
  title: string
  /** Names the item and says that deleting it cannot be undone. */
  description: ReactNode
  busy: boolean
  /** Why the last attempt failed. */
  message?: string | null
  /** The item no longer exists, so there is nothing left to delete. */
  gone: boolean
  onConfirm: () => void
  onClose: () => void
}

/** The confirmation for deleting saved data from a list (clutch-ui-style §12). */
export function DeleteDialog({ title, description, busy, message, gone, onConfirm, onClose }: DeleteDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null)

  return (
    <Dialog
      open
      modal
      disablePointerDismissal
      onOpenChange={(_open, details) => {
        details.cancel()
        if (!busy) {
          onClose()
        }
      }}
    >
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="space-y-4 p-6" initialFocus={cancel} role="alertdialog">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="break-words">{description}</DialogDescription>
          {message && <ErrorMessage>{message}</ErrorMessage>}
          <div className="flex flex-wrap gap-2">
            {!gone && (
              <Button disabled={busy} onClick={onConfirm} type="button" variant="danger">
                {busy ? 'Deleting…' : 'Delete'}
              </Button>
            )}
            <Button disabled={busy} onClick={onClose} ref={cancel} type="button" variant="secondary">
              {gone ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
