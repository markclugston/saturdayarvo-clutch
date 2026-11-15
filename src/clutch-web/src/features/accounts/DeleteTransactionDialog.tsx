import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api/client'
import { useDeleteTransaction } from './useTransactions'

const BUSY_DELAY_MS = 500

type DeleteTransactionDialogProps = {
  accountId: string
  transaction: { id: string; description: string }
  onClose: () => void
}

export function DeleteTransactionDialog({
  accountId,
  transaction,
  onClose,
}: DeleteTransactionDialogProps) {
  const deleteMutation = useDeleteTransaction(accountId)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [showBusy, setShowBusy] = useState(false)

  useEffect(() => {
    if (!deleteMutation.isPending) {
      setShowBusy(false)
      return
    }
    const timer = window.setTimeout(() => setShowBusy(true), BUSY_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [deleteMutation.isPending])

  const isPending = deleteMutation.isPending
  const isNotFound = deleteMutation.error instanceof ApiError && deleteMutation.error.status === 404

  function handleDelete() {
    if (isPending) {
      return
    }
    deleteMutation.mutate(transaction.id, {
      onSuccess: () => onClose(),
    })
  }

  function handleOpenChange(open: boolean) {
    if (!open && !isPending) {
      onClose()
    }
  }

  return (
    <Dialog modal open disablePointerDismissal onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup
          className="space-y-3 border-destructive p-4"
          initialFocus={cancelRef}
          role="alertdialog"
        >
          <DialogTitle className="font-semibold">
            Delete transaction “{transaction.description}”?
          </DialogTitle>
          <DialogDescription>
            This will permanently delete this transaction. This cannot be undone.
          </DialogDescription>
          {isNotFound && (
            <p role="alert">This transaction no longer exists.</p>
          )}
          {deleteMutation.isError && !isNotFound && (
            <p role="alert">The transaction could not be deleted.</p>
          )}
          <div className="flex gap-2">
            {!isNotFound && (
              <button
                className="cursor-pointer rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending}
                onClick={handleDelete}
                type="button"
              >
                {showBusy ? 'Deleting…' : 'Delete'}
              </button>
            )}
            <button
              className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending}
              onClick={onClose}
              ref={cancelRef}
              type="button"
            >
              {isNotFound ? 'Close' : 'Cancel'}
            </button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
