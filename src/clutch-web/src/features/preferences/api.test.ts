import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, clearCsrfToken } from '@/lib/api/client'
import {
  getNavigationPreference,
  getThemePreference,
  saveNavigationPreference,
  saveThemePreference,
  useNavigationPreference,
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
