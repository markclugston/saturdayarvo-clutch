import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { deleteTransaction } from './api'
import { useDeleteTransaction } from './useTransactions'

vi.mock('./api', () => ({ deleteTransaction: vi.fn() }))

describe('useDeleteTransaction', () => {
  it('refreshes the transactions and the mortgage period balances after a delete', async () => {
    vi.mocked(deleteTransaction).mockResolvedValue(undefined)
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useDeleteTransaction('account-1'), { wrapper })

    await act(async () => { result.current.mutate('transaction-1') })

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['mortgage-period-balances'] }))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['transactions', 'account-1'] })
  })
})
