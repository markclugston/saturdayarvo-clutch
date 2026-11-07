import { useInfiniteQuery } from '@tanstack/react-query'
import { getTransactions } from '@/features/imports/api'

export function useTransactions(accountId: string) {
  return useInfiniteQuery({
    queryKey: ['transactions', accountId],
    queryFn: ({ pageParam }) =>
      getTransactions(accountId, pageParam || undefined),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}
