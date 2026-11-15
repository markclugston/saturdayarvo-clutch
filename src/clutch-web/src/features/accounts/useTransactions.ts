import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTransactions } from '@/features/imports/api'
import { ApiError } from '@/lib/api/client'
import { deleteTransaction } from './api'

export function useTransactions(accountId: string) {
  return useInfiniteQuery({
    queryKey: ['transactions', accountId],
    queryFn: ({ pageParam }) =>
      getTransactions(accountId, pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useDeleteTransaction(accountId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (transactionId: string) => deleteTransaction(accountId, transactionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions', accountId] }),
    onError: (error) => {
      // A 404 means the row is already gone, so refresh the list to remove it.
      if (error instanceof ApiError && error.status === 404) {
        void queryClient.invalidateQueries({ queryKey: ['transactions', accountId] })
      }
    },
  })
}
