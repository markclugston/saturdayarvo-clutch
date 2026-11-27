import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogBackdrop, DialogDescription, DialogPopup,
  DialogPortal, DialogTitle,
} from '@/components/ui/dialog'
import { ErrorMessage } from '@/components/ui/error-message'
import { useToast } from '@/components/ui/toast'
import { assetErrorCode, assetsQueryKey, deleteAsset, isAssetGone } from './api'

export const DELETE_FAILED_MESSAGE = 'The asset could not be deleted. Please try again.'
export const DELETE_BLOCKED_MESSAGE =
  'This asset is being edited in another session. End that edit or wait for it to finish, then try again.'
export const DELETE_GONE_MESSAGE = 'This asset no longer exists.'

type DeleteAssetDialogProps = {
  asset: { id: string; name: string }
  onClose: () => void
}

export function DeleteAssetDialog({ asset, onClose }: DeleteAssetDialogProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const cancel = useRef<HTMLButtonElement>(null)
  const deletion = useMutation({
    mutationFn: () => deleteAsset(asset.id),
    onSuccess: () => {
      toast.show(`${asset.name} was deleted.`)
      void queryClient.invalidateQueries({ queryKey: assetsQueryKey })
      onClose()
    },
    onError: (error) => {
      if (isAssetGone(error)) {
        void queryClient.invalidateQueries({ queryKey: assetsQueryKey })
      }
    },
  })
  const busy = deletion.isPending
  const gone = isAssetGone(deletion.error)
  const message = !deletion.isError
    ? null
    : gone
      ? DELETE_GONE_MESSAGE
      : assetErrorCode(deletion.error) === 'AssetEditActive' ? DELETE_BLOCKED_MESSAGE : DELETE_FAILED_MESSAGE

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
          <DialogTitle>Delete Asset</DialogTitle>
          <DialogDescription className="break-words">
            This permanently deletes “{asset.name}” and its valuations. This cannot be undone.
          </DialogDescription>
          {message && <ErrorMessage>{message}</ErrorMessage>}
          <div className="flex flex-wrap gap-2">
            {!gone && (
              <Button disabled={busy} onClick={() => deletion.mutate()} type="button" variant="danger">
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
