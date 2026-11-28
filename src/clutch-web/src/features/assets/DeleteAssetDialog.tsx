import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DeleteDialog } from '@/components/ui/delete-dialog'
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
  const gone = isAssetGone(deletion.error)
  const message = !deletion.isError
    ? null
    : gone
      ? DELETE_GONE_MESSAGE
      : assetErrorCode(deletion.error) === 'AssetEditActive' ? DELETE_BLOCKED_MESSAGE : DELETE_FAILED_MESSAGE

  return (
    <DeleteDialog
      busy={deletion.isPending}
      description={`This permanently deletes “${asset.name}” and its valuations. This cannot be undone.`}
      gone={gone}
      message={message}
      onClose={onClose}
      onConfirm={() => deletion.mutate()}
      title="Delete Asset"
    />
  )
}
