import { DeleteDialog } from '@/components/ui/delete-dialog'
import { useToast } from '@/components/ui/toast'
import { ApiError } from '@/lib/api/client'
import { useDeleteTransaction } from './useTransactions'

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
  const deletion = useDeleteTransaction(accountId)
  const toast = useToast()
  const gone = deletion.error instanceof ApiError && deletion.error.status === 404
  const message = !deletion.isError
    ? null
    : gone ? 'This transaction no longer exists.' : 'The transaction could not be deleted.'

  return (
    <DeleteDialog
      busy={deletion.isPending}
      description={`This permanently deletes “${transaction.description}”. This cannot be undone.`}
      gone={gone}
      message={message}
      onClose={onClose}
      onConfirm={() => deletion.mutate(transaction.id, {
        onSuccess: () => {
          toast.show(`${transaction.description} was deleted.`)
          onClose()
        },
      })}
      title="Delete Transaction"
    />
  )
}
