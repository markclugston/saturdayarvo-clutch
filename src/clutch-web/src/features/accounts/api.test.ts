import { afterEach, expect, it, vi } from 'vitest'
import { clearCsrfToken } from '@/lib/api/client'
import { deleteTransaction } from './api'

afterEach(() => {
  clearCsrfToken()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubFetchWithCsrf(
  onDelete: (init?: RequestInit) => Promise<Response>,
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    if (path === '/api/security/csrf-token') {
      return Response.json({ requestToken: 'test-token' })
    }
    if (path.startsWith('/api/accounts/account-id/transactions/transaction-id')) {
      return onDelete(init)
    }
    throw new Error(`Unexpected request: ${path}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

it('sends a DELETE for the transaction with an eight-second timeout', async () => {
  const timeoutSignal = new AbortController().signal
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal)
  const fetchMock = stubFetchWithCsrf(async () => new Response(null, { status: 204 }))

  await expect(deleteTransaction('account-id', 'transaction-id')).resolves.toBeUndefined()

  expect(timeout).toHaveBeenCalledWith(8000)
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/accounts/account-id/transactions/transaction-id',
    expect.objectContaining({ method: 'DELETE', signal: timeoutSignal }),
  )
})

it('rejects with a TimeoutError when the eight-second timeout fires', async () => {
  const timeoutSignal = AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal)
  stubFetchWithCsrf((init) => Promise.reject(init?.signal?.reason))

  await expect(deleteTransaction('account-id', 'transaction-id')).rejects.toMatchObject({
    name: 'TimeoutError',
  })
})

it('forwards caller cancellation to the delete request', async () => {
  const controller = new AbortController()
  stubFetchWithCsrf((init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (signal?.aborted) {
        reject(signal.reason)
        return
      }
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    }),
  )

  const request = deleteTransaction('account-id', 'transaction-id', controller.signal)
  controller.abort()

  await expect(request).rejects.toMatchObject({ name: 'AbortError' })
})
