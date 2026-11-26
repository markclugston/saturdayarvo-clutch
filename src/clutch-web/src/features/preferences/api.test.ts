import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, clearCsrfToken } from '@/lib/api/client'
import {
  getLoanPayoffTimelinePreference,
  getNavigationPreference,
  getThemePreference,
  loanPayoffTimelinePreferenceQueryKey,
  saveLoanPayoffTimelinePreference,
  saveNavigationPreference,
  saveThemePreference,
  useLoanPayoffTimelinePreference,
  useNavigationPreference,
  useSaveLoanPayoffTimelinePreference,
  useSaveNavigationPreference,
} from './api'

afterEach(() => {
  clearCsrfToken()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function wrapper() {
  const queryClient = new QueryClient()
  return {
    queryClient,
    Wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  }
}

describe('navigation preference API', () => {
  it('reads and validates the saved state', async () => {
    const fetchMock = vi.fn(async () => Response.json({ state: 'Pinned' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getNavigationPreference()).resolves.toEqual({ state: 'Pinned' })
    expect(fetchMock).toHaveBeenCalledWith('/api/preferences/navigation', expect.objectContaining({ method: 'GET' }))

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ state: 'pinned' })))
    await expect(getNavigationPreference()).rejects.toMatchObject({ name: 'ApiError' })
  })

  it('sends the new state with the antiforgery token', async () => {
    const requests: { path: string; init?: RequestInit }[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ path: String(input), init })
      return String(input) === '/api/security/csrf-token'
        ? Response.json({ requestToken: 'csrf-token' })
        : Response.json({ state: 'Unpinned' })
    }))

    await expect(saveNavigationPreference('Unpinned')).resolves.toEqual({ state: 'Unpinned' })

    const put = requests[1]
    expect(put?.path).toBe('/api/preferences/navigation')
    expect(put?.init?.method).toBe('PUT')
    expect(JSON.parse(String(put?.init?.body))).toEqual({ state: 'Unpinned' })
    expect(new Headers(put?.init?.headers).get('X-CSRF-TOKEN')).toBe('csrf-token')
  })

  it('does not request or start a timer until a session id exists', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => Response.json({ state: 'Pinned' }))
    vi.stubGlobal('fetch', fetchMock)
    const { Wrapper } = wrapper()

    const { result } = renderHook(() => useNavigationPreference(undefined), { wrapper: Wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts the request after 2000 ms and does not retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = vi.fn((_path: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }))
    vi.stubGlobal('fetch', fetchMock)
    const { Wrapper } = wrapper()

    const { result } = renderHook(() => useNavigationPreference('user-1'), { wrapper: Wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(result.current.isPending).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(result.current.isPending).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(1100) })

    await waitFor(() => expect(result.current.isError).toBe(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('serialises one user\'s saves and does not queue another user\'s behind them', async () => {
    const order: string[] = []
    const releases: Array<() => void> = []
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/security/csrf-token') {
        return Promise.resolve(Response.json({ requestToken: 'csrf-token' }))
      }
      const { state } = JSON.parse(String(init?.body)) as { state: string }
      order.push(`start:${state}`)
      return new Promise<Response>((resolve) => {
        releases.push(() => {
          order.push(`end:${state}`)
          resolve(Response.json({ state }))
        })
      })
    }))
    const { Wrapper } = wrapper()
    const first = renderHook(() => useSaveNavigationPreference('user-1'), { wrapper: Wrapper })
    const other = renderHook(() => useSaveNavigationPreference('user-2'), { wrapper: Wrapper })

    act(() => {
      first.result.current.mutate('Pinned')
      first.result.current.mutate('Unpinned')
      other.result.current.mutate('Pinned')
    })

    // User 1's first save and user 2's save run together; user 1's second save waits.
    await waitFor(() => expect(releases).toHaveLength(2))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(order).toEqual(['start:Pinned', 'start:Pinned'])

    await act(async () => { releases[0]?.() })
    await waitFor(() => expect(releases).toHaveLength(3))
    expect(order).toEqual(['start:Pinned', 'start:Pinned', 'end:Pinned', 'start:Unpinned'])

    await act(async () => {
      releases[1]?.()
      releases[2]?.()
    })
  })
})

describe('Amortization Schedule preference API', () => {
  const PATH = '/api/preferences/loan-payoff-timeline'

  type SavedBody = { view: string; clientId: string; clientSequence: number }

  /** Stubs fetch: CSRF token, GET returns `view`, PUTs are recorded and held until released. */
  function stubServer(view = 'Schedule') {
    const gets: RequestInit[] = []
    const puts: Array<{ body: SavedBody; init: RequestInit; release: () => void }> = []
    const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = String(input)
      if (path === '/api/security/csrf-token') {
        return Promise.resolve(Response.json({ requestToken: 'csrf-token' }))
      }
      if ((init.method ?? 'GET') === 'GET') {
        gets.push(init)
        return Promise.resolve(Response.json({ view }))
      }
      const body = JSON.parse(String(init.body)) as SavedBody
      return new Promise<Response>((resolve) => {
        puts.push({ body, init, release: () => resolve(Response.json({ view: body.view })) })
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    return { fetchMock, gets, puts }
  }

  it('reads and validates the saved view from its path', async () => {
    const { fetchMock } = stubServer('Schedule')

    await expect(getLoanPayoffTimelinePreference()).resolves.toEqual({ view: 'Schedule' })
    expect(fetchMock).toHaveBeenCalledWith(PATH, expect.objectContaining({ method: 'GET' }))

    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ view: 'schedule' })))
    await expect(getLoanPayoffTimelinePreference()).rejects.toMatchObject({ name: 'ApiError' })
  })

  it('sends the view, client id and sequence with the antiforgery token and keepalive', async () => {
    const { puts } = stubServer()
    const clientId = '3f2b8c1e-5d7a-4c2e-9b1f-0a6d4e8c7b21'

    const saved = saveLoanPayoffTimelinePreference({ view: 'Schedule', clientId, clientSequence: 3 })
    await waitFor(() => expect(puts).toHaveLength(1))
    puts[0]?.release()

    await expect(saved).resolves.toEqual({ view: 'Schedule' })
    expect(puts[0]?.body).toEqual({ view: 'Schedule', clientId, clientSequence: 3 })
    expect(puts[0]?.init.method).toBe('PUT')
    expect(puts[0]?.init.keepalive).toBe(true)
    expect(new Headers(puts[0]?.init.headers).get('X-CSRF-TOKEN')).toBe('csrf-token')
  })

  it('uses the per-user query key', () => {
    expect(loanPayoffTimelinePreferenceQueryKey('user-1')).toEqual(['loanPayoffTimelinePreference', 'user-1'])
  })

  it('does not request or start a timer until a session id exists', () => {
    vi.useFakeTimers()
    const { fetchMock } = stubServer()
    const { Wrapper } = wrapper()

    const { result } = renderHook(() => useLoanPayoffTimelinePreference(undefined), { wrapper: Wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('aborts after 2000 ms, does not retry, and a remount does not request it again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = vi.fn((_path: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }))
    vi.stubGlobal('fetch', fetchMock)
    const { Wrapper } = wrapper()

    const first = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => { await vi.advanceTimersByTimeAsync(1900) })
    expect(first.result.current.isPending).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    await waitFor(() => expect(first.result.current.isError).toBe(true))
    first.unmount()

    const second = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second.result.current.isError).toBe(true)
    expect(second.result.current.data).toBeUndefined()
  })

  it('a failed load is not requested again on remount', async () => {
    const fetchMock = vi.fn(async () => Response.json({ title: 'Boom', status: 500 }, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const { Wrapper } = wrapper()

    const first = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
    await waitFor(() => expect(first.result.current.isError).toBe(true))
    first.unmount()
    renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never refetches a loaded view on focus, reconnect or remount', async () => {
    const { gets } = stubServer('Schedule')
    const { Wrapper, queryClient } = wrapper()

    const first = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
    await waitFor(() => expect(first.result.current.data).toEqual({ view: 'Schedule' }))
    first.unmount()
    const second = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(gets).toHaveLength(1)
    expect(second.result.current.data).toEqual({ view: 'Schedule' })
    const options = queryClient.getQueryCache()
      .find({ queryKey: loanPayoffTimelinePreferenceQueryKey('user-1') })?.options
    expect(options).toMatchObject({
      retry: false,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })
  })

  describe('after more than 5 minutes away from Mortgages', () => {
    // The app QueryClient keeps the library's 5-minute gcTime; an unobserved entry must outlive it.
    const AWAY_MS = 6 * 60 * 1000

    it('keeps a loaded view and does not request it again', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const { gets } = stubServer('Schedule')
      const { Wrapper } = wrapper()

      const first = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
      await waitFor(() => expect(first.result.current.data).toEqual({ view: 'Schedule' }))
      first.unmount()
      await act(async () => { await vi.advanceTimersByTimeAsync(AWAY_MS) })

      const second = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
      expect(second.result.current.data).toEqual({ view: 'Schedule' })
      expect(second.result.current.isLoading).toBe(false)
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      expect(gets).toHaveLength(1)
    })

    it('keeps a failed load failed and does not request it again', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const fetchMock = vi.fn(async () => Response.json({ title: 'Boom', status: 500 }, { status: 500 }))
      vi.stubGlobal('fetch', fetchMock)
      const { Wrapper } = wrapper()

      const first = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
      await waitFor(() => expect(first.result.current.isError).toBe(true))
      first.unmount()
      await act(async () => { await vi.advanceTimersByTimeAsync(AWAY_MS) })

      const second = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
      expect(second.result.current.isLoading).toBe(false)
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(second.result.current.data).toBeUndefined()
    })

    it('keeps the view last chosen when its save failed', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const gets: RequestInit[] = []
      const puts: RequestInit[] = []
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
        if (String(input) === '/api/security/csrf-token') {
          return Response.json({ requestToken: 'csrf-token' })
        }
        if ((init.method ?? 'GET') === 'GET') {
          gets.push(init)
          return Response.json({ view: 'Burndown' })
        }
        puts.push(init)
        return Response.json({ title: 'Boom', status: 500 }, { status: 500 })
      }))
      const { Wrapper, queryClient } = wrapper()

      const first = renderHook(() => ({
        preference: useLoanPayoffTimelinePreference('user-1'),
        saver: useSaveLoanPayoffTimelinePreference(),
      }), { wrapper: Wrapper })
      await waitFor(() => expect(first.result.current.preference.data).toEqual({ view: 'Burndown' }))
      act(() => {
        // As the page switches: cache first, then save.
        queryClient.setQueryData(loanPayoffTimelinePreferenceQueryKey('user-1'), { view: 'Schedule' })
        first.result.current.saver.save('Schedule')
      })
      await waitFor(() => expect(puts).toHaveLength(1))
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      first.unmount()
      await act(async () => { await vi.advanceTimersByTimeAsync(AWAY_MS) })

      const second = renderHook(() => useLoanPayoffTimelinePreference('user-1'), { wrapper: Wrapper })
      expect(second.result.current.data).toEqual({ view: 'Schedule' })
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      expect(gets).toHaveLength(1)
    })
  })

  it('starts every save at once with one client id and increasing sequences, and never writes the cache', async () => {
    const { puts } = stubServer()
    const { Wrapper, queryClient } = wrapper()
    queryClient.setQueryData(loanPayoffTimelinePreferenceQueryKey('user-1'), { view: 'Burndown' })
    const hook = renderHook(() => useSaveLoanPayoffTimelinePreference(), { wrapper: Wrapper })

    act(() => {
      hook.result.current.save('Schedule')
      hook.result.current.save('Burndown')
      hook.result.current.save('Schedule')
    })

    // All three are in flight together: none waits for another.
    await waitFor(() => expect(puts).toHaveLength(3))
    const [first, second, third] = puts.map((put) => put.body)
    expect(new Set(puts.map((put) => put.body.clientId)).size).toBe(1)
    expect(first?.clientId).toMatch(/^[0-9a-f-]{36}$/)
    expect([second?.clientSequence, third?.clientSequence])
      .toEqual([(first?.clientSequence ?? 0) + 1, (first?.clientSequence ?? 0) + 2])
    expect(puts.map((put) => put.body.view)).toEqual(['Schedule', 'Burndown', 'Schedule'])
    expect(puts.every((put) => put.init.keepalive === true)).toBe(true)

    // The oldest response arrives last; the cache stays as the page set it.
    await act(async () => {
      puts[2]?.release()
      puts[1]?.release()
      puts[0]?.release()
    })
    expect(queryClient.getQueryData(loanPayoffTimelinePreferenceQueryKey('user-1'))).toEqual({ view: 'Burndown' })

    // Leaving and returning keeps the page-load client id and continues the sequence.
    hook.unmount()
    const again = renderHook(() => useSaveLoanPayoffTimelinePreference(), { wrapper: Wrapper })
    act(() => { again.result.current.save('Burndown') })
    await waitFor(() => expect(puts).toHaveLength(4))
    expect(puts[3]?.body.clientId).toBe(first?.clientId)
    expect(puts[3]?.body.clientSequence).toBe((first?.clientSequence ?? 0) + 3)
    puts[3]?.release()
  })
})

describe('theme preference API', () => {
  it.each(['Light', 'Dark', 'System'] as const)('accepts the canonical %s mode', async (mode) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ mode })))

    await expect(getThemePreference()).resolves.toEqual({ mode })
  })

  it('rejects unsupported response modes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ mode: 'dark' })))

    await expect(getThemePreference()).rejects.toMatchObject({
      name: 'ApiError',
      status: 200,
      message: 'The server returned an invalid response.',
    })
  })

  it('sends an authenticated-mode update with the shared antiforgery token', async () => {
    const requests: { path: string; init?: RequestInit }[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
      requests.push({ path, init })
      if (path === '/api/security/csrf-token') {
        return Response.json({ requestToken: 'csrf-token' })
      }

      return Response.json({ mode: 'Dark' })
    }))

    await expect(saveThemePreference('Dark')).resolves.toEqual({ mode: 'Dark' })

    expect(requests.map(({ path }) => path)).toEqual([
      '/api/security/csrf-token',
      '/api/preferences/theme',
    ])
    const updateRequest = requests[1]
    expect(updateRequest).toBeDefined()
    if (!updateRequest) {
      throw new Error('The theme preference update request was not sent.')
    }

    expect(updateRequest.init?.method).toBe('PUT')
    expect(JSON.parse(String(updateRequest.init?.body))).toEqual({ mode: 'Dark' })
    expect(new Headers(updateRequest.init?.headers).get('X-CSRF-TOKEN')).toBe('csrf-token')
  })

  it('preserves save failures as typed API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      status: 503,
      title: 'Preference service unavailable.',
    }, { status: 503, headers: { 'Content-Type': 'application/problem+json' } })))

    const failingSave = saveThemePreference('System')
    await expect(failingSave).rejects.toBeInstanceOf(ApiError)
    await expect(failingSave).rejects.toMatchObject({
      status: 503,
      problem: { title: 'Preference service unavailable.' },
    })
  })
})
