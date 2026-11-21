import { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ErrorMessage } from '@/components/ui/error-message'
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
          className="space-y-3 p-4"
          initialFocus={cancelRef}
          role="alertdialog"
        >
          <DialogTitle className="font-semibold">
            Delete Transaction “{transaction.description}”?
          </DialogTitle>
          <DialogDescription>
            This will permanently delete this transaction. This cannot be undone.
          </DialogDescription>
          {isNotFound && (
            <ErrorMessage>This transaction no longer exists.</ErrorMessage>
          )}
          {deleteMutation.isError && !isNotFound && (
            <ErrorMessage>The transaction could not be deleted.</ErrorMessage>
          )}
          <div className="flex gap-2">
            {!isNotFound && (
              <Button
                disabled={isPending}
                onClick={handleDelete}
                type="button"
                variant="danger"
              >
                {showBusy ? 'Deleting…' : 'Delete'}
              </Button>
            )}
            <Button
              disabled={isPending}
              onClick={onClose}
              ref={cancelRef}
              type="button"
              variant="secondary"
            >
              {isNotFound ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}
